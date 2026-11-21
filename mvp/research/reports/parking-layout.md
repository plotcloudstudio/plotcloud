---
id: report-parking-layout
sim: parking-layout
published: 2026-11-21
publishedText: 21 November 2026
auditText: 21 November 2026
title: Generating parking layouts: stall and aisle modules, a seeded search over row directions and exact stall assignment
type: Method and data report
summary: How the Parking layout study fills a drawn area with double-loaded rows of stalls, chooses among row directions and offsets with a seeded search, assigns stall types exactly per row, and checks every stall. The report gives the stall and aisle dimensions and their relation to published practice and the ADA Standards, reports the hand-checked tests, and flags the dimensions as editable assumptions rather than a bylaw.
image: img/home/parking-layout.jpg
imageAlt: A parking area filled with rows of stalls and aisles, with accessible stalls near the entrance
code: mvp/js/parking.js, mvp/js/workspace-chrome.js
tests: tests/parking.cjs, tests/workspace-parking.cjs
keywords:
- Parking design
- Layout generation
- Accessible parking
- Dynamic programming
- Site planning
highlights:
- Default stalls are 2.5 × 5.0 m with a 6.0 m aisle at 90°; compact 2.3 × 4.6 m and large 2.7 × 5.5 m are optional; angled stalls use 4.8 m (60°) or 4.0 m (45°) one-way aisles.
- Row directions come from the area's longest edges and the structural grid; offsets are searched with a fixed seed, so a layout repeats exactly.
- Stall types are assigned exactly per row by count, priority or dynamic programming to target shares; every stall is checked again at the end.
- The accessible access aisle of 1.5 m is 2.4 cm narrower than the 60 in (1,525 mm) of the 2010 ADA Standards; the number of accessible stalls is user-set, not derived from ADA Table 208.2.
- Tests match hand counts exactly (86 stalls in a 60 × 40 m lot at 90°, 38 at 60°, 30 at 45°).
---
# Abstract

Surface and structured parking occupies a large share of many sites, and its layout determines both capacity and circulation [1, 2]. Parking design manuals give stall and aisle dimensions for each stall angle, and accessibility standards set the size, number and location of accessible stalls [1, 3]. SimuSite's Parking layout study generates layouts for a drawn area, surface or underground. It lays double-loaded modules of stall, aisle and stall across the area at candidate row directions and offsets, cuts aisles to the free floor and connects them with cross aisles, keeps only aisles reached from an entrance, assigns stall types along each row exactly, and checks every stall at the end. It reports the stall count by type, the area per stall and three distinct options, and exports to DXF. This report documents the method and its dimensions. The geometry is verified against hand counts. The default dimensions are consistent with European practice and somewhat smaller than common North American practice; the accessible access aisle is marginally narrower than the ADA minimum, and the number of accessible stalls is set by the user rather than by the ADA scoping table. The dimensions are editable assumptions, not a bylaw.

# Body

## 1. Introduction

A parking module is the width of one aisle with a row of stalls on each side; its width and the stall pitch along the aisle depend on the stall angle, stall size and aisle width [1, 2]. Layout design chooses the row direction and position in the site to maximise usable stalls subject to circulation. The problem is a form of rectangle packing with constraints, generally solved by designers with templates and by software with heuristics [2]. Accessible stalls in the United States must follow the 2010 ADA Standards: an 8 ft (2,440 mm) wide car stall with a 60 in (1,525 mm) access aisle, or a van stall with a wider stall or aisle, in numbers set by Table 208.2, on the shortest accessible route to the entrance [3].

## 2. Method

### 2.1. Modules and candidates

For a stall of width w and length l at angle α to the aisle, the stall is drawn as a parallelogram w / sin α wide along the aisle and l sin α + w cos α deep. Aisles are 6.0 m for 90° stalls and for two-way traffic, 4.8 m one-way at 60° and 4.0 m one-way at 45°. Candidate row directions are those of the area's longest edges, the structural column grid when underground, and one the user sets; each is tried at several offsets across the module (and at offsets that put column lines between modules). The search uses a seeded random generator (mulberry32), so the same input gives the same layouts.

### 2.2. Aisles, connections and reach

For each candidate, the aisle strips are cut to the free floor (inside the area by the setback, clear of holes, obstacles and columns), and pieces shorter than two stalls are dropped. Cross aisles join neighbouring aisle lines at the ends of their overlap. Aisles within reach of an entrance, directly or by a connector across the rows, are kept; only rows along reached aisles receive stalls.

### 2.3. Stall assignment

Along each row, the free runs are found. Stall types are assigned per run exactly for the run lengths in one of three modes: (A) the maximum count; (B) the user's first type (for example large) first, then the rest; (C) a mix closest to target shares, by dynamic programming across runs over the counts of the tracked types. Accessible stalls with their access aisles are placed first, in the runs nearest an entrance. At the end every stall is checked again for being inside the area, clear of obstacles, aisles and other stalls, and on a reached aisle; a stall that fails is marked invalid and not counted. The best distinct candidates are shown as options A, B and C.

