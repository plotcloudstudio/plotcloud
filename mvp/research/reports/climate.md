---
id: report-climate
sim: climate
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Reading the weather file before designing: monthly climate summaries, degree days and wind roses from EPW data
type: Method and data report
summary: The Climate analysis study summarises the project's EPW weather file: monthly temperatures, humidity, radiation, wind roses, and heating and cooling degree days from complete days. This report documents the data source, the definitions and base temperatures, the missing-data rules and their verification.
image: img/home/climate.webp
imageAlt: Monthly temperature range and wind rose of a project's weather file
code: mvp/js/environment/analysis.js, mvp/js/environment/plots.js, mvp/js/project-climate.js
tests: tests/environment-analysis.cjs, tests/environment-ui.cjs
keywords:
- Climate analysis
- EPW
- Degree days
- Wind rose
- Typical meteorological year
highlights:
- All figures come directly from the hourly records of the project's EPW file; no values are synthesised.
- Degree days use daily mean temperature over complete days only, with bases 18 °C (heating) and 24 °C (cooling) by default.
- Missing humidity, radiation and wind records are excluded and counted, never filled with zeros.
- Wind roses use 16 sectors of 22.5° and treat speeds below 0.5 m/s as calm.
- The analysis describes outdoor weather; it is not an indoor comfort or energy prediction.
---
# Abstract

Before analysing a design, architects need to understand the climate it will face. SimuSite's Climate analysis study reads the project's hourly weather file in EnergyPlus (EPW) format [1] and reports monthly air temperature (mean, minimum, maximum), relative humidity, global horizontal irradiation, wind speed, a 16-sector wind rose, and heating and cooling degree days. Weather files are usually typical meteorological years (TMY) assembled from multi-year records [2, 3]; SimuSite obtains them for the project's location from the climate.onebuilding.org repository or accepts the user's own file. This report documents the data source, definitions, defaults and missing-data rules, and the verification of calendar handling and units. Degree days are computed from daily mean temperatures over complete days with base temperatures of 18 °C (heating) and 24 °C (cooling) by default; the heating base follows common European and Canadian practice, while the cooling base is a design default that differs from the 18 °C (65 °F) used in some national statistics and is flagged as such.

# Body

## 1. Introduction

Climate-responsive design begins with the weather: when it is cold, hot, humid or windy, and from which direction the wind and sun come [4]. Typical meteorological year files condense long records into one representative year by selecting, month by month, the observed month whose statistics are closest to the long-term distribution [2]. They are the standard input to building simulation and are distributed in the EPW format [1]. A climate summary is the architect's first look at that file and a check that it is the right one.

## 2. Method

### 2.1. Data source and parsing

The project's EPW is downloaded automatically for the nearest station from climate.onebuilding.org, a repository of TMYx and other typical-year files derived from ISD and other national records [3], through SimuSite's weather service, or uploaded by the user. The station name, coordinates, elevation and time zone are read from the LOCATION header, and each of the 8,760 (or 8,784) hourly rows provides dry-bulb temperature, relative humidity, atmospheric pressure, global horizontal irradiance, wind direction and speed, in the field order of the EnergyPlus data dictionary [1]. EPW missing-value codes (for instance 999.9 for temperature or 9999 for radiation) are treated as missing.

### 2.2. Summaries

For a selected period of months and hours, the study computes per month the number of hours, the mean, minimum and maximum temperature, mean relative humidity, global horizontal irradiation in kWh/m², and mean wind speed. Missing records are excluded from each statistic and their counts reported. The wind rose bins hours with valid speed and direction into 16 sectors of 22.5° centred on the cardinal and intercardinal directions; hours below 0.5 m/s are counted as calm.

### 2.3. Degree days

Heating and cooling degree days are computed from complete days only: for each day with 24 valid hourly temperatures, the daily mean T̄ is formed and HDD += max(0, T_b,h − T̄), CDD += max(0, T̄ − T_b,c). Days with missing hours are not counted, and months with no complete day show no value. The bases default to 18 °C for heating and 24 °C for cooling and can be changed from −20 to 35 °C and −20 to 40 °C.

## 3. Parameters and their sources

Table 1. Inputs and definitions of the Climate analysis study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Weather file | EPW, typical year (TMYx) or user file | climate.onebuilding.org [3]; EPW format [1] | Measured data, aggregated into a typical year |
| Missing values | Excluded and counted | EPW missing codes [1] | Sourced |
| Degree days | Daily mean over complete days | Standard definition (e.g. CIBSE TM41 [5]) | Sourced |
| Heating base | 18 °C (editable) | Common European practice; Eurostat uses 18 °C for heating degree days [6] | Sourced default |
| Cooling base | 24 °C (editable) | Engine default | Flagged: other conventions use 18 °C/65 °F or 21–22 °C; state the base with any result |
| Wind rose sectors | 16 × 22.5°, calm < 0.5 m/s | Common meteorological practice | Sourced default |
| Reference pressure | From the file, else from elevation by the standard atmosphere | ASHRAE Fundamentals psychrometrics [7] | Sourced |

## 4. Verification

`tests/environment-analysis.cjs`, re-run for this audit, passes its checks of complete EPW chronology in leap and non-leap years, daily-mean degree days, irradiation units, and the exclusion of missing data, including blocking of invalid temperatures. In the end-to-end audit with the Chicago O'Hare TMY3 file [2] the study produced its monthly tables and wind rose without error.

In the end-to-end audit of 20 November 2026, starting this study from the Workspace returned "This study does not run here yet."; it runs on its own environment page, which the study card opens, and the checks above were made there and in the test script. A Workspace user who does not follow the link sees no result, which should be made clearer.

## 5. Discussion

A typical year represents typical conditions and deliberately excludes extremes; it is not suitable for assessing peak heat or design-day cold, and it reflects the climate of its source period, not the future [2, 3]. Users should check that the station is representative of the site (coastal, urban and elevation differences can be large). The cooling base of 24 °C is a reasonable choice for buildings with significant internal gains, but cooling degree days are highly sensitive to the base, so comparisons between sources must use the same one.

## 6. Conclusion

The Climate analysis study is a faithful, missing-data-aware summary of the weather file. Its only non-standard default is the 24 °C cooling base, which should be stated whenever degree days are reported.

# References

1. U.S. Department of Energy, EnergyPlus Auxiliary Programs: EnergyPlus Weather File (EPW) Data Dictionary, EnergyPlus documentation, 2023.
2. S. Wilcox, W. Marion, Users Manual for TMY3 Data Sets, NREL/TP-581-43156, National Renewable Energy Laboratory, Golden, CO, 2008.
3. Climate.OneBuilding.Org, Repository of free climate data for building performance simulation, [climate.onebuilding.org](https://climate.onebuilding.org/).
4. V. Olgyay, Design with Climate: Bioclimatic Approach to Architectural Regionalism, Princeton University Press, Princeton, NJ, 1963.
5. CIBSE TM41, Degree-days: theory and application, Chartered Institution of Building Services Engineers, London, 2006.
6. Eurostat, Heating and cooling degree days – statistics, Statistics Explained, European Commission, Luxembourg.
7. ASHRAE, ASHRAE Handbook—Fundamentals, chapter 1, Psychrometrics, ASHRAE, Atlanta, 2021.
