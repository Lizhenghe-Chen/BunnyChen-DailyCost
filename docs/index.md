---
hide:
  - navigation
  - toc
title: 日耗仓 · DailyCost Vault
---

<div class="hero-section" markdown>

<div class="hero-logo">日耗仓 · DailyCost Vault</div>
<div class="hero-tagline">一切可以变现的都是资产</div>
<div class="hero-subtitle">长期主义个人资产数字化管理工具</div>

<div class="hero-badges">
  <span class="badge">🪟 Windows</span>
  <span class="badge">🍎 macOS</span>
  <span class="badge">🐧 Linux</span>
  <span class="badge">📱 Android</span>
  <span class="badge">🌐 Web</span>
</div>

<div class="hero-actions">
  <a href="https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost-Releases/releases" target="_blank" class="md-button md-button--primary hero-btn">
    ⬇️ 立即下载
  </a>
  <a href="USER_GUIDE.md" class="md-button hero-btn">
    📖 使用指南
  </a>
</div>

</div>

<!-- 统计信任条 -->
<div class="stats-strip">
  <div class="stat-item">
    <div class="stat-number">5</div>
    <div class="stat-label">全平台支持</div>
  </div>
  <div class="stat-item">
    <div class="stat-number">100%</div>
    <div class="stat-label">数据本地存储</div>
  </div>
  <div class="stat-item">
    <div class="stat-number">37</div>
    <div class="stat-label">自定义表情</div>
  </div>
  <div class="stat-item">
    <div class="stat-number">3</div>
    <div class="stat-label">界面语言</div>
  </div>
</div>

---

## 核心能力

<div class="feature-grid" markdown>

<div class="feature-card" markdown>

### 🧮 日均持有成本

每件物品独立计算日均成本。买贵但用久等于划算。一眼识别「烧钱」资产，让消费决策有据可依。

</div>

<div class="feature-card" markdown>

### 📥 智能 CSV 导入

京东、淘宝、Steam 订单批量导入，自动识别平台、过滤无效数据、emoji 匹配、多商品合并，全流程自动化。

</div>

<div class="feature-card" markdown>

### 🃏 资产卡片网格

精美卡片呈现每件物品：平台徽章、动态图标、日均成本。支持关键词搜索、多维筛选与灵活排序。

</div>

<div class="feature-card" markdown>

### 🔄 全生命周期管理

使用中 · 已售出 · 已报废，三态追踪每一件物品。归档采用软删除，数据永久保留。支持批量操作。

</div>

<div class="feature-card" markdown>

### 🎨 深度个性化

三态主题切换、5 套配色方案、平台自定义色彩、37 个动态表情。你的工具，由你定义风格。

</div>

<div class="feature-card" markdown>

### 🔒 完全本地存储

SQLite 或 localStorage 本地持久化，零服务器依赖。你的每一笔数据，永远只在你自己的设备上。

</div>

</div>

---

## 功能亮点

<div class="showcase-grid" markdown>

<div class="showcase-card" markdown>

![CSV 导入界面截图](assets/import.png)

**数据导入** — 京东、淘宝、Steam CSV 批量导入，自动识别平台、过滤无效订单、多商品合并、emoji 自动匹配、链接提取，全流程自动化。

</div>

<div class="showcase-card" markdown>

![应用主页截图](assets/home.png)

**数据分析** — 日均成本动态计算，月度消费柱状图可下钻查看，平台占比双饼图可点击筛选，KPI 四卡片概览资产全景。

</div>

<div class="showcase-card" markdown>

![外观设置截图](assets/settings.png)

**外观定制** — 三态主题切换，5 套配色方案，37 个自定义表情，三语国际化，货币符号与界面语言可独立设置。

</div>

</div>

---

## 平台支持

<div class="platform-grid" markdown>

<div class="platform-card" markdown>

### 🪟 Windows

`.exe` / `.msi` 安装包，Tauri v2 原生桌面应用。

