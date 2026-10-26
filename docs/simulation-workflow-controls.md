# Persistent simulation actions

The simulation header now has a persistent Run study action and a state readout. It delegates to the original engine Run button, preserves long-run confirmation and Cancel, and exposes Stop only when the engine itself offers a visible stop action. Stormwater targets its active nested workspace. No alternate calculation or solver is introduced.

Sun Hours, Radiation, UTCI and Daylight use their engine-owned result state to prevent saving before calculation, while busy, or after inputs invalidate a result. A saved result cannot be saved repeatedly through the header until a new result is available. Daylight quality buttons trigger native calculations and now capture the shared project-input snapshot, just like Run. Other tools retain their existing save validation; the header does not claim a universal freshness guarantee for engines without a validity API. Weather preparation and engine setup block premature host actions. Polling is disposed on route exit.

Verification: tests/simulation-workflow.cjs uses actual Sun Hours and Daylight calculations, saving, changed-input blocking, repeated-save prevention, native quality auto-runs, and long-run confirmation/Cancel from collapsed settings. tests/simulation-panel-scroll.cjs covers all 18 layouts at three desktop sizes plus actual Sun Hours save, PNG export and chart access.
