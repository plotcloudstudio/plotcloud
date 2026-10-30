// One template for every PlotCloud simulation (Sun Hours is the reference).
//   Left: collapsible sidebar with the study's LOCAL parameters only (schemas.js). No global values, inheritance or badges.
//   Right: the viewport — top toolbar (Plan / 3D, play-pause + timeline, export image), bottom-right legend overlay.
// The template draws no result itself. It drives a renderer adapter supplied by the host page, so an empty study shows an
// empty state instead of an invented heatmap:
//   renderer = {
//     mount(host: HTMLElement) → dispose?          attach the 3D/2D canvas
//     setView(mode: 'plan'|'3d', { durationMs })   smooth camera transition
//     setStyle({ context, analysis })              context = semi-transparent grey/white; analysis = vivid ramp
//     setParams(simId, params)                     local parameters changed
//     setTime(axis, value)                         animation frame (sun position, month, wind direction…)
//     exportImage() → Promise<string | Blob>       PNG of the current view
//     hasResult?: boolean                          a computed result is on screen
//   }
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Map, Play, Pause, Download, PanelLeftClose, PanelLeftOpen, ChevronDown, RotateCcw } from 'lucide-react';
import { SCHEMAS, localOnly } from './schemas.js';
import { useSimulationStore } from './store.js';

// Shared visual language for all simulations
export const CONTEXT_STYLE = { color: '#f1f2f4', edges: '#ffffff', opacity: 0.35 };
export const RAMPS = {
  sun: ['#1d1a4f', '#5b2a86', '#c2306b', '#f26b38', '#fbd34d', '#fff7b0'],
  heat: ['#2b1b6b', '#6a1b9a', '#d81b60', '#fb8c00', '#fdd835'],
  cool: ['#f7fcf0', '#a8ddb5', '#4eb3d3', '#0868ac', '#081d58'],
  diverging: ['#2166ac', '#67a9cf', '#f7f7f7', '#ef8a62', '#b2182b'],
};
const TRANSITION_MS = 600;
const FRAME_MS = 400;

function Field({ simId, field, value }) {
  const setParam = useSimulationStore((s) => s.setParam), id = `${simId}-${field.key}`;
  const base = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  if (field.type === 'toggle') return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 py-1 text-sm text-slate-700">
      <span>{field.label}</span>
      <input id={id} type="checkbox" className="h-4 w-4 accent-blue-600" checked={!!value} onChange={(e) => setParam(simId, field.key, e.target.checked)} />
    </label>);
  return (
    <label htmlFor={id} className="block py-1">
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-slate-600"><span>{field.label}</span>{field.unit ? <span className="text-slate-400">{field.unit}</span> : null}</span>
      {field.type === 'select'
        ? <select id={id} className={base} value={value} onChange={(e) => setParam(simId, field.key, e.target.value)}>{field.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        : <input id={id} className={base} type={field.type === 'number' ? 'number' : field.type} min={field.min} max={field.max} step={field.step} value={value}
            onChange={(e) => setParam(simId, field.key, field.type === 'number' ? e.target.value : e.target.value)} />}
      {field.help ? <span className="mt-1 block text-xs text-slate-400">{field.help}</span> : null}
    </label>);
}

function Legend({ spec, range }) {
  const min = range?.min ?? spec.min, max = range?.max ?? spec.max;
  return (
    <div data-testid="legend" className="pointer-events-none absolute bottom-3 right-3 w-56 rounded-lg border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-md">
      <div className="mb-2 font-semibold">{spec.label}{spec.unit ? ` (${spec.unit})` : ''}</div>
      {spec.ramp === 'categorical'
        ? <ul className="space-y-1">{spec.categories.map(([c, l]) => <li key={l} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: c }} />{l}</li>)}</ul>
        : <>
            <div className="h-2.5 rounded-sm" style={{ background: `linear-gradient(90deg, ${RAMPS[spec.ramp].join(',')})` }} />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-500"><span>{Number.isFinite(min) ? min : '—'}</span><span>{Number.isFinite(max) ? max : '—'}</span></div>
          </>}
    </div>);
}

