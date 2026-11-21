---
id: report-acoustics
sim: acoustics
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Reverberation time and speech clarity of every room from statistical room acoustics and the DIN 18041 targets
type: Method and data report
summary: How the Indoor acoustics study computes each room's reverberation time in six octave bands with the Sabine and Eyring formulas, air absorption from ISO 9613-1, a reverberation-only speech transmission index, and targets from DIN 18041. The report gives the sources of the absorption data and targets, summarises the validation against ISO tables and an independent ray tracer, and flags the values that are rules of thumb.
image: img/home/acoustics.webp
imageAlt: Rooms coloured by reverberation time against their target
code: mvp/js/interior/acoustics.js, emb/roomacoustics.html, mvp/js/workspace-chrome.js
tests: tests/validation/room_acoustics.cjs, tests/workspace-vent-acoustics.cjs, tests/acoustics.cjs
keywords:
- Room acoustics
- Reverberation time
- Sabine and Eyring formulas
- Speech transmission index
- DIN 18041
highlights:
- Reverberation time in six octave bands (125 Hz–4 kHz) by Eyring (default) or Sabine, with air absorption from ISO 9613-1.
- Targets are the DIN 18041:2016 formulas for groups A1–A4 with a ±20 % band; homes and offices use 0.5 s, a rule of thumb.
- Against an independent ray tracer, Eyring is within −7 % to −1 % for rooms with even absorption; with all absorption on the ceiling it is 11.5 % short.
- Air absorption matches all 36 ISO 9613-1 table values within tolerance.
- Absorption of finishes, furniture and people are typical published values; the STI estimate uses the 1985 weights and ignores background noise.
---
# Abstract

Reverberation time is the primary design quantity in room acoustics: it governs speech intelligibility in classrooms and meeting rooms, the quality of music, and the general sense of a room being quiet or noisy [1–3]. National standards set targets that depend on use and volume; DIN 18041:2016 is the most widely used for rooms other than auditoria [4]. SimuSite's Indoor acoustics study computes, for every room of the building model, the reverberation time in six octave bands from the room volume and the absorption of its surfaces, furniture, people and the air, using the Eyring or Sabine formula [1, 5, 6]. It compares the mean of the 500 Hz and 1 kHz values with the DIN 18041 target for the room's use, estimates the speech transmission index (STI) from reverberation alone [7, 8], and suggests the area of acoustic panel that would bring a live room to target. This report documents the method, the data and their sources. Air absorption matches ISO 9613-1 [9] at all 36 tabulated points, and Eyring's formula agrees with an independent stochastic ray tracer within −7 % to −1 % for rooms with evenly distributed absorption. The DIN 18041 formulas are implemented correctly. Absorption coefficients are typical textbook values not tied to products, the target for homes and offices is a rule of thumb, and the STI estimate uses the original 1985 weighting and neglects background noise.

# Body

## 1. Introduction

Sabine's formula T = 0.161 V / A relates the reverberation time T to the room volume V and the total equivalent absorption area A [5]. Eyring's correction replaces A by −S ln(1 − ᾱ), which is more accurate when the mean absorption coefficient ᾱ is large [6]. Both assume a diffuse sound field. They are the basis of design calculations worldwide and of the targets in standards, and they are known to underestimate the reverberation of rooms whose absorption is concentrated on one surface [1, 2, 10].

## 2. Method

### 2.1. Room model

The study takes each room on each level from the building model: its volume, and the area of each wall, floor, ceiling, window, door and opening to a neighbouring space, with its finish. Finishes have absorption coefficients in six octave bands from 125 Hz to 4 kHz (Table 2). Furniture adds an equivalent absorption area by type (sofa, armchair, bed, upholstered chair, filled bookshelf, rug, or "hard furniture"). People can be added at a chosen floor area per person, each with an equivalent absorption area of 0.15–0.45 m² by band. An opening to the next space counts as fully absorbing (α = 1).

### 2.2. Reverberation time

