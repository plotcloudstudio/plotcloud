---
id: report-isovist
sim: isovist
published: 2026-11-21
publishedText: 21 November 2026
auditText: 20 November 2026
title: Isovists with height: what can be seen from a viewpoint at the eye heights of a child, a wheelchair user and an adult
type: Method and data report
summary: How the Isovist study finds the floor area seen and the blind spots within a room from a chosen viewpoint, with 720 sight lines and a similar-triangles rule for furniture lower than the eye. The report gives the geometry, the sources of the isovist concept and the eye heights, and describes the limits of a plan-based visibility check.
image: img/home/isovist.webp
imageAlt: The area visible from a viewpoint in a room, with blind spots behind furniture
code: mvp/js/interior/isovist.js, mvp/js/workspace-chrome.js
tests: tests/workspace-interior.cjs
keywords:
- Isovist
- Visibility analysis
- Natural surveillance
- Eye height
- Child supervision
highlights:
- 720 sight lines (0.5° apart) from the viewpoint; anything as tall as the eye stops a line.
- A lower object at distance d hides the floor from d to d·E/(E − h), and a target at height z from d to d·(E − z)/(E − h).
- The same view is compared at eye heights of 1.0 m (child), 1.2 m (wheelchair user) and 1.6 m (adult).
- The geometry is exact for vertical-sided obstacles; eye heights are representative values consistent with anthropometric data.
- The study tests lines of sight, not attention or lighting.
---
# Abstract

An isovist is the set of all points visible from a given point in space [1, 2]. Isovists have been used to describe spatial experience, to quantify natural surveillance in the sense of Newman's defensible space and of crime prevention through environmental design (CPTED), and to check supervision in nurseries, classrooms and care settings [3–5]. Most isovist tools work in plan and treat every obstacle as a full-height wall. SimuSite's Isovist study adds height: from a viewpoint at a chosen eye height, it casts 720 sight lines and treats furniture lower than the eye as hiding only a strip of floor behind it, computed by similar triangles. It reports the floor seen and the blind spots within the viewer's room, compares the result at the eye heights of a child, a wheelchair user and a standing adult, and checks whether marked hazards are visible. This report documents the geometry and its sources. The visibility rule is exact for obstacles with vertical sides and horizontal tops; the eye heights are representative values consistent with anthropometric references [6]. The study answers whether a line of sight exists; whether someone will look is outside its scope.

# Body

## 1. Introduction

Tandy introduced the isovist in landscape survey, and Benedikt formalised isovists and isovist fields as a description of the space visible from points of a plan, with measures such as area, perimeter and occlusivity [1, 2]. Turner and colleagues later linked isovists into visibility graphs [7]. In design for safety, a supervisor's isovist shows which parts of a room they can see from where they usually stand; CPTED guidance asks for clear sightlines across spaces and to entrances [4, 5]. Because what an adult sees over a 1.2 m shelf differs from what a child or a seated person sees, the eye height matters for these questions.

## 2. Method

### 2.1. Obstacles and the viewer's room

The plan of one level is converted to line segments with heights: walls and glazing at their full height, furniture as the outlines of their footprints at their heights. The viewer's room is found on a raster: walls of 2 m or more and glazing close it, doorways up to about 1.1 m are bridged by a morphological closing with a 0.55 m disc, and the region is grown back to the walls. If the floor still runs out to the edge of the drawing, the whole drawing counts and the result is marked as an approximation.

### 2.2. Sight lines with height

From the viewpoint at eye height E, 720 rays are cast, 0.5° apart. Along each ray, the obstacles crossed are taken in order of distance d. An obstacle of height h ≥ E stops the ray. A lower obstacle hides the floor from d to d·E/(E − h), where the sightline over its top comes back down to the floor. When looking for a target at height z (for example the head of a seated child at 0.6 m), the hidden strip ends at d·(E − z)/(E − h), and obstacles lower than z hide nothing. For example, a 0.9 m shelf 3 m away hides 9 m of floor where a seated child could be from a 1.0 m eye, but only 1.3 m from a 1.6 m eye. Imported models are handled as a height map traversed with the Amanatides–Woo grid walk [8], with the same rule.

### 2.3. Outputs

Each floor cell of the room is seen if it lies within the free length of the nearest ray and outside every hidden strip. The study reports the floor seen, the share of the room that is blind, the same share at eye heights of 1.0, 1.2 and 1.6 m, and, for each marked hazard (a point at a height), whether the straight sightline from the eye to it passes above every obstacle except the last 15 cm, which is the hazard's own object. A walk around the room shows the isovist at each point.

## 3. Parameters and their sources

