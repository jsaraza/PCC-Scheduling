# PCC Scheduler — portable Windows edition

No Node.js installation, setup command, account, or internet connection is required to run this edition. The runtime and built app are included. Use Windows 10/11 on an Intel or AMD 64-bit laptop and a current browser.

1. Right-click **PCC-Scheduler-Portable-Windows-x64.zip** and select **Extract All**.
2. Keep the extracted folder in a permanent location, such as Documents. Do not run the app from inside the ZIP.
3. Double-click **Open PCC Scheduler.cmd**. Your browser opens the local app.
4. Optional: double-click **Create Desktop Shortcut.cmd** for a shortcut with the new app icon.

Wait for **Saved locally** before closing. Close the browser tab or window normally. Double-click the desktop shortcut or **Open PCC Scheduler.cmd** whenever you want to return; it opens the browser again even when the local service is already running. **Stop PCC Scheduler.cmd** is optional maintenance, not part of everyday use. No administrator permissions are needed by the app, though workplace device policies may require IT to authorize it.

## Your schedules

Schedules and automatic backups stay in `%LOCALAPPDATA%\PCC Scheduling` for the current Windows account, outside the extracted application folder. Existing local schedules are reused. The app does not save your data into GitHub or synchronize it with the website. Export JSON backups regularly to an approved separate location.

To move an existing website workspace, download its JSON backup and use **Assignment history → Restore backup** here. Review the imported drafts and click **Save workspace**.

## Photo / scan import

In **Nurse roster → Import Excel / CSV → Import from a phone photo / scan**, select a JPG, PNG or WebP transferred from the phone to the laptop. Reading is offline. Review the original photo alongside the extracted text, put one nurse on each line, build review rows, correct missing/misread details, then preview and confirm the import. Saved nurse defaults may be suggested for matching names; check them against today’s roster. Handwriting and multi-column layouts may need substantial correction. No direct phone upload connection is included. Photos are not stored in the schedule database.

The top-right **Take a tour** walkthrough includes seven photo-import steps after the spreadsheet introduction. It highlights the controls using a fictional nurse, without reading a photo or changing your roster.

## Updates

Save and download a backup. For this update, restart Windows (or use the old Stop command once) to close the previous version before opening the new one. Download a newer **Portable** release ZIP, extract it into a new folder, and open it. The same Windows account reuses its saved data. Recreate the optional shortcut from the new folder. Keep the previous version until you verify the new one works. Never delete the LocalAppData data folder when updating.

The green **Code → Download ZIP** button on GitHub downloads source code, which still needs developer setup. Use the **Portable ZIP under Releases** for this edition. The included runtime is updated by downloading a new portable release.

## Before everyday use

Have the PCC confirm actual staff designations, shifts, team layouts and operating rules. Compare representative schedules and test printing and backup recovery. No patient information should be entered. This release is for client acceptance testing; it does not replace coordinator review.

## Troubleshooting

Keep all extracted folders together. If startup fails, retain the error log shown in the launcher and the data folder. If an organization blocks the app, ask its IT team to review it rather than disabling security protections. This is a portable application bundle, not a signed Windows installer.
