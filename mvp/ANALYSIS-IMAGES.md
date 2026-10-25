# Catalogue image source

`analysis-art.html` renders the 14 illustrative analysis plates used by the homepage and simulation catalogue. These are schematic explanations of analysis types, not captured engine results or solved performance values. Each plate carries an illustrative-preview label. Do not use them as a project's saved result.

Interior plates use `sampleModel('A')`. Exterior plates (Sun Hours, Wind Flow, Stormwater) share a site with five massing blocks. Both families use a fixed origin, 1200 × 900 resolution and orthographic camera: position `(31, -28, 30)`, target `(8, 6, 0.4)`, vertical half-span `10.275`. Day/night changes only the background and page text; geometry and framing remain identical within each family. No invented numerical results appear in the plates.

`hero/extract-engine-colours.cjs` extracts the actual engine colour definitions into `engine-colours.json`. The renderer samples these complete colour tables rather than an independent palette. Run extraction before rebuilding plates; missing definitions fail extraction. Isovist uses the checked engine seen/blind RGB values..

Homepage V1/V2 images are actual Sun Hours engine screenshots (`sun-example-v1.png`, `sun-example-v2.png`), not these illustrative plates. `hero/capture-sun-example.cjs` runs both model versions with identical conditions and records settings and original figure text in `sun-example.json`. `home-example.js` reads these figures for the homepage. The only modeled change is the east context mass height, 9 m to 3.6 m. Both runs use 0.5 m sampling, 15-minute time steps, a fixed 10 m margin, March 20, 2026, and the same Plan view. The script verifies matching settings and sample counts before saving the record.

Rebuild from the repository root with a local static server on port 8765 and Playwright available:

```
node hero/capture-analysis.cjs
```

`TEST_BASE` and `CHROMIUM_PATH` can override the server and browser. Output is `mvp/img/analysis-<id>-day.jpg` and `-night.jpg`. Original holographic images remain in place for historical views.
