# PlotCloud shared interface

`tokens.css` owns interface colors, typography and legacy variable mappings. `components.css` owns scoped public-site and tool-shell adapters; no canvas/geometry styles or simulation palettes are replaced. `runtime.js` applies the shared light palette, tracks viewport colors and prepares embedded tool layouts. Appearance is fixed; it does not read a theme preference or expose a mode switch.

`inventory.json` lists the 30 product HTML hosts, 9 MVP routes, registered classic pages, every public tool-catalog route and 14 analysis entries. `reference.html` is an internal component reference, not another public navigation item.

Load both stylesheets and the runtime in each UI host. Use `data-surface="site"`, `classic`, or `tool` on the runtime script. The runtime sets `data-pc-ui`, `data-pc-theme` and the surface on the root; do not apply these attributes to exported artwork or user-generated documents. Standalone tools with an existing toolbar receive one theme switch; embedded tools use the outer site's theme control.

Public navigation keeps one Workspace item. The advanced workspace remains accessible inside the existing workspace project panel, with all original routes preserved. The shared context bar uses existing project/version/site data and discloses local persistence. It does not create cloud storage, analysis jobs or authentication.

The homepage keeps its approved model-only Toronto visual. Its bundled file must be rebuilt with `hero/build-standalone.cjs` after modifying hero source.

## Validation

Run `tests/ui-unification.cjs` with a static server serving the repository root, plus task-specific existing browser suites. It checks host/route coverage, actual computed styles under both themes, input foreground/background, navigation and embedded theme propagation. Host coverage is a UI check, not proof that every analysis engine completed a real project.

The environment's Chromium reports a certificate trust error for jsDelivr. Local verification uses exact-version official npm package artifacts for the same CDN paths via a test-only Playwright route fixture outside the repository. npm integrity checks and TLS verification remain enabled. Production URLs and dependency declarations are unchanged. A normal CI browser can use the original CDN URLs; a passing local fixture run does not establish CDN connectivity in this environment.

Unrelated application limitations (mock account, preview calculations, localStorage persistence and planned full-engine result adapters) remain accurately labelled and outside this UI update.
