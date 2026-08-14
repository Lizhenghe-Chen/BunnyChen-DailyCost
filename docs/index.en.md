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

<div class="import-platforms-title">📥 One-Click Batch Import · Four Platforms</div>

<div class="hero-badges import-platform-badges">

<span class="badge">🐶 JD.com</span>
<span class="badge">🛒 Taobao / Tmall</span>
<span class="badge">🎮 Steam</span>
<span class="badge">💬 WeChat Bills</span>

</div>

<div class="import-platforms-hint" markdown>Auto platform detection · Auto emoji matching · Auto deduplication — [📥 Import Guide](import-csv.md)</div>

</div>

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

SQLite database with local persistence, zero server dependency. Your spending data never leaves your device. No user accounts, no cloud sync, no telemetry. Export backups anytime.

</div>

</div>

---

## Interface Preview

<div class="showcase-grid" markdown>

<div class="showcase-card" markdown>

![Asset Home · Tangerine Orange Dark](assets/桌面端 首页截图 深色模式 橘之橙.jpg){ loading=lazy }

**Asset Cards · Spot Money-Burners at a Glance** — Stats bar, keyword search, multi-dimensional filtering, flexible sorting. Green = earned back, Red = burning money. Every item's value is clear.

</div>

<div class="showcase-card" markdown>

![Analytics · Sky Blue Dark](assets/桌面端深色主题 数据分析页 天之蓝.jpg){ loading=lazy }

**Analytics · Understand Your Spending** — Monthly spending chart with platform/time filters and chart toggle. Bar chart drill-down to see monthly items. Dual pie charts for platform and category on one screen.

</div>

<div class="showcase-card" markdown>

![Multi-filter · Sky Blue Light](assets/浅色主题 天之蓝 首页 自定义筛选.jpg){ loading=lazy }

**Multi-Dimensional Filtering · Precise Targeting** — Multi-platform checkboxes, fuzzy keyword search, 3-axis sorting combined. Find any item in seconds.

</div>

<div class="showcase-card" markdown>

![Custom Emoji · Berry Purple Dark](assets/莓之紫 深色模式 emoji页面.jpg){ loading=lazy }

**Custom Emoji · Thousands to Choose** — Full emoji-mart Unicode emoji set + 37 custom emojis (Party Parrots / Blob / Cats / Mascots across 4 categories). Pick directly in the picker.

</div>

<div class="showcase-card" markdown>

![Settings · Berry Purple Light](assets/莓之紫 浅色模式 设置页.jpg){ loading=lazy }

**Settings · Your Tool, Your Way** — 3-state theme, 5 color schemes, custom platform colors, 3-language switch, independent currency symbol. Deeply customize every detail.

</div>

<div class="showcase-card" markdown>

![Analytics · Dark Theme](assets/桌面端数据分析页面（深色主题）.jpg){ loading=lazy }

**Analytics · Dark Theme** — Four KPI cards overview your asset landscape. Monthly spending trends and platform breakdown at a glance, clear and readable even in dark theme.

</div>

<div class="showcase-card" markdown>

![WeChat Cash Flow · Analytics](assets/微信分析页.jpg){ loading=lazy }

**WeChat Cash Flow · Daily Spending in Focus** — After importing WeChat bills, the analytics page adds a WeChat section: expenses / cashback / net spending at a glance, with cashback structure, Top 10 sources, and monthly trends.

</div>

</div>

---

## Cross-Platform · One Codebase

<div class="platform-grid" markdown>

<div class="platform-card" markdown>

### 🪟 Windows

`.exe` / `.msi`

</div>

<div class="platform-card" markdown>

### 🍎 macOS

`.dmg` · Apple Silicon & Intel

</div>

<div class="platform-card" markdown>

### 🐧 Linux

`.deb` / `.AppImage`

</div>

<div class="platform-card" markdown>

### 📱 Android

`.apk`

</div>

<div class="platform-card" markdown>

### 🌐 Web

