# Patient Care Coordinator Scheduler

Client delivery candidate — 20 October 2026.

## Start here

For the PCC's Windows computer, extract the delivery ZIP and follow **LOCAL-SETUP.md**. Install Node.js 24 LTS, then run **Setup PCC Scheduling.cmd** once. Setup requires internet and creates a Desktop shortcut. Daily use runs locally without internet. The ZIP contains the application source and a built local interface; setup installs the required runtime dependencies. It is not a signed Windows installer.

Online app: https://pcc-scheduler.sureplume10.chatgpt.site

Source and updates: https://github.com/jsaraza/PCC-Scheduling

The website and repository are private. The website currently allows only its owner; sending its link does not grant the client access. For local delivery, provide the ZIP directly through your approved file-sharing method. Local and online schedules do not synchronize. Choose one as the working copy; use JSON backup export/import to transfer an existing workspace.

## Included

- JP2/JP3 rosters, RN/LPN checks, early/late teams, short shifts, afternoon leadership, breaks and relief, staggered transfers and coordinator-controlled closure.
- Preferences, weekly assignment limits, optional historical rotation, fairness reports, sick calls/replacements, shift exceptions, leadership handovers and proposed conflict repairs.
- Manual editing, review and approval, undo/redo, saved change history, CSV import/export, printable assignment sheets and JSON backup/restore.
- Local edition: automatic saves, browser draft recovery, separate SQLite schedule records, automatic backups, restore preview, stale-write protection, and Windows setup/start/stop/update launchers.
- A command-based helper. No LLM, AI API fee or automatic clinical decision-making is involved.

## Daily workflow

1. Select the date and check the roster, hours, RN/LPN designations and floor placement.
2. Review team configuration, preferences and weekly limits. Choose whether to use rotation history, then generate or edit teams.
3. Enter breaks, relief and known operational changes. Resolve conflicts and review warnings.
4. Review and approve the plan. Confirm it saved, then print or save a PDF through the browser print dialog.
5. Record actual changes during the day. Transfers and closure depend on the PCC's judgment; changed plans require review again.
6. Export a backup regularly to an approved location separate from the computer. Automatic backups on this computer alone cannot protect against its loss.

## Client acceptance before everyday use

Software checks do not establish that placeholder staff information or provisional operational settings match your unit. Complete these with the PCC:

- Verify every actual staff member's RN/LPN designation, floor, working hours and eligibility. Confirm Annie/Tiffany's recurring short shifts and all leadership assignments.
- Confirm cubicle pairs (particularly JP3 C/D), OR/service mappings, demanding-duty weights, preferences, weekly limits and break/relief arrangements.
- Enter the current week's approved assignments before relying on weekly limits. Import or enter 3–5 representative past schedules for comparison and rotation history; these do not train an AI model.
- Compare a normal day and difficult days against the PCC's existing process: shortage/sick call, late arrival, RN-balance conflict, leadership handover, staggered transfer and JP2 closure.
- On the actual PCC computer, save a draft, close/reopen the app, check the printed sheets, and restore a downloaded backup in a separate test installation or data folder. Verify the imported day before saving.
- Record the PCC's acceptance, the chosen working copy and the person responsible for updates/backups. Do not replace the established process until these checks are accepted.

Acceptance record: PCC __________  Date __________  Version/commit __________

## Boundaries and support

The coordinator approves every plan. Checks cover recorded constraints; patient readiness, acuity, unrecorded absences and clinical workload are not inferred. The generator uses bounded search and does not guarantee the mathematically fairest solution. Breaks must be entered manually. Schedules are same-day only.

The local edition is for one coordinator on one Windows computer. It binds only to that computer; do not expose it to the LAN or internet. Protect the Windows account and backups. No patient information should be entered.

The hosted edition uses explicit saves and private authenticated storage. It does not provide the local edition's automatic file backups or offline access. Its single-workspace save limit is 1.9 MB; the local edition supports larger history. See README.md for detailed limits and LOCAL-SETUP.md for recovery/update instructions.

If saving fails, keep the app open, download the current workspace, and retain the data folder. If startup fails, retain the launcher error log from `%LOCALAPPDATA%\PCC Scheduling`. Share only the necessary error details with the maintainer, not an unrequested staff-data backup.
