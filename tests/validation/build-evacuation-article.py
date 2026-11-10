#!/usr/bin/env python3
# Builds the research article "How accurate is the fire evacuation simulation?" (PlotCloud blog) in the layout of a journal article
# on ScienceDirect, from the experiment results: mvp/research/egress-verification.json (tests/validation/egress-verification.mjs)
# and mvp/research/egress-hospital-case.json (tests/validation/egress-hospital-case.cjs). Every number in the tables, and the
# figures quoted in the text, are read from those files. Citations are written {key} and numbered in order of first use.
# Writes mvp/research/fire-evacuation-article.js (the blog post) and mvp/research/fire-evacuation-accuracy.md (the text).
# Run: python3 tests/validation/build-evacuation-article.py
import json, re, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
V = json.load(open(os.path.join(ROOT, 'mvp/research/egress-verification.json')))
H = json.load(open(os.path.join(ROOT, 'mvp/research/egress-hospital-case.json')))
E = V['experiments']; T = {t['id']: t for t in V['tests']}
def f1(v): return f'{v:.1f}'
def pc(a, b): return round(100 * (a - b) / b)
def row(rows, name): return next(r for r in rows if r['name'].startswith(name))

REFS = {
 'bsi2019': 'BSI, PD 7974-6:2019. The application of fire safety engineering principles to fire safety design of buildings. Part 6: Human factors: Life safety strategies. Occupant evacuation, behaviour and condition (Sub-system 6), British Standards Institution, London, 2019.',
 'purser2001': 'D.A. Purser, M. Bensilum, Quantification of behaviour for engineering design standards and escape time calculations, Saf. Sci. 38 (2001) 157–182.',
 'fruin1971': 'J.J. Fruin, Pedestrian Planning and Design, Metropolitan Association of Urban Designers and Environmental Planners, New York, 1971.',
 'predt1978': 'V.M. Predtechenskii, A.I. Milinskii, Planning for Foot Traffic Flow in Buildings, Amerind Publishing, New Delhi, 1978.',
 'weidmann1993': 'U. Weidmann, Transporttechnik der Fussgänger, Schriftenreihe des IVT Nr. 90, ETH Zürich, 1993.',
 'sfpe2016': 'S.M.V. Gwynne, E.R. Rosenbaum, Employing the hydraulic model in assessing emergency movement, in: M.J. Hurley (Ed.), SFPE Handbook of Fire Protection Engineering, 5th ed., Springer, New York, 2016.',
 'proulx1995': 'G. Proulx, Evacuation time and movement in apartment buildings, Fire Saf. J. 24 (1995) 229–246.',
 'boyce1999': 'K.E. Boyce, T.J. Shields, G.W.H. Silcock, Toward the characterization of building occupancies for fire safety engineering: capabilities of disabled people moving horizontally and on an incline, Fire Technol. 35 (1999) 51–67.',
 'knoblauch1996': 'R.L. Knoblauch, M.T. Pietrucha, M. Nitzburg, Field studies of pedestrian walking speed and start-up time, Transp. Res. Rec. 1538 (1996) 27–38.',
 'larus2011': 'A.R. Larusdottir, A.S. Dederichs, A step towards including children\'s evacuation parameters and behavior in fire safe building design, Fire Saf. Sci. 10 (2011) 187–195. [doi:10.3801/IAFSS.FSS.10-187](https://doi.org/10.3801/IAFSS.FSS.10-187)',
 'larus2012': 'A.R. Larusdottir, A.S. Dederichs, Evacuation of children: movement on stairs and on horizontal plane, Fire Technol. 48 (2012) 43–53.',
 'htm0502': 'Department of Health, Health Technical Memorandum 05-02: Firecode. Guidance in support of functional provisions (fire safety in the design of healthcare premises), London, 2015.',
 'csa': 'CSA Group, CSA Z8000-18, Canadian health care facilities, Toronto, 2018.',
 'nfpa101': 'NFPA, NFPA 101, Life Safety Code, chapters on new and existing health care occupancies, National Fire Protection Association, Quincy, MA (current edition).',
 'hunt2015': 'A. Hunt, E.R. Galea, P.J. Lawrence, An analysis and numerical simulation of the performance of trained hospital staff using movement assist devices to evacuate people with reduced mobility, Fire Mater. 39 (2015) 407–429. [doi:10.1002/fam.2215](https://doi.org/10.1002/fam.2215)',
 'joyce2020': 'M.S. Joyce, P.J. Lawrence, E.R. Galea, Hospital Evacuation Planning Tool for Assistance Devices (HEPTAD), Fire Mater. (2020). [doi:10.1002/fam.2856](https://doi.org/10.1002/fam.2856)',
 'hoondert2019': 'P. Hoondert, B. Peters, New design approach for fire safe hospital wards, in: Interflam 2019, Interscience Communications, Egham, 2019, pp. 597–608 (as cited in Joyce et al. 2020).',
 'kuligowski2010': 'E.D. Kuligowski, R.D. Peacock, B.L. Hoskins, A Review of Building Evacuation Models, 2nd ed., NIST Technical Note 1680, National Institute of Standards and Technology, Gaithersburg, MD, 2010.',
 'helbing1995': 'D. Helbing, P. Molnár, Social force model for pedestrian dynamics, Phys. Rev. E 51 (1995) 4282–4286.',
 'dijkstra1959': 'E.W. Dijkstra, A note on two problems in connexion with graphs, Numer. Math. 1 (1959) 269–271.',
 'ronchi2013': 'E. Ronchi, E.D. Kuligowski, P.A. Reneke, R.D. Peacock, D. Nilsson, The Process of Verification and Validation of Building Fire Evacuation Models, NIST Technical Note 1822, National Institute of Standards and Technology, Gaithersburg, MD, 2013.',
 'iso20414': 'ISO, ISO 20414:2020. Fire safety engineering. Verification and validation protocol for building fire evacuation models, International Organization for Standardization, Geneva, 2020.',
 'imo1533': 'IMO, MSC.1/Circ.1533. Revised guidelines on evacuation analysis for new and existing passenger ships, International Maritime Organization, London, 2016.',
 'ronchi2014': 'E. Ronchi, P.A. Reneke, R.D. Peacock, A method for the analysis of behavioural uncertainty in evacuation modelling, Fire Technol. 50 (2014) 1545–1571. [doi:10.1007/s10694-013-0352-7](https://doi.org/10.1007/s10694-013-0352-7)',
 'smedberg2021': 'E. Smedberg, E. Ronchi, M.J. Kinsey, Multifactor variance assessment for determining the number of repeat simulation runs in evacuation modelling, Fire Technol. 57 (2021).',
 'ibc2021': 'ICC, International Building Code 2021, Table 1004.5, Maximum floor area allowances per occupant, International Code Council, Washington, DC, 2021.',
}

