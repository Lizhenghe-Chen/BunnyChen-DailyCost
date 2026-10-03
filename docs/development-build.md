# 📦 构建与打包

介绍日耗仓各平台的构建命令、产物与注意事项。

## 构建命令速查

| 命令 | 用途 | 产物 |
| --- | --- | --- |
| `pnpm build` | Web 构建 | `dist/` |
| `pnpm tauri build` | 桌面端构建 | Windows `.exe`、macOS `.dmg`、Linux `.deb` / `.AppImage` |
| `pnpm tauri android build` | Android 构建 | `.apk` / `.aab` |
| `pnpm tauri ios build` | iOS 构建 | `.ipa` |
| `pnpm tauri icon <源图>` | 图标生成 | 各平台图标 |

> 桌面端构建默认同时产出自动更新所需的签名产物（`createUpdaterArtifacts`）。

---

## Web 构建

```bash
pnpm build
```

产物为 `dist/` 纯静态页面，可部署到任意静态托管（GitHub Pages 等）。

## 桌面端构建

```bash
pnpm tauri build
```

各平台产物：

- **Windows**：NSIS 安装器（`x64` / `ARM64`）
- **macOS**：`.dmg`（`aarch64` M 系列 / `x64` Intel）
- **Linux**：`.deb` + `.AppImage`

## Android 构建

```bash
pnpm tauri android build
```

产物为 `.apk`。正式签名需在环境变量中提供 keystore 信息（`ANDROID_KEYSTORE_PATH` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEYSTORE_ALIAS` / `ANDROID_KEY_PASSWORD`），未配置时产出未签名包。

## iOS 构建

```bash
pnpm tauri ios build
```

产物为 `.ipa`（默认 release，前端资源内嵌可离线运行）。需 macOS + Xcode，并在 Xcode 中配置开发团队后可在真机运行。

## 浏览器扩展打包

扩展源码位于 `dailycost-exporter-extension/`，开发调试可直接在浏览器「加载已解压的扩展程序」。

### 1. 随桌面端应用分发

`BunnyChen-Item-Bookkeeping/src-tauri/tauri.conf.json` 的 `bundle.resources` 会把扩展文件映射进安装包的 `$RESOURCE/browser-extension/`：

```json
"resources": {
  "../../dailycost-exporter-extension/*.js": "browser-extension/",
  "../../dailycost-exporter-extension/*.html": "browser-extension/",
  "../../dailycost-exporter-extension/*.json": "browser-extension/",
  "../../dailycost-exporter-extension/*.png": "browser-extension/"
}
```

应用启动时由 `src-tauri/src/browser_ext.rs` 释放到**应用数据目录**下的 `browser-extension/`（macOS `~/Library/Application Support/com.bunnychen.dailycostvault/`），并在设置页「🧩 浏览器扩展」提供一键安装引导。该位置在系统中默认隐藏，因此设置页提供「在文件管理器中显示」「复制路径」与按平台的粘贴快捷键提示作为引导。

> ⚠️ 新增扩展文件类型（如 `.css`）时必须同步上面这条白名单，否则该文件不会被打进安装包。
> `tauri.android.conf.json` 把 `resources` 置空——移动端无法安装浏览器扩展，不白占 APK 体积。
>
> 🔒 **扩展源码保留在本仓库（请勿私有化）**：`bundle.resources` 匹配不到文件会**直接构建失败**（不是警告），删掉扩展目录会让 `cargo check` / `pnpm tauri dev` / `pnpm tauri build` 全部不可用；且本项目以 AGPL-3.0 开源，公开的对应源码需可构建。

### 2. 发布为网站下载 zip

官网下载按钮对应的文件（供网页版用户和手动安装场景）：

```powershell
# 在 dailycost-exporter-extension 目录下运行（Windows PowerShell）
.\build-extension.ps1
```

生成 `docs/assets/dailycost-exporter-extension.zip`。

---

## 版本号

版本号唯一来源为 `src-tauri/tauri.conf.json` 的 `version` 字段，发布新版本时同步更新 `src-tauri/Cargo.toml` 的版本号。
