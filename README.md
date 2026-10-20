# Alvins Slave

A pre-op nurse assignment pilot. Built with React, TypeScript, Vinext and Cloudflare D1 through Sites. No paid model, payment integration or API subscription is configured.

## Run locally
- Install the starter dependencies with the Sites installation helper or `npm run install:ci`.
- Generate migrations with `npm run db:generate`.
- Build using the Sites build helper. Apply the generated migration to the local D1 database with `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_even_harry_osborn.sql`.
- Run `npm run dev`. Use the local sign-in simulation to test saved schedules.
- `node --test tests/planner.test.mjs` exercises the scheduler. `npx tsc --noEmit` checks types.

## Team workflow (version 2)
Daily roster and CSV import; two early members and one late member per four-cubicle team; editable primary pairs, services, ORs and demand levels; float and leadership assignments; optional rotation history; locked teams; manual adjustments; timed breaks and explicit relief; actual JP2-to-JP3 transfers; workload-driven closure; approval, CSV, two-floor Print / Save as PDF, backups and authenticated persistence.

The initial roster has illustrative names and designations, except Annie and Tiffany's confirmed weekday finish rules. Every designation requires confirmation. The coordinator must verify the sample cubicle layout and enter real staff before use.

## Confirmed scheduling rules and implementation limits
- JP2 has 8 early and 5 late nurses; JP3 has 11 early and 6 late. Each floor has an additional morning charge RN, excluded from both those totals and RN/LPN balance.
- Regular early shifts are 05:45–13:45 or 06:00–14:00. Annie finishes at 10:00 and Tiffany at 12:15 Monday–Friday; they normally float. The recurring settings are stored per nurse, not inferred from names.
- Late starts are 10:00, 11:00, 12:00, 13:00 or 15:00 with eight-hour shifts.
- Each early pair includes an RN. The pair covers four cubicles before the late member arrives; each early member primarily covers two. All three share coverage and breaks afterward.
- Two distinct late RNs begin as floats and take JP2 POC / JP3 afternoon charge from 13:30. They remain counted staffing and continue floating.
- At every recorded shift, break and transfer boundary, available RNs must strictly outnumber available LPNs on each operating floor. A recorded break removes that nurse from availability.
- Before 14:00 each team needs an available member or explicit relief. From 14:00 coverage is shared across the floor; late assignments retain their original cubicles.
- JP2 transfers start from 14:00. Its POC cannot transfer ahead of closure. Closure has no default time and is entered by the coordinator after patient transfer confirmation; remaining on-duty staff join JP3 shared coverage exactly once.
- A morning plan may be approved with closure still undecided. It displays a warning if JP2 needs to close or revise leadership before its POC finishes. Actual transitions are checked again and return an approved day to draft.
- Checks assess only recorded information. Breaks are not automatically generated; no patient data, clinical workload, acuity, unrecorded absences or free-text rules are inferred.
- Generation searches early pairs with a bounded search and selects late members using history scores. Search limits are surfaced; infeasibility and optimal fairness are not proven. Floor placement and shifts come from the roster.
- Rotation uses the last 30 earlier approved team days. It penalizes repeated teams and accumulated demand points (team demand minus one per assignment). It is a preference, not an absolute weekly cap. History can be disabled per day.
- Same-day intervals in the coordinator's local timezone; no overnight or multi-timezone scheduling.

## Migration
Version 1 per-bay records are preserved unchanged in `legacy`, viewable and exportable from History. They are not converted into team placements or included in new fairness scores. Existing database rows migrate on load and persist only when saved; no database schema migration is needed. Older clients cannot overwrite a saved version 2 workspace.

## Guided helper
Free, local command parsing. Not an LLM. Supports drafting, checking conflicts and toggling history. Each mutation is a proposal requiring Apply. Transfers and closure use explicit forms. Unsupported requests explain that nothing changed. No nurse data is sent to an AI provider.

## Persistence and access
Sites owns authentication and private-site access. Records are partitioned by authenticated user ID in D1, so a newly invited coordinator would have their own workspace. Use JSON export/import to hand off configuration. Save workspace explicitly; failed saves remain on screen. A stale version cannot overwrite another device's changes. Reload on other devices after saving. Initial deployment is owner-private, not automatically accessible to the client. Do not make it public for nurse data.

The server validates payloads and approval invariants. The deployment access policy must remain private. No external paid services have been configured; hosting entitlement and quotas depend on the user's platform account.

## Pending client validation
Supply anonymized rosters and completed sheets. Verify actual designations, cubicle pairs (especially JP3 C/D), OR/service mappings, demanding-duty weights and break arrangements. Exercise the revised workflow with the coordinator before operational use.

Limits: 100 staff, 20 four-cubicle teams, 200 breaks and 100 transfers per day, 730 saved team days, 3.5 MB workspace including the legacy archive. Download backups before replacing data. No medical/patient records are supported.

Run `node --test tests/planner.test.mjs tests/teams.test.mjs` for legacy and team regression tests, and `npx tsc --noEmit` for types.

## Preferences, daily changes and fairness tools
- Preferences are explicit coordinator-entered rules: prefer/require a team, avoid a team, maximum team assignments per week, or maximum demanding-team days per week. Required rules block approval and generation filters candidates; preferred rules add generation penalties and review warnings. They remain active when rotation history is disabled.
- Weekly caps count each assigned day once, Monday–Sunday, using other approved schedules in the same week, including future approvals. Required limits are revalidated server-side across all approved days on each save. Missing history is not inferred. Rules apply to their nurse only when present on the selected roster.
- Rules edited today update today and defaults for newly created days. Already saved days retain their own snapshots. Contradictory required rules stay visible; the bounded generator does not relax them or prove infeasibility.
- Daily changes preview sick calls, replacements, day-only shift exceptions and timed RN leadership handovers. Changes return to draft. Removing/replacing a nurse clears their breaks, transfers and handovers for review; unrelated team slots remain intact. Repair keeps complete and locked teams, so explicitly unlock/adjust a complete but conflicting team.
- A POC handover transfers the obligation to remain on JP2 to the incoming RN at the recorded time. Both must be available on the floor, and the outgoing nurse may then transfer. Handover records can be removed in Floor transitions, subject to revalidation.
- Conflict suggestions are bounded swaps/refills that reduce errors without introducing new errors under the recorded rules. Eligible transfer alternatives are checked individually. No staffing/acuity facts or patient readiness are inferred; suggestions are never applied automatically.
- Fairness reports default to Monday–Sunday, allow custom ranges and optional draft previews, and show per-team counts, repeats, demanding days and demand points. Report date filters do not redefine weekly rule periods. Assignment factors explain the history inputs and rules considered, without claiming an optimal solution.
- Undo/redo retains the last 20 edits in this browser session only. It includes directory and rule changes, returns changed days to draft and clears after reload. The last 250 change entries persist when saved and travel in backups. This is a coordinator edit history, not an immutable regulatory audit trail.
- Extended workspaces carry `toolsVersion: 1`; older clients must reload before saving to avoid losing new fields. Existing v2 data gets empty rule, handover and audit lists on load.

Additional regression tests: `node --test tests/planner.test.mjs tests/teams.test.mjs tests/planning-tools.test.mjs`.
