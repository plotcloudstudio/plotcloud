# Address-based EPW import

Implementation status: station matching and the client import pipeline are implemented. **The public download service is not yet deployed/connected.** The production configuration is intentionally empty, so it shows station matching/manual upload and preserves existing generic-weather study behavior until the owner deploys the function. See `supabase/functions/plotcloud-weather/README.md`.

PlotCloud uses the project's saved latitude/longitude to find nearby station metadata, download the publisher's ZIP, extract its EPW, validate it and store its contents in the existing browser-local climate database. Actual weather contents are not bundled, generated from current weather, or replaced with a generic year when automatic import fails.

The integration runs after creating a mapped site, after saving a new project address in Shared conditions, and before a weather-dependent study opens for a real (non-sample) location. Project conditions offers address search, station selection, retry/cancel, manual upload, publisher links and download of the saved EPW. Existing manually selected files are retained. Sample projects keep their current behavior unless the user explicitly requests automatic weather.

## Source and currency

- Catalog: factual station metadata extracted from the public Ladybug Tools EPWMap deployment, pinned to `86e0b24673c88c700a664f4cad5d735e7a91704b` (20 October 2023). Retrieved 27 October 2026. This index is **not** a current-2026 station or weather-release inventory. The UI discloses its age. The publisher may have newer releases.
- Archives: Climate.OneBuilding and EnergyPlus weather S3. EPWMap credits these sources: https://github.com/ladybug-tools/epwmap . OneBuilding describes the available typical-year data and retained historical releases at https://climate.onebuilding.org/ . Metadata contains the actual dataset window from the catalog filename, not a fabricated current year.
- The compressed catalog contains 19,736 station/provider records; nearby choices deduplicate station IDs. It includes metadata only, not the EPWMap application code or weather archives. Rebuild with `tools/build-epw-station-catalog.py` and the pinned bundle. Its SHA-256 is stored in the catalog.

## Guardrails

- Selection uses great-circle distance, with the selected station's dataset/provider shown. It is not a claim that the nearest station best represents coastal, mountainous or urban microclimates.
- More than 100 km distance, or over 300 m elevation difference where site elevation is available, requires review/acknowledgement. These are product review thresholds, not meteorological validation criteria. EPW coordinates more than 25 km from the chosen catalog station are rejected as a download/index mismatch.
- No browser credentials or general public proxy are introduced. Downloads use the restricted `plotcloud-weather` Edge Function, whose server-side source allowlist contains only the two weather publishers. Climate.OneBuilding does not provide browser CORS headers; direct browser fetching is not a viable production path. The function must be deployed by the existing Supabase project owner and tested before enabling `WEATHER_PROXY_URL`. Failed, timed-out, HTTP-error, CORS-blocked or corrupt downloads show an explicit error and preserve previous project weather. Manual publisher download/upload remains available.
- ZIP parsing uses the central directory and supports stored/deflate entries with CRC32 and length validation, including data descriptors. A single EPW is required. Archives are limited to 25 MiB and expanded EPWs to 8 MiB. EPWs require 8 headers and 8760 or 8784 hourly records with valid temperature/wind and LOCATION metadata.
- Imported metadata records actual station coordinates, elevation, EPW UTC offset, data-source field, WMO ID, hash, source URL, catalog window, download time and project coordinate match. It never overwrites project north, site coordinates or IANA time zone.
- Changing address during a download prevents attachment to the new address. Changing a location clears its automatically matched EPW and triggers a new match; manual selections remain the user's choice. Result history is retained and shared-condition signatures flag affected studies for rerun.
- Files remain browser-local. Use Download saved EPW for backup. JSON project backups/cloud sync do not include EPW contents. The automatic file can be restored from its station match; a missing manual file requires upload.

## Verification and limits

`tests/automatic-climate.cjs` checks nearest matches in Vancouver, Toronto, London and Tokyo; antimeridian distance; URL restrictions; ZIP/CRC extraction of the real Ladybug Chicago EPW; download failure/retry/cancel; file storage and export; reload caching; address selection/save; distant-station guard; address-change race; manual-file preservation; and application of the imported EPW to the real radiation engine.

Configured weather-service responses are intercepted in browser integration tests using the real Chicago EPW packaged as ZIP. This verifies the product workflow and actual engine import, **not** live availability or CORS headers on OneBuilding/EnergyPlus. The execution environment blocks direct requests to both publishers. GitHub-hosted station metadata and the real test EPW were retrieved successfully. The restricted service handler is separately tested for public CORS, host/URL restrictions, redirect rejection, timeout and size limits. Production automatic downloading remains pending owner deployment and a real service-backed download check; no live-download success is claimed from these tests. Reference confirming the upstream CORS limitation: https://developers.idfkit.com/weather/downloads/ .
