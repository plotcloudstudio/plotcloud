## Research status and authorship

PlotCloud technical research note, 5 November 2026. This is an openly inspectable methods and software-verification study, not a completed doctoral thesis, a peer-reviewed clinical study, or an empirically validated hospital evacuation model. Software and text were developed with AI assistance. No real patient records, hospital drills or clinical outcomes were collected for this release. The numerical results below were calculated by the published code, not invented as narrative examples. Human subject-matter review and independent empirical validation remain necessary before research conclusions about real hospitals can be defended.

## Abstract

Hospital evacuation raises a coupled spatial and operational question: can a patient reach a suitable destination when routes, mobility and assistance are constrained simultaneously? This note defines a multi-level network model, implements finite escort resources and portal queues, and exposes the complete experiment record. It distinguishes same-level relocation from final evacuation, records incomplete outcomes, and uses seeded random draws for repeatable sensitivity experiments. Eight synthetic conditions with 100 replicates each test navigation resolution, escort availability, exit blockage and hypothetical individual disruption. The results verify specific computational behaviours and illustrate sensitivity within this model. They do not establish actual hospital evacuation times, safe staffing levels, or clinical safety. The intended contribution is an auditable research instrument and a testable validation protocol, rather than a claim that animation proves performance.

## 1. Research question and decision context

The target user is an architect working with a hospital emergency-planning team. The decision is whether a proposed arrangement changes patient transfer paths or assistance bottlenecks under explicitly held conditions. The deliverable is a comparison record containing geometry, patient groups, resource assumptions, model version, outcomes and unresolved cases. A shorter animated path alone cannot establish a better evacuation plan.

The research question for this implementation is: how do spatial connectivity and finite escort availability jointly affect time to a designated receiving room or exterior exit in a multi-level network, and how sensitive are those outputs to numerical resolution and uncalibrated stochastic assumptions? A subsequent empirical study must determine whether this abstraction has sufficient predictive validity for a specified hospital task. That second question is not answered by the present synthetic experiments.

## 2. Focused literature basis

This is a focused methods review, not a systematic review. Sources were selected for direct relevance to evacuation-model verification, healthcare evacuation strategy, and observed assisted vertical transfer. No exhaustive database search or publication-bias assessment is claimed.

