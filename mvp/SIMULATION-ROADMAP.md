# PlotCloud simulation roadmap

The product goal is not the largest tool count. It is one coordinated model that lets an architect screen options, understand the evidence, compare like-for-like results and export a reviewable record.

## Current product contract

- Every run belongs to a project, saved model version, level, shared conditions, study settings and generation time.
- Catalogue labels distinguish benchmarked components from unverified screening engines.
- A PlotCloud `Engine` badge means the result was calculated rather than mocked. It does not mean professional validation, code compliance or certification.
- Existing tools remain available while their methods and limits are made explicit.

## Core additions

1. **Whole-building energy and loads**
   - Annual heating, cooling, electricity and end-use breakdown.
   - Peak heating and cooling loads by zone.
   - Weather file, schedules, constructions, glazing, infiltration, HVAC assumptions and unmet hours recorded with the result.
   - Reference target: an EnergyPlus-compatible workflow, with benchmark cases before any compliance claim.

2. **Indoor thermal comfort**
   - Operative temperature, PMV/PPD and adaptive comfort by occupied hour and zone.
   - Direct connection to the energy model, schedules and natural-ventilation assumptions.

3. **Carbon**
   - Operational carbon from energy and an explicit electricity/fuel scenario.
   - Embodied-carbon screening from quantities, assemblies, service life and declared data source.
   - Never combine operational and embodied carbon without exposing boundaries and study period.

4. **Lighting quality**
   - Annual glare, point-in-time glare and electric-lighting demand.
   - Dynamic blinds, frames and exterior obstructions.
   - Radiance-compatible verification for annual daylight and glare.

5. **Life-safety separation**
   - Keep the existing circulation study for everyday travel paths.
   - Add fire, smoke, exit capacity, queues and occupant behaviour only as a separate validated workflow.
   - Do not relabel circulation output as evacuation or code compliance.

## Supporting additions

- Terrain-aware outdoor wind and noise.
- Wind-tunnel benchmark cases for the wind solver before reporting absolute comfort values.
- Stormwater design events, soil/infiltration assumptions and storage sizing.
- Acoustic insulation, echoes and product-specific absorption data.
- A method panel on every result with engine version, benchmark status and known limits.

## Defer

- New specialist studies without a clear architectural decision or exportable result.
- Resource-library expansion that does not feed the current project and model.
- Mobile-first simulation authoring; retain mobile review while desktop remains the primary authoring surface.

## Remove or avoid

- Tool-count claims as the main value proposition.
- “Validated”, “compliant” or “certified” labels without a named method, benchmark and applicable scope.
- Results that overwrite earlier runs or lose their source version and settings.
- Separate inputs for the same site, north, weather or model when the project already owns them.

## Acceptance standard for every new study

1. The entry is discoverable from the correct decision domain.
2. It reads the selected saved version and shared project conditions.
3. Required inputs, assumptions, method, engine version and limitations are visible before running.
4. The run finishes or fails with a useful explanation.
5. Results identify their project, version, level, settings and generation time.
6. Like-for-like versions can be compared without re-entering conditions.
7. A report-quality image, table or data file can be exported.
8. A reproducible benchmark or reference case defines what “verified” means.
