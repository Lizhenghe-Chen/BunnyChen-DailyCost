---
hide:
  - navigation
  - toc
title: DailyCost Vault
---

<div class="hero-section" markdown>

<div class="hero-logo">DailyCost Vault</div>
<div class="hero-tagline">Bulk import, yours to control</div>
<div class="hero-subtitle">Every item has a daily average cost. Your asset ledger — know the real cost of every item.</div>

<div class="hero-actions">
  <a href="getting-started/" class="md-button md-button--primary hero-btn">
    Quick Start
  </a>
  <a href="https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost" class="md-button hero-btn" target="_blank" rel="noopener">
    GitHub Repo
  </a>
</div>

<div class="theme-carousel hero-carousel" markdown>

<div class="theme-slide" markdown>

![Home · Matcha Green Dark](assets/首页 抹茶绿 深色模式 展示.jpg){ loading=lazy }

</div>

<div class="theme-slide" markdown>

![Analytics · Matcha Green Dark](assets/桌面端 数据分析页面 深色模式 抹茶绿.jpg){ loading=lazy }

</div>

<div class="theme-slide" markdown>

![Multi-filter · Sky Blue Light](assets/浅色主题 天之蓝 首页 自定义筛选.jpg){ loading=lazy }

</div>

<div class="theme-slide" markdown>

![Custom Emoji · Berry Purple Dark](assets/莓之紫 深色模式 emoji页面.jpg){ loading=lazy }

</div>

<div class="theme-slide" markdown>

![Settings · Berry Purple Light](assets/莓之紫 浅色模式 设置页.jpg){ loading=lazy }

</div>

</div>

</div>

!!! tip "🎁 30-Second Quick Experience"
    Don't want to import? Open the app and click "**Load sample data**" on the empty state — see a full asset wall and analytics in 30 seconds. Clear it anytime.

<!-- Feature badges -->
<div class="hero-badges">
  <span class="badge">🪟 Cross-Platform</span>
  <span class="badge">🔒 Local Storage</span>
  <span class="badge">🎨 Multi-Theme</span>
  <span class="badge">😀 Custom Emoji</span>
  <span class="badge">🌍 Multi-Language</span>
  <span class="badge">💖 Completely Free</span>
  <span class="badge">🚀 Continuous Updates</span>
</div>

<!-- Video Introduction -->
<div class="video-intro-section" markdown>

<div class="video-intro-title">📺 Video Introduction</div>

<div class="video-container">
  <iframe src="https://player.bilibili.com/player.html?isOutside=true&aid=117063712639931&bvid=BV1KZu16eE3v&cid=40738687283&p=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>
</div>

</div>

<!-- Batch-import platforms -->
<div class="import-platforms" markdown>

<div class="import-platforms-title">📥 One-Click Batch Import · Five Platforms</div>

<div class="hero-badges import-platform-badges">

<span class="badge">🐶 JD.com</span>
<span class="badge">🛒 Taobao / Tmall</span>
<span class="badge">🎮 Steam</span>
<span class="badge">💬 WeChat Bills</span>
<span class="badge">💳 Alipay</span>

</div>

<div class="import-platforms-hint" markdown>Auto platform detection · Auto emoji matching · Auto deduplication — [📥 Import Guide](import-csv.md)</div>

</div>

---

## 💡 Why This Project?

There's no shortage of bookkeeping / asset management tools, but a few things always get on your nerves:

- 💸 **Paid** — the good features are all behind paywalls, costing more the more you use them
- ⌨️ **Manual** — you have to fill in every record by hand, and you're already tired before you even start
- 🗂️ **Scattered** — JD.com, Taobao, Steam, WeChat each keep their own records, and your spending picture is fragmented

But have you ever thought: **every item you bought on every platform — the order info is yours by right.** It shouldn't be locked away in shopping history, and it definitely shouldn't force you to copy it over by hand.

That's why **DailyCost Vault** exists — a **free, easy-to-use, feature-complete** new app that gathers those scattered orders in one click, lets the data speak for itself, and helps you truly understand your spending habits.

