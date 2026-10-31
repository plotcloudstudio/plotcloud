# Homepage pictures: prompts for image generation

The homepage (`mvp/js/pages/home-v2.js`) draws every card in code, so it works with no pictures. A card shows a picture instead when
its file exists. Generate each picture with the prompt below, export it as WebP, and save it under `mvp/img/home/` with the file name
given. Nothing else needs to change: the page checks for the file and shows it in place of the drawing.

Shared style for every picture: clean white architectural model look, soft daylight from the upper left, light grey background
(#f4f5f7), no text, no logos, no people close up, no watermark, isometric or high three-quarter view, crisp edges, lots of empty space,
calm and minimal, the look of a white physical study model photographed in a studio.

## `massing.webp` · card "Fast massing iterations" · 1600 × 700 px (wide)

Isometric view of an urban block as a white study model on a light grey background. A row of small pitched-roof terraced houses along
the back edge of a dashed site boundary, a few small trees as white spheres, and in the middle one simple rectangular building mass
in very pale blue glass-like material with thin horizontal floor lines, about eight storeys. A thin blue measurement line runs along one
edge of the site boundary. Soft shadows on the ground. Minimal, white, architectural.

## `site.webp` · card "The site from an address" · 1000 × 700 px

A square cut-out of a real-looking city district as a white topographic site model, seen from a high three-quarter angle: gentle
terrain with thin contour lines engraved on the surface, a dark slate-grey river or harbour along one side, white block buildings of
varied heights, thin light-grey streets. Two small blue map pins stand on the model. The block has clean vertical cut edges like a
laser-cut model. Light grey background.

## `drawings.webp` · card "Plans out to DXF" · 2400 × 700 px (very wide)

A floor plan of a small apartment drawn as a clean black-on-white architectural drawing, slightly tilted in perspective on a light
grey background: thick black walls, door swings, simple furniture outlines, room names in small grey type, and a blue dimension line
along the bottom. A second sheet partly behind it. Sharp, technical, minimal.

## Optional: `hero.webp` · hero card · 1400 × 920 px

Not used by the code yet: the hero is interactive (the sun follows the pointer). If you want a picture behind it later: a white
topographic site model with one white building, the ground coloured by a soft heat map from deep blue in the shadow to warm orange in
full sun, a small glowing sun to the upper left, light grey background.