export default function SimulationTemplate({ simulationType, localParams = {}, onParamsChange, renderer = null, legendRange = null, title }) {
  const schema = SCHEMAS[simulationType];
  const viewport = useRef(null);
  const [exporting, setExporting] = useState(false);
  const { view, setView, playing, togglePlay, pause, sidebarOpen, toggleSidebar, openGroups, toggleGroup, initStudy, setTime, step, resetParams } = useSimulationStore();
  const params = useSimulationStore((s) => s.params[simulationType]);
  const time = useSimulationStore((s) => (schema?.animation ? (s.time[simulationType] ?? schema.animation.min) : null));

  // local parameters only: global keys passed by mistake are dropped before they reach the panel or the store
  const initial = useMemo(() => localOnly(localParams), [localParams]);
  useEffect(() => { if (schema) initStudy(simulationType, initial); }, [simulationType, initial, schema, initStudy]);
  useEffect(() => { pause(); }, [simulationType, pause]);

  // renderer wiring
  useEffect(() => { if (!renderer || !viewport.current) return undefined; const dispose = renderer.mount?.(viewport.current); renderer.setStyle?.({ context: CONTEXT_STYLE, analysis: schema?.legend }); return typeof dispose === 'function' ? dispose : undefined; }, [renderer, schema]);
  useEffect(() => { renderer?.setView?.(view, { durationMs: TRANSITION_MS }); }, [renderer, view]);
  useEffect(() => { if (params) { renderer?.setParams?.(simulationType, params); onParamsChange?.(params); } }, [renderer, simulationType, params, onParamsChange]);
  useEffect(() => { if (schema?.animation && time != null) renderer?.setTime?.(schema.animation.axis, time); }, [renderer, schema, time]);

  // animation loop: advance one step per frame interval while playing
  useEffect(() => {
    if (!playing || !schema?.animation) return undefined;
    const id = setInterval(() => step(simulationType), FRAME_MS);
    return () => clearInterval(id);
  }, [playing, schema, simulationType, step]);

  async function exportImage() {
    if (!renderer?.exportImage) return;
    setExporting(true);
    try {
      const out = await renderer.exportImage();
      const url = typeof out === 'string' ? out : URL.createObjectURL(out);
      const a = document.createElement('a'); a.href = url; a.download = `plotcloud-${simulationType}-${view}${time != null ? '-' + String(time).replace('.', '_') : ''}.png`; document.body.append(a); a.click(); a.remove();
      if (typeof out !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally { setExporting(false); }
  }

  if (!schema) return <div role="alert" className="p-6 text-sm text-red-700">Unknown simulation “{simulationType}”.</div>;
  const anim = schema.animation, values = params || {};
  const seg = (active) => `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`;

  return (
    <div className="flex h-full min-h-[560px] w-full overflow-hidden bg-slate-100 text-slate-900" data-simulation={simulationType}>
      {/* Left panel: local parameters only */}
      <aside aria-label="Simulation parameters" className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ${sidebarOpen ? 'w-72' : 'w-12'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          {sidebarOpen ? <h2 className="truncate text-sm font-semibold">{title || schema.name}</h2> : null}
          <button type="button" onClick={toggleSidebar} aria-label={sidebarOpen ? 'Collapse parameters' : 'Expand parameters'} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
        {sidebarOpen ? (
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {schema.groups.map((g) => {
              const open = openGroups[`${simulationType}:${g.title}`] ?? true;
              return (
                <section key={g.title} className="border-b border-slate-100 py-2 last:border-0">
                  <button type="button" onClick={() => toggleGroup(simulationType, g.title)} aria-expanded={open} className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {g.title}<ChevronDown size={16} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
                  </button>
                  {open ? g.fields.map((f) => <Field key={f.key} simId={simulationType} field={f} value={values[f.key] ?? f.default} />) : null}
                </section>);
            })}
            <button type="button" onClick={() => resetParams(simulationType)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"><RotateCcw size={14} />Reset to study defaults</button>
          </div>) : null}
      </aside>

      {/* Main viewport */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div role="toolbar" aria-label="View controls" className="z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur">
          <div role="group" aria-label="View" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button type="button" aria-pressed={view === 'plan'} onClick={() => setView('plan')} className={seg(view === 'plan')}><Map size={16} />Plan View</button>
            <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')} className={seg(view === '3d')}><Box size={16} />3D View</button>
          </div>
          <div className="flex min-w-[240px] flex-1 items-center gap-2">
            <button type="button" onClick={togglePlay} disabled={!anim} aria-label={playing ? 'Pause animation' : 'Play animation'} title={anim ? anim.label : 'This study has no time or direction dimension'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            {anim ? <>
              <input type="range" aria-label={anim.label} min={anim.min} max={anim.max} step={anim.step} value={time} onChange={(e) => setTime(simulationType, e.target.value)} className="h-1.5 flex-1 accent-blue-600" />
              <output className="w-20 text-right font-mono text-xs text-slate-600">{anim.format(time)}</output>
            </> : <span className="text-xs text-slate-400">No timeline for this study</span>}
          </div>
          <button type="button" onClick={exportImage} disabled={!renderer?.exportImage || exporting} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40">
            <Download size={16} />{exporting ? 'Exporting…' : 'Export Image'}
          </button>
        </div>
        <div ref={viewport} data-view={view} className="relative flex-1 bg-[#e9ecef]">
          {!renderer ? <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Connect a renderer to show the model and results.</div>
            : !renderer.hasResult ? <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-200 bg-white/95 px-3 py-1.5 text-xs text-slate-600 shadow-sm">No result yet — run the study to colour the analysis surface.</div> : null}
          <Legend spec={schema.legend} range={legendRange} />
        </div>
      </main>
    </div>);
}