For each band, A = Σ S_i α_i + A_furniture + A_people, and the air term is 4mV, where m is the power attenuation coefficient of air from ISO 9613-1:1993 equations 3–5 at the chosen temperature and humidity (defaults 20 °C, 50 %) [9]. The speed of sound is c = 331.3 √(1 + t/273.15). The reverberation times are

T_Sabine = (24 ln 10 / c) V / (A + 4mV),   T_Eyring = (24 ln 10 / c) V / (−S ln(1 − ᾱ) + 4mV),

with ᾱ = A/S capped at 0.99 [1, 5, 6].

### 2.3. Targets

The study takes the mean of the 500 Hz and 1 kHz values and compares it with a target for the room's use, assigned from the room name or chosen by the user. For DIN 18041:2016 groups, T_target = 0.45 lg V + 0.07 for A1 music (30–1000 m³), 0.37 lg V − 0.14 for A2 speech and lectures (50–5000 m³), 0.32 lg V − 0.17 for A3 teaching and communication (30–5000 m³) and 0.26 lg V − 0.14 for A4 inclusive teaching (30–500 m³) [4]. Homes and offices use 0.5 s; circulation, storage and wet rooms have no target. A room is on target within ±20 % of the target, which is the tolerance band of DIN 18041 at mid frequencies [4].

### 2.4. Speech transmission index

The modulation transfer function of a diffuse reverberant field is m(F) = [1 + (2πF T/13.8)²]^(−1/2) [7]. For 14 modulation frequencies from 0.63 to 12.5 Hz and seven octave bands from 125 Hz to 8 kHz (the 8 kHz band taking the 4 kHz reverberation time), m is converted to an apparent signal-to-noise ratio, clipped to ±15 dB, mapped to a transmission index and combined with octave weights 0.13, 0.14, 0.11, 0.12, 0.19, 0.17 and 0.14 [7]. The result is rated excellent (≥ 0.75), good (≥ 0.60), fair (≥ 0.45), poor (≥ 0.30) or bad, the IEC 60268-16 qualification bands [8].

### 2.5. Remedy

For a room that is too live, the extra absorption needed to reach the target by Sabine is A_need − A_now, and the panel area is that divided by 0.95, the difference between a 50 mm mineral-wool panel (α ≈ 0.975 at 500 Hz–1 kHz) and the plaster it replaces.

## 3. Parameters and their sources

Table 1. Constants and data of the Indoor acoustics study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Sabine, Eyring formulas | As in §2.2 | Sabine [5]; Eyring [6]; Kuttruff [1] | Sourced |
| Air absorption | ISO 9613-1 eqs. 3–5 | ISO 9613-1:1993 [9] | Sourced and verified (36/36) |
| Speed of sound | 331.3 √(1 + t/273.15) | Standard | Sourced |
| DIN 18041 targets | A1–A4 formulas and volume ranges | DIN 18041:2016 [4] | Sourced and verified |
| Tolerance | ±20 % | DIN 18041 tolerance band [4] | Sourced (mid frequencies only) |
| Home and office target | 0.5 s | Rule of thumb | Flagged: DIN 18041 does not cover dwellings; offices fall under group B or A3 |
| Finish absorption | Table 2 | Typical published values [2, 11] | Plausible, no source in the code, not product data |
| Furniture absorption | Sofa 0.95 m² at 500 Hz, bed 0.80, armchair 0.35 … | "Typical values for early design" | Flagged: no source |
| Person absorption | 0.15, 0.25, 0.35, 0.42, 0.45, 0.45 m² | Engine choice | Lower end of the 0.4–0.6 m² usually given for a seated adult at mid frequencies [1, 2] |
| STI MTF | Diffuse-field formula | Houtgast and Steeneken [7] | Sourced |
| STI octave weights | 0.13 … 0.14 | Houtgast and Steeneken 1985 [7] | Flagged: IEC 60268-16:2020 uses different weights and redundancy factors [8] |
| Background noise in STI | None | Engine choice | Flagged: STI is optimistic in noisy rooms |
| Panel α | ≈ 0.975 at 500 Hz–1 kHz | Table 2 | Typical for 50 mm mineral wool [2] |

