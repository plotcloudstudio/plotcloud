---
id: report-watersound
sim: watersound
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Screening the sound of water features and streams: sound power from falling water and simple outdoor propagation
type: Method and data report
summary: How the Water sound study estimates A-weighted levels on the ground, on the facades and at windows from waterfalls, running streams, fountains and rills. The report separates the parts with a firm basis (spreading, air absorption, A-weighting, WHO reference levels) from the source strengths and screening values, which are assumptions.
image: img/home/acoustics.webp
imageAlt: Sound levels around a stream and a waterfall, in 5 dB bands
code: mvp/js/workspace-chrome.js, emb/lib/water.js
tests: tests/workspace-water.cjs
keywords:
- Water sound
- Soundscape
- Sound power
- Outdoor sound propagation
- Noise mapping
highlights:
- A fall's sound power is an acoustic efficiency (3 × 10⁻⁷, 10⁻⁶ or 3 × 10⁻⁶) times the power of the falling water, ρ g Q h; the efficiency is an assumption.
- Fountain and rill presets are octave-band sound powers, A-weighted with the IEC 61672 weights; the presets' source is not named.
- Propagation uses hemispherical spreading (−20 log r − 8 dB) and 5 dB/km air absorption, consistent with ISO 9613.
- Screening (−10 dB behind a building, −8 dB behind terrain) and window insulation (−10 dB open, −25 dB shut) are rules of thumb.
- The study reports levels, not annoyance; water sound is often perceived as pleasant.
---
# Abstract

Water features are used in landscape design to mask traffic noise and to improve the perceived soundscape, and streams and falls on a site can also be loud enough to matter at bedroom windows [1–3]. SimuSite's Water sound study estimates A-weighted sound levels from the site's water: each waterfall is a point source whose sound power is a fixed fraction of the mechanical power of the falling water, running stream reaches are weaker point sources every 8 m, and fountains and rills are given octave-band sound power spectra. Levels are summed on a grid at 1.5 m, on facade squares and at the outside of each room's windows, with hemispherical spreading, air absorption and simple screening by buildings and terrain, and are compared with the WHO 1999 guideline values for indoor noise [4]. This report documents the model and its constants. The propagation terms and the A-weighting are standard [5, 6]; the source strengths (acoustic efficiency, the riffle formula and the fountain and rill presets) are assumptions with no traceable source, and the screening and indoor reductions are rules of thumb. Results compare places and options; they should not be read as predicted measurements.

# Body

## 1. Introduction

Environmental noise is predicted by combining source sound power levels with propagation models such as ISO 9613-2, which accounts for geometric divergence, atmospheric absorption, ground effect and screening [5]. For road, rail and industry, source power databases exist. For water, they do not: the sound of a fall depends on its flow, height, the shape of the lip, the receiving pool and the presence of rocks, and measured levels vary widely [1, 2]. Listening studies show that water sounds with energy at low and mid frequencies (streams, cascades) are preferred, and that a water sound a few decibels below a traffic noise can improve the perceived soundscape [2, 3]. For a designer, the practical questions are how loud a feature will be at a seat, a window or a bedroom, and whether a stream will disturb sleep.

## 2. Method

### 2.1. Sources

**Falls.** For each fall of drop h on a water body of discharge Q, the mechanical power is P = ρ g Q h (W), with ρ = 1000 kg/m³. The sound power level is L_W = 10 log₁₀(η P / 10⁻¹² W), with η = 3 × 10⁻⁷ (gentle), 10⁻⁶ (typical) or 3 × 10⁻⁶ (loud), and not less than 70 dB. The source sits halfway down the drop, 0.6 m downstream of the lip. For Q = 0.05 m³/s and h = 2 m, P = 981 W and L_W is 85, 90 or 95 dB.

**Running water.** For a stream with a surface speed v of at least 0.3 m/s, a point source every 8 m along its centre line has L_W = 66 + 10 log₁₀ Q + 10 log₁₀(v/0.5) dB(A), with Q ≥ 0.02 m³/s and v ≥ 0.3 m/s.

**Features.** A fountain is one point source at its centre; a rill or cascade is a line of points every 4 m along the long axis, sharing its power. Their octave-band sound power levels (125 Hz to 4 kHz) are editable; the presets are 50, 55, 50, 52, 55, 52 dB for a fountain (59.4 dB(A)) and 70 dB in every band for a rill (76.3 dB(A)). Bands are combined with the A-weighting corrections −16.1, −8.6, −3.2, 0, +1.2 and +1.0 dB of IEC 61672-1 [6].

### 2.2. Propagation

The level at a receiver from each source is L_p = L_W − 20 log₁₀ r − 8 − 0.005 r − D_s, with r ≥ 1 m the distance in metres. The term −20 log r − 8 is hemispherical spreading from a point source on a reflecting ground (−20 log r − 11 for free field, +3 dB for the ground) [5, 7]. The 0.005 dB/m air absorption corresponds to about 5 dB/km, the ISO 9613-1 value near 1 kHz at 20 °C and 70 % relative humidity [8]. D_s is 10 dB if a building lies on the straight line between source and receiver, plus 8 dB if the terrain rises above it by more than 0.3 m. On a facade, sources behind the facade plane count 8 dB less. Levels from all sources are added on an energy basis.

### 2.3. Receivers and outputs

The study computes levels on the ground grid at 1.5 m, on facade squares 0.3 m out, and at a point 0.4 m outside each exterior window at 1.5 m above its floor. For each room it reports the loudest window level and indoor estimates of 10 dB less with windows open and 25 dB less with them shut. It also reports the mean ground level, the share of ground at 55 dB(A) or more, the source list, and, for reference, the WHO 1999 guideline values of 35 dB(A) in living rooms by day and 30 dB(A) in bedrooms at night for continuous noise [4].

