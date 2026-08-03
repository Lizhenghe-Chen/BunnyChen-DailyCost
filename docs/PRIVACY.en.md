# 🔒 Privacy Policy

> Last updated: July 2026 · Current phase: Public Beta

DailyCost Vault is a **completely offline** personal asset digital management tool, currently in public beta. We take your privacy and data security very seriously.

---

## Data Collection

### What We DON'T Collect

DailyCost Vault does **NOT** collect, upload, or share any of the following:

- ❌ Your order data (product names, prices, purchase times, etc.)
- ❌ Your personal information (name, address, phone, etc.)
- ❌ Your device information
- ❌ Your usage habits or behavioral data
- ❌ Any form of telemetry or diagnostic data

### What We DON'T Have

- ❌ User account system
- ❌ Cloud sync service
- ❌ Analytics or tracking tools (e.g., Google Analytics)
- ❌ Third-party SDKs
- ❌ Advertising system
- ❌ Automatic crash reporting

---

## Data Storage

All data is stored **exclusively on your local device**:

| Platform | Storage Method | Path |
|----------|---------------|------|
| Windows | SQLite Database | `%AppData%/com.bunnychen-item-dailycost/bookkeeping.db` |
| macOS | SQLite Database | App data directory (full path shown in Settings) |
| Linux | SQLite Database | App data directory (full path shown in Settings) |
| Android | SQLite Database | App private directory |
| Web | Browser localStorage | Browser local storage |

Data is **NOT** automatically synced to any cloud server. You can manually back up data using the in-app "Export Database" feature.

---

## Data Export & Backup

DailyCost Vault provides the following data export features:

- **Export Database (.db)**: Export the SQLite database file to a location of your choice
- **Import Database**: Restore data from a backup file

> ⚠️ Exported `.db` files contain all your item data. Keep them safe — do not share with untrusted parties or upload to public repositories.

---

## Browser Extension Privacy

DailyCost Vault provides browser extensions for JD.com, Taobao, and Steam to export order data. These extensions follow the same strict privacy principles:

### Data Access Scope

Each extension can only access its declared specific domains:

| Extension | Accessible Domains |
|-----------|-------------------|
| JD Order Exporter | `order.jd.com`, `details.jd.com`, `details.yiyaojd.com` |
| TB Order Exporter | `buyertrade.taobao.com`, `trade.taobao.com`, `trade.tmall.com` |
| Steam Order Exporter | `store.steampowered.com` |

### No Data Upload

- Extensions do **NOT** upload order data to any remote server
- Extensions do **NOT** read browser cookies, passwords, or other site data
- Extensions do **NOT** use `chrome.storage`, `localStorage`, IndexedDB, or other persistent storage
- Extensions contain **NO** analytics, telemetry, or third-party API calls

### Sensitive Data Handling

- Recipient names, addresses, and phone numbers are **masked by default** (partial characters replaced with `*`)
- Users can disable masking in the extension popup
- Exported CSV files have prefixes added to cells that spreadsheet software might interpret as formulas, reducing CSV injection risks

---

## Network Security

### App Network Activity

DailyCost Vault only makes network requests in the following scenarios:

| Scenario | Description |
|----------|-------------|
| Check for Updates | Access GitHub API to query for new version releases |
| Download Updates | Desktop auto-update downloads new version packages |

All these requests only access the GitHub official API (`api.github.com`) and GitHub Releases download links. **Order data is never sent in any network request**.

### Web Version

If you use the web version (`bunnychen.top`), pages are served over HTTPS, but please note:

- All data is stored in browser local storage
- Clearing browser cache/data will cause data loss
- Export backups regularly

---

## Your Rights

As a user, you have the following rights:

- ✅ Full control over your data, stored on your device
- ✅ Export complete data backup anytime
- ✅ Clear all data anytime
- ✅ Use all features without registering an account

---

## Contact Us

If you have any questions or suggestions about this privacy policy, please reach out:

- [Submit an Issue](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/issues)

---

> 💡 **In one sentence**: DailyCost Vault does not collect, upload, or share your data in any form. Your data belongs only to you, forever.