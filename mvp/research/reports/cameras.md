---
id: report-cameras
sim: cameras
published: 2026-11-21
publishedText: 21 November 2026
auditText: 20 November 2026
title: Security camera coverage from DORI pixel densities, sightlines with height and greedy placement
type: Method and data report
summary: How the Camera coverage study finds how much floor a set of cameras sees at a required level of detail, using the DORI pixel densities of IEC 62676-4 to set each camera's range, height-aware sightlines, and greedy placement with swaps. The report gives the sources of the detail levels and the optimisation, and flags the camera specifications and prices as example values.
image: img/home/cameras.webp
imageAlt: Floor plan coloured by how many cameras see each spot, with camera positions and their fields of view
code: mvp/js/interior/cameras.js, mvp/js/workspace-chrome.js
tests: tests/workspace-interior.cjs, tests/workspace-fixes-1115.cjs
keywords:
- Video surveillance
- DORI
- IEC 62676-4
- Coverage optimisation
- Sensor placement
highlights:
- Detail levels follow IEC 62676-4 DORI: detect 25, observe 62.5, recognise 125 and identify 250 pixels per metre.
- Each camera's range is the distance at which its horizontal pixels across its field of view still give the required density at the watched height.
- Dome (100°), bullet (85°) and fisheye (360°) cameras are modelled with 2560 horizontal pixels; prices of $169.99, $199.99 and $589.99 are examples.
- Candidate positions on walls (16 directions) and the ceiling are chosen greedily with swaps, a standard approach to the maximum coverage problem.
- Lighting, lens distortion, image quality and camera models are not represented; results are geometric coverage.
---
# Abstract

Video surveillance design must decide how many cameras are needed, where they go and what detail they provide [1]. IEC 62676-4 expresses detail as pixel density on the subject and defines four levels, detection, observation, recognition and identification (DORI) [2]. SimuSite's Camera coverage study combines these with the floor plan: each camera type's range is the distance at which it still delivers the required pixels per metre at the height being watched, sightlines from the mounting height are cut by walls and hidden behind lower furniture, and candidate positions on the walls and ceiling are selected greedily, with swaps, to cover the most floor for a given number of cameras or to reach a coverage target [3, 4]. This report documents the method and its constants. The DORI densities are taken from IEC 62676-4 and the range formulas are standard pinhole and equidistant-fisheye geometry; the greedy selection is a well-understood heuristic for the maximum coverage problem. The camera specifications and prices are example values, not products. Results are geometric coverage; lighting, lens distortion, compression and installation constraints decide image quality in practice.

# Body

## 1. Introduction

The pixel density on a target, in pixels per metre at the target's distance, is the accepted measure of whether a camera can serve a purpose: seeing that someone is present, what they are doing, who a known person is, or the identity of a stranger [1, 2]. IEC 62676-4 sets these at 25, 62.5, 125 and 250 px/m [2]. The placement of cameras to cover a floor is a version of the art gallery problem, which is NP-hard in general [5]; practical methods discretise candidate positions and target points and solve a maximum coverage problem, for which the greedy algorithm achieves at least 1 − 1/e of the optimum [3, 4, 6].

## 2. Method

### 2.1. Range from pixel density

For a rectilinear camera with N horizontal pixels and horizontal field of view φ, the pixel density at slant distance s on the optical axis is N / (2 s tan(φ/2)); the maximum slant distance for a density p is s = N / (2 p tan(φ/2)). For a 360° fisheye, the study spreads the N pixels over 180° (an equidistant projection across the image circle), giving s = N / (π p). The horizontal range at the watched height z_t from a camera at height z_c is √(s² − (z_c − z_t)²). For example, a 2560-pixel dome with a 100° field at the recognition level (125 px/m) reaches s = 8.6 m; mounted at 2.7 m watching a 1.0 m target, the horizontal range is 8.4 m. The fisheye reaches s = 6.5 m.

### 2.2. Sightlines

From the camera position at its mounting height, rays are cast as in the Isovist study: walls of 2 m or more stop the view (they are taken to reach the ceiling), and lower objects hide the floor behind them down to the watched height. Rays are clipped at the floor being watched so that cameras do not count floor seen through glass or doors. The field of view limits the rays of dome and bullet cameras.

### 2.3. Floor and candidates

The floor to watch is everything inside the walls, less furniture, with doorways up to about 1.1 m bridged. Candidate positions are points 0.15–0.35 m inside the walls about every 0.8 m, for dome and bullet cameras in 16 directions each, and a 1.25 m grid on the ceiling for fisheyes. Each candidate's coverage is listed on a grid of watch points every 25 cm.

### 2.4. Selection

In budget mode, the study adds cameras one at a time, each time picking the candidate that covers the most uncovered watch points, and after each addition tries single swaps until no swap covers more [3, 4]. In target mode, it adds cameras until the target share is reached, then tops up for slivers the coarse watch points missed. Coverage is reported on the floor cells, with the number of cameras seeing each spot, the coverage obtained for each number of cameras, and the cost at the example prices.

