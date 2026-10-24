# Catalogue image source

`analysis-art.html` renders the 14 illustrative analysis plates used by the homepage and simulation catalogue. These are schematic explanations of analysis types, not captured engine results or solved performance values. Each plate carries an illustrative-preview label. Do not use them as a project's saved result.

All plates use `sampleModel('A')`, the same cutaway height, model origin, 1200 × 900 resolution and orthographic camera: position `(31, -28, 30)`, target `(8, 6, 0.4)`, vertical half-span `10.275`. Day/night changes only the background and page text; geometry and framing remain identical. Colour palettes and overlays vary by analysis type. No invented numerical results appear in the plates.

Rebuild from the repository root with a local static server on port 8765 and Playwright available:

```
node hero/capture-analysis.cjs
```

`TEST_BASE` and `CHROMIUM_PATH` can override the server and browser. Output is `mvp/img/analysis-<id>-day.jpg` and `-night.jpg`. Original holographic images remain in place for historical views.
