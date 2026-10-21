# Interior core development cycle

## User and outcome

An architect at a small practice needs to compare furniture and material directions for one interior camera and present options to a client. The deliverable is two images with identifiable source views, design inputs and resource references. Current alternatives require repeated image exports and manual tracking. PlotCloud should keep those inputs with each result and reduce repeated setup. Photorealism and product resemblance remain empirical acceptance criteria, not consequences of connecting nodes.

## Allocation and current increment

| Task | Owner | Tracked work | Acceptance |
| --- | --- | --- | --- |
| Furniture input binding | Interaction implementation agent | #7 | Interior scene; reference + target + nonempty edit region; immutable request history; clear stale bindings on source change |
| Actual provider adapter | Service implementation agent | #8 | Server-only key; authenticated operator access; bounded requests; no arbitrary URL downloads; provider errors remain errors |
| Option comparison | Integration owner | #9 | Choose A/B; identify source differences; export actual comparison PNG and complete input records |
| Independent verification | QA agent; integration owner releases | #10 | Desktop task acceptance, old camera/project workflows, contract tests, CI and online verification |

Use the existing five steps: **Site analysis → Plan Studio → Simulation → Rendering → Boards**. Desktop is the current priority. Keep original tool routes and user data. Do not redesign the mobile experience in this increment.

## Iteration protocol

1. Start from one real deliverable and identify the shortest sequence of decisions.
2. Specify the source, target, resources, editable area and observable result before editing UI.
3. Implement a reversible increment without replacing the existing application.
4. Independently review request provenance, asynchronous input changes, authentication and errors.
5. Test the task and relevant existing workflows; fix findings before merging.
6. Release only passing changes. Verify actual hosted navigation/UI separately from CI.
7. Record limitations and choose the next increment from evidence gathered in this one.

## Verified by automated tests

- Browser tests use synthetic images and a mocked render endpoint. They verify binding, painting, input locking, history restoration, source reset and A/B exports, not image quality.
- Server tests mock the provider. They verify request validation, access control, output extraction and single-process retry behavior without paid calls.
- Existing camera capture and project round-trip tests remain required.

## Real-model acceptance still required

Deploy the operator API to an HTTPS host and configure a private provider key, an explicitly supported model and a separate operator access token. No credentials are present in this repository. Do not put model provider keys into the browser.

Use several interior room views and three different furniture references per view. Review wall/opening and camera stability, target furniture resemblance, contact shadows, reflections, material texture, continuity after edits, provider latency and total cost per usable output. Preserve successful and rejected samples with their requests. Failure in these criteria should lead to adapter/region-control improvements before adding a larger node editor.

## Next increments

1. Real-provider quality benchmark and reliable result recovery with durable jobs/storage.
2. Simplify the default desktop workflow based on observed task friction.
3. Add an advanced node editor over the same `interior_workflow` contract; retain input bindings and request history across modes. Current UI does not include this canvas.
4. Add per-user authentication, account quotas, transactional credit reservation/settlement, checkout and a durable task ledger before customer billing. The operator pilot is not a paid production service.

Mapping/site expansion, other render domains, video and broad resource-catalog growth are deferred until the interior workflow delivers repeatable value. Resources remain relevant through input provenance; visually referenced furniture must not be represented as a verified purchased product or dimension-accurate 3D model.
