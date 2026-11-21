---
id: report-stormwater
sim: stormwater
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Stormwater runoff and ponding on a site grid: runoff coefficients, D8 routing and fill-and-spill depressions
type: Method and data report
summary: How the Stormwater study estimates where the rain of one design storm runs over the ground and where it can collect, with rational-method runoff coefficients, priority-flood depression filling and D8 flow routing. The report gives the sources of each step, reports a test that shows ponded volumes are underestimated when a hollow drains through more than one flow branch, and explains why the storm is not tied to local rainfall statistics.
image: img/home/stormwater.webp
imageAlt: Flow paths and ponds on a sloping site after a design storm
code: mvp/js/stormwater-grid.js, mvp/js/workspace-chrome.js
tests: tests/workspace-surfaces.cjs, tests/workspace-motion2.cjs
keywords:
- Stormwater
- Rational method
- Runoff coefficient
- D8 flow routing
- Depression filling
highlights:
- Runoff is rain × a runoff coefficient per cell: planted 0.25, mixed 0.5, paved 0.85, drawn paving 0.9, roofs 0.95, green roofs 0.5.
- Depressions are found with the priority-flood algorithm; water is routed downhill with the D8 single-direction method.
- The roof peak flow uses the rational method Q = C i A.
- An audit test found that a hollow's inflow is taken as the largest single flow branch inside it, so ponded volumes can be several times too small.
- The 25, 50 and 100 mm one-hour storms are user choices, not local intensity–duration–frequency data.
---
# Abstract

Site design must show where surface water will run and where it will collect, both to avoid flooding buildings and to place swales, rain gardens and inlets [1, 2]. Detailed drainage design uses hydrologic and hydraulic models such as SWMM with local rainfall statistics [3, 4]. SimuSite's Stormwater study is a screening on the site grid: one design storm falls in one hour, each cell sheds rain times a runoff coefficient, roofs shed their water to the ground beside them, water is routed downhill with the D8 method on a depression-filled surface, and hollows fill up to their spill level with the water that reaches them [5–7]. It reports runoff volume, flow paths, ponded area and depth, water held in hollows, and the rational-method peak flow from the roofs [1, 8]. This report documents the steps and constants. The runoff coefficients lie within the ranges of standard tables, and the flow routing uses published algorithms. A test written for this audit shows one defect: the volume reaching a hollow is taken as the largest flow accumulation inside it, which counts only one branch of the flow network on the filled surface; in a test bowl it gave 7 % of the correct volume. The storm depths are not linked to local rainfall statistics.

# Body

## 1. Introduction

The rational method, introduced by Kuichling in 1889, estimates the peak flow from a small catchment as Q = C i A, where C is a runoff coefficient that lumps infiltration and storage losses, i the rainfall intensity for a duration equal to the time of concentration, and A the area [1, 8]. It remains in use for small urban catchments [2]. For the spatial pattern of flow, terrain analysis routes water over a digital elevation model. The D8 method sends all flow from a cell to its steepest downslope neighbour [5]. Depressions, real or artefacts, must first be handled; the priority-flood algorithm fills them optimally from the edges inward [6, 7], and the filled minus original surface gives the depth a depression can hold before it spills.

## 2. Method

### 2.1. Grid, cover and rain

The study samples the terrain, buildings and site cover on a regular grid (1.5 m in the audit). Building cells are raised 200 m so that roof water runs to the cells beside them. Each open cell receives the ground coefficient of the chosen site cover (mostly planted 0.25, mixed 0.5, mostly paved 0.85); cells with mapped or drawn cover use planting 0.25, paving 0.9 and water 1. Design roofs use 0.95, or 0.5 if a green-roof layer is present; surrounding buildings use 0.95. The rain depth P is 25, 50 or 100 mm, falling in 1 hour. Runoff per cell is P × C × cell area.

### 2.2. Depression filling and flow direction

