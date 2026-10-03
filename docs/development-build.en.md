# 📦 Build & Packaging

Build commands, artifacts, and notes for each DailyCost Vault platform.

## Command Reference

| Command | Purpose | Artifacts |
| --- | --- | --- |
| `pnpm build` | Web build | `dist/` |
| `pnpm tauri build` | Desktop build | Windows `.exe`, macOS `.dmg`, Linux `.deb` / `.AppImage` |
| `pnpm tauri android build` | Android build | `.apk` / `.aab` |
| `pnpm tauri ios build` | iOS build | `.ipa` |
| `pnpm tauri icon <source>` | Icon generation | Platform icons |

> The desktop build also produces the signed artifacts required for auto-updates (`createUpdaterArtifacts`) by default.

---

## Web Build

```bash
pnpm build
```

Outputs a pure static site to `dist/`, deployable to any static host (GitHub Pages, etc.).

## Desktop Build

```bash
pnpm tauri build
```

Artifacts per platform:

- **Windows**: NSIS installer (`x64` / `ARM64`)
- **macOS**: `.dmg` (`aarch64` M-series / `x64` Intel)
- **Linux**: `.deb` + `.AppImage`

## Android Build

```bash
pnpm tauri android build
```

Outputs `.apk`. For a signed release, provide keystore info via environment variables (`ANDROID_KEYSTORE_PATH` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEYSTORE_ALIAS` / `ANDROID_KEY_PASSWORD`); without them the build is unsigned.

## iOS Build

```bash
pnpm tauri ios build
```

Outputs `.ipa` (release by default, frontend assets embedded for offline use). Requires macOS + Xcode; configure a development team in Xcode to run on a real device.

## Browser Extension Packaging

Extension source lives in `dailycost-exporter-extension/`. For development you can load it directly via the browser's "Load unpacked extension".

### 1. Shipped with the desktop app

`BunnyChen-Item-Bookkeeping/src-tauri/tauri.conf.json` maps the extension into the installer at `$RESOURCE/browser-extension/` via `bundle.resources`:

```json
"resources": {
  "../../dailycost-exporter-extension/*.js": "browser-extension/",
  "../../dailycost-exporter-extension/*.html": "browser-extension/",
  "../../dailycost-exporter-extension/*.json": "browser-extension/",
  "../../dailycost-exporter-extension/*.png": "browser-extension/"
}
```

On startup `src-tauri/src/browser_ext.rs` extracts it into `browser-extension/` inside the **app data directory** (macOS `~/Library/Application Support/com.bunnychen.dailycostvault/`), and **Settings → 🧩 Browser Extension** walks the user through installing it. That location is hidden by default, so the settings page also offers *Show in File Manager*, *Copy Path*, and a per-platform paste shortcut hint as guidance.

> ⚠️ When adding a new extension file type (e.g. `.css`) you must extend that whitelist, otherwise the file will not be bundled.
> `tauri.android.conf.json` empties `resources` — mobile cannot install browser extensions, so there is no point inflating the APK.
>
> 🔒 **The extension source stays in this repo (do not privatize it)**: a non-matching `bundle.resources` is a **hard build failure**, not a warning — removing the extension folder breaks `cargo check` / `pnpm tauri dev` / `pnpm tauri build` entirely. The project is also AGPL-3.0, so the published corresponding source needs to be buildable.

### 2. Publish as the website download zip

The file behind the website download button (for web-version users and manual installs):

```powershell
# Run inside dailycost-exporter-extension (Windows PowerShell)
.\build-extension.ps1
```

Generates `docs/assets/dailycost-exporter-extension.zip`.

---

## Versioning

The single source of truth for the version is the `version` field in `src-tauri/tauri.conf.json`; keep `src-tauri/Cargo.toml` in sync when releasing a new version.
