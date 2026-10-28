# Environmental studies: first implementation phase

Status: implemented first-phase screening workflows; release verification is recorded separately. This document does not claim completion of the full Ladybug Tools roadmap.

## Delivered scope

The study catalog expands from 17 to 22 free studies. The five additions are Climate Analysis, Passive Design Strategies, Sky Exposure & Solar Mask, Shade Benefit and Solar Envelope. Existing studies, resource access and pricing are retained.

The source-model/weather/provenance and input-review foundations required by these studies are implemented. Thermal zones, energy constructions, occupancy/HVAC schema and a Honeybee/Radiance/EnergyPlus job service are not implemented by this release. Guided orientation optimization, advanced PV systems, reference-engine daylight/glare, whole-building thermal/energy and district workflows remain later milestones in `ladybug-tools-gap-assessment.md`. No placeholder solver or false completion label is published for them.

## Numerical contracts

- Weather input must have complete, unique hourly chronology for 8760 or 8784 EPW records. Invalid temperatures block calculation. Missing humidity, wind, pressure and radiation remain explicit; missing radiation is never silently treated as normal zero energy. Leap day is retained. Solar calculations on weather records use a declared canonical calendar year, not a claim that TMY contains current-year measurements.
- Climate analysis uses EPW local standard time. Degree days use complete daily means at the recorded bases. Hourly EPW global-horizontal irradiation is summed as kWh/m2; missing-hour coverage is shown. Wind-from sectors retain calm hours in the percentage denominator while leaving calm direction unassigned.
- Psychrometric humidity ratio uses ASHRAE/Hyland-Wexler saturation pressure (ice/water branches). The plot includes relative-humidity curves at a recorded reference pressure; individual points use actual hourly pressure where available, otherwise a disclosed standard-atmosphere elevation estimate. Temperature/RH screening bands and passive-weather opportunities are not PMV/adaptive indoor comfort, building response or energy-saving predictions. Overlapping opportunity categories are never added; denominator availability is reported per category.
- Sky exposure uses equal-solid-angle upper-hemisphere sampling. Horizontal projected sky view uses the corresponding cosine weights; an open hemisphere integrates to 1, half to 0.5. The dated solar mask separately ray-tests hourly sun positions at the actual project location and standard time zone. North follows the existing Sun Hours source convention. Candidate sample points are not automatically classified as occupied or outdoors; region/elevation review is required.
- Shade Benefit removes only the explicitly selected candidate object(s) from the analytical baseline, retaining the remaining original context. Blocked hot-period sun contributes positive temperature degree-hours; blocked useful cold-period sun contributes negative degree-hours. This is a geometric, temperature-weighted potential screen, not actual cooling-energy savings or a computed UTCI difference.
- Solar rights analytically constrain a full horizontal receptor rectangle for selected sun positions without taking credit for existing obstruction. Solar collection computes the highest source-triangle obstruction along those directions using vertical-plane/triangle intersections and forward-ray clipping. The resulting sampled maximum/minimum elevations, limiting sun positions, bounds and infeasible samples are recorded. This is not automatic planning approval or a continuous-date/time guarantee.

## Geometry and interaction contract

All geometric workflows use the original visible Workspace triangles in world metres / Z up, with source IDs. Linked context uses its real footprint (including holes), source base/height and triangulated terrain grid. It is not replaced by a bounding box. Closed polygon endpoints are normalized before triangulation so hole indices stay aligned. All geometry is opaque for these geometric calculations, including glazing; translucent rendering is only a reference-display choice.

One visible Three.js scene owns the spatial reference and calculated overlays. BufferGeometry holds the unchanged original source surfaces; point values and the envelope boundary are separate buffers. Source buffers are reused across input/result edits and camera state is preserved except explicit Fit / framing a calculated envelope. Gray is architectural reference, purple selected candidate shade, yellow evaluation region. Sky-view points use a fixed 0–100% red-to-blue scale. Shade colors diverge around zero; envelope infeasibility is red. Numeric tables and source/CSV/JSON exports carry the result independently of WebGL; no duplicate fallback scene is shown.

Rendering is event-driven with capped DPR 1.5, predictable right-drag orbit/middle pan, ResizeObserver sizing and GPU/control disposal on route exit. No animation loop or decorative particles are added. Hemisphere ray count, a maximum 512-point user grid and a maximum 2048 selected solar positions bound computation. Oversized input is rejected; spacing is not silently changed. Actual grid cell spacing and the requested maximum are both retained.

Calculations run in a cancellable Worker. Run locks before asynchronous EPW reads; generation-bound callbacks prevent cancelled/older jobs from overwriting later results. Progress counts completed sample points and measured elapsed time. Input edits invalidate the displayed result, saving/exporting requires a completed result, and duplicate saving of the same source/input signature is blocked. Earlier source versions and historical values remain available.

## Saved results and reports

Each result includes the project/version, source geometry fingerprint and audit, linked-context count, relevant shared-condition signature, EPW name/hash/station, solar/time conventions, analysis input and release. CSV retains the full numeric set. JSON includes the original geometric source for spatial studies plus the weather hash; the EPW is backed up separately using Project conditions. The report is self-contained HTML with actual drawings/charts, numerical tables, assumptions and scope; browser Print / Save as PDF is explicit, rather than claiming a native PDF generator.

Standard Projects & Results comparison recognizes the five new study metrics and method notes. Weather/geometry/constraint studies require reviewed inputs and therefore do not silently participate in unattended batch runs. Unused weather changes do not invalidate pure sky-view/envelope geometry, while relevant north/site/weather changes do.

## Verification

- `tests/environment-analysis.cjs`: independent constant-weather degree-day/radiation cases; complete/leap/missing data; psychrometric reference; original-triangle BVH; open/closed/half-sky at three hemisphere resolutions; candidate-vs-context shade degree-hours; analytical solar-rights and collection-height examples; grid/date/review rejection; sun/north and solar mask. Optional pinned real Chicago EPW is compared with independent Python CSV/statistics calculations.
- `tests/environment-ui.cjs`: catalog/free entry, missing-weather block, real EPW input handling, Worker calculation/cancel, changed-input invalidation, duplicate Save guard, chart report, CSV/full-source JSON, all five workflows, both envelope modes, sky mask selection, linked closed-polygon/holes geometry and laptop bounds.
- `tests/laptop-layout.cjs`: existing Workbench and study checks, extended to the five new pages at five laptop sizes.
- `tests/free-simulations.cjs`: all 22 routes stay free and Resources/Pricing retain their access behavior.
- Additional isolated local QA uses the user's previously verified imported-building snapshot: 54 objects / 10,158 triangles. All five workflows complete; the three spatial workflows preserve every original building surface, with exact coordinate equality to the actual Sun Hours engine input. The private model, backup and result files are not published as fixtures or CI artifacts.

These are bounded verification cases. No universal 90% whole-building accuracy or certification claim is made.
