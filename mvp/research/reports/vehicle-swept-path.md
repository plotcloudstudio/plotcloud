---
id: report-vehicle-swept-path
sim: vehicle-swept-path
published: 2026-11-21
publishedText: 21 November 2026
auditText: 25 November 2026
title: Vehicle swept paths from a kinematic bicycle model with pure-pursuit steering and computed trailer off-tracking
type: Method and data report
summary: How the Vehicle swept path study drives a design vehicle along a drawn route with a rate-limited pure-pursuit steering controller, computes the off-tracking of trailers, and checks clearance to buildings and other obstacles. The report gives the equations and their sources, reports exact checks against analytical turning geometry, and flags the vehicle presets as typical dimensions that must be checked against the design vehicle of the jurisdiction.
image: img/home/vehicle-swept-path.jpg
imageAlt: The swept envelope of a truck turning into a service yard, with wheel tracks and clearance warnings
code: mvp/js/swept-path.js, mvp/js/vehicles.js, mvp/js/route-plan.js, mvp/js/site-routes.js, mvp/js/vehicle-mesh.js, mvp/js/site-access-ui.js, mvp/js/workspace-chrome.js, mvp/js/export-list.js
tests: tests/swept-path.cjs, tests/workspace-swept-path.cjs, tests/site-routes.test.mjs, tests/vehicle-path-auto.cjs, tests/vehicle-reverse-sheet.cjs
keywords:
- Swept path analysis
- Off-tracking
- Design vehicle
- Pure pursuit
- Site access
highlights:
- The rear-axle centre is the reference point, so the least turning radius is R_min = wheelbase / tan(maximum steering angle).
- Steering follows pure pursuit with a look-ahead equal to the wheelbase (1.5–12 m), limited to the maximum angle and to the rate set by the lock-to-lock time at the stated speed.
- A trailer's heading follows its hitch: φ′ = [sin(θ − φ) + h (tan δ / L) cos(θ − φ)] / L_t per metre, so off-tracking is computed.
- Against analytical steady turns, the engine is within 0.4–0.9 mm for a car and 0.5 mm for a semi-trailer's axle radius.
- The presets are typical dimensions, not manufacturer data or AASHTO or TAC design vehicles; the WB-20-type preset should be checked against the Green Book before use. One published design vehicle is included: the STAA Design Vehicle of the Caltrans Highway Design Manual, Figure 404.5A [6].
---
# Abstract

Swept path analysis checks whether a design vehicle can follow a route, through a site entrance, a loading bay or a fire access road, and how much space its body and wheels sweep [1, 2]. Commercial tools simulate the vehicle with kinematic models and standard design vehicles. SimuSite's Vehicle swept path study does the same for early design: it rounds the corners of a drawn route by arcs no tighter than the vehicle can turn, drives a kinematic bicycle model along it with pure-pursuit steering limited in angle and rate [3, 4], computes the heading of any trailer from its hitch [5], and checks the clearance of the body outlines to every obstacle at every step. It reports feasibility with the stations of any infeasible stretch, the tightest radius, the least clearance and where it occurs, the swept area, and exports to DXF. This report documents the equations and their sources. The kinematics are standard and the engine reproduces analytical steady-turn geometry to within a millimetre in its tests. The vehicle presets are typical dimensions rather than the design vehicles of AASHTO or TAC, and should be replaced by the vehicle the project must serve.

# Body

## 1. Introduction

At low speed, tyres roll without significant slip, and a vehicle's motion is described by kinematics alone: the rear axle moves along its heading, and the heading changes at a rate set by the steering angle and the wheelbase (the bicycle model) [4]. The rear wheels track inside the front wheels on a turn, and the trailer of an articulated vehicle tracks further inside its tractor; this off-tracking determines the width a turn needs [1, 5]. Road design guides publish design vehicles and their minimum turning paths [1, 2]. Swept path software combines these models with a driver model that steers the vehicle along a path.

