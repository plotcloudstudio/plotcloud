# Simulation homepage refresh

Audience: architects and students evaluating early design options. The homepage now puts sun, daylight and wind previews before model preparation features, and links each preview to its existing study route. Assumption: visitors need to understand the study outputs before starting a project.

Presentation references: Spacio homepage inspected in-browser, with a centered heading, architectural visual, floating navigation, feature cards and restrained transitions. Original PlotCloud copy and generated images are used.

Assets: mvp/img/home/massing.webp (1600x700), site.webp (1000x700), drawings.webp (2400x700), daylight.webp (1672x941). Built-in image generation; first three follow docs/home-image-prompts.md. Prompts are retained in mvp/img/home/README.md. Wind and sun previews reuse existing illustrative artwork. All previews and sample quantities are labeled illustrative, not calculated project results.

Verification: JavaScript syntax and whitespace checks passed. Browser checked all four new images loaded, daylight/wind/sun selection updates the image and study link, solar keyboard input changes the sun position, massing keyboard input changes storeys, desktop and 390px layouts have no horizontal overflow. Existing project storage, engines and export implementations are unchanged.

## Daylight generation prompt

Use case: stylized-concept. Original wide landscape architectural simulation illustration for PlotCloud homepage, 16:9. A precise white roofless one-storey apartment study model in high three-quarter orthographic view on seamless light grey #f4f5f7 background. Matte white walls, pale blue glazing in two large left-facing windows, simple white furniture blocks. Floor is a crisp square analysis mesh with plausible daylight gradient: warm pale yellow immediately next to left windows through cyan to deep navy at back of rooms, clearly bounded by walls. Soft studio daylight from upper left, crisp real-time 3D model shading, restrained technical look like architecture software, broad empty margins and entire model visible. A short horizontal unlabelled navy-cyan-yellow color strip in bottom right. No text, no numbers, no units, no logos, no people, no interface, no certifications. This is an illustrative daylight analysis visual, not a calculated result. Visually consistent with clean white architectural site-model imagery and Spacio-style professional architectural presentation.
