import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MB = 1024 * 1024;
const MAX_IMAGE = 12 * MB;
const MAX_BODY = 70 * MB;
const MAX_PROVIDER_BODY = 24 * MB;
const MAX_OUTPUT = 16 * MB;
const LIMITATIONS = ['semantic_mask_only', 'geometry_controls_are_prompt_guidance', 'product_identity_not_guaranteed'];

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (message) => { throw new ApiError(400, message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, name, max = 8000) {
  if (typeof value !== 'string' || value.length > max) fail(`${name} must be text of at most ${max} characters.`);
  return value;
}
function imagePart(value, name, max = MAX_IMAGE) {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4 + 40) fail(`${name} exceeds its image limit.`);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) fail(`${name} must be an inline PNG, JPEG or WebP image.`);
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > max || bytes.toString('base64') !== match[2]) fail(`${name} has invalid image data.`);
  const valid = match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) fail(`${name} has an invalid image signature.`);
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

export function validateRequest(body) {
  if (!plain(body)) fail('Expected a JSON object.');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(body.request_id || '')) fail('A stable request_id of 8–100 safe characters is required.');
  if (!['Interior', 'Living room', 'Bedroom', 'Kitchen / dining', 'Office interior', 'Hospitality interior', 'Kitchen', 'Dining room', 'Office', 'Retail', 'Hospitality'].includes(body.scene)) fail('Only interior scenes are supported.');
  if (!['full', 'inpaint'].includes(body.edit_mode)) fail('Unsupported edit_mode.');
  const source = imagePart(body.source_image, 'source_image');
  if (!Array.isArray(body.reference_images) || body.reference_images.length > 3) fail('Provide up to three reference images.');
  const references = body.reference_images.map((value, i) => imagePart(value, `reference_images[${i}]`));
  text(body.prompt, 'prompt');
  for (const key of ['style', 'negative_prompt', 'material_prompt']) if (body[key] !== undefined) text(body[key], key);
  for (const key of ['structure_strength', 'variation_strength']) if (body[key] !== undefined && (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || body[key] < 0 || body[key] > 1)) fail(`${key} must be between zero and one.`);
  let mask = null;
  if (body.edit_mode === 'inpaint') {
    mask = imagePart(body.mask_image, 'mask_image');
    if (mask.inlineData.mimeType !== 'image/png') fail('mask_image must be a PNG.');
  } else if (body.mask_image != null) fail('A mask is only valid for local editing.');
  const workflow = body.interior_workflow;
  if (workflow !== undefined) {
    if (!plain(workflow) || workflow.schema !== 1 || !['atmosphere', 'replace'].includes(workflow.intent)) fail('Unsupported interior workflow.');
    if (!Array.isArray(workflow.reference_bindings) || workflow.reference_bindings.length > 3) fail('Invalid reference bindings.');
    for (const binding of workflow.reference_bindings) {
      if (!plain(binding) || !Number.isInteger(binding.reference_index) || binding.reference_index < 0 || binding.reference_index >= references.length || !['replacement', 'atmosphere'].includes(binding.purpose)) fail('Reference binding does not match an uploaded reference.');
      text(binding.target_description || '', 'target_description', 1000);
      if (binding.target_object_id != null && (typeof binding.target_object_id !== 'string' || binding.target_object_id.length > 200)) fail('Invalid target object ID.');
    }
    if (workflow.reference_bindings.length !== references.length || new Set(workflow.reference_bindings.map(value => value.reference_index)).size !== references.length) fail('Each reference image needs exactly one binding.');
    if (workflow.intent === 'replace') {
      if (body.edit_mode !== 'inpaint' || !references.length || !workflow.reference_bindings.some(binding => binding.purpose === 'replacement')) fail('Furniture replacement needs a mask and a bound reference.');
      if (!plain(workflow.target)) fail('Furniture replacement needs a target.');
      if (workflow.target.description !== undefined) text(workflow.target.description, 'target description', 1000);
      if (workflow.target.object_id != null && (typeof workflow.target.object_id !== 'string' || workflow.target.object_id.length > 200)) fail('Invalid target object ID.');
      if (!workflow.target.object_id && !workflow.target.description?.trim()) fail('Furniture replacement needs a target.');
      if (workflow.reference_bindings.some(binding => binding.purpose !== 'replacement' || (binding.target_object_id || null) !== (workflow.target.object_id || null) || (binding.target_description || '').trim() !== (workflow.target.description || '').trim())) fail('Replacement references must bind to the selected target.');
      if (!plain(workflow.region) || workflow.region.kind !== 'painted-mask' || workflow.region.white_means !== 'modify') fail('Furniture replacement needs a painted edit region.');
    } else if (workflow.reference_bindings.some(binding => binding.purpose !== 'atmosphere')) {
      fail('Atmosphere references cannot contain replacement bindings.');
    }
  }
  return { source, references, mask, workflow };
}