Table 2. Absorption coefficients of the main finishes (125 Hz–4 kHz).

| Finish | 125 | 250 | 500 | 1k | 2k | 4k |
|---|---|---|---|---|---|---|
| Plaster on masonry, painted | 0.01 | 0.02 | 0.02 | 0.03 | 0.04 | 0.05 |
| Gypsum board on studs | 0.29 | 0.10 | 0.05 | 0.04 | 0.07 | 0.09 |
| Concrete, painted | 0.01 | 0.01 | 0.02 | 0.02 | 0.02 | 0.02 |
| Timber floor on joists | 0.15 | 0.11 | 0.10 | 0.07 | 0.06 | 0.07 |
| Carpet on concrete | 0.02 | 0.06 | 0.14 | 0.37 | 0.60 | 0.65 |
| Suspended mineral-fibre ceiling | 0.50 | 0.55 | 0.65 | 0.80 | 0.85 | 0.80 |
| Acoustic panel, 50 mm mineral wool | 0.20 | 0.55 | 0.95 | 1.00 | 0.95 | 0.90 |
| Double glazing | 0.10 | 0.07 | 0.05 | 0.03 | 0.02 | 0.02 |

## 4. Verification and validation status

The validation script `tests/validation/room_acoustics.cjs` extracts the engine's functions as they ship and checks them against two references (documented in `mvp/VALIDATION.md`):

- **Air absorption** against the ISO 9613-1 table values for 6 conditions and 6 bands: all 36 within the 3 % or 0.06 dB/km tolerance; the largest difference is +0.7 % at 4 kHz, 15 °C, 20 % RH.
- **Reverberation time** against an independent stochastic ray tracer (3,000 rays, Lambert-diffuse reflections, air absorption, T30 fitted from −5 to −35 dB). For five rooms with even absorption, Eyring is within −7.0 % to −1.2 % and Sabine within +1.3 % to +10.4 % (Table 3). For an office with an absorbing ceiling (α 0.80) over hard walls and floor (α 0.03), the ray tracer gives 0.39 s, Eyring 0.43 s (+11.5 %) and Sabine 0.49 s (+26 %).
- **STI**: 1 with no reverberation, 0.74 at 0.5 s, 0.59 at 1 s and 0.44 at 2 s, falling monotonically.
- **DIN 18041** formulas and volume ranges.

Table 3. Reverberation time against ray tracing (from `mvp/VALIDATION.md`).

| Room (even absorption) | Ray tracing | Eyring | Sabine |
|---|---|---|---|
| Bedroom 4 × 3.5 × 2.7 m, α 0.10, 500 Hz | 0.85 s | 0.83 s | 0.88 s |
| Office 5 × 4 × 2.7 m, α 0.20, 1 kHz | 0.46 s | 0.43 s | 0.48 s |
| Classroom 9 × 7 × 3 m, α 0.30, 1 kHz | 0.41 s | 0.38 s | 0.45 s |
| Hall 20 × 15 × 6 m, α 0.15, 4 kHz | 1.39 s | 1.35 s | 1.43 s |
| Studio 6 × 6 × 3 m, α 0.05, 500 Hz | 2.30 s | 2.27 s | 2.33 s |

The Workspace test `tests/workspace-vent-acoustics.cjs` checks that a bare plaster room is too live, that a panelled meeting room is shorter, that a fix is suggested, and that Sabine gives longer times than Eyring.

In the end-to-end audit of 20 November 2026 on a two-storey block with plaster walls, timber floors, plaster ceilings and sparse furniture, 1 of 8 judged rooms was on target; bedrooms and offices had about 2.5 s against 0.5 s, with an STI of about 0.42–0.43, and about 18 m² of acoustic panel was suggested for each. These are the expected results for nearly bare plaster rooms: with ᾱ ≈ 0.03, Sabine gives T ≈ 0.161 V / (0.03 S), about 2 s for a 3 m room.

