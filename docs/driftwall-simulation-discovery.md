# DriftWall and simulation discovery cards

Audience/task: architects and students need to choose a simulation by the design question it answers, without leaving the model or starting a calculation just to inspect a tool. The existing Workspace menu was a label-only list. The homepage now exposes every registered simulation through a DriftWall; the Workspace menu pulls out a readable card when hovered/focused.

Implementation:
- mvp/js/simulation-presentation.js is the shared imagery and intent registry. Home DriftWall, its study switcher, Workspace previews and the simulation catalog read the same image source per simulation. All 22 registered studies have an existing image and a question/description. The current Workspace picker contains 20 studies; its existing categories and study-entry behavior are preserved.
- mvp/js/drift-wall.js adapts the React Bits JavaScript/CSS source supplied by the user to PlotCloud's existing DOM runtime. It retains alternating drifting columns, damped velocities, hovered-column slowdown, pointer parallax and tile lift. The source notice/license is in THIRD_PARTY_NOTICES.md. No React runtime or demo remote images are introduced.
- Motion pauses offscreen or while the document is hidden. A Pause/Resume button is available. Keyboard browsing and reduced-motion preference use a scrollable static layout with one tab stop per study, excluding repeated visual copies. Observers and animation frames are removed on page cleanup.
- Workspace preview cards use the existing images, short decision questions and existing input metadata. Mouse preview does not run a study; clicking retains the existing entry behavior, including its existing autorun behavior where applicable. Arrow keys/Home/End browse, Escape/Tab dismiss. Cards are clamped to the viewport, and menu listeners are disposed with the page.

Verification:
- Syntax and whitespace checks pass. All 22 image files exist and all intent records are nonempty.
- Browser: 22 unique study types in the wall; five columns at 1440px and two at 390px, with no horizontal page overflow. Pause holds the column transform stable. Mouse hover reaches a 64px tile lift and changes the explanatory caption. Keyboard focus switches to static browsing and keeps the focused last study visible; duplicate visual copies have no tab stops. Returning to Pricing removes the wall.
- Browser: all 20 Workspace entries cycle by keyboard with their image/question; every preview stayed within the desktop viewport. Escape hid both the menu and preview. Clicking Daylight opened the existing in-Workspace study. The Wind image source matched exactly between the wall and the preview card.
- Previews remain illustrative artwork, not computed results for a visitor's project. Solver methods, saved results, model geometry and permissions are unchanged.

