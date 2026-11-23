---
id: report-structure
sim: structure
published: 2026-11-21
publishedText: 21 November 2026
auditText: 21 November 2026
title: Structural frame screening from the drawn walls: layout rules, NBC 2020 load combinations and a linear 3D frame analysis
type: Method and data report
summary: How the Structure study lays out a structural system from the drawn walls, sizes columns, beams and footings with stated rules, and analyses the resulting frame as a linear 3D model under NBC 2020 load combinations. The report gives the sources of the materials, loads and combinations, reports the solver's analytical checks, and flags the assumed loads and strengths and a wind-sway result that is not meaningful when bearing walls are treated as lateral supports.
image: img/home/structure.webp
imageAlt: A building's structural frame with columns, beams and slab strips coloured by bending moment
code: mvp/js/structure-layout.js, mvp/js/structure-frame.js, emb/lib/structural-solver.js, mvp/js/workspace-chrome.js
tests: tests/nbc-loads.test.mjs, tests/structure-layout.cjs, tests/structure-frame.cjs, tests/workspace-structure-analysis.cjs
keywords:
- Structural layout
- Matrix structural analysis
- Load combinations
- National Building Code of Canada
- Early design
highlights:
- Walls of stone, masonry or concrete 150 mm or thicker carry the floors; a column grid fills the rest at the chosen span.
- Materials follow Canadian standards: steel 350W (E 200 GPa), 30 MPa concrete (E 24.6 GPa = 4500√f′c), glulam 24f-E (E 12.4 GPa, f_b 30.6 MPa).
- Live loads follow NBC 2020 (residential 1.9, office and education 2.4, retail 4.8, industrial 6.0 kPa) and combinations follow NBC Table 4.1.3.2-A, without earthquake.
- The solver reproduces cantilever and simply supported beam results exactly and closes equilibrium to 10⁻¹⁵.
- Roof snow and wind now follow NBC 2020 Sentences 4.1.6.2.(1) and 4.1.7.3.(1) when the user enters the site's S_s, S_r and q (Table C-2); without them they stay at the assumed 1.0 kPa and 0.6 kPa. Still flagged: wall strengths and soil bearing 150 kPa. Two audit findings were corrected: the frame now takes the live load of the chosen occupancy, and no wind sway is reported where bearing walls hold the floors.
---
# Abstract

Architects make structural decisions in early design, spans, grids, wall thicknesses and the choice of system, long before an engineer sizes members [1]. SimuSite's Structure study supports those decisions. From the drawn walls it identifies bearing walls, lays out a column grid for a chosen system (concrete flat plate, steel frame or mass timber), sizes columns, beams and footings with stated rules, and analyses the frame as a linear three-dimensional model under the load combinations of the National Building Code of Canada 2020 [2, 3]. It reports column loads, bending moments, a capacity ratio, storey drift under wind and suggestions such as braces or transfer walls. This report documents the layout rules, loads, materials and solver, and their sources. Material properties, occupancy live loads and load combinations follow Canadian standards; the solver reproduces closed-form beam results and closes equilibrium to machine precision. Several inputs are assumptions: a fixed roof snow load of 1.0 kPa, a wind pressure of 0.6 kPa, wall strengths and a soil bearing pressure. The audit found two defects, both corrected on 21 November 2026: the frame analysis used the residential live load whatever the building's use, and a wind sway of h/2,762,239 was reported because bearing walls act as rigid horizontal supports. The study is a screening for early design; it excludes earthquake, second-order effects and code checks, and an engineer designs the structure.

# Body

## 1. Introduction

Approximate structural design, from span-to-depth rules and tributary areas, has long been part of architectural practice and teaching [1]. Matrix structural analysis of a 3D frame is standard engineering practice and can now run in a browser [4]. Combining the two allows a layout to be generated from the architecture and checked for load paths, member sizes and lateral stiffness, provided its assumptions are visible.

## 2. Method

### 2.1. Layout

Walls of stone, masonry or concrete 150 mm or thicker are taken as bearing walls; glass, gypsum, plaster and thinner walls are partitions. The user can change any wall's role. Grid lines follow bearing wall lines first, then partition lines that split long bays, and lines are added where no wall exists so that bays do not exceed the chosen span (7.5 m by default). Columns stand at grid intersections not on bearing walls. Bearing walls are checked for thickness against their line load; a wall over nothing on the floor below is flagged.

### 2.2. Systems and sizing