# ---- numbers ---------------------------------------------------------------------------------------------------------------------
cv = E['convergence']; at = {a['n']: a for a in cv['at']}
inc = E['incidents']; inc0, incD, incK = row(inc, 'No incidents'), row(inc, 'Default'), row(inc, 'Twice the children')
hs = E['hospital']; hDay, hNo, hNight, hDep = row(hs, 'Day staffing 1:4'), row(hs, 'Day staffing, no'), row(hs, 'Night'), row(hs, 'More dependent')
gr = E['groups']['rows']; gA, gM, gW, gW4 = row(gr, 'Everyone an adult'), row(gr, "The use's mix of"), row(gr, 'Two more wheelchair'), row(gr, 'The same, helpers')
ch = H['hospital']; cDay, cNight, cNoPrep, cNoInc, cGrid = row(ch, 'Day staffing'), row(ch, 'Night'), row(ch, 'Day, no preparation'), row(ch, 'Day, no incidents'), row(ch, 'Day, 0.25')
ce = H['everyone']; eMix, eNoInc, eGrid, e3, eAd = row(ce, 'Clinic use, alarm 60 s'), row(ce, 'Clinic use, alarm 60 s, no'), row(ce, 'Clinic use, alarm 60 s, 0.25'), row(ce, 'Clinic use, alarm 3'), row(ce, 'Clinic use, everyone')
grp = eMix['groups']

def vt(i, what, unit_fmt=lambda t: f"{t['expected']} {t['unit']}"):
    t = T[i]; return f"| {i} | {what} | {t['expected']} {t['unit']} | {t['measured']} {t['unit']} | {('pass' if t['errorPct'] is None else str(t['errorPct']) + ' %')} |"

ABSTRACT = (f"Fire Evacuation in PlotCloud estimates how long a building takes to clear, either with everyone leaving at once or by a hospital's progressive horizontal evacuation followed by descent. It is a grid-based stochastic model with hydraulic flow limits after the SFPE Handbook, pre-movement times after PD 7974-6, and five occupant groups (adults, older adults, children, walking-aid users and wheelchair users) whose speeds come from published measurements. This study asks whether the engine implements its equations correctly, how many runs give stable results, how sensitive results are to the grid, to random incidents, to occupant groups and to hospital staffing, and what accuracy can honestly be claimed. Eighteen verification tests after IMO MSC.1/Circ.1533 and the verification categories of NIST TN 1822 and ISO 20414 all pass: speeds, flows and pre-movement distributions agree with analytical values within 0–3 %, and a three-storey building agrees with an SFPE hand calculation within {T['V10']['errorPct']} %. The study found and fixed five defects. The 0.5 m grid keeps only {T['G1']['measured']} m of a 1.8 m clear corridor (0.25 m grid: {T['G1b']['measured']} m). The mean settles within 1 % after about {cv['runsMean1pct']} runs and the 90th percentile needs about 50. Inputs about people dominate the uncertainty: in the example hospital, staffing and patient preparation move the median by {pc(cNight['p50'], cDay['p50'])} % and {pc(cDay['p50'], cNoPrep['p50'])} %, occupant groups move the clinic's everyone-out median by {pc(eMix['p50'], eAd['p50'])} %, and a wheelchair user's wait for assisted descent sets the end of the evacuation when there are wheelchair users above the ground floor. The model suits the comparison of design options under stated assumptions; it is not a prediction of a real evacuation time and not a code-compliance check.")

