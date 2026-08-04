# 📥 Import CSV Orders

!!! tip "⭐ Recommended First Step"
    If you have purchase history on JD.com, Taobao, or Steam, CSV batch import is the **fastest** way to add items. The import automatically detects the platform, matches emojis, and deduplicates records, so there is no need to enter anything by hand.

---

## Three Simple Steps

🧩 Install the extension → 📤 Export CSV → 📥 Import into DailyCost Vault

---

## 1. Install the Browser Extension

Supported browsers: **Chrome**, **Edge**, and other Chromium-based browsers.

[📥 Download the Browser Extension (zip)](assets/dailycost-exporter-extension.zip){: .md-button .md-button--primary }

1. **Download and unzip** the zip above to get the `dailycost-exporter-extension` folder, which contains `manifest.json`. Do not delete this folder.
2. Open your browser's extensions page and turn on **Developer mode**:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
3. Click **Load unpacked** and select the folder you just unzipped.
4. The extension icon 🧩 should appear in the toolbar.

![Install Extension](assets/install-extension.png){ loading=lazy }

> 💡 After you finish exporting, you can remove the extension from the extensions page. This will not affect your CSV files. **We recommend removing it after use.**

---

## 2. Export the Order CSV

The three platforms follow the same basic flow:

1. Log in and open your own order page.
2. Click the extension icon 🧩 in the toolbar. The extension will **detect the current platform automatically**.
3. Use the suggested options. If you are unsure, the defaults are fine.
4. Click **Start Export**. Progress appears in the bottom-right corner, and the CSV downloads automatically when finished.

| Platform | Open this page | Suggested options |
|------|--------------|-----------|
| 🛒 Taobao | [Purchased Items](https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm) | Set **Order Status** to **Completed** |
| 🐶 JD.com | [My Orders](https://order.jd.com/center/list.action) | Use a **custom year range** for **Date Range** and set **Order Status** to **Completed** |
| 🎮 Steam | [Purchase History](https://store.steampowered.com/account/history) | Click **Start Export** directly |

> 💡 Exporting JD.com orders in **year-based batches** reduces the chance of risk-control blocks. Files are automatically named like `jd-orders-20260804-103000-complete.csv`.

> ⚠️ Steam exports include refunds and wallet top-ups too, but you do not need to worry about them. The system filters them during import.

> 🔒 **Mask Sensitive Data** is checked by default to protect privacy.

![Export Extensions](assets/浏览器插件%20数据获取工具%20引导页.png){ loading=lazy }

---

## 3. Import into DailyCost Vault

After you have the CSV files, you can import them in either of two ways:

- **Method 1: Drag and drop, recommended** — drag the CSV files into the **Data Import** area on the Settings page. You can drop multiple files at once.
- **Method 2: Select files** — go to **Settings** → **Data Import** → click **Select CSV Files**, then hold ++ctrl++ to select multiple files.

![Import Result](assets/import-result.png){ loading=lazy }

After import, you will see a message like **Success X, Skipped X**. **Skipped** means the order already exists or does not meet the import conditions, so the system has already deduplicated it.

---

## What the System Does Automatically

- ✅ Detects the platform (JD.com / Taobao / Steam)
- ✅ Imports only completed orders and skips pending or cancelled ones
- ✅ Matches the right emoji icon for each item
- ✅ Extracts JD.com product detail links
- ✅ Expands multi-item orders into separate cards
- ✅ Deduplicates by platform plus order ID

---

## Security Notice

!!! warning "Data Security"
    - 🔒 The extension runs **only in your local browser** and does not upload data to any third-party server
    - The extension does not read browser cookies, passwords, or other site data
    - You can remove the extension at any time after exporting
    - Do not commit exported CSV files to GitHub or share them with untrusted parties

---

## Next Steps

After importing, go to **[📋 Manage Assets](manage-items.md)** to learn how to view, filter, and edit your items.
