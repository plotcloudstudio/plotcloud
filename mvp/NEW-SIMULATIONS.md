# Wayfinding, Privacy and Outdoor noise (2026-10-24)

Three new simulations, built the same way as the others: each is its own engine page under `emb/`, opened by the Simulations page on a saved version (`#/simulations/<id>`), fed that version's model, and saved back to it with its figures, a picture and a per-point field for Results (version compare and batch runs work as for the rest).

Shared code: `emb/lib/plansim.js` and `emb/lib/plansim.css` (plan view, rasters and line-of-sight walks, the bridge to the simulation page, a sample plan for opening an engine on its own).

| Simulation | Engine | Model it reads | What it works out | Figures kept |
|---|---|---|---|---|
| Wayfinding | `emb/wayfinding.html` | One level from Plan Studio: walls, doors (and which go outside), rooms | Shortest walk from the start (a door to outside, or a room) to every room's door; where routes split (decision points); whether each room's door can be seen from there; visual depth (how many look-arounds before a spot comes into view) | Decision points, Signs suggested, Rooms seen from the start, Mean visual depth, Longest route, Hard to find |
| Privacy | `emb/privacy.html` | One level from Plan Studio: walls, windows with sill and head, doors, rooms, furniture heights, the level's floor height | For every spot (1.2 m above the floor), the share of onlookers who see it through a window: passers-by on the streets you pick, and the windows of a building opposite up to the height you set | Floor seen from outside, Private floor seen, Rooms to screen, Windows to screen, Most exposed room |
| Outdoor noise | `emb/noise.html` | The version's building masses per storey and the site's neighbours (the Sun hours scene) | Road noise as line sources from the levels you give each road (dB(A) 10 m from the centre line), shielded by buildings over their roofs and round their ends (Maekawa, 500 Hz); a map at a height you pick and every façade 1.5 m above its storey | Loudest façade, Quietest façade, Façade over 65 dB, Ground over 55 dB, Quiet side |

Honest limits (shown in each engine's footer): plan-geometry screening for early design. Wayfinding is not a signage or accessibility code check. Privacy ignores curtains, frosting, planting and reflections. Outdoor noise has no reflections, ground effect or weather and is not an ISO 9613 / CNOSSOS-EU assessment.

Kept in this browser: the roads drawn for a project (Outdoor noise) and a room's privacy need when you change it (Privacy).

Plan Studio (`emb/modeler.html`) gives the two plan engines their scene through `toolScene('wayfinding' | 'privacy', level)`; these tools are not in Plan Studio's own Send to tool list.

Test: `tests/mvp-new-sims.cjs` (opens each from the Simulations page on the sample project, runs, saves, checks the figures, picture, field and metric, then runs all three as a Results batch).

## Catalogue images

The six day/night images use the existing catalogue's standard interior/site models and orthographic camera. `mvp/js/analysis-study-art.js` feeds those models into the actual three engines; `analysis-art.html` displays their computed fields with RGB values copied from the engines' DEPTH, EXP and BANDS definitions. These are labelled sample engine results, not results for the visitor's project. No simulation engine or project data is changed.

Regenerate only these images: `TEST_SIM=wayfinding,privacy,noise node hero/capture-analysis.cjs` with the local static server running. Verify palettes, engine results, camera, theme parity and catalogue images with `node tests/simulation-art.cjs`.
