# TaxMan 0.4.1 human release test

## What is ready

- Windows x64 installer and portable executable.
- Android/Capacitor mobile build path and CI workflow for an installable debug APK.
- Local phone bill-photo capture on Windows.
- Direct camera capture and local ledger storage on Android.
- Windows bill-photo reading that fills suggestions into the transaction form for review.

Android data is stored on the Android device and does not synchronize with the Windows ledger. Windows OCR is local and only suggests fields; it does not create a transaction automatically. Android keeps the manual-entry photo workflow in this release.

## Windows test

1. Double-click `dist/TaxMan-0.4.1-Setup.exe` on a Windows 10/11 x64 machine. Confirm Windows presents its normal permission prompt automatically, without using **Run as administrator**. Also launch `dist/TaxMan-0.4.1-Portable.exe` from a separate folder.
2. If upgrading from TaxMan 0.2.x, confirm the existing records appear immediately after launch. Create an expense with a date, company, category, description, amount, business-use percentage, and notes. Close and reopen TaxMan; confirm the row and totals remain.
3. Open an expense and choose **Take with phone**. Put the PC and phone on the same Wi-Fi, scan the displayed QR code with the phone camera, allow camera/photo access, take a clear bill photo, and confirm the preview returns to TaxMan. Also verify the displayed address works when entered manually.
4. Choose **Read bill details**. Confirm the date, company when it matches an existing company, description, amount, and category are suggestions in the form. Deliberately correct at least one field, then save and reopen the transaction.
5. Open Companies & Sources, edit an electricity provider, select **Always mark new expenses for this company as home-office-related**, and save. Start a new expense for that provider; confirm the home-office checkbox is selected and business use starts at 33%, while remaining editable.
6. Save the transaction, reopen it, and confirm the photo is still present. Remove the photo and save again; confirm it is gone.
7. Export PDF, CSV, and JSON backup. Restore the JSON backup and confirm the transaction, company preference, and attached photo remain.
8. Try an expired/closed phone-capture link and confirm it does not access the ledger.

## Android test

Install the APK produced by the `Build Android test package` workflow. On the phone:

1. Launch TaxMan and confirm the layout works in portrait and landscape.
2. Add an expense using **Take photo**. Test camera permission allow, deny, and allow-after-denial. Confirm the photo preview is visible before saving.
3. Force-close and reopen the app. Confirm the transaction, totals, and photo remain.
4. Export a JSON backup and CSV. Import the JSON backup into a clean test state.
5. Use Android Back from each form and dialog. Confirm it cancels the current action without deleting saved records.
6. Test a large, dark, angled, and multi-page bill photo. Confirm the app stays responsive and gives a useful error if device storage is exhausted.
7. Confirm the Android ledger is independent from the Windows ledger; no unexpected cloud account or sync prompt should appear.

## Please send back

For each failure, send: platform and OS version, device model, the exact step, what you expected, what happened, and a screenshot if safe. Do not send real tax records or unredacted bills; use a sample bill or redact personal/account numbers.

## Needed for a public Android release

- A decision between sideloaded APK distribution and Google Play.
- For Google Play: the developer account, final app listing text/screenshots, privacy-policy URL, and a release/upload keystore kept outside the repository.
- At least one real Android phone for camera, permission, back-button, rotation, and persistence testing.
- A decision on whether the next release should add local OCR to prefill bill fields; 0.3.1 intentionally keeps those fields review-and-enter rather than guessing.