[Works in browser](https://bunnychen.top/BunnyChen-Item-Bookkeeping/)

</div>

</div>

---

## Tech-Driven

<div class="feature-grid" markdown>

<div class="feature-card" markdown>

### 🦀 Rust Backend

Tauri v2 framework, 29 Rust commands handling all data operations. SQLite WAL mode, foreign key constraints, automatic database migration. Daily cost calculated dynamically on every query — formula updates without re-importing.

</div>

<div class="feature-card" markdown>

### ⚡ Ultra Lightweight

Windows installer ~5MB. Vanilla TypeScript frontend, zero framework dependencies. 30× lighter than Electron alternatives. Ready on launch, no background resource consumption.

</div>

<div class="feature-card" markdown>

### 🔄 Auto Update

Tauri updater silent download & install + GitHub API cross-platform version detection. Auto-check on launch, manual check anytime. Signature verification ensures update security.

</div>

<div class="feature-card" markdown>

### 🎨 Custom Emoji

Thousands of emojis at your fingertips — full emoji-mart Unicode emoji set + 37 custom emojis. Party Parrots animated GIFs, Blob inline SVGs, Cats, Mascots across 4 categories. Pick directly in the picker.

</div>

<div class="feature-card" markdown>

### 🌍 Trilingual i18n

简体中文, 繁體中文, English — instant switching covering the entire interface. Currency symbol and interface language independently configurable. i18next-powered, JSON translation files.

</div>

<div class="feature-card" markdown>

### ♻️ Sustainable Data

Daily cost formulas, emoji matching rules, and category keywords are all hot-updatable. Legacy data auto-backfills — algorithm iterations never require re-importing historical data.

</div>

</div>

---

## 🔒 Privacy & Security · A Solemn Promise

<div class="privacy-promise" markdown>

**DailyCost Vault runs fully offline and stores all data locally. Never collect, upload, or peek into any of your data.**

</div>

**Where your data lives**

- 🖥️ Desktop → SQLite database in the `AppData` directory
- 🤖 Android → SQLite database in the app's private directory
- 🌐 Web → Browser localStorage

**What is never done**

<div class="hero-badges privacy-badges">

<span class="badge">🚫 No data upload</span>
<span class="badge">🚫 No tracking analytics</span>
<span class="badge">🚫 No reading unrelated files</span>
<span class="badge">🚫 No user accounts</span>
<span class="badge">🚫 No cloud sync</span>

</div>

> 🗝️ **The project is not open source yet, but BunnyChen promises never to collect, upload, or snoop on any of your data.** Your data belongs only to you — please keep it safe.

---

## Five Themes · Five Personalities

<div class="carousel-hint">🎠 Auto-rotating · Swipe or click dots to switch</div>

<div class="theme-carousel" markdown>

<div class="theme-slide" markdown>

![Matcha Green · Home](assets/首页 抹茶绿 深色模式 展示.jpg){ loading=lazy }

**🍵 Matcha Green** — Calm and healing, close to nature. Default color scheme with independent light/dark mode designs.

</div>

<div class="theme-slide" markdown>

![Sky Blue · Home](assets/桌面端深色主题 首页 天之蓝.jpg){ loading=lazy }

**☁️ Sky Blue** — Clean and airy, bright yet restrained. Consistent across desktop and mobile.

</div>

<div class="theme-slide" markdown>

![Berry Purple · Settings](assets/莓之紫 浅色模式 设置页.jpg){ loading=lazy }

**🫐 Berry Purple** — Mysterious and sophisticated, boldly distinctive. Settings and emoji pages deeply integrated.

</div>

<div class="theme-slide" markdown>

![Peach Pink · Desktop Light](assets/桃之粉色 桌面端 浅色主题.jpg){ loading=lazy }

**🍑 Peach Pink** — Soft and sweet, warmly inviting. Desktop light theme shines equally bright.

</div>

<div class="theme-slide" markdown>

![Tangerine Orange · Home](assets/桌面端 首页截图 深色模式 橘之橙.jpg){ loading=lazy }

**🍊 Tangerine Orange** — Energetic and vibrant, full of passion. Asset home page in dark mode.

</div>

</div>

---

## Quick Start — See Your Data in 3 Steps

**Data-driven · Import beats manual entry** — No need to type every record by hand. Export your orders from each platform, import them in bulk, and the data organizes itself into asset cards. Manual entry barely covers a handful per day; bulk import gets thousands of orders into your library in seconds.

<div class="quickstart-section" markdown>

<div class="quickstart-step" markdown>

### Download & Install

Go to [Releases](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases) to choose your platform installer, or open the [Web version](https://bunnychen.top/BunnyChen-Item-Bookkeeping/) directly. Windows: `.exe` recommended. macOS: download `.dmg`.

[Getting Started →](getting-started.md)

</div>

<div class="quickstart-step" markdown>

### Import Data

Install [browser extensions](assets/dailycost-exporter-extension.zip) to export JD.com, Taobao, and Steam purchase history as CSV, or export WeChat bills directly from the WeChat app. Drag them into the app window or click import in Settings — auto-parse, deduplicate, and categorize.

[Download the Browser Extension](assets/dailycost-exporter-extension.zip){: .md-button .md-button--primary } · [Import Guide →](import-csv.md)

</div>

<div class="quickstart-step" markdown>

### All Set

The home page card grid displays all items. Green = earned back. Red = burning money. Click cards for details, go to Analytics for monthly trends and platform breakdown. Start rethinking every purchase you make.

[Manage Assets](manage-items.md) · [Analytics](analytics.md)

</div>

</div>

<div class="bottom-cta" markdown>

## Start Your Asset Digitalization Journey

Free · Open Beta · Data Fully Local

[Quick Start](getting-started.md){: .md-button .md-button--primary }

</div>

*Source code is not public yet · All Rights Reserved*
