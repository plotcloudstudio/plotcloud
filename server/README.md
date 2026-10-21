# Interior rendering service

An operator pilot for testing PlotCloud's actual source-image → furniture-reference → saved-result workflow. The static website remains usable without this service. This is not a deployed production service, a membership system or a credits ledger.

## Run

Requires Node.js 22 or later, no installed packages. Configure these variables in a server secret manager or a private shell environment; never commit their values:

- `GEMINI_API_KEY`: your Google image-generation API credential.
- `GEMINI_IMAGE_MODEL`: explicitly choose an image-capable model supporting the GenerateContent API. There is no implicit model selection or fallback.
- `RENDER_ACCESS_TOKEN`: a separate random operator token of at least 32 characters. Do not use the Google API key here. Share only with the operator testing this pilot.
- `ALLOWED_ORIGINS`: comma-separated exact web origins, e.g. `https://plotcloudstudio.github.io`. No paths, wildcard or trailing slash.
- `HOST`: defaults to `127.0.0.1`; set `0.0.0.0` when your hosting platform requires it.
- `PORT`: defaults to `8080`.
- `RENDER_TIMEOUT_MS`: optional, default `150000`, maximum `170000`.
- `RENDER_MAX_JOBS_PER_HOUR`: optional, default `20` new provider jobs for the entire operator service.
- `RENDER_MAX_CONCURRENT`: optional, default `2`, maximum `4`.

From `server/`, run `npm test`, then `npm start`. Put an HTTPS reverse proxy or managed HTTPS service in front of the server. Set its request and response timeout above the configured render timeout, and its upload limit to at least 70 MB. Browser access from GitHub Pages requires HTTPS. Set the renderer endpoint to `https://your-host/api/render` and enter the separate operator service token in the in-memory service-token field. Do not paste a provider API key into the website.

`GET /health` reports scope and limitations without secrets. `POST /api/render` requires `Authorization: Bearer <operator-token>` and JSON. CORS only admits configured origins and permits the authorization/content-type headers. CORS is not authentication. There is no cookie authentication.

## Contract and fidelity

Accepts the renderer's `request_id`, `source_image`, `reference_images`, `prompt`, `negative_prompt`, `material_prompt`, `scene`, `edit_mode`, `mask_image`, `preserve_geometry`, `structure_strength`, `variation_strength`, and optional `interior_workflow` version 1. Source, references and mask must be inline PNG/JPEG/WebP data URLs, at most 12 MB each. A mask must be PNG. Arbitrary image URLs are rejected; the service never fetches user-selected hosts. At most three references and a 70 MB JSON request are accepted.

The workflow carries `intent: atmosphere | replace`, a target description/object ID and `reference_bindings` with reference index, target and purpose. Replacement additionally requires a painted-mask region, an inpaint mask, and a bound reference. The adapter orders and labels these images for the model. It returns the first non-thought image output as `image_data_url`, with model, request ID, timestamp and explicit limitations.

**The mask is an image guide for semantic editing, not an enforced binary-mask API.** This adapter does not implement pixel compositing, depth conditioning, deterministic geometric preservation or exact product matching. Structural/variation sliders are conveyed as descriptive guidance, not native numeric sampler controls. Appearance, camera stability, furniture identity, shadows and unchanged regions must be evaluated with real interior test cases before publishing quality claims. The service does not generate or modify editable three-dimensional furniture. Provider safety refusals or missing images produce errors rather than fabricated results.

## Spending controls and persistence limits

Keep the same `request_id` when retrying exactly the same JSON request: pending requests share one job, completed successes are cached, changed inputs return HTTP 409, and failures are cached without automatically retrying the provider. HTTP 429 indicates operator capacity limits. A new request ID can create a new paid provider call.

The job cache and hourly admission count live in **one process only**. The cache retains completed jobs for 24 hours, has at most 64 entries and reserves bounded memory before admitting jobs. A restart, multiple replicas or retry after cache expiry can repeat a provider call. Browser cancellation does not cancel a provider job already accepted; the provider may charge even if the browser receives no result. A transport timeout may also leave an upstream billable request. There is no durable result recovery, transactional billing, refund claim or cross-instance idempotency guarantee.

Use a single instance for the supervised pilot. Before customer billing, replace the in-memory ledger and shared operator token with per-user authentication, durable jobs/object storage, transactional idempotency and credit reservation/settlement. Also add account quotas, operator monitoring and a queue. Do not offer a public paid service on this pilot token.

## Verification

`npm test` uses synthetic tiny images and a mocked provider only. Tests cover authentication, exact-origin CORS, source validation, interior scope, furniture binding, duplicate-request coalescing, ID conflicts, failure caching, admission limits, provider image parsing and secret redaction. No paid image-generation call is made; photorealism has not been tested by this suite.

Provider contract reference: [Google's GenerateContent image-generation documentation](https://ai.google.dev/gemini-api/docs/generate-content/image-generation), checked 2026-10-20. The server fixes the outbound host to `generativelanguage.googleapis.com` and uses server-only `x-goog-api-key` credentials.
