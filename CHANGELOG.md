# Changelog

## 0.4.10 - 2026-09-17

- New expense transactions now start at 0% business use so TaxMan never assumes a deduction percentage.
- Existing saved business-use percentages remain unchanged, and users can still enter a percentage or use the work-time calculator.

## 0.4.9 - 2026-09-17

- Changed bill OCR to reference-only: it no longer fills the transaction date, amount, category, or description.
- Kept confident matching to a company already saved in TaxMan, including saved home-office defaults.
- Added a side-by-side OCR reference view with selectable text and a Copy all text action.
- Added 75%, 100%, 150%, and 200% bill-photo zoom controls for reviewing receipt details.

## 0.4.8 - 2026-09-17

- Added an existing company/source selector to the company form so users can review or update a saved record instead of creating duplicates.
- Added mailing address line, city, state, and ZIP fields to company/source records and the company directory.
- OCR now refuses to invent a company from uncertain text, matches known companies with small spelling errors, and prioritizes labeled bill-due and amount-due values.
- Added reviewable company-address extraction from common P.O. Box lines without silently saving it.

## 0.4.7 - 2026-09-17

- Added Edit actions to transaction rows shown on the Dashboard as well as the Transactions view.
- Added an All years option to the year selector and applied it to dashboard totals, transaction lists, and reports.
- Kept paired Android phones connected while TaxMan is open, with Send Another Photo and a choice between a new bill and another page of the current bill.
- Preserved multiple bill-photo pages on transactions and removed low-confidence OCR text from the Description field.
- Improved known-company matching when OCR makes a small spelling error.

## 0.4.6 - 2026-09-16

- Fixed phone pairing when the PC has both Ethernet and Wi-Fi by preferring the Wi-Fi address and showing alternate local addresses when available.
- Enabled the Android WebView settings needed for the local HTTP pairing service, including cleartext local traffic and mixed-content requests.
- Replaced the generic Android “Failed to fetch” pairing error with a clear same-Wi-Fi and alternate-address message.

## 0.4.5 - 2026-09-16

- Added a time-based business-use calculator for shared utilities: enter average work hours per day and work days per week, then apply the calculated percentage to the transaction.
- Uses 56 of 168 weekly hours for an 8-hours-per-day, 7-days-per-week schedule, displaying 33.33% (about 33%) and the estimated amount for the current bill.
- Improved OCR company/source handling so known companies are selected automatically, plausible unknown vendors are offered for review, and noisy lines such as `he YR Fd 9 RE` are not promoted into the description.
- Saved the work-time settings locally and preserved them through older-store normalization and mobile storage.

## 0.4.4 - 2026-09-16

- Improved bill reading so labeled due dates take priority over previous-payment and other historical dates, including compact dates such as 051726.
- Added payment tracking to every transaction with a separate paid date, a Mark paid action, a detail window, and the ability to mark a transaction unpaid again.
- Preserved paid status through local saves, upgrades, backups, and restores.

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
