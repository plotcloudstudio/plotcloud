# PlotCloud local compute

Runs professional engines on a student's computer or a school workstation, with no PlotCloud cloud-compute subscription. The machine owner supplies Python, the engines and enough memory/disk space. This release supports **Radiance CIE-overcast daylight factor** and **user-reviewed EnergyPlus epJSON + EPW execution**. Annual Radiance daylight, glare, dynamic shading and an architectural-to-thermal model editor are not delivered by this runner.

## Start in five steps

1. Open PlotCloud → Simulations → **Local reference engines**. Choose the correct project and saved version.
2. Download `plotcloud_runner.py`. Install Python **3.10 or newer** from [python.org](https://www.python.org/downloads/). On Windows, enable the Python launcher; `py` can replace `python` in the commands below. On macOS/Linux use `python3` if required. Run commands with the same Python installation throughout.
3. For daylight factor, install the pinned binary distribution: `python -m pip install pyradiance==1.3.1`. This is a separate third-party installation with its own license and supported operating-system/Python combinations. If no compatible wheel exists, install [official Radiance](https://github.com/LBNL-ETA/Radiance) and use `--radiance-bin /absolute/path/to/bin`. Keep its sibling `lib` directory available, or set `RAYPATH` as the Radiance installation requires.
4. In the download folder run `python plotcloud_runner.py`. A private local page opens automatically. If not, copy the **whole private URL** shown in the terminal. This URL has a temporary session token; do not share it. The server binds only to `127.0.0.1`. Nothing needs to be hosted publicly or deployed to Supabase. Python does not include the engines.
5. Export the reviewed `.pcjob.json` on PlotCloud. On the local page, choose that file → **Run job** → download **result JSON** and **input + engine files ZIP**. Import the `.pcresult.json` on PlotCloud, selecting its original exported task. The result is saved separately from the existing approximate browser studies. Keep the ZIP for reproduction and debugging.

The file handoff is intentional. It avoids browser HTTPS-to-localhost restrictions, school-network firewall changes, tunnels and public engine access. The public website does **not** automatically reach into the local computer. Files can be copied to another workstation, run there and returned to the original PlotCloud browser/project.

## EnergyPlus

Install the [official EnergyPlus release](https://github.com/NatLabRockies/EnergyPlus/releases) matching the **major.minor version in your epJSON**. Example (replace the path with the actual executable):

```sh
python plotcloud_runner.py --energyplus /path/to/EnergyPlus/energyplus
```

Windows PowerShell example:

```powershell
py .\plotcloud_runner.py --energyplus "C:\EnergyPlusV25-2-0\energyplus.exe"
```

A matching executable already on `PATH` is detected automatically. Upload an independently reviewed `.epJSON` and its annual `.epw` on PlotCloud. The model must already include valid thermal zones, surfaces/adjacency, constructions, gains, schedules, ventilation/HVAC and requested output definitions. The runner calls the engine on those inputs and preserves the exact outputs. It does not turn an arbitrary visual mesh into a valid thermal model, run version transitions or invent EUI/comfort values. Use Honeybee/OpenStudio/EnergyPlus tools to prepare the model until a dedicated reviewed model editor is available.

Only self-contained models are accepted. External file paths/schedules, Python plugins, external interfaces and parametric expansion are blocked. Engine validation errors stop the job. Typical-year EPW is not a design-day definition. The runner does not add DDY, HVAC, schedules, constructions or unit conversions for you.

## Daylight-factor preparation

- Exact original visible Workspace surfaces and linked context are used in world metres / Z up; no building-shaped substitute is generated.
- Review every optical assignment. Opaque surfaces use a neutral diffuse `plastic` with declared reflectance; `glass` uses declared visible transmittance converted to Radiance transmissivity. Defaults are assumptions, not material measurements.
- A glass triangle surface should represent **one optical boundary**. Closed thick glazing meshes may cause repeated attenuation. Review/repair the analytical source before running. BSDFs, blinds, colored/spectral glazing, explicit ground reflection and automatic glazing extraction are not supported by this recipe.
- Review the occupied region and workplane elevation. The uniform cell-center grid has upward sensor normals; it does not automatically exclude walls, holes, voids or outdoor areas. Actual spacing is recorded. Sensor means are unweighted arithmetic means, not a standards-compliant floor-area score.
- The solver uses `gensky -c` CIE overcast, with its horizontal unobstructed illuminance independently ray-traced. Results are indoor illuminance divided by this reference, in percent. This recipe is **not annual sDA, ASE, DGP or a certification assessment**, and does not use EPW.
- Fixed recorded parameters: `-I+ -h -w -ab 5 -ad 4096 -as 1024 -aa .1 -ar 128 -lw .0001 -n 1`. Conduct a separate convergence study for demanding geometry. The Radiance version is recorded from the executable.

## Jobs, privacy and recovery

One job runs per session. Repeated submission of an identical task ID returns the existing job; the same ID with different inputs is rejected. Stages and real elapsed time are shown; an indeterminate progress bar does not pretend to know percentage completion. Cancel kills the active foreground engine process. Limits: **48 MiB** JSON input, **180,000** triangles, **4,096** sensors; no silent simplification. Active jobs are stopped if their files exceed 256 MiB; choose fewer engine outputs if needed. Radiance command timeout is 1 hour; EnergyPlus timeout is 4 hours. Missing engines, mismatched versions, invalid output and failed jobs never publish completed numeric results.

Inputs, logs and results stay in `~/PlotCloud-local-jobs` by default. Use `--jobs-dir /path/to/folder` to choose another directory. Disk files survive restart; the in-memory job session does not. After restart, use an already completed `result.pcresult.json` directly, or inspect the saved `input.pcjob.json` and logs on disk. Back up needed results before deleting job folders. Exiting the terminal stops active calculation. The runner makes no automatic retry, upload, account connection, paid API request or email.

Open the private URL in the same browser only. Local HTTP APIs require the token and exact loopback Host; cross-origin requests are disabled. A school can run separate local sessions for students. This is **not** a shared unauthenticated LAN or multi-user school-server deployment. Do not expose the port using a public tunnel. A managed shared lab server needs separate per-user authentication, job isolation and quotas.

The imported result records its task ID, source version/model fingerprint, analytical-input fingerprint, engine input SHA-256 and solver version. Import checks protect against accidental mismatches, not malicious forged local files or independent certification. Original jobs and engine archives are the inspectable evidence. Results are retained in the Local compute page and project backups; existing browser-study comparisons do not mix annual approximate daylight metrics with reference-engine daylight factor.

## Verification

`tests/local-compute-runner.py` checks validation, idempotency, original coordinates/material conversion, missing engines, cancellation, HTTP token/Host/origin restrictions and, when installed, actual Radiance open/closed/glazing cases and official EnergyPlus example execution. `tests/local-compute-ui.cjs` checks the website → exported source job → real local runner → imported result → report/CSV workflow, source preservation, duplicate/stale-result rejection, both recipes and laptop layout. Engine success and recipe scope must remain distinct.
