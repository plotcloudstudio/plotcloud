---
id: report-views
sim: views
published: 2026-11-21
publishedText: 21 November 2026
auditText: 20 November 2026
title: Screening quality views to the outdoors against the LEED v4.1 criteria with horizontal sight lines
type: Method and data report
summary: How the Quality views study checks, for spots over the occupied floor, whether there is a line of sight to the outdoors through vision glazing and which of the four LEED v4.1 view criteria are met. The report gives the sources of each criterion and the seated eye height, and flags the view-factor thresholds as needing confirmation. The audit also found that movement outside was assumed by default; this was changed so that the user declares it.
image: img/home/views.webp
imageAlt: Floor plan coloured where occupants have quality views to the outdoors
code: mvp/js/interior/views.js, mvp/js/workspace-chrome.js
tests: tests/workspace-interior.cjs
keywords:
- Views to the outdoors
- LEED Quality Views
- View factor
- Occupant wellbeing
- Visibility analysis
highlights:
- Spots every 0.08–1 m over the occupied floor cast 180–1,440 horizontal sight lines at a seated eye height of 1.07 m (LEED's 42 in).
- Criteria follow LEED v4.1 Quality Views: line of sight for 75 % of the floor, and 2 of 4 view qualities for 75 %.
- Distant objects count from 7.5 m past the glass (LEED's 25 ft); near views are within 3 × the window head height.
- The view-factor thresholds (0.07, 0.2, 0.4, 0.75 of a 90° cone) are SimuSite's proxy for the Heschong Mahone scale and have not been checked against it.
- "Movement" outside counts only when the user declares it (until 21 November 2026 it was assumed by default, which made criterion 2 nearly always met).
---
# Abstract

Access to views of the outdoors is associated with occupant satisfaction, wellbeing and, in some studies, performance [1–3]. Rating systems reward it: LEED v4.1 Quality Views asks for a direct line of sight to the outdoors from 75 % of regularly occupied floor area, and for 75 % to have views with at least two of four qualities [4]. SimuSite's Quality views study screens a floor plan against these criteria. From a grid of spots over the occupied floor, it casts horizontal sight lines at seated eye height; walls and tall furniture stop them, and glass lets them pass above its sill. For each spot it records whether a view out exists and evaluates the four criteria: views in directions at least 90° apart; at least two of nature or sky, movement, and objects at least 7.5 m away; a window within three times its head height; and a view factor of 3 or more. This report documents the method and its constants. The criteria, distances and eye height follow LEED v4.1 [4]; the view factor is computed from a geometric proxy whose thresholds have not been checked against the Heschong Mahone definition [2], and "movement" is assumed present unless the user switches it off. The study is a design screening, not a LEED submission.

# Body

## 1. Introduction

Research on office workers by the Heschong Mahone Group found that the size and content of the view from a desk were associated with better performance on some tasks and fewer reported health symptoms, and introduced a view factor scale from 1 to 5 describing view size and quality [2]. Other studies associate views of nature with recovery and lower stress [1, 3]. LEED v4.1 Quality Views turned these findings into four criteria that a floor area can meet, with a line of sight drawn at 42 inches (1.07 m), a seated eye height [4]. The European daylight standard EN 17037 assesses views separately with criteria on horizontal sight angle, outside distance and layers of the view [5].

## 2. Method

### 2.1. Occupied floor and spots

The plan of one level is rasterised as in the Space syntax and Isovist studies. The occupied floor is everything inside the walls minus furniture; rooms the user excludes (corridors, storage) are not counted. Spots are placed on a grid whose spacing (0.08–1 m) and ray count (180–1,440) are chosen by detail level and the time budget.

### 2.2. Sight lines

From each spot, horizontal rays at the eye height (1.07 m seated by default, or 1.6 m standing) run through the plan. Walls of 2 m or more stop a ray, as does anything as tall as the eye. Glazing lets a ray through if its sill is below the eye. When a ray crosses a pane into the outdoors, it records the distance to the pane, how far the view runs beyond it, and whether the sky shows above whatever stands outside.

### 2.3. Criteria at a spot

- **Line of sight**: at least one ray reaches the outdoors.
- **Criterion 1**: views out in at least two directions 90° or more apart.
- **Criterion 2**: at least two of: sky or nature (sky seen, or nature declared present by the user), movement (counted only when the user declares a street or path with people in view), and objects at least 7.5 m beyond the glass (a ray runs at least that far outside).
- **Criterion 3**: a view through glazing no farther than three times the window head height (2.4 m by default, so 7.2 m).
- **Criterion 4**: a view factor of 3 or more. For each ray through glass, the vertical angle subtended by the window from sill to head as seen from the spot, each part capped at 45°, is divided by 90°. The best 90° horizontal sector is found, and its mean fraction F is mapped to a view factor of 1 to 5 with thresholds 0.07, 0.2, 0.4 and 0.75.

A spot has a quality view if it has a line of sight and meets at least two criteria. The floor meets the credit if both the line of sight and quality views reach 75 % of the counted floor area; 90 % for both is reported as exemplary performance [4].

## 3. Parameters and their sources

Table 1. Settings of the Quality views study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Eye height | 1.07 m seated (1.6 m standing) | LEED v4.1: 42 in [4] | Sourced |
| Thresholds | 75 % line of sight and 75 % quality; 90 % exemplary | LEED v4.1 [4] | Sourced |
| Two of four criteria | As in §2.3 | LEED v4.1 [4] | Sourced |
| Far objects | 7.5 m beyond the glass | LEED v4.1: 25 ft (7.6 m) [4] | Sourced (rounded) |
| Near window | 3 × head height | LEED v4.1 [4] | Sourced |
| Head height | 2.4 m default | Engine choice | Editable input |
| Blocking walls | ≥ 2 m | Engine choice | Assumption; LEED counts partitions at their height |
| View factor proxy | Vertical window angle in the best 90° sector | Engine choice | Flagged: proxy, not the HMG procedure |
| View factor thresholds | 0.07, 0.2, 0.4, 0.75 | Engine choice | Flagged: not checked against HMG 2003 [2] |
| Movement | Off unless declared | Engine choice | Changed 21 November 2026 from assumed present |
| Nature | Off unless declared; sky detected | Engine choice | Reasonable |

## 4. Verification and validation status

The Workspace interior tests check that the study runs, reports the criteria and switches between its views. The criteria logic was checked against the LEED v4.1 credit text for this report [4]. The view-factor proxy has not been compared with view factors assessed with the Heschong Mahone method on real rooms.

In the end-to-end audit of 20 November 2026 on level 1 of the audit block (237 m² of occupied floor, spots every 50 cm, 360 rays each), 86 % of the floor had a line of sight out and 84 % had quality views, so the credit thresholds were met. By criterion: directions 90° apart 25 %, two view types 86 %, within three head heights 84 %, view factor 3 or more 15 %. Criterion 2 equalled the line-of-sight share because movement was assumed and every view out of this block reaches beyond 7.5 m or shows the sky. With movement off by default, the same case gives 2 % for criterion 2 (sky and a far view seldom fall in the same view at seated eye height on this site), 31 % of the floor with quality views, and the credit not met; the other three criteria are unchanged. Declaring movement brings back the earlier figures. The difference shows how much this one declaration decides the result.

## 5. Discussion

**Movement default.** With movement assumed, any view that runs beyond 7.5 m or shows the sky meets criterion 2. Most views out of a building do, so criterion 2 was nearly always met. The default is now off, the conservative choice: the user declares movement where a street or path with people is actually in view, and the method text states it as an assumption.

**View factor.** Heschong Mahone's view factor combines the size of the view, judged from the angular extent of the window and what is seen through it, with its content [2]. The proxy measures only angular size through the window, with thresholds that are SimuSite's choice. It is a reasonable indicator of how much window a spot sees but should not be reported as an HMG view factor without calibration.

**Plan-based method.** Sight lines are horizontal at one height. A view that is blocked at 1.07 m by a desk screen but open above it, or a view down to a street from an upper floor, is not represented. Glass is treated as transparent; frits, tints or blinds are not modelled. The study also ignores whether the view is pleasant; EN 17037 and LEED both rate content only coarsely [4, 5].

## 6. Conclusion

The Quality views study follows the LEED v4.1 criteria, distances and eye height. Two elements need attention before results are used in a submission: the view-factor proxy and its thresholds, and the user's declarations of nature and movement outside, which the geometry cannot check. As a screening of how plan depth, partition layout and window placement affect view access, the study is appropriate.

# References

1. R. Kaplan, The nature of the view from home: psychological benefits, Environ. Behav. 33 (4) (2001) 507–542. [doi:10.1177/00139160121973115](https://doi.org/10.1177/00139160121973115)
2. Heschong Mahone Group, Windows and Offices: A Study of Office Worker Performance and the Indoor Environment, Technical Report P500-03-082-A-9, California Energy Commission, Sacramento, 2003.
3. R.S. Ulrich, View through a window may influence recovery from surgery, Science 224 (4647) (1984) 420–421. [doi:10.1126/science.6143402](https://doi.org/10.1126/science.6143402)
4. U.S. Green Building Council, LEED v4.1 Building Design and Construction, EQ Credit: Quality Views, USGBC, Washington, DC, 2019 (updated 2021).
5. CEN, EN 17037:2018, Daylight in buildings, European Committee for Standardization, Brussels, 2018.