| System | Dead load (kPa) | Depth rule | Column design stress |
|---|---|---|---|
| Concrete flat plate | 24 × max(0.2, span/30) + 1.5 | Slab span/30, at least 200 mm | 20 MPa (35 MPa concrete with 2 % steel) |
| Steel frame | 3.0 + 1.5 | Beams span/22 under a 140 mm composite deck | 190 MPa |
| Mass timber | 1.5 + 1.5 | Glulam beams span/18 under 175 mm CLT | 12 MPa |

The 1.5 kPa term is superimposed dead load (finishes and partitions). Columns are sized from their factored load and the column design stress. Pad footings are √(N / 1.4 / q_a) on a side, with the factored load divided by 1.4 to approximate service load and q_a = 150 kPa by default; strip footings under walls are sized the same way.

### 2.3. Loads and combinations

Live loads follow NBC 2020 Table 4.1.5.3 by occupancy: residential and hotel 1.9 kPa, office and education 2.4 kPa, retail 4.8 kPa, industrial 6.0 kPa [2]. **Roof snow and wind from the site (added 23 November 2026).** The study card takes the site's 1-in-50-year ground snow load S_s, the associated rain load S_r and the 1-in-50-year reference velocity pressure q. The user reads these from NBC 2020 Appendix C Table C-2 or the provincial code, as Subsection 1.1.3. requires; SimuSite holds no climatic table.

Roof snow follows Sentence 4.1.6.2.(1) of NBC 2020 [2]: S = I_s [S_s (C_b C_w C_s C_a) + S_r], with S_r not greater than S_s (C_b C_w C_s C_a).
- I_s = 1 for Normal Importance and 1.15 for High at ULS (Table 4.1.6.2.-A). Schools, which the card's "School" occupancy stands for, are High Importance buildings (Table 4.1.2.1.).
- C_b follows Sentence (2)(a). It is 0.8 for a characteristic length l_c = 2w − w²/l ≤ 70/C_w², and (1/C_w)[1 − (1 − 0.8 C_w) exp(−(l_c C_w² − 70)/100)] above it, with w and l the smaller and larger plan dimensions of the drawn building.
- C_w = 1.0 (Sentence (3)). The reductions to 0.75 or 0.5 for exposed rural or northern sites are not offered.
- C_s = 1.0 for a flat roof (Sentence (5)).
- C_a = 1.0, the uniform load case of Sentence (8). Drifts at roof steps and projections, valleys and sliding snow (Articles 4.1.6.5 to 4.1.6.12) are not computed.

Wind follows the Static Procedure of Article 4.1.7.3: p = I_w q C_e C_t C_g C_p.
- I_w is 1 (Normal) or 1.15 (High) at ULS (Table 4.1.7.3.).
- C_e = (h/10)^0.2, not less than 0.9, in open terrain, and 0.7(h/12)^0.3, not less than 0.7, in rough terrain (Sentence (5)). The project's suburban and city terrain are rough terrain, which Clause (5)(b) defines as suburban, urban or wooded.
- h is the roof height, not less than 6 m, for buildings up to 20 m that are lower than their smaller plan dimension (Clause (6)(a)), and the building height otherwise.
- C_t = 1 (no hill or escarpment, Article 4.1.7.4).
- C_g = 2.0 for the building as a whole (Sentence (8)).
- C_p for the main structural system follows Sentence 4.1.7.5.(2): windward 0.6, 0.27(H/D + 2) or 0.8, and leeward −0.3, −0.27(H/D + 0.88) or −0.5, for H/D below 0.25, between 0.25 and 1, and above 1.
- The net load on the building is the windward pressure less the leeward suction (Sentence 4.1.7.3.(2)). The study applies the larger of the two plan directions to both axes of the frame.
- Article 4.1.7.6's C_gC_p values for low buildings are permitted alternatives and are not used. Buildings that are dynamically sensitive (Article 4.1.7.2) need the Dynamic or Wind Tunnel Procedure, which the study does not perform.

The occupancy is chosen on the study card (residential by default) and sets the floor live load of the frame analysis. Roof snow is 1.0 kPa. Wind is a uniform pressure (0.6 kPa by default) on each facade, in both directions along both axes. Load combinations follow NBC Table 4.1.3.2-A [2]: 1.4D; 1.25D + 1.5L + (1.0S or 0.4W); 1.25D + 1.5S + (1.0L or 0.4W); 1.25D + 1.4W + (0.5L or 0.5S); and service combinations for drift. Earthquake (combination 5) is not included.

### 2.4. Frame analysis

