---
id: report-skyview
sim: skyview
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Sky exposure and sky view factor in urban design: Ladybug's View Percent method on ground and facades
type: Method and data report
summary: The Sky exposure study computes the percentage of sky seen from ground cells and building faces with Ladybug's View Percent (Sky View) method. This report explains the two definitions in use, the geometry and constants, and the check that reproduces ladybug-core on every point.
image: img/home/skyview.webp
imageAlt: Sky view on the ground around buildings, darker where buildings hide more of the sky
code: mvp/js/workspace-chrome.js, emb/modeler.html, mvp/js/environment/analysis.js
tests: tests/validation/lb_sunhours.py, tests/environment-analysis.cjs
keywords:
- Sky view factor
- Sky exposure
- Urban canyon
- Ladybug
- Tregenza patches
highlights:
- Sky view is computed with Ladybug's View Percent (Sky View) method on 145, 577 or 1,297 sky patches.
- Each clear patch counts by the cosine of its angle to the surface normal (a cosine-weighted, horizontal-projected view).
- Against ladybug-core every ground point and facade square agrees within 4 × 10⁻⁶ percentage points.
- Open ground reads slightly below 100 % at low resolutions because of how patches are weighted.
- All geometry is opaque; trees and glass block the sky.
---
# Abstract

The sky view factor (SVF), the fraction of the radiation leaving a surface that reaches the sky, is a central geometric variable in urban climatology: it governs night-time long-wave cooling, diffuse daylight and the urban heat island [1, 2]. SimuSite's Sky exposure study computes it on ground cells and on the faces of the building by casting a ray from each sample to every patch of a subdivided sky dome and summing the clear patches with a cosine weight, following Ladybug's View Percent component in its "Sky View" mode [3]. The patch sets are the 145 Tregenza patches [4] and Reinhart's 577 and 1,297 subdivisions [5]. This report states the definitions, lists the parameters, and summarises a step-for-step comparison with ladybug-core at all three resolutions, in which the largest difference is 4 × 10⁻⁶ percentage points on the ground and 10⁻¹² on facades. An earlier environmental version of the study also reports equal-solid-angle "sky exposure" and a dated solar mask; the distinction between the measures is explained.

# Body

## 1. Introduction

Two quantities are commonly called "sky view". The *sky exposure* (sometimes "sky visibility") is the fraction of the hemisphere's solid angle that is unobstructed, with every direction weighted equally. The *sky view factor* proper, as used in heat-transfer and urban climatology, weights each direction by the cosine of its angle to the surface normal, i.e. by its projection onto the surface; it is the fraction of diffuse radiation leaving a horizontal surface that reaches the sky [1, 2]. For a point at the bottom of a symmetric canyon of height-to-width ratio H/W, the cosine-weighted SVF is cos(arctan(2H/W)) [2]. The two definitions diverge strongly near the horizon: low obstructions remove much exposure but little view factor. Designers need to know which one a tool reports.

## 2. Method

From each sample (ground cell centres raised 0.1 m along the normal; facade and roof squares), a ray is cast towards the centre of each sky patch. The patch set depends on the chosen resolution: 145 patches (Tregenza [4]), 577 or 1,297 patches (Reinhart's subdivisions [5]), identical to the patches of Ladybug's `view_sphere` [3]. A clear patch within 90° of the surface normal contributes twice the cosine of its angle to the normal times its area weight; the sum is divided by the patch count and reported in per cent. This is exactly Ladybug's View Percent in Sky View mode [3]. Because the patches are finite and weighted by area, an unobstructed horizontal point reads slightly below 100 % at low resolution (Section 4) and an unobstructed vertical wall about 50 %.

The environmental version of the study (Climate & passive design group) also reports equal-solid-angle sky exposure, the horizontally projected sky view with cosine weighting, and a solar mask for a chosen date, using exact ray–triangle intersections through a bounding volume hierarchy with 96, 192 or 384 hemisphere rays.

## 3. Parameters and their sources

Table 1. Inputs of the Sky exposure study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Sky patches | 145 / 577 / 1,297 | Tregenza [4]; Reinhart [5]; as in Ladybug [3] | Sourced, verified |
| Weighting | 2 cos θ × area weight / patch count | Ladybug View Percent, Sky View [3] | Sourced, verified |
| Ground offset | 0.1 m | Ladybug default offset [3] | Sourced |
| Geometry | Opaque triangles, model and surroundings | — | Modelling assumption |
| Hemisphere rays (environmental version) | 96, 192, 384 | Engine design | Numerical setting |

No unsourced constants were found.

## 4. Verification

`tests/validation/lb_sunhours.py` computes LB View Percent (Sky View) with ladybug-core on the same scene and points (289 ground points, 203 surface squares) and compares point by point.

Table 2. Sky view, SimuSite against ladybug-core.

| Resolution | Patches | Mean, ground (SimuSite / Ladybug) | Worst ground difference | Mean, surfaces | Worst surface difference |
|---|---|---|---|---|---|
| 1 | 145 | 92.7377 / 92.7377 % | 3.8 × 10⁻⁶ pts | 49.8483 % | 1.1 × 10⁻¹² pts |
| 2 | 577 | 95.4716 / 95.4716 % | 3.8 × 10⁻⁶ pts | 49.2222 % | 1.1 × 10⁻¹² pts |
| 3 | 1,297 | 96.3462 / 96.3462 % | 3.8 × 10⁻⁶ pts | 49.0724 % | 1.1 × 10⁻¹² pts |

The patch sets were also checked to be identical to Ladybug's `view_sphere`. The study ran without error in the end-to-end audit of 20 November 2026.

## 5. Discussion

The implementation reproduces Ladybug exactly, so its accuracy is that of the discretised method: at 145 patches an open point reads a few per cent below 100 %, and narrow gaps between buildings smaller than a patch may be missed; higher resolutions converge (Table 2). Users comparing with field measurements from fisheye photographs should note that photographic SVF is usually computed with an equal-area or cosine-weighted projection of a 180° image, and that trees, which the model treats as opaque or omits, have a large effect in the field [1]. SVF alone does not predict temperature; it is one input to the radiation balance used by the Outdoor thermal comfort and Solar radiation studies.

## 6. Conclusion

Sky exposure in SimuSite is a verified, exact reproduction of Ladybug's Sky View. Results should be reported with the resolution used and read as cosine-weighted sky view, not equal-angle sky exposure.

# References

1. T.R. Oke, Canyon geometry and the nocturnal urban heat island: comparison of scale model and field observations, J. Climatol. 1 (1981) 237–254. [doi:10.1002/joc.3370010304](https://doi.org/10.1002/joc.3370010304)
2. G.T. Johnson, I.D. Watson, The determination of view-factors in urban canyons, J. Clim. Appl. Meteorol. 23 (1984) 329–335.
3. M.S. Roudsari, M. Pak, Ladybug: a parametric environmental plugin for Grasshopper to help designers create an environmentally-conscious design, in: Proc. Building Simulation 2013, IBPSA, Chambéry, 2013, pp. 3128–3135.
4. P.R. Tregenza, Subdivision of the sky hemisphere for luminance measurements, Light. Res. Technol. 19 (1987) 13–14.
5. C.F. Reinhart, Tutorial on the use of Daysim simulations for sustainable design, Institute for Research in Construction, National Research Council Canada, Ottawa, 2006.
