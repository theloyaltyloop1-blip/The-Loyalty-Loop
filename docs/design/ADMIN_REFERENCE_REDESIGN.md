# Admin reference redesign - 9 October 2026

The owner supplied four dashboard references and asked for the website palette to deploy first, then for the admin panel to adopt the reference appearance. They subsequently confirmed: keep the public website as deployed and focus on admin.

Implemented a white rounded workspace on a pale lavender-grey canvas, grouped sidebar navigation, neutral metric cards, dark actions, lavender highlights, feature columns and an app-share donut. All 14 current views, URL/reload/back state, admin authorization and current operations are retained.

| Before | After | Why |
| --- | --- | --- |
| Flat blue/slate shell | Rounded white shell and lavender selection | Matches the supplied reference direction |
| Two horizontal bar lists | Feature columns plus app-share donut | Gives the two existing datasets distinct visual forms |
| Single queue callout | Three clear queue rows with counts | Keeps work requiring attention easy to find |
| Plain metrics | Neutral rounded cards with pastel icon fields | Establishes the reference hierarchy without invented statistics |

Main files: `apps/web/src/pages/AccessPanel.tsx`, `admin-reference.css`, `components/admin-dashboard.tsx`, `scripts/build-website-palette.py` and generated `color-system.css`/palette exports. Existing `admin-panel.css` provides base/table/queue styles; the reference CSS provides the current layout. No dependencies, backend schema, auth policies or native app changes.

Analytics use the existing last-30-day opted-in rows. Feature people counts are unique only within each feature/surface; they are not summed across features. App share uses action counts. No revenue, invented change percentages or daily trend has been added. Empty/error charts remain explicit, and failed queue reads show unavailable. Chart legends include names and values, so colour is not the only encoding.

Verification completed locally: web TypeScript; 129/129 supported WCAG semantic pairs; isolated Chrome with actual source and test-only in-memory auth/data aliases covering 14 views, responsive desktop/phone layouts, measure switching, URL/reload/back, dark-theme admin isolation and empty/error/queue-failure states. Zero browser page errors. `docs/design/admin-reference` contains screenshots and results with **illustrative data**, not live platform statistics.

Initial fixture startup failed on router resolution and a missing auth-listener stub; corrected fixture-only aliases/stub and fresh rerun passed. Initial website palette checks had separate sandbox/server and missing local environment setup failures, documented in the handoff. No test auth alias is imported by production configuration.

The public palette was deployed in commit `35e0a8f`, deployment `dpl_E8LWWAPtERmjpy8WThVycot2YZag`, and live domain colours/login gate were verified. Admin release verification and deployment status are recorded in the latest handoff. Signed-in live data/actions and native wrapper/device behavior remain unverified until explicitly recorded otherwise.

The two requested sources' standalone skills are installed. Full UI Color Palette marketplace/MCP activation was auto-review blocked; it is separate from this website release, and no remote-generated palette/APCA result is claimed.
