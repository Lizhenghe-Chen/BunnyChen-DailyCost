---
hide:
  - navigation
  - toc
title: 日耗仓 · DailyCost Vault
---

<div class="hero-section" markdown>

<div class="hero-logo">日耗仓 · DailyCost Vault</div>
<div class="hero-tagline">批量入仓，由你掌控</div>
<div class="hero-subtitle">每一件物品都有日均持有成本。你的资产账本，算清每件物品的真实成本。</div>

<div class="hero-actions">
  <a href="getting-started/" class="md-button md-button--primary hero-btn">
    快速开始
  </a>
  <a href="https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost" class="md-button hero-btn" target="_blank" rel="noopener">
    GitHub 仓库
  </a>
</div>

<div class="theme-carousel hero-carousel" markdown>

<div class="theme-slide" markdown>

![首页 · 抹茶绿深色](assets/首页 抹茶绿 深色模式 展示.jpg){ loading=lazy }

</div>

<div class="theme-slide" markdown>

![数据分析 · 抹茶绿深色](assets/桌面端 数据分析页面 深色模式 抹茶绿.jpg){ loading=lazy }

</div>

<div class="theme-slide" markdown>

![多维筛选 · 天之蓝浅色](assets/浅色主题 天之蓝 首页 自定义筛选.jpg){ loading=lazy }

</div>

<div class="theme-slide" markdown>

![自定义表情 · 莓之紫深色](assets/莓之紫 深色模式 emoji页面.jpg){ loading=lazy }

</div>

<div class="theme-slide" markdown>

![个性化设置 · 莓之紫浅色](assets/莓之紫 浅色模式 设置页.jpg){ loading=lazy }

</div>

</div>

</div>

!!! tip "🎁 30 秒快速体验"
    不想导入？打开 App，在首页空状态点击「**加载示例数据**」—— 30 秒看到满屏装备库与数据分析图表，随时可一键清空。

<!-- 功能标签条 -->
<div class="hero-badges">
  <span class="badge">🪟 全平台支持</span>
  <span class="badge">🔒 数据本地存储</span>
  <span class="badge">🎨 多主题配色</span>
  <span class="badge">😀 emoji 自定义</span>
  <span class="badge">🌍 三语界面</span>
  <span class="badge">💖 完全免费</span>
  <span class="badge">🚀 持续更新</span>
</div>

<!-- 视频介绍 -->
<div class="video-intro-section" markdown>

<div class="video-intro-title">📺 视频介绍</div>

<div class="video-container">
  <iframe src="https://player.bilibili.com/player.html?isOutside=true&aid=117063712639931&bvid=BV1KZu16eE3v&cid=40738687283&p=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>
</div>

</div>

<!-- 批量导入平台 -->
<div class="import-platforms" markdown>

<div class="import-platforms-title">📥 一键批量导入 · 数据来源平台</div>

<div class="import-platforms-checklist" markdown>

--8<-- "platforms.zh.md"

</div>

<div class="import-platforms-hint" markdown>自动识别平台 · 自动匹配 emoji · 自动去重 — [📥 查看导入教程](import-csv.md)</div>

</div>

---

## � 为什么做这个项目？

市面上的记账 / 资产管理工具并不少，但总有几个让人头疼的地方：

- 💸 **要么收费** —— 好用的功能都藏在付费墙后面，越用越贵
- ⌨️ **要么手动** —— 数据要一条一条自己填，还没开始记账就已经累了
- 🗂️ **要么分散** —— 京东、淘宝、Steam、微信各记各的，消费全貌支离破碎

可你有没有想过：**你在各个平台买下的每一样东西，订单信息本来就是属于你自己的**。它不该被锁在购物记录里，更不该让你反复手动搬运。

于是就有了 **日耗仓 · DailyCost Vault** —— 一个 **免费、好用、功能齐全** 的新兴应用，帮你把这些散落的订单一键整理、拿下，让数据自己说话，帮你真正看懂自己的消费习惯。

