---
id: report-utci
sim: utci
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Outdoor thermal comfort with the Universal Thermal Climate Index: weather, sun and shade, and a SolarCal estimate of mean radiant temperature
type: Method and data report
summary: How the Outdoor thermal comfort study computes UTCI for every hour of an EPW year in sun and shade, the published sources of the polynomial, the stress categories and the radiant-temperature model, its agreement with pythermalcomfort to 1e-12 °C, and what it leaves out.
image: img/home/utci.webp
imageAlt: Share of hours with no thermal stress on the ground around a building
code: emb/lib/climate.js, emb/sunhours.html
tests: tests/validation/climate_lib.py, tests/climate-studies.cjs
keywords:
- UTCI
- Outdoor thermal comfort
- Mean radiant temperature
- SolarCal
- Urban microclimate
highlights:
- UTCI is computed with the official 6th-order polynomial; it matches pythermalcomfort to 1.4 × 10⁻¹² °C.
- Mean radiant temperature combines long-wave exchange with sky and ground and SolarCal short-wave gain.
- Buildings change radiation (sun, sky view) but not wind or air temperature in this study.
- Stress categories follow the published UTCI assessment scale.
- Surface temperatures of sunlit paving and walls are not modelled, so heat stress on hot afternoons is underestimated.
---
# Abstract

The Universal Thermal Climate Index (UTCI) expresses the combined effect of air temperature, humidity, wind and radiation on a person outdoors as the air temperature of a reference environment that would produce the same physiological response [1, 2]. SimuSite's Outdoor thermal comfort study computes the UTCI for every counted hour of an EPW weather year at each ground cell, in sun or in shade as the model dictates, and reports the share of hours with no thermal stress, heat stress and cold stress. Air temperature, humidity and wind come from the weather file; mean radiant temperature (MRT) is estimated from the sky temperature, the cell's sky view and the SolarCal model of short-wave gain on a standing person [3, 4]. This report sets out the model, the provenance of every constant, and the verification: the UTCI polynomial matches pythermalcomfort [5] to 1.4 × 10⁻¹² °C on 6,000 random states, and the short-wave part of MRT matches SolarCal to 0.027 K. The largest simplifications are that buildings do not change wind speed in this study and that sunlit surfaces are assumed to be at air temperature, which underestimates heat stress in sunny, sheltered places.

# Body

## 1. Introduction

Outdoor comfort influences whether squares, courtyards and terraces are used, and is increasingly assessed in planning submissions. Among the many indices proposed, UTCI was developed by COST Action 730 as a physiologically grounded index applicable across climates, based on the multi-node Fiala model of human thermoregulation and an adaptive clothing model [1, 2]. Because the full model is expensive, its authors published a sixth-order polynomial approximation as the operational procedure [2]. Design tools such as Ladybug use the same approximation.

## 2. Method

### 2.1. Inputs from the weather file

For each counted hour, the study reads dry-bulb temperature, relative humidity, wind speed at 10 m, and the radiation fields of the EPW file [6]. Vapour pressure is computed from saturation pressure over water by Hardy's ITS-90 formulation, as in the official UTCI program [2]. The 10 m wind is used as UTCI expects (the index is defined for wind at 10 m), clamped to the polynomial's valid range of 0.5–17 m/s. Wind is not modified by buildings in this study; the Wind flow study addresses that separately.

### 2.2. Mean radiant temperature

MRT for a standing person is the sum of a long-wave and a short-wave part. The long-wave part assumes the upper half of the body exchanges with the sky in proportion to the cell's sky view factor, at a sky temperature derived from the hour's downwelling long-wave radiation in the EPW (or, where it is missing, from a clear-sky emissivity depending on dew point after Berdahl and Martin [7]); the rest of the surroundings, ground and walls, is taken at air temperature. The short-wave part is SolarCal, the model adopted in ASHRAE 55 Appendix C [3, 4]: direct beam on the projected area of the body (the projected-area factor f_p from the ASHRAE 55 table for a standing person, averaged over azimuth), diffuse sky in proportion to sky view, and ground-reflected light at albedo 0.2, with body short-wave absorptivity 0.7, long-wave emissivity 0.95, effective radiating area factor 0.725 and radiative heat transfer coefficient 6 W/m²K. Beam is applied only if the cell sees the sun in that hour, using the same ray test as Sun hours.

### 2.3. UTCI and stress categories

UTCI is then evaluated with the operational polynomial, transcribed from the open pythermalcomfort implementation of the official Fortran routine [2, 5]. Hours are classified on the UTCI assessment scale [1]: below −40 °C extreme cold stress, −40 to −27 very strong, −27 to −13 strong, −13 to 0 moderate, 0 to 9 slight cold stress, 9 to 26 no thermal stress, 26 to 32 moderate heat stress, 32 to 38 strong, 38 to 46 very strong, above 46 extreme heat stress. The study reports, per cell, the share of counted hours with no thermal stress, with heat stress (above 26 °C) and with cold stress (below 9 °C). To keep the run fast, UTCI is precomputed for each hour at 11 sky-view values in sun and in shade and interpolated for each cell.

## 3. Parameters and their sources

