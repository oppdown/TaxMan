# Changelog

## 0.4.3 - 2026-09-16

- Added QR-based one-time pairing: the Windows pairing window now shows the connection QR code, and the Android companion scans it to pair automatically.
- Kept manual PC address and pairing-code entry as a fallback, with camera permission and invalid-code guidance.
- Bundled the QR decoder into the Android/mobile build so pairing remains local and does not require a third-party account or service.

## 0.4.2 - 2026-09-16

- Added a paired Android phone companion with a polished TaxMan capture center that matches the desktop theme.
- Added one-time PC pairing with a short-lived code, remembered device token, local Wi-Fi polling, and direct photo upload to the open Windows transaction.
- Kept QR capture as a fallback for phones that are not paired.
- Added Android camera permission metadata and a release-gate integration test for pairing.

## 0.4.1 - 2026-09-16

- Reissued the bill-capture and safer-upgrade release with the corrected application version shown consistently in the app, packages, documentation, and downloads.
- Retained on-device bill-photo reading, review-before-save suggestions, reusable company home-office defaults, record migration, and automatic installer permission handling.

## 0.4.0 - 2026-09-16

- Added on-device bill-photo reading for Windows. TaxMan suggests the date, company, description, amount, and category from the image without sending the bill to a cloud service.
- Kept OCR suggestions in the transaction form for user verification; TaxMan never creates or saves a transaction from OCR alone.
- Added a company preference to always mark new expenses for that company as home-office-related, with a 33% starting business-use value that remains editable.
- Fixed Windows upgrades so records from the former Tax Ledger data folder are migrated into TaxMan automatically.
- Stabilized the Windows data location so future product-name changes do not strand local records.
- Changed the Windows installer to request administrator approval automatically when launched normally.

## 0.3.0 - 2026-09-16

- Added local phone capture for bill photos from an open transaction form.
- Added a locally generated QR code to open the temporary phone-capture page without typing its address.
- Added reviewable, locally stored receipt-photo attachments without automatic transaction creation.
- Added an Android/Capacitor mobile build with on-device storage and camera capture.
- Added a mobile web/PWA build and CI workflow for producing an Android test APK.
- Enabled Help → Check for Updates in installed Windows builds, with confirmation before download and restart.

## 0.2.5 - 2026-09-11

- Added the Help → Check for Updates menu entry.
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
