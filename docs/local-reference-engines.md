# Local reference-engine execution: first delivery

Release: `local-compute-20261028-2`.

## Product task and boundary

Students and school labs can run inspected professional-engine tasks on their own workstation, retain original model/version evidence and return results to PlotCloud without paying for a hosted compute service. The first recipes are Radiance CIE-overcast daylight factor and execution of an independently prepared/reviewed EnergyPlus epJSON with matching annual EPW. This is a local execution foundation and first reference daylight recipe, **not completion of P2 annual daylight/glare or P3 thermal-model preparation and energy reporting**.

Workflow: Simulations → Local reference engines → choose a saved version → review analytical inputs → export `.pcjob.json` → run on the private local dashboard → download result and engine archive → import `.pcresult.json` → inspect/export → reopen the version-linked result from Results. No browser localhost network permission, cloud API account or shared-network tunnel is required. Website and setup instructions are English. Installation guide: [`local-compute/README.md`](../local-compute/README.md).

## Implemented contract

- Exact source triangles, object keys, linked context and world metre/Z-up coordinates are reused from the same source path as Sun Hours; no bounding-box replacement or Workspace/furniture edit is applied.
- Explicit neutral diffuse/glass optical assignments and reviewed upward workplane sensors are separate from visual/structural materials. A solid glass mesh is not automatically converted to a single optical boundary; the review warns about repeated attenuation.
- Radiance runs `gensky`, `oconv`, `rtrace`; records executable version and fixed numerical settings; computes actual overcast reference illuminance separately, then daylight-factor percentages. There is no EPW/sDA/ASE/glare claim for this recipe. No unmodeled ground reflection is assumed. Sensor means are arithmetic, not a certification area score.
- EnergyPlus runs a version-matched self-contained epJSON with the submitted EPW. It requires a real successful end record without severe/fatal errors, preserves outputs/warnings and does not synthesize zones, loads, HVAC, EUI or comfort. Plugins, external interfaces and file dependencies are rejected. Energy output interpretation remains a subsequent delivery.
- File-based source provenance includes original project/version/model hash, analytical-input fingerprint, task ID and engine-input SHA-256. Completed-result import checks these source/task fields, sensor IDs/coordinates/counts and finite values, with a consistent mean. Linked-context changes reject incompatible results. This protects against accidental mismatch; user-supplied files are not cryptographically attested solver evidence.
- One local job, duplicate-ID idempotency, active cancellation, real elapsed time/stages, missing-engine errors, bounded inputs/files and timeouts. No invented progress percentage, fake engine fallback or normal-looking failed result. Dashboard reload can reopen a job in the same running session; disk files remain after session restart.
- Loopback-only authenticated API, private session URL cleared from browser history, exact Host/origin checks and no public CORS. This is an individual/lab-workstation runner, not a multi-user LAN service.
- New results remain separate from approximate browser-study metrics and retain history. CSV, result JSON, source-backed HTML report with actual 3D drawing/sensor plan and Print → Save as PDF; raw EnergyPlus outputs are exported in the local ZIP. Results links reopen the exact source version and result.

## Validation evidence and limits

- Actual pinned `pyradiance==1.3.1` distribution, reporting `RADIANCE 6.0a`: open horizontal reference near 100% DF, black closed room near 0%, glass VT 0.4/0.8 produces increasing nonzero interior DF (bounded simple geometry). Fixed parameters and preparation limits are recorded; no universal accuracy claim follows.
- Official EnergyPlus **25.2.0-cf7368216c** `1ZoneUncontrolled.idf`, converted using that executable to epJSON and run against its bundled Golden EPW: successful completion, zero warnings/severe errors. Version mismatch and unsafe external/plugin input fail rather than produce normal results. This verifies execution integration, not arbitrary architectural-to-thermal conversion.
- Local API tests: token/origin/Host boundaries, duplicate inputs, original coordinates, material conversion, missing engines, foreground-process cancellation and failed-job archives.
- Browser acceptance: website export → real local runner/dashboard → completed JSON/ZIP → original-version import → actual report/drawing/CSV → Results reopen; duplicate, malformed and stale-result rejection; source model unchanged; five laptop sizes; both recipe input paths; no page errors.
- CI additionally repeats the browser workflow against the public Pages website and its actual downloadable runner. A successful source build alone does not establish that public verification passed; publication status is reported separately.

Next work remains the reviewed analytical-room/optical model, Honeybee/annual Radiance recipe, independently validated glare, and guided thermal zoning/constructions/operation/output interpretation. No placeholder card is presented as a completed annual energy or glare solver.
