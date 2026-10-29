# UI unification implementation and validation

## Implemented

- Shared interface tokens, typography, controls, semantic colors and a fixed light appearance in `ui/`.
- Compatibility adapters loaded by all 30 product HTML hosts: classic shell, both standalone MVP shells and all 27 embedded-tool files.
- Theme propagation across navigation, separate tabs, same-origin tool iframes and Stormwater's nested srcdoc views. User artwork, output sheets, model materials and simulation palettes retain their own ownership.
- Matching public navigation in MVP and classic shells. One public Workspace entry; advanced and Plan Studio variants remain reachable inside the workspace. Original tool and project routes remain valid.
- Consistent project context for workspace, analysis and results, using existing project/version/site metadata. Local or session-only persistence is disclosed without inventing cloud storage.
- Common action/field shapes, keyboard focus and accessible primary-action colors; legacy cards, floating hints, options and numeric labels adapted for tool surfaces. Interface colors switch together during theme changes.
- Homepage retains its approved larger, borderless, model-only Toronto visual, hover/drag and return-based state cycling.
- Internal component reference at `ui/reference.html`; route and host coverage at `ui/inventory.json`.

## Validation scope

The inventory browser check visits every listed HTML host, MVP page, registered classic page and public tool-catalog route. It checks loaded shared assets, computed typography/colors, both themes, basic route content, public navigation and iframe theme propagation. These are UI coverage checks, not claims that every analysis completed a real engineering project.

Task-level browser checks cover the homepage state lifecycle, desktop/mobile site shell, drawing output/export, saved views and camera provenance, 2D comparison, showroom/project workflow, and the current acoustic study including material comparison, actual WebGL view and report download. The retired acoustic test expected an API removed before this change; it was updated to exercise the current finite-facet study without changing its engine.

The existing render/compare contracts and Studio selection tests also pass (23 Node tests). A targeted computed-color scan checked default visible interface text in all product hosts under the night theme; this is not a full WCAG certification or a substitute for checking every dialog and user-created state.

Chromium in this environment rejects the CDN proxy certificate. Local browser runs substitute the same versioned CDN files with verified official npm artifacts using a test fixture outside the checkout. TLS and npm integrity verification remain enabled. Font-service failures use the shared system-font fallback. Production dependency URLs are unchanged; local fixture runs do not establish external CDN connectivity.

## Release

The repository publishes through GitHub Pages from `main` at `/`. Publish only after the relevant checks pass, then verify the Pages build commit and served shared UI assets against the repository. Report build/HTTP verification separately from browser interaction verification. Do not label a pending build or unverified deployment as live.

## Existing product limits

Mock login, prototype calculations, browser-only projects, full-engine result adapters and server billing are unchanged. The UI layer does not implement these capabilities. Specialist tool layouts and paper/output surfaces can differ where the task requires them; the common interface, navigation and theme rules are shared.
