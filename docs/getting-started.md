# 🚀 安装与启动

日耗仓（DailyCost Vault）支持 Windows、macOS、Linux、Android 和网页版五种使用方式，选择最适合你的平台开始使用。

---

## 📥 下载与安装

!!! tip "推荐使用路径：桌面端为主，移动端为辅"
    京东 / 淘宝 / Steam 订单用浏览器扩展导出 CSV，微信账单直接在微信 App 内导出（无需扩展），所以**推荐先在桌面端完成导入**；之后再通过「导出数据库」把存档迁移到 **Android 端**随身查看。桌面端数据存本地 SQLite，支持自动更新、拖拽导入 CSV / Excel、快速定位数据库，体验最佳。

    🖥️ 桌面端导入订单 → 📤 导出数据库 `.db` → 📱 Android 端导入查看

!!! info "下载提示"
    所有安装包均来自官方 [GitHub Release](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases)。每个安装包提供多个下载源（按优先级）：**① GitHub 官方 → ② v4.gh-proxy.org（国内加速）→ ③ gh-proxy.com → ④ v6.gh-proxy.org → ⑤ gh-proxy.org（备用）**；国内用户优先用 ②，若加速均不可用，可到 [Gitee 镜像](https://gitee.com/lizhenghechen/BunnyChen-DailyCost/releases) 下载保底。

=== "🪟 Windows"

    | 安装包 | 说明 | ① GitHub 官方 | ② v4.gh-proxy.org | ③ gh-proxy.com | ④ v6.gh-proxy.org | ⑤ gh-proxy.org |
    |--------|------|:-:|:-:|:-:|:-:|:-:|
    | `DailyCost.Vault_1.1.0_x64-setup.exe` | x64（推荐） | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64-setup.exe)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64-setup.exe) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64-setup.exe) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64-setup.exe) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64-setup.exe) |
    | `DailyCost.Vault_1.1.0_x64_en-US.msi` | x64 MSI | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64_en-US.msi)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64_en-US.msi) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64_en-US.msi) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64_en-US.msi) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64_en-US.msi) |
    | `DailyCost.Vault_1.1.0_arm64-setup.exe` | ARM64（Snapdragon X 等 ARM 设备） | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64-setup.exe)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64-setup.exe) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64-setup.exe) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64-setup.exe) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64-setup.exe) |
    | `DailyCost.Vault_1.1.0_arm64_en-US.msi` | ARM64 MSI | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64_en-US.msi)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64_en-US.msi) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64_en-US.msi) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64_en-US.msi) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_arm64_en-US.msi) |

    **安装：** 下载 `x64-setup.exe`（推荐）或 `.msi`，双击按向导完成安装，再从开始菜单启动「日耗仓」。

    > 💡 **SmartScreen 提示**：首次运行如弹出警告，点「更多信息」→「仍要运行」即可。

=== "🍎 macOS"

    | 安装包 | 说明 | ① GitHub 官方 | ② v4.gh-proxy.org | ③ gh-proxy.com | ④ v6.gh-proxy.org | ⑤ gh-proxy.org |
    |--------|------|:-:|:-:|:-:|:-:|:-:|
    | `DailyCost.Vault_1.1.0_aarch64.dmg` | Apple M 系列（推荐） | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_aarch64.dmg)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_aarch64.dmg) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_aarch64.dmg) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_aarch64.dmg) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_aarch64.dmg) |
    | `DailyCost.Vault_1.1.0_x64.dmg` | Intel | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64.dmg)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64.dmg) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64.dmg) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64.dmg) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_x64.dmg) |

    **安装：** Apple M 系列下载 `aarch64.dmg`（推荐）、Intel 下载 `x64.dmg`，打开 `.dmg` 后把 `DailyCost Vault.app` 拖入「应用程序」即可。

    !!! warning "macOS 权限提示"
        若提示「已损坏，无法打开」，请在终端执行：

        ```sh
        xattr -d com.apple.quarantine /Applications/DailyCost\ Vault.app
        ```

=== "🐧 Linux"

    | 安装包 | 说明 | ① GitHub 官方 | ② v4.gh-proxy.org | ③ gh-proxy.com | ④ v6.gh-proxy.org | ⑤ gh-proxy.org |
    |--------|------|:-:|:-:|:-:|:-:|:-:|
    | `DailyCost.Vault_1.1.0_amd64.deb` | Debian / Ubuntu | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.deb)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.deb) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.deb) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.deb) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.deb) |
    | `DailyCost.Vault_1.1.0_amd64.AppImage` | 通用（AppImage） | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.AppImage)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.AppImage) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.AppImage) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.AppImage) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/DailyCost.Vault_1.1.0_amd64.AppImage) |

=== "📱 Android"

    | 安装包 | 说明 | ① GitHub 官方 | ② v4.gh-proxy.org | ③ gh-proxy.com | ④ v6.gh-proxy.org | ⑤ gh-proxy.org |
    |--------|------|:-:|:-:|:-:|:-:|:-:|
    | `app-universal-release.apk` | Android（需允许未知来源） | **[下载](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/app-universal-release.apk)** | [下载](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/app-universal-release.apk) | [下载](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/app-universal-release.apk) | [下载](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/app-universal-release.apk) | [下载](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.1.0/app-universal-release.apk) |

    **安装：** 下载 `.apk` 后打开，按提示允许「未知来源」即可完成安装。

---

## 网页版

直接访问 [bunnychen.top/BunnyChen-Item-Bookkeeping](https://bunnychen.top/BunnyChen-Item-Bookkeeping/)，无需安装。

> ⚠️ 网页版数据存储在浏览器本地。清除浏览器缓存/数据会导致数据丢失，请定期导出备份。

| 对比 | 桌面版 | 网页版 |
|------|:---:|:---:|
| 数据存储 | SQLite 本地数据库 | 浏览器 localStorage |
| 自动更新 | ✅ 内置 | — |
| 拖拽导入 CSV / Excel | ✅ | ✅ |
| 离线使用 | ✅ | 需先加载页面 |
| 数据持久性 | 高 | 清除缓存会丢失 |

---

## 🔒 安全说明

- 所有文件均托管于官方 GitHub Release，未做任何修改。
- 桌面端**自动更新**走 Tauri Updater，会校验 minisign 签名。
- 手动下载的安装包可配合对应的 `.sig` 文件用 [minisign](https://jedisct1.github.io/minisign/) 校验。

---

## 🗂 历史版本

前往 [GitHub Releases](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases) 查看全部历史版本与更新日志。

> 💡 不想安装？也可以直接使用[网页版](https://bunnychen.top/BunnyChen-Item-Bookkeeping/)，无需下载。

---

## 下一步

安装完成后，推荐先从 **[📥 批量导入订单数据](import-csv.md)** 开始——如果你在京东、淘宝、Steam、微信有购买 / 消费记录，这是最快填充资产的方式。

也可以直接 **[手动添加物品](manage-items.md)** 录入个别资产。
