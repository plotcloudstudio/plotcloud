---
id: report-daylight
sim: daylight
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Climate-based daylight screening in the browser: sDA, ASE and daylight factor from a 145-patch sky, checked against Radiance
type: Method and data report
summary: How the Daylight study computes spatial daylight autonomy, annual sun exposure and daylight factor; where its sky models, glass model, reflectances and thresholds come from; its agreement with Radiance for the daylight factor; and the limits of its split-flux inter-reflection and its fallback weather.
image: img/home/daylight.webp
imageAlt: Daylight autonomy over a floor plan, brighter near windows
code: mvp/js/interior/daylight.js, mvp/js/workspace-chrome.js
tests: tests/workspace-deepen-1.cjs, tests/validation/daylight_df.py, tests/validation/daylight_engine.cjs, tests/daylight-blinds.test.mjs, tests/shared-conditions.cjs
keywords:
- Daylight
- Spatial daylight autonomy
- Annual sunlight exposure
- Daylight factor
- Radiance
- Split-flux method
highlights:
- Sky light is computed from 145 Tregenza patches with CIE clear and overcast luminance distributions blended by Perez sky clearness.
- Inter-reflected light uses the BRE split-flux formula, so it is uniform within a room.
- After adding angle-dependent glass transmission, the daylight factor agrees with Radiance within max(0.5 points, 25 %) at every test point.
- sDA (300 lux, 50 % of occupied hours) and ASE (1,000 lux, 250 h) follow IES LM-83; since 23 November 2026 blinds close as LM-83-12 describes, and sDA is reported with and without them.
- Without a weather file the study falls back to a synthetic year with random cloud, which should be labelled as such.
---
# Abstract

Daylight metrics have moved from the static daylight factor to climate-based metrics computed over a year of weather [1, 2]. SimuSite's Daylight study computes, on a grid over the work plane of each level, spatial daylight autonomy (sDA300/50 %), annual sunlight exposure (ASE1000/250 h) as defined in IES LM-83 [3], the daylight factor under a CIE overcast sky [4], and the LEED v4.1 option 2 illuminance check [5]. Sky light is computed by tracing horizontal bearings through the plan to find the visible sky in each of 145 Tregenza patches [6], weighting each patch by a luminance distribution that blends the CIE clear sky [4] and the Moon–Spencer overcast sky [7] according to the hour's Perez sky clearness [8], and passing it through clear glass with Fresnel angular transmission. Inter-reflected light is added by the BRE split-flux formula [9, 10]. This report documents each step, the provenance of all parameters, and the validation of the daylight factor against Radiance [11]: after the glass model was corrected, the engine agrees within max(0.5 percentage points, 25 %) at every point of two test rooms, with a remaining positive bias at the back of rooms caused by the uniform split-flux term. Two issues are flagged: blinds are not modelled, which makes sDA and ASE optimistic relative to LM-83's procedure, and when no weather file is available the study uses a synthetic year with random cloud cover.

# Body

## 1. Introduction

The daylight factor (DF), the ratio of indoor to outdoor horizontal illuminance under an overcast sky, has been used for decades because it is independent of orientation and climate [1]. Its independence is also its weakness: it says nothing about sunlight, glare or the actual amount of daylight over a year. Climate-based daylight modelling (CBDM) addresses this by computing illuminance for every daylit hour of a weather year [1, 2]. IES LM-83 standardised two such metrics: sDA300/50 %, the share of floor area that receives at least 300 lux for at least half of the occupied hours, and ASE1000/250, the share receiving more than 1,000 lux of direct sunlight for more than 250 occupied hours [3]. LEED v4.1 credits daylight with these metrics or with a simpler point-in-time illuminance check [5]. Reference CBDM tools such as Radiance with the daylight-coefficient or three-phase methods [11] are too slow for interactive browser use; SimuSite therefore uses a simplified but physically structured method and validates it where possible.

## 2. Method

### 2.1. Geometry

The level's walls, windows (sill and head heights), furniture and the outdoors are rasterised. From each sensor point on the work plane (0.8 m by default), horizontal rays are cast on equally spaced compass bearings. Walls 2 m or taller stop a ray; glazing lets it pass between sill and head; past the outermost pane, buildings outside cut the bottom of the visible sky. For each bearing, the range of altitudes at which sky is visible is kept, and daylight coefficients (horizontal illuminance per unit luminance of each patch, ∫∫ sin a cos a da dφ over the visible part) are summed per patch.

### 2.2. Sky and sun