A priority-flood from the grid edge and from mapped water bodies computes the spill level F of every cell, with an increment of 10⁻⁵ m per step across flats so that they drain [6, 7]. Each cell sends its flow to the neighbour with the steepest descent of F among its eight neighbours (D8) [5]. Water bodies are outlets: what reaches them is counted and removed.

### 2.3. Accumulation and ponding

Runoff is accumulated downstream in reverse flood order. Connected cells where F − z ≥ 0.01 m form hollows. Each hollow's capacity is the sum of (F − z) × area. Its inflow is taken as the largest accumulated flow of any of its cells. If the inflow is at least the capacity, the hollow fills to its spill level; otherwise the water level is found by bisection so that the stored volume equals the inflow ("fill and spill").

### 2.4. Outputs

The study reports runoff and rain volumes, the share reaching site water, the area ponded 2 cm or deeper, the deepest ponding, the volume held in hollows, the design roof area and coefficient, the rational-method roof peak flow Q = C i A (with i = P per hour), and the share of facade squares with water against them or on a flow path. Flow paths are drawn from channel heads carrying at least 1.2 % of the largest accumulation.

## 3. Parameters and their sources

Table 1. Inputs and constants of the Stormwater study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Runoff coefficient, planted | 0.25 | Rational-method tables: lawns 0.05–0.35 [2, 8] | Within range |
| Mixed cover | 0.5 | Rational-method tables [2, 8] | Within range for residential areas |
| Paved (cover / drawn) | 0.85 / 0.9 | Asphalt and concrete 0.70–0.95 [2, 8] | Within range |
| Roofs | 0.95 | Roofs 0.75–0.95 [2, 8] | Upper end, conservative |
| Green roof | 0.5 | FLL guideline values for extensive roofs vary with build-up and slope [9] | Plausible, not tied to a build-up |
| Water | 1 | Definition | — |
| Design storms | 25 / 50 / 100 mm in 1 h | User choice | Flagged: not linked to local IDF data such as NOAA Atlas 14 [10] |
| Flat increment | 10⁻⁵ m | Priority-flood with ε [7] | Sourced method |
| Flow routing | D8 | O'Callaghan and Mark [5] | Sourced method |
| Hollow threshold | 0.01 m | Engine choice | Numerical setting |
| Ponding shown | ≥ 0.02 m | Engine choice | Display setting |
| Hollow inflow | Largest accumulation in the hollow | Engine choice | Flagged: defect, see §4 |

## 4. Verification and validation status

The Workspace tests check that the study runs and that its views, animation and flow lines appear; there is no unit test of `stormwater-grid.js`. For this report we wrote one. On a 21 × 21 grid of 1 m cells with a conical bowl 5 m in radius and 0.5 m deep, surrounded by ground sloping gently away to the edges, every runoff coefficient set to 1:

- Mass balance holds exactly: runoff equals rain (4.41, 44.1 and 176.4 m³ for 10, 100 and 400 mm).
- The hollow's capacity is 13.4 m³, against 13.1 m³ for the continuous cone; the difference is the discretisation.
- The rain falling inside the bowl is 0.69 m³ at 10 mm (69 cells), and the sum of accumulated flow leaving the bowl's cells is 0.69 m³, as it should be. But the hollow's inflow used by the engine is 0.05 m³ at 10 mm, 0.50 m³ at 100 mm and 2.0 m³ at 400 mm. At 400 mm, 27.6 m³ falls in the bowl, so it should fill to spilling, yet the engine reports 2.0 m³ held and the bowl not full.

The cause is that the priority-flood seeds the flat from every rim cell, so the filled surface inside a hollow drains through many branches; taking the maximum accumulation of any one cell counts a single branch. The correct inflow is the sum of the accumulation of the hollow's cells whose flow leaves the hollow. This defect underestimates ponding and should be fixed before ponding volumes are relied on. Flow paths and runoff totals are not affected.

In the end-to-end audit of 20 November 2026 on a flat site with a two-storey block, a 50 mm storm and mixed cover gave 186 m³ of runoff from 360 m³ of rain, no ponding (as expected on flat ground with drainage to the edges), 257 m² of roof and a roof peak flow of 3.4 L/s (0.95 × 50 mm/h × 257 m² / 3600, checked by hand).

