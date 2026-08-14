# 🛠️ 开发指南

日耗仓 · DailyCost Vault 是 **Tauri v2 + Vite + TypeScript strict + Rust/SQLite** 全栈项目，一套代码覆盖 Windows / macOS / Linux / Android / iOS / Web。

!!! info "源码位置"
    应用源码与浏览器扩展都在本仓库：

    - `BunnyChen-Item-Bookkeeping/` — 应用源码（前端 `src/` + 后端 `src-tauri/`）
    - `dailycost-exporter-extension/` — 浏览器扩展（淘宝 / 京东 / Steam 订单导出）

---

## 环境要求

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Node.js | 22+ | 前端构建（Vite） |
| pnpm | 11+ | 依赖管理 |
| Rust | stable（1.88+） | 后端与桌面端构建 |
| Tauri CLI | 随项目（pnpm 脚本） | 桌面 / 移动端构建 |

各平台系统依赖（详见 [Tauri 官方 Prerequisites](https://v2.tauri.app/start/prerequisites/)）：

- **Windows**：Microsoft C++ Build Tools（勾选「使用 C++ 的桌面开发」）+ WebView2（Win10/11 自带）
- **macOS**：Xcode（桌面端 Command Line Tools 即可）
- **Linux**（Debian/Ubuntu）：`libwebkit2gtk-4.1-dev`、`build-essential`、`curl`、`wget`、`file`、`libxdo-dev`、`libssl-dev`、`libayatana-appindicator3-dev`、`librsvg2-dev`

---

## 快速开始

### 1. 安装依赖

```bash
cd BunnyChen-Item-Bookkeeping
pnpm install
```

### 2. 浏览器端开发（无需 Rust）

```bash
pnpm dev
# → http://localhost:1420
```

纯前端热更新，适合快速调试界面与交互逻辑。

### 3. 桌面端开发（Tauri 窗口 + 热更新）

```bash
pnpm tauri dev
```

自动启动 Vite 开发服务器并打开桌面窗口；前端修改即时热更新，Rust 改动需重新编译。

### 4. Rust 后端编译检查

```bash
cd src-tauri && cargo check
```

仅校验 Rust 代码能否编译，不产出二进制。

---

## 创建你的第一个 Tauri 项目（init）

想从零创建自己的 Tauri 应用？Tauri 提供两种方式，本项目即通过 **`create-tauri-app`** 脚手架创建（TypeScript + pnpm + Vanilla 模板）。

### 方式一：`create-tauri-app` 脚手架（推荐）

在目标目录下运行（推荐 pnpm）：

```bash
# 交互式向导
pnpm create tauri-app

# 或非交互式（Linux / macOS）
sh <(curl https://create.tauri.app/sh)
```

按提示选择：

| 提示 | 本项目选择 |
| --- | --- |
| Project name | `dailycost-vault` |
| Identifier | `com.bunnychen.dailycostvault` |
| Frontend language | `TypeScript / JavaScript` |
| Package manager | `pnpm` |
| UI template | `Vanilla` |
| UI flavor | `TypeScript` |

创建完成后：

```bash
cd dailycost-vault
pnpm install
pnpm tauri dev   # 打开 Tauri 窗口
```

### 方式二：已有前端工程接入 Tauri（Tauri CLI）

已有前端项目（Vite / Next.js 等）时，用 Tauri CLI 初始化后端：

```bash
# 1. 安装 Tauri CLI（dev 依赖）
pnpm install -D @tauri-apps/cli@latest

# 2. 初始化 Tauri（交互式问答）
pnpm tauri init
# ✔ What is your app name?
# ✔ What should the window title be?
# ✔ Where are your web assets located? → dist
# ✔ What is the url of your dev server? → http://localhost:5173
# ✔ What is your frontend dev command? → pnpm dev
# ✔ What is your frontend build command? → pnpm build
```

会生成 `src-tauri/` 目录。若用 Vite，建议在 `vite.config.ts` 忽略 `src-tauri` 避免热更新冲突：

```ts
export default defineConfig({
  server: { watch: { ignored: ["**/src-tauri/**"] } },
})
```

最后 `pnpm tauri dev` 验证。详细步骤见 [Tauri 官方 Create a Project](https://v2.tauri.app/start/create-project/)。

---

## 项目结构

```
BunnyChen-Item-Bookkeeping/
├── index.html              # 单页入口
├── package.json            # 前端脚本与依赖
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript strict 配置
├── src/                    # 前端源码（TypeScript + 原生 DOM，无框架）
│   ├── main.ts             # 入口
│   ├── ui-home.ts          # 首页（资产墙 / 筛选 / 卡片）
│   ├── ui-settings.ts      # 设置页
│   ├── ui-analytics.ts     # 数据分析页
│   ├── ui-share.ts         # 分享与报告
│   ├── db.ts               # 数据库访问
│   ├── prefs.ts            # 偏好设置
│   ├── theme.ts / themes.ts          # 主题系统
│   ├── emoji.ts / custom-emoji.ts    # 表情系统
│   ├── i18n.ts             # 国际化（中 / 英 / 繁）
│   ├── types.ts / utils.ts / aggregate.ts
│   └── locales/            # 三语翻译
└── src-tauri/              # Rust 后端
    ├── src/                # Rust 源码（Tauri 命令 / SQLite）
    ├── Cargo.toml          # Rust 依赖
    ├── tauri.conf.json     # 应用配置（标识符 / 窗口 / 更新）
    ├── capabilities/       # 权限能力声明
    ├── icons/              # 各平台图标
    └── gen/                # Android / iOS 生成工程
```

> 前端使用原生 TypeScript + DOM（无前端框架），后端 Rust 通过 Tauri IPC 提供 30+ 个 Tauri 命令，数据存储在本地 SQLite。

---

## 示例数据

- `src-tauri/example-data.db` — 内置示例数据库（由脚本生成）
- `src-tauri/generate_example_db.py` — 示例数据生成脚本
- `src/assets/example-data.json` / `example-incomes.json` — 前端示例数据

打开 App 后点击「加载示例数据」即可体验完整功能，无需导入任何文件。

---

## 官方文档

更多细节以 Tauri 官方文档为准：

| 主题 | 链接 |
| --- | --- |
| 环境准备（Prerequisites） | [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/) |
| 创建项目（Create a Project） | [v2.tauri.app/start/create-project](https://v2.tauri.app/start/create-project/) |
| 项目结构（Project Structure） | [v2.tauri.app/start/project-structure](https://v2.tauri.app/start/project-structure/) |
| Tauri CLI 参考 | [v2.tauri.app/reference/cli](https://v2.tauri.app/reference/cli/) |
| 开发指南（Develop） | [v2.tauri.app/develop](https://v2.tauri.app/develop/) |

---

## 下一步

- 构建与打包 → [📦 构建与打包](development-build.md)
- 用户侧使用指南 → [🚀 安装与启动](getting-started.md)
