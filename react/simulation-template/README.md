# Unified simulation template (React)

One template for every PlotCloud simulation, with Sun Hours as the reference. Written in React, Tailwind CSS, Zustand and lucide-react.

**Status:** standalone module. The live site (`mvp/`) is a static, build-free JavaScript app, so it does not load this code. Using it on the live site needs a React build step and a renderer adapter for the existing engines; see "Integrating" below.

## Files

| File | What it holds |
|---|---|
| `SimulationTemplate.jsx` | The component: a collapsible local-parameter sidebar, and a viewport with a top toolbar (Plan View / 3D View, play/pause with timeline, Export Image) and a fixed bottom-right legend |
| `schemas.js` | Local-only parameter schemas, animation axis and legend for all 22 studies in `mvp/js/data.js` |
| `store.js` | Zustand store: view mode, animation state, sidebar and per-study local parameters |
| `test/` | Browser test with a recording renderer (a test double that draws no result) |

## Rules the template enforces

- **Only local parameters.** Global values never render in a simulation panel and cannot be stored on a study: `localOnly()` and `setParam` reject them. Global values include location, true north, time zone, EPW, use template and project defaults; those live in the Dashboard Overview tab.
- **One layout for every study.** Every study gets the same sidebar, toolbar, legend position and controls. Studies without a time or direction axis keep the play button, disabled, with an explanation.
- **Shared visual language.** `CONTEXT_STYLE` makes context semi-transparent grey/white (opacity 0.35). The analysis surface uses a vivid ramp (`RAMPS`) or a categorical legend.
- **No invented results.** The template draws nothing itself; it drives a renderer you pass in. With no renderer it shows an empty state. With a renderer but no result it says "No result yet".

## Props

```jsx
<SimulationTemplate
  simulationType="sunhours"            // one of STUDY_IDS
  localParams={{ gridSize: 2 }}        // optional initial local values; global keys are dropped
  onParamsChange={(p) => …}            // called with the study's local parameters
  renderer={adapter}                   // see below
  legendRange={{ min: 0, max: 6 }}     // optional, from the computed result
/>
```

Renderer adapter (implemented by the host page for each engine):

```js
{
  mount(host) → dispose?,              // attach canvas
  setView('plan' | '3d', { durationMs }),  // smooth camera transition (600 ms)
  setStyle({ context, analysis }),
  setParams(simId, params),
  setTime(axis, value),                // 'hour' | 'month' | 'direction' | 'minute' | …
  exportImage() → Promise<string | Blob>,  // PNG
  hasResult: boolean
}
```

## Test

```sh
npm install
npm test        # bundles test/entry.jsx, serves test/, runs the Playwright check
```

Verified here:
- Local-only parameters, and global keys rejected.
- Plan ↔ 3D calls `setView` with a 600 ms transition.
- Play advances the study's own axis and Pause stops it; the slider sets the time.
- Values are clamped (tilt 120° → 90°) and sent to the renderer.
- Export downloads `plotcloud-<study>-<view>-<time>.png`.
- The context opacity and ramp are sent.
- All 22 studies render the same toolbar and legend with no errors.

## Integrating with the live site (not done)

1. Add a build step (e.g. esbuild or Vite) and Tailwind to `mvp/`.
2. Write one renderer adapter around the existing engines: the `emb/*.html` iframes driven by `mvp/js/pages/sim-engine.js`, and `mvp/js/study-ui/stage.js` for the shared-shell studies.
3. Map each schema field to the existing engine control it replaces. Some current controls are global; those move to the Dashboard Overview tab rather than into the schema.
4. Keep the existing routes (`#/simulations/<id>`) and saved-run format so history keeps working.

The schemas' default values are PlotCloud presets for early design, not values from a code or standard.
