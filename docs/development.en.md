# 🛠️ Development

DailyCost Vault is a **Tauri v2 + Vite + TypeScript strict + Rust/SQLite** full-stack project — one codebase covering Windows / macOS / Linux / Android / iOS / Web.

!!! info "Source layout"
    The app source and browser extension both live in this repo:

    - `BunnyChen-Item-Bookkeeping/` — app source (frontend `src/` + backend `src-tauri/`)
    - `dailycost-exporter-extension/` — browser extension (Taobao / JD.com / Steam order export)

---

## Requirements

| Dependency | Version | Purpose |
| --- | --- | --- |
| Node.js | 22+ | Frontend build (Vite) |
| pnpm | 11+ | Package manager |
| Rust | stable (1.88+) | Backend & desktop build |
| Tauri CLI | via project (pnpm scripts) | Desktop / mobile build |

Platform system dependencies (see [official Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)):

- **Windows**: Microsoft C++ Build Tools ("Desktop development with C++") + WebView2 (bundled with Win10/11)
- **macOS**: Xcode (Command Line Tools is enough for desktop)
- **Linux** (Debian/Ubuntu): `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

---

## Quick Start

### 1. Install dependencies

```bash
cd BunnyChen-Item-Bookkeeping
pnpm install
```

### 2. Browser-only development (no Rust needed) — start the dev web app

```bash
pnpm dev
# → open http://localhost:1420 in your browser
```

Pure frontend hot-reload (HMR) — great for iterating on UI and interaction logic. In this mode there is **only the web frontend, no Rust backend**:

- Data is stored in browser `localStorage` (a simulated `BrowserDb`), independent from the desktop SQLite database
- Only needs Node.js + pnpm — no Rust or desktop system dependencies, runs on any machine
- Frontend changes hot-reload instantly; update checks go through the GitHub API channel (no Tauri updater)
- Stop: press `Ctrl+C` in the terminal to end the Vite process

### 3. Desktop development (Tauri window + hot-reload)

```bash
pnpm tauri dev
```

Starts the Vite dev server and opens a desktop window; frontend changes hot-reload instantly, Rust changes require recompilation.

### 4. Rust backend compile check

```bash
cd src-tauri && cargo check
```

Checks whether the Rust code compiles, without producing a binary.

---

## Create Your First Tauri Project (init)

Want to scaffold your own Tauri app from scratch? Tauri offers two approaches — this project itself was created via **`create-tauri-app`** (TypeScript + pnpm + Vanilla template).

### Option 1: `create-tauri-app` scaffold (recommended)

Run in the directory where you want the project (pnpm recommended):

```bash
# Interactive wizard
pnpm create tauri-app

# Or non-interactive (Linux / macOS)
sh <(curl https://create.tauri.app/sh)
```

Follow the prompts:

| Prompt | This project chose |
| --- | --- |
| Project name | `dailycost-vault` |
| Identifier | `com.bunnychen.dailycostvault` |
| Frontend language | `TypeScript / JavaScript` |
| Package manager | `pnpm` |
| UI template | `Vanilla` |
| UI flavor | `TypeScript` |

After scaffolding:

```bash
cd dailycost-vault
pnpm install
pnpm tauri dev   # opens a Tauri window
```

### Option 2: Add Tauri to an existing frontend (Tauri CLI)

If you already have a frontend project (Vite / Next.js / …), initialize the backend with the Tauri CLI:

```bash
# 1. Install the Tauri CLI (dev dependency)
pnpm install -D @tauri-apps/cli@latest

# 2. Initialize Tauri (interactive prompts)
pnpm tauri init
# ✔ What is your app name?
# ✔ What should the window title be?
# ✔ Where are your web assets located? → dist
# ✔ What is the url of your dev server? → http://localhost:5173
# ✔ What is your frontend dev command? → pnpm dev
# ✔ What is your frontend build command? → pnpm build
```

This creates a `src-tauri/` directory. If you use Vite, ignore `src-tauri` in `vite.config.ts` to avoid hot-reload conflicts:

```ts
export default defineConfig({
  server: { watch: { ignored: ["**/src-tauri/**"] } },
})
```

Finally, run `pnpm tauri dev` to verify. Full walkthrough: [Tauri Create a Project](https://v2.tauri.app/start/create-project/).

---

## Project Structure

```
BunnyChen-Item-Bookkeeping/
├── index.html              # Single-page entry
├── package.json            # Frontend scripts & dependencies
├── vite.config.ts          # Vite config
├── tsconfig.json           # TypeScript strict config
├── src/                    # Frontend source (TypeScript + vanilla DOM, no framework)
│   ├── main.ts             # Entry point
│   ├── ui-home.ts          # Home (asset wall / filters / cards)
│   ├── ui-settings.ts      # Settings page
│   ├── ui-analytics.ts     # Analytics page
│   ├── ui-share.ts         # Share & reports
│   ├── db.ts               # Database access
│   ├── prefs.ts            # Preferences
│   ├── theme.ts / themes.ts          # Theme system
│   ├── emoji.ts / custom-emoji.ts    # Emoji system
│   ├── i18n.ts             # i18n (zh / en / zh-TW)
│   ├── types.ts / utils.ts / aggregate.ts
│   └── locales/            # Translations
└── src-tauri/              # Rust backend
    ├── src/                # Rust source (Tauri commands / SQLite)
    ├── Cargo.toml          # Rust dependencies
    ├── tauri.conf.json     # App config (identifier / window / updater)
    ├── capabilities/       # Permission capabilities
    ├── icons/              # Platform icons
    └── gen/                # Android / iOS generated projects
```

> The frontend uses vanilla TypeScript + DOM (no framework); the Rust backend exposes 30+ Tauri commands over IPC, with data stored in a local SQLite database.

---

## Sample Data

- `src-tauri/example-data.db` — bundled sample database (generated by a script)
- `src-tauri/generate_example_db.py` — sample data generator
- `src/assets/example-data.json` / `example-incomes.json` — frontend sample data

Click "Load sample data" in the app to try the full feature set without importing anything.

---

## Official Docs

For details, refer to the official Tauri documentation:

| Topic | Link |
| --- | --- |
| Prerequisites | [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/) |
| Create a Project | [v2.tauri.app/start/create-project](https://v2.tauri.app/start/create-project/) |
| Project Structure | [v2.tauri.app/start/project-structure](https://v2.tauri.app/start/project-structure/) |
| Tauri CLI Reference | [v2.tauri.app/reference/cli](https://v2.tauri.app/reference/cli/) |
| Develop | [v2.tauri.app/develop](https://v2.tauri.app/develop/) |

---

## Next Steps

- Build & packaging → [📦 Build & Packaging](development-build.en.md)
- User guide → [🚀 Installation](getting-started.en.md)