> 🐰 [**BunnyChen**](https://github.com/Lizhenghe-Chen) 不指望你天天用、长期依赖。只希望在某一个不经意的瞬间——也许是回顾过往，也许是算清某件东西真正的成本——让你突然“恍然大悟”，感叹自己曾经的过往，收获一点有趣的启发。那一刻，就已经很有意义了。

---

## 核心创新

<div class="feature-grid" markdown>

<div class="feature-card" markdown>

### 🧮 日均持有成本

一件 ¥1000 的东西用了 1000 天，每天只花 ¥1。一件 ¥100 的东西只用了一次，每天 ¥100。

便宜不等于划算，贵不等于浪费。日耗仓为每一件物品独立计算日均持有成本——使用中、已售出、已报废，三种场景自动适配，一眼识别「烧钱」资产。

</div>

<div class="feature-card" markdown>

### 📥 多平台智能导入

京东、淘宝 / 天猫、Steam 订单 CSV 与微信账单（CSV / Excel）拖入即导入。Rust 后端与 TypeScript 前端双解析器，自动识别平台、过滤无效订单、emoji 匹配、多商品合并。**微信账单自动收支分流**：支出入资产、收入入回款，双双去重，万条数据秒级入库。更多平台陆续接入中。

</div>

<div class="feature-card" markdown>

### 🔒 数据完全本地

SQLite 数据库本地持久化，零服务器依赖。你的消费数据永远不会离开你的设备。无用户系统、无云同步、无遥测追踪。数据随时可导出备份。

</div>

</div>

---

## 界面预览

<div class="showcase-grid" markdown>

<div class="showcase-card" markdown>

![资产首页 · 橘之橙深色](assets/桌面端 首页截图 深色模式 橘之橙.jpg){ loading=lazy }

**资产卡片 · 一眼识别烧钱资产** — 顶部统计栏、关键词搜索、多维筛选、灵活排序。绿色 = 用回本，红色 = 在烧钱，每件物品的价值一目了然。

</div>

<div class="showcase-card" markdown>

![数据分析 · 天之蓝深色](assets/桌面端深色主题 数据分析页 天之蓝.jpg){ loading=lazy }

**数据分析 · 洞察消费结构** — 月度消费图表支持平台 / 时间筛选与图表切换，柱状图可下钻查看当月商品，平台与分类双饼图一屏尽览。

</div>

<div class="showcase-card" markdown>

![多维筛选 · 天之蓝浅色](assets/浅色主题 天之蓝 首页 自定义筛选.jpg){ loading=lazy }

**多维筛选 · 精准定位** — 平台多选过滤、关键词模糊搜索、三维排序叠加使用，秒级定位任意一件物品。

</div>

<div class="showcase-card" markdown>

![自定义表情 · 莓之紫深色](assets/莓之紫 深色模式 emoji页面.jpg){ loading=lazy }

**自定义表情 · 数千个 emoji 可选** — emoji-mart 全量 Unicode 表情 + 37 个自定义表情（Party Parrots / Blob / Cats / Mascots 四大分类），Picker 中直接选用。

</div>

<div class="showcase-card" markdown>

![个性化设置 · 莓之紫浅色](assets/莓之紫 浅色模式 设置页.jpg){ loading=lazy }

**个性化设置 · 你的工具你做主** — 三态主题、5 套配色、平台自定义颜色、三语切换、货币符号独立设置，深度定制每一项细节。

</div>

<div class="showcase-card" markdown>

![数据分析 · 深色主题](assets/桌面端数据分析页面（深色主题）.jpg){ loading=lazy }

**数据分析 · 深色主题** — KPI 四卡片概览资产全景，月度消费趋势与平台占比一目了然，深色主题下依旧清晰易读。

</div>

<div class="showcase-card" markdown>

![微信收支 · 分析页](assets/微信分析页.jpg){ loading=lazy }

**微信收支 · 看清日常现金流** — 导入微信账单后，分析页新增微信收支区块：支出 / 回款 / 净支出一目了然，回款结构、来源 Top 10 与月度趋势一键掌握。

</div>

</div>

---

## 全平台 · 一套代码

<div class="platform-grid" markdown>

<div class="platform-card" markdown>

### 🪟 Windows ✅

`.exe` / `.msi`

</div>

<div class="platform-card" markdown>

### 🍎 macOS ✅

`.dmg` · Apple Silicon & Intel

</div>

<div class="platform-card" markdown>

### 🐧 Linux ✅

`.deb` / `.AppImage`

</div>

<div class="platform-card" markdown>

### 📱 Android ✅

`.apk`

</div>

<div class="platform-card" markdown>

### 🌐 Web ✅

浏览器即用

</div>

<div class="platform-card" markdown>

### 📱 iOS 🚧

敬请期待

</div>

</div>

---

## 技术驱动

<div class="feature-grid" markdown>

<div class="feature-card" markdown>

### 🦀 Rust 后端

Tauri v2 框架，35 个 Rust 命令处理全部数据操作。SQLite WAL 模式、外键约束、自动数据库迁移。日均成本每次查询动态计算，修改公式无需重新导入。

</div>

<div class="feature-card" markdown>

### ⚡ 极致轻量

Windows 安装包约 5MB。Vanilla TypeScript 前端，零框架依赖。对比 Electron 方案轻 30 倍以上。启动即用，不占用后台资源。

</div>

<div class="feature-card" markdown>

### 🔄 自动更新

Tauri updater 静默下载安装 + GitHub API 全平台版本检测。启动后自动检查，也可随时手动触发。签名验证保障更新安全。

</div>

<div class="feature-card" markdown>

### 🎨 自定义表情

数千个 emoji 随时选用——emoji-mart 全量 Unicode 表情 + 37 个自定义表情，Party Parrots 动画 GIF、Blob 内联 SVG、Cats、Mascots 四大分类。Picker 中直接选用。

</div>

<div class="feature-card" markdown>

### 🌍 三语国际化

简体中文、繁體中文、English 即时切换，覆盖全部界面。货币符号与界面语言独立设置。i18next 驱动，JSON 翻译文件。

</div>

<div class="feature-card" markdown>

### ♻️ 数据可持续

日均成本公式、emoji 匹配规则、分类关键词均可热更新。旧数据自动回填，算法迭代无需重新导入历史数据。

</div>

</div>

---

## 🔒 隐私安全 · 郑重承诺

<div class="privacy-promise" markdown>

**日耗仓完全离线运行，所有数据仅存储在本地。绝不收集、绝不上传、绝不窥探你的任何数据。**

</div>

**你的数据存储在哪里？**

- 🖥️ 桌面端 → `AppData` 目录下的 SQLite 数据库
- 🤖 Android → 应用私有目录的 SQLite 数据库
- 🌐 网页版 → 浏览器 localStorage

**绝不会做什么？**

<div class="hero-badges privacy-badges">

<span class="badge">🚫 不上传数据</span>
<span class="badge">🚫 无追踪分析</span>
<span class="badge">🚫 不读取无关文件</span>
<span class="badge">🚫 无用户系统</span>
<span class="badge">🚫 无云同步</span>

</div>

> 🗝️ **项目目前暂不开源，但 BunnyChen 承诺绝不收集、上传或窥探你的任何数据**。你的数据只属于你自己，也请务必 **自己保管好** 它们。

---

*源码暂不公开 · 保留所有权利（All Rights Reserved）· 你的数据永远只属于你自己*


---

## 五套主题 · 五种气质

<div class="carousel-hint">🎠 自动轮播 · 左右滑动或点击圆点切换</div>

<div class="theme-carousel" markdown>

<div class="theme-slide" markdown>

![抹茶绿 · 首页](assets/首页 抹茶绿 深色模式 展示.jpg){ loading=lazy }

**🍵 抹茶绿** — 沉稳治愈，亲近自然。默认配色，浅色 / 深色双模式独立设计。

</div>

<div class="theme-slide" markdown>

![天之蓝 · 首页](assets/桌面端深色主题 首页 天之蓝.jpg){ loading=lazy }

**☁️ 天之蓝** — 清爽通透，明亮克制。桌面与移动端一致适配。

</div>

<div class="theme-slide" markdown>

![莓之紫 · 设置页](assets/莓之紫 浅色模式 设置页.jpg){ loading=lazy }

**🫐 莓之紫** — 神秘高级，个性鲜明。设置页与表情页深度融入。

</div>

<div class="theme-slide" markdown>

![桃之粉 · 桌面端浅色](assets/桃之粉色 桌面端 浅色主题.jpg){ loading=lazy }

**🍑 桃之粉** — 温柔甜美，暖意十足。桌面端浅色主题同样出彩。

</div>

<div class="theme-slide" markdown>

![橘之橙 · 首页](assets/桌面端 首页截图 深色模式 橘之橙.jpg){ loading=lazy }

**🍊 橘之橙** — 活力四射，热情洋溢。深色模式下的资产首页。

</div>

</div>


## 🚀 快速上手 · 三步开始

<div class="quickstart-section" markdown>

<div class="quickstart-step" markdown>

### ① 下载安装

[安装与启动 →](getting-started.md)

</div>

<div class="quickstart-step" markdown>

### ② 导入数据

通过浏览器扩展一键导出京东 / 淘宝 / Steam 消费记录为 CSV；微信账单直接在微信 App 内「下载账单」。

[批量导入教程 →](import-csv.md)

</div>

<div class="quickstart-step" markdown>

### ③ 开始使用

[浏览与管理资产](manage-items.md) · [数据分析](analytics.md)

</div>

</div>


## 支持一下 · 请喝杯咖啡 ☕

一个人维护不易，喜欢的话，请喝杯咖啡吧～ 🥺

<div class="donation-cute" markdown>

![卖萌](assets/卖萌.webp){ width="140" loading=lazy }

![求打赏](assets/求打赏.jpg){ width="140" loading=lazy }

</div>

<div class="donation-section" markdown>

<div class="donation-card" markdown>

**☕ Buy Me a Coffee**

[![Buy Me a Coffee](assets/bmc_button.png){ width="190" loading=lazy }](https://buymeacoffee.com/bunnychen)

buymeacoffee.com/bunnychen

</div>

<div class="donation-card" markdown>

**🧧 微信赞赏**

![微信赞赏码](assets/wechat 赞赏.jpg){ width="190" loading=lazy }

微信扫码 · 金额随心

</div>

</div>

> 📬 商务合作 / 企业定制 / 平台接入：欢迎通过上方赞赏入口联系

---

<div class="bottom-cta" markdown>

## 开始你的资产数字化之旅

免费 · 开放测试 · 数据完全本地

[快速开始](getting-started.md){: .md-button .md-button--primary }

</div>