## 3. Parameters and their sources

Table 1. Dimensions of the Parking layout study (all editable).

| Parameter | Value | Reference practice | Audit status |
|---|---|---|---|
| Standard stall | 2.5 × 5.0 m | European guidance commonly uses about 2.5 × 5.0 m [4]; US guidance often 2.6–2.75 × 5.5 m [1] | Assumption, consistent with European practice |
| Compact stall | 2.3 × 4.6 m | Compact stalls in US practice about 2.3–2.4 × 4.6–4.9 m [1] | Assumption |
| Large / SUV | 2.7 × 5.5 m | US standard stall sizes [1] | Assumption |
| Aisle at 90°, two-way | 6.0 m | European guidance about 6.0–6.5 m [4]; US about 7.0–7.3 m [1] | Assumption, at the narrow end |
| One-way aisle at 60° / 45° | 4.8 m / 4.0 m | Of the order given in design manuals [1, 4] | Assumption |
| Accessible stall and aisle | 2.5 m + 1.5 m | ADA 2010: 2,440 mm stall + 1,525 mm aisle [3] | Flagged: aisle 25 mm narrower than ADA |
| Van-accessible stall and aisle | 2.5 m + 2.5 m | ADA 2010: 2,440 mm stall + 2,440 mm aisle (or 3,350 + 1,525) [3] | Meets ADA dimensions |
| Accessible count | 2 by default | ADA Table 208.2 scales with total [3] | Flagged: not derived from the total |
| Search | Seeded, several offsets per direction | Engine choice | "The best found, not a proven optimum" |

## 4. Verification and validation status

`tests/parking.cjs` compares the generator with hand layouts. In our run on 21 November 2026 all checks passed:

- A 60 × 40 m area at 90°: 86 stalls by hand and by the generator (rows of 24, 19, 19 and 24); the free search also finds 86 in 30 positions, with 45 % of the area in stalls.
- At 60°, a pitch of 2.887 m and a depth of 5.580 m give 38 stalls, equal to the hand count; at 45°, 3.536 m and 5.303 m give 30, equal to the hand count. These pitches and depths are w / sin α and l sin α + w cos α exactly.
- An L-shaped area with a hole gives options of 62, 59 and 51 stalls, every stall inside, clear and reached, with the 2 accessible stalls 9 m and 6 m from the entrance.
- Mode B fills the rows with large stalls first (64); mode C reaches 21 compact stalls of 72 (29.2 % for a 30 % target) and rescales target shares that add up to 160 %.
- Underground, 60 stalls avoid all 24 columns and the core.

`tests/workspace-parking.cjs` passed its Workspace checks (43 stalls in 1,288 m² with 2 accessible, 30.0 m² per stall; three options; editing stall types; DXF layers; a delivery van driven down an aisle without hitting a stall; and 42 underground stalls clear of 66 columns). In the end-to-end audit on 20 November 2026, with no area drawn, the study asked the user to draw one, as intended.

## 5. Discussion

**Dimensions are local.** Stall and aisle sizes vary between countries, cities and operators; North American practice uses larger stalls and wider aisles than European practice [1, 4]. The defaults give more stalls than a typical US bylaw would allow and should be set to local requirements before counts are reported.

**Accessible parking.** The 1.5 m access aisle should be 1.525 m or more to meet the 2010 ADA Standards; rounding to 1.6 m would be a simple fix. The number of accessible stalls should be computed from the total by ADA Table 208.2 (or the local equivalent), with one in six of them van-accessible [3]. The study places accessible stalls nearest an entrance, which follows the location requirement in spirit; it does not check slopes or the accessible route.

**Optimality.** A seeded search over directions and offsets finds good layouts but not proven optima; exact assignment within each row means the remaining loss is in the choice of rows. The study says so in its results.

## 6. Conclusion

The Parking layout study's geometry and stall assignment are verified exactly against hand layouts. Its dimensions are editable assumptions consistent with European practice; for US projects, the stall, aisle and accessible-parking values should be set to the bylaw and the ADA Standards, including a 1.525 m access aisle and an accessible count from Table 208.2.

# References

1. Urban Land Institute, National Parking Association, The Dimensions of Parking, 5th ed., Urban Land Institute, Washington, DC, 2010.
2. A.P. Chrest, M.S. Smith, S. Bhuyan, M. Iqbal, D.R. Monahan, Parking Structures: Planning, Design, Construction, Maintenance and Repair, 3rd ed., Springer, Boston, 2001.
3. U.S. Department of Justice, 2010 ADA Standards for Accessible Design, sections 208 and 502, Washington, DC, 2010.
4. FGSV, Empfehlungen für Anlagen des ruhenden Verkehrs (EAR 05), Forschungsgesellschaft für Straßen- und Verkehrswesen, Cologne, 2005 (amended 2012).
