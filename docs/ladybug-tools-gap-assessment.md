# PlotCloud / Ladybug Tools capability assessment and implementation roadmap

Prepared: 28 October 2026. Status: research and proposed implementation plan only. No simulations were added or deployed for this assessment.

## Decision

Expand the environmental analysis workflow, rather than reproduce every Grasshopper component as a separate tool. First improve the validity and explanation of existing results, add climate/design-feedback studies that reuse the current model and EPW, then introduce reference-engine daylight and energy workflows. Maintain a complete backlog for later district and advanced systems work.

The priority judgments below are product recommendations for architectural students and school reviews. Official component capabilities are supported by the linked documentation; proposed PlotCloud behavior and effort classes are engineering judgments, not vendor claims or delivery promises.

## Scope and evidence

The comparison covers current Ladybug, Honeybee Core/Radiance/Energy and the relevant Dragonfly/Butterfly workflows. Ladybug alone is not the full environmental simulation ecosystem. Climate charts, data filters, geometry preparation and result post-processing are important capabilities but are not all independent physical simulations.

Official inventories reviewed:

- [Ladybug component inventory](https://github.com/ladybug-tools/ladybug-primer/blob/master/SUMMARY.md)
- [Honeybee Radiance component inventory](https://github.com/ladybug-tools/hb-radiance-primer/blob/master/SUMMARY.md)
- [Honeybee Energy component inventory](https://github.com/ladybug-tools/hb-energy-primer/blob/master/SUMMARY.md)
- [Dragonfly component inventory](https://github.com/ladybug-tools/dragonfly-primer/blob/master/SUMMARY.md)
- [Butterfly and OpenFOAM](https://www.ladybug.tools/butterfly.html)

PlotCloud evidence is a source audit of `mvp/js/data.js`, the study adapters, shared climate/geometry modules and current engine implementations. The catalog has 17 studies. This research did not rerun numerical benchmarks or establish new accuracy claims. Existing stored validation artifacts are not evidence of equivalence across arbitrary architectural models.

## Existing counterpart studies: improve rather than duplicate

| PlotCloud capability | Official counterpart | Current scope and next improvement |
|---|---|---|
| Sun hours | LB Direct Sun Hours / sun-path and shadow workflows | Actual model sampling and solar visibility exist. Add explicit protected receptors, month/hour schedules, minimum-sunlight difference maps and controlled same-input comparison. Preserve exact source geometry and grid provenance. |
| Solar radiation | LB Incident Radiation / HB Annual Irradiance | EPW-driven radiation exists. Expose direct/diffuse/reflected contributions, seasonal and facade-by-orientation outputs; distinguish cumulative energy (kWh/m2) from instantaneous flux (W/m2). Benchmark obstruction/reflection cases before claiming Radiance equivalence. |
| PV estimate inside radiation | HB Photovoltaic Properties / generation workflows | An estimate already exists using selected roof area, 20% module efficiency and PR 0.8. Add actual panel layout/tilt/azimuth, usable-area exclusions, shading and system losses before calling this a detailed PV study. |
| Outdoor thermal comfort | LB UTCI / solar MRT / HB UTCI Comfort Map | UTCI, a simplified MRT model and sky-view sampling already exist. Expose air temperature, MRT, wind-height conversion, humidity and validity limits. Add seasonal/occupied-hour outputs and evaluate surface-temperature and local-wind coupling separately. Matching the UTCI polynomial does not validate the whole microclimate model. |
| Daylight | HB Annual Daylight / Daylight Factor | sDA, ASE and DF already exist. The shipped implementation explicitly identifies itself as a split-flux early-design estimate, not Radiance, and excludes modeled blinds and exterior-building obstruction in its stated scope. First address these model limitations, then introduce a separately labeled reference-engine mode. |
| Wind flow | Butterfly / OpenFOAM, rather than Ladybug climate charts | PlotCloud has coarse-grid lattice-Boltzmann screening, including a 3D path. Do not describe it as absent or as automatically equivalent to a validated CFD study. Improve domain/terrain/inlet/roughness, multi-direction weighting, convergence and mesh-independence evidence. |
| Natural ventilation | HB ventilation control / Airflow Network | Existing opening/wind/stack studies should be retained. Add explicit opening areas/discharge coefficients, inter-room connections, control schedules and annual coupling before claiming detailed whole-building airflow behavior. |
| View analysis | LB View Percent / HB view and sky analysis | Outward-view studies exist. Distinguish eye-height/direction view quality, spherical sky exposure and projected Sky View Factor; they are not interchangeable percentages. |

Current stormwater, acoustics, space syntax, spatial depth, evacuation, isovist, wayfinding, privacy, camera coverage and structural screening are not gaps merely because they are not Ladybug's main analysis recipes. Preserve these separate disciplines and their method boundaries. Do not reintroduce the removed outdoor-noise tool.

Local evidence of important boundaries: `emb/daylight.html:224`; `emb/sunhours.html` radiation/PV/UTCI result methods; `emb/lib/climate.js` irradiation, MRT and wind-height functions; `emb/wind.html` screening notes. Existing source-linked structural screening remains separate from the environmental roadmap.

## Missing or incomplete workflows: complete backlog

P0 means a prerequisite or existing-result correction; P1 means the first expansion; P2 means reference-engine daylight; P3 means a thermal/energy platform; P4 means advanced district or specialist work. These are ordered milestones, not time estimates.

| ID | Workflow / proposed English UI label | Official reference | Current state | Recommended deliverable / constraints | Priority |
|---|---|---|---|---|---|
| 01 | Climate Analysis | LB hourly/monthly plots, Wind Rose, Degree Days | EPW infrastructure and individual weather-related outputs exist; no consolidated climate-design report was found in the audited study catalog | Temperature/humidity/radiation/wind profiles; hourly annual heatmap; HDD/CDD with stated base temperature; station/date/missing-data provenance. This is weather analysis, not a new building-response solver. | P1 |
| 02 | Passive Design Strategies | LB Psychrometric Chart and comfort polygons | Missing integrated workflow | Plot hourly weather, explicit comfort assumptions, climate-appropriate design opportunities. Strategy-hour regions overlap and must not be added as independent energy savings. Outdoor weather alone does not predict indoor comfort. | P1 |
| 03 | Sky Exposure & Solar Mask | LB View Percent / Sky Mask / HB Sky View | Sky-view sampling exists internally in UTCI; no complete independent review/export workflow | Expose both unweighted sky exposure and projected SVF with correct hemispherical integration; sky obstruction mask and source-linked heatmap. Do not label an unweighted visible-ray fraction as physical SVF without checking weighting. | P1 |
| 04 | Solar Envelope | LB Solar Envelope | Missing | Separate solar-rights and solar-collection envelopes; protected receptor geometry, selected dates/hours, height bounds and original model overlay. This is a geometric design boundary, not automatic planning permission. | P1 |
| 05 | Shade Benefit | LB Shade Benefit / Thermal Shade Benefit | Shadow and thermal primitives exist, but no complete benefit/harm workflow | Compare seasonal blocked useful/unwanted sun, shading area and comfort-related scenarios for overhangs/screens/canopies. Climate-weighted benefit is not demonstrated cooling-energy savings. | P1 |
| 06 | Orientation & Facade Studies | LB Radiation Rose / directional irradiance | Radiation exists; guided orientation comparison missing | Compare north-relative orientation, facade radiation and selected shading/window variants while retaining exact version transforms. Report competing daylight/solar/comfort outcomes, not a universal best angle. | P1 |
| 07 | Annual Daylight — Reference Engine | HB Annual Daylight / metric post-processing | Approximate sDA/ASE/DF already present | Radiance hourly illuminance plus DA/cDA/UDI, sDA and ASE; exterior context, rooflights, realistic optical materials, occupancy and justified grids; named solver and parameters. Do not overwrite historical approximate results. | P2 |
| 08 | Point-in-Time Light & Glare | HB Point-In-Time View-Based / Imageless Annual Glare | No complete reference-engine DGP/annual glare workflow found | Explicit viewpoints and view directions; illuminance/luminance, point-in-time glare and annual DGP/Glare Autonomy using a documented method. ASE alone is not DGP. | P2 |
| 09 | Dynamic Shading & Daylight Controls | HB Dynamic Shade Group / Daylight Control Schedule / Apply Daylight Control | Missing integrated control/energy workflow | Evaluate blind states, operating rules and lighting schedules; connect daylight control to annual lighting energy only when the energy model includes that control. | P2 to P3 |
| 10 | Indoor Thermal Comfort | LB PMV/PPD, Adaptive Comfort, PET; HB comfort maps | Outdoor UTCI exists; indoor prediction workflow missing | Scenario calculators can use confirmed indoor inputs first. Predicted annual building maps need indoor air/surface temperatures, air speed, clothing, metabolism and occupancy from a thermal simulation or measurements. Choose PMV vs adaptive methods according to applicability. PET is optional outdoor extension, not a reason to duplicate UTCI by default. | P3; explicit-input educational calculator can precede it |
| 11 | Annual Thermal Loads | HB Annual Loads / Thermal Load Balance | Missing production workflow | Room heating/cooling demand, monthly load balance and end-use assumptions. Ideal loads are not actual HVAC energy, EUI, bills or carbon. | P3 |
| 12 | Building Energy & EUI | HB Model to OSM / EnergyPlus / energy results | Missing production integration | Explicit HVAC/fuels/efficiencies, people/equipment/lighting/DHW, ventilation and schedules; delivered energy and EUI by fuel/end use. Keep demand and energy outputs distinct. | P3, after 11 |
| 13 | Peak Heating & Cooling | HB Peak Loads / HVAC sizing | Missing | Room/whole-building peaks, coincident vs noncoincident loads and design conditions. Use DDY or clearly disclosed statistical derivation; typical-year EPW is not an unconditional design-extreme source. | P3 |
| 14 | Annual Ventilation & Mixed Mode | HB Airflow Network / Window Opening / Ventilation Control | Existing early-design ACH; annual control/network study missing | Model connected zones, opening control, leakage and weather-driven operation; assess night cooling against annual indoor temperatures. No claim of CO2/contaminant prediction without a separate mass-balance model and sources. | P3 |
| 15 | Envelope Performance | HB opaque/window constructions and frame/gap/shading properties | Visual and structural material assignments do not provide complete energy constructions | Layered assemblies, thickness, conductivity, density, heat capacity, U-values; glazing U/SHGC/visible transmittance separately. Surface dew-point screening can follow verified temperatures; full thermal-bridge/mold/moisture simulation requires a separately specified specialist method. | P0 for schema; P3 for evaluated outputs |
| 16 | Solar PV — Detailed System | HB Photovoltaic Properties / generation outputs | Basic roof estimate already exists | Tilt/azimuth/layout, exclusion zones, hourly shading, temperature and system assumptions, monthly/annual generation and sensitivity. Financial payback requires separately sourced tariffs/costs; defer it from the first performance report. | P1 refinement; P3 engine-backed system |
| 17 | Operational Carbon | HB Carbon Emission Intensity | Missing | Energy by fuel plus named regional/year emission factors. Canadian projects need appropriate provincial/grid data; do not silently use a US-only lookup. Distinguish operational emissions from embodied/life-cycle carbon. | P3, after 12 |
| 18 | Standards-Oriented Daylight Reports | HB Annual Daylight EN17037 / WELL / BREEAM and metric recipes | Current daylight UI references some LEED-style thresholds; full validated workflow missing | Versioned metric/schedule/space-selection rules, source results and reviewer-ready tables. A matching threshold is not proof of certification; introduce each framework only after its recipe and input rules are verified. | P2/P3 reporting, not separate top-level solvers |
| 19 | Urban Heat Island Weather | Dragonfly Run Urban Weather Generator | Missing | Urban morphology, vegetation and material/anthropogenic parameters; compare rural/reference vs morphed weather with documented validity. Do not treat UWG as a detailed tree/shade CFD microclimate model. | P4 |
| 20 | District Energy & Infrastructure | Dragonfly / URBANopt / OpenDSS / REopt and district thermal workflows | Missing | Building archetypes, district loads, electrical infrastructure and renewables/district-system options after individual-building models are reliable. Too much setup for the first student workflow. | P4 |
| 21 | Advanced Indoor/Outdoor CFD | Butterfly / OpenFOAM | Current wind screening is partial counterpart | Separate specialist mode for resolved flow/thermal fields, defined boundary conditions, convergence and validation. Do not replace a working quick mode with an unvalidated heavier solver. | P4 |

This inventory groups major analysis workflows. It does not pretend that every geometry utility, weather importer, Grasshopper preview or third-party plugin is an independent missing simulation. Embodied carbon, full hygrothermal/thermal-bridge design and biological growth models require their own scope and data; they should not be presented as already established by this Ladybug comparison.

## Implementation sequence and acceptance

### P0 — Shared analytical model and trustworthy comparison

Preserve the exact architectural source, source IDs, units, north, version and transforms. Add a separate reviewed analytical model instead of replacing arbitrary imports with a box. Check room volumes, roof/floor/wall roles, exterior/interior/ground boundaries, face normals, opening-host relationships and inter-zone adjacency. An imported mass can support external shading but cannot infer all thermal zones, envelope assemblies and operation schedules.

Keep optical properties, thermal constructions and structural properties separate. For example, structural steel grade is not an envelope U-value, and glass structural properties do not imply SHGC or visible transmittance.

Use shared project EPW/time-zone/hour indexing, occupant schedules and model assumptions. Export HBJSON where valid and preserve a mapping back to PlotCloud source objects. See [Honeybee Solve Adjacency](https://docs.ladybug.tools/honeybee-primer/components/0_create/solve_adjacency) and [model validation](https://www.ladybug.tools/honeybee-core/docs/cli/validate.html).

Acceptance: invalid/ambiguous inputs receive a clear issue list; no silent template building is substituted. Changing geometry, materials, occupancy or weather invalidates the affected result. Comparisons identify all changed assumptions.

### P1 — First release package

Deliver Climate Analysis + Passive Design Strategies + Sky Exposure/Solar Mask + Shade Benefit + Solar Envelope, with orientation comparisons and refined existing PV/radiation outputs where feasible. Reuse the actual existing model and weather. Do not create a separate top-level card for each climate chart or result metric.

Acceptance: known simple geometries and numeric reference cases; source-preserving overlays; seasonal/occupied-hour definitions; input/output CSV/JSON and clear charts/drawings; no energy-savings or safety claim inferred from a climate plot.

### P2 — Professional daylight

Introduce a pinned Honeybee/Radiance execution path. Retain the current quick screening mode under an honest label. Deliver annual metrics, point-in-time studies, glare and documented shading behavior. Standards-oriented outputs reuse validated recipes; they do not generate unsupported certification claims.

Acceptance: matched-condition reference models (unobstructed, obstructed, deep room, rooflight, multiple rooms, glazing/shade variants), declared tolerances per metric, convergence/parameter documentation, reproducible solver inputs and comparison reports. DGP must be validated independently of illuminance and ASE.

### P3 — Thermal/energy platform

Deliver annual loads, actual energy, indoor comfort, annual ventilation/control, peak-load sizing, lighting control and operational-carbon outputs in dependency order. Provide building-use presets (such as classroom/studio/residential), but require review and retain every assumption in the report. Add detailed PV generation using a specified system model.

Acceptance: thermal zones close and match adjacency; energy balance and fuel/end-use accounting; summer/winter and perimeter/interior reference cases; documented design-day and regional carbon inputs; solver/input versions; failed jobs do not publish normal-looking numeric results.

### P4 — Advanced workflows

Add urban weather, district energy and specialist CFD only after the single-building workflow is reliable. Detailed HVAC/DHW systems, district thermal loops, grid/renewables optimization and specialist envelope work belong here or in a separately scoped integration.

## Runtime and cost reality

The website is primarily browser/static-page driven. The connected weather Edge Function downloads public files; it is not a deployed Honeybee/Radiance/EnergyPlus/OpenFOAM simulation service. Python validation scripts or installed reference solvers do not make those engines available to end users.

Lightweight climate calculations and geometry studies can reuse the current browser architecture where validated. Full reference-engine jobs generally need a separately managed execution environment: local student/lab runner, school server, or queued container workers with result storage, cancellation, resource limits and real job status. The Honeybee SDK is a better integration boundary than requiring the browser to operate Grasshopper. Existing EPW download infrastructure should remain a weather service.

There is no responsible promise that every heavy solver can run indefinitely at zero operating cost. A local/lab runner is a practical first option for schools. The execution choice should be explicit before P2 begins.

## Student workflow and report contract

Keep the task short: choose study → reuse current model/site → review only missing required inputs → run → inspect causes and alternatives → export a source-backed comparison. Advanced engine controls can remain available without becoming mandatory for first-time students.

For each result, provide model version/object mapping, station and weather provenance, date/hour/occupancy filters, units/grid/method/solver version, assumptions, completed-job state, calculation limits, spatial drawing, numeric summary and source data. Comparison reports use matching scales and clearly identify changes. Report text describes what the actual result supports; it must not invent uncomputed energy/comfort/carbon savings.

Do not promise a universal 90% accuracy level. Establish metric-specific validation against identical reference inputs, disclose the supported geometry/material/operating range, and keep model-preparation uncertainty separate from numerical solver error.

## Key official references for interpretation

- [Ladybug overview](https://www.ladybug.tools/ladybug.html): climate/geometry analysis scope.
- [Psychrometric Chart](https://docs.ladybug.tools/ladybug-primer/components/2_visualizedata/psychrometric_chart): weather or indoor temperature/humidity inputs.
- [View Percent](https://docs.ladybug.tools/ladybug-primer/components/3_analyzegeometry/view_percent): sky exposure and projected SkyView are distinct.
- [Solar Envelope](https://docs.ladybug.tools/ladybug-primer/components/3_analyzegeometry/solar_envelope): collection and rights envelopes.
- [Thermal Shade Benefit](https://docs.ladybug.tools/ladybug-primer/components/3_analyzegeometry/thermal_shade_benefit): climate-weighted beneficial and harmful shade.
- [Honeybee Annual Daylight](https://docs.ladybug.tools/hb-radiance-primer/components/3_recipes/annual_daylight): hourly sensor illuminance workflow.
- [Imageless Annual Glare](https://docs.ladybug.tools/hb-radiance-primer/components/3_recipes/imageless_annual_glare): DGP and Glare Autonomy.
- [Annual Loads](https://docs.ladybug.tools/hb-energy-primer/components/5_simulate/annual_loads): thermal demand is not actual energy use, cost or emissions.
- [PMV Comfort Map](https://docs.ladybug.tools/hb-energy-primer/components/7_thermalmap/pmv_comfort_map): coupled indoor thermal/radiant inputs.
- [Peak Loads](https://docs.ladybug.tools/hb-energy-primer/components/5_simulate/peak_loads): design-day requirements.
- [Carbon Emission Intensity](https://docs.ladybug.tools/hb-energy-primer/components/6_result/carbon_emission_intensity): energy-result-based operational carbon and regional data requirements.
- [Dragonfly overview](https://www.ladybug.tools/dragonfly.html): district energy, infrastructure and urban weather scope.