## 3. Parameters and their sources

Table 1. Inputs and constants of the Water sound study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Fall acoustic efficiency η | 3 × 10⁻⁷ / 10⁻⁶ / 3 × 10⁻⁶ | Engine choice, labelled as an assumption | Flagged: no measured basis cited |
| Minimum fall L_W | 70 dB | Engine choice | Assumption |
| Riffle L_W | 66 + 10 log Q + 10 log(v/0.5) | Not traced | Flagged: no source |
| Fountain / rill presets | Octave bands as in §2.1 | "A published example" (unnamed in the code) | Flagged: source should be cited or the presets relabelled |
| A-weighting | −16.1 … +1.2 dB | IEC 61672-1 [6] | Sourced |
| Spreading | −20 log r − 8 dB | Hemispherical point source [5, 7] | Sourced |
| Air absorption | 5 dB/km | ISO 9613-1, ≈ 1 kHz, 20 °C, 70 % RH [8] | Sourced (single band) |
| Building screening | 10 dB | Rule of thumb | Within the 5–20 dB range of thin barriers [5, 7]; not computed from path difference |
| Terrain screening | 8 dB | Rule of thumb | Assumption |
| Facade back-side | −8 dB | Rule of thumb | Assumption |
| Indoor, windows open / shut | −10 / −25 dB | Rule of thumb | WHO 1999 uses about 15 dB for a partly open window [4]; shut depends on the glazing |
| Reference levels | 35 dB(A) living, 30 dB(A) bedroom | WHO 1999 [4] | Sourced |

## 4. Verification and validation status

`tests/workspace-water.cjs` builds a project with a stream and a fall and checks that the study finds one fall, reports at least six rooms, and gives a loudest window level between 50 and 95 dB(A). The spreading, absorption and A-weighting terms were checked by hand for this report; the fountain and rill presets give 59.4 and 76.3 dB(A), as computed above. No comparison with measured water sound has been made. Measured spectra of fountains and streams in the listening studies of Galbrun and Ali [2] and of Rådsten-Ekman and colleagues [3] could serve to check the presets.

In the end-to-end audit of 20 November 2026 the audit site had no water, and the study stopped with the message "No water on the site: draw a water area (Site › Water) or map one first.", which is the intended behaviour. We then ran `tests/workspace-water.cjs`, which models a stream with a 5.08 m fall at 1.2 m³/s beside a house. The study reported a fall sound power of 108 dB (hand check: 10 log₁₀(10⁻⁶ × 1000 × 9.81 × 1.2 × 5.08 / 10⁻¹²) = 107.8 dB), seven stretches of running water, a mean of 47 dB(A) on the ground, 21 % of the ground at 55 dB(A) or more, and 82 dB(A) at the loudest window. A level of 82 dB(A) at a window is very high; it follows directly from the assumed efficiency and the short distance, and illustrates why the source strength should be treated as uncertain by ±5 dB or more.

## 5. Discussion

**Source strength dominates.** A factor of ten in η changes every level by 10 dB, and the three presets span exactly that range. With no measured efficiency for falls of the kind designers draw, the absolute levels are uncertain by at least ±5 dB, and probably more. Relative results, such as which room is loudest or how much a building screens a terrace, are more robust because they depend on geometry.

**Propagation.** The model omits ground absorption (which reduces levels over soft ground at a distance), reflections from facades (which add up to 3 dB in front of a wall), and the frequency dependence of screening and air absorption [5]. Screening is a fixed value rather than a function of the path-length difference over the barrier [5, 7]. These simplifications are acceptable for a screening over short distances, which is where water sound matters.

**Perception.** Sound level is not annoyance. Water sound is usually rated pleasant, and it can mask unwanted noise [1–3]. Conversely, a steady sound of 35–40 dB(A) at a bedroom window with the window open can still disturb sleep for some people. The WHO values are given for reference, and the study states that it reports levels, not annoyance.

## 6. Conclusion

The Water sound study's propagation terms, A-weighting and reference levels are correctly sourced. Its source strengths are assumptions, as the study itself states for the fall efficiency; the riffle formula and the fountain and rill presets need a cited source or should be labelled as assumptions in the same way. The study is suited to comparing layouts and finding the rooms most exposed to a water feature, not to predicting measured levels.

# References

1. J. Kang, Urban Sound Environment, Taylor & Francis, London, 2007.
2. L. Galbrun, T.T. Ali, Acoustical and perceptual assessment of water sounds and their use over road traffic noise, J. Acoust. Soc. Am. 133 (1) (2013) 227–237. [doi:10.1121/1.4770242](https://doi.org/10.1121/1.4770242)
3. M. Rådsten-Ekman, Ö. Axelsson, M.E. Nilsson, Effects of sounds from water on perception of acoustic environments dominated by road-traffic noise, Acta Acust. united Acust. 99 (2) (2013) 218–225.
4. B. Berglund, T. Lindvall, D.H. Schwela (Eds.), Guidelines for Community Noise, World Health Organization, Geneva, 1999.
5. ISO 9613-2:1996, Acoustics — Attenuation of sound during propagation outdoors — Part 2: General method of calculation, International Organization for Standardization, Geneva, 1996.
6. IEC 61672-1:2013, Electroacoustics — Sound level meters — Part 1: Specifications, International Electrotechnical Commission, Geneva, 2013.
7. D.A. Bies, C.H. Hansen, C.Q. Howard, Engineering Noise Control, 5th ed., CRC Press, Boca Raton, 2017.
8. ISO 9613-1:1993, Acoustics — Attenuation of sound during propagation outdoors — Part 1: Calculation of the absorption of sound by the atmosphere, International Organization for Standardization, Geneva, 1993.