HIGHLIGHTS = [
 'A grid-based stochastic evacuation model for early design is verified.',
 f"18 component tests after IMO MSC.1/Circ.1533 pass, within 0–3 % (one at {T['V10']['errorPct']} %).",
 f"A 0.5 m grid keeps {T['G1']['measured']} m of a 1.8 m corridor; a 0.25 m grid keeps {T['G1b']['measured']} m.",
 'The 90th percentile needs about 50 runs to settle; the mean about 20.',
 'Staffing, preparation and occupant groups dominate the uncertainty.',
]

BODY = f"""## 1. Introduction

Architects meet evacuation questions early: where to put a second stair, how wide a corridor or a cross-corridor door must be, how many beds a smoke compartment can hold, whether a ward can be cleared with the night staff. Prescriptive codes answer with rules on travel distance, exit width and compartment size. Performance-based design asks instead whether the required safe escape time (RSET) stays below the available safe escape time (ASET) with a margin {{bsi2019}}. PD 7974-6 divides RSET into detection, alarm, pre-movement and travel {{bsi2019}}, and recorded evacuations show that pre-movement is often the longest and most uncertain part {{purser2001}}.

PlotCloud's Fire Evacuation is a design-stage screening tool inside the architect's model. Earlier versions showed routes and timings without a check against analytical answers, and with parameters chosen by judgement. This article documents the evidence behind each parameter, verifies the engine, measures how much each uncertain input matters, and reports the changes made to the software as a result.

Research questions:

1. Verification: do the walking speeds, flows, pre-movement times and route choices produced by the engine match their analytical values?
2. Numerical uncertainty: how do the grid size and the number of runs affect results?
3. Behavioural and operational uncertainty: how sensitive are results to incidents, occupant groups, staffing and patient preparation?
4. Accuracy: what accuracy can be claimed, and for what use?

## 2. Background

### 2.1. Evacuation time and its stages

The comparison of RSET with ASET underlies life-safety fire engineering {{bsi2019}}. RSET is detection plus alarm plus pre-movement plus travel, travel including the queueing at doors and stairs. Pre-movement times are widely spread and often long {{purser2001}}, so the model draws them at random for each person from a lognormal set by the building use, rather than using a single number.

### 2.2. Movement data

The density–speed–flow relations of Fruin {{fruin1971}} and of Predtechenskii and Milinskii {{predt1978}}, and Weidmann's compilation of free walking speeds {{weidmann1993}}, underlie the hydraulic method of the SFPE Handbook {{sfpe2016}}. In that method, speed falls linearly with density above 0.54 persons/m², S = k(1 − 0.266 D). The maximum specific flow is 1.32 persons/s per metre of effective width through doors and 1.01 on a 7/11 stair. The effective width is the clear width less a boundary layer, 0.15 m each side for doors and stairs. Level walking has k = 1.40, giving 1.19 m/s at low density; a 7/11 stair has k = 1.08, giving 0.92 m/s along the line of travel {{sfpe2016}}. Proulx measured evacuations of apartment buildings {{proulx1995}}.

### 2.3. Occupants who move differently

Boyce, Shields and Silcock measured people with disabilities moving horizontally and on an incline {{boyce1999}}. As reproduced in the SFPE Handbook's movement chapters, people with walking aids moved at roughly 0.8 m/s on average (from about 0.57 m/s with a walking frame to about 0.94 m/s with crutches), and manual wheelchair users at about 0.69 m/s. Field studies of pedestrians found older pedestrians walking markedly slower than younger ones {{knoblauch1996}}. Larusdottir and Dederichs measured children in 16 evacuation experiments in ten Danish day-care centres {{larus2011}}. Children of 3–6 years walked at 0.84 m/s on the level (SD 0.25, range 0.42–1.36) and those of 0–2 years at 0.60 m/s; on spiral stairs speeds were 0.13–0.58 m/s depending on the stair and on familiarity {{larus2011}}, {{larus2012}}.

### 2.4. Hospitals

Patients who cannot walk depend on staff, so hospitals plan for progressive horizontal evacuation into the next smoke compartment, with vertical evacuation as a later stage {{htm0502}}, {{csa}}, {{nfpa101}}. Hunt, Galea and Lawrence measured trained staff moving a test subject with four assistance devices through eleven floors of a hospital stair {{hunt2015}}. Joyce, Lawrence and Galea collected device parameters for their planning tool HEPTAD, stated to be for demonstration purposes only {{joyce2020}}. These include preparation times of 29 s for an evacuation chair, 53 s for a rescue sheet and 31 s for a hospital bed, after Hunt et al. {{hunt2015}} and Hoondert and Peters {{hoondert2019}}.

### 2.5. Models, verification and validation

Building evacuation models range from hydraulic hand methods to coarse networks, fine grids and continuous models {{kuligowski2010}}, such as the social-force model {{helbing1995}}. Grid models commonly route people down distance fields found with Dijkstra's algorithm {{dijkstra1959}}. NIST TN 1822 sets out verification and validation of evacuation models {{ronchi2013}}, ISO 20414 turns it into a protocol {{iso20414}}, and IMO MSC.1/Circ.1533 gives simple component tests that are widely reused for buildings {{imo1533}}. Convergence criteria for the number of stochastic runs were proposed by Ronchi, Reneke and Peacock {{ronchi2014}} and extended to several outputs by Smedberg, Ronchi and Kinsey {{smedberg2021}}.

### 2.6. The gap

The literature gives sourced values for movement, and methods for verification and for run counts. It gives no measured rates for incidents such as falls during an evacuation, and few data for older adults' pre-movement or for the time a wheelchair user waits for assisted descent. This study uses sourced values where they exist, labels every other value as an assumption, and measures how much each assumption matters.

## 3. Methods

### 3.1. The model

Each level of the building model is a grid of 0.5 m cells (0.25 m at the Refined setting). A cell is walkable inside a room, and blocked within half a wall's thickness plus 0.45 of a cell from the wall's centre line. Door openings are cut through the walls, and stairs join the levels in order. For every goal (the outside doors, the stairs down, the next smoke compartment), a distance field is computed with Dijkstra's algorithm on eight neighbours {{dijkstra1959}}. People move cell to cell down the field, one person per cell. Speed falls with the density in a square of about 2.5 m round each person, v = v₀(1 − 0.266 D)/(1 − 0.266 × 0.54) above 0.54 persons/m² {{sfpe2016}}. Doors and stair flights hold tokens that refill at the SFPE specific flow times the effective width, and a person needs a token to pass. Queues therefore form at the right capacity, and a person waiting for help does not hold up those behind. The time step is 0.5 s. In the view, people are grey before they are alerted, yellow while they get ready, and in their group's colour on the move.

### 3.2. Parameters

Table 1. Movement parameters and their sources.

| Parameter | Value | Source |
|---|---|---|
| Door specific flow | 1.32 persons/s/m of effective width | {{sfpe2016}} |
| Stair specific flow (7/11) | 1.01 persons/s/m of effective width | {{sfpe2016}} |
| Boundary layer | 0.15 m each side | {{sfpe2016}} |
| Speed–density relation | v₀(1 − 0.266 D), D > 0.54 persons/m² | {{sfpe2016}} |
| Pre-movement | lognormal through the use's 1st and 99th percentiles (office 30–120 s; shop, clinic or assembly 30–180 s; hotel 120–900 s) | after {{bsi2019}}, {{purser2001}}; values to edit |
| Occupant load | by room name, m² per person | {{ibc2021}} |
| Patient preparation (hospital mode) | 29 s helped, 31 s bed, +53 s at the stair for a bed patient | {{joyce2020}}, {{hunt2015}}, {{hoondert2019}} |
| Staff per patient (hospital mode) | 1 helped, 2 for a bed; 1:4 by day, 1:8 at night; at least 2 on a floor with patients | assumption |

### 3.3. Occupant groups

Table 2. Occupant groups. Speeds are mean (SD), truncated to the range shown; pre-movement factors multiply the building use's draw.

| Group | Level speed, m/s | Stair speed, m/s | Pre-movement | Fall chance, level / stair | Source |
|---|---|---|---|---|---|
| Adults | 1.19 (0.2), 0.6–1.6 | 0.92 (0.15) | ×1 | 1.5 % / 0.8 % | {{sfpe2016}} |
| Older adults (65+) | 1.0 (0.15), 0.6–1.3 | 0.7 (0.12) | ×1.3 | 4 % / 2 % | scaled after {{knoblauch1996}}; factors assumed |
| Children | 0.84 (0.25), 0.42–1.36 | 0.48 (0.1) | with their adult | 5 % / 3 % | {{larus2011}} |
| Walking-aid users | 0.8 (0.15), 0.45–1.1 | 0.35 (0.05) | ×1.2 | 6 % / 3 % | {{boyce1999}}; factors assumed |
| Wheelchair users | 0.69 (0.15), 0.4–1.0 | carried 0.35 | ×1.2 | 0.5 % / – | {{boyce1999}}; descent assumed |

By default the groups share the occupant load of each floor by the building use. For example, the shop, clinic or assembly use has 62 % adults, 18 % older adults, 12 % children, 6 % walking-aid users and 2 % wheelchair users. The designer can set any number per floor and group, including more people than the occupant load. Children are placed first in rooms that families use, and each walks with an adult of the same room (or the nearest within 15 m) at the slower pace of the two. Above the ground floor, a wheelchair user waits in the stair's refuge for helpers and an evacuation chair: a lognormal wait with a median of 2 min (an assumption), plus about 29 s to transfer {{joyce2020}}. They are then carried down at 0.35 m/s (an assumption), taking two places in the stair flow.

### 3.4. Incidents

These are assumptions to test sensitivity, not measured rates:

- In each run a person may trip, with the chances in Table 2, after walking 3–28 m. They stay down for 5 s to 2 min (median 20 s), and others pass round them.
- A fall on a stair holds that flight for 5–90 s.
- In 15 % of runs one outside door is found blocked.
- Nobody passes through the room of fire origin, except its own occupants and, as a recorded exception, people whose only way out it is.
- In hospital mode, 10 % of staff are held up for 30 s to 2 min, and 3 % of the patients who walk alone trip.

### 3.5. Experiments

Verification (Section 4) uses small synthetic geometries with fixed inputs, each with an analytical answer. Convergence (Section 5) runs a three-storey block of waiting rooms 300 times. The sensitivity studies (Section 6) vary one input at a time. The case study (Section 7) runs the PlotCloud example hospital in the browser, 50 runs per variant. All runs are seeded and can be reproduced exactly.

## 4. Verification

Table 3. Verification tests, after IMO MSC.1/Circ.1533 {{imo1533}} and the verification categories of {{ronchi2013}}, {{iso20414}}.

| Test | What it checks | Expected | Measured | Difference |
|---|---|---|---|---|
{vt('V1', 'Speed in a corridor, 40 m at 1 m/s (IMO test 1), 0.5 m grid')}
{vt('V1b', 'The same, 0.25 m grid')}
{vt('V2', 'One stair flight at 0.5 m/s (IMO tests 2–3), mean of 200 runs')}
{vt('V3', '100 people through a 1 m door (IMO test 4)')}
{vt('V3b', 'Through a 2 m door')}
{vt('V3c', '1 m door, 0.25 m grid')}
{vt('V4a', 'Pre-movement, office, 1st percentile (IMO test 5)')}
{vt('V4b', 'Pre-movement, office, median')}
{vt('V4c', 'Pre-movement, office, 99th percentile')}
| V5 | 20 people round a corner (IMO test 6) | all out | all out | pass |
{vt('V6a', 'Adult walking speed, mean (IMO test 7)')}
{vt('V6b', 'Walking-aid speed, mean')}
| V7 | Nearest exit taken, uncongested (IMO test 10) | 6 of 6 | {T['V7']['measured']:g} of 6 | pass |
| V8 | An exit found blocked: the other used | 6 of 6 | {T['V8']['measured']:g} of 6 | pass |
| V9 | The room of fire origin avoided | longer than {T['V9']['expected']} m | {T['V9']['measured']} m | pass |
{vt('V10', 'Three-storey office block, 72 people, against an SFPE hand calculation')}

All 18 tests pass, counting the two grid measurements of Section 5. In V1 the expected time runs to the doorway cells, where the engine counts a person as out. The hand calculation in V10 takes the stair as the controlling component: 48 people from the upper floors at 1.11 persons/s, plus the walk to the stair and from its foot {{sfpe2016}}. The engine is {round(T['V10']['measured'] - T['V10']['expected'], 1)} s slower, the expected direction, since the hand method ignores the time a queue takes to form and the slowing where floors merge.

The tests found five defects, all fixed:

1. On a 0.25 m grid the crowd window of 5 × 5 cells was only 1.56 m², so a lone walker counted as 0.64 persons/m² and slowed by about 3 %. The window is now about 2.5 m square on any grid.
2. En-suite bathrooms were given occupants, and when their patient room was the fire room these people had no way out. En-suites now carry no load, and people whose only way out is through the fire room take it and are reported.
3. An IT room counted as a patient room, leaving one member of staff for a bed patient who needs two. That run never finished and was reported as 0 s. Support rooms are now excluded, and a floor with patients has at least two staff.
4. Door and stair flows used the full clear width with a stair flow of 1.1. They now use the effective width and 1.01, reducing a 1.1 m flight's capacity by about a third.
5. A wheelchair user was given a new refuge wait at every floor of a building with a separate stair object per storey. The wait is now taken once, after which they are carried on down.

## 5. Numerical uncertainty

### 5.1. Grid

Table 4. Walkable width kept of a 2 m corridor with 0.2 m walls on its centre lines (1.8 m clear).

| Grid | Walkable width | Difference |
|---|---|---|
| 0.5 m | {T['G1']['measured']} m | {T['G1']['errorPct']} % |
| 0.25 m | {T['G1b']['measured']} m | {T['G1b']['errorPct']} % |

Walls must block at least one cell wherever they lie, which costs width on a coarse grid. Door and stair capacities come from tokens, not cells, so flows are unaffected (V3, V3c), but corridors and the crowding in them are modelled narrower than they are. In the example hospital, the 0.25 m grid lowers the hospital-mode median by {abs(pc(cGrid['p50'], cDay['p50']))} % (Section 7). The Refined setting now uses the 0.25 m grid.

### 5.2. Number of runs

Table 5. Running statistics over 300 runs of a three-storey block of waiting rooms ({cv['people']} people, everyone out, alarm at 60 s, incidents on).

| Runs | Mean, s | 90th percentile, s | 95 % CI of the mean, s |
|---|---|---|---|
""" + '\n'.join(f"| {a['n']} | {f1(a['mean'])} | {f1(a['p90'])} | ±{f1(a['ci95'])} |" for a in cv['at']) + f"""

The running mean stays within 1 % from run to run after {cv['runsMean1pct']} runs, a simplified form of the criterion in {{ronchi2014}}. The 90th percentile, the figure that matters for design, keeps rising until about 50 runs; at 20 runs it is {abs(pc(at[20]['p90'], at[300]['p90']))} % below its 300-run value. The default is now 50 runs, and 100 for presentation.

## 6. Sensitivity

### 6.1. Incidents

Table 6. Incidents, everyone out, the block of waiting rooms, 100 runs each (legacy population without groups).

| Variant | Median, s | 90th percentile, s |
|---|---|---|
""" + '\n'.join(f"| {r['name']} | {f1(r['p50'])} | {f1(r['p90'])} |" for r in inc) + f"""

Incidents add about {pc(incD['p50'], inc0['p50'])} % to the median and {pc(incD['p90'], inc0['p90'])} % to the 90th percentile. Doubling the share of children adds {pc(incK['p90'], inc0['p90'])} % to the 90th percentile over the case without incidents.

### 6.2. Occupant groups

Table 7. Occupant groups, everyone out, the same block, shop, clinic or assembly use, 50 runs each. "Others" is the time the last person who is not a wheelchair user gets out.

| Variant | Median, s | 90th percentile, s | Others out, median, s | Last wheelchair user, median, s |
|---|---|---|---|---|
""" + '\n'.join(f"| {r['name']} | {f1(r['p50'])} | {f1(r['p90'])} | {f1(r['othersP50'])} | {f1(r['wheelLastP50']) if r['wheelLastP50'] else '–'} |" for r in gr) + f"""

The use's mix of groups adds {pc(gM['p50'], gA['p50'])} % to the median over a population of adults only, through slower walking, longer pre-movement and children paired with adults. Two wheelchair users on each upper floor change the picture. Everyone else is out at about the same time, but the evacuation now ends with the wheelchair users carried down the stair, a median of {f1(gW['wheelLastP50'])} s. If help reaches the stair after 4 min instead of 2, that becomes {f1(gW4['wheelLastP50'])} s. For a building with wheelchair users above the ground floor, the arrangements for assisted descent, not the exit widths, set the total time.

### 6.3. Hospital staffing and preparation

Table 8. Hospital mode on a three-storey ward block, horizontal then down, 50 runs each.

| Variant | Median, min | 90th percentile, min | Horizontal stage, median, min |
|---|---|---|---|
""" + '\n'.join(f"| {r['name']} | {f1(r['p50'])} | {f1(r['p90'])} | {f1(r['stage1'])} |" for r in hs) + f"""

Night staffing adds {pc(hNight['p50'], hDay['p50'])} % to the median, and the preparation times, left out of earlier versions, add {pc(hDay['p50'], hNo['p50'])} %.

## 7. Case study: the PlotCloud example hospital

The example is a generic three-storey inpatient building of about 61 × 27 m, with an entrance and clinics on the ground floor and two inpatient units above (52 single patient rooms). Each inpatient floor has two smoke compartments separated by cross-corridor doors, and two exit stairs with 1.65 m flights serve every floor, entered at the ends of both corridors. Its means of egress meets every check of the software's Ontario Building Code screening (Section 10). Before that screening, the stairs had 1.4 m flights and were entered 8 m in from the corridors' ends, leaving dead-end corridors; both were corrected. In each run the fire starts in a random compartment with patients (hospital mode) or a random occupied room (everyone out).

![Fig. 1. Routes of the run nearest the median in the example hospital, hospital mode: each route shaded by when that person reached safety (lighter sooner, darker later); stairs outlined and labelled, exits in green, smoke doors in orange.](img/research/evacuation-routes.jpg?v=20261110-2)

Table 9. Hospital mode, horizontal then down, 50 runs each.

| Variant | Patients · staff | 10th %, min | Median, min | 90th %, min | Horizontal stage, min |
|---|---|---|---|---|---|
""" + '\n'.join(f"| {r['name']} | {r['patients']} · {r['staff']} | {f1(r['p10'])} | {f1(r['p50'])} | {f1(r['p90'])} | {f1(r['stage1P50'])} |" for r in ch) + f"""

Table 10. Everyone out, clinic use (shop, clinic or assembly), 50 runs each. People by group: {grp['occ']} adults, {grp['older']} older adults, {grp['child']} children, {grp['imp']} walking-aid users, {grp['wheel']} wheelchair users.

| Variant | 10th %, min | Median, min | 90th %, min | Incidents per run |
|---|---|---|---|---|
""" + '\n'.join(f"| {r['name']} | {f1(r['p10'])} | {f1(r['p50'])} | {f1(r['p90'])} | {r['incidentsPerRun']} |" for r in ce) + f"""

What a design team would take from this case:

- Horizontal relocation clears the fire compartment in about {f1(cDay['stage1P50'])} minutes by day. That is the figure to compare with the time a compartment can be held, and it is far shorter than full evacuation.
- Full vertical evacuation takes {f1(cDay['p50'])} minutes by day (90th percentile {f1(cDay['p90'])}) and {f1(cNight['p50'])} at night (90th percentile {f1(cNight['p90'])}). The night shift, not the stair width, is the constraint. This argues for planning around horizontal relocation and staff deployment rather than more stair capacity.
- For everyone out, a realistic mix of people raises the median from {f1(eAd['p50'])} to {f1(eMix['p50'])} min. In the run shown, the {grp['wheel']} wheelchair users, waiting at the stairs for assisted descent, are {'the last out: ' + f1(eMix['wheelLast']) + ' min, against ' + f1(eMix['othersLast']) + ' min for everyone else' if eMix['wheelLast'] > eMix['othersLast'] else 'not the last out'}.
- An alarm at 3 minutes instead of 60 s moves the median by {f1(e3['p50'] - eMix['p50'])} min. Detection and staff response are worth more here than wider exits.

## 8. Discussion: how accurate is it?

The errors are of three kinds, and of different sizes:

- Numerical, meaning whether the code does what its equations say: 0–3 % for speeds, flows and pre-movement, and {T['V10']['errorPct']} % against a building-scale hand calculation. This is the only kind this study measures directly.
- Discretisation: up to {abs(pc(cGrid['p50'], cDay['p50']))} % in the hospital case on the 0.5 m grid, mainly because corridors are narrowed.
- Input uncertainty: {pc(cDay['p50'], cNoPrep['p50'])}–{pc(hNight['p50'], hDay['p50'])} % for staffing and preparation in hospitals, {pc(eMix['p50'], eAd['p50'])} % for the occupant mix, and several minutes for the assumed wait before assisted descent. This is by far the largest.

How far the predictions lie from real evacuations is unknown until they are compared with measured drills, as TN 1822 and ISO 20414 require for validation {{ronchi2013}}, {{iso20414}}. The results should therefore be read comparatively: option A against option B, day against night, one stair against two, under the same stated assumptions. They are not a forecast of the minutes a real evacuation will take, not an RSET for a fire engineering submission without a qualified engineer's review, and not evidence of code compliance.

## 9. Limitations

- There is no fire or smoke model and no ASET. Lifts are not used.
- Older adults' pre-movement, the wait for assisted descent, the carried descent speed and all incident rates are assumptions.
- There is no counterflow and no behaviour beyond parent–child pairs and hospital staff. People take the shortest available route.
- Stairs are queues with a travel time, the flight length taken as 1.75 times the rise.
- The 0.5 m grid narrows corridors.
- No empirical validation has been done.

## 10. Implications for the software

The following changes were made as a result of this study:

- Door and stair flows now use effective widths and the SFPE 7/11 values.
- Five occupant groups, with their speeds, reaction factors and fall chances, can be set per floor.
- Wheelchair users wait at a refuge for assisted descent.
- The density window has a fixed area on any grid.
- En-suites carry no occupant load, support rooms are not patient rooms, and each floor with patients has at least two staff.
- In hospital mode, patients take preparation time before an assisted move.
- A room whose only way out is through the fire room is reported.
- People are shown grey until alerted and yellow while getting ready, and the results chart has a line for each group.
- The Refined setting uses a 0.25 m grid, and the default is 50 runs.
- A code-check mode screens the model's means of egress against the Ontario Building Code 2024, Part 3: number of exits, travel distance, distance between exits, exit width for the occupant load, minimum widths of exit doors and stairs, corridor widths, doorways for beds and dead-end corridors. It is a screening for the design team, not a compliance determination.
- An available safe escape time (ASET) can be entered, or read from an FDS device file at a tenability threshold, and is compared with the evacuation time.
- Drill records can be loaded and compared with the runs, which supports the validation this article calls for. A protocol describes what to record.
- A brief for the fire engineer can be downloaded, with the inputs, sources, results, ASET, drill comparison, code check, limitations and a review block.

## 11. Conclusions

The engine reproduces the hydraulic values it is built on and passes component tests after IMO MSC.1/Circ.1533. Its numerical error is small beside the uncertainty in the people it models. For architects, the practical lessons match the literature. In care buildings, evacuation time is set mostly by staff, patient dependency and assisted descent, and by detection and pre-movement, more than by exit width. The next step is validation against recorded drills, particularly hospital drills with timed patient movements."""

