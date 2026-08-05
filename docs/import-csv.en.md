# 📥 Import CSV Orders

!!! tip "⭐ Recommended First Step"
    If you have purchase history on JD.com, Taobao, or Steam, CSV batch import is the **fastest** way to add items; WeChat bills (CSV / Excel) are also supported with one-click import. The import automatically detects the platform, matches emojis, and deduplicates records, so there is no need to enter anything by hand.

---

## Supported Batch-Import Platforms

Batch import currently supports **four platforms**:

| Platform | File Format | How to Get the File |
|------|---------|---------|
| 🐶 JD.com | CSV | One-click export via the browser extension |
| 🛒 Taobao / Tmall | CSV | One-click export via the browser extension |
| 🎮 Steam | CSV | One-click export via the browser extension |
| 💬 WeChat | CSV / Excel | Export "Download Bill" inside the WeChat app |

- **JD.com / Taobao / Steam** → see "Method 1: Import via the Browser Extension" below
- **WeChat** → no extension needed, see "Method 2: Import WeChat Bills" below

---

## Method 1: Import via the Browser Extension (JD.com / Taobao / Steam)

🧩 Install the extension → 📤 Export CSV → 📥 Import into DailyCost Vault

### 1. Install the Browser Extension

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

### 2. Export the Order CSV

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

### 3. Import into DailyCost Vault

After you have the CSV files, you can import them in either of two ways:

- **Drag and drop (recommended)** — drag the CSV files into the **Data Import** area on the Settings page. You can drop multiple files at once.
- **Select files** — go to **Settings** → **Data Import** → click **Select CSV Files**, then hold ++ctrl++ to select multiple files.

![Import Result](assets/import-result.png){ loading=lazy }

After import, you will see a message like **Success X, Skipped X**. **Skipped** means the order already exists or does not meet the import conditions, so the system has already deduplicated it.

---

## Method 2: Import WeChat Bills (No Extension Needed)

WeChat bills can be exported directly from inside the WeChat app — **no browser extension required**. The exported file is CSV / Excel and can be imported by dragging it into DailyCost Vault:

1. Open WeChat → **Me** → **Services** → **Wallet**
2. Tap **"Bills"** in the top-right corner
3. Tap **"FAQ"** in the top-right corner
4. Tap **"Download Bill"**
5. Choose **"For Personal Reconciliation"**
6. Select the **transaction type** and **time range**, then tap **"Next"**
7. Enter your **email address** and submit. WeChat will send the bill download link to that email
8. Download the bill **archive (zip)** from your email, **unzip** it to get the CSV / Excel file, then drag it into DailyCost Vault (or click "Select File" in Settings to import)

> 📖 For a detailed illustrated guide, see: [How to Export WeChat Bills as Excel (Baidu Experience)](https://jingyan.baidu.com/article/0eb457e5dee27d42f0a90568.html)

### WeChat Bill Import Rules: Kept vs Filtered

The system automatically distinguishes data during import, so you always know what is **kept** and what is **filtered out**:

**✅ Kept (imported)**

- **Only "Expense" records** are imported (Income/Expense column = 支出 / Expense)
- **Status whitelist**: 支付成功 (Payment Successful) / 已支付 (Paid) / 交易成功 (Transaction Successful) / 完成 (Completed) / 已转账 (Transferred) / 对方已收钱 (Received) / empty
- **No transaction-type filtering**: transfers, red packets, QR-code payments, group collections, and family-card payments are **kept too**, so you see your full daily spending (product name falls back to the counterparty when empty)
- Amount is taken as an absolute value; payment method + remark are merged into the model/style field; records are deduplicated by transaction ID

**❌ Filtered (skipped)**

- **Income / not-expense** records
- **Refund or abnormal statuses**: 已全额退款 (Fully Refunded), 已退款(¥X) (Refunded ¥X), 对方已退还 (Counterparty Refunded), etc.
- Records with an empty transaction ID, amount ≤ 0, or duplicates of existing records

---

!!! note "About duplicates between JD / Taobao orders and WeChat bills"
    Deduplication in DailyCost Vault is **per platform**: JD orders are deduplicated by JD order number and WeChat records by WeChat transaction ID — the two are not linked.

    If you pay for a **JD / Taobao order with WeChat Pay**, the same purchase appears in both:
    1. The order CSV exported from the platform (recorded by order number)
    2. Your WeChat bill (the counterparty is a JD / Taobao-related merchant, and the merchant order number is usually the platform's order number)

    Both will be imported, so the same expense is **counted twice**. Cross-platform deduplication is not yet implemented in the current version.

    **Recommendation**: treat the platform's own order export (JD / Taobao CSV) as the source of truth, and use WeChat bills mainly for daily spending that cannot be exported from a platform. If both are imported, watch for records with the same amount on the same day and delete one manually from its detail view.

---

## What the System Does Automatically

- ✅ Detects the platform (JD.com / Taobao / Steam / WeChat)
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