## 3. Parameters and their sources

Table 1. Settings of the Camera coverage study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Detect, observe, recognise, identify | 25, 62.5, 125, 250 px/m | IEC 62676-4 [2] | Sourced |
| Rectilinear range | N / (2 p tan(φ/2)) | Pinhole camera geometry [1] | Sourced (on axis; less at the image edge) |
| Fisheye range | N / (π p) | Equidistant projection [7] | Approximation; real fisheye lenses vary |
| Horizontal pixels | 2560 for all types | Engine choice | Example value (a common 4-megapixel sensor width) |
| Fields of view | Dome 100°, bullet 85°, fisheye 360° | Engine choice | Example values |
| Prices | $169.99, $199.99, $589.99 | Engine choice, labelled example prices | Flagged: not linked to products |
| Mounting height | 2.7 m default | Engine choice | Editable input |
| Watched height | 1.0 m default | Engine choice | Editable input; face height is usually 1.5–1.7 m |
| Walls stopping the view | ≥ 2 m | Engine choice | Assumption |
| Candidates | Wall every 0.8 m × 16 directions; ceiling 1.25 m grid | Engine choice | Numerical setting |
| Selection | Greedy with swaps | Maximum coverage heuristics [3, 4, 6] | Sourced method |

## 4. Verification and validation status

The Workspace interior tests check that the study places cameras, reports coverage and cost, and responds to the detail level and camera types. The range formulas were checked by hand for this report (§2.1). No comparison with a commercial camera design tool or with measured images has been made.

In the end-to-end audit of 20 November 2026 on level 1 of the audit block (230.9 m² of floor), four cameras at the recognition level, mounted at 2.7 m and watching at 1.0 m, covered 62.7 % of the floor; the study chose four fisheyes, with 12.8 m² seen by two or more, at an example cost of $2,359.96 (4 × $589.99). The partial coverage is expected: the block has many small rooms, and each room needs its own camera.

## 5. Discussion

**Range is the optimistic case.** The rectilinear formula gives the density on the optical axis; at the edges of a wide field of view, distances are longer and densities lower. Lens distortion, especially in fisheyes, makes density vary across the image [7]. Low light, backlighting, motion blur and compression reduce effective detail [1]. Range should therefore be read as an upper bound, and identification in particular should be confirmed with the chosen camera.

**Watched height.** The default of 1.0 m suits detecting and observing people, including children; recognition and identification depend on faces, which are usually at 1.5–1.7 m. A higher watched height lengthens the horizontal range for a given slant distance.

**Optimisation.** Greedy selection with swaps finds good, not necessarily optimal, sets. For the small instances of a single floor, it is close to optimal in practice [4], and the coverage-against-cameras curve it produces is useful for deciding how many cameras are worth buying. Budget mode maximises coverage for a number of cameras, not coverage per dollar.

**Privacy and law.** Coverage is only one consideration. Data-protection rules and privacy expectations constrain where cameras may look; the study does not assess these.

## 6. Conclusion

The Camera coverage study uses the IEC 62676-4 DORI densities, standard range geometry and an established coverage heuristic. Its camera specifications and prices are examples that should be replaced by the products under consideration. Results show geometric coverage at a stated detail level and are suitable for comparing layouts and estimating camera counts in early design.

# References

1. H. Kruegle, CCTV Surveillance: Video Practices and Technology, 2nd ed., Butterworth-Heinemann, Burlington, MA, 2007.
2. IEC 62676-4:2014, Video surveillance systems for use in security applications — Part 4: Application guidelines, International Electrotechnical Commission, Geneva, 2014.
3. R. Church, C. ReVelle, The maximal covering location problem, Pap. Reg. Sci. Assoc. 32 (1) (1974) 101–118. [doi:10.1007/BF01942293](https://doi.org/10.1007/BF01942293)
4. A.T. Murray, K. Kim, J.W. Davis, R. Machiraju, R. Parent, Coverage optimization to support security monitoring, Comput. Environ. Urban Syst. 31 (2) (2007) 133–147.
5. J. O'Rourke, Art Gallery Theorems and Algorithms, Oxford University Press, New York, 1987.
6. G.L. Nemhauser, L.A. Wolsey, M.L. Fisher, An analysis of approximations for maximizing submodular set functions—I, Math. Program. 14 (1978) 265–294. [doi:10.1007/BF01588971](https://doi.org/10.1007/BF01588971)
7. J. Kannala, S.S. Brandt, A generic camera model and calibration method for conventional, wide-angle, and fish-eye lenses, IEEE Trans. Pattern Anal. Mach. Intell. 28 (8) (2006) 1335–1340. [doi:10.1109/TPAMI.2006.153](https://doi.org/10.1109/TPAMI.2006.153)
