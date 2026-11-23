---
id: report-shadebenefit
sim: shadebenefit
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Is this shade welcome? A degree-hour shade benefit method for the ground and facades
type: Method and data report
summary: The Shade benefit study weighs each hour of shade a design casts by how hot or cold the air is, giving net degree-hours of benefit. This report traces the method to SHADERADE and Ladybug, states its fixed comfort band, and flags that it is a weather-based screening, not a load or comfort result.
image: img/home/shadebenefit.webp
imageAlt: Shade benefit on the ground, blue where the design's shade helps in hot hours and red where it takes sun in cold hours
code: mvp/js/workspace-chrome.js, mvp/js/environment/analysis.js
tests: tests/environment-analysis.cjs, tests/workspace-deepen-1.cjs
keywords:
- Shade benefit
- Degree-hours
- Shading design
- Outdoor comfort
- Ladybug
highlights:
- Each sun-up hour in which the design blocks the sun scores (T − 26 °C)⁺ as benefit and (18 °C − T)⁺ as harm.
- Only shade added by the design counts: hours already shaded by the context are excluded.
- The method follows the temperature-based shade benefit idea of SHADERADE and Ladybug.
- The comfort band 18–26 °C is fixed in the Workspace; it is a design assumption, not a standard.
- Radiation intensity, wind and humidity are ignored.
---
# Abstract

Shade is beneficial in hot hours and costly in cold ones. Sargent, Niemasz and Reinhart's SHADERADE method evaluated each cell of a candidate shading device by the energy consequence of the sun it blocks [1], and Ladybug's thermal shade benefit component simplified this to a temperature criterion: each hour of shade counts as beneficial when air temperature is above a comfort band and harmful when it is below [2]. SimuSite's Shade benefit study applies that temperature criterion to the ground and building faces: for every sun-up hour of an EPW year, a sample is scored if the design (but not the existing context) blocks the beam, by the degrees above 26 °C as benefit and the degrees below 18 °C as harm. The net degree-hours map shows where the design's shade helps and where its sun is missed. This report sets out the method and its parameters and flags that the 18–26 °C band is a design assumption rather than a cited standard, and that the method does not account for radiation intensity, wind or humidity.

# Body

## 1. Introduction

Shading devices and the shade of buildings themselves are designed by intuition more often than by analysis. A simple, defensible screen asks, hour by hour, whether a place would rather be in sun or shade. Olgyay's bioclimatic approach first framed shading periods by the air temperature at which people prefer shade [3]. SHADERADE quantified the benefit of each element of a shading device with energy simulation [1], and Ladybug offers both an energy-based and a temperature-based shade benefit [2]. SimuSite implements the temperature-based version for outdoor space and envelopes.

## 2. Method

For each hour of the EPW with direct normal irradiance above zero and the sun above the horizon, the sun position is computed (the same NOAA/Ladybug sun path as Sun hours). Hours are grouped by sun direction into 15° azimuth by 10° altitude bins, and each bin keeps two sums: Σ max(0, T − T_upper) and Σ max(0, T_lower − T), where T is the hour's dry-bulb temperature. For each ground sample, a ray is cast towards each bin's direction twice, once through the existing context alone and once through the design; if the context already blocks the sun, the hour is not counted; if only the design blocks it, the bin's benefit sum is added as help and its harm sum as harm. The map shows help − harm in degree-hours. On facade and roof squares, the study reports the sun received in hot hours minus that in cold hours, in the same units, to show where shade on that face would help.

**UTCI criterion (added 23 November 2026).** Air temperature alone does not say whether a person in the sun wants shade. The Workspace study can now score hours by the Universal Thermal Climate Index instead. For each hour with the sun up and direct normal irradiance above zero, UTCI is computed for a person standing in open sun: sky view factor 1, the station's 10 m wind (the height at which UTCI takes its wind input [8]), and the mean radiant temperature of the Outdoor thermal comfort study, whose short-wave part is the SolarCal model of ASHRAE Standard 55 Appendix C [6, 7]. The scoring band becomes the "no thermal stress" category of the UTCI assessment scale, 9 to 26 °C [5, 8]. An hour of shade counts for each degree of UTCI at or above 26 °C (moderate heat stress and above) and against for each degree below 9 °C (slight cold stress and below). The sun-direction bins and the comparison with and without the design are unchanged.

In the environmental version of the study, the candidate shade is any set of model objects the user selects; the same scoring compares the model with and without them on a sample grid of up to 512 points.

## 3. Parameters and their sources

