# PCC Scheduler on one Windows computer

The local edition runs the planner in a browser, with a small server and SQLite database on the same computer. Normal use needs no internet, ChatGPT account, Cloudflare account, AI subscription, or hosting subscription. Setup and updates need internet to download software. Use a current Edge or Chrome browser.

## First installation

1. Install Node.js **24 LTS** from https://nodejs.org if it is not already installed. On a managed workplace computer, have IT install the approved runtime and application.
2. Download the repository ZIP from GitHub and extract it into a permanent folder. Do not run files from inside the ZIP. A Git clone also works.
3. Double-click **Setup PCC Scheduling.cmd**. It installs locked dependencies, builds the local app, and creates a Desktop shortcut. Keep the folder after setup.
4. Open **PCC Scheduling** from the Desktop, or double-click **Start PCC Scheduling.cmd**. This opens the browser automatically. The app listens only at `127.0.0.1:43127`, on this computer.
5. Start with the real staff directory, or use Assignment history → Restore backup to import a JSON export from the hosted app. Imports return schedules to draft for review. Review them and click **Save workspace** to keep the import.

Only one planner tab can edit at a time in the same browser. A second tab tells you to use the existing window. Different browsers still cannot overwrite a newer save silently.

## Daily use and recovery

Edits automatically save after 1.5 seconds without another edit. Wait for **Saved locally** before closing. Incomplete drafts can be saved, but approval still requires all staffing, coverage, leadership, and weekly checks to pass. Modal fields are saved only after submitting their form.

Interrupted work is also stored in the browser. On reopening, a recovery panel offers the interrupted draft and the saved database version as downloads. Recovery returns schedules to draft and pauses automatic saving until you review and explicitly save. If another window has saved newer work, a stale save is rejected and the app keeps your edits for export. Clearing browser storage removes this extra recovery copy, not the main database. A sudden failure before either write completes can still lose the latest keystrokes.

The local database and backups live in `%LOCALAPPDATA%\PCC Scheduling`, outside the application folder. The database uses separate schedule records and atomic transactions. Do not put this folder inside the repository or a shared network drive. The development-only `PCC_DATA_DIR` override selects a different data folder.

Automatic backups retain the newest 30 snapshot files plus one per day across the latest 30 days with snapshots. Assignment history lists these backups and lets you download or preview a restore. Restoring does not immediately replace saved data: review and click Save workspace. A pre-replacement backup is required before an existing saved workspace can be overwritten. Backup failures are shown explicitly.

Backups on the same computer do not protect against loss of that computer. Regularly use **Download backup** and copy it to an approved separate drive or organizational backup location. JSON backups contain names and working hours. Keep them private.

Closing the browser leaves the local server running. Save first, then run **Stop PCC Scheduling.cmd** to stop it. Reopening Start reconnects to the running server or starts it again. Windows restart stops the server; the Desktop shortcut starts it again without losing saved schedules.

## Updates

Save, export a backup, and stop the app first.

- **Git clone:** run **Update PCC Scheduling.cmd**. It refuses to overwrite local source edits, pulls only a fast-forward update, reinstalls locked dependencies, and rebuilds. GitHub sign-in may be required for this private repository.
- **ZIP download:** download the new ZIP into a new folder and run Setup there. The same Windows account automatically reuses its existing data folder. The Desktop shortcut is updated to the new folder.

The build prepares new assets separately before switching them into place. A failed build does not erase the prior assets. Never delete the data folder as part of an update. Export backups before attempting to run an older application version against newer data.

## Before the PCC pilot

Confirm actual nurse identities/designations, floor and shift defaults, short shifts, cubicle pairs (especially JP3 C/D), OR/service mappings, demand weights, preferences/weekly limits, and break/relief arrangements. The rule-review dialog asks for the remaining confirmations individually. Breaks remain manually entered. No patient readiness or acuity is inferred.

Enter a complete current week to make weekly caps meaningful. Previous schedules provide comparison examples and assignment history; they do not train a model or automatically become rules. Run the app alongside the existing process until the PCC has checked representative days, changes, printouts and a backup restoration.

## Security and support

The launcher provides a per-run local session, strict host/origin checks and an HTTP-only cookie. The server binds only to loopback and the local interface blocks external network resources. It does not use the hosted app's authentication headers. It is not intended for LAN sharing, phone access, or port forwarding.

Anyone with access to the same Windows account or its files can access schedules. The app does not encrypt the database itself. Use the organization's Windows account, screen-lock, disk protection, updates and backup practices. Local operation reduces exposure; it does not prevent malware or physical access.

If startup fails, check the `launcher-…-error.log` file in the data folder. If port 43127 is occupied by another application, stop that application or ask for help rather than changing network exposure. Keep the data directory intact during troubleshooting.

## Developer checks

Node 24 or newer is required for the local server's built-in SQLite and TypeScript support. The local build is independent of Sites build helpers:

```text
npm ci
npm run local:build
npm run local:start
npm run local:stop
npm test
npx tsc --noEmit
```

Tests cover per-day persistence, restart, stale writes, invalid approval, backup failure rollback, restore to a fresh database, history larger than the old D1 limit, session/origin/host protection, and existing scheduling rules. The local transport caps a workspace request at 64 MiB and the existing 730-day workspace limit still applies. Export/archive older history as needed.