The sky is divided into Tregenza's 145 patches [6]. For each hour, patch luminances are set so that the sky produces the hour's diffuse horizontal illuminance, with a relative distribution that blends the CIE clear sky (gradation and indicatrix as in the CIE standard general sky [4]) and the Moon–Spencer overcast distribution L(θ) ∝ (1 + 2 sin θ)/3 [7], weighted by the Perez sky clearness ε of the hour [8]. Direct sun is added at its own angle of incidence on the glass if the sun's bearing and altitude fall in the visible range. With an EPW file, direct normal and diffuse horizontal illuminance come from the file (or from irradiance times luminous efficacy where illuminance is missing) [12]. The daylight factor uses the CIE overcast sky with no sun.

### 2.3. Glass

Clear glass transmission depends on the angle of incidence. The engine models a single pane of refractive index 1.52 with Fresnel reflection at both faces, multiple internal reflections and absorption along the oblique path, as Radiance's `glass` material does [11], scaled so that transmission at normal incidence equals the user's value (0.6 by default).

### 2.4. Inter-reflections

Light reflected inside the room is estimated with the BRE split-flux formula [9, 10]: IRC = τ W / (A (1 − R)) × (C R_fw + 5 R_cw), with W the glazed area, A the total internal surface area, R its area-weighted mean reflectance, R_fw and R_cw the mean reflectances of the lower and upper parts of the room, and C a coefficient that falls with the angle of external obstruction (39 at 0°, 35 at 10°, 31 at 20°, 25 at 30°, 20 at 40°, 14 at 50°, 10 at 60°, 7 at 70°, 5 at 80°) [9, 10]. The internally reflected component is added uniformly to every point of the room.

### 2.5. Metrics

Over occupied hours (8:00–18:00 by default, as in LM-83 [3]) the study counts, per point, hours at or above 300 lux (sDA) and hours with direct sun at or above 1,000 lux (ASE), and reports the share of regularly occupied floor meeting sDA300/50 % and exceeding ASE1000/250. LEED option 2 checks 300–3,000 lux at 9:00 and 15:00 on the equinox [5].

**Blinds (added 23 November 2026).** LM-83-12 computes sDA with operable blinds: in any analysis hour in which more than 2 % of the analysis points receive direct sunlight of 1,000 lux or more, the blinds close [3, 15]. When BSDF data are not available, LM-83-12 section 2.2.7 models closed white louvre blinds (reflectance above 80 %) as a 20 % diffuse transmittance for both sunlight and skylight, and a shade of unknown transmittance as 5 % diffuse with no specular transmission [3, 16]. The study implements the trigger exactly: for every occupied hour it counts the points whose direct-sun illuminance (the same quantity ASE uses) reaches 1,000 lux, and closes the blinds of the level in that hour if the count exceeds 2 % of the points. With the blinds closed, the illuminance at a point is taken as the blind transmittance times the hour's illuminance without the sun patch. This omits the sunlight the blind diffuses into the room, so the reported value is a lower bound; the sDA without blinds, which the study also reports, is an upper bound, and an LM-83 sDA lies between them. ASE is counted with the blinds open, because it measures the direct sun that triggers them. The blinds are operated as one group per level; LM-83 users often group them by facade or zone [15], which would shut fewer hours.

## 3. Parameters and their sources

Table 1. Inputs and constants of the Daylight study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Sky subdivision | 145 patches | Tregenza [6] | Sourced |
| Clear-sky luminance distribution | CIE clear sky gradation and indicatrix | CIE S 011 [4] | Sourced |
| Overcast distribution | (1 + 2 sin θ)/3 | Moon & Spencer [7]; CIE overcast [4] | Sourced |
| Clear/overcast blend | By Perez clearness ε, weight (ε − 1)/5.2 clamped to 0–1 | Perez ε [8]; the linear weighting is the engine's | Flagged: a pragmatic blend, not a published sky model (Perez all-weather would be the reference) |
| Synthetic clear-sky illuminance (no EPW) | E_b = 127,500 exp(−0.21 m); E_d = 800 + 15,500 √sin a; overcast 300 + 21,000 sin a | IES Lighting Handbook daylight availability formulae [13]; air mass after Kasten & Young [14] | Sourced |
| Synthetic weather year (no EPW) | Seeded random cloud cover | Engine design | Flagged: not weather data; results must be labelled "no weather file" |
| Glass | n = 1.52, Fresnel, τ_n = 0.6 default | Radiance `glass` [11] | Sourced, validated |
| Reflectances | Floor 0.2, walls 0.5, ceiling 0.8 | Typical design values for light interiors | Assumption, editable; real finishes should be entered |
| Split-flux coefficient C | 39 … 5 by obstruction angle | Hopkinson, Longmore & Petherbridge; BRE [9, 10] | Sourced |
| Work plane | 0.8 m | Common practice for desk height | Sourced default |
| Occupied hours | 8:00–18:00 | IES LM-83 [3] | Sourced |
| sDA / ASE thresholds | 300 lux, 50 %; 1,000 lux, 250 h | IES LM-83 [3]; LEED v4.1 [5] | Sourced |
| Blinds | Close when > 2 % of points get ≥ 1,000 lux direct sun; closed: 20 % (white louvres, default), 5 % (unknown shade) or none | IES LM-83-12, trigger and section 2.2.7 [3, 15, 16] | Sourced trigger and transmittances; closed-blind light omits diffused sunlight, so sDA with blinds is a lower bound (added 23 November 2026) |

