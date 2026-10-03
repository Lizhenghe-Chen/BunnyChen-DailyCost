// ── 浏览器扩展：随应用分发 + 应用内安装引导 ──────────────────────────────
//
// 浏览器不允许外部程序静默安装扩展（Chrome 137+ 移除 --load-extension，
// macOS/Windows 自 Chrome 44 起封禁本地 CRX 外部安装），所以这里只做三件事：
//   1. 把随应用打包的扩展释放到应用数据目录（路径固定 ⇒ 扩展 ID 固定 ⇒ 应用升级后原地覆盖即生效）
//   2. 拉起指定浏览器打开它自己的扩展管理页
//   3. 读浏览器 profile 配置，判断扩展是否已经装好
//
// 识别方式：profile 的 extensions.settings 中 unpacked 扩展带 path 字段，与释放目录比对即可；
// 路径不同时再读对方 manifest 的 name 兜底，用于识别早期「下载解压」留下的旧副本。

use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// 随应用打包的资源子目录名，须与 `tauri.conf.json` 的 `bundle.resources` 目标一致
const RES_DIR: &str = "browser-extension";
/// 释放到磁盘的扩展目录名。与 `RES_DIR` 分开定义：这一项决定「路径 → 扩展 ID」，
/// 改了会让已装扩展变成「未安装」，不应随资源目录名一起被顺手改掉
const INSTALL_DIR: &str = "browser-extension";
const EXT_NAME: &str = "DailyCost Vault Exporter";
/// 释放给浏览器的文件类型（build-extension.ps1 等开发脚本不释放）
const SHIPPED_EXTS: [&str; 4] = ["js", "html", "json", "png"];

#[derive(Serialize)]
pub struct BrowserInfo {
    pub id: String,
    pub name: String,
    pub extensions_url: String,
    /// 已检测到的扩展副本路径（本应用副本排首位）
    pub installed_paths: Vec<String>,
    /// 是否检测到由本应用管理的副本
    pub managed: bool,
}

#[derive(Serialize)]
pub struct ExtensionEnv {
    /// 当前平台是否支持安装浏览器扩展（移动端为 false）
    pub supported: bool,
    /// 扩展释放目录（未释放时也返回，供 UI 展示目标位置）
    pub install_path: String,
    pub version: String,
    pub browsers: Vec<BrowserInfo>,
}

/// 该浏览器下的扩展状态（日志用，中文短标签）
fn browser_state(b: &BrowserInfo) -> &'static str {
    if b.managed {
        "已装"
    } else if b.installed_paths.is_empty() {
        "未装"
    } else {
        "旧副本"
    }
}

// 一份跨三平台的浏览器定义表，各平台只读取自己那几列
#[allow(dead_code)]
struct BrowserDef {
    id: &'static str,
    name: &'static str,
    url: &'static str,
    /// macOS：应用包名 / 包内可执行文件名 / 数据目录（相对 ~/Library/Application Support）
    mac_app: &'static str,
    mac_bin: &'static str,
    mac_data: &'static str,
    /// Windows：可执行文件（相对 Program Files）/ 数据目录（相对 %LOCALAPPDATA%）
    win_exe: &'static str,
    win_data: &'static str,
    /// Linux：可执行文件名候选 / 数据目录（相对 $HOME）
    linux_exe: &'static [&'static str],
    linux_data: &'static str,
}

