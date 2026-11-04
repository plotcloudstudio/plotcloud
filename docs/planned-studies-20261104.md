# Four upcoming study previews

These are presentation-only entries, requested for the homepage wall and Workspace picker. They do not register engines, run preflight, create model versions or produce results. `planned-simulations.js` supplies names, scope, copy and image paths to both entry points; the existing runnable `SIMS` registry is unchanged.

| Name | Intended design question | Shared reference |
| --- | --- | --- |
| Fire Evacuation | Escape routes and convergence near exits | `mvp/img/home/daylight.webp` |
| Clinical Visibility | Staff observation locations, window placement and blind spots | `mvp/img/home/daylight.webp` |
| Vehicle Swept Path | Truck access, turning and clearance | `mvp/img/home/wind.webp` |
| Parking Layout | Bays, aisles, accessible spaces and circulation | `mvp/img/home/wind.webp` |

The four JPEGs in `mvp/img/home/` were generated with ImageGen on 2026-11-04 by editing the respective approved master. The briefs preserved the white geometry, camera and neutral background, replacing only the analysis-style overlay (escape arrows, observation sightlines, a truck swept envelope, and parking bays). They are concept illustrations, not physically validated predictions or compliant layouts. Original PNG outputs remain in the local generated-images folder; published JPEGs retain the 1672 × 941 resolution at quality 88, totalling about 500 KB.

The wall and picker show “Coming soon”. A dedicated introductory view opens directly or inside Workspace without calculation controls. Upcoming studies are deliberately excluded from real-engine counts, batch runs and report results. Keyboard navigation in the picker stays within the visible Building or Interior category.

Validation: changed JavaScript modules parse; existing DriftWall runtime tests pass. Browser checks cover all four loaded wall assets, Interior and Building picker entries, shared hover imagery, all four embedded introductions, returning to Workspace, and absence of run controls.
