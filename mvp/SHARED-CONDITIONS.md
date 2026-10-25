# Shared conditions pilot: Sun Hours and Daylight

For an architect iterating a Workspace design, the goal is to enter common conditions once and obtain reproducible version-linked results without repeating site and occupancy forms.

- `#/project-settings/<projectId>` edits the pilot's frozen project site, north, IANA time zone, Sun date preset and Daylight work plane/occupied hours. It is accessible from either study's header, shared summary, project context and Account project cards.
- Account seeds new projects. Existing projects get a one-time snapshot of their currently effective legacy site and defaults. Changing Account later does not alter either pilot study's project snapshot. Existing versions and runs are not rewritten.
- Both studies have Settings/Export left and Results/Charts right. Shared inputs are disabled inside a collapsed study-only override section; weather/material/view controls remain in Advanced. Reset restores project inputs without changing the user's Sun date range.
- Studies still use their actual Workspace input adapters and engines. Daylight remains an early-design estimate, uses a generic year without an EPW, and is not Radiance/certification. EPW loading is study-specific and can change its local station coordinates; it never updates project or Account data.
- Runs retain the project revision, relevant condition signature and actual effective engine settings. Result cards and comparisons mark stale/legacy conditions; project edits do not modify saved results. Batch fields and workers inherit the same pilot conditions and still support per-job overrides.
- Other simulations intentionally retain their current layout, Account defaults and legacy `siteLinked` behaviour until the two examples are reviewed. No global migration changes their inputs. The Account UI labels that distinction.

Validation: `tests/shared-conditions.cjs` exercises actual runs and batch jobs, Account/new-project isolation, validated project edits, overrides/reset, chart access/CSV export, immutable history/stale warnings and legacy migration. `tests/simulation-fit.cjs` checks desktop fit; standalone Sun/other-engine workflows remain covered separately.