## 2. Method

### 2.1. Reference path

The route is a polyline drawn on the plan. Each corner between two segments driven in the same direction is replaced by a circular arc of radius 1.25 × R_min by default (less where the segments leave no room, or a radius set by the user), where R_min = wheelbase / tan(δ_max) is the radius of the rear-axle centre at full lock. A corner between a forward and a reversing segment is a cusp, where the vehicle stops and may turn the wheel at standstill.

### 2.2. Vehicle and steering

The vehicle is a kinematic bicycle model with the rear-axle centre at (x, y) and heading θ: per metre travelled, x′ = cos θ, y′ = sin θ and θ′ = tan δ / L, where L is the wheelbase and δ the steering angle [4]. Steering follows pure pursuit: the target is the route point a look-ahead distance L_d ahead (the wheelbase, between 1.5 and 12 m), and the steering angle is that of the arc through the target, δ = atan(2 L sin α / L_d), where α is the angle to the target [3]. The angle is limited to ±δ_max and its rate to 2 δ_max / t_lock per second at the stated speed (8 km/h by default). Where the vehicle cannot stay within 0.30 m of the route, a corner is tighter than R_min, or a trailer folds past its articulation limit, the stretch is reported infeasible with its stations; the route is never forced.

### 2.3. Trailer

For an articulated vehicle with the hitch at distance h ahead of the tractor's rear axle and a trailer wheelbase L_t from kingpin to trailer axle, the trailer heading φ changes per metre as

φ′ = [sin(θ − φ) + h (tan δ / L) cos(θ − φ)] / L_t,

which is the standard kinematic trailer equation [5]. In a steady turn with the hitch over the rear axle, the trailer axle runs on a circle of radius √(R² − L_t²) inside the tractor's rear axle radius R.

### 2.4. Outlines and clearance

At each step the body outlines of the tractor and trailer and the four wheel positions are recorded. The swept envelope is rasterised on a fine grid (0.02–0.05 m), and every body outline is tested against every obstacle outline (buildings, walls and drawn obstacles) for the least gap. Stretches in collision or nearer than the clearance threshold (0.30 m by default) are reported. An option drives around obstacles with a planned path.

### 2.5. Routes found from the site (added 25 November 2026)

A route can be found instead of drawn. The site data give the roads as OpenStreetMap centrelines with a width [9] and the building model gives its doors to outside on the lowest storey (an opening is exterior when a room lies on one side of its wall only). Three tasks set the two ends:

- **To an entrance.** The start lies on the road nearest the chosen door, a lead distance before the point nearest it, in the middle of the right-hand half of the road (traffic keeps to the right). The end is a stop beside the door, 1 m clear of the wall, parallel to it, with the middle of the vehicle at the door. If the vehicle cannot stand there facing one way along the wall, the other way is tried.
- **Through the site.** Two clicks, each near a road, give the start and the end in the right-hand half of the nearest road.
- **A turn at a junction.** Junctions are where two road centrelines cross, or where one ends within 1 m of another. The vehicle starts a lead distance out on the incoming arm and ends the same distance out on the leaving arm.

Between the two ends a hybrid A* search [8] drives forward in short arcs no tighter than 1.1 × the vehicle's least radius, with the body (and trailer) covered by circles tested against a distance map of the buildings. Ground outside the road corridors (half the road width either side of the centreline) costs 1.6 times as much, so the path keeps to the roads where it can. The last arc must end within 0.3 rad of the stop's heading. The path found is then driven by the model of §2.2–2.3, so its swept envelope, clearances and infeasible stretches are computed as for a drawn route.

### 2.6. Reversing, turning round and backing up to a door (added 25 November 2026)

For rigid vehicles the planner may also drive backwards. Each arc can be driven forward or in reverse; reversing costs twice as much per metre, and each change of direction costs as much as driving the vehicle's own length. A leg must be at least 1.5 m long before the next change. In these manoeuvres the body is tested as its true rectangle: points along its outline keep the clearance, and points along its axis are half its width clear. The circles used for ordinary routes would overstate it by about a metre at the ends.

