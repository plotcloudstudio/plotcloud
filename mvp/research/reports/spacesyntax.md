---
id: report-spacesyntax
sim: spacesyntax
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Visibility graph analysis of floor plans: integration, connectivity and intelligibility after Turner and DepthmapX
type: Method and data report
summary: How the Space syntax study builds a visibility graph over each floor and derives visual integration, local integration (R3), connectivity and intelligibility, following Turner, Doxa, O'Sullivan and Penn (2001) and the conventions of DepthmapX. The report gives the formulas and their sources, describes the resolution settings, and explains what configurational measures can and cannot predict.
image: img/home/spacesyntax.webp
imageAlt: Floor plan coloured from blue (segregated) to red (integrated) by visual integration
code: mvp/js/interior/spacesyntax.js, mvp/js/workspace-chrome.js
tests: tests/workspace-motion2.cjs, tests/workspace-p0.cjs, tests/workspace-interior.cjs
keywords:
- Space syntax
- Visibility graph analysis
- Visual integration
- Intelligibility
- DepthmapX
highlights:
- Nodes on a 0.2–1.5 m grid are joined where they see each other at eye height (1.6 m) or knee height (0.5 m).
- Integration [HH] is the reciprocal of relative asymmetry normalised by the Hillier and Hanson diamond D-value; R3 uses depths up to three.
- Intelligibility is the R² of connectivity against global integration.
- The formulas match the published definitions and the DepthmapX conventions; there is no numerical comparison with DepthmapX yet.
- Configurational measures correlate with movement and wayfinding in many studies but do not predict occupant numbers.
---
# Abstract

Space syntax describes the configuration of buildings and cities by the relations of each space to all others, and has repeatedly been found to correlate with pedestrian movement, wayfinding and co-presence [1–4]. Visibility graph analysis (VGA), introduced by Turner and colleagues, applies the method to a fine grid of points in a plan, joining points that are mutually visible [2]. SimuSite's Space syntax study performs VGA on each floor of the building model: a grid of nodes inside the walls, joined where a straight sightline at eye or knee height is unobstructed, followed by a breadth-first search from every node. It reports visual integration [HH] (Hillier and Hanson's normalisation), local integration within three steps (R3), connectivity and intelligibility, and runs agents that walk towards what they see, after Turner and Penn [5]. This report documents the graph construction and formulas and their sources. The integration and D-value formulas are those published by Hillier and Hanson and used in DepthmapX [1, 6]; the implementation has not yet been compared numerically with DepthmapX on a reference plan. Results describe the spatial structure of a plan; their relation to use is statistical and depends on programme and occupants.

# Body

## 1. Introduction

In The Social Logic of Space, Hillier and Hanson represented buildings as graphs of convex spaces and measured each space's mean depth from all others, normalised so that buildings of different size can be compared [1]. Benedikt's isovists, the region visible from a point, provided a complementary description of space as experienced [7]. Turner and colleagues combined the two: in a visibility graph, every point of a fine grid is a node, two nodes are joined if each is in the other's isovist, and the graph measures of space syntax are computed on it [2]. VGA avoids the subjective step of drawing convex spaces or axial lines and is implemented in the open-source DepthmapX software [6]. In buildings, visual integration has been found to correlate with observed movement and with where people gather, and the correlation between local and global measures, intelligibility, with the ease of wayfinding [3, 4, 8].

## 2. Method

### 2.1. Floor and obstacles

The plan of one level is rasterised. The occupied floor is everything inside the walls, with doorways up to about 1.1 m bridged, minus furniture footprints. At eye height (1.6 m), walls and tall furniture block sight and low furniture is seen over; at knee height (0.5 m), all furniture blocks, which approximates what can be walked across. Glass can be set to be seen through.

### 2.2. Graph

Nodes are placed on a square grid over the floor. The spacing and the number of sight rays are chosen from a list for each detail level (draft 0.6–1.5 m, standard 0.3–0.75 m, fine 0.2–0.5 m, with 240–720 rays) as the finest that fits a time budget on the user's computer. From each node, the free distance along each of the n_r bearings is found by ray casting against the obstacles. Nodes a and b are joined if b lies within the free distance of a along the bearing towards b and vice versa.

### 2.3. Measures

Connectivity is the number of nodes joined to a node. A breadth-first search from each node s gives the visual depth d(s, t) to every reachable node t, the number k of nodes reached and the mean depth MD = Σ d / (k − 1). Following Hillier and Hanson [1]:

- Relative asymmetry RA = 2 (MD − 1) / (k − 2).
- The diamond D-value D_k = 2 [k (log₂((k + 2)/3) − 1) + 1] / [(k − 1)(k − 2)].
- Real relative asymmetry RRA = RA / D_k, and integration [HH] = 1 / RRA.

Integration R3 applies the same formulas to the nodes within three steps, with k the count of those nodes, as DepthmapX does for radius-limited integration [6]. Intelligibility is the squared Pearson correlation between connectivity and global integration across all nodes [1, 8]. The study also reports visual steps from any chosen spot.

### 2.4. Agents

Two hundred agents start at random nodes and repeatedly choose a destination at random among the nodes they can see within a 170° field of view, walk three grid steps towards it and choose again, for 1,500 steps, after Turner and Penn's agent model in DepthmapX [5, 6]. The count of agents entering each node (gate count) is reported. A deterministic random seed makes runs repeatable.