## 4. Verification

The daylight factor was validated against Radiance 5 (gensky −c CIE overcast sky, oconv, rtrace with up to 200,000 ambient samples) through pyradiance, and against an independent numerical integral of the overcast sky through the opening (`tests/validation/daylight_df.py`). Test room 5 × 6 × 2.7 m, window 3 m wide from 0.9 to 2.1 m, glass 0.6, reflectances floor 0.2, walls 0.5, ceiling 0.8, ground 0.15; sensors on the centre line 0.5–5.5 m from the window; one open case and one with a building 8 m high 10 m away. Tolerances fixed in advance: sky component within max(0.2 points, 10 %), DF within max(0.5 points, 25 %).

Table 2. Daylight factor, engine against Radiance, open view (from `mvp/VALIDATION.md`).

| Depth | Sky through glass, engine / Radiance | DF engine / Radiance | Difference |
|---|---|---|---|
| 0.5 m | 14.73 / 14.82 | 15.36 / 15.31 | +0.05 pts |
| 1.5 m | 4.46 / 4.46 | 5.08 / 5.05 | +0.03 pts |
| 2.5 m | 1.42 / 1.41 | 2.05 / 1.98 | +0.07 pts |
| 3.5 m | 0.57 / 0.56 | 1.20 / 1.07 | +0.13 pts |
| 4.5 m | 0.27 / 0.27 | 0.90 / 0.66 | +0.25 pts |
| 5.5 m | 0.15 / 0.15 | 0.78 / 0.53 | +0.24 pts |

The two references agree with each other within 0.04 points. Before the angle-dependent glass was introduced, the engine over-predicted DF near the window by 20 % (open) and 26 % (obstructed), outside tolerance; it now passes at every point. With the obstruction, the sky component vanishes beyond 2.5 m in both engine and Radiance, and the remaining error is the inter-reflected component, which the engine spreads evenly (0.47–0.74 points) while Radiance falls to 0.18 points at the back. The climate-based metrics (sDA, ASE) have not yet been compared with Radiance's annual methods. In the end-to-end audit of 20 November 2026 with a Chicago TMY3 file, the study completed on a two-storey test block (sDA 36 %, ASE 7 %, mean DF 1.68 %).

**Blinds.** `tests/daylight-blinds.test.mjs` runs the engine on a 6 × 8 m room with one 4 m window wall in Toronto's generic year, turned to four compass directions. It checks that without blinds no hour is shut and sDA equals the open-window value; that with blinds no point gains daylit hours, ASE is unchanged, and a 5 % shade lowers sDA at least as much as 20 % louvres; and that a window turned to the sun shuts the blinds in many hours while one turned away from it shuts them in far fewer. In that room the blinds closed in 2,874 of 3,532 occupied daylit hours with the window facing the equator, and in 73 hours facing the pole (low summer sun); sDA fell from 46.9 % without blinds to 9.4 % with louvres facing the equator, and was unchanged facing the pole. The large drop facing the equator shows how much the omitted diffused sunlight matters in a sunny room, and why both bounds are reported. On the hospital example's ground floor in the Workspace (`tests/workspace-deepen-1.cjs`), sDA was 19 % without blinds and 6 % with louvres.

## 5. Discussion