Table 1. Inputs and constants of the Outdoor thermal comfort study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| UTCI polynomial | 6th order, official coefficients | Bröde et al. [2]; pythermalcomfort [5] | Sourced, verified |
| Valid range | Ta −50 to 50 °C; Tmrt − Ta −30 to 70 K; va 0.5–17 m/s | UTCI operational procedure [2] | Sourced; out-of-range hours are counted and reported |
| Saturation vapour pressure | Hardy 1998 (ITS-90) | As in the UTCI program [2] | Sourced |
| Stress categories | Ten classes, thresholds above | Jendritzky et al. / Błażejczyk et al. [1, 8] | Sourced |
| Projected-area factor f_p | ASHRAE 55 standing table, mean over azimuth | ASHRAE 55-2020 App. C [3] | Sourced |
| Absorptivity, emissivity, f_eff, h_r | 0.7, 0.95, 0.725, 6 W/m²K | SolarCal defaults [3, 4] | Sourced |
| Ground albedo | 0.2 | Common default | Sourced default |
| Sky temperature | From EPW horizontal IR; else Berdahl & Martin | EPW data dictionary [6]; [7] | Sourced |
| Surroundings temperature | Equal to air temperature | Engine simplification | Assumption, flagged (see Discussion) |
| Wind | EPW 10 m speed, not changed by buildings | Engine simplification | Assumption, flagged |

## 4. Verification

`tests/validation/climate_lib.py` runs the engine's functions in Node and compares them with pythermalcomfort [5]. UTCI on 6,000 random states inside the polynomial's range (air −45 to 48 °C, radiant minus air −25 to 65 K, wind 0.5–16 m/s, humidity 5–100 %): largest difference 1.4 × 10⁻¹² °C (tolerance 0.01 °C). Short-wave MRT gain for a sunlit standing person under an open sky, averaged over facing directions as the engine assumes, against `solar_gain` (SolarCal): 400 states, largest difference 0.027 K, mean 0.007 K (tolerance 0.05 K). The sun/shade test reuses the verified Sun hours ray casting.

The audit run on 20 November 2026 executed the study end to end on a two-storey test block with a Chicago O'Hare TMY3 weather file [9]; it completed and produced per-cell shares without errors.

## 5. Discussion

The verification shows that SimuSite evaluates the published index correctly for the inputs it builds. The uncertainty therefore lies in the inputs, chiefly MRT and wind. Treating all surroundings as at air temperature ignores that sunlit asphalt and south-facing walls can be 10–20 K warmer than the air on summer afternoons, which raises MRT and UTCI by several degrees near them; conversely, shaded north walls and cool vegetation are not credited. Wind is the station's 10 m speed everywhere; in sheltered courtyards the real wind is lower (warmer in winter, more heat stress in summer), and in corners and gaps higher. Results are therefore most reliable for comparing sun and shade patterns between design options under the same weather, and least reliable for absolute heat stress in dense, paved settings, where a tool coupling surface temperatures and CFD wind is needed.

## 6. Conclusion

The study implements UTCI and SolarCal exactly as published and is suited to screening where sun and shade change comfort over a year. Its fixed-wind and air-temperature-surroundings assumptions should be stated with every result.

# References

1. G. Jendritzky, R. de Dear, G. Havenith, UTCI—Why another thermal index?, Int. J. Biometeorol. 56 (2012) 421–428. [doi:10.1007/s00484-011-0513-7](https://doi.org/10.1007/s00484-011-0513-7)
2. P. Bröde, D. Fiala, K. Błażejczyk, I. Holmér, G. Jendritzky, B. Kampmann, B. Tinz, G. Havenith, Deriving the operational procedure for the Universal Thermal Climate Index (UTCI), Int. J. Biometeorol. 56 (2012) 481–494. [doi:10.1007/s00484-011-0454-1](https://doi.org/10.1007/s00484-011-0454-1)
3. ANSI/ASHRAE Standard 55-2020, Thermal Environmental Conditions for Human Occupancy, Appendix C, ASHRAE, Atlanta, 2020.
4. E. Arens, T. Hoyt, X. Zhou, L. Huang, H. Zhang, S. Schiavon, Modeling the comfort effects of short-wave solar radiation indoors, Build. Environ. 88 (2015) 3–9. [doi:10.1016/j.buildenv.2014.09.004](https://doi.org/10.1016/j.buildenv.2014.09.004)
5. F. Tartarini, S. Schiavon, pythermalcomfort: A Python package for thermal comfort research, SoftwareX 12 (2020) 100578. [doi:10.1016/j.softx.2020.100578](https://doi.org/10.1016/j.softx.2020.100578)
6. U.S. Department of Energy, EnergyPlus Auxiliary Programs: EnergyPlus Weather File (EPW) Data Dictionary, EnergyPlus documentation, 2023.
7. P. Berdahl, M. Martin, Emissivity of clear skies, Sol. Energy 32 (1984) 663–664. [doi:10.1016/0038-092X(84)90144-0](https://doi.org/10.1016/0038-092X(84)90144-0)
8. K. Błażejczyk, G. Jendritzky, P. Bröde, D. Fiala, G. Havenith, Y. Epstein, A. Psikuta, B. Kampmann, An introduction to the Universal Thermal Climate Index (UTCI), Geogr. Pol. 86 (2013) 5–10. [doi:10.7163/GPol.2013.1](https://doi.org/10.7163/GPol.2013.1)
9. S. Wilcox, W. Marion, Users Manual for TMY3 Data Sets, NREL/TP-581-43156, National Renewable Energy Laboratory, Golden, CO, 2008.
