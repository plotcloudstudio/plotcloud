---
id: report-evac
sim: evac
published: 2026-11-21
publishedText: 21 November 2026
auditText: 20 November 2026
title: Everyday circulation between rooms: shortest walking routes, ant-colony walks and use-weighted trip patterns
type: Method and data report
summary: How the Circulation study shows where people tend to walk between the rooms of one floor, with A* shortest routes on a navigation grid, an ant colony that settles on good routes, and pair weights from how often each room is used. The report gives the sources of the algorithms and the walking speed, and flags the room-use weights as unsourced assumptions.
image: img/home/evac.webp
imageAlt: Walks between rooms drawn as bands along the corridors, darker where more people pass
code: mvp/js/circulation-engine.js, mvp/js/workspace-chrome.js
tests: tests/workspace-p0.cjs, tests/workspace-motion2.cjs
keywords:
- Pedestrian circulation
- Shortest path
- Ant colony optimisation
- Trip distribution
- Space planning
highlights:
- Routes are found with A* on a 0.4 m navigation grid (8 neighbours, no corner cutting), then pulled taut along lines of sight.
- An ant colony (pheromone exponent 1, heuristic weight 1.6, evaporation 0.12) walks every pair of rooms over 12 rounds; settled walks show the preferred routes.
- Each pair of rooms is weighted by the product of the rooms' use weights (living 20, kitchen 12, bath or entry 6.5, office 3.5, bedroom 1.5); these weights have no published source.
- Walking speed for the replay is 1.3 m/s, consistent with measured comfortable adult gait speeds.
- The study is a picture of likely routes for layout design, not an evacuation analysis or a count forecast.
---
# Abstract

Circulation, the movement of people between the spaces of a building, determines corridor widths, the placement of shared rooms and the distances people walk each day [1, 2]. Formal methods range from adjacency matrices and trip-distribution models in space planning to agent-based pedestrian simulation [2, 3]. SimuSite's Circulation study (labelled Everyday circulation in the Workspace; its identifier "evac" is historical) takes the rooms on one floor, finds the shortest walkable route between every pair with the A* algorithm on a navigation grid [4], and runs an ant colony optimisation over the same grid so that walks start exploratory and settle onto good routes [5, 6]. Pairs are weighted by how often their rooms are used, and the metres walked through each spot are mapped as a density. This report documents the method and its constants. The path-finding and ant-colony algorithms are standard and the walking speed is consistent with measured values [7]; the room-use weights are assumptions without a source, and the result shows the pattern of routes, not numbers of people.

# Body

## 1. Introduction

In space planning, the expected number of trips between two spaces is often modelled as a product of their activity levels, as in the gravity models of transport planning, and layouts are judged by the total distance weighted by trips [2, 3]. Shortest paths are the first-order prediction of where people walk; real paths deviate from them because people prefer fewer turns, wider spaces and familiar routes [8]. Ant colony optimisation, introduced by Dorigo and colleagues, finds short paths in a graph by stochastic walkers that lay pheromone in proportion to path quality, with evaporation; it converges on short routes while keeping some variety [5, 6]. The study uses it to show the spread of plausible routes rather than to find the shortest path, which A* already gives.

## 2. Method

### 2.1. Grid

The walls of the level, with their door and opening gaps, and furniture edges are rasterised at 0.1 m. A navigation grid of 0.4 m cells is blocked where any wall pixel touches the cell; diagonal steps are not allowed to cut a wall corner. Each room is represented by a point (its label position), snapped to the nearest free cell.

### 2.2. Shortest routes

For each pair of rooms, A* with eight neighbours finds the shortest grid path [4], which is then pulled taut by removing intermediate points wherever a straight line of sight exists on the fine raster. The study reports the average and longest route and the walking time at 1.3 m/s.

### 2.3. Ant colony

For each pair, an ant colony runs for 12 rounds. In each round up to 5 ants walk from one room towards the other, never revisiting a cell. From cell i, the probability of stepping to a free neighbour j is proportional to τ_j^α exp(β (h_i − h_j)/c_ij), where τ is the pheromone, h the true walking distance to the goal from a Dijkstra distance field, c_ij the step length, α = 1 and β = 1.6 [5, 6]. After each round, pheromone evaporates by ρ = 0.12 (to a floor of 0.05) and each successful ant adds 40/L to the cells of its path, where L is its length. Walks are smoothed with Chaikin's corner cutting [9], given a small sideways wobble that is larger in early rounds, and replayed at 1.3 m/s.

### 2.4. Trip weights

Each room has a use weight from its name: living room 20, kitchen, dining, break room or lobby 12, bathroom, entrance, stair or lift 6.5, office, study, laundry or storage 3.5, bedroom 1.5, and 6.5 otherwise. A pair's weight is the product of its rooms' weights, and the number of ants per round on each pair is proportional to that weight, with the busiest pair receiving the full number and a cap of 1,200 walks in total. The user can switch weighting off so that all pairs are walked equally.

### 2.5. Density

The metres walked through each cell of a density grid are accumulated by bilinear deposits every 5 cm along each walk. The busiest spot and the number of crossings there are reported.

