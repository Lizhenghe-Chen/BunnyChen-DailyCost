# 🚀 安装与启动

日耗仓（DailyCost Vault）支持 Windows 桌面端、Android 和网页版三种使用方式，选择最适合你的平台开始使用。

---

## Windows 桌面端

桌面端提供最完整的体验：本地 SQLite 数据库、自动更新、拖拽导入等。

1. 前往 [Releases](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases) 页面
2. 下载 `DailyCost Vault_*_x64-setup.exe`（推荐）或 `.msi` 安装包
3. 双击运行安装程序，按照向导完成安装
4. 从开始菜单或桌面快捷方式启动「日耗仓」

> 💡 **SmartScreen 提示**：首次运行时 Windows 可能弹出 SmartScreen 警告，点击「更多信息」→「仍要运行」即可。

!!! tip "推荐使用桌面端"
    桌面端数据存储在本地 SQLite 数据库，支持自动更新、拖拽导入 CSV、文件管理器快速定位数据库等功能，体验最佳。

---

## Android

1. 前往 [Releases](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases) 页面
2. 下载 `.apk` 文件
3. 打开下载的文件，系统会提示「禁止安装未知应用」
4. 前往「设置」→ 允许来自此来源的安装
5. 返回安装界面完成安装

> 💡 安装完成后建议关闭「未知来源」权限。

---

## 网页版

直接访问 [bunnychen.top/BunnyChen-Item-Bookkeeping](https://bunnychen.top/BunnyChen-Item-Bookkeeping/)，无需安装。

> ⚠️ 网页版数据存储在浏览器本地。清除浏览器缓存/数据会导致数据丢失，请定期导出备份。

| 对比 | 桌面版 | 网页版 |
|------|:---:|:---:|
| 数据存储 | SQLite 本地数据库 | 浏览器 localStorage |
| 自动更新 | ✅ 内置 | — |
| 拖拽导入 CSV | ✅ | ✅ |
| 离线使用 | ✅ | 需先加载页面 |
| 数据持久性 | 高 | 清除缓存会丢失 |

---

## 下一步

安装完成后，推荐先从 **[📥 批量导入订单数据](import-csv.md)** 开始——如果你在京东、淘宝、Steam 有购买记录，这是最快填充资产的方式。

也可以直接 **[手动添加物品](manage-items.md)** 录入个别资产。