NIST TN 1822 distinguishes verification and validation and discusses pre-movement, navigation, exit use, route availability and flow constraints as core model components. We use these categories to organise our tests; passing our small test suite does not mean completing the full NIST programme or receiving NIST approval. [Ronchi et al., 2013, NIST TN 1822](https://www.nist.gov/publications/process-verification-and-validation-building-fire-evacuation-models).

Healthcare fire guidance treats patient dependency, trained staff and physical precautions together. Its discussion of progressive horizontal evacuation motivates our separation of same-level receiving destinations from exterior exits. Our receiving-room label does not verify a fire compartment, continued treatment capacity or an approved evacuation strategy. The cited document concerns healthcare premises in England; this software does not translate it into automatic code compliance for other jurisdictions. [HTM 05-02, 2015 edition](https://www.england.nhs.uk/wp-content/uploads/2021/05/HTM_05-02_2015.pdf).

Gildea and Etengoff report a drill involving 12 simulated critically ill patients transferred from a fourth-floor unit by response teams. This is useful evidence that preparation, equipment and assistance matter. Its setting and team composition are specific, so we do not turn its reported transfer rate into a universal speed or a default for our bed profile. The source examined here is the published abstract; this is not a reanalysis of its underlying observations. [Gildea & Etengoff, 2005, DOI 10.1017/S1049023X00002600](https://pubmed.ncbi.nlm.nih.gov/16128472/).

## 3. Geometry and three-dimensional representation

The input is an immutable saved Plan Studio model. Each floor supplies closed rooms, wall geometry, door openings and furniture bounds in metres. A room contains a clearance-aware two-dimensional navigation grid. Door portals link rooms, while manually confirmed connections join representative points on different levels. Each connection records its travel length, clear width, speed multiplier and step-free suitability. A length shorter than the straight three-dimensional distance is rejected.

This is a multi-level network embedded in three dimensions, not a continuous three-dimensional body-dynamics solver. Within-floor movement follows grid paths; the visualiser retains actual floor elevations. A dashed connection is a schematic route whose elapsed travel time uses the entered length. It does not reconstruct the shape of a staircase. Ordinary lifts are not automatically enabled for fire evacuation, and a patient requiring a step-free route cannot use an unmarked stair connection.

Walls and furniture restrict the moving clearance envelope. A bed is approximated by a circular diameter, which cannot establish whether a long bed can turn a corner. Imported decorative meshes do not automatically provide reliable blocking geometry. These are explicit model-form limitations, not small rendering defects. Geometry and connection review are therefore prerequisites for applying the model to a real project.

## 4. State transitions, queues and staff

Each simulated person progresses from alarm response to escort assignment, preparation, route traversal and arrival. Unreachable destinations, inadequate escort teams and an observation time limit are separate outcomes. Independent walkers need no escorts; assisted walking, wheelchair and bed groups have editable requirements. Profiles are convenience presets containing hypothetical values, not literature-derived clinical categories with calibrated distributions.

A group's speed is drawn uniformly between its minimum and maximum, and its response time is drawn independently within the entered range. Preparation is a fixed input. For an edge of length L, speed v and transfer multiplier f, travel time is L/(v f). For a portal of width w and specific flow q, the service interval is h = (1 + a)/(q w), where a is the required escort count. Both directions share the same portal service clock. A party waits until that clock is available, consumes h, then traverses the edge. This is a deliberately simplified queueing rule; the linear width-flow relationship is an input assumption rather than an established description of bed transport.

Escorts are a finite pooled resource. A team remains assigned through preparation and movement, then becomes available after a specified return/reset delay. Ready patients that can be staffed are considered in queue order; a request requiring more available staff may be bypassed. Clinical triage priority is not implemented. Exact-time ties follow the implementation's deterministic heap ordering and can influence assignment, so no claim of equitable or optimal scheduling is made. Escort return trajectories are not simulated, although escorts contribute to portal service demand.

Routes are chosen at assignment using static travel and portal-service cost. They do not anticipate future queues, adapt to evolving smoke or discover new blocked routes during travel. Receiving-room capacity is reserved at assignment. Horizontal mode removes cross-floor edges and uses only destinations on the origin floor; final mode targets confirmed exterior doors. The two endpoints must not be merged into one success statistic.

## 5. Randomness and reproducibility

Every replicate has an explicit seed. Each person's random stream is derived from the seed and stable group/person identifier. Speed, response, disruption occurrence, disruption duration and position in the edge sequence are sampled in a fixed order. The same identifiers and seed therefore support paired scenario comparisons, although changing the population or group identities changes the pairing. Replicates use consecutive seeds and a deterministic non-cryptographic pseudorandom generator; no claim of formal random-stream independence is made.

The optional disruption is one Bernoulli event per person per run, followed by a uniformly sampled delay. Its default probability is zero. Enabling it requires a cited source or an explicit hypothetical rationale. The demonstration's 10% probability is a stress-test assumption, not an estimate of children falling, patient falls or any real incident frequency. The event pauses one party at an edge start; it does not represent a fallen body blocking others, injury, rescue or contagion of behaviour.

Repeatability is different from validity. A reproducible but misspecified model remains misspecified. The JSON export therefore includes exact geometry, settings, model version, seed sequence, per-person trajectories and event records. CSV exports retain person-level and replicate-level outcomes. Input changes disable saving the old result as current; a saved historical result retains its own snapshot. The published experiment package also records SHA-256 hashes of the source files used to generate it.

## 6. Verification design

The automated tests include a closed-form queue benchmark: three simultaneous independent walkers traverse a 10 m edge at 1 m/s through a portal serving one person per second. Expected arrival times are 11, 12 and 13 seconds. With one escort available, one escort required per patient, two seconds preparation and five seconds turnaround, the corresponding arrivals are 14, 33 and 52 seconds because each party consumes two seconds of portal service. These are equations against which the implementation is checked, not values fitted from a hospital dataset.

Additional tests exercise upper-floor routes through two transfers, blocked final exits, step-free exclusion, receiving capacity, absent staff, empty populations, observation cut-offs, a fixed 17-second disruption, invalid widths and lengths, reproducible seeds and export escaping. Quantile reporting is checked against an incomplete replicate. The tests are executable using node --test tests/fire-evacuation.test.mjs in the repository. This suite verifies selected behaviours only; it is not a comprehensive independent verification assessment.

## 7. Synthetic experiment design

The teaching geometry has three 18 × 12 m floors at elevations 0, 3.6 and 7.2 m. Rooms connect to a central corridor and stair landing. Adjacent landings are connected by hypothetical 9 m routes, width 1.4 m and speed multiplier 0.55. The exterior opening is 1.6 m in the core geometry fixture. Each vertical case starts five independent walkers per floor. Speeds range from 0.8 to 1.2 m/s; response times range from 10 to 40 s. Specific flow is 1 person/(m·s). These numbers define the synthetic experiment and are not recommended hospital design values.

The horizontal cases instead use three bed-transfer patients per floor, two escorts per patient, speeds 0.2–0.5 m/s, response 30–90 s, preparation 60 s and turnaround 30 s. Each floor's receiving room has capacity 20. Staffing is varied across 2, 4 and 8 pooled escorts. Each condition uses seeds 104729 through 104828 and a 3,600-second observation horizon. No parameters are fitted to the outputs. Vertical and horizontal cases have different populations and endpoints, so their times must not be interpreted as competing clinical strategies.

The published fixture calls the core Plan Studio room builder before browser door-generator normalisation. The editable browser example can have smaller clear openings after that normalisation, so matching seed alone is insufficient to reproduce the table: use the published geometry and exact scenario. This distinction is retained in the data provenance. [Download the complete experiment package](research/hospital-evacuation-experiments.json).

## 8. Calculated results

- Vertical, 0.10 m grid: 100/100 runs completed; clearance P50 108.08 s, P95 121.37 s.
- Vertical, 0.25 m grid: 100/100 completed; P50 108.34 s, P95 121.67 s.
- Vertical, 0.50 m grid: 100/100 completed; P50 108.33 s, P95 121.66 s.
- Horizontal bed transfer, 2 escorts: 100/100 completed; P50 1057.06 s, P95 1090.31 s.
- Horizontal bed transfer, 4 escorts: 100/100 completed; P50 583.42 s, P95 604.85 s.
- Horizontal bed transfer, 8 escorts: 100/100 completed; P50 352.63 s, P95 372.50 s.
- Blocked final exit: 0/100 completed; all 15 occupants were incomplete in each run. Clearance quantiles are not reported.
- Hypothetical 10% individual disruption: 100/100 completed; P50 116.22 s, P95 134.77 s.

These are sample quantiles across 100 synthetic replicates, calculated using linear interpolation between ordered observations. They are not confidence intervals, guaranteed evacuation bounds or real-world fall-risk estimates. If any replicate is incomplete, whole-population clearance quantiles are withheld rather than silently excluding failures. All incomplete occupants remain in the exported denominator. Zero population does not produce a successful zero-second evacuation.

In this fixture, the three grid resolutions produce similar median clearance, while escort availability strongly changes the bed-transfer endpoint. This establishes behaviour under the chosen abstraction, not a generally sufficient grid resolution or a hospital staffing prescription. The shared escort pool, fixed reset time and hypothetical service law can themselves generate that sensitivity. The disruption result shows that the event mechanism affects outputs; it does not validate the mechanism or its frequency.

## 9. Required empirical validation programme

Before presenting this as doctoral evidence about real hospitals, the research needs a defined target population, an original and bounded contribution, an independently reviewed protocol, and an appropriate empirical dataset. A defensible next study would record de-identified transfer trajectories, response and preparation times, door and stair geometry, equipment dimensions, team composition, staffing schedules, destination capacity and relevant route disruptions. Institutional permission and any applicable ethics review must precede collection. Vulnerable patients should not be exposed to hazardous experimental conditions to validate this software.

Calibration and evaluation data must be separated by independent drill or building, rather than randomly splitting correlated frames from the same trajectory. Candidate outcome measures include transfer-time error, route-choice agreement, queue formation and location, staff-cycle time, and interval coverage by dependency group and floor. Acceptance tolerances must be specified for the intended use before examining the test results. Between-drill and between-hospital variation should be retained instead of being mistaken for individual random noise.

Parameter uncertainty needs to be separated from stochastic variability and model-form error. Planned analyses should examine correlated mobility/assistance, staffing schedules, equipment clearance, preparation distributions, disabled routes and destination availability. Paired seeds can reduce comparison noise, but cannot repair biased assumptions. Monte Carlo convergence, confidence intervals, out-of-sample validation and sensitivity rankings remain future work; the present release supplies raw records to support that work and does not claim those analyses have already been completed.

Smoke, heat and toxic exposure are absent, so the tool cannot compare available and required safe egress time. Its alarm-relative duration omits detection. Even a completed path therefore does not establish survival, safety, tenability or code compliance. Physical crowd interactions, real bed turning, dynamic fire compartments, staff return paths and clinical continuity require additional models or measured constraints before broader claims can be made.

## 10. Reproduction and review

Run node --test tests/fire-evacuation.test.mjs for the automated checks, then node tests/hospital-research-experiment.mjs to regenerate the eight-condition data package. Compare the source hashes and scenario contents before comparing results. In PlotCloud, open Fire Evacuation, create the labelled synthetic example, inspect the input basis, run the experiment, select a replicate and replay it across floors. Save the result and export JSON together with the report; the report alone does not contain every trajectory.

This release supports a reproducible research workflow. Its evidence supports selected software behaviours and conditional synthetic sensitivity findings. A doctoral-level contribution will depend on the subsequent research design, empirical validation, critical interpretation and independent scholarly review—not on the length of this article or the polish of its three-dimensional view.

[Source code](https://github.com/plotcloudstudio/plotcloud/tree/main/mvp/js/egress) · [Verification tests](https://github.com/plotcloudstudio/plotcloud/blob/main/tests/fire-evacuation.test.mjs) · [Open Fire Evacuation](#/simulations/fire-evacuation) · [Download this methods note](research/hospital-evacuation-methods.md) · [Download raw synthetic experiments](research/hospital-evacuation-experiments.json)
