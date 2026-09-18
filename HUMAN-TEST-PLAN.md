# TaxMan 0.4.16 human release test

## What is ready

- Windows x64 installer and portable executable.
- Android/Capacitor mobile build path and CI workflow for an installable debug APK.
- Local phone bill-photo capture on Windows.
- Direct camera capture and local ledger storage on Android.
- Windows bill-photo reading as an optional reference panel; it does not fill financial fields automatically.
- One-time paired Android phone capture over the same local Wi-Fi network.
- Separate paid status and paid date for each transaction.
- Multiple bill-photo pages with new-bill versus add-page capture choices.

Android data is stored on the Android device and does not synchronize with the Windows ledger. Windows OCR is local and only suggests fields; it does not create a transaction automatically. Android keeps the manual-entry photo workflow in this release.

## Windows test

1. Double-click `dist/TaxMan-0.4.16-Setup.exe` on a Windows 10/11 x64 machine. Confirm Windows presents its normal permission prompt automatically, without using **Run as administrator**. Also launch `dist/TaxMan-0.4.16-Portable.exe` from a separate folder.
2. If upgrading from TaxMan 0.2.x, confirm the existing records appear immediately after launch. Create an expense with a date, company, category, description, amount, business-use percentage, and notes. Close and reopen TaxMan; confirm the row and totals remain.
3. Open an expense and choose **Take with phone**. Put the PC and phone on the same Wi-Fi, scan the displayed QR code with the phone camera, allow camera/photo access, take a clear bill photo, and confirm the preview returns to TaxMan. Also verify the displayed address works when entered manually.
4. Attach a bill photo and use the **75%**, **100%**, **150%**, and **200%** zoom controls. Confirm the image remains readable and scrollable at each level. Choose **Read reference text**. Confirm only a saved-company match can update the company field; date, amount, category, and description remain exactly as entered. Select text in the reference panel and use **Copy all text**.
5. Open Companies & Sources, edit an electricity provider, select **Always mark new expenses for this company as home-office-related**, and save. Start a new expense for that provider; confirm the home-office checkbox is selected and business use starts at 33.33% (about 33%), while remaining editable.
6. Save the transaction, reopen it, and confirm the photo is still present. Remove the photo and save again; confirm it is gone.
7. Export PDF, CSV, and JSON backup. Restore the JSON backup and confirm the transaction, company preference, and attached photo remain.
8. Try an expired/closed phone-capture link and confirm it does not access the ledger.
9. Choose **Take with phone**, choose **Pair phone once**, and confirm the PC window shows a QR code. On the Android app, choose **Pair with PC**, choose **Scan QR code**, allow camera access, and scan the PC code. Confirm the app pairs automatically and shows **Connected to your PC**. Repeat using manual address/code entry as a fallback. Start another capture from Windows and confirm the phone shows **Capture requested** without scanning a QR code. Take the photo and confirm it arrives in the open Windows transaction.
10. Use **Mark paid** on a transaction. Confirm the payment window shows the company, description, amount, and bill date; save a paid date and confirm the ledger shows **Paid** with that date. Reopen the transaction, update the paid date, then mark it unpaid and confirm the status clears.
11. Start an expense and click **Calculate from work time**. Confirm the default 8 hours/day and 7 days/week produces 33.33%, that the estimated allocated amount is shown, and that changing the schedule changes the result. Click **Use this percentage** and confirm the transaction form receives it.

## Android test

Install the APK produced by the `Build Android test package` workflow. On the phone:

1. Launch TaxMan and confirm the layout works in portrait and landscape.
2. Add an expense using **Take photo**. Test camera permission allow, deny, and allow-after-denial. Confirm the photo preview is visible before saving.
3. Force-close and reopen the app. Confirm the transaction, totals, and photo remain.
4. Export a JSON backup and CSV. Import the JSON backup into a clean test state.
5. Use Android Back from each form and dialog. Confirm it cancels the current action without deleting saved records.
6. Test a large, dark, angled, and multi-page bill photo. Confirm the app stays responsive and gives a useful error if device storage is exhausted.
7. Confirm the Android ledger is independent from the Windows ledger; no unexpected cloud account or sync prompt should appear.
8. Confirm the companion home screen matches the TaxMan theme, remains readable in portrait and landscape, and shows a clear online/offline/ready state. Remove the PC pairing, confirm the capture button is disabled, then pair again.

## Please send back

For each failure, send: platform and OS version, device model, the exact step, what you expected, what happened, and a screenshot if safe. Do not send real tax records or unredacted bills; use a sample bill or redact personal/account numbers.

## Needed for a public Android release

- A decision between sideloaded APK distribution and Google Play.
- For Google Play: the developer account, final app listing text/screenshots, privacy-policy URL, and a release/upload keystore kept outside the repository.
- At least one real Android phone for camera, permission, back-button, rotation, and persistence testing.
- Android pairing in 0.4.16 keeps the Windows review-and-save workflow authoritative; OCR is reference-only and never fills financial fields automatically. Confirm a new expense starts at 0% business use and only changes when you enter a value or use the calculator. Existing transactions retain their saved percentage.
- In Reports & Backup, confirm the current ledger, recovery backup, backup-folder, and total workspace sizes are visible. Change snapshot retention and close-form behavior, save settings, and confirm the values remain after reopening.
- In Transactions, search for a saved date using compact digits such as `050526` or `090826` and confirm the matching transaction appears.
- In the paid window, enter a paid amount different from the billed amount. Confirm TaxMan requires a difference comment unless **Convenience fee included in amount paid** is selected, then verify the paid amount, difference, fee marker, and comment remain after reopening.
- Open image editing on Windows and on the phone capture page. Drag the top, right, bottom, and left crop edges independently, rotate if needed, and confirm the saved/sent image reflects the crop.
- Confirm a bill showing both **Previous payment** and **Due date** suggests the due date, not the historical payment date. Compact formats such as 051726 should also be interpreted correctly when labeled.
