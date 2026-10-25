# The user's side (2026-10-25)

After logging in, people land on the **Dashboard** (`#/home`). Account settings are tabs on `#/account`. Everything is kept in this browser (prototype: no server).

## Dashboard (`mvp/js/pages/dashboard.js`)
- **Pick up where you left off**: the project you are on, and three cards: Continue modelling (Workspace), Continue simulating (the last simulation you opened), Compare results. The last places are recorded by the router (`S.touchRecent`).
- **Needs attention** (only when there is something): the default site is still the sample; a project has unsaved changes since its last version; the latest version has no result for simulations that ran on earlier versions; a Sun hours / Daylight result needs a rerun because shared conditions changed; browser storage over 80 %; no backup in 14 days. Each has the button that fixes it. Rerun reminders follow Account › Notifications.
- **Your projects**: cards with the latest result picture, site, versions, results, last change, unsaved state. Search, sort (last changed, name, most results). New project: blank, from the sample (two versions), or import a model (opens the Workspace on Import model). The ⋯ menu: rename, duplicate, shared conditions, archive / unarchive (Show archived), delete (type DELETE).
- **Side column**: plan (trial days left, prototype, no payment), storage used in this browser, the simulations you run most, recent activity (versions saved and simulations run, with the first figure).

## Account settings (`mvp/js/pages/account.js`, `?tab=`)
- **Profile**: name and email (saved, shown in the header), units and language (metric, English), time zone of the computer; delete account (type DELETE).
- **Site & defaults** (opens first): the site search and facts, simulation defaults, and which projects follow the site, as before.
- **Plan**: trial status; billing and seats are marked as coming.
- **Backup & data**: download a backup (.json of every project, version, result and setting), restore one (add its projects, or replace everything), storage used, remove pictures of older results, reset the sample.
- **Notifications**: a message when a batch run finishes or fails (Results), rerun reminders on the Dashboard; email is marked as coming.

## Header
Signed in: Dashboard first in the main menu, and an avatar menu (name and email, Dashboard, Account settings, Backup & data, Log out). Logging in goes to the Dashboard unless the person was on their way somewhere (`?next=`).

Test: `tests/mvp-dashboard.cjs`.