The structure becomes a 3D frame of beam elements (six degrees of freedom per node) with slab strips for flat plates and braces as axial members [4]. Supports are at the footings and along bearing walls. The linear static system is solved directly; results include axial force, shear, torsion and bending moment in every member, displacements, normal and von Mises stress, a capacity ratio for screening, and storey drift under service wind, compared with h/400. Where any floor rests on a bearing wall, the wall restrains it horizontally and the floor diaphragm ties the rest of the frame to it, so the frame cannot sway; the study then reports that the walls hold the building against wind and does not give a drift. Material properties are given in Table 1.

## 3. Parameters and their sources

Table 1. Materials, loads and settings of the Structure study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Steel | Grade 350W, E 200 GPa, ρ 7,850 kg/m³ | CSA G40.21; CSA S16 [5] | Sourced |
| Concrete | f′c 30 MPa, E 24.6 GPa, ρ 2,400 kg/m³ | CSA A23.3: E_c = 4500√f′c [6] | Sourced |
| Glulam | Douglas fir 24f-E, E 12.4 GPa, f_b 30.6 MPa | CSA O86 [7] | Sourced |
| W-shape and tube sections | Nominal dimensions, fillets ignored | Steel handbooks [5] | Sourced (slightly conservative) |
| Live loads | 1.9 / 2.4 / 4.8 / 6.0 kPa | NBC 2020 Table 4.1.5.3 [2] | Sourced |
| Live load in the frame analysis | The chosen occupancy's value (residential by default) | NBC 2020 Table 4.1.5.3 [2] | Corrected 21 November 2026; before, residential 1.9 kPa for every building |
| Load combinations | NBC Table 4.1.3.2-A, without E | NBC 2020 [2] | Sourced |
| Roof snow | S = I_s[S_s(C_b C_w C_s C_a) + S_r] from the user's S_s and S_r; 1.0 kPa if not entered | NBC 2020 Sentence 4.1.6.2.(1), (2), (3), (5), (8); Tables 4.1.6.2.-A and 4.1.2.1. [2] | Sourced (23 November 2026); flat roof, uniform load, no drifts; the default 1.0 kPa remains an assumption |
| Wind | p = I_w q C_e C_t C_g (C_p,w − C_p,l) from the user's q; chosen 0.4–1.0 kPa if not entered | NBC 2020 Sentences 4.1.7.3.(1), (2), (5), (6), (8) and 4.1.7.5.(2); Table 4.1.7.3. [2] | Sourced (23 November 2026); static procedure, C_t = 1; the chosen pressure remains an assumption |
| Superimposed dead load | 1.5 kPa | Common allowance [1] | Plausible |
| Span-to-depth rules | Slab /30; steel /22; glulam /18 | Rules of thumb [1] | Plausible for preliminary sizing |
| Wall strengths | 1.5 MPa masonry or stone; 8 MPa concrete | Engine choice | Flagged: no source |
| Soil bearing q_a | 150 kPa | Engine choice | Flagged: site-specific; requires geotechnical data |
| Service load | Factored / 1.4 | Engine choice | Approximation |
| Drift limit | h/400 | Common serviceability limit | Plausible; practice ranges about h/400–h/600 [8] |

## 4. Verification and validation status

The solver contains analytical self-checks, and three test files exercise the layout and analysis. In our runs on 20–21 November 2026 all passed:

- `tests/structure-frame.cjs`: a cantilever's base moment 30.00 kN·m and tip deflection 29.37 mm equal PL and PL³/3EI; a simply supported beam's mid-span moment 22.50 kN·m and end shear 15.00 kN equal wL²/8 and wL/2; a laid-out building of 24 columns and 34 beams (492 unknowns) closes equilibrium to 1.2 × 10⁻¹⁵ with a wind drift of h/292, reduced to h/4,829 by 8 X braces carrying axial force only; a flat plate with 34 slab strips and 20 wall supports is in equilibrium.
- `tests/structure-layout.cjs`: bearing and partition roles from wall materials and thicknesses, grid lines on bearing walls first, columns off bearing walls, an unsupported upper wall flagged, beams in stock sizes, and footing sizes from the stated formulas.
- `tests/workspace-structure-analysis.cjs`: a hospital frame of 198 columns and 345 slab strips (drift h/1,102 against h/400), every result type drawn, load combinations, member selection, braces and CSV export.