const BROWSERS: &[BrowserDef] = &[
    BrowserDef {
        id: "chrome", name: "Google Chrome", url: "chrome://extensions/",
        mac_app: "Google Chrome.app", mac_bin: "Google Chrome", mac_data: "Google/Chrome",
        win_exe: "Google/Chrome/Application/chrome.exe", win_data: "Google/Chrome/User Data",
        linux_exe: &["google-chrome", "google-chrome-stable"], linux_data: ".config/google-chrome",
    },
    BrowserDef {
        id: "edge", name: "Microsoft Edge", url: "edge://extensions/",
        mac_app: "Microsoft Edge.app", mac_bin: "Microsoft Edge", mac_data: "Microsoft Edge",
        win_exe: "Microsoft/Edge/Application/msedge.exe", win_data: "Microsoft/Edge/User Data",
        linux_exe: &["microsoft-edge", "microsoft-edge-stable"], linux_data: ".config/microsoft-edge",
    },
    BrowserDef {
        id: "brave", name: "Brave", url: "brave://extensions/",
        mac_app: "Brave Browser.app", mac_bin: "Brave Browser", mac_data: "BraveSoftware/Brave-Browser",
        win_exe: "BraveSoftware/Brave-Browser/Application/brave.exe", win_data: "BraveSoftware/Brave-Browser/User Data",
        linux_exe: &["brave-browser", "brave"], linux_data: ".config/BraveSoftware/Brave-Browser",
    },
    BrowserDef {
        id: "chromium", name: "Chromium", url: "chrome://extensions/",
        mac_app: "Chromium.app", mac_bin: "Chromium", mac_data: "Chromium",
        win_exe: "Chromium/Application/chrome.exe", win_data: "Chromium/User Data",
        linux_exe: &["chromium", "chromium-browser"], linux_data: ".config/chromium",
    },
    BrowserDef {
        id: "vivaldi", name: "Vivaldi", url: "vivaldi://extensions/",
        mac_app: "Vivaldi.app", mac_bin: "Vivaldi", mac_data: "Vivaldi",
        win_exe: "Vivaldi/Application/vivaldi.exe", win_data: "Vivaldi/User Data",
        linux_exe: &["vivaldi", "vivaldi-stable"], linux_data: ".config/vivaldi",
    },
    BrowserDef {
        id: "arc", name: "Arc", url: "chrome://extensions/",
        mac_app: "Arc.app", mac_bin: "Arc", mac_data: "Arc/User Data",
        win_exe: "", win_data: "",
        linux_exe: &[], linux_data: "",
    },
];

/// 移动端没有可安装扩展的浏览器
fn is_mobile() -> bool {
    cfg!(any(target_os = "android", target_os = "ios"))
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(target_os = "macos")]
fn resolve_exe(def: &BrowserDef) -> Option<PathBuf> {
    let rel = format!("{}/Contents/MacOS/{}", def.mac_app, def.mac_bin);
    let mut roots = vec![PathBuf::from("/Applications")];
    if let Some(home) = home_dir() {
        roots.push(home.join("Applications"));
    }
    roots.into_iter().map(|r| r.join(&rel)).find(|p| p.is_file())
}

#[cfg(target_os = "windows")]
fn resolve_exe(def: &BrowserDef) -> Option<PathBuf> {
    if def.win_exe.is_empty() {
        return None;
    }
    ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"]
        .iter()
        .filter_map(|k| std::env::var_os(k))
        .map(|root| PathBuf::from(root).join(def.win_exe))
        .find(|p| p.is_file())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn resolve_exe(def: &BrowserDef) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        for name in def.linux_exe {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn user_data_dir(def: &BrowserDef) -> Option<PathBuf> {
    Some(home_dir()?.join("Library/Application Support").join(def.mac_data))
}

#[cfg(target_os = "windows")]
fn user_data_dir(def: &BrowserDef) -> Option<PathBuf> {
    if def.win_data.is_empty() {
        return None;
    }
    Some(PathBuf::from(std::env::var_os("LOCALAPPDATA")?).join(def.win_data))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn user_data_dir(def: &BrowserDef) -> Option<PathBuf> {
    if def.linux_data.is_empty() {
        return None;
    }
    Some(home_dir()?.join(def.linux_data))
}

fn is_shipped(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| SHIPPED_EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn shippable_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("读取扩展源目录失败: {e}"))?;
    Ok(entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_file() && is_shipped(p))
        .collect())
}

/// 源目录与已释放目录的文件指纹（文件名 + 大小），用于判断是否需要重新释放
fn fingerprint(dir: &Path) -> Vec<(String, u64)> {
    let mut out: Vec<(String, u64)> = shippable_files(dir)
        .unwrap_or_default()
        .into_iter()
        .map(|p| {
            let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
            (name, fs::metadata(&p).map(|m| m.len()).unwrap_or(0))
        })
        .collect();
    out.sort();
    out
}

/// 读取目录下的 manifest.json（扩展身份识别的唯一入口）
fn manifest_json(dir: &Path) -> Option<Value> {
    let text = fs::read_to_string(dir.join("manifest.json")).ok()?;
    serde_json::from_str(&text).ok()
}

fn manifest_version(dir: &Path) -> Option<String> {
    let json = manifest_json(dir)?;
    json.get("version")?.as_str().map(|s| s.to_string())
}

/// 扩展释放目录：应用数据目录下（macOS `~/Library/Application Support/com.bunnychen.dailycostvault/`、
/// Windows `%APPDATA%\com.bunnychen.dailycostvault\`、Linux `~/.config/com.bunnychen.dailycostvault/`）。
///
/// 放在应用数据目录而非「下载」「文稿」：不会被用户当作下载内容顺手清理掉，删了就失效。
/// 代价是该位置在系统中默认隐藏，用户在浏览器文件选择框里不好找——因此设置页提供
/// 「在文件管理器中显示」「复制路径」以及「按 ⌘⇧G 粘贴路径」三件套引导来补足。
///
/// 路径固定 ⇒ 扩展 ID 固定 ⇒ 应用升级后原地覆盖即生效，无需重装。
pub fn install_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录: {e}"))?
        .join(INSTALL_DIR))
}