## 3. Parameters and their sources

Table 1. Settings and formulas of the Space syntax study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Graph | Mutual visibility on a grid | Turner et al. 2001 [2] | Sourced |
| Eye / knee height | 1.6 m / 0.5 m | DepthmapX practice of "see" and "move" graphs [2, 6] | Sourced convention |
| Node spacing | 0.2–1.5 m by detail and time budget | Engine choice | Numerical setting; results depend on spacing |
| Sight rays per node | 240–720 | Engine choice | Numerical setting; at 720 rays a 1° sector, so nodes far away can be missed or added |
| RA, D-value, RRA, integration | As in §2.3 | Hillier and Hanson [1] | Sourced and checked against the published formula |
| Local integration | Radius 3 | DepthmapX convention [6] | Sourced |
| Intelligibility | R² of connectivity vs integration | Hillier and Hanson [1]; Hillier [8] | Sourced |
| Agents | 200 agents, 170° view, 3 steps, 1,500 steps | Turner and Penn [5]; DepthmapX defaults [6] | Sourced convention |
| Doorway bridging | ≈ 1.1 m | Engine choice | Assumption |

## 4. Verification and validation status

The Workspace tests check that the study runs from the menu, that its views render and that the agents move. The formulas were checked line by line against Hillier and Hanson for this report [1]. A numerical comparison with DepthmapX on a reference plan, which would show the effect of the ray discretisation on connectivity and integration, has not been done and is the obvious next step.

In the end-to-end audit of 20 November 2026 on level 1 of the audit block (231 m² of floor, nodes every 60 cm), the study built a graph of 644 nodes and reported a mean visual integration of 5.18, an intelligibility R² of 0.73, the most integrated tenth at 8.19 and above, and 2,122 agent crossings at the busiest node.

## 5. Discussion

**What the measures mean.** Integration measures how few visual steps separate a point from all others; well-integrated spaces are those from which the rest of the plan is easily seen or reached. Studies of urban areas and of buildings such as museums and offices have found that integration explains a substantial part of the variance in observed movement where movement is not driven by strong attractors [3, 4, 9]. Where function dominates, for example a lift lobby or a reception desk, the correlation weakens. Integration therefore describes a plan's potential for movement and visibility, not a forecast of occupancy.

**Normalisation.** Integration [HH] is designed to compare plans of different size, but its values still depend on the grid spacing because k and mean depth do. Values should be compared only between plans analysed at the same spacing and height. The study reports the spacing in its results so that this can be checked.

**Discretisation.** Mutual visibility is tested against a polar ray map with a finite number of rays; at long range a 1° sector is wide, so a distant node just past a door jamb can be counted as visible or not. DepthmapX tests visibility exactly against the geometry [6]. The effect is mostly on connectivity of nodes in large open spaces.

## 6. Conclusion

The Space syntax study implements visibility graph analysis and the Hillier and Hanson measures as published, with DepthmapX conventions for heights, radius and agents. It has not yet been compared numerically with DepthmapX. Its results are appropriate for comparing plan options by their spatial structure, with the understanding that configuration influences, but does not determine, how a building is used.

# References

1. B. Hillier, J. Hanson, The Social Logic of Space, Cambridge University Press, Cambridge, 1984.
2. A. Turner, M. Doxa, D. O'Sullivan, A. Penn, From isovists to visibility graphs: a methodology for the analysis of architectural space, Environ. Plann. B Plann. Des. 28 (1) (2001) 103–121. [doi:10.1068/b2684](https://doi.org/10.1068/b2684)
3. B. Hillier, A. Penn, J. Hanson, T. Grajewski, J. Xu, Natural movement: or, configuration and attraction in urban pedestrian movement, Environ. Plann. B Plann. Des. 20 (1) (1993) 29–66. [doi:10.1068/b200029](https://doi.org/10.1068/b200029)
4. A. Penn, Space syntax and spatial cognition: or why the axial line?, Environ. Behav. 35 (1) (2003) 30–65. [doi:10.1177/0013916502238864](https://doi.org/10.1177/0013916502238864)
5. A. Turner, A. Penn, Encoding natural movement as an agent-based system: an investigation into human pedestrian behaviour in the built environment, Environ. Plann. B Plann. Des. 29 (4) (2002) 473–490. [doi:10.1068/b12850](https://doi.org/10.1068/b12850)
6. T. Varoudis, depthmapX: multi-platform spatial network analysis software, Space Syntax Laboratory, University College London, 2012–. https://github.com/SpaceGroupUCL/depthmapX
7. M.L. Benedikt, To take hold of space: isovists and isovist fields, Environ. Plann. B 6 (1) (1979) 47–65. [doi:10.1068/b060047](https://doi.org/10.1068/b060047)
8. B. Hillier, Space is the Machine: A Configurational Theory of Architecture, Cambridge University Press, Cambridge, 1996.
9. A. Turner, Analysing the visual dynamics of spatial morphology, Environ. Plann. B Plann. Des. 30 (5) (2003) 657–676. [doi:10.1068/b12962](https://doi.org/10.1068/b12962)
