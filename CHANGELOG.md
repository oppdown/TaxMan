# Changelog

## 0.2.5 - 2026-09-11

- Added Help → Check for Updates to open the latest TaxMan release page.
- Kept the existing application data location unchanged so records remain available after updating or reopening the app.

## 0.2.4 - 2026-09-11

- Renamed the desktop application from Tax Ledger to TaxMan across the app, reports, exports, packaging, and documentation.
- Replaced the in-app brand mark with the updated TAXMAN icon and kept the same icon family for the Windows package and public site.

## 0.2.3 - 2026-09-09

- Moved File, Edit, View, and Help into the single native Windows application menu.
- Restored backups now select a year containing imported transactions when needed.
- Added an integration smoke test that restores a JSON file, verifies the visible ledger, and verifies the data after restart.

## 0.2.2 - 2026-09-09

- Restored backup data now immediately repopulates the open app.
- Empty ledgers no longer show the unnecessary back-up-first restore warning.
- Moved toast notifications to the lower-right corner.
- Kept one File / Edit / View / Help menu bar.

## 0.2.1 - 2026-09-09

- Added File -> Save and Save As.
- Added File, Edit, View, and Help menus with keyboard shortcuts.
- Added first-letter category selection, including U for Utilities.
- Home-office entries default to 33% business use.
- Added guarded, double-confirmation company-data cleanup.
- New transactions start with a blank date; Enter saves and returns to the ledger.
- Separated report export notices from backup notices.

## 0.2.0 - 2026-09-08

- Added multi-year transaction entry and year-based reports.
- Added compact date entry such as 090826.
- Added Companies & Sources, JSON backups, CSV export, and tax-preparer PDF reports.