- **Turn round.** The vehicle faces the other way in the other half of the same road, staying within the road's width. Ground outside the road corridor is blocked rather than merely costed. Where a U-turn does not fit, the search backs and fills: a three-point turn, or more moves where the road is narrower.
- **Backed up to a door.** The vehicle drives forward past the door to a staging point parallel to the wall, then reverses in. The stop is square to the wall with the rear 0.5 m from it, as at a loading dock.

A path that reverses is driven as planned: arc after arc, indexed by the distance driven, stopping at each change of direction, reversing at 4 km/h. It starts from the heading it was planned from. Following such a path with pure pursuit instead turned a few degrees of heading error at a cusp into nearly a metre of drift while reversing, so the planned path is what the swept envelope and clearances are computed on. Articulated vehicles are not reversed in this version.

### 2.7. The vehicle access sheet (added 25 November 2026)

The result can be added to the project report as a vehicle access sheet. Its first page carries:
- a plan drawing, framed on the route from the same CAD layers as the DXF export;
- the 3D view;
- the results, method, inputs and limits.

A second page carries four tables:
- the route and its moves (changes of direction, metres reversing, least clearance);
- every vehicle on the route, when Try every vehicle was run;
- the conflicts;
- the vehicle data.

### 2.8. Playback and the 3D vehicle

The result plays in real time at the stated speed (1×, 2× or 4×), on the display's own refresh: each frame interpolates the vehicle's pose at that moment (§2.2), draws its body, wheels and the wheel tracks driven so far over the 2D plan, and places a schematic 3D model at the same pose. The model is built from the same dimensions as the swept body: its footprint is the body rectangle of §2.4, the wheels stand at the axles and track, the front wheels turn by the steering angle and all wheels roll with the distance driven; a trailer turns by its own heading. Heights only shape the picture (Table 1). The model shows the movement and the scale; it is not a rendering of a make or model, and nothing is checked against its height.

## 3. Parameters and their sources

