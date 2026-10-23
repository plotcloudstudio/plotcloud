# Simulation layout standard — Sun Hours reference

User-approved scope: implement Sun Hours first; apply this shell to other simulations after review. Do not copy solar parameters or solar palettes into unrelated solvers.

The architect's task is to evaluate a saved project model and deliver a drawing with matching evidence. Account owns the model, site and north. Simulation pages must not ask for these again.

- Single-line context: project · model · “model, site & north from Account”. No source selection/import/location/north controls. Missing data produces an Account link, never fabricated demo results.
- Left: three independently collapsible sections, numbered 01 Analysis, 02 Detail, 03 Export. Calculate / Reset at the bottom. Hide parameters collapses the whole column to a rail and immediately expands the canvas.
- Center: task-specific views, with Sun Hours using Plan / 3D / Sun view only. Canvas corner reads “north from Account”.
- Right: four metrics, fixed scientific legend, zone table and hourly evidence. This panel serves drawing production; export annotations use the exact displayed result revision.
- PNG must download a real image. Unsupported SVG/PDF show an explicit Boards notice; no renamed PNGs or fake success messages.
- Reuse shared UI tokens, day/night themes, native inputs, accessible labels and keyboard-operable disclosure controls.

## Sun Hours semantics

`emb/sunhours.html`, `sunhours.css`, `sunhours.js` replace the previous mixed import/analysis/chart/batch-export shell. The NOAA solar-position equations, mass/terrain conversion and BVH surface-sampling logic are retained. Parent project-context/project messages and Account IndexedDB `pc-project/kv/cur` both work. Account settings override scene location and north. Account clockwise-from-plan-up north is converted to the engine's convention, matching the original integration.

The hour slider is **cumulative sunlight from 06:00 to the selected hour**, sampled at 15-minute midpoints. This is explicitly labeled on screen and on PNG sheets. Hourly bars show instantaneous sunlit area share from 06:00 through 20:00. They are not another accumulation series. The four metrics are area-weighted mean, maximum, area with ≥2h and sunlit area now. All include measured ground/roofs and optionally facades; context geometry casts shadows but is excluded from measured surfaces. Results above 8h use the saturated end of the 0–8h+ ramp.

Zones are mutually exclusive spatial ground partitions in true-north coordinates: central courtyard (central 44% of model bounding dimensions), north strip, southeast and southwest. They are **not** inferred semantic rooms. The UI discloses this limitation. Each zone reports area-weighted mean, maximum and ≥2h percentage; empty zones show dashes.

Plan facade ribbons project sampled wall faces outwards by 6.5% of their height, keeping measured sunlight values. They disappear when Include façades is off. Ground isolines use interpolated threshold crossings at 1h intervals; they do not bridge missing cells. Plan uses unlit heatmap materials for a readable scientific palette. 3D uses an orthographic isometric camera, colored sampled surfaces and actual directional shadows. Sun view uses the solar camera direction and ray-tested bright/occluded colors, including all-dark conditions after sunset.

Sampling caps at 50,000 points and automatically widens the requested grid for large geometry; actual spacing is shown on screen and export. This is direct geometric sunlight screening with opaque objects, not a weather/radiation or compliance model. Polar-night results correctly contain zero sunlight.

Export snapshots the current computed data and camera. Legend and data-table toggles apply independently; the table annotation includes the same four metrics, zone rows and hourly series as the screen. SVG/PDF require Boards and are not generated here. Reset restores this page's defaults without modifying Account geometry, site or north.

## Verification

`tests/sunhours.cjs` covers missing-Account state, no shared-data inputs, section/view counts, Account settings precedence, column expansion, facade geometry, interpolated contours, date/hour recalculation, three views, real PNG bytes and dimensions, SVG/PDF notices, reset preserving north, mobile overflow, and the real classic route's srcdoc integration with a persisted Account project. It is included in the browser smoke workflow.
