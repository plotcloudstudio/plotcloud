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
tests: tests/structure-layout.cjs, tests/structure-frame.cjs, tests/workspace-structure-analysis.cjs
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
- Flagged: roof snow fixed at 1.0 kPa, wind pressure 0.6 kPa, wall strengths, soil bearing 150 kPa and the frame analysis using the residential live load for every building; wind sway is not meaningful where bearing walls are modelled as horizontal supports.
---
# Abstract

Architects make structural decisions in early design, spans, grids, wall thicknesses and the choice of system, long before an engineer sizes members [1]. SimuSite's Structure study supports those decisions. From the drawn walls it identifies bearing walls, lays out a column grid for a chosen system (concrete flat plate, steel frame or mass timber), sizes columns, beams and footings with stated rules, and analyses the frame as a linear three-dimensional model under the load combinations of the National Building Code of Canada 2020 [2, 3]. It reports column loads, bending moments, a capacity ratio, storey drift under wind and suggestions such as braces or transfer walls. This report documents the layout rules, loads, materials and solver, and their sources. Material properties, occupancy live loads and load combinations follow Canadian standards; the solver reproduces closed-form beam results and closes equilibrium to machine precision. Several inputs are assumptions: a fixed roof snow load of 1.0 kPa, a wind pressure of 0.6 kPa, wall strengths and a soil bearing pressure; and the frame analysis uses the residential live load whatever the building's use. In the audit, wind sway was reported as h/2,762,239 because bearing walls act as rigid horizontal supports; this value is not meaningful. The study is a screening for early design; it excludes earthquake, second-order effects and code checks, and an engineer designs the structure.

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

Live loads follow NBC 2020 Table 4.1.5.3 by occupancy: residential and hotel 1.9 kPa, office and education 2.4 kPa, retail 4.8 kPa, industrial 6.0 kPa [2]. Roof snow is 1.0 kPa. Wind is a uniform pressure (0.6 kPa by default) on each facade, in both directions along both axes. Load combinations follow NBC Table 4.1.3.2-A [2]: 1.4D; 1.25D + 1.5L + (1.0S or 0.4W); 1.25D + 1.5S + (1.0L or 0.4W); 1.25D + 1.4W + (0.5L or 0.5S); and service combinations for drift. Earthquake (combination 5) is not included.

### 2.4. Frame analysis

The structure becomes a 3D frame of beam elements (six degrees of freedom per node) with slab strips for flat plates and braces as axial members [4]. Supports are at the footings and along bearing walls. The linear static system is solved directly; results include axial force, shear, torsion and bending moment in every member, displacements, normal and von Mises stress, a capacity ratio for screening, and storey drift under service wind, compared with h/400. Material properties are given in Table 1.

## 3. Parameters and their sources

Table 1. Materials, loads and settings of the Structure study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Steel | Grade 350W, E 200 GPa, ρ 7,850 kg/m³ | CSA G40.21; CSA S16 [5] | Sourced |
| Concrete | f′c 30 MPa, E 24.6 GPa, ρ 2,400 kg/m³ | CSA A23.3: E_c = 4500√f′c [6] | Sourced |
| Glulam | Douglas fir 24f-E, E 12.4 GPa, f_b 30.6 MPa | CSA O86 [7] | Sourced |
| W-shape and tube sections | Nominal dimensions, fillets ignored | Steel handbooks [5] | Sourced (slightly conservative) |
| Live loads | 1.9 / 2.4 / 4.8 / 6.0 kPa | NBC 2020 Table 4.1.5.3 [2] | Sourced |
| Live load in the frame analysis | Residential 1.9 kPa for every building | Engine choice | Flagged: understates offices, schools and retail |
| Load combinations | NBC Table 4.1.3.2-A, without E | NBC 2020 [2] | Sourced |
| Roof snow | 1.0 kPa | Engine choice | Flagged: not from the site's ground snow load; NBC S = I_s [S_s(C_b C_w C_s C_a) + S_r] [2] |
| Wind | Uniform 0.6 kPa | Engine choice | Flagged: not from NBC q, C_e, C_g, C_p [2] |
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

In the end-to-end audit on the two-storey audit block (concrete flat plate, 8 of 26 walls bearing), the study laid out a 6 × 3 grid with bays of 4.0–7.0 m and 300 × 300 mm columns, and reported a heaviest factored ground-floor column load of 638 kN, a largest factored moment of 117 kN·m, a highest capacity ratio of 57 % and a wind sway of h/2,762,239.

## 5. Discussion

**Wind sway with bearing walls.** The audit's drift of h/2,762,239 means the frame barely moved, because bearing walls are modelled as supports that restrain the floors horizontally. Walls do provide lateral stiffness, but not infinite stiffness, and masonry walls need to be checked as shear walls. Where bearing walls are supports, the reported drift should be suppressed or replaced by a statement that the walls carry wind, with a note to check them; the frame-only drift of h/292 in the test, before bracing, shows the order of magnitude when walls do not help.

**Loads.** The live loads by occupancy are correct, but the frame analysis uses the residential value for every building, which understates loads by 21 % for offices and by 60 % for retail. The roof snow load and the wind pressure are fixed values; in Canada they should come from the NBC climatic data for the site [2], and elsewhere from the local code. SimuSite's Snow and Wind studies use the project weather file; linking the roof snow load to the site's design ground snow load would remove an inconsistency.

**Scope.** The study is linear, first-order and static, without earthquake, connection design, punching shear, vibration or fire. Its capacity ratio is a screening of stress against strength, not a code member check. The method text states that an engineer designs the structure.

## 6. Conclusion

The Structure study's materials, occupancy live loads and NBC load combinations are correctly sourced, and its solver is verified against closed-form solutions. Several loads and strengths are fixed assumptions that should be site- and use-specific, and the wind sway result is not meaningful when bearing walls are treated as supports. As a tool for testing grids, spans and systems against the drawn architecture in early design, it is useful; its numbers should be confirmed by an engineer.

# References

1. E. Allen, J. Iano, The Architect's Studio Companion: Rules of Thumb for Preliminary Design, 6th ed., Wiley, Hoboken, 2017.
2. National Research Council Canada, National Building Code of Canada 2020, Division B, Part 4, Structural design, NRC, Ottawa, 2022.
3. National Research Council Canada, Structural Commentaries (User's Guide – NBC 2020: Part 4 of Division B), NRC, Ottawa, 2022.
4. W. McGuire, R.H. Gallagher, R.D. Ziemian, Matrix Structural Analysis, 2nd ed., Wiley, New York, 2000.
5. Canadian Institute of Steel Construction, Handbook of Steel Construction, 12th ed., CISC, Markham, 2021 (with CSA S16-19 and CSA G40.21).
6. CSA Group, CSA A23.3:19, Design of concrete structures, CSA, Toronto, 2019.
7. CSA Group, CSA O86:19, Engineering design in wood, CSA, Toronto, 2019.
8. L.G. Griffis, Serviceability limit states under wind load, Eng. J. AISC 30 (1) (1993) 1–16.