Table 1. Inputs of the Shade benefit study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Weather | Project EPW, hourly dry-bulb and DNI | EPW data dictionary [4] | Measured / typical-year data |
| Lower and upper temperature | 18 °C and 26 °C (fixed in the Workspace; editable in the environmental version) | Engine default | Assumption, flagged: no standard is cited; 26 °C coincides with the upper bound of "no thermal stress" on the UTCI scale [5] but is applied here to air temperature |
| UTCI criterion (Workspace option) | Shade wanted at UTCI ≥ 26 °C, unwanted below 9 °C, for a person in open sun | UTCI assessment scale [5, 8]; UTCI and its mean radiant temperature as in the Outdoor thermal comfort report [6, 7, 8] | Sourced band; radiant surfaces at air temperature, so heat stress near hot paving is underestimated (added 23 November 2026) |
| Sun direction bins | 15° × 10° | Engine design | Numerical setting |
| Scoring | Degree-hours above / below the band | Ladybug thermal shade benefit [2]; after SHADERADE [1] | Sourced method |
| Sun position | NOAA / Ladybug sun path | See the Sun hours report | Verified |

## 4. Verification

`tests/environment-analysis.cjs`, re-run for this audit (all checks pass), verifies the environmental version's degree-hour scoring on a roof over a sample in a constant 30 °C month (benefit 31 days × 6 h × 4 K) and that hours already shaded by the context are not counted twice. The Workspace version uses the same scoring with sun-direction bins. There is no external reference implementation that uses exactly these bins and band, so the study is classed as a screening estimate. It ran without error in the end-to-end audit of 20 November 2026 with a Chicago TMY3 file.

The UTCI criterion reuses the UTCI polynomial and mean radiant temperature that the Outdoor thermal comfort report verifies against pythermalcomfort. `tests/workspace-deepen-1.cjs` runs both criteria in the Workspace on the hospital example with its Toronto weather and checks that the method text and settings state the criterion. With air temperature the mean net benefit on the ground was −1 K·h; with UTCI in the sun it was −785 K·h. In Toronto a person standing in the sun is below 9 °C UTCI in many sunny hours, so shading the ground costs more warmth than it saves heat once radiation and wind are counted.

## 5. Discussion

The method answers a narrow question well: given the climate, in which hours is shade wanted, and does this design provide it there? Its simplicity is also its limit. Air temperature alone does not determine whether shade is wanted: at 24 °C with strong sun and still air a person may prefer shade, while at 28 °C with wind and low sun they may not. A radiation-aware criterion is more defensible for outdoor space; the Workspace now offers one, based on UTCI in the sun (Section 2). For buildings, the energy consequence of shading depends on glazing, internal gains and HVAC, which the SHADERADE energy-based method captures and this one does not [1]. The fixed band should be visible in the interface and editable; the report recommends exposing it in the Workspace as it is in the environmental version.

## 6. Conclusion

Shade benefit is a transparent temperature-weighted screening of where a design's shade helps or hurts. Its band of 18–26 °C is an assumption; results should be compared between options with the same band and not read as energy or comfort predictions.

# References

1. J.A. Sargent, J. Niemasz, C.F. Reinhart, SHADERADE: combining Rhinoceros and EnergyPlus for the design of static exterior shading devices, in: Proc. Building Simulation 2011, IBPSA, Sydney, 2011, pp. 310–317.
2. M.S. Roudsari, M. Pak, Ladybug: a parametric environmental plugin for Grasshopper to help designers create an environmentally-conscious design, in: Proc. Building Simulation 2013, IBPSA, Chambéry, 2013, pp. 3128–3135.
3. V. Olgyay, Design with Climate: Bioclimatic Approach to Architectural Regionalism, Princeton University Press, Princeton, NJ, 1963.
4. U.S. Department of Energy, EnergyPlus Auxiliary Programs: EnergyPlus Weather File (EPW) Data Dictionary, EnergyPlus documentation, 2023.
5. K. Błażejczyk, G. Jendritzky, P. Bröde, D. Fiala, G. Havenith, Y. Epstein, A. Psikuta, B. Kampmann, An introduction to the Universal Thermal Climate Index (UTCI), Geogr. Pol. 86 (2013) 5–10. [doi:10.7163/GPol.2013.1](https://doi.org/10.7163/GPol.2013.1)
6. ANSI/ASHRAE Standard 55-2020, Thermal Environmental Conditions for Human Occupancy, Appendix C (SolarCal), ASHRAE, Atlanta, 2020.
7. E. Arens, T. Hoyt, X. Zhou, L. Huang, H. Zhang, S. Schiavon, Modeling the comfort effects of short-wave solar radiation indoors, Build. Environ. 88 (2015) 3–9. [doi:10.1016/j.buildenv.2014.09.004](https://doi.org/10.1016/j.buildenv.2014.09.004)
8. P. Bröde, D. Fiala, K. Błażejczyk, I. Holmér, G. Jendritzky, B. Kampmann, B. Tinz, G. Havenith, Deriving the operational procedure for the Universal Thermal Climate Index (UTCI), Int. J. Biometeorol. 56 (2012) 481–494. [doi:10.1007/s00484-011-0454-1](https://doi.org/10.1007/s00484-011-0454-1)
