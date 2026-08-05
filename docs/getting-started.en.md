# 🚀 Installation

DailyCost Vault supports Windows, macOS, Linux, Android, and Web — choose the platform that works best for you.

---

## 📥 Download & Install

!!! tip "Recommended workflow: Desktop first, Mobile as companion"
    JD.com / Taobao / Steam orders are exported as CSV via the browser extension, while WeChat bills are exported directly inside the WeChat app (no extension needed), so **we recommend importing on desktop first**, then migrating the archive to **Android** via "Export Database". Desktop stores data in local SQLite with auto-update, drag-drop CSV / Excel import, and quick database access — the best experience.

    🖥️ Desktop import → 📤 Export database `.db` → 📱 Android import

!!! info "Download Tips"
    All installers are from the official [GitHub Release](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases). Each installer offers multiple download sources (in priority order): **① GitHub Official → ② v4.gh-proxy.org (CN mirror) → ③ gh-proxy.com → ④ v6.gh-proxy.org → ⑤ gh-proxy.org (backup)**. In mainland China, prefer ②; if all mirrors fail, fall back to the [Gitee mirror](https://gitee.com/lizhenghechen/BunnyChen-DailyCost/releases).

=== "🪟 Windows"

    | Installer | Notes | ① GitHub Official | ② v4.gh-proxy.org | ③ gh-proxy.com | ④ v6.gh-proxy.org | ⑤ gh-proxy.org |
    |-----------|-------|:-:|:-:|:-:|:-:|:-:|
    | `DailyCost.Vault_1.0.11_x64-setup.exe` | x64 (recommended) | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64-setup.exe)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64-setup.exe) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64-setup.exe) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64-setup.exe) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64-setup.exe) |
    | `DailyCost.Vault_1.0.11_x64_en-US.msi` | x64 MSI | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64_en-US.msi)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64_en-US.msi) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64_en-US.msi) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64_en-US.msi) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64_en-US.msi) |
    | `DailyCost.Vault_1.0.11_arm64-setup.exe` | ARM64 (Snapdragon X and other ARM devices) | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64-setup.exe)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64-setup.exe) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64-setup.exe) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64-setup.exe) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64-setup.exe) |
    | `DailyCost.Vault_1.0.11_arm64_en-US.msi` | ARM64 MSI | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64_en-US.msi)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64_en-US.msi) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64_en-US.msi) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64_en-US.msi) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_arm64_en-US.msi) |

    **Install:** Download `x64-setup.exe` (recommended) or the `.msi`, double-click to follow the wizard, then launch "DailyCost Vault" from the Start Menu.

    > 💡 **SmartScreen Warning**: If Windows shows a warning on first run, click "More info" → "Run anyway".

=== "🍎 macOS"

    | Installer | Notes | ① GitHub Official | ② v4.gh-proxy.org | ③ gh-proxy.com | ④ v6.gh-proxy.org | ⑤ gh-proxy.org |
    |-----------|-------|:-:|:-:|:-:|:-:|:-:|
    | `DailyCost.Vault_1.0.11_aarch64.dmg` | Apple Silicon (recommended) | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_aarch64.dmg)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_aarch64.dmg) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_aarch64.dmg) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_aarch64.dmg) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_aarch64.dmg) |
    | `DailyCost.Vault_1.0.11_x64.dmg` | Intel | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64.dmg)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64.dmg) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64.dmg) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64.dmg) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_x64.dmg) |

    **Install:** Apple Silicon downloads `aarch64.dmg` (recommended), Intel downloads `x64.dmg`. Open the `.dmg` and drag `DailyCost Vault.app` into "Applications".

    !!! warning "macOS permission note"
        If macOS says the app "is damaged and can't be opened", run this in Terminal:

        ```sh
        xattr -d com.apple.quarantine /Applications/DailyCost\ Vault.app
        ```

=== "🐧 Linux"

    | Installer | Notes | ① GitHub Official | ② v4.gh-proxy.org | ③ gh-proxy.com | ④ v6.gh-proxy.org | ⑤ gh-proxy.org |
    |-----------|-------|:-:|:-:|:-:|:-:|:-:|
    | `DailyCost.Vault_1.0.11_amd64.deb` | Debian / Ubuntu | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.deb)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.deb) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.deb) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.deb) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.deb) |
    | `DailyCost.Vault_1.0.11_amd64.AppImage` | Universal (AppImage) | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.AppImage)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.AppImage) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.AppImage) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.AppImage) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/DailyCost.Vault_1.0.11_amd64.AppImage) |

=== "📱 Android"

    | Installer | Notes | ① GitHub Official | ② v4.gh-proxy.org | ③ gh-proxy.com | ④ v6.gh-proxy.org | ⑤ gh-proxy.org |
    |-----------|-------|:-:|:-:|:-:|:-:|:-:|
    | `app-universal-release.apk` | Android (allow unknown sources) | **[Download](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/app-universal-release.apk)** | [Download](https://v4.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/app-universal-release.apk) | [Download](https://gh-proxy.com/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/app-universal-release.apk) | [Download](https://v6.gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/app-universal-release.apk) | [Download](https://gh-proxy.org/https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases/download/v1.0.11/app-universal-release.apk) |

    **Install:** Download and open the `.apk`, then allow "Unknown sources" when prompted.

---

## Web Version

Visit [bunnychen.top/BunnyChen-Item-Bookkeeping](https://bunnychen.top/BunnyChen-Item-Bookkeeping/) directly — no installation needed.

> ⚠️ Web version data is stored in browser local storage. Clearing browser cache/data will cause data loss — please export backups regularly.

| Comparison | Desktop | Web |
|------------|:-------:|:---:|
| Data Storage | SQLite local database | Browser localStorage |
| Auto-update | ✅ Built-in | — |
| Drag-drop CSV / Excel import | ✅ | ✅ |
| Offline use | ✅ | Requires page loaded first |
| Data persistence | High | Lost on cache clear |

---

## 🔒 Security

- All files are hosted on the official GitHub Release and are not modified.
- Desktop **auto-update** uses Tauri Updater and verifies minisign signatures.
- Manual downloads can be verified with the corresponding `.sig` files using [minisign](https://jedisct1.github.io/minisign/).

---

## 🗂 History

See [GitHub Releases](https://github.com/Lizhenghe-Chen/BunnyChen-DailyCost/releases) for all versions and changelogs.

> 💡 Prefer not to install? You can also use the [Web version](https://bunnychen.top/BunnyChen-Item-Bookkeeping/), no download needed.

---

## Next Steps

After installation, we recommend starting with **[📥 Import CSV Orders](import-csv.md)** — if you have purchase history on JD.com, Taobao, Steam, or WeChat, this is the fastest way to populate your assets.

You can also **[manually add items](manage-items.md)** to record individual assets.