- 支持 x64 和 ARM64 架构
- SQLite 数据库本地存储
- 自动更新，开机即用
- 拖拽导入 CSV 文件

</div>

<div class="platform-card" markdown>

### 🍎 macOS

`.dmg` 安装包，Apple Silicon 与 Intel 双芯兼容。

- 与 Windows 端功能完全一致
- 原生 macOS 体验
- 自动更新支持

</div>

<div class="platform-card" markdown>

### 🐧 Linux

`.deb` / `.AppImage` 格式，覆盖主流发行版。

- Debian/Ubuntu 系 `.deb` 包
- 通用 `.AppImage` 免安装运行
- 与桌面端功能一致

</div>

<div class="platform-card" markdown>

### 📱 Android

`.apk` 安装包，Tauri v2 移动端适配。

- 刘海屏与手势条安全区适配
- content:// URI 兼容
- APK 签名发布

</div>

<div class="platform-card" markdown>

### 🌐 Web 版

浏览器打开即用，无需安装任何软件。

- Vite 构建，GitHub Pages 托管
- localStorage 持久化存储
- 数据可导出 CSV 与桌面版互通

</div>

</div>

---

## 快速开始

<div class="quickstart-section" markdown>

<div class="quickstart-step" markdown>

### 下载安装

前往 [Releases](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost-Releases/releases) 页面，选择你所用平台的安装包下载。Windows 推荐 `.exe` 安装程序，macOS 下载 `.dmg`，Android 下载 `.apk`，或直接打开[网页版](https://bunnychen.top/BunnyChen-Item-Bookkeeping/)即刻体验。

</div>

<div class="quickstart-step" markdown>

### 导入数据

通过浏览器扩展导出京东、淘宝、Steam 的消费记录为 CSV 文件。在应用设置页中，点击「选择 CSV 文件」或直接拖拽文件到导入区域——系统会自动解析、去重、匹配 emoji 并完成分类。

</div>

<div class="quickstart-step" markdown>

### 开始管理

回到主页，所有物品以卡片网格形式呈现。绿色标识「用回本」的高效物品，红色标识「在烧钱」的低效资产。点击卡片查看详情，进入设置调整外观和偏好，一切都为你准备好了。

</div>

</div>

---

## 技术亮点

<div class="feature-grid" markdown>

<div class="feature-card" markdown>

### 🦀 Tauri v2 桌面框架

基于 Rust 构建的跨平台原生应用，性能卓越、体积小巧。Windows 安装包仅约 5MB，远小于传统方案。

</div>

<div class="feature-card" markdown>

### 🔄 双通道自动更新

Tauri updater 自动下载安装 + GitHub API 全平台版本检测。启动后静默检查，也可随时手动触发。

</div>

<div class="feature-card" markdown>

### 🌍 三语国际化

简体中文（默认）、繁體中文、English 三种语言即时切换，覆盖全部界面元素。

</div>

<div class="feature-card" markdown>

### 🎭 自定义表情系统

37 个自定义表情，4 大分类：Party Parrots 鹦鹉 GIF、Blob 风格、Cats 猫咪、Mascots 吉祥物。

</div>

<div class="feature-card" markdown>

### ♻️ 数据可持续性

日均成本动态计算，修改公式无需重新导入。emoji 和分类关键词热更新，旧数据自动回填。

</div>

<div class="feature-card" markdown>

### 🔐 跨仓库发布架构

代码仓库构建 → CI 推送至下载仓库 Release。桌面端从 `updater` tag 读取 `update.json` 实现自动更新。

</div>

</div>

<div class="bottom-cta" markdown>

## 开始你的资产数字化之旅

日耗仓完全免费，数据完全本地。现在就下载，重新认识你每一件物品的真实价值。

[⬇️ 前往下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost-Releases/releases){: .md-button .md-button--primary target="_blank"}
&nbsp;
[📖 阅读使用指南](USER_GUIDE.md){: .md-button }

</div>