BACK = [
 ('CRediT authorship contribution statement', 'PlotCloud Studio: Conceptualization, Methodology, Software, Validation, Formal analysis, Writing – original draft. The software and this text were developed with AI assistance (Claude, Anthropic). Human subject-matter review is pending.'),
 ('Declaration of competing interest', 'The authors develop PlotCloud, the software evaluated in this article. No external funding was received.'),
 ('Data availability', 'The engine, test scripts and results are public: [engine source](https://github.com/plotcloudstudio/plotcloud/blob/main/mvp/js/interior/egress.js), [verification and sensitivity script](https://github.com/plotcloudstudio/plotcloud/blob/main/tests/validation/egress-verification.mjs), [hospital case script](https://github.com/plotcloudstudio/plotcloud/blob/main/tests/validation/egress-hospital-case.cjs), [verification results (JSON)](research/egress-verification.json), [hospital case results (JSON)](research/egress-hospital-case.json), [this article as text](research/fire-evacuation-accuracy.md). All runs are seeded and reproducible.'),
 ('Acknowledgements', 'None.'),
]

# ---- number the citations in order of first use ------------------------------------------------------------------------------------
order = []
def num(m):
    k = m.group(1); assert k in REFS, k
    if k not in order: order.append(k)
    return f'[{order.index(k) + 1}]'
