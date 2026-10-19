# Claude audit evidence review — 18 October 2026

These are verbatim report snapshots from local Git refs, pinned in sources.json. They describe Claude's work, not new Codex test runs. No fetch, merge, deployment or test rerun was performed.

## Critical context

Current main inspected: 763fb37439342e3799348b97f50ad0f25c7389e9. Audits 01–07, 09 and 10 share base d75264065dff560b4f13fd77304ca146bf96a474 (7 August 2026), with 253 commits on main absent from their histories. Their findings and metrics are historical branch evidence, not a current-main pass or confirmed current defect list. Audit 08 was rebuilt on main; its final net diff has four migrations and two email-function changes, plus documentation. Stale-base report is included for historical comparison only.

## Evidence limits and report discrepancies

- Security report states the four timestamped migrations were applied and email functions deployed v22/v24, with rollback-only verification. Codex inspected the report and SQL but did not independently query hosted state.
- Visual audit tip 2063bb2 contains pass-4 fixes for OwnerTools owner-context loading and BrandWorkspace role loading; markdown report ends at pass 3. Pass 4 cannot be counted as a newly verified complete visual pass.
- The initial visual/accessibility totals count nodes across repeated routes and viewports, not unique bugs. Authenticated visual, accessibility, routing and usability checks use mocked Supabase data.
- Audit 03 raw/npm-audit.txt retains the BEFORE output (two highs), while the report states the final fix yielded zero. Do not describe that saved file as a clean after-log.
- Audit 02 typeaware-after.txt is an intermediate output: report subsequently records 42 to 41 warnings. Different lint configurations across audits make their zero-warning claims incomparable.
- Performance audit fixes fonts from an old palette/font system (Baloo 2/Quicksand); current project history uses Bricolage Grotesque/Geist. Baseline landing score 98 becomes 96, while worst score improves 85 to 94; LCP reaches 2.63 seconds. This is mixed, not universal improvement.
- Audits 01/05 choose different replacement brand colours; 01 uses mobile top navigation, 10 a drawer; 03 uses unknown-route redirect, 06 NotFound; 03 reverts naive lazy splitting, 07 uses explicit vendor chunks. These changes need reconciliation rather than wholesale merges.
- Audit 09's old assertion that no map exists conflicts with newer native-shopper work documented in CLAUDE_HANDOFF.md. Its domain audit is primarily UI terminology/taxonomy, not loyalty-engine/refund/concurrency validation.
- Audit 10 report evolves over 12 passes. Earlier 'remaining' entries about owner member-list errors and mark-all-read are fixed later. Single-item mark-read error, dead Security control and duplicated state machinery remain in the final summary.
- Scope is primarily the web app. Native-device, physical scanner, real-inbox, real authenticated production flows and manual screen-reader acceptance are not established by these reports.

## Recommended next work

Compare each finding with current main before editing. Start with independent read-only hosted security verification, then current-main failure-state/role-loading checks, accessibility and responsive browser scans. Preserve current design/fonts/features. No product-owner input is needed for read-only review; deployment/production-write authorization remains governed by the existing handoff. No milestone completed or sequence changed, so IMPLEMENTATION_TIMELINE.md was not modified.