In the end-to-end audit on the two-storey audit block (concrete flat plate, 8 of 26 walls bearing), the study laid out a 6 × 3 grid with bays of 4.0–7.0 m and 300 × 300 mm columns, and reported a heaviest factored ground-floor column load of 638 kN, a largest factored moment of 117 kN·m, a highest capacity ratio of 57 % and a wind sway of h/2,762,239. After the correction the study reports instead that the bearing walls hold the floors against wind, with the sway not computed. The three test files above were run again after the corrections and all checks pass.

**Site snow and wind.** `tests/nbc-loads.test.mjs` checks the code formulas:
- C_b at seven rows of Table 4.1.6.2.-B (l_c C_w² from 70 to 620, C_w 1.0, 0.75 and 0.5) agrees within the table's rounding of 0.005.
- S for S_s 2.0 and S_r 0.4 kPa on a small flat roof is 2.0 kPa, and the rain load is capped when S_r exceeds S_s C_b C_w C_s C_a.
- C_e meets its lower limits of 0.9 and 0.7 and the two height formulas.
- C_p meets its three ranges of H/D.
- The net pressure on an 8 m building 30 m deep in open terrain at q 0.45 kPa matches the hand calculation.

On the hospital example in the Workspace, the study without site values gives the same heaviest ground-floor column as before (1,623 kN factored). With S_s 2.0, S_r 0.4 and q 0.45 kPa it uses a roof snow of 2.0 kPa and a net wind pressure of 0.71 kPa, and the heaviest column becomes 1,693 kN.

## 5. Discussion

**Wind sway with bearing walls.** The audit's drift of h/2,762,239 means the frame barely moved, because bearing walls are modelled as supports that restrain the floors horizontally. Walls do provide lateral stiffness, but not infinite stiffness, and masonry walls need to be checked as shear walls. The study now suppresses the drift where bearing walls are supports and states that the walls carry the wind, and that their racking is not checked; the frame-only drift of h/292 in the test, before bracing, shows the order of magnitude when walls do not help. Modelling the walls as shear panels with their own stiffness would let the study report a real drift.

**Loads.** The live loads by occupancy are correct. At the time of the audit the frame analysis used the residential value for every building, which understated loads by 21 % for offices and by 60 % for retail; the occupancy is now chosen on the study card. The roof snow load and the wind pressure now come from the NBC 2020 formulas once the site's climatic values are entered [2]. Outside Canada, the local code's loads should be entered by choosing equivalent values, and the method text says that the NBC formulas were used. SimuSite's Snow and Wind studies use the project weather file; linking the roof snow load to the site's design ground snow load would remove an inconsistency.

**Scope.** The study is linear, first-order and static, without earthquake, connection design, punching shear, vibration or fire. Its capacity ratio is a screening of stress against strength, not a code member check. The method text states that an engineer designs the structure.

## 6. Conclusion

The Structure study's materials, occupancy live loads and NBC load combinations are correctly sourced, and its solver is verified against closed-form solutions. Several loads and strengths are fixed assumptions that should be site-specific, and the lateral stiffness of bearing walls is not modelled, so no drift is given when they carry the wind. As a tool for testing grids, spans and systems against the drawn architecture in early design, it is useful; its numbers should be confirmed by an engineer.

# References

1. E. Allen, J. Iano, The Architect's Studio Companion: Rules of Thumb for Preliminary Design, 6th ed., Wiley, Hoboken, 2017.
2. Canadian Commission on Building and Fire Codes, National Building Code of Canada 2020, Volume 1, Division B, Part 4, Structural design (Articles 4.1.6.2, 4.1.7.3, 4.1.7.5; Tables 4.1.2.1, 4.1.6.2.-A, 4.1.6.2.-B, 4.1.7.3), National Research Council Canada, Ottawa, 2022, NR24-28/2020E-PDF. [publications.gc.ca](https://publications.gc.ca/site/eng/9.897526/publication.html)
3. National Research Council Canada, Structural Commentaries (User's Guide – NBC 2020: Part 4 of Division B), NRC, Ottawa, 2022.
4. W. McGuire, R.H. Gallagher, R.D. Ziemian, Matrix Structural Analysis, 2nd ed., Wiley, New York, 2000.
5. Canadian Institute of Steel Construction, Handbook of Steel Construction, 12th ed., CISC, Markham, 2021 (with CSA S16-19 and CSA G40.21).
6. CSA Group, CSA A23.3:19, Design of concrete structures, CSA, Toronto, 2019.
7. CSA Group, CSA O86:19, Engineering design in wood, CSA, Toronto, 2019.
8. L.G. Griffis, Serviceability limit states under wind load, Eng. J. AISC 30 (1) (1993) 1–16.