## 5. Discussion

**Storm depth.** A one-hour depth of 25 mm is a moderate storm in many temperate climates, while 100 mm in one hour is extreme almost everywhere outside the tropics. Designers should choose a depth from local intensity–duration–frequency data for the return period and duration of interest; in the United States these are published in NOAA Atlas 14 [10]. Linking the study to such data, or at least showing the return period of the chosen depth, would make the result easier to interpret.

**Runoff coefficients.** The rational method's C values are lumped and depend on soil, slope, antecedent wetness and storm size; tables give ranges, not single values [2, 8]. The values used are reasonable defaults. Infiltration over time, which SWMM and the NRCS curve number method represent, is not modelled [3, 11].

**Routing.** D8 concentrates flow into single lines, which suits channels but exaggerates concentration on planar slopes; multiple-flow-direction methods spread flow more realistically [5]. Without pipes, inlets, kerbs or flow over time, the study shows where water would go if the site had no drainage system, which is the right question for early grading but not a drainage design.

## 6. Conclusion

The Stormwater study's runoff coefficients are within published ranges, its mass balance is exact, and its routing uses standard algorithms. Ponded volumes are underestimated where a hollow drains through more than one flow branch, which our test shows can be a factor of ten or more; this should be corrected. Storm depths should be chosen from local rainfall statistics.

# References

1. E. Kuichling, The relation between the rainfall and the discharge of sewers in populous districts, Trans. Am. Soc. Civ. Eng. 20 (1889) 1–56.
2. ASCE, WEF, Design and Construction of Urban Stormwater Management Systems, ASCE Manuals and Reports of Engineering Practice No. 77, WEF Manual of Practice FD-20, ASCE, New York, 1992.
3. L.A. Rossman, Storm Water Management Model User's Manual, Version 5.1, EPA/600/R-14/413b, U.S. Environmental Protection Agency, Cincinnati, 2015.
4. W.C. Huber, R.E. Dickinson, Storm Water Management Model, Version 4: User's Manual, EPA/600/3-88/001a, U.S. Environmental Protection Agency, Athens, GA, 1988.
5. J.F. O'Callaghan, D.M. Mark, The extraction of drainage networks from digital elevation data, Comput. Vis. Graph. Image Process. 28 (1984) 323–344. [doi:10.1016/S0734-189X(84)80011-0](https://doi.org/10.1016/S0734-189X(84)80011-0)
6. L. Wang, H. Liu, An efficient method for identifying and filling surface depressions in digital elevation models for hydrologic analysis and modelling, Int. J. Geogr. Inf. Sci. 20 (2) (2006) 193–213. [doi:10.1080/13658810500433453](https://doi.org/10.1080/13658810500433453)
7. R. Barnes, C. Lehman, D. Mulla, Priority-flood: an optimal depression-filling and watershed-labeling algorithm for digital elevation models, Comput. Geosci. 62 (2014) 117–127. [doi:10.1016/j.cageo.2013.04.024](https://doi.org/10.1016/j.cageo.2013.04.024)
8. V.T. Chow, D.R. Maidment, L.W. Mays, Applied Hydrology, McGraw-Hill, New York, 1988.
9. FLL, Green Roof Guidelines: Guidelines for the Planning, Construction and Maintenance of Green Roofs, Forschungsgesellschaft Landschaftsentwicklung Landschaftsbau, Bonn, 2018.
10. S. Perica, D. Martin, S. Pavlovic, I. Roy, M. St. Laurent, C. Trypaluk, D. Unruh, M. Yekta, G. Bonnin, NOAA Atlas 14: Precipitation-Frequency Atlas of the United States, Volume 8, Version 2.0: Midwestern States, NOAA National Weather Service, Silver Spring, 2013.
11. USDA Natural Resources Conservation Service, National Engineering Handbook, Part 630 Hydrology, chapter 10, Estimation of direct runoff from storm rainfall, USDA NRCS, Washington, DC, 2004.
