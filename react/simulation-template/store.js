// UI state for the unified simulation template (Zustand). Only local, per-study state lives here: view mode, animation,
// sidebar and each study's local parameters. Project-wide (global) parameters are owned by the Dashboard "Overview" tab.
import { create } from 'zustand';
import { SCHEMAS, defaultsFor, localOnly } from './schemas.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const useSimulationStore = create((set, get) => ({
  view: '3d',                 // 'plan' | '3d'
  playing: false,
  sidebarOpen: true,
  openGroups: {},             // `${simId}:${title}` → boolean (collapsible sections)
  time: {},                   // simId → animation value
  params: {},                 // simId → local parameters

  setView: (view) => set({ view: view === 'plan' ? 'plan' : '3d' }),
  toggleView: () => set((s) => ({ view: s.view === 'plan' ? '3d' : 'plan' })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleGroup: (simId, title) => set((s) => { const k = `${simId}:${title}`; return { openGroups: { ...s.openGroups, [k]: !(s.openGroups[k] ?? true) } }; }),

  // parameters: defaults from the schema, then any local values passed in; global keys are dropped
  initStudy: (simId, initial = {}) => set((s) => (s.params[simId] ? {} : { params: { ...s.params, [simId]: { ...defaultsFor(simId), ...localOnly(initial) } } })),
  paramsFor: (simId) => get().params[simId] || defaultsFor(simId),
  setParam: (simId, key, value) => set((s) => {
    const field = SCHEMAS[simId]?.groups.flatMap((g) => g.fields).find((f) => f.key === key);
    if (!field) return {};   // unknown or global key: never stored on a simulation
    const v = field.type === 'number' ? (Number.isFinite(+value) ? clamp(+value, field.min ?? -Infinity, field.max ?? Infinity) : field.default) : value;
    return { params: { ...s.params, [simId]: { ...(s.params[simId] || defaultsFor(simId)), [key]: v } } };
  }),
  resetParams: (simId) => set((s) => ({ params: { ...s.params, [simId]: defaultsFor(simId) } })),

  // animation along the study's own axis (hour, month, wind direction…)
  timeFor: (simId) => { const a = SCHEMAS[simId]?.animation; return a ? (get().time[simId] ?? a.min) : null; },
  setTime: (simId, value) => { const a = SCHEMAS[simId]?.animation; if (!a) return; set((s) => ({ time: { ...s.time, [simId]: clamp(+value, a.min, a.max) } })); },
  step: (simId) => { const a = SCHEMAS[simId]?.animation; if (!a) return; const cur = get().timeFor(simId), next = cur + a.step > a.max + 1e-9 ? a.min : cur + a.step; set((s) => ({ time: { ...s.time, [simId]: next } })); },
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
}));