/// 随应用分发的扩展源目录；`tauri dev` 下资源未随二进制分发时回退到仓库源码目录
fn source_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(res) = app.path().resource_dir() {
        let candidate = res.join(RES_DIR);
        if candidate.join("manifest.json").is_file() {
            return Ok(candidate);
        }
    }
    #[cfg(debug_assertions)]
    if let Ok(dev) = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("dailycost-exporter-extension")
        .canonicalize()
    {
        if dev.join("manifest.json").is_file() {
            return Ok(dev);
        }
    }
    Err("未找到随应用分发的浏览器扩展资源".into())
}

/// 把打包的扩展释放到应用数据目录，内容一致时跳过写入（幂等）
pub fn sync_extension(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let src = source_dir(app)?;
    let dst = install_path(app)?;
    let src_files = fingerprint(&src);
    if !src_files.is_empty() && src_files == fingerprint(&dst) {
        return Ok(dst);
    }

    fs::create_dir_all(&dst).map_err(|e| format!("创建扩展目录失败: {e}"))?;
    let files = shippable_files(&src)?;
    for file in &files {
        let name = file.file_name().unwrap_or_default();
        fs::copy(file, dst.join(name)).map_err(|e| format!("写入扩展文件失败: {e}"))?;
    }
    // 清掉旧版本残留的文件（例如图标改名）
    let keep: Vec<String> = files
        .iter()
        .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .collect();
    for stale in shippable_files(&dst)?.into_iter() {
        let name = stale.file_name().unwrap_or_default().to_string_lossy().to_string();
        if !keep.contains(&name) {
            let _ = fs::remove_file(&stale);
        }
    }

    if !dst.join("manifest.json").is_file() {
        return Err("扩展释放不完整：缺少 manifest.json".into());
    }
    Ok(dst)
}

/// 是否为日耗仓扩展（按 manifest 名称识别，用于区分路径不同的历史旧副本）
fn is_our_extension(dir: &Path) -> bool {
    manifest_json(dir).is_some_and(|v| v.get("name").and_then(|n| n.as_str()) == Some(EXT_NAME))
}