Table 1. Settings of the Isovist study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Isovist | Region visible from a point | Tandy [1]; Benedikt [2] | Sourced |
| Sight lines | 720 (0.5°) | Engine choice | Numerical setting; at 10 m, adjacent rays are 9 cm apart |
| Hidden strip | d·(E − z)/(E − h) | Similar triangles | Exact for vertical-sided obstacles with flat tops |
| Child eye height | 1.0 m | Representative value | Consistent with standing eye height of children about 5–7 years old [6] |
| Wheelchair eye height | 1.2 m | Representative value | Consistent with seated eye heights of adult wheelchair users, about 1.1–1.3 m [6, 9] |
| Adult eye height | 1.6 m | Representative value | Close to the average standing eye height of adults (about 1.5 m for women, 1.6 m for men) [6] |
| Seated child target | 0.6 m | Representative value | Assumption, consistent with sitting height of young children [6] |
| Doorway bridging | ≈ 1.1 m | Engine choice | Assumption |
| Room-closing wall height | 2 m | Engine choice | Assumption |
| Hazard's own object | Last 15 cm of the sightline | Engine choice | Numerical setting |

## 4. Verification and validation status

The Workspace interior tests check that the study runs from a viewpoint, reports the seen area and the three eye heights, and that hazards are counted. The similar-triangles rule was checked by hand for this report on the example in §2.2. There is no comparison with a three-dimensional ray tracer; for the obstacles the study supports (vertical sides, flat tops), the plan computation is exact up to the ray and raster resolution.

In the end-to-end audit of 20 November 2026, a viewpoint in a 25 m² meeting room at 1.0 m eye height looking for a seated child saw 24.9 m² of floor, with 0.4 % blind at every eye height, and the one marked hazard was not visible from the viewpoint. The near-identical results at all three heights are expected in a room with little furniture.

## 5. Discussion

**What the geometry captures.** The study handles the case plan-based isovists miss: low furniture that an adult sees over and a child does not. That is the situation in nurseries, classrooms and shops, where shelf heights are a design decision. The strip rule shows directly how much difference a lower shelf or a raised viewpoint makes.

**What it does not.** Obstacles with sloped or open shapes (chairs, tables with open space under them, plants) are treated as solid blocks of their height, which overstates occlusion. The eye height of real people varies widely around the representative values. Visibility also depends on light, contrast and attention; a line of sight is necessary for supervision and natural surveillance but not sufficient [4, 5]. Isovists from one viewpoint do not describe how a person moving through the room sees it; the walk view partly addresses that.

## 6. Conclusion

The Isovist study's visibility rule is exact geometry for the obstacles it models, its eye heights are representative values consistent with anthropometric data, and its concept follows Benedikt. It is suited to checking supervision sightlines and blind spots in early layout, with the understanding that it tests lines of sight rather than what people will notice.

# References

1. C.R.V. Tandy, The isovist method of landscape survey, in: H.C. Murray (Ed.), Methods of Landscape Analysis, Landscape Research Group, London, 1967, pp. 9–10.
2. M.L. Benedikt, To take hold of space: isovists and isovist fields, Environ. Plann. B 6 (1) (1979) 47–65. [doi:10.1068/b060047](https://doi.org/10.1068/b060047)
3. O. Newman, Defensible Space: Crime Prevention Through Urban Design, Macmillan, New York, 1972.
4. T.D. Crowe, Crime Prevention Through Environmental Design, 2nd ed., Butterworth-Heinemann, Boston, 2000.
5. P. Cozens, T. Love, A review and current status of crime prevention through environmental design (CPTED), J. Plan. Lit. 30 (4) (2015) 393–412. [doi:10.1177/0885412215595440](https://doi.org/10.1177/0885412215595440)
6. A.R. Tilley, Henry Dreyfuss Associates, The Measure of Man and Woman: Human Factors in Design, revised ed., Wiley, New York, 2002.
7. A. Turner, M. Doxa, D. O'Sullivan, A. Penn, From isovists to visibility graphs: a methodology for the analysis of architectural space, Environ. Plann. B Plann. Des. 28 (1) (2001) 103–121. [doi:10.1068/b2684](https://doi.org/10.1068/b2684)
8. J. Amanatides, A. Woo, A fast voxel traversal algorithm for ray tracing, in: Proceedings of Eurographics '87, Amsterdam, 1987, pp. 3–10.
9. U.S. Access Board, ADA Accessibility Guidelines; Advisory on reach ranges and eye level of wheelchair users, in: 2010 ADA Standards for Accessible Design, U.S. Department of Justice, Washington, DC, 2010.
