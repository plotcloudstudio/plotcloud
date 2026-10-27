# PlotCloud public weather download function

This is a narrowly scoped download bridge for public EPW ZIP archives. Climate.OneBuilding does not send browser CORS headers, so a static GitHub Pages page cannot download its archives directly. This function fetches from the two allowlisted publishers and returns CORS headers. It reads no user data or database tables and needs no service-role key.

## Current verified deployment

The owner deployed this source under the dashboard name `quick-function`, with JWT verification disabled for this public weather-only endpoint. Production URL: `https://cgxszynizkbiblfiaowf.supabase.co/functions/v1/quick-function`. Keep that existing function; do not rename it or create a duplicate. The health response's internal service identifier is still `plotcloud-weather`.

Verified on 27 October 2026: anonymous health/CORS and real Vancouver/Toronto archives (8760 hourly records each) passed the live release check. Client configuration is connected. The following instructions describe a fresh deployment or recovery, not an outstanding user action.

## Owner deployment using the existing Supabase project

1. Open https://supabase.com/dashboard/project/cgxszynizkbiblfiaowf/functions . Create a new Edge Function named `plotcloud-weather`, using the dashboard editor.
2. Replace the generated `index.ts` with the complete adjacent `index.ts` file, then deploy. Disable **Verify JWT** for this function: this is a public, no-credentials weather download endpoint. Do not put any passwords, service-role keys or access tokens into the source or browser.
3. Open `https://cgxszynizkbiblfiaowf.supabase.co/functions/v1/plotcloud-weather?health=1`. It should return `{"service":"plotcloud-weather","ready":true,...}`.
4. For a fresh or replacement deployment, confirm its endpoint first. Set `WEATHER_PROXY_URL` in `mvp/js/weather-config.js` to `https://cgxszynizkbiblfiaowf.supabase.co/functions/v1/plotcloud-weather`, verify a real archive through the function, then release the browser configuration. Until then the UI shows station matching/manual upload and does not claim automatic download is connected.

The project owner must perform deployment or grant an authorized deployment identity. The publishable browser key cannot create Edge Functions. No SQL membership initialization is needed for this function. Existing database/admin policies are untouched. Standard project service quotas apply.

CLI alternative from this repository (for an owner who already uses the Supabase CLI): `supabase functions deploy plotcloud-weather --project-ref cgxszynizkbiblfiaowf --no-verify-jwt`. Credentials stay in the CLI's own secure authentication, never in tracked source.

## Behavior and boundaries

- GET/OPTIONS only; exact HTTPS publisher allowlist, no user-supplied credentials, queries or redirects.
- 25 MiB declared and streamed archive limit, 35-second upstream timeout, ZIP signature check. Browser performs central-directory/CRC/EPW validation before attaching anything.
- No arbitrary-URL proxy, database access, user files or server secrets. Public CORS is intentional for public weather archives without credentials.
- Errors retain CORS headers and give retry/manual-upload instructions. Published archive content remains subject to its provider's terms and availability.
- `tests/weather-service.cjs` verifies response headers, source restrictions, methods, redirects, oversized streams, HTTP/body errors and timeout. It uses injected upstream responses and is not proof that the production function has been deployed.
