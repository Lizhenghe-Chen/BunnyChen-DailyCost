# ❓ Frequently Asked Questions (FAQ)

---

## Import

### Q: What does "Skipped N records" mean during import?

The system automatically deduplicates: records with the same order ID from the same platform won't be imported twice. Re-importing the same CSV will automatically skip existing records.

### Q: Which platforms are supported for order import?

Currently supports **four platforms** for batch import — **JD.com, Taobao/Tmall, Steam, and WeChat** — with more platforms on the way:

--8<-- "platforms.en.md"

Other platforms (e.g., Meituan, Dewu) can be entered manually via the "Add Item" feature.

### Q: Why are some orders missing after import?

The following orders are automatically filtered during import:
- **JD/Taobao**: Incomplete orders (pending payment, cancelled, etc.)
- **Steam**: Refunds, wallet top-ups (total amount ≤ 0)
- **WeChat**: non-expense records (income / not-expense); refund or abnormal statuses (Fully Refunded, Refunded ¥X, Counterparty Refunded, etc.); records with amount ≤ 0 or duplicate transaction IDs
- **All platforms**: Duplicate existing orders

> 💡 WeChat transfers, red packets, QR-code payments, and group collections are **kept and imported** (product name falls back to the counterparty), so you can see your full daily spending.

### Q: Will JD / Taobao orders paid with WeChat be counted twice?

Yes, they can be. Deduplication is **per platform**: JD orders by order number, WeChat records by transaction ID — the two are not linked. If the same order appears in both a JD / Taobao order CSV and a WeChat bill (e.g., you paid for a JD order with WeChat Pay), it will be imported separately and counted twice. Cross-platform deduplication is not yet implemented in the current version.

**Recommendation**: treat the platform's own order export as the source of truth and use WeChat bills for daily spending that cannot be exported; if both are imported, delete the duplicate record with the same amount on the same day.

### Q: What if JD.com triggers risk control during export?

We recommend exporting by year segments rather than all history at once. For example: export 2024 first, then 2025 after completion.

### Q: Where is the exported Taobao CSV file?

Chrome automatically downloads to your system's "Downloads" folder after export. File naming format: `tb-orders-YYYYMMDD-HHmmss-complete.csv`.

### Q: Can I import Excel files?

Both **CSV** and **Excel (.xlsx)** formats are supported. WeChat bills can be exported as Excel and imported directly; other Excel files are also supported (if a specific file fails to parse, save it as CSV with Excel/WPS first, then import).

### Q: Can I edit data after import?

Yes. Click any item card to open the detail popup, then click "Edit" to modify any field.

---

## Daily Average Cost

### Q: How is daily average cost calculated?

- **Items in use**: Daily cost = Purchase price ÷ Days from purchase to today
- **Sold items**: Daily cost = (Purchase price - Sale price) ÷ Days held
- **Retired items**: Daily cost = Purchase price ÷ Days held

### Q: What's the daily cost of a ¥0 free gift?

¥0 gifts have a daily cost of exactly 0 and are excluded from daily cost sorting.

### Q: Will daily cost update if I change the purchase date?

Yes. Daily cost is calculated dynamically on every query — it updates automatically when you modify the purchase date.

### Q: Why does daily cost equal the purchase price?

This usually happens when the purchase date is today or yesterday, making the holding period just 1 day. The daily cost will gradually decrease as holding days increase.

---

## Data Management

### Q: Where is data stored?

| Platform | Storage Location |
|----------|-----------------|
| Windows Desktop | `AppData/com.bunnychen.dailycostvault/bookkeeping.db` |
| Android | SQLite database in app private directory |
| Web | Browser localStorage |

### Q: Will my data be lost?

- **Desktop/Android**: Data stored in SQLite database, won't be lost on app close
- **Web**: Data stored in browser — clearing browser cache/data will cause loss. Export backups regularly

### Q: How to migrate data to a new device?

1. On the old device, go to Settings and click "Export Database"
2. Transfer the `.db` file to the new device
3. On the new device, go to Settings and click "Import Database" to select the file

### Q: Will importing a database overwrite my existing data?

Yes. Importing a database **replaces** all current data. We recommend exporting your current data as a backup first.

### Q: Can I sync data across multiple devices?

