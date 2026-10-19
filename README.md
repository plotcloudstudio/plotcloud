# PlotCloud

Tools and resources for architects. This repository is the static build of the site (v132), served by GitHub Pages.

- `index.html` — the site (hash routes: `#/site`, `#/studio`, `#/tool/<id>` …)
- `emb/` — the tools, loaded by the site on demand
- `config/site-providers.json` (optional) — switch live data sources on/off or route them through a proxy; see the project docs

Live map search and OpenStreetMap massing use public services (Nominatim, Overpass, OpenFreeMap) and are meant for light use.
