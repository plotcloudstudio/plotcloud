# Imported model fidelity and simulation readiness

## User task

An architect imports a Rhino model, sends the active Workspace model to a study, and expects the same geometry in the calculation and its saved evidence. A different sample model, unplaced block assets or bounding-box replacements invalidate this workflow.

## Implemented behavior

- Rhino import reads placed objects and expands placed block instances at their world transforms. Unplaced definition geometry is excluded. Layer paths, document units and visible surface geometry are retained. Curves and points are counted separately because they are not simulation surfaces. Unsupported surfaces without render meshes fail with a repair instruction.
- **Import as new model** creates an isolated project instead of appending an imported file to the startup example.
- The hidden Plan Studio conversion helper serializes requests and waits for asynchronous mesh extraction before switching models. Imported meshes and hidden layers are restored with the selected version.
- Sun hours, solar radiation, outdoor thermal comfort and wind receive original world-space triangle meshes, rather than imported-object bounding boxes. Stormwater receives triangles as a metre-based, Y-up OBJ. Solar scenes use metres and Z up. Audit metadata accompanies saved results.
- Engine loading must acknowledge the selected version before Run becomes available. An import error cannot reveal or calculate the startup sample. Native expensive-run confirmations are brought into view.
- Indoor studies explicitly block unmapped imported geometry; structure blocks meshes without a member, support, material and load model. This prevents misleading calculations using a sample plan or synthetic frame. These are capability gaps, not successful calculations.
- Outdoor Noise is removed from the study catalogue and Workspace handoff. Old links show a removal notice. Historical result data is retained.

## Private fixture audit, 2026-10-27

The user-supplied Rhino fixture is kept outside the repository. It contains 111 object records, including 52 unplaced definition objects. The placed surface model imports as 54 mesh objects and 10,158 triangles; five other placed objects are nonsurface geometry. Source centimetres are converted to metres.

The browser test compares every world-space triangle coordinate and object ID between the Workspace renderer and the solar payload. The fixture fits the importer limit; no mesh decimation or geometry removal was needed.

Verified calculation and save: Sun hours, solar radiation, outdoor thermal comfort, wind, and stormwater. Wind completes its native Draft solve under software GPU rendering; it is a multi-minute computation, not an immediate preview.

Not ready on this imported mesh: Daylight, natural ventilation, indoor acoustics, space syntax, movement and spatial depth, circulation, isovist, views, cameras, privacy, wayfinding, and structure. The website does not yet infer reliable room topology, opening semantics or an engineering frame from arbitrary Rhino surfaces. Import fidelity alone does not implement those analysis models.

Solar radiation and thermal-comfort execution tests use clearly identified synthetic QA weather. Test results demonstrate software execution, not real site performance. The solar screening solver currently treats glazing as opaque. Physical assumptions and resolution remain limitations of each existing solver.

## Reproduce

Use a local HTTP server and the repository Playwright setup. Supply the private file path with `PC_RHINO_FILE`; never commit the uploaded file or backups containing its geometry.

```sh
node tests/analysis-geometry.cjs
node tests/rhino-blocks.cjs
PC_RHINO_FILE='/path/to/private-fixture.3dm' node tests/imported-model-audit.cjs
node tests/imported-model-all-studies.cjs
node tests/simulation-workflow.cjs
node tests/study-evidence.cjs
node tests/beta-access.cjs
```

The full-study audit consumes the private local project backup created by the import audit. CDN access and a WebGL-capable browser (or SwiftShader) are needed for browser tests. Raw screenshots and QA project backups remain local artifacts.