Table 1. Settings and vehicle data of the Vehicle swept path study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Vehicle model | Kinematic bicycle | Rajamani [4] | Sourced; valid at low speed |
| Steering controller | Pure pursuit | Coulter [3] | Sourced |
| Look-ahead | L, limited to 1.5–12 m | Engine choice | Numerical setting |
| Trailer equation | As in §2.3 | Kinematic trailer model [5] | Sourced |
| Corner rounding | 1.25 × R_min | Engine choice, "as CAD swept-path tools do" | Editable |
| Tracking tolerance | 0.30 m | Engine choice | Numerical setting |
| Clearance threshold | 0.30 m | Engine choice | Common practice; editable |
| Speed | 8 km/h | Engine choice | Typical manoeuvring speed |
| Passenger car | L 2.9 m, width 1.85 m, δ 35° (R_min 4.14 m) | Typical dimensions | Plausible; AASHTO P vehicle is 5.8 m long [1] |
| Box, medium and heavy rigid trucks, van, pickup, bus, fire truck, mixer | Typical dimensions | Engine choice; the mixer "after the reference drawing" | Flagged: not manufacturer or code design vehicles |
| WB-20-type semi-trailer | Tractor L 6.2 m, kingpin to axle 12.4 m, length 22.7 m, δ 28.2° | "After the WB-20 in the reference drawing" | Flagged: the drawing is not named; does not match the Caltrans STAA vehicle [6]; check against AASHTO [1] |
| STAA design vehicle | Front overhang 4 ft, tractor wheelbase 23 ft, kingpin over the tractor's rear axle (0 ft), trailer 48 ft: 3 ft ahead of the kingpin, 41 ft kingpin to rear axle, 4 ft behind; width and track 8.5 ft; steering lock 26.3°; lock-to-lock 6 s; articulation 70°; 72 ft overall | Caltrans HDM Figure 404.5A [6] | Sourced (feet × 0.3048) |
| STAA tractor frame behind its rear axle | 0.6 m | Engine choice | Assumption: not dimensioned in Figure 404.5A; it lies under the trailer |
| Display heights of the 3D models | Car 1.3 m (AASHTO P); trucks, mixer and fire truck 3.4–4.1 m (AASHTO SU range); bus 3.2 m (AASHTO CITY-BUS); semi-trailers 4.1 m (AASHTO WB-19 and WB-20) | AASHTO Exhibit 2-1 (Metric) [7] | Sourced; SUV 1.8 m, pickup 1.9 m and van 2.6 m have no AASHTO class and are flagged as assumed; picture only |
| Start lane | Middle of the right-hand half of the road: width / 4 from the centreline (at least 1.2 m) | Engine choice | Assumption: right-hand traffic; no lane data |
| Lead distance before the door or junction | max(25 m, 3 × the vehicle's length) to a door; max(20 m, 2 × its length) at a junction | Engine choice | Numerical setting: room to line up |
| Stop beside a door | 1.0 m from the wall to the vehicle's side, parallel to the wall | Engine choice | Assumption; to be set by the project |
| Planner curvature limit | 1 / (1.1 × R_min) | Engine choice, hybrid A* [8] | Numerical margin |
| Off-road cost | 1.6 × the cost on a road corridor | Engine choice | Numerical setting: prefers roads, does not forbid leaving them |
| Final heading tolerance | 0.3 rad (17°) | Engine choice | Numerical setting |
| Reversing cost | 2 × the cost of driving forward, per metre | Engine choice | Numerical setting: drive forward where it can |
| Change of direction | Costs the vehicle's own length; legs at least 1.5 m | Engine choice | Numerical setting |
| Reversing speed | 4 km/h | Engine choice: walking pace | Assumption |
| Staging point to back up | Past the door by R + wheelbase, out from the wall by the rear overhang + 0.5 m + R + the width (R = 1.25 × R_min) | Engine choice | Geometric setting: room to reverse in turning |
| Stop backed up to a door | Square to the wall, rear 0.5 m from it | Engine choice | Assumption; to be set by the project |

## 4. Verification and validation status

`tests/swept-path.cjs` compares the engine with closed-form geometry. In our run on 21 November 2026 all eight checks passed:

- A passenger car on a 10 m radius: rear axle within 0.4 mm of the circle; outer front corner radius 11.584 m (±0.9 mm of the analytical value); inner side 9.075 m (±0.4 mm); swept width 2.51 m; the rasterised envelope matches within its 0.02 m cell.
- A 30 m straight: a band 1.85 m wide, equal to the car's width.
- A 2 m corner: reported infeasible over the right stations; with no radius set, the corner is rounded to 5.2 m and driven.
- A semi-trailer on a 30 m radius: trailer axle on 27.317 m (within 0.5 mm of √(30² − 12.4²)), off-tracking 2.68 m; a 10° articulation limit is flagged.
- Clearance to a box of 0.575 m is reported feasible, 0.175 m is flagged under 0.30 m, and an overlap is reported as a collision from 6.20 to 13.00 m (hand calculation 6.15–13.05 m).
- A forward-then-reverse route has one cusp; two cars crossing meet at 6.9 s; the same input gives the same output.

`tests/workspace-swept-path.cjs` passed its checks in the Workspace: a box truck along a drawn route (feasible, tightest radius 6.63 m against the vehicle's least 5.50 m, least clearance 0.77 m, swept area 371.4 m²), detection of a route through a building and a drive around it, a 3 m corner reported infeasible, two vehicles meeting, and JSON, DXF and SVG exports. In the end-to-end audit on 20 November 2026, with no route drawn, the study asked the user to draw one, as intended.

`tests/staa-vehicle.test.mjs` checks the STAA preset against Figure 404.5A (24 November 2026):

- every dimension in feet × 0.3048, the 48 ft trailer and the 72 ft overall length;
- the outside front wheel at full lock comes to 55.75 ft against the figure's 56.16 ft "radius to outside wheel at beginning of curve", a difference of 0.7 %;
- on a 30 m circle the trailer axle settles at 27.273 m, against √(R² − L_t²) = 27.273 m.

`tests/site-routes.test.mjs` checks the routes found from the site on a made-up site (25 November 2026). All six checks passed:

- A junction is found at the crossing of two streets, with four arms.
- To an entrance, a box truck starts in the right-hand half of the street and ends with its middle at the door, 1 m clear of the wall. It ends 9.5° off the wall's direction (within the 17° allowed), with no collision.
- A right turn at the junction keeps 94 % of the path on the road corridors; a drive along the street keeps 100 %.
- A wall across the street gives "no way round" and the point the search reached.
- For all 12 presets, the 3D model's footprint matches the swept body within 2 cm, and the front-left wheel stands at the axle.

`tests/vehicle-path-auto.cjs` checks the same in the Workspace on the hospital example. All six checks passed:

- **What was found:** 7 surrounding buildings, 2 roads, 4 doors to outside and 1 junction.
- **To an entrance:** the box truck drives from the service lane to the Shipping and receiving door, 18.0 m, 96 % on the road, feasible, with nothing drawn.
- **Playback:** the vehicle moves in even steps, and its front wheels steer. The view follows it when asked.
- **Every vehicle:** "Try every vehicle" lists all 12 presets. 5 reach that door; the longest is the medium rigid truck.
- **Other tasks:** a left turn at the junction and a drive through the site each find a route.

The reversing checks (25 November 2026):

- `tests/site-routes.test.mjs` passed its two new checks.
  - **Backing up to a door:** a box truck backs up in 2 moves (16.0 m reversing). It is driven as planned, with no tracking error, and ends 0.93 m and 14° from the stop asked, with no collision. A semi-trailer is not reversed.
  - **Turning round on a 12 m road:** the box truck makes a three-point turn (3 moves, 4.0 m reversing). Its body stays within 5.61 m of the centreline, against 6 m to the road edge.
- **Narrower roads** (trials with the same code):
  - the box truck needs 5 moves on a 10 m road;
  - a van needs 7 moves on 9 m;
  - a car needs 5 moves on 7 m;
  - a box truck cannot turn round on 9 m while keeping 0.3 m clear of the edges.
- `tests/vehicle-reverse-sheet.cjs` passed in the Workspace on the hospital example:
  - the box truck backs up to the goods door (2 moves, feasible), and 10 of the 12 presets can; the two semi-trailers report that they are not reversed;
  - a van turns round on the 9 m hospital drive in 7 moves;
  - the vehicle access sheet goes into the report PDF: 5 pages, the sheet's plan drawing and its page of tables.

## 5. Discussion

**The STAA design vehicle.** One preset reproduces a jurisdiction's published design vehicle: the STAA Design Vehicle of the Caltrans Highway Design Manual, Topic 404, Figure 404.5A [6], with all its dimensions taken from that figure. Two caveats apply:

- Index 404.4(1)(b) of the same manual describes a 43 ft kingpin-to-rear-axle distance, but the figure draws 41 ft. The preset follows the figure, whose parts add up to the stated 48 ft semitrailer.
- The Caltrans vehicle is not the AASHTO Green Book WB-20 (WB-65/67). The Green Book was not available to check, so the WB-20-type preset remains flagged.

**Kinematics only.** At the low speeds of site access and loading, tyre slip is small and kinematic models are the basis of design-vehicle turning templates [1, 2]. At higher speeds, or for long trailers with steered axles, dynamic effects and steering systems not represented here matter.

**Design vehicles.** The presets are labelled as typical dimensions. For a road authority or fire department submission, the vehicle must be the one specified: the AASHTO Green Book design vehicles in the United States [1], the TAC design vehicles in Canada [2], or the local fire apparatus. The WB-20-type preset's overall length of 22.7 m and its outer front corner radius at full lock of about 14.7 m are of the same order as the AASHTO WB-20 interstate semi-trailer, but its source drawing is not named and the dimensions and turning radius should be checked against the Green Book before use [1].

**Driver model.** Pure pursuit with a look-ahead of one wheelbase cuts corners slightly, as drivers do; the corner rounding at 1.25 R_min reflects a driver who does not turn at full lock. Swept paths from commercial tools use similar conventions, and results can differ by tens of centimetres depending on them.

**Routes found from the site.** A found route is a plausible way in, not the only one and not a regulation one. The roads are centrelines with a width: kerbs, the paved edge, lanes, one-way streets and turn restrictions are not known, so a path may cut a corner a kerb would stop. Driveways and loading areas that are not mapped are only buildings' surroundings. The planner reverses rigid vehicles only: an articulated vehicle cannot be backed into a bay here. Where the search fails, it says how close it came; drawing the route remains possible for any case the site data cannot describe.

**What would deepen it.**
- Kerb and paved-edge lines (from survey DXF), so the wheels must stay on the pavement while the body may overhang a low kerb, as commercial swept-path tools check.
- Reversing articulated vehicles (rigid vehicles reverse since 25 November 2026), and a finish that lands exactly on the stop (the search stops within 1 m and 17° of it, and says by how much).
- Overhead clearance against canopies and parking entrances, and grades from the terrain, now that each vehicle has a height.
- Design vehicles checked dimension by dimension against AASHTO and TAC.

## 6. Conclusion

The Vehicle swept path study uses standard kinematic models and a standard steering controller, and reproduces analytical turning geometry to within a millimetre. Its vehicle presets are typical dimensions and must be replaced by the project's design vehicle for any submission. It is well suited to testing site access and loading layouts in early design.

# References

1. AASHTO, A Policy on Geometric Design of Highways and Streets, 7th ed. ("Green Book"), American Association of State Highway and Transportation Officials, Washington, DC, 2018.
2. Transportation Association of Canada, Geometric Design Guide for Canadian Roads, TAC, Ottawa, 2017.
3. R.C. Coulter, Implementation of the pure pursuit path tracking algorithm, Technical Report CMU-RI-TR-92-01, Robotics Institute, Carnegie Mellon University, Pittsburgh, 1992.
4. R. Rajamani, Vehicle Dynamics and Control, 2nd ed., Springer, New York, 2012. [doi:10.1007/978-1-4614-1433-9](https://doi.org/10.1007/978-1-4614-1433-9)
5. SAE International, SAE J695, Turning Ability and Off Tracking — Motor Vehicles, SAE, Warrendale, PA.
6. California Department of Transportation, Highway Design Manual, Chapter 400 Intersections at Grade, Topic 404 Design Vehicles: Index 404.4(1)(b) and Figure 404.5A "STAA Design Vehicle 56-Foot Radius" (page 400-19, July 1, 2020; chapter as updated 29 September 2023). [dot.ca.gov](https://dot.ca.gov/programs/design/manual-highway-design-manual-hdm)
7. AASHTO, Errata for A Policy on Geometric Design of Highways and Streets (2004 edition), June 2004: Exhibit 2-1 (Metric), Design Vehicle Dimensions, overall heights. [downloads.transportation.org](https://downloads.transportation.org/Errata-GDHS-4.pdf)
8. D. Dolgov, S. Thrun, M. Montemerlo, J. Diebel, Path planning for autonomous vehicles in unknown semi-structured environments, The International Journal of Robotics Research 29 (5) (2010) 485–501. [doi:10.1177/0278364909359210](https://doi.org/10.1177/0278364909359210)
9. OpenStreetMap contributors, map data available under the Open Database License (ODbL). [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright)
