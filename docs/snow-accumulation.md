# Single-event site snow accumulation

For architects and students estimating the quantity and location of snow from a specified event on a saved site/building model. Snowfall depth and new-snow density are explicit scenario inputs, not fetched weather predictions. The initial 15 cm / 100 kg/m³ scenario is labelled as an editable example assumption.

The original source triangles, including linked context and terrain, feed a median-split BVH. At each horizontal cell centre, barycentric intersection finds the highest surface along a vertical line. That surface alone receives the event; ground under a roof does not receive a second copy. Sloped surfaces retain interpolated elevations. Ground without a source hit uses the stated fallback plane and its assumed area is reported separately. Roof/model-surface labels do not imply verified roof semantics.

For horizontal projected cell area A, entered vertical depth d in metres and density ρ in kg/m³:

- Snow volume = A × d (m³).
- Mass = A × d × ρ (kg).
- Melt-water volume equivalent = mass / 1,000 (m³).
- Water equivalent depth = d × ρ (mm).

The definition of snow water equivalent follows the [USDA NRCS Climate Glossary](https://www.nrcs.usda.gov/resources/education-and-teaching-materials/climate-glossary). The simple first-hit deposition method is a stated PlotCloud screening assumption, not an NRCS model or standard.

The model excludes wind redistribution/drift, melting, compaction, sliding, existing snowpack, forecasts and structural capacity. Uniform depth is expected: the meaningful spatial distinction is which ground or roof/model surface receives snow. Areas are projected horizontal areas, not sloping surface areas. Cell-centre sampling may miss features smaller than a cell; users can refine the grid. A 4,096-cell cap blocks oversized regions without silently changing resolution.

Results retain source project/version, recorded site, geometry hash, exact scenario, grid, method version, units and generation time. Input edits immediately invalidate the visible result and disable saving/exports. Changing the source model/site blocks saving/exports until reopened. Saved runs keep history and register all eight scenario/region parameters in the existing parameter provenance system.

Exports: cell CSV, full source/result JSON, viewport PNG and a standalone HTML report printable to PDF. Home, catalog and Workspace discovery use the same snow illustration.

Validation: tests/snow-analysis.test.mjs covers overlapping receivers, mass/volume/SWE conservation, sloping roofs, below-zero terrain, vertical-wall rejection, explicit fallback ground, density scaling, zero snowfall, invalid values and the grid cap.

## Snow illustration prompt

Built-in imagegen edit, fixed exterior master mvp/img/home/wind.webp, saved as mvp/img/home/snow.webp. Preserve all architecture and the camera. Replace wind paths and field with a uniform pale icy-blue sampling overlay on exposed ground and horizontal roof tops. No snow beneath solid footprints, invented drifts, variable depth, snow piles, weather forecast or structural claims. White opaque facades remain unchanged; a small unnumbered blue key only. Like the other catalog assets, this is illustrative artwork and not a computed project result.
