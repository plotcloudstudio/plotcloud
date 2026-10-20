import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { callGemini, configFromEnv, createRenderServer, providerPayload, validateRequest } from './render-api.mjs';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=';
const token = 'test-operator-access-token-at-least-32-characters';
const origin = 'https://plotcloudstudio.github.io';
const config = { accessToken: token, allowedOrigins: [origin] };
const input = (patch = {}) => ({ request_id: 'request-test-0001', scene: 'Interior', edit_mode: 'full', source_image: png, reference_images: [], prompt: 'Photorealistic living room.', ...patch });
async function harness(t, render, options = {}) {
  const server = createRenderServer({ ...config, ...options }, { render });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, post: (body = input(), headers = {}) => fetch(base + '/api/render', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) }) };
}

test('rejects unconfigured credentials, wildcard origins and implicit model', () => {
  assert.throws(() => createRenderServer({ ...config, accessToken: '' }), /RENDER_ACCESS_TOKEN/);
  assert.throws(() => createRenderServer({ ...config, allowedOrigins: ['*'] }), /ALLOWED_ORIGINS/);
  assert.throws(() => configFromEnv({ GEMINI_API_KEY: 'unused' }), /GEMINI_IMAGE_MODEL/);
  assert.throws(() => configFromEnv({ GEMINI_API_KEY: 'unused', GEMINI_IMAGE_MODEL: '../../other' }), /GEMINI_IMAGE_MODEL/);
});
test('blocks external image URLs, mismatched MIME types and unsupported scenes before provider access', () => {
  assert.throws(() => validateRequest(input({ source_image: 'http://169.254.169.254/latest/meta-data' })), /inline/);
  assert.throws(() => validateRequest(input({ source_image: png.replace('image/png', 'image/jpeg') })), /signature/);
  assert.throws(() => validateRequest(input({ scene: 'Exterior' })), /interior/);
  assert.throws(() => validateRequest(input({ reference_images: Array(4).fill(png) })), /three/);
  assert.throws(() => validateRequest(input({ structure_strength: 5 })), /between/);
});
test('accepts every interior scene offered by the renderer', () => {
  for (const scene of ['Interior', 'Living room', 'Bedroom', 'Kitchen / dining', 'Office interior', 'Hospitality interior']) assert.doesNotThrow(() => validateRequest(input({ scene })));
});
test('requires target, bound reference and edit region for furniture replacement', () => {
  const workflow = { schema: 1, intent: 'replace', target: { description: 'Sofa beside the left window' }, reference_bindings: [{ reference_index: 0, purpose: 'replacement', target_description: 'Sofa beside the left window' }], region: { kind: 'painted-mask', white_means: 'modify' } };
  const good = input({ edit_mode: 'inpaint', mask_image: png, reference_images: [png], interior_workflow: workflow });
  assert.doesNotThrow(() => validateRequest(good));
  assert.throws(() => validateRequest({ ...good, reference_images: [] }), /binding/);
  assert.throws(() => validateRequest({ ...good, mask_image: null }), /image limit/);
  assert.throws(() => validateRequest({ ...good, interior_workflow: { ...workflow, target: { description: {} } } }), /text/);
  assert.throws(() => validateRequest({ ...good, interior_workflow: { ...workflow, reference_bindings: [{ ...workflow.reference_bindings[0], target_description: 'A different sofa' }] } }), /selected target/);
  assert.throws(() => validateRequest({ ...good, interior_workflow: { ...workflow, reference_bindings: [{ ...workflow.reference_bindings[0], target_object_id: 'wrong-object' }] } }), /selected target/);
  const parts = providerPayload(good).contents[0].parts;
  assert.match(parts[0].text, /Replace target: Sofa beside the left window/);
  assert.match(parts[3].text, /REFERENCE 1: replacement/);
  assert.match(parts.at(-2).text, /white = modify/);
  assert.deepEqual(parts.at(-1).inlineData, { mimeType: 'image/png', data: png.split(',')[1] });
});
test('health is public but provider jobs require bearer auth and exact allowed origin', async t => {
  let count = 0; const { base, post } = await harness(t, async () => { count++; return { image_data_url: png }; });
  const health = await fetch(base + '/health'); assert.equal(health.status, 200); assert.equal((await health.json()).billing, false);
  assert.equal((await post(input(), { Authorization: '' })).status, 401);
  assert.equal((await post(input(), { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(input(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(input({ source_image: 'https://evil.example/a.png' }))).status, 400);
  assert.equal(count, 0);
  const preflight = await fetch(base + '/api/render', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  const denied = await fetch(base + '/api/render', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'DELETE' } }); assert.equal(denied.status, 403);
});
test('identical concurrent and completed retries share exactly one provider job; changed inputs conflict', async t => {
  let count = 0; let finish; const gate = new Promise(resolve => { finish = resolve; });
  const { post } = await harness(t, async body => { count++; await gate; return { image_data_url: png, request_id: body.request_id }; });
  const first = post(); const second = post();
  // Both fetch calls are in flight; releasing the provider still exercises pending/completed coalescing.
  setTimeout(finish, 20);
  const [a, b] = await Promise.all([first, second]); assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(count, 1);
  assert.deepEqual(await a.json(), await b.json()); assert.equal((await post()).status, 200); assert.equal(count, 1);
  assert.equal((await post(input({ prompt: 'A different interior' }))).status, 409); assert.equal(count, 1);
});
test('provider failures stay idempotent rather than automatically making a second paid request', async t => {
  let count = 0; const { post } = await harness(t, async () => { count++; throw new Error('secret provider response with key'); });
  const first = await post(); assert.equal(first.status, 502); assert.doesNotMatch(JSON.stringify(await first.json()), /secret provider/);
  assert.equal((await post()).status, 502); assert.equal(count, 1);
});
test('limits operator spending by counting new jobs while allowing retrieval of cached jobs', async t => {
  let count = 0; const { post } = await harness(t, async () => { count++; return { image_data_url: png }; }, { maxPerHour: 1 });
  assert.equal((await post()).status, 200);
  assert.equal((await post(input({ request_id: 'request-test-0002' }))).status, 429);
  assert.equal((await post()).status, 200); assert.equal(count, 1);
});
test('concurrency limit rejects a new ID while allowing a pending duplicate to finish', async t => {
  let finish, started; const entered = new Promise(resolve => { started = resolve; }); const gate = new Promise(resolve => { finish = resolve; });
  let count = 0;
  const { post } = await harness(t, async () => { count++; started(); await gate; return { image_data_url: png }; }, { maxConcurrent: 1 });
  const first = post(); await entered;
  const duplicate = post();
  const denied = await post(input({ request_id: 'request-test-0002' })); assert.equal(denied.status, 429);
  finish(); assert.equal((await first).status, 200); assert.equal((await duplicate).status, 200); assert.equal(count, 1);
});
test('provider adapter sends images to fixed Google host with server key and ignores thought images', async () => {
  let captured;
  const output = await callGemini(input(), { apiKey: 'provider-secret', model: 'gemini-test-image', timeoutMs: 1000, fetchImpl: async (url, init) => {
    captured = { url, init }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, inlineData: { mimeType: 'image/png', data: 'bad' } }, { inlineData: { mimeType: 'image/png', data: png.split(',')[1] } }] } }] }));
  } });
  assert.equal(captured.url, 'https://generativelanguage.googleapis.com/v1/models/gemini-test-image:generateContent');
  assert.equal(captured.init.headers['x-goog-api-key'], 'provider-secret'); assert.deepEqual(JSON.parse(captured.init.body).generationConfig.responseModalities, ['IMAGE']);
  assert.equal(output.image_data_url, png); assert.ok(output.limitations.includes('semantic_mask_only')); assert.doesNotMatch(JSON.stringify(output), /provider-secret/);
});
test('provider adapter rejects missing output, malformed images and upstream errors without exposing response', async () => {
  const settings = { apiKey: 'unused', model: 'gemini-test-image', timeoutMs: 1000 };
  await assert.rejects(callGemini(input(), { ...settings, fetchImpl: async () => new Response('{}') }), /did not return an image/);
  await assert.rejects(callGemini(input(), { ...settings, fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'invalid' } }] } }] })) }), /unsupported image/);
  await assert.rejects(callGemini(input(), { ...settings, fetchImpl: async () => new Response('secret error', { status: 403 }) }), /provider rejected/);
});
