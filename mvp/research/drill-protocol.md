# What to record in an evacuation drill (to compare with PlotCloud)

PlotCloud technical note, 10 November 2026. A drill recorded this way can be loaded into Fire Evacuation (Everyone out › Compare with a drill) and compared with the simulation of the same building. Comparing simulations with measured evacuations is the validation step that the evacuation-model protocols ask for (NIST TN 1822; ISO 20414:2020). The simulation should be run before the drill and not adjusted afterwards (a blind prediction), or the comparison says little about its accuracy.

## Before the drill

- Agree the drill with the building owner, the facility's emergency planner and, in a hospital, clinical leadership. Never move real patients for a recording: use staff or volunteers as stand-ins, and follow the facility's drill policy.
- Get consent from the participants. Record exit crossings without faces where possible (overhead or rear camera angles), and keep the data anonymous.
- Note the conditions: the date and time of day, the number of people on each floor (by a headcount or access-control data), the groups (adults, older adults, children, walking-aid users, wheelchair users; in a hospital, patients by mobility and the staff on duty), which doors are held open, and the alarm system and its message.
- Synchronise every camera and stopwatch to the same clock, and note the exact time the alarm sounds (t = 0).

## During the drill

The minimum is the time each person passes an exit door, in seconds after the alarm, from a video at every exit. Better records add the following, in order of value:

1. When each person starts to move (the end of pre-movement), from cameras in corridors or observers on each floor.
2. Their floor and start room, and their group.
3. The exit or stair used, and the times they enter and leave each stair.
4. Incidents: falls, people turning back, doors blocked or locked, people helping others.
5. In a hospital: for each patient moved, the device used (bed, wheelchair, evacuation chair, rescue sheet), the number of staff, the time preparation started and ended, and the time the patient reached the next compartment and then the outside.

## The file

A CSV with one row per person and their exit time in seconds after the alarm, for example:

```
person,out_s,floor,start_room,group,exit
1,48,Level 2,Patient room 201,adult,Exit stair West
2,52,Level 2,Patient room 202,older,Exit stair West
```

If only door counts were recorded, give the cumulative count instead: columns `time_s,people_out`. Rows beginning with `#` are ignored. A template can be downloaded from the study card.

## What PlotCloud compares

- The total time against the spread of the runs (the 10th to 90th percentile).
- The times at which half and 90 % of the people were out.
- The difference between the curves of the share of people out over time (ERD, the Euclidean relative difference, from 0 for identical curves, sampled every 5 s).

One drill is a single sample of a random process. Several drills, or a drill with detailed records, tell more than one total time.
