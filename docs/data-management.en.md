# 💾 Data Management, Backup & Updates

Data security is the foundation of asset management. This chapter covers database management, backup & restore, device migration, and app updates.

---

## Import Batches

Each CSV import creates an import batch, displayed in the Settings page's "Import Batches" section, making it easy to trace what was imported and when.

> 💡 If an import has issues, you can quickly locate and handle it based on batch time.

---

## Database Path

The desktop version shows the full SQLite database file path at the bottom of the Settings page. **Click the path text** to locate the file in your file manager for manual backup.

- Windows: `AppData/com.bunnychen.dailycostvault/bookkeeping.db`
- Android: SQLite file in app private directory
- Web: Data stored in browser localStorage

---

## Backup & Restore

| Action | Button | Description |
|--------|--------|-------------|
| 📤 Export Database | "Export Database" | Package all data as `.db` file for download |
| 📥 Import Database | "Import Database" | Select `.db` backup file to restore data |
| 🗑️ Clear All Data | "Clear All Data" | Wipe database; requires confirmation |

!!! warning "Important Notes"
    - **Importing a database replaces all current data** — export current data as backup first
    - **Clearing all data is irreversible** — always export backup before proceeding
    - Clearing browser cache/data in the web version also causes data loss

---

## Data Migration

> 💡 **Recommended path**: Use **desktop** as your primary database (import orders via the browser extension), with Android as a mobile companion. Sync across devices via "Export Database" → "Import Database".

### Desktop → Desktop

1. Export database on the old device (`.db` file)
2. Transfer the file to the new device
3. Import database on the new device

### Desktop ↔ Android

1. Export database on the old device
2. Send via file transfer tool (WeChat/QQ/cloud storage, etc.) to the new device
3. Import database on the new device

### Desktop ↔ Web

!!! warning "Not Supported"
    Desktop uses SQLite while Web uses localStorage — data formats differ and direct transfer is not supported. We recommend choosing one platform as your primary.

---

## App Updates

DailyCost Vault uses a **dual-channel update mechanism** to ensure all platforms get the latest version promptly.

### Windows Desktop

Auto-checks for updates on launch; auto-downloads and installs when a new version is found, then prompts to restart. You can also click "Check for Updates" in Settings to manually query.

### macOS Desktop

Auto-checks for updates on launch; auto-downloads and installs when found. Manual check also available in Settings.

### Linux Desktop

Auto-checks for updates on launch. Manual check in Settings, or go to [Releases](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases) to download `.deb` / `.AppImage` packages.

### Android

Click "Check for Updates" in Settings; when a new version is available, it redirects to [Releases](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases) to download the `.apk` for overlay installation — data is preserved.

### Web

Refresh the page to automatically get the latest version.

---

## More Help

Having issues? Check **[❓ FAQ](FAQ.md)** or submit an [Issue](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/issues).