export function providerPayload(body, parsed = validateRequest(body)) {
  const { source, references, mask, workflow } = parsed;
  const controls = [
    'Produce one photorealistic INTERIOR architectural visualization based on source image 1.',
    body.prompt,
    body.preserve_geometry ? 'Preserve camera perspective, walls, doors, windows and spatial relationships.' : '',
    `Material direction: ${body.material_prompt || 'Follow the source and references.'}`,
    `Avoid: ${body.negative_prompt || 'Distorted geometry and invented openings.'}`,
    `Structural preference: ${body.structure_strength ?? 0.85}; creative variation preference: ${body.variation_strength ?? 0.3}. These are descriptive priorities, not numeric engine controls.`,
    workflow?.intent === 'replace' ? `Replace target: ${workflow.target.description || workflow.target.object_id}. Each reference below identifies its target; do not apply the furniture appearance to the entire room.` : 'Use references as atmosphere and material guidance.',
    mask ? 'The final image is an EDIT REGION GUIDE, not a design reference. WHITE indicates the region to modify and BLACK indicates the region to preserve. Change only the designated region and necessary contact shadows. Return the edited source, never the guide.' : '',
    'Do not claim product dimensions or exact brand identity.'
  ].filter(Boolean).join('\n');
  const parts = [{ text: controls }, { text: 'SOURCE IMAGE 1:' }, source];
  references.forEach((part, index) => {
    const binding = workflow?.reference_bindings.find(value => value.reference_index === index);
    parts.push({ text: `REFERENCE ${index + 1}: ${binding ? `${binding.purpose}; target ${binding.target_description || binding.target_object_id || 'general atmosphere'}` : 'general atmosphere and materials'}` }, part);
  });
  if (mask) parts.push({ text: 'EDIT REGION GUIDE (white = modify, black = preserve):' }, mask);
  return { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'] } };
}

async function limitedBytes(stream, limit) {
  let size = 0; const chunks = [];
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk); size += bytes.length;
    if (size > limit) throw new ApiError(413, 'Image request or response exceeds the size limit.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export async function callGemini(body, { apiKey, model, timeoutMs, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(providerPayload(body)), signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) { await response.body?.cancel(); throw new ApiError(502, 'The image provider rejected the request. Check the server configuration and provider quota.'); }
  const result = JSON.parse(await limitedBytes(response.body, MAX_PROVIDER_BODY));
  const parts = result.candidates?.[0]?.content?.parts;
  const part = parts?.find(value => !value.thought && value.inlineData?.data);
  if (!part) throw new ApiError(502, 'The provider did not return an image. The request may have been blocked or the model may not support image output.');
  const image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  try { imagePart(image, 'provider output', MAX_OUTPUT); } catch { throw new ApiError(502, 'The provider returned an unsupported image.'); }
  return { image_data_url: image, request_id: body.request_id, provider: 'google-gemini', model, limitations: LIMITATIONS, created_at: new Date().toISOString() };
}

export function createRenderServer(config, { render = body => callGemini(body, config), now = Date.now } = {}) {
  if (typeof config.accessToken !== 'string' || config.accessToken.length < 32) throw Error('RENDER_ACCESS_TOKEN must contain at least 32 characters.');
  if (!Array.isArray(config.allowedOrigins) || !config.allowedOrigins.length || config.allowedOrigins.some(value => { try { return new URL(value).origin !== value || !/^https?:/.test(value); } catch { return true; } })) throw Error('Configure exact ALLOWED_ORIGINS without paths or wildcards.');
  const jobs = new Map(); let active = 0; let cachedBytes = 0; let hourStart = now(); let admitted = 0;
  const ttl = config.cacheTtlMs ?? 24 * 60 * 60 * 1000;
  const maxEntries = config.maxEntries ?? 64;
  const maxCacheBytes = config.maxCacheBytes ?? 128 * MB;
  const maxPerHour = config.maxPerHour ?? 20;
  const tokenHash = createHash('sha256').update(config.accessToken).digest();
  const send = (res, code, data) => { if (res.destroyed) return; res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
  const server = http.createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      if (origin && !config.allowedOrigins.includes(origin)) throw new ApiError(403, 'Origin is not allowed.');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.url === '/health' && req.method === 'GET') return send(res, 200, { status: 'ok', scope: 'interior-operator-pilot', billing: false, limitations: LIMITATIONS });
      if (req.url !== '/api/render') throw new ApiError(404, 'Not found.');
      if (req.method === 'OPTIONS') {
        const requested = String(req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
        if (!origin || req.headers['access-control-request-method'] !== 'POST' || requested.some(value => !['content-type', 'authorization'].includes(value))) throw new ApiError(403, 'Preflight is not allowed.');
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' }); return res.end();
      }
      if (req.method !== 'POST') throw new ApiError(405, 'Use POST.');
      const supplied = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1] || '';
      if (!timingSafeEqual(tokenHash, createHash('sha256').update(supplied).digest())) throw new ApiError(401, 'A valid operator service access token is required.');
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new ApiError(415, 'Content-Type must be application/json.');
      if (Number(req.headers['content-length']) > MAX_BODY) throw new ApiError(413, 'Request exceeds the size limit.');
      let body;
      try { body = JSON.parse(await limitedBytes(req, MAX_BODY)); } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'Invalid JSON request.'); }
      validateRequest(body);
      const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
      for (const [id, job] of jobs) if (job.completedAt !== null && now() - job.completedAt > ttl) { cachedBytes -= job.bytes; jobs.delete(id); }
      const previous = jobs.get(body.request_id);
      if (previous) {
        if (previous.digest !== digest) throw new ApiError(409, 'This request_id was already used for different inputs.');
        const result = await previous.promise; return send(res, result.code, result.body);
      }
      if (now() - hourStart >= 3600000) { hourStart = now(); admitted = 0; }
      if (active >= (config.maxConcurrent ?? 2) || jobs.size >= maxEntries || cachedBytes + (active + 1) * MAX_PROVIDER_BODY > maxCacheBytes || admitted >= maxPerHour) throw new ApiError(429, 'Operator service capacity reached. Retry later with the same request_id.');
      const job = { digest, bytes: 0, completedAt: null, promise: null }; jobs.set(body.request_id, job); active++; admitted++;
      job.promise = (async () => {
        let result;
        try { result = { code: 200, body: await render(body) }; }
        catch (error) { result = { code: error.name === 'TimeoutError' ? 504 : 502, body: { error: error instanceof ApiError ? error.message : 'Rendering failed. Inspect provider availability or server configuration; no automatic provider retry was made.', request_id: body.request_id } }; }
        job.bytes = Buffer.byteLength(JSON.stringify(result)); cachedBytes += job.bytes; job.completedAt = now(); active--; return result;
      })();
      const result = await job.promise; send(res, result.code, result.body);
    } catch (error) { send(res, error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : 'Server request failed.' }); }
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  return server;
}

export function configFromEnv(env = process.env) {
  if (!env.GEMINI_API_KEY) throw Error('GEMINI_API_KEY is required on the server.');
  if (!/^gemini[-a-z0-9.]+$/.test(env.GEMINI_IMAGE_MODEL || '')) throw Error('Set GEMINI_IMAGE_MODEL explicitly to an image-capable Gemini model.');
  const positive = (key, fallback, maximum) => { const value = Number(env[key] || fallback); if (!Number.isInteger(value) || value <= 0 || value > maximum) throw Error(`Invalid ${key}.`); return value; };
  return { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_IMAGE_MODEL, accessToken: env.RENDER_ACCESS_TOKEN,
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
    timeoutMs: positive('RENDER_TIMEOUT_MS', 150000, 170000), maxPerHour: positive('RENDER_MAX_JOBS_PER_HOUR', 20, 1000),
    maxConcurrent: positive('RENDER_MAX_CONCURRENT', 2, 4) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = createRenderServer(configFromEnv()); const port = Number(process.env.PORT || 8080);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT.');
    server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`PlotCloud interior operator service listening on port ${port}.`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