> 🐰 [**BunnyChen**](https://github.com/Lizhenghe-Chen) doesn't expect you to use it daily or depend on it long-term. Just hope that in some unguarded moment — maybe looking back, maybe calculating the real cost of something — you suddenly "get it," marvel at your own past, and gain a little interesting insight. That moment alone is already meaningful.

---

## Core Innovation

<div class="feature-grid" markdown>

<div class="feature-card" markdown>

### 🧮 Daily Average Cost

An item costing ¥1000 used for 1000 days costs only ¥1/day. An item costing ¥100 used only once costs ¥100/day.

Cheap ≠ economical. Expensive ≠ wasteful. DailyCost Vault independently calculates the daily average cost for every item — across In Use, Sold, and Retired states — making "money-burning" assets visible at a glance.

</div>

<div class="feature-card" markdown>

### 📥 Smart Import from 5 Platforms

Drag and drop JD.com, Taobao, and Steam order CSVs, plus WeChat and Alipay bills (CSV / Excel). Dual parser (Rust backend + TypeScript frontend), auto platform detection, invalid order filtering, emoji matching, multi-item merge, auto GBK encoding detection for Alipay exports, and graceful handling when columns are filtered out. Batch preload deduplication — tens of thousands of records imported in seconds.

</div>

<div class="feature-card" markdown>

### 🔒 Fully Local Data

SQLite database with local persistence, zero server dependency. Your spending data never leaves your device. No user accounts, no cloud sync, no spending-data tracking. Export backups anytime.

</div>

</div>

---

## Interface Preview

<div class="carousel-hint">🎠 Swipe left/right · Click dots to switch</div>

<div class="theme-carousel showcase-carousel" markdown>

<div class="theme-slide" markdown>

![Asset Home · Tangerine Orange Dark](assets/桌面端 首页截图 深色模式 橘之橙.jpg){ loading=lazy }

**Asset Cards · Spot Money-Burners at a Glance** — Stats bar, keyword search, multi-dimensional filtering, flexible sorting. Green = earned back, Red = burning money. Every item's value is clear.

</div>

<div class="theme-slide" markdown>

![Analytics · Sky Blue Dark](assets/桌面端深色主题 数据分析页 天之蓝.jpg){ loading=lazy }

**Analytics · Understand Your Spending** — Monthly spending chart with platform/time filters and chart toggle. Bar chart drill-down to see monthly items. Dual pie charts for platform and category on one screen.

</div>

<div class="theme-slide" markdown>

![WeChat Cash Flow · Analytics](assets/微信分析页.jpg){ loading=lazy }

**WeChat Cash Flow · Daily Spending in Focus** — After importing WeChat bills, the analytics page adds a WeChat section: expenses / cashback / net spending at a glance, with cashback structure, Top 10 sources, and monthly trends.

</div>

<div class="theme-slide" markdown>

![Custom Emoji · Berry Purple Dark](assets/莓之紫 深色模式 emoji页面.jpg){ loading=lazy }

**Custom Emoji · Thousands to Choose** — Full emoji-mart Unicode emoji set + 37 custom emojis (Party Parrots / Blob / Cats / Mascots across 4 categories). Pick directly in the picker.

</div>

</div>

---

## 🔒 Privacy & Security · A Solemn Promise

<div class="privacy-promise" markdown>

**DailyCost Vault runs fully offline and stores all data locally. Never collect, upload, or peek into any of your data.**

</div>

> 🗝️ **The project is not open source yet, but BunnyChen promises never to collect, upload, or snoop on any of your data.** Your data belongs only to you — please keep it safe. See [Privacy Policy](PRIVACY.md).

---

*Source code is not public yet · All Rights Reserved · Your data always belongs only to you*

## 🚀 Quick Start · 3 Steps

<div class="quickstart-section" markdown>

<div class="quickstart-step" markdown>

### ① Download & Install

[Getting Started →](getting-started.md)

</div>

<div class="quickstart-step" markdown>

### ② Import Data

Export JD.com / Taobao / Steam purchase history as CSV via browser extensions; export WeChat bills directly from the WeChat app.

[Import Guide →](import-csv.md)

</div>

<div class="quickstart-step" markdown>

### ③ All Set

[Manage Assets](manage-items.md) · [Analytics](analytics.md)

</div>

</div>

## ☕ Support · Buy Me a Coffee

Maintained by one person — if you like it, buy me a coffee! 🥺

<div class="donation-cute" markdown>

![Cute](assets/卖萌.webp){ width="140" loading=lazy }

![Donate](assets/求打赏.jpg){ width="140" loading=lazy }

</div>

<div class="donation-section" markdown>

<div class="donation-card" markdown>

**☕ Buy Me a Coffee**

[![Buy Me a Coffee](assets/bmc_button.png){ width="190" loading=lazy }](https://buymeacoffee.com/bunnychen)

buymeacoffee.com/bunnychen

</div>

<div class="donation-card" markdown>

**🧧 WeChat Reward**

![WeChat Reward QR](assets/wechat 赞赏.jpg){ width="190" loading=lazy }

Scan to reward · Any amount

</div>

</div>

> 📬 Business cooperation / Enterprise customization / Platform integration: reach out via the reward links above

---

<div class="bottom-cta" markdown>

## Start Your Asset Digitalization Journey

Free · Open Beta · Data Fully Local

[Quick Start](getting-started.md){: .md-button .md-button--primary }

</div>