## 3. Parameters and their sources

Table 1. Settings of the Circulation study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Navigation grid | 0.4 m, 8 neighbours, no corner cutting | Engine choice | Numerical setting; 0.4 m is close to a person's body depth |
| Shortest path | A* with taut-string smoothing | Hart, Nilsson and Raphael [4] | Sourced |
| ACO rule | τ^α · heuristic^β, α = 1, β = 1.6 | Ant System form [5, 6] | Sourced form; values are engine choices within the usual range |
| Evaporation ρ | 0.12 | Engine choice | Within the 0.1–0.5 range used in ACO studies [6] |
| Deposit | 40 / L | Ant System Q/L rule [5] | Sourced form |
| Rounds, ants | 12, up to 5 per round | Engine choice | Numerical setting |
| Room-use weights | 20 / 12 / 6.5 / 3.5 / 1.5 | Engine choice | Flagged: no published source |
| Pair weight | Product of room weights | Gravity-type trip model [3] | Plausible form; no distance decay |
| Walking speed | 1.3 m/s | Measured comfortable gait 1.27–1.46 m/s for adults [7] | Consistent |
| Smoothing | Chaikin, 3 iterations | Chaikin [9] | Sourced |

## 4. Verification and validation status

The Workspace tests check that the study is in the menu, runs and animates. There is no test of the routes against a reference. The A* implementation can be checked on simple layouts by hand; the ant colony is stochastic but seeded, so a run repeats exactly.

In the end-to-end audit of 20 November 2026 on level 1 of the audit block (nine places), the study reported an average walk of 13.4 m, a longest walk of 21.0 m (16 s at 1.3 m/s), 420 walks totalling 6,652 m, and about 13 ant crossings at the busiest spot. It found routes for 21 of the 36 pairs; the remaining 15 pairs had no walkable route on the navigation grid. We did not determine whether this was due to doors missing in the generated audit model or to door gaps too narrow for the 0.4 m grid; the study should say which rooms are unreachable so that the user can tell.

## 5. Discussion

**Weights.** The use weights encode a plausible ranking of how often rooms in a home are visited, but they are not derived from time-use or observation data, and they mix homes and offices. Because the pair weight is a product, the living room dominates: a living-kitchen pair weighs 240, a bedroom-bathroom pair under 10. For offices or schools, users should set the weights or switch weighting off. Trip-distribution models in practice also include a distance decay, which the study omits [3].

**Routes.** Shortest paths on a grid are a reasonable first approximation in small buildings where people know the layout. People in unfamiliar buildings, or with mobility constraints, follow different routes [8]. The ant colony adds variety, but the variety reflects the algorithm's randomness, not observed behaviour.

**Not evacuation.** Despite its identifier, the study does not model egress, congestion or flow capacity. The Fire evacuation study, documented separately, uses the SFPE hydraulic model for that purpose.

## 6. Conclusion

The Circulation study uses standard path-finding and ant-colony algorithms and a realistic walking speed. Its room-use weights are unsourced assumptions that strongly shape the density map. The study is useful for seeing which corridors and doors carry the everyday routes of a layout; it does not predict occupant numbers or evacuation performance.

# References

1. E. Neufert, P. Neufert, Architects' Data, 4th ed., Wiley-Blackwell, Chichester, 2012.
2. R.L. Francis, L.F. McGinnis, J.A. White, Facility Layout and Location: An Analytical Approach, 2nd ed., Prentice Hall, Englewood Cliffs, 1992.
3. J. de D. Ortúzar, L.G. Willumsen, Modelling Transport, 4th ed., Wiley, Chichester, 2011.
4. P.E. Hart, N.J. Nilsson, B. Raphael, A formal basis for the heuristic determination of minimum cost paths, IEEE Trans. Syst. Sci. Cybern. 4 (2) (1968) 100–107. [doi:10.1109/TSSC.1968.300136](https://doi.org/10.1109/TSSC.1968.300136)
5. M. Dorigo, V. Maniezzo, A. Colorni, Ant system: optimization by a colony of cooperating agents, IEEE Trans. Syst. Man Cybern. B 26 (1) (1996) 29–41. [doi:10.1109/3477.484436](https://doi.org/10.1109/3477.484436)
6. M. Dorigo, T. Stützle, Ant Colony Optimization, MIT Press, Cambridge, MA, 2004.
7. R.W. Bohannon, Comfortable and maximum walking speed of adults aged 20–79 years: reference values and determinants, Age Ageing 26 (1) (1997) 15–19. [doi:10.1093/ageing/26.1.15](https://doi.org/10.1093/ageing/26.1.15)
8. R.G. Golledge, Path selection and route preference in human navigation: a progress report, in: A.U. Frank, W. Kuhn (Eds.), Spatial Information Theory, Lecture Notes in Computer Science 988, Springer, Berlin, 1995, pp. 207–222.
9. G.M. Chaikin, An algorithm for high-speed curve generation, Comput. Graph. Image Process. 3 (4) (1974) 346–349.
