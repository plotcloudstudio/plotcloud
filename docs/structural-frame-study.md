# Source-linked structural frame screening

## User task and delivered scope

The study supports architectural students exploring an explicitly idealized steel or engineered-timber frame on their existing building. It retains the same world-space surface geometry, metre units, Z-up axis, object IDs and saved version used by Sun Hours. It does not convert every mesh triangle edge into a structural member or silently replace an imported building with a regular grid.

The implementation is frame screening, not full material design or a 90% whole-building accuracy claim. Supported outputs are linear-elastic frame/truss response, nominal reference stress, ideal Euler buckling and a user-selected span/deflection screen. Shear, torsion, timber compression/interaction design, lateral-torsional/second-order effects, connections, foundation resistance, plates/shells, reinforcement, structural glass, fire, seismic and code design resistance require additional methods. Neutral means no selected screen exceeded; it does not mean the building is safe.

## Workflow

1. Assign a structural role/material/section to a Workbench layer and save a version. Appearance is independent. The study may override a layer or an individual object for that version. Material references are explicitly named and must be confirmed. The timber reference is a bending reference, not a complete compression design model.
2. Review suggested analytical axes on the original model, edit endpoints, or trace multiple members against a fused reference mesh. Confirm each actual axis/connection. Furniture/glazing/site context begin as nonstructural; they never become structure because their finish resembles wood/steel.
3. Assign real foundation-joint supports, review any proposed column-base supports and confirm restraints. Enter explicit dead/live surface loads and justified rectangular one-way panels on two parallel equal-span beams. Loads include nonmodeled slabs, glazing and finishes where relevant; analytical member self-weight is added from section area and density.
4. Validate and run in a cancellable Worker. Red identifies an exceeded screen, a missing support path or a solver failure; amber identifies incomplete/unverified inputs; gray denotes nonstructural reference geometry. Source-linked issues and numeric tables make the reason accessible without relying on color.
5. Compare the confirmed frame against one additional-column proposal and, where available, a larger selected beam section. Users explicitly define permitted/excluded placement rectangles, proposed section/base/restraint and the new-foundation assumption. Proposals remain study-only. They are not a claimed minimum-column/optimal or code-compliant solution.
6. Save the selected result to the actual source version, export inputs/results JSON, or export a self-contained HTML report with the original-model drawing, source IDs, member screens, supports, material/section references, load assumptions, combinations and method limits. The report supports browser Print → Save as PDF; this is not a native PDF generator.

An explicit teaching-frame button creates a **separate** project with known modeled axes. It does not substitute that example when a user's model fails validation. Existing results are retained and legacy grid results are labeled as unverified building mappings.

## Data and validity contracts

- `layers[].structural`: structural role, material/reference, section, screening stress limit, effective length factor K and material-review flag. This is separate from appearance.
- `model.structural.overrides`: optional source-object defaults. Native/source IDs are retained through model conversion.
- `project.structuralStudies[versionId]`: version-specific layer/object overrides, manual axes, load panels, supports, review flags, load values, permitted/excluded column zones and proposal inputs.
- Geometry confirmation is bound to a Float32 surface-coordinate fingerprint. A changed source mesh cannot silently retain an old axis confirmation. Native and imported source meshes are preserved without box replacement.
- New versions may inherit proposed inputs, while support/load/panel/manual-axis confirmations reset. Changed saved layer properties override the corresponding inherited layer defaults. Old runs/versions are not rewritten.
- A geometric crossing without a shared analytical joint requires explicit review: trace/split the actual joint or confirm the crossing members are intentionally unconnected. Duplicate axes, incompatible panels, absent support paths, stale supports, invalid sections/materials and missing reviews block calculation.
- Linked load-panel areas are checked against a horizontal top-surface mesh area where available. This is an area consistency guard, not proof of complete spatial coverage or slab design. Complex openings/plates require a justified idealization or explicit load regions.
- Editing inputs invalidates displayed results and disables Save. A source version/input-signature/scheme combination cannot be saved twice by repeated clicks. Historical values remain unchanged.
- Worker completion includes reaction equilibrium checks before a result is accepted. UI progress counts actual completed schemes and measures elapsed time; no inner-solver percentage is fabricated.

## Spatial rendering contract

The structural viewport is the single visible Three.js scene owner. True spatial depth is required to review members, support elevations and 3D load paths. HTML tables/controls remain the accessible numerical interface. The existing hidden Plan Studio helper supplies the same source geometry as the Sun Hours bridge; it is not a second visible renderer.

World coordinates remain in metres/Z up with no display-only recentering. BufferGeometry stores unchanged source triangles; analytical lines/joints are separate overlays. Colors map to explicit validation/result states. Purple denotes a proposed study-only member. White edges identify selection. Orbit/pan/zoom and Fit retain model orientation. Clicks select source objects; trace mode snaps to hit-triangle vertices for subsequent axis review; support mode selects explicit analytical joints.

Rendering is event-driven, with capped DPR 1.5, ResizeObserver sizing and disposal of geometries/materials/controls/renderer on route exit. Surface payloads are not copied into the solve Worker. The guided workflow bounds source/member counts. Desktop is primary; narrow layouts stack panels. Without WebGL, coordinate/list/calculation interfaces remain available if source preparation succeeds; no alternate duplicate visualization is displayed. No animation or device permissions are introduced.

## Verification and accuracy evidence

- `tests/structural-workflow.cjs`: all 20 existing closed-form solver cases remain within 1%; steel/timber self-weight cantilever displacement and reactions match independent formulas; full load-panel/self-weight reaction balance; red computed deflection failure; missing input/material/support rejection; duplicate axes; crossing review invalidation; constrained column proposals; immutable inputs; geometry confirmation/version inheritance.
- `tests/structural-study-ui.cjs`: own-model entry without a grid substitute, explicit separate example, real Worker calculation/cancel, source-version immutability, duplicate Save, HTML/JSON export, red beam/panel display, column alternatives, persisted input/history, bounded desktop layout, exact equality of every reference-surface coordinate with the **actual Sun Hours engine input**, Workbench Layer properties across versions, and the independent native solver's 20 cases.
- `tests/free-simulations.cjs`: all 17 study entries stay free, with resource/Pricing behavior unchanged.

These tests validate the stated mathematical and workflow cases. Independent reference-model comparisons over a published, supported model set are still required before asserting a <=10% end-to-end accuracy target. Material/connection/load inference from arbitrary architectural meshes is not validated to that target.
