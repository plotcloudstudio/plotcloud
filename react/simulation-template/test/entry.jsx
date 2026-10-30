import React from 'react';
import { createRoot } from 'react-dom/client';
import SimulationTemplate from '../SimulationTemplate.jsx';
import { STUDY_IDS } from '../schemas.js';
import { useSimulationStore } from '../store.js';
// test double: records what the template asks a renderer to do (it draws a plain canvas, not a result)
window.calls = [];
const renderer = { hasResult: false,
  mount(host) { const c = document.createElement('canvas'); c.width = 320; c.height = 200; c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; host.prepend(c); window.calls.push(['mount']); return () => c.remove(); },
  setView: (m, o) => window.calls.push(['setView', m, o.durationMs]), setStyle: (s) => window.calls.push(['setStyle', s.context.opacity, s.analysis.ramp]),
  setParams: (id, p) => window.calls.push(['setParams', id, p]), setTime: (a, v) => window.calls.push(['setTime', a, v]),
  exportImage: async () => document.querySelector('canvas').toDataURL('image/png') };
function App() { const [sim, setSim] = React.useState(new URLSearchParams(location.search).get('sim') || 'sunhours');
  window.setSim = setSim; window.store = useSimulationStore;
  return <div style={{ height: '100vh' }}><SimulationTemplate simulationType={sim} renderer={renderer} localParams={{ lat: 49.2, north: 15, gridSize: 2 }} /></div>; }
createRoot(document.getElementById('root')).render(<App />);
window.STUDY_IDS = STUDY_IDS;
