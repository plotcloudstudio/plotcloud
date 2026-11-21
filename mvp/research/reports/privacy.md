---
id: report-privacy
sim: privacy
published: 2026-11-21
publishedText: 21 November 2026
auditText: 20 November 2026
title: Visual privacy from the street and neighbouring buildings: sightline screening and a window risk score
type: Method and data report
summary: How the Privacy study finds which parts of each room can be seen from the street and from neighbouring buildings through the windows, and ranks each outside window by a risk score. The report gives the geometry, the sources of the privacy concepts, and flags the room-need classes, limits, weights and thresholds as SimuSite's heuristics.
image: img/home/privacy.webp
imageAlt: Floor plan shaded by how much of each room is seen from outside, with windows marked high, medium or low risk
code: mvp/js/interior/privacy.js, mvp/js/workspace-chrome.js
tests: tests/privacy-windows.test.mjs, tests/workspace-interior.cjs
keywords:
- Visual privacy
- Overlooking
- Sightlines
- Window design
- Residential design
highlights:
- Onlookers stand along the street at 1.6 m eye height every 1.5 m, along mapped roads and paths every 2 m, and at every storey of buildings within 40 m every 3 m.
- A floor spot 1.2 m up is seen when a straight line from an onlooker passes through a window between its sill and head and over all furniture and site buildings.
- Rooms need high, medium, low or no privacy from their names; high-need rooms are flagged when more than 10 % of their floor is seen, medium-need when more than 25 %.
- Window score = 100 × need weight × (0.6 × share of onlookers who see in + 0.4 × share of the room's floor seen); Medium at 15, High at 40.
- The geometry is exact for straight sightlines; the need classes, limits, weights and thresholds are heuristics without a published source.
---
# Abstract

Privacy, the selective control of access to the self, is a basic need in dwellings and in clinical and other sensitive rooms [1, 2]. Overlooking from streets and neighbouring windows is a common planning concern, and many local planning guides set separation distances between facing windows of habitable rooms [3]. SimuSite's Privacy study screens a floor plan for visual exposure. Onlookers are placed along the street, along the site's mapped roads and paths, and at each storey of nearby buildings; for every spot of the floor at 1.2 m, the study tests whether a straight line from each onlooker reaches it through a window, between the window's sill and head, and over furniture, site buildings and terrain. It reports the share of each room's floor that is seen, flags rooms whose exposure exceeds a limit for their privacy need, and gives each outside window a risk score. This report documents the geometry and the scoring. The sightline test is exact geometry; the privacy concept is well established; the need classes, exposure limits, score weights and thresholds are heuristics chosen for the study and are not taken from a standard. Curtains, frosting, reflections, planting and behaviour are not modelled.

# Body

## 1. Introduction

Altman defined privacy as a dynamic process of regulating interaction with others, and identified visual exposure as one of its channels [1]. Hall's proxemics related distance to the kinds of interaction it allows [4]. In housing design, visual privacy is protected by window placement, sill heights, screening and distances between facing windows; London's housing guidance, for example, cites a yardstick of 18–21 m between habitable rooms while warning against applying it rigidly [3]. In healthcare, privacy in examination and patient rooms is a matter of dignity and is addressed by design guidance [5]. A designer needs to know which rooms are seen, from where and through which windows.

## 2. Method

### 2.1. Onlookers

Onlookers stand on chosen sides of the plan along a line a set distance from the walls (4.0 m in the audit), every 1.5 m, at 1.6 m eye height above the ground beneath them. Where the site has mapped roads and paths near the plan, onlookers stand on the pavements of each road (half its width plus 1 m out, on both sides) and along each path, every 2 m. In buildings within 40 m, onlookers stand at each storey (every 3 m from 1.5 m) on the faces turned towards the plan, every 3 m and 0.3 m out from the face. A hypothetical building opposite can also be placed.

### 2.2. Sightlines

For each floor spot on a grid at 1.2 m above the floor (a seated or lying person's head height in the room) and each onlooker, the straight line between them is intersected with the walls of the plan. It must cross an outside wall at an opening whose sill is below and whose head is above the line where it crosses, and it must pass over every piece of furniture taller than the line, and over the site's buildings and the terrain. The study records which onlookers see each spot and through which window.

### 2.3. Room exposure and need

Each room's privacy need is set from its name: high for bedrooms, bathrooms, nurseries, examination, consulting, treatment and patient rooms and changing rooms; medium for living rooms, studies and offices; none for circulation, garages and storage; low otherwise. The user can change any room. A high-need room is flagged for screening when more than 10 % of its floor is seen, a medium-need room when more than 25 % is seen.

### 2.4. Window risk score

For each window in an outside wall, with need weight w (1, 0.7, 0.35 or 0.1 for high, medium, low and no need):

score = 100 × w × (0.6 × seen + 0.4 × floor),

where seen is the share of onlookers in front of the window who see in through it, each weighted 1 within 8 m and 8/d beyond, and floor is the share of the room's floor that they see through it. Windows are Medium risk at 15 and High at 40.

## 3. Parameters and their sources

Table 1. Settings of the Privacy study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Onlooker eye height | 1.6 m | Representative standing eye height [6] | Consistent |
| Spot height in rooms | 1.2 m | Engine choice | Assumption (seated head height) |
| Street line | User distance (4 m in audit), every 1.5 m | Engine choice | Editable input |
| Neighbours | Within 40 m, every 3 m per storey | Engine choice | Assumption; consistent in scale with separation guidance [3] |
| Sightline test | Straight lines through sill–head | Geometry | Exact |
| Room need classes | From room names | Engine choice | Heuristic; editable |
| Exposure limits | 10 % (high), 25 % (medium) | Engine choice | Flagged: no published source |
| Need weights | 1 / 0.7 / 0.35 / 0.1 | Engine choice | Flagged: no published source |
| Score weights | 0.6 seen, 0.4 floor | Engine choice | Flagged: no published source |
| Distance weighting | 1 within 8 m, 8/d beyond | Engine choice | Plausible (detail visible falls with distance [4]); not calibrated |
| Risk classes | Medium ≥ 15, High ≥ 40 | Engine choice | Flagged: no published source |

## 4. Verification and validation status

`tests/privacy-windows.test.mjs` tests the window score on constructed cases: the street sees into a bedroom; a store room behind the same glass scores lower; a window with no one in front of it scores 0; a sill at 1.8 m, above the 1.6 m eye, lowers the score; a site building or a terrain bank between the street and the window lowers it; people in a nearby building see in; mapped roads replace the street lines; windows in inside walls are not scored; and the risk classes switch at their thresholds. The sightline test can be checked by hand for any onlooker and spot. There is no validation against people's judgements of privacy.

In the end-to-end audit of 20 November 2026 on the two-storey audit block with onlookers on the street sides, 71.4 % of the floor was seen from outside and 99.4 % of the floor of private rooms; 4 rooms and 4 windows needed screening; of the outside windows, 4 were High, 4 Medium and 1 Low risk. The high exposure is expected for a block with large windows close to a street and no curtains.

## 5. Discussion

**Geometry versus perception.** Being in a line of sight is necessary for being seen but not sufficient: at distance, through reflective glass in daylight, or with the room dark, little may be seen. At night with lights on, much more is seen. The distance weighting is a rough stand-in for the loss of detail with distance [4]; a more principled approach would use the visual angle subtended by a person.

**Heuristic thresholds.** No standard defines how much of a bedroom may be seen from the street. The 10 % and 25 % limits and the score classes encode a reasonable design stance and make results comparable between options; they are exposed so that a designer can state and adjust them.

**Names.** Need classes from names fail for generic names ("Room 1"), as in the audit model, where most rooms were classed as low need; the user should check them.

## 6. Conclusion

The Privacy study's sightline geometry is exact for straight lines and openings, and it accounts for site buildings and terrain. Its need classes, limits, weights and thresholds are stated heuristics. It is suitable for comparing window and layout options and for finding which windows need screening, not for demonstrating compliance with a separation standard.

# References

1. I. Altman, The Environment and Social Behavior: Privacy, Personal Space, Territory, Crowding, Brooks/Cole, Monterey, CA, 1975.
2. A.F. Westin, Privacy and Freedom, Atheneum, New York, 1967.
3. Mayor of London, Housing Supplementary Planning Guidance, Greater London Authority, London, March 2016.
4. E.T. Hall, The Hidden Dimension, Doubleday, Garden City, NY, 1966.
5. Department of Health, Health Building Note 00-01: General design guidance for healthcare buildings, Department of Health, London, 2014.
6. A.R. Tilley, Henry Dreyfuss Associates, The Measure of Man and Woman: Human Factors in Design, revised ed., Wiley, New York, 2002.