For the daylight factor, the engine is accurate where daylight is strong and biased high where it is weak, because the split-flux method distributes reflected light uniformly. At points whose sky component is below about 1 %, DF can be over-predicted by a factor of two in absolute terms of a few tenths of a point; claims that "the back of the room reaches 2 % DF" should be checked with a ray tracer. The sky blend is a reasonable interpolation between two standard skies, but it is not the Perez all-weather luminance model used by Radiance's gendaymtx; ASE and sDA may therefore differ from reference CBDM by more than DF does. LM-83 computes sDA with blinds closed in hours when more than 2 % of sensors receive more than 1,000 lux of direct sun [3]. The engine now applies that rule, but without the sunlight the blinds diffuse, so it reports a range (with blinds, a lower bound; without, an upper bound) rather than an LM-83 value, and neither should be used for credit claims. Finally, the fallback synthetic year produces climate-like but fictitious results; the interface should state "no weather file" prominently whenever it is used.

## 6. Conclusion

Daylight in SimuSite combines standard sky models, a validated glass model and the BRE split-flux method. Its daylight factor agrees with Radiance within the stated tolerance; its sDA (reported with LM-83 blinds as a lower bound and without blinds as an upper bound) and ASE are screening estimates and should be confirmed with an annual Radiance simulation for certification.

# References

1. C.F. Reinhart, J. Mardaljevic, Z. Rogers, Dynamic daylight performance metrics for sustainable building design, LEUKOS 3 (2006) 7–31. [doi:10.1582/LEUKOS.2006.03.01.001](https://doi.org/10.1582/LEUKOS.2006.03.01.001)
2. J. Mardaljevic, L. Heschong, E. Lee, Daylight metrics and energy savings, Light. Res. Technol. 41 (2009) 261–283. [doi:10.1177/1477153509339703](https://doi.org/10.1177/1477153509339703)
3. Illuminating Engineering Society, IES LM-83-12, Approved Method: IES Spatial Daylight Autonomy (sDA) and Annual Sunlight Exposure (ASE), IES, New York, 2012.
4. CIE S 011/E:2003 (ISO 15469:2004), Spatial distribution of daylight – CIE standard general sky, Commission Internationale de l'Éclairage, Vienna, 2003.
5. U.S. Green Building Council, LEED v4.1 Building Design and Construction, EQ credit: Daylight, USGBC, Washington, DC, 2019.
6. P.R. Tregenza, Subdivision of the sky hemisphere for luminance measurements, Light. Res. Technol. 19 (1987) 13–14.
7. P. Moon, D.E. Spencer, Illumination from a non-uniform sky, Illum. Eng. 37 (1942) 707–726.
8. R. Perez, R. Seals, J. Michalsky, All-weather model for sky luminance distribution—preliminary configuration and validation, Sol. Energy 50 (1993) 235–245. [doi:10.1016/0038-092X(93)90017-I](https://doi.org/10.1016/0038-092X(93)90017-I)
9. R.G. Hopkinson, J. Longmore, P. Petherbridge, An empirical formula for the computation of the indirect component of daylight factor, Trans. Illum. Eng. Soc. 19 (1954) 201–219.
10. P.R. Tregenza, Modification of the split-flux formulae for mean daylight factor and internal reflected component with large external obstructions, Light. Res. Technol. 21 (1989) 125–128.
11. G.J. Ward, The RADIANCE lighting simulation and rendering system, in: Proc. SIGGRAPH '94, ACM, 1994, pp. 459–472. [doi:10.1145/192161.192286](https://doi.org/10.1145/192161.192286)
12. U.S. Department of Energy, EnergyPlus Auxiliary Programs: EnergyPlus Weather File (EPW) Data Dictionary, EnergyPlus documentation, 2023.
13. Illuminating Engineering Society, The Lighting Handbook, 10th ed., chapter on daylighting, IES, New York, 2011.
14. F. Kasten, A.T. Young, Revised optical air mass tables and approximation formula, Appl. Opt. 28 (1989) 4735–4738. [doi:10.1364/AO.28.004735](https://doi.org/10.1364/AO.28.004735)
15. A. Aman, LM-83 simulation challenges, presentation at the 16th International Radiance Workshop, Portland, OR, 2017. [radiance-online.org](https://www.radiance-online.org/community/workshops/2017-portland-or/presentations/08_AMAN_LM83SimulationChallenges.pdf) (states the trigger: blinds engage if more than 2 % of the analysis area receives direct sunlight of 1,000 lux).
16. M. Sadeghipour Roudsari and others, Blinds/shades operation in sDA calculation, Ladybug Tools forum, 2017–2018. [discourse.ladybug.tools](https://discourse.ladybug.tools/t/blinds-shades-operation-in-sda-calculation/2546) (quotes LM-83-12 section 2.2.7 on blind transmittances; a transcription, to be checked against the standard, whose 2023 revision may differ).