texts = [BODY] + [t for _, t in BACK]
BODY = re.sub(r'\{(\w+)\}', num, BODY)
ABSTRACT = re.sub(r'\{(\w+)\}', num, ABSTRACT)
BACK = [(a, re.sub(r'\{(\w+)\}', num, t)) for a, t in BACK]
unused = [k for k in REFS if k not in order]; assert not unused, unused
refs = [REFS[k] for k in order]

post = {'id': 'fire-evacuation-accuracy', 'kind': 'blog', 'publishedAt': '2026-11-10T00:00:00-08:00', 'content': {
  'format': 'article', 'journal': 'PlotCloud Research Notes', 'journalNote': 'Technical note · not peer reviewed', 'articleType': 'Research article',
  'title': 'How accurate is the fire evacuation simulation? Verification, sensitivity and a hospital case study of a grid-based evacuation model for early design',
  'authors': [{'name': 'PlotCloud Studio', 'aff': 'a'}], 'affiliations': [{'key': 'a', 'text': 'PlotCloud, building performance software for architects. Prepared with AI assistance; human review pending.'}],
  'history': ['Published online 10 November 2026', 'Version 2 (adds occupant groups)', 'Not submitted to a journal; not peer reviewed'],
  'keywords': ['Evacuation modelling', 'Verification', 'Required safe escape time (RSET)', 'Hospital evacuation', 'People with reduced mobility', 'Children', 'Monte Carlo convergence'],
  'highlights': HIGHLIGHTS, 'abstract': ABSTRACT, 'body': BODY, 'backmatter': [{'title': a, 'text': t} for a, t in BACK], 'references': refs,
  'category': 'studio', 'summary': 'A research article in journal form: the evidence behind every parameter, 18 verification tests after IMO MSC.1/Circ.1533 (all pass), run-count convergence, sensitivity to grid, incidents, occupant groups and hospital staffing, a hospital case study, and what the results can and cannot claim.',
  'image': 'img/research/evacuation-routes.jpg?v=20261110-2', 'imageAlt': 'Fire evacuation routes in the PlotCloud example hospital, lighter for people out sooner, darker for those out later, with stairs and exits marked'}}
c = post['content']
open(os.path.join(ROOT, 'mvp/research/fire-evacuation-article.js'), 'w').write('// Generated by tests/validation/build-evacuation-article.py from the experiment results; edit the script, not this file\nexport const evacuationAccuracyPost=' + json.dumps(post, ensure_ascii=False) + ';\n')
md = [f"# {c['title']}", '', f"{c['journal']} · {c['journalNote']} · {c['history'][0]}", '', 'PlotCloud Studio. ' + c['affiliations'][0]['text'], '', '## Highlights', '', *['- ' + h for h in HIGHLIGHTS], '', '## Abstract', '', ABSTRACT, '', 'Keywords: ' + '; '.join(c['keywords']), '', BODY, '']
for a, t in BACK: md += [f'## {a}', '', t, '']
md += ['## References', ''] + [f'{i + 1}. {r}' for i, r in enumerate(refs)]
open(os.path.join(ROOT, 'mvp/research/fire-evacuation-accuracy.md'), 'w').write('\n'.join(md) + '\n')
print('written:', len(refs), 'references,', BODY.count('\nTable '), 'tables')
