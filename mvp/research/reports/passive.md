---
id: report-passive
sim: passive
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: A psychrometric screen for passive design opportunities: what the weather allows, and what the thresholds rest on
type: Method and data report
summary: The Passive design strategies study plots each hour of the weather file on a psychrometric chart and counts hours in which solar heating, shading, evaporative cooling or night cooling may be worth investigating. This report sets out the psychrometrics, traces the idea to Olgyay and Givoni, and flags the specific thresholds as design assumptions.
image: img/home/passive.webp
imageAlt: Hourly weather points on a psychrometric chart with the screening band marked
code: mvp/js/environment/analysis.js, mvp/js/environment/plots.js
tests: tests/environment-analysis.cjs
keywords:
- Psychrometric chart
- Bioclimatic chart
- Passive design
- Givoni
- Weather screening
highlights:
- Each hour is placed by dry-bulb temperature and humidity ratio, computed with the Hyland–Wexler saturation equations.
- The screening band (18–26 °C, RH 30–70 %) and the strategy thresholds are editable design assumptions, not a comfort standard.
- Categories overlap and count weather hours only; they are not predictions of indoor comfort or energy savings.
- The approach follows the bioclimatic charts of Olgyay and Givoni, simplified to transparent rules.
- Psychrometric conversions are checked against an independent reference.
---
# Abstract

Bioclimatic charts relate the outdoor climate to the design strategies that could make a building comfortable without mechanical systems [1, 2, 3]. SimuSite's Passive design strategies study places every hour of the project's EPW year on a psychrometric chart, by dry-bulb temperature and humidity ratio, and counts the hours that fall in a user-reviewed screening band and in seven overlapping opportunity categories: cold hours, hot hours, cold and sunny (investigate solar heating), hot and sunny (investigate shading), hot and dry (investigate evaporative cooling), and mild nights (investigate night ventilation). This report documents the psychrometric calculations, which follow ASHRAE and Hyland–Wexler [4, 5] and are verified, and the thresholds, which are transparent design assumptions inspired by the Givoni and Milne–Givoni charts [2, 3] rather than values taken from them. The study describes what the weather permits; it does not predict indoor comfort.

# Body

## 1. Introduction

Olgyay's bioclimatic chart [1] and Givoni's building bioclimatic chart [2], later developed by Milne and Givoni [3] and implemented in tools such as Climate Consultant, map zones of the psychrometric chart to passive strategies: internal gains and passive solar heating in cool conditions, shading and natural ventilation in warm ones, evaporative cooling in hot-dry ones, and thermal mass with night ventilation where diurnal swings are large. Counting the hours of a weather year in each zone gives a quick sense of which strategies are worth pursuing. The boundaries of those zones in the literature depend on building type, construction and assumptions about occupants, and differ between authors.

## 2. Method

### 2.1. Psychrometrics

For each hour with a valid relative humidity, the saturation vapour pressure is computed with the Hyland–Wexler equations [5] as given in ASHRAE Fundamentals [4], over ice below the triple point and over water above it. The partial pressure of water vapour is p_v = RH · p_ws, and the humidity ratio W = 0.621945 p_v / (p − p_v), with p the hourly station pressure from the EPW or, if missing, the standard-atmosphere pressure at the station elevation [4]. Hours without humidity are excluded and counted.

### 2.2. Categories

With a lower and upper temperature (default 18 and 26 °C), the study counts hours:

- in the screening band: lower ≤ T ≤ upper and 30 % ≤ RH ≤ 70 %;
- cold: T < lower; hot: T > upper;
- cold and global horizontal irradiance above 150 W/m²: investigate solar access;
- hot and GHI above 200 W/m²: investigate shading;
- hot and RH below 40 %: investigate evaporative cooling;
- between 20:00 and 06:00 with 12 °C ≤ T ≤ 20 °C: investigate night cooling.

Categories overlap; shares are given relative to the hours eligible for each (those with the data it needs).

## 3. Parameters and their sources

Table 1. Thresholds and constants of the Passive design strategies study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Saturation pressure | Hyland–Wexler over ice / water | Hyland & Wexler [5]; ASHRAE [4] | Sourced, verified |
| Humidity ratio | 0.621945 p_v / (p − p_v) | ASHRAE Fundamentals [4] | Sourced |
| Standard-atmosphere pressure | 101,325 (1 − 2.25577 × 10⁻⁵ z)^5.2559 Pa | ASHRAE Fundamentals [4] | Sourced |
| Screening band | 18–26 °C, RH 30–70 % (editable) | Engine default, of the order of the comfort zones in [2, 3] | Assumption, flagged: not ASHRAE 55 or an adaptive model |
| Solar heating | Cold and GHI > 150 W/m² | Engine default | Assumption, flagged |
| Shading | Hot and GHI > 200 W/m² | Engine default | Assumption, flagged |
| Evaporative cooling | Hot and RH < 40 % | Engine default; direction consistent with [2, 3] | Assumption, flagged |
| Night cooling | 20:00–06:00, 12–20 °C | Engine default | Assumption, flagged |

The audit found the physics sourced and correct, and the strategy thresholds to be the engine's own choices. They are reasonable and stated on screen, but they are not taken from Givoni or Milne–Givoni, whose zones are drawn on the chart with different boundaries (and depend on humidity ratio as well as temperature). The interface already states that the band "is not a PMV/adaptive comfort zone".

## 4. Verification

`tests/environment-analysis.cjs`, re-run for this audit, passes its checks of the psychrometric functions against an independent reference, of the category counting, and of blocking when humidity is missing, without any indoor comfort claim. The study ran end to end with the Chicago O'Hare TMY3 file in the audit.

In the end-to-end audit of 20 November 2026, starting this study from the Workspace returned "This study does not run here yet."; it runs on its own environment page, which the study card opens, and the checks above were made there and in the test script. A Workspace user who does not follow the link sees no result, which should be made clearer.

## 5. Discussion

The screen is honest about what it counts: hours of outdoor weather meeting simple conditions. Whether a strategy works depends on the building: a heavy, well-insulated house exploits night cooling far better than a lightweight office, and passive solar heating needs south glazing and thermal mass. Readers should therefore use the categories to decide what to investigate in more detailed studies (Daylight, Natural ventilation, Solar radiation), not as evidence that a strategy will deliver comfort. A future version could implement the published Givoni–Milne zones explicitly, with their source, alongside the current transparent rules.

## 6. Conclusion

The Passive design strategies study computes psychrometric quantities correctly and counts weather hours by transparent but assumed thresholds. Those thresholds should be cited as SimuSite's screening rules, not as a published bioclimatic chart.

# References

1. V. Olgyay, Design with Climate: Bioclimatic Approach to Architectural Regionalism, Princeton University Press, Princeton, NJ, 1963.
2. B. Givoni, Comfort, climate analysis and building design guidelines, Energy Build. 18 (1992) 11–23. [doi:10.1016/0378-7788(92)90047-K](https://doi.org/10.1016/0378-7788(92)90047-K)
3. M. Milne, B. Givoni, Architectural design based on climate, in: D. Watson (Ed.), Energy Conservation Through Building Design, McGraw-Hill, New York, 1979, pp. 96–113.
4. ASHRAE, ASHRAE Handbook—Fundamentals, chapter 1, Psychrometrics, ASHRAE, Atlanta, 2021.
5. R.W. Hyland, A. Wexler, Formulations for the thermodynamic properties of the saturated phases of H2O from 173.15 K to 473.15 K, ASHRAE Trans. 89 (2A) (1983) 500–519.