/// 扫描浏览器全部 profile，返回 (是否有本应用副本, 其他位置副本)
fn scan_profiles(user_data: &Path, managed_path: &Path) -> (bool, Vec<String>) {
    let ours = fs::canonicalize(managed_path).unwrap_or_else(|_| managed_path.to_path_buf());
    let mut managed = false;
    let mut others: Vec<String> = Vec::new();

    let Ok(profiles) = fs::read_dir(user_data) else {
        return (false, others);
    };
    for profile in profiles.flatten().map(|e| e.path()).filter(|p| p.is_dir()) {
        for name in ["Secure Preferences", "Preferences"] {
            let Ok(text) = fs::read_to_string(profile.join(name)) else {
                continue;
            };
            let Ok(json) = serde_json::from_str::<Value>(&text) else {
                continue;
            };
            let Some(settings) = json.pointer("/extensions/settings").and_then(|v| v.as_object()) else {
                continue;
            };
            for info in settings.values() {
                // 只有 unpacked 扩展（开发者模式加载）才带 path
                let Some(raw) = info.get("path").and_then(|p| p.as_str()).filter(|p| !p.is_empty()) else {
                    continue;
                };
                let stored = PathBuf::from(raw);
                let resolved = fs::canonicalize(&stored).unwrap_or_else(|_| stored.clone());
                // 释放目录可能尚未创建（启动释放跑在异步线程），此时 canonicalize 会失败，
                // 故同时接受「规范化后相等」与「与被管理目录原样相等」两种命中，避免误报未安装
                if resolved == ours || stored.as_path() == managed_path {
                    managed = true;
                } else if is_our_extension(&resolved) {
                    others.push(resolved.to_string_lossy().to_string());
                }
            }
        }
    }
    others.sort();
    others.dedup();
    (managed, others)
}

fn detect_browsers(managed_path: &Path) -> Vec<BrowserInfo> {
    BROWSERS
        .iter()
        .filter(|def| resolve_exe(def).is_some())
        .map(|def| {
            let (managed, mut others) = match user_data_dir(def) {
                Some(dir) => scan_profiles(&dir, managed_path),
                None => (false, Vec::new()),
            };
            if managed {
                others.insert(0, managed_path.to_string_lossy().to_string());
            }
            BrowserInfo {
                id: def.id.to_string(),
                name: def.name.to_string(),
                extensions_url: def.url.to_string(),
                managed,
                installed_paths: others,
            }
        })
        .collect()
}

fn build_env(app: &tauri::AppHandle, extract: bool) -> Result<ExtensionEnv, String> {
    // 移动端没有可安装扩展的浏览器：直接返回，不碰文件系统
    if is_mobile() {
        return Ok(ExtensionEnv {
            supported: false,
            install_path: String::new(),
            version: String::new(),
            browsers: Vec::new(),
        });
    }
    let install_path = install_path(app)?;
    if extract {
        sync_extension(app)?;
    }
    let version = manifest_version(&install_path).unwrap_or_default();
    let browsers = detect_browsers(&install_path);
    log::info!(
        "浏览器扩展 v{} @ {}；浏览器: {}",
        version,
        install_path.display(),
        browsers
            .iter()
            .map(|b| format!("{}[{}]", b.name, browser_state(b)))
            .collect::<Vec<_>>()
            .join(" ")
    );
    Ok(ExtensionEnv {
        supported: true,
        version,
        install_path: install_path.to_string_lossy().to_string(),
        browsers,
    })
}

/// 探测浏览器与扩展安装状态（只读取浏览器配置；仅确保释放目录存在，不写入扩展文件）
#[tauri::command]
pub async fn get_extension_env(app: tauri::AppHandle) -> Result<ExtensionEnv, String> {
    build_env(&app, false)
}

/// 释放 / 更新扩展文件后返回最新环境
#[tauri::command]
pub async fn install_browser_extension(app: tauri::AppHandle) -> Result<ExtensionEnv, String> {
    build_env(&app, true)
}

/// 拉起指定浏览器并打开其扩展管理页（chrome:// 等自定义协议无法走 opener 插件）
#[tauri::command]
pub fn open_browser_extensions_page(browser_id: String) -> Result<(), String> {
    let def = BROWSERS
        .iter()
        .find(|b| b.id == browser_id)
        .ok_or_else(|| format!("未知浏览器: {browser_id}"))?;
    let exe = resolve_exe(def).ok_or_else(|| format!("未找到 {} 的安装位置", def.name))?;
    std::process::Command::new(exe)
        .arg(def.url)
        .spawn()
        .map_err(|e| format!("启动 {} 失败: {e}", def.name))?;
    Ok(())
}
