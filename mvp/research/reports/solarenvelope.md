---
id: report-solarenvelope
sim: solarenvelope
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: The solar envelope as a design constraint: computing the tallest building that does not overshadow its neighbours
type: Method and data report
summary: The Solar envelope study computes, at each cell, the greatest height a building could reach without shading the surrounding buildings during protected hours. This report relates the method to Knowles's solar envelope, gives its protected periods and parameters, and flags an approximation in how solar time is set.
image: img/home/solarenvelope.webp
imageAlt: Solar envelope heights over a site, lower near neighbours to the north and higher away from them
code: mvp/js/workspace-chrome.js, mvp/js/environment/analysis.js
tests: tests/environment-analysis.cjs, tests/sun-solar-time.test.mjs
keywords:
- Solar envelope
- Solar rights
- Zoning
- Overshadowing
- Knowles
highlights:
- For each cell the envelope height is the lowest height at which a vertical line would start to shade a protected neighbour.
- Protected periods: equinoxes 9:00–15:00, winter solstice 10:00–14:00 or summer solstice 8:00–17:00, every 30 minutes.
- The method follows Knowles's solar envelope; heights are capped at 100 m.
- Protected hours are apparent solar time: local mean time at the site's meridian corrected by the equation of time (added after the audit).
- The envelope is a geometric constraint, not a planning approval.
---
# Abstract

The solar envelope, introduced by Ralph Knowles, is the largest volume that can be built on a site without casting shadow on neighbouring properties during specified hours [1, 2]. It turns the qualitative goal of solar access into a three-dimensional zoning constraint. SimuSite's Solar envelope study computes, on a grid over the site, the greatest height at each cell such that a building there would not shade any surrounding building for a set of sun positions in a protected period. This report describes the computation, the three preset protected periods, and the parameters, and records one approximation found in the audit and corrected on 21 November 2026: protected hours were taken at local mean solar time without the equation of time, which shifted the sun positions by about 7 minutes at the equinoxes. The envelope is a geometric constraint for comparison and massing studies and does not represent any jurisdiction's solar-access rules.

# Body

## 1. Introduction

Knowles and his students at the University of Southern California developed the solar envelope in the 1970s as a way to guarantee solar access in dense development while allowing as much building as possible [1]. The envelope is bounded by "shadow fences" on neighbouring properties and by a period of protected solar access; within it, any building leaves the neighbours in sun for that period [2]. The concept has informed zoning studies and is implemented in several environmental design tools.

## 2. Method

### 2.1. Sun positions

The study uses one of three protected periods: both equinoxes (20 March and 22 September) from 9:00 to 15:00; the winter solstice from 10:00 to 14:00; or the summer solstice from 8:00 to 17:00. Sun positions are taken every 30 minutes, keeping those above 1° altitude, with the same NOAA sun position as the other solar studies. Times are apparent solar time: the sun position routine is given local mean time at the site's own meridian (time zone = longitude/15), less the equation of time for the date, so that 12:00 is solar noon, when the sun crosses the meridian.

### 2.2. Envelope height

The surrounding buildings of the site (the context) are the receptors. For each grid cell and each sun direction, the study finds the height at which a vertical line at that cell would begin to intersect a ray towards the sun that reaches a receptor surface. The envelope height at the cell is the minimum over all sun directions, capped at 100 m. The environmental version of the study offers two modes: "solar rights", protecting a user-defined receptor rectangle, and "solar collection", finding the heights a receptor must reach to stay in sun; both use exact ray–triangle intersections on the original triangles.

### 2.3. Results

The study reports the mean and range of envelope heights, the share of ground where the envelope is below 10 m, and, if the design is present, the share of its facade and roof squares that stand above the envelope and therefore shade a neighbour during the protected period.

## 3. Parameters and their sources

Table 1. Inputs of the Solar envelope study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Concept | Solar envelope / shadow fences | Knowles [1, 2] | Sourced |
| Protected periods | Equinoxes 9–15 h; winter solstice 10–14 h; summer solstice 8–17 h | Common practice in solar-access studies (e.g. Knowles's protected hours) [1, 2] | Sourced in principle; no jurisdiction's rule is implied |
| Time step | 30 min | Engine design | Numerical setting |
| Solar time | Apparent solar time (longitude/15 h offset less the equation of time) | Equation of time from the NOAA sun position routine | Corrected 21 November 2026; before, the equation of time was omitted |
| Height cap | 100 m | Engine design | Numerical setting |
| Receptors | Surrounding buildings from site data | OpenStreetMap or user geometry | Input data |

## 4. Verification

`tests/environment-analysis.cjs`, re-run for this audit (all checks pass), verifies the environmental version's solar-rights height against an independent geometric answer (a sun at 45° over a 1 m receptor gives a height of 1 m two metres away, the cap behind the receptor and zero over it), and the collection envelope against exact triangle cases including overhead and behind-receiver obstacles. In the end-to-end audit of 20 November 2026, the audit site had no neighbouring buildings and the Workspace study stopped with a request to add context buildings, which is the intended behaviour, since the envelope protects neighbours' receptors. The Workspace version computes the same quantity in the modeler with its own ray code and has no separate reference test. A unit test added with the solar-time correction, `tests/sun-solar-time.test.mjs`, checks that at 12:00 apparent solar time the sun is due south on five dates through the year, within 0.05°, and that the equation of time stays between about −14.6 and +16.5 minutes.

## 5. Discussion

The envelope is only as meaningful as its receptors and period. Real solar-access regulations protect specific surfaces (windows, gardens, solar collectors) and periods that vary by jurisdiction; the presets here are generic. At the time of the audit the equation of time was omitted. It ranges from about −14 to +16 minutes over the year; on the preset dates it is about −7 minutes on 20 March, +7 minutes on 22 September and 2 minutes or less at the solstices, so the protected window was off centre around solar noon by that much, with the ends (where the sun is lowest and the envelope most restrictive) affected most. The study now uses the equation of time already computed in the sun-position routine. Like Sun hours, the method treats all geometry as opaque.

## 6. Conclusion

The Solar envelope study implements Knowles's concept directly and is useful for comparing massing options against neighbours' solar access. Its protected periods are generic and should be replaced by the rule of the jurisdiction before results are used to argue compliance.

# References

1. R.L. Knowles, Sun Rhythm Form, MIT Press, Cambridge, MA, 1981.
2. R.L. Knowles, The solar envelope: its meaning for energy and buildings, Energy Build. 35 (2003) 15–25. [doi:10.1016/S0378-7788(02)00076-2](https://doi.org/10.1016/S0378-7788(02)00076-2)
