// Interior rendering with the person's own OpenAI key (2026-11-19). Everything runs in this browser: the key is kept here only
// (this session, or this device when asked), the view and any reference pictures go from here straight to api.openai.com, and
// the images come back here and are kept in this browser's IndexedDB. PlotCloud's servers see none of it.
// A render is a presentation image: it is not a daylight, comfort or any other performance result.

const API = 'https://api.openai.com/v1';
const KEY = 'pc-openai-key', MODEL = 'pc-render-model';
export const SIZES = [['1536x1024', 'Landscape 3:2'], ['1024x1024', 'Square'], ['1024x1536', 'Portrait 2:3']];
export const QUALITY = [['medium', 'Medium'], ['high', 'High (slower, costs more)'], ['low', 'Low (draft)']];

// ---- the key: this session only, unless "remember on this device"
export function savedKey() { try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
export function keyRemembered() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
export function setKey(k, remember) { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); if (k) (remember ? localStorage : sessionStorage).setItem(KEY, k); } catch (e) { } }
export function savedModel() { try { return localStorage.getItem(MODEL) || ''; } catch (e) { return ''; } }
export function setModel(m) { try { localStorage.setItem(MODEL, m); } catch (e) { } }

async function call(path, key, init = {}) {
  let r; try { r = await fetch(API + path, { ...init, headers: { Authorization: 'Bearer ' + key, ...(init.headers || {}) }, credentials: 'omit', referrerPolicy: 'no-referrer' }); }
  catch (e) { throw Error(e.name === 'AbortError' ? 'Stopped.' : 'Could not reach OpenAI (api.openai.com). Check the connection, or whether a firewall blocks it.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const m = j?.error?.message || ''; throw Error(r.status === 401 ? 'OpenAI did not accept this key. Check it at platform.openai.com → API keys.'
    : r.status === 429 ? 'OpenAI refused for now: rate limit or no credit on this account. ' + m
    : r.status === 403 ? 'This key cannot use that model (the OpenAI organization may need verifying for image models). ' + m
    : (m || 'OpenAI returned HTTP ' + r.status + '.')); }
  return j;
}
// the image models this key can use, newest names first
export async function listModels(key) {
  const j = await call('/models', key), ids = (j.data || []).map((m) => m.id).filter((id) => /image/i.test(id) && !/dall-e-2/.test(id));
  return ids.sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
}

// the instruction sent with the view: keep what the model fixes (camera, geometry, layout), change what the designer asks
export function buildPrompt({ desc = '', furniture = [], refs = [], region = false, keep = true, scene = 'interior' }) {
  const L = [`Photorealistic ${scene} rendering made from the first image, a view of an architectural 3D model.`];
  if (keep) L.push('Keep exactly the camera position, lens and framing, the room geometry, walls, floors, ceilings, windows and doors, and the position, size and orientation of every furniture piece. Do not add or remove rooms, openings or furniture.');
  if (furniture.length) L.push('Furniture in the view (as modelled): ' + furniture.join('; ') + '.');
  refs.forEach((r, i) => L.push(`Image ${i + 2} is a reference for ${r.name ? `"${r.name}"` : 'a product'}${r.role ? ` (${r.role})` : ''}: match its design, materials and colours where that piece appears.`));
  if (region) L.push('Change only the transparent (masked) area of the first image; leave everything else as it is.');
  if (desc.trim()) L.push('Design intent: ' + desc.trim());
  L.push('Natural, plausible lighting and materials; no text, people, watermarks or captions.');
  return L.join('\n');
}

const toBlob = async (dataURL) => (await fetch(dataURL)).blob();
// one edit request: the view first, then the references; the mask (transparent = may change) applies to the view
export async function renderEdit({ key, model, image, mask = null, refs = [], prompt, size = '1536x1024', quality = 'medium', n = 1, signal }) {
  const fd = new FormData(); fd.append('model', model); fd.append('prompt', prompt); fd.append('size', size); fd.append('quality', quality); fd.append('n', String(n));
  fd.append('image[]', await toBlob(image), 'view.png'); for (let i = 0; i < refs.length; i++) fd.append('image[]', await toBlob(refs[i].image), `reference-${i + 1}.png`);
  if (mask) fd.append('mask', await toBlob(mask), 'mask.png');
  const j = await call('/images/edits', key, { method: 'POST', body: fd, signal });
  const out = (j.data || []).map((d) => d.b64_json ? 'data:image/png;base64,' + d.b64_json : d.url).filter(Boolean);
  if (!out.length) throw Error('OpenAI returned no image.'); return { images: out, usage: j.usage || null };
}

// ---- the mask from the painted region: same size as the view, transparent where it may change, opaque elsewhere
export function maskFrom(regionCanvas) {
  const w = regionCanvas.width, h = regionCanvas.height, src = regionCanvas.getContext('2d').getImageData(0, 0, w, h).data, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), out = x.createImageData(w, h); let any = 0;
  for (let i = 0; i < w * h; i++) { const painted = src[i * 4 + 3] > 10; out.data[i * 4 + 3] = painted ? 0 : 255; if (painted) any++; }
  if (!any) return null; x.putImageData(out, 0, 0); return { dataURL: c.toDataURL('image/png'), share: any / (w * h) };
}

// ---- the images: their own IndexedDB store (the project keeps only each render's details)
let dbP = null;
const db = () => dbP || (dbP = new Promise((res, rej) => { const r = indexedDB.open('plotcloud-renders', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const tx = (mode, fn) => db().then((d) => new Promise((res, rej) => { const t = d.transaction('img', mode), q = fn(t.objectStore('img')); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }));
export const putImages = (id, rec) => tx('readwrite', (s) => s.put(rec, id));
export const getImages = (id) => tx('readonly', (s) => s.get(id));
export const delImages = (id) => tx('readwrite', (s) => s.delete(id));

// a short fingerprint of the model, to tell whether a render still shows the model as it is
export function modelRev(studio) { const s = JSON.stringify(studio || {}); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

// the PNG to keep or share: the image with a caption band (what it is, when, from which view, and that it is not a result)
export async function captioned(dataURL, lines) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataURL; });
  const band = Math.round(Math.max(48, img.width * 0.045)), c = document.createElement('canvas'); c.width = img.width; c.height = img.height + band; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); x.fillStyle = '#1d2433'; const fs = Math.round(band * 0.3); x.font = `${fs}px Inter, Arial, sans-serif`;
  lines.slice(0, 2).forEach((t, i) => x.fillText(t, Math.round(fs * 0.8), img.height + fs * 1.25 + i * fs * 1.35, c.width - fs * 1.6)); return c.toDataURL('image/png');
}
export async function sideBySide(a, b, labels) {
  const L = await Promise.all([a, b].map((u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; })));
  const h = Math.min(L[0].height, L[1].height), w0 = Math.round(L[0].width * h / L[0].height), w1 = Math.round(L[1].width * h / L[1].height), gap = 16, band = Math.round(h * 0.07);
  const c = document.createElement('canvas'); c.width = w0 + w1 + gap; c.height = h + band; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(L[0], 0, 0, w0, h); x.drawImage(L[1], w0 + gap, 0, w1, h); x.fillStyle = '#1d2433'; const fs = Math.round(band * 0.38); x.font = `${fs}px Inter, Arial, sans-serif`;
  x.fillText(labels[0], fs * 0.6, h + fs * 1.5, w0 - fs); x.fillText(labels[1], w0 + gap + fs * 0.6, h + fs * 1.5, w1 - fs); return c.toDataURL('image/png');
}