Cloud sync is not currently supported. You can manually sync between devices by exporting/importing the database.

### Q: Can I recover data after clearing all data?

No. "Clear All Data" is irreversible — always export a backup before proceeding.

---

## Usage

### Q: How do I quickly find a specific item among many?

- Use the search bar at top of home page — supports fuzzy search by name, store, model, order ID
- Use the platform filter dropdown to show only items from a specific platform
- Sort by daily cost (descending) to quickly find your biggest "money-burners"

### Q: How do I hide an item without deleting it?

Use the "Archive" feature. In the item detail popup, click the "📦" button — the item hides from home but data is preserved. Archived items can be viewed and restored in Settings → Archive Management.

### Q: How do I restore an archived item?

Go to Settings → Archive Management → find the item → click "📥" to restore.

### Q: How do I permanently delete an item?

Items must be archived first, then permanently deleted. After archiving, click "🗑️" in the item detail popup — confirm and it's irreversible.

### Q: Does the app have ads?

No. DailyCost Vault is completely free during Beta with zero ads.

### Q: Is dark mode supported?

Yes. Settings page lets you switch between Light / Dark / Follow System. You can also choose from 5 color schemes (Matcha Green / Sky Blue / Berry Purple / Peach Pink / Tangerine Orange).

### Q: Can I set different colors for different platforms?

Yes. In Settings, each platform has a colored dot button — click to open the color picker. Choose from 10 preset colors or enter a custom HEX value. Changes take effect immediately.

### Q: What are custom emojis and how do I use them?

DailyCost Vault has 37 built-in custom emojis across 4 categories: Party Parrots (15 parrot GIF animations), Reactions (12 Blob-style SVGs), Cats (6 cat GIFs), Mascots (4 GitHub-style icons). Select them in the icon picker when adding or editing items.

### Q: What if search returns no results?

When search or filters return no results, the page shows contextual guidance: distinguishing between "keyword-only search," "platform-only filter," and "combined" scenarios, with a "Clear All Filters" button to reset.

### Q: How do I record a sold item?

Edit the item → expand "Optional Info" → set status to "Sold" → set end date and sale price. The system automatically calculates actual net cost and profit/loss (profit shown in green).

### Q: What's the daily cost of a ¥0 free gift?

¥0 items (price = 0) have a daily cost of exactly 0 and are excluded from sorting and comparison. These items are mainly for asset recording rather than cost tracking.

---

## Platform

### Q: Is macOS supported?

Yes. Download the matching `.dmg` installer (Apple Silicon / Intel) from the **[🚀 Installation guide](getting-started.md)**.

### Q: Is iOS supported?

The iOS version is being planned. You can use the web version for now.

### Q: Is Linux supported?

Yes. Download the `.deb` or `.AppImage` installer from the **[🚀 Installation guide](getting-started.md)**.

### Q: What's the difference between the desktop and web versions?

| Difference | Desktop | Web |
|------------|:-------:|:---:|
| Data Storage | SQLite | localStorage |
| Auto-update | ✅ | — |
| File system access | ✅ | Limited |
| Offline use | ✅ | Requires page loaded first |

### Q: Android shows "Parse error" during installation?

Make sure the `.apk` file is complete (not truncated) and your Android version is ≥ 8.0.

---

## Security

### Q: Is my order data secure?

DailyCost Vault runs completely offline — all data is stored locally and never uploaded to any server. See [PRIVACY](PRIVACY.md).

### Q: Do browser extensions leak my shopping data?

No. Browser extensions run only in your local Chrome and don't upload data to third parties. You can remove extensions anytime after exporting.

### Q: What if exported CSV files contain personal information?

- JD/Taobao extensions enable "Mask" by default — recipient name, phone, and address are partially hidden
- You can uncheck "Mask" during export for full info, but keep exported files safe
- Do NOT commit CSV files to GitHub or share with untrusted parties

---

## Project

### Q: Is the project open source?

Not at the moment — **All Rights Reserved**. BunnyChen solemnly commits: we never collect, upload, or peek into any of your data. Your data belongs only to you, so please keep it safe. See the [Privacy Policy](PRIVACY.md).

---

> Didn't find an answer? Submit an [Issue](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/issues) to ask.