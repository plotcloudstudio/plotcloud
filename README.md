# PlotCloud

Architectural modelling, simulations and resources, served by GitHub Pages.

- `mvp/index.html` — the current public site, Workspace, Simulations, Results and Resources
- `index.html` / `legacy-redirect.js` — compatibility redirects only; the former public application is retired
- `emb/` — shared modelling and analysis engines, loaded by the current site
- `mvp/resource-catalog.json` — preserved metadata and collections; missing source files and unknown licences are disclosed
- `mvp/js/pages/resources.js` / `resource-tool.js` — native directory, details, tools and references
- `config/site-providers.json` (optional) — switch live data sources on/off or route them through a proxy; see the project docs

Live map search and OpenStreetMap massing use public services (Nominatim, Overpass, OpenFreeMap) and are meant for light use.
