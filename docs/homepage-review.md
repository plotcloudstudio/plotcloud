# Homepage review and Toronto hero integration

Reviewed against GitHub `main` at `9d5c931` and the supplied screenshot. This is a source and local-browser review, not a claim of verified production deployment.

## Changes worth prioritizing

1. **Give the public navigation one clear workspace entry.** `mvp/index.html` currently exposes Workspace and Workspace v2 (TEMP). They are distinct working implementations, so preserve both; put the experimental entry behind a review link until the primary workflow is chosen. This reduces uncertainty for a first-time architect without removing capabilities.
2. **Make homepage claims match the current workflow.** `mvp/js/pages/home.js` says all studies share the site/model and every result is saved; `mvp/README.md` and `mvp/js/mocksim.js` distinguish mock previews from full tools, and sending saved versions into the full engines remains planned. Keep that distinction close to the claims and comparison examples, rather than relying only on the Prototype badge. The Toronto scene is explicitly illustrative.
3. **Let visitors try the sample before creating an account.** The primary Start free button opens the prototype login; the workspace already supports a sample project without a real account. Consider making the sample-workspace action primary, then asking for an account when durable project storage exists. Do not present local mock authentication as production sign-in.
4. **Make persistence clear at the point of saving.** `mvp/js/store.js` stores projects, versions and results in localStorage. Add a concise “saved in this browser” cue beside project/result actions and provide an export/backup path before promising cross-device recovery. Do not imply server storage or paid-service readiness.
5. **Show one complete task before the full catalogue.** The homepage currently introduces site settings, 14 studies, version comparison, resources and pricing. A focused example from site → model → actual study → export would explain user value sooner. Keep the catalogue accessible as secondary navigation.

These are recommendations, not implemented product/backend changes.

## Implemented in this change

The current `/mvp/` homepage's top hero photograph is replaced by the Toronto maquette. Version-comparison pictures and simulation cards remain intact. The scene supports subtle pointer-responsive camera motion, drag, reset, pause and Sun/Wind/Rain/Sound selection. Day/night changes update the scene background and control colors.

The environmental mode is remembered in sessionStorage under its own key. First visit starts at Sun. Refreshing, returning from another site route, or returning to a previously hidden homepage advances Sun → Wind → Rain → Sound → Sun. Manual selection becomes the basis for the next advance. Duplicate visibility notifications do not advance twice. Reduced motion starts paused; state selection and return-based cycling still work.

The iframe uses the bundled HTML so its styles and 3D engine require no additional requests. The source HTML remains available for development; regenerate the bundled file with `hero/build-standalone.cjs` after changing source. Rendered effects are illustrative, not engineering output.

Validation: `tests/home-hero.cjs` covers integration, refresh/route-return cycling, simulated visibility lifecycle events, manual selection persistence, pointer response, theme sync, narrow layout, message-source validation and bundled assets. `hero/toronto.test.cjs` covers rendered differences between states, animation/pause, drag/reset, reduced motion and WebGL fallback. Visibility events are simulated for deterministic headless testing; do not equate that check with a manual test in every browser.
