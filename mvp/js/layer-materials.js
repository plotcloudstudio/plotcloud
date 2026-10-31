// Layer materials (2026-10-31): one material per Workspace layer, from a preset library. A material carries
//   look        colour, roughness, metalness and opacity, for the 3D view and the words a rendering request uses
//   structural  the structure study's material (structural-model.js MATERIALS) where one applies; the study still needs a role
//               and a section for each layer, set with Structure on the layer
//   reflectance visible reflectance (0–1), the typical value for the finish
//   rw, alpha   sound insulation Rw (dB) and sound absorption at 500 Hz
//   u, vt       U-value (W/m²K) and, for glass, visible transmittance
// Values are typical published figures for early design, not product data; a preset only fills the fields and the person edits
// any of them (layer.props). Nothing is applied until a material is chosen for the layer.
export const PRESETS = [
  { id: 'concrete', name: 'Concrete, cast in place', group: 'Structure', color: '#c9c6c0', rough: 0.85, metal: 0, opacity: 1, structural: 'concrete', reflectance: 0.35, words: 'smooth grey cast-in-place concrete' , rw: 55, alpha: 0.02, u: 2.5, vt: null },
  { id: 'concrete-exposed', name: 'Concrete, exposed board-formed', group: 'Structure', color: '#b8b4ad', rough: 0.9, metal: 0, opacity: 1, structural: 'concrete', reflectance: 0.3, words: 'board-formed exposed concrete with visible timber grain' , rw: 55, alpha: 0.02, u: 2.5, vt: null },
  { id: 'steel', name: 'Steel, painted', group: 'Structure', color: '#5d6168', rough: 0.45, metal: 0.6, opacity: 1, structural: 'steel', reflectance: 0.25, words: 'dark painted structural steel' , rw: null, alpha: 0.01, u: null, vt: null },
  { id: 'glulam', name: 'Glulam timber (Douglas fir)', group: 'Structure', color: '#c9a274', rough: 0.7, metal: 0, opacity: 1, structural: 'glulam', reflectance: 0.4, words: 'warm Douglas fir glulam timber' , rw: null, alpha: 0.1, u: null, vt: null },
  { id: 'clt', name: 'Cross-laminated timber (CLT)', group: 'Structure', color: '#d9b98c', rough: 0.75, metal: 0, opacity: 1, structural: null, reflectance: 0.45, words: 'pale cross-laminated timber panels' , rw: 40, alpha: 0.1, u: 0.6, vt: null },
  { id: 'brick', name: 'Brick, red', group: 'Walls', color: '#a8553f', rough: 0.9, metal: 0, opacity: 1, structural: null, reflectance: 0.25, words: 'red clay brick in stretcher bond' , rw: 50, alpha: 0.03, u: 1.6, vt: null },
  { id: 'brick-light', name: 'Brick, light buff', group: 'Walls', color: '#d8c4a4', rough: 0.9, metal: 0, opacity: 1, structural: null, reflectance: 0.4, words: 'light buff brick' , rw: 50, alpha: 0.03, u: 1.6, vt: null },
  { id: 'plaster', name: 'Plaster, painted white', group: 'Walls', color: '#f1efea', rough: 0.9, metal: 0, opacity: 1, structural: null, reflectance: 0.7, words: 'smooth white painted plaster' , rw: 48, alpha: 0.02, u: 1.4, vt: null },
  { id: 'gypsum', name: 'Gypsum board, painted', group: 'Walls', color: '#ebe9e4', rough: 0.9, metal: 0, opacity: 1, structural: null, reflectance: 0.75, words: 'painted gypsum board' , rw: 40, alpha: 0.05, u: 0.35, vt: null },
  { id: 'timber-cladding', name: 'Timber cladding', group: 'Walls', color: '#b58a5c', rough: 0.8, metal: 0, opacity: 1, structural: null, reflectance: 0.35, words: 'vertical timber cladding boards' , rw: 38, alpha: 0.08, u: 0.3, vt: null },
  { id: 'stone', name: 'Stone, limestone', group: 'Walls', color: '#dcd3c2', rough: 0.85, metal: 0, opacity: 1, structural: null, reflectance: 0.5, words: 'honed limestone panels' , rw: 52, alpha: 0.02, u: 2.0, vt: null },
  { id: 'aluminium', name: 'Aluminium panel', group: 'Walls', color: '#b9bec4', rough: 0.35, metal: 0.8, opacity: 1, structural: null, reflectance: 0.6, words: 'brushed aluminium panels' , rw: 30, alpha: 0.02, u: 0.4, vt: null },
  { id: 'glass-double', name: 'Glass, double glazing', group: 'Glazing', color: '#a9c6d6', rough: 0.05, metal: 0, opacity: 0.35, structural: 'glass', reflectance: 0.12, words: 'clear double glazing' , rw: 32, alpha: 0.03, u: 1.4, vt: 0.78 },
  { id: 'glass-lowe', name: 'Glass, double low-e', group: 'Glazing', color: '#9fbfcc', rough: 0.05, metal: 0, opacity: 0.4, structural: 'glass', reflectance: 0.14, words: 'low-e double glazing with a slight blue-green tint' , rw: 33, alpha: 0.03, u: 1.1, vt: 0.7 },
  { id: 'glass-triple', name: 'Glass, triple glazing', group: 'Glazing', color: '#9ab8c4', rough: 0.05, metal: 0, opacity: 0.45, structural: 'glass', reflectance: 0.16, words: 'triple glazing' , rw: 36, alpha: 0.03, u: 0.7, vt: 0.6 },
  { id: 'green-roof', name: 'Green roof, sedum', group: 'Roof and ground', color: '#8fa86a', rough: 1, metal: 0, opacity: 1, structural: null, reflectance: 0.2, words: 'extensive sedum green roof' , rw: 50, alpha: 0.35, u: 0.25, vt: null },
  { id: 'roof-membrane', name: 'Roof membrane, light grey', group: 'Roof and ground', color: '#d3d4d4', rough: 0.8, metal: 0, opacity: 1, structural: null, reflectance: 0.6, words: 'light grey roof membrane' , rw: 45, alpha: 0.03, u: 0.2, vt: null },
  { id: 'asphalt', name: 'Asphalt', group: 'Roof and ground', color: '#6d6f71', rough: 0.95, metal: 0, opacity: 1, structural: null, reflectance: 0.1, words: 'dark asphalt paving' , rw: null, alpha: 0.05, u: null, vt: null },
  { id: 'paving', name: 'Concrete paving', group: 'Roof and ground', color: '#cfccc5', rough: 0.9, metal: 0, opacity: 1, structural: null, reflectance: 0.35, words: 'light concrete paving slabs' , rw: null, alpha: 0.02, u: null, vt: null },
  { id: 'grass', name: 'Grass', group: 'Roof and ground', color: '#9cb87a', rough: 1, metal: 0, opacity: 1, structural: null, reflectance: 0.2, words: 'mown grass' , rw: null, alpha: 0.3, u: null, vt: null },
  { id: 'model-white', name: 'Study model white', group: 'Presentation', color: '#f4f4f2', rough: 0.95, metal: 0, opacity: 1, structural: null, reflectance: 0.8, words: 'matte white study-model surfaces' , rw: null, alpha: null, u: null, vt: null },
];
const BY = new Map(PRESETS.map((m) => [m.id, m]));
export const preset = (id) => BY.get(id) || null;
// the editable fields of a layer: what each holds and what uses it today
export const FIELDS = [
  ['color', 'Colour', 'color', '', 'Used by the 3D view and rendering requests'],
  ['reflectance', 'Light reflectance', 'number', '0–1', 'Kept with the model; studies use their own settings for now'],
  ['vt', 'Light transmittance', 'number', '0–1', 'Glass. Kept with the model; studies use their own settings for now'],
  ['rw', 'Sound insulation Rw', 'number', 'dB', 'Kept with the model; studies use their own settings for now'],
  ['alpha', 'Sound absorption α 500 Hz', 'number', '0–1', 'Kept with the model; studies use their own settings for now'],
  ['u', 'U-value', 'number', 'W/m²K', 'Kept with the model; studies use their own settings for now'],
];
// the layer's material and its values: the preset's, with the person's own values over them; null when none is chosen
export function materialOf(layer) { const m = preset(layer?.material); if (!m) return null; return { ...m, ...(layer.props || {}) }; }
// choosing a material fills the fields from the preset (the person's edits are replaced); the structure study's material follows
// unless one was set by hand in Structure
export function assign(layer, id) {
  const m = preset(id); if (!m) { delete layer.material; delete layer.props; return layer; } layer.material = id; layer.props = {};
  const st = layer.structural || {}; if (m.structural && (!st.material || st.material === 'unknown' || st.materialFrom === 'layer-material')) layer.structural = { ...st, material: m.structural, materialFrom: 'layer-material' };
  return layer;
}
// one value changed by the person
export function setProp(layer, key, value) { if (!layer.material) return layer; layer.props = { ...(layer.props || {}), [key]: value }; return layer; }
// the look of every layer that has a material, for the 3D view
export function looks(layers) { const out = {}; for (const l of layers || []) { const m = materialOf(l); if (m) out[l.name] = { color: m.color, opacity: m.opacity, rough: m.rough, metal: m.metal }; } return out; }
// the chosen materials in words, for a rendering request
export function describe(layers) { return (layers || []).filter((l) => l.visible !== false).map((l) => { const m = materialOf(l); return m ? `${l.name}: ${m.words}` : null; }).filter(Boolean).join('; '); }
export const groups = () => [...new Set(PRESETS.map((m) => m.group))].map((g) => [g, PRESETS.filter((m) => m.group === g)]);
