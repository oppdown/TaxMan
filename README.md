# TaxMan

![TaxMan icon](src/assets/taxman-icon.png)

Local-first ledger for preparing income and expenditure records for a tax preparer. Version 0.3.1 keeps Windows installs and upgrades connected to the same local records while retaining the Android/mobile runtime.

## Use

1. Open the app and add companies/sources, or choose **Create new company/source** while entering a transaction.
2. Add one transaction per income item or expense. Dates accept compact entry such as `090826`, `09/08/2026`, or `2026-09-08`. For an expense, choose **Take with phone** to open a temporary local link on your phone and attach a bill photo for review.
3. Choose the year in the top-right year selector to review its totals.
4. Review totals on the Dashboard and use Reports & Backup to export the selected-year PDF/CSV or a full JSON backup.
5. Use Help > Keyboard shortcuts for faster entry. The Companies & Sources page includes a guarded Clear company data control for setup cleanup.

On Android, TaxMan runs as a local-only app with the same transaction workflow, device camera access, JSON backup, and CSV export. Android data is stored on that device; it is not synchronized with the Windows computer.

The app stores records locally on the computer. It does not connect to a cloud service or submit tax forms. The report is a recordkeeping aid; final tax treatment must be confirmed by the tax preparer.

Phone capture uses the same local Wi-Fi network as the computer. TaxMan shows a locally generated QR code for the temporary capture page, with the address available as a fallback. The link expires after a short time, and the photo is compressed on the phone before being sent directly to TaxMan. The app does not perform automatic tax decisions or silently create a transaction from the image; verify the bill details in the form before saving.

Installed Windows builds can use Help > Check for Updates to check for a newer TaxMan release, download it only after confirmation, and ask before restarting to install it. Windows installers request elevation automatically when needed, so users can start setup with a normal double-click. Development builds keep the update action disabled until installed.

The TAXMAN icon is stored at `src/assets/taxman-icon.png` and is reused by the Windows app, installer, public site, and documentation.

## Development

```text
npm install
npm test
npm start
npm run dist
```

The Windows installer and portable executable are written to `dist`.

Public project pages:

- GitHub: https://github.com/oppdown/TaxMan
- Downloads and changelog: https://taxman.speedy-star-8288.chatgpt.site
