# Toronto architectural study

Interactive Toronto visual for PlotCloud. The standalone demo remains independently usable; the current `/mvp/` homepage embeds the bundled file.

**For preview or download, use `toronto-standalone.html`.** It includes all CSS, the Three.js engine and the animation code in one file, and works offline when opened in a browser with WebGL and JavaScript enabled. Some chat preview containers may disable scripts or WebGL; download and open the file in Chrome or Edge in that case.

For source development, serve the repository root with any static HTTP server (for example `python3 -m http.server 8765`), then open `hero/toronto.html` through that server. ES modules cannot be loaded by opening the file directly from disk. Requires the existing local `furniture/three.module.min.js`; no package install, credentials or external network access is needed.

- Sun: warm studio light, moving shadows, solar arc and a translucent surface field.
- Wind: cyan directional marks, curved streamlines and moving tracers.
- Rain: falling particles and dotted surface runoff.
- Sound: violet point field forming an animated wave surface.

Drag to orbit. Use reset and pause controls. Reduced-motion users start with motion paused. A schematic SVG appears if WebGL is unavailable.

All geometry and environmental fields are illustrative. This is not a geographic survey or an engineering simulation.

To embed later, use an iframe pointing to `hero/toronto.html` with a meaningful title and dimensions. The `/mvp/` homepage integration lives in `mvp/js/home-hero.js`, which owns return-based mode cycling and theme synchronization.

Validation: with Playwright available in Node's module path, run `node hero/toronto.test.cjs` against the running server. `TEST_BASE` and `CHROMIUM_PATH` are optional overrides. Checks cover distinct canvas output for all four states, animation, stable pause, drag/reset, narrow layouts, reduced motion, and WebGL fallback.

Rebuild the standalone file after editing source: with esbuild 0.25.12 available in Node’s module path, run `node hero/build-standalone.cjs`.

For local browser checks in this environment, set `NODE_PATH=/workspace/plotcloud-tools/node_modules` and `CHROMIUM_PATH=/usr/bin/chromium` for the standalone suite. The homepage integration suite can use the existing system-Chromium preload adapter via `NODE_OPTIONS=--require=/workspace/plotcloud-tools/use-system-chromium.cjs`. CI uses the installed Playwright Chromium.