## 5. Discussion

**Diffuse-field limits.** The ray-tracing comparison favours the formulas because its walls scatter diffusely. In real rooms with smooth parallel walls and all the absorption on the ceiling, the grazing sound field between the walls decays slowly, and measured reverberation can greatly exceed both formulas [1, 10]. The study's "on target" for such a room should be checked by an acoustician. Below about 200 Hz in small rooms, modes dominate and the 125 Hz value is indicative only [1].

**Data.** The coefficients in Table 2 are of the magnitude found in standard tables [2, 11], but the code gives no source, and products differ. Absorption of furniture and people is uncertain by at least ±30 %. DIN 18041 targets are for occupied rooms; with the default of no people, the comparison is conservative.

**STI.** The 1985 weights differ from the current IEC 60268-16:2020 male-speech weights and the standard adds redundancy corrections between adjacent bands [8]. Neglecting background noise makes the estimate optimistic, while neglecting direct sound makes it pessimistic near the talker. The value is an indicator of how reverberation alone limits clarity.

**Home and office target.** DIN 18041 does not apply to dwellings, and office targets are usually set by group B rules or by standards such as DIN EN ISO 3382-3 for open-plan offices [4, 12]. A value of 0.5 s is a reasonable comfort target for a furnished living room or a small office, but it is a rule of thumb.

## 6. Conclusion

The Indoor acoustics study implements the published formulas for reverberation time, air absorption and DIN 18041 targets correctly, and is validated against ISO tables and an independent ray tracer for rooms with diffuse fields. The absorption data are typical values without cited sources, the home and office target is a rule of thumb, and the STI is an estimate from reverberation alone. The results are suitable for early design of finishes; rooms with concentrated absorption or critical use need a specialist assessment.

# References

1. H. Kuttruff, Room Acoustics, 6th ed., CRC Press, Boca Raton, 2016.
2. M. Long, Architectural Acoustics, 2nd ed., Academic Press, Oxford, 2014.
3. M. Vorländer, Auralization: Fundamentals of Acoustics, Modelling, Simulation, Algorithms and Acoustic Virtual Reality, Springer, Berlin, 2008.
4. DIN 18041:2016-03, Hörsamkeit in Räumen — Anforderungen, Empfehlungen und Hinweise für die Planung (Acoustic quality in rooms — specifications and instructions for room acoustic design), Beuth, Berlin, 2016.
5. W.C. Sabine, Collected Papers on Acoustics, Harvard University Press, Cambridge, MA, 1922.
6. C.F. Eyring, Reverberation time in "dead" rooms, J. Acoust. Soc. Am. 1 (2A) (1930) 217–241. [doi:10.1121/1.1915175](https://doi.org/10.1121/1.1915175)
7. T. Houtgast, H.J.M. Steeneken, A review of the MTF concept in room acoustics and its use for estimating speech intelligibility in auditoria, J. Acoust. Soc. Am. 77 (3) (1985) 1069–1077. [doi:10.1121/1.392224](https://doi.org/10.1121/1.392224)
8. IEC 60268-16:2020, Sound system equipment — Part 16: Objective rating of speech intelligibility by speech transmission index, International Electrotechnical Commission, Geneva, 2020.
9. ISO 9613-1:1993, Acoustics — Attenuation of sound during propagation outdoors — Part 1: Calculation of the absorption of sound by the atmosphere, International Organization for Standardization, Geneva, 1993.
10. D. Fitzroy, Reverberation formula which seems to be more accurate with nonuniform distribution of absorption, J. Acoust. Soc. Am. 31 (7) (1959) 893–897.
11. ISO 354:2003, Acoustics — Measurement of sound absorption in a reverberation room, International Organization for Standardization, Geneva, 2003.
12. ISO 3382-3:2022, Acoustics — Measurement of room acoustic parameters — Part 3: Open plan offices, International Organization for Standardization, Geneva, 2022.
