# PlotCloud usability test: from a place on the map to a compared scheme

A moderated test with **5 people**, one at a time, 45–60 minutes each, in person or on a video call with screen sharing.
It tests the path built on 2026-10-25: Dashboard › New project › From the map → site in Plan Studio → masses → sun preview →
schemes → Sun hours. The kit: this protocol, `tasks-card.md` (to hand to the participant), `recording-sheet.csv` and
`timer.html` (the moderator's timer and notes, works offline, exports CSV).

**What this test can and cannot tell.** Five people find most of the serious problems on one path (the usual rule of thumb for
qualitative usability tests); they do not give reliable numbers. Report task outcomes as "3 of 5", not as percentages, and treat
SUS scores as indications.

## 1. Questions the test answers

1. Can people start a project from an address and get the right plot without help?
2. Do they trust the site? (Do they notice estimated heights, and can they correct a wrong one?)
3. Can they draw a mass to a target (storeys, coverage) and read GFA and FAR?
4. Do they understand the sun preview and what "Plot ≥ 2 h sun" means?
5. Can they make a second scheme, compare it and say the trade-off in their own words?
6. Do they understand the difference between the preview and Sun hours?

## 2. Participants (5)

| # | Profile | Why |
|---|---|---|
| P1 | Architect, 2–10 years, does feasibility or competitions | Main user |
| P2 | Architect or architectural designer, uses Rhino/SketchUp daily | Compares with their tools |
| P3 | Urban designer or planner | Reads FAR, coverage, sun on public space |
| P4 | Developer, project manager or client-side | Reads the trade-off, not the geometry |
| P5 | Architecture student (final years) | First-time user, no habits |

Screener (by email or call): role, years, tools used weekly, has done a site feasibility study in the last year (P1–P4 yes),
comfortable thinking aloud in English. Exclude anyone who worked on PlotCloud. Offer the usual thank-you (e.g. a gift card).

## 3. Set-up (moderator, before each session)

* A laptop or desktop, screen at least 1366 × 768, Chrome or Edge, mouse with a wheel. Screen and voice recording on, with consent.
* Open https://plotcloudstudio.github.io/plotcloud/mvp/ in a **fresh browser profile** (or clear the site's data: DevTools ›
  Application › Clear site data), so the participant starts signed out with no projects.
* Open `timer.html` on the moderator's own device (or a second window the participant cannot see). Enter the participant code.
* Network: the map, OpenStreetMap and terrain tiles need the internet. If a corporate network blocks `overpass-api.de`, the site
  falls back to `api.openstreetmap.org` (small sites only). Check once before the session with the test address.
* Test address for everyone: **800 Robson Street, Vancouver, BC**. Radius 150 m. Plot: about 40 × 30 m at the block corner nearest
  the address marker. Before the first session, pick the neighbour for T2 (a building next to the plot whose label says `est.` or a
  height far from 45 m) and use the same one for everyone.

## 4. Script

**Welcome (3 min).** "Thank you for coming. We are testing the website, not you; nothing you do is wrong. Please think aloud: say
what you look at, what you expect and what surprises you. I will not help much, because we want to see where the site does not
help you. You can stop at any time. Is it all right to record the screen and your voice? The recording is only used by the team
and deleted after the analysis."

**Background (3 min).** Role; the last site feasibility study they did and the tools they used; what they check first on a new site.

**Tasks (30–40 min).** Hand over the task card one task at a time. Start the timer when they have read the task; stop it when they
say they are done or give up, or at the time limit. After each task ask the Single Ease Question: *"Overall, how easy or difficult
was this task?"* 1 (very difficult) to 7 (very easy). Note what they said, where they hesitated, errors, and any help you gave.

When to help: only after 2 minutes stuck, or when they ask twice. Help in steps: (1) "What are you looking for?" (2) "Where would you
expect it?" (3) point to the area of the screen. (4) Show it. Record the level of help (0–4).

**After the tasks (8 min).** The System Usability Scale (10 statements, 1–5, in `recording-sheet.csv`'s SUS columns), then:
* "What would stop you from using this on a real project?"
* "Which of the figures would you put in front of a client? Which would you not trust?"
* "What did you expect that was missing?"
* "If you could change one thing, what would it be?"

**Thanks and close (2 min).**

## 5. Tasks, success criteria and time limits

| Task | Success | Partial | Limit |
|---|---|---|---|
| **T1** Start a new project for 800 Robson Street, Vancouver, with the surroundings within 150 m, and the plot on the corner shown on the card. | Project opens in the Workspace with the site and the plot on the right corner | Site loads but the plot is wrong or missing | 6 min |
| **T2** One neighbouring building (the moderator points at it) is 45 m tall in reality. Make the model match. | Height 45 m on that building | Changed the wrong building, or found the panel but did not finish | 4 min |
| **T3** Draw a building of 6 storeys that covers about half of the plot. What are its gross floor area and FAR? | Mass of 6 storeys, coverage 40–60 %, reads GFA and FAR correctly | Mass drawn, figures not found or misread | 5 min |
| **T4** How much of the open part of your plot gets at least 2 hours of sun on 21 March? | Turns on Sun, reads the "Plot ≥ 2 h sun" value | Turns on Sun but reads another figure | 3 min |
| **T5** Make a second option that is twice as tall, and tell me in one sentence what you gain and what you lose compared with the first. | Scheme B with 12 storeys, opens Compare, states GFA gain and sun loss | Makes B but cannot compare, or compares by memory | 5 min |
| **T6** Run the full sun-hours simulation on your current option and keep the result. | Sun hours runs and the result is saved | Opens Sun hours but does not run or save | 5 min |
| **T7** Close everything. Find your project again and open the option with the tall building. | Dashboard › project › Workspace, Scheme B open | Finds the project, not the scheme | 3 min |

## 6. What to record (per task)

Time on task (s), outcome (S / P / F), help level (0–4), errors (wrong clicks, dead ends, misreadings, each with a short note),
SEQ (1–7), and quotes. `timer.html` keeps all of this and exports `recording-sheet.csv` format.

Also note, across the session:
* Did they notice the height labels `est.` and `(floors)`? Did they ask where the data came from?
* Did they understand that the preview is not the full simulation?
* Did they find the Site layer lock? (Task T2 needs it in the Workspace.)

## 7. Analysis (after the 5 sessions)

1. Per task: outcomes (e.g. "S S P F S"), median time, median SEQ, help given.
2. List every problem with: task, what happened, how many participants (n of 5), severity — **4** stops the task, **3** major delay
   or wrong result believed, **2** minor delay, **1** cosmetic.
3. SUS: per participant (0–100) and the median. Below 68 is below the usual average.
4. Fix in order: severity × number of participants. Re-test the fixed path with 2–3 new people.

Write the findings with the participant codes only. Delete recordings after the analysis, as promised in the consent.

## 8. Consent (read aloud or sign)

"I agree to take part in a usability test of PlotCloud. I understand that the screen and my voice will be recorded, that the
recording will be seen only by the PlotCloud team and deleted after the analysis, that my name will not appear in any report, and
that I can stop at any time without giving a reason."  Name, date, signature.
