<p align="center">
  <img src="docs/assets/logo.png" alt="DailyCost Vault" width="96" />
</p>

<h1 align="center">日耗仓 · DailyCost Vault</h1>

<p align="center">
  <b>长期主义个人资产数字化管理工具</b>
</p>

<p align="center">
  <i>“一切可以变现的都是资产”</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20Web-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/framework-Tauri%20v2-FFC131?style=flat-square" alt="Tauri" />
  <img src="https://img.shields.io/badge/status-Beta-FFD700?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/license-Proprietary-red?style=flat-square" alt="License" />
</p>

<p align="center">
  <a href="https://bunnychen.top/BunnyChen-Item-Bookkeeping/"><b>🌐 官网 & 在线体验</b></a> ·
  <a href="https://bunnychen.top/BunnyChen-Item-Bookkeeping/USER_GUIDE/">📖 使用指南</a> ·
  <a href="https://bunnychen.top/BunnyChen-Item-Bookkeeping/FAQ/">❓ 常见问题</a> ·
  <a href="https://bunnychen.top/BunnyChen-Item-Bookkeeping/PRIVACY/">🔒 隐私说明</a>
</p>

---

## 📸 预览

<p align="center">
  <img src="docs/assets/桌面端%20首页截图%20深色模式%20橘之橙.jpg" alt="主页" width="45%" />
  <img src="docs/assets/桌面端数据分析页面（深色主题）.jpg" alt="数据分析" width="45%" />
</p>
<p align="center">
  <img src="docs/assets/莓之紫%20浅色模式%20设置页.jpg" alt="设置" width="45%" />
  <img src="docs/assets/莓之紫%20深色模式%20emoji页面.jpg" alt="Emoji" width="45%" />
</p>

---

## ✨ 亮点

- 🧮 **日均持有成本** — 每件物品独立计算，买贵但用久 = 划算
- 🏷️ **资产卡片网格** — 平台徽章 + emoji + 名称 + 日均成本一目了然
- 📥 **多平台导入** — 京东 / 淘宝 / Steam CSV 批量导入，自动去重
- 🔄 **物品生命周期** — 使用中 / 已售出 / 已报废，归档与恢复
- 🎨 **个性化定制** — 三态主题 × 5 套配色 × 自定义表情 × 平台颜色
- 🌐 **国际化** — 简体中文 / 繁體中文 / English
- 💾 **完全本地存储** — SQLite，数据不离设备，零服务器依赖

---

## 📥 支持平台


| 平台         | 状态 | 下载                                                                                              |
| :------------- | :----: | :-------------------------------------------------------------------------------------------------- |
| 🖥️ Windows |  ✅  | [`.exe` / `.msi`](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases)                 |
| 🍎 macOS     |  ✅  | [`.dmg`（Apple Silicon + Intel）](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases) |
| 🐧 Linux     |  ✅  | [`.deb` / `.AppImage`](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases)            |
| 🤖 Android   |  ✅  | [`.apk`](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases)                          |
| 🌐 Web       |  ✅  | [bunnychen.top](https://bunnychen.top/BunnyChen-Item-Bookkeeping/)                                |
| 📱 iOS       |  🚧  | 敬请期待                                                                                          |

---

## 🛠 技术架构


| 层级     | 技术选型                        |
| :--------- | :-------------------------------- |
| 桌面框架 | **Tauri v2**                    |
| 前端     | **TypeScript** + Vite           |
| 后端     | **Rust**                        |
| 数据库   | **SQLite**（rusqlite, bundled） |
| UI       | Vanilla HTML/CSS                |

---

## 🔒 隐私安全

**日耗仓完全离线运行，所有数据仅存储在本地。**

- 🖥️ 桌面端 → `AppData` 目录下的 SQLite 数据库
- 🤖 Android → 应用私有目录的 SQLite 数据库
- 🌐 网页版 → 浏览器 localStorage

❌ 不上传数据 · ❌ 无追踪分析 · ❌ 不读取无关文件

详见 [隐私说明](https://bunnychen.top/BunnyChen-Item-Bookkeeping/PRIVACY/)。

---

## ⚖️ 许可

本软件为 **专有软件（Proprietary）**，源码暂不开放。

- ✅ 个人免费使用
- ❌ 禁止商用 · 禁止剽窃仿冒 · 禁止逆向工程 · 禁止以任何形式再发布

详见 [LICENSE](LICENSE)。

---

## 🤝 寻求合作

日耗仓目前由个人独立开发维护。如果你认可这个项目，欢迎以下方式支持：

- 🧧 **赞助支持** — 帮助覆盖开发与其它成本
- 🤝 **商业合作** — 企业定制、平台接入、联合运营等合作洽谈

> 📧 联系方式：[bunnychen1024@gmail.com](mailto:bunnychen1024@gmail.com)

---

<p align="center">
  <sub>© 2025–2026 BunnyChen · Made with ❤️</sub>
</p>

---

> 💬 有问题或建议？欢迎提交 [Issue](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/issues)。
