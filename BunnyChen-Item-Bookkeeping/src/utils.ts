// ── 通用工具函数 ──────────────────────────────────────────
// 零外部依赖，可被任意模块安全引用

import { t, currentLang } from "./i18n";

// ── 环境检测 ────────────────────────────────────────────
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Android 端（Tauri Android WebView 的 UA 含 "Android"） */
export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

// ═══════════════════════════════════════════════════════════
// 版本检查（双通道）
// 桌面端：Tauri updater 自动安装
// Android/浏览器：GitHub API 查版本 → 通知用户手动下载
// ═══════════════════════════════════════════════════════════

interface LatestReleaseInfo {
  version: string;     // e.g. "v1.0.3"
  releaseUrl: string;  // e.g. "https://github.com/.../releases/tag/v1.0.3"
}

/** GitHub API 返回的 Release 数据（仅使用 tag_name 和 html_url） */
interface GithubRelease {
  tag_name: string;
  html_url: string;
}

/** Tauri updater 返回的 Update 对象（仅使用 version / downloadAndInstall） */
interface UpdaterInfo {
  version: string;
  downloadAndInstall(): Promise<void>;
}

/**
 * 通道 B：GitHub API 查询最新 Release（全平台回退）
 * 返回 null 表示当前已是最新版本；网络/API 错误时抛出异常。
 */
export async function fetchLatestVersion(currentVersion?: string): Promise<LatestReleaseInfo | null> {
  const res = await fetch(
    "https://api.github.com/repos/Lizhenghe-Chen/BunnyChen-DailyCost/releases?per_page=20",
    { headers: { Accept: "application/vnd.github+json" } }
  );
  // GitHub API 未认证限流（60 次/小时/IP）返回 403：视为暂时无法验证，按「已是最新」处理（自恢复）
  // 区别于网络/5xx 错误——那些仍 throw，让 UI 显示具体错误便于排查
  if (res.status === 403) return null;
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const releases: GithubRelease[] = await res.json();

  // 按创建时间降序，取第一个匹配 vX.Y.Z 的版本 tag
  const latestRelease = releases.find((r) => /^v\d+\.\d+\.\d+$/.test(r.tag_name));
  if (!latestRelease) return null;

  const remoteTag: string = latestRelease.tag_name;
  const releaseUrl: string = latestRelease.html_url;

  const cur = (currentVersion ?? "0").replace(/^v/, "");
  const remote = remoteTag.replace(/^v/, "");
  const curParts = cur.split(".").map(Number);
  const remoteParts = remote.split(".").map(Number);
  for (let i = 0; i < Math.max(curParts.length, remoteParts.length); i++) {
    const a = curParts[i] ?? 0, b = remoteParts[i] ?? 0;
    if (b > a) return { version: remoteTag, releaseUrl };
    if (a > b) return null;
  }
  return null;
}

/**
 * 通道 A：Tauri updater 检查更新（仅桌面端，主通道）
 * 有更新返回 Update 对象，无更新返回 null，网络/插件错误直接抛出。
 */
export async function checkForUpdate(): Promise<UpdaterInfo | null> {
  if (!isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  if (!await invoke<boolean>("updater_is_supported")) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  return await check() ?? null;
}

/**
 * 双通道检查编排（main.ts 后台检查与 ui-settings.ts 手动检查共用）：
 * 桌面端通道 A（updater，读 update.json 不走 GitHub API）权威；
 * 仅当通道 A 不可用/出错时才回退通道 B（GitHub API）。
 * 返回：
 *  - update:        通道 A 找到的更新对象（自动安装用）
 *  - info:          通道 B 找到的版本信息（手动下载链接用）
 *  - updaterUsable: 通道 A 可用且已成功判断 ⇒ 无 update 即「已是最新」，无需再查 GitHub API
 */
export async function checkForUpdates(currentVersion?: string): Promise<{
  update: UpdaterInfo | null;
  info: LatestReleaseInfo | null;
  updaterUsable: boolean;
}> {
  // ── 通道 A：Tauri updater ──
  let updaterUsable = false;
  let update: UpdaterInfo | null = null;
  try {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      updaterUsable = await invoke<boolean>("updater_is_supported");
      if (updaterUsable) {
        const { check } = await import("@tauri-apps/plugin-updater");
        update = (await check()) ?? null;
      }
    }
  } catch (e) {
    // 通道 A 异常 → 标记不可用，回退通道 B（记录日志便于排查）
    console.warn("[Updater] Automatic check failed; falling back to GitHub Release:", e);
    updaterUsable = false;
  }
  if (update) return { update, info: null, updaterUsable: true };
  // 通道 A 可用且无更新 → 已是最新，跳过通道 B（避免 api.github.com 未认证限流 403）
  if (updaterUsable) return { update: null, info: null, updaterUsable: true };
  // ── 通道 B：GitHub API（浏览器/Android，或通道 A 不可用/出错）──
  const info = await fetchLatestVersion(currentVersion);
  return { update: null, info, updaterUsable: false };
}

/**
 * 通道 A 续：下载安装并重启（仅桌面端）
 */
export async function downloadAndInstallUpdate(update: UpdaterInfo): Promise<void> {
  if (!isTauri()) throw new Error("Automatic updates are only available in the desktop app");
  const { invoke } = await import("@tauri-apps/api/core");
  if (!await invoke<boolean>("updater_is_supported")) {
    throw new Error("Automatic updates are not supported on this platform");
  }
  await update.downloadAndInstall();
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

/**
 * 渲染「发现新版本 → 点击自动更新」到关于区域 update-status，并绑定自动下载安装。
 * main.ts（后台检查）与 ui-settings.ts（手动检查）共用，避免重复逻辑。
 */
export function renderAutoUpdateStatus(update: UpdaterInfo): void {
  const statusEl = document.getElementById("update-status");
  if (!statusEl) return;
  statusEl.textContent = t("about.update_available", { version: update.version });
  statusEl.className = "about-update update-available";
  statusEl.style.cursor = "pointer";
  statusEl.onclick = async () => {
    statusEl.textContent = t("about.downloading");
    statusEl.className = "about-update update-downloading";
    try { await downloadAndInstallUpdate(update); }
    catch (e) { statusEl.textContent = `${t("about.update_failed")}: ${e}`; statusEl.className = "about-update update-error"; }
  };
}

// ── Toast ──────────────────────────────────────────────
export function showToast(msg: string, type: "success" | "error" | "info" = "info") {
  const toast = document.getElementById("toast")!;
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

// ── 确认弹窗 ────────────────────────────────────────────
export function showConfirm(msg: string): Promise<boolean> {
  return new Promise((resolve) => {
    document.getElementById("confirm-msg")!.textContent = msg;
    const overlay = document.getElementById("confirm-dialog")!;
    overlay.classList.add("show");
    const cleanup = () => {
      overlay.classList.remove("show");
      document.getElementById("confirm-ok")!.onclick = null;
      document.getElementById("confirm-cancel")!.onclick = null;
    };
    document.getElementById("confirm-ok")!.onclick = () => { cleanup(); resolve(true); };
    document.getElementById("confirm-cancel")!.onclick = () => { cleanup(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { cleanup(); resolve(false); } };
  });
}

// ── 格式化 ──────────────────────────────────────────────
export function formatDate(dateStr: string): string {
  if (!dateStr) return t("format.unknown_date");
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  return d.toLocaleDateString(currentLang());
}

export let currentPrecision = 2;
export function setPrecision(p: number) { currentPrecision = p; }

export let currencySymbol = "¥";
export function setCurrency(s: string) { if (s) currencySymbol = s; }

export function formatPrice(price: number): string {
  return `${currencySymbol}${price.toFixed(currentPrecision)}`;
}

export function platformLabel(platform: string): string {
  const key = `platform.${platform}`;
  const translated = t(key);
  // i18next 在 key 不存在时返回 key 本身，此时回退到原始平台名
  return translated === key ? platform : translated;
}

/** 平台检测：文件名前缀优先（jd-/jd_/tb-/tb_/steam-/steam_/wx-/wx_/微信），失败时按 CSV 内容头回退（与 Rust 端规则一致） */
export function detectPlatform(fileName: string, content?: string): string {
  const lower = fileName.toLowerCase();
  if (lower.startsWith("jd-") || lower.startsWith("jd_")) return "jd";
  if (lower.startsWith("tb-") || lower.startsWith("tb_")) return "tb";
  if (lower.startsWith("steam-") || lower.startsWith("steam_")) return "steam";
  if (lower.startsWith("wx-") || lower.startsWith("wx_") || lower.startsWith("微信")) return "wx";
  // 内容头回退（文件名不可靠时，如浏览器文件选择/重命名）
  if (content) {
    // 微信账单表头不在首行（前 5 行是元数据），需扫描前 8 行
    const head = content.split("\n").slice(0, 8).join("\n");
    if (head.includes("交易单号") && head.includes("金额(元)") && head.includes("交易时间")) return "wx";
    const header = content.split("\n")[0] || "";
    if (header.includes("交易ID") && header.includes("日期")) return "steam";
    if (header.includes("商品明细JSON")) return "jd";
    if (header.includes("商品链接")) return "tb";
  }
  return "unknown";
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── 智能分类 + Emoji 匹配（与 Rust 端保持一致）───────────
import { CATEGORIES } from "./types";

/** 统一匹配：根据产品名+店铺+平台返回 (category, emoji) */
export function matchProductCategory(name: string, store: string, platform: string): [string, string] {
  const combined = `${name} ${store} ${platform}`.toLowerCase();
  for (const cat of CATEGORIES) {
    for (const [keys, emoji] of cat.items) {
      for (const key of keys) {
        if (combined.includes(key)) return [cat.id, emoji];
      }
    }
  }
  return ["other", "📦"];
}

/** 获取分类的翻译文本 */
export function categoryLabel(categoryId: string): string {
  return t(`category.${categoryId}`) === `category.${categoryId}` ? categoryId : t(`category.${categoryId}`);
}

// ── 日期归一化 ────────────────────────────────────────────

/** 将 Excel 日期序列号（如 "46222.8"）转换为 ISO 日期 "YYYY-MM-DD HH:MM:SS"。
 *  微信账单 xlsx 的"交易时间"列常存为数字序列号（Excel 1900 日期系统，epoch=1899-12-30）。
 *  非纯数字（已归一化的日期字符串）原样返回，交由 normalizeDate 处理。 */
export function excelSerialToDate(raw: string): string {
  const t = (raw || "").trim();
  if (!t || !/^[\d.\-]+$/.test(t)) return t;
  const serial = parseFloat(t);
  if (isNaN(serial)) return t;
  const epoch = Date.UTC(1899, 11, 30); // 1899-12-30 UTC（规避 Excel 1900 闰年 bug）
  const days = Math.floor(serial);
  const secs = Math.round((serial - days) * 86400);
  const ms = epoch + days * 86400000 + secs * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return t;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** 日期归一化：保留时间精度（YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS） */
export function normalizeDate(raw: string): string {
  if (!raw) return raw;
  // ISO 日期
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!iso) {
    // 中文 "2025 年 11 月 29 日"
    const cn = raw.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (cn) return `${cn[1]}-${cn[2].padStart(2, "0")}-${cn[3].padStart(2, "0")}`;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10);
  }
  const date = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // 保留时间部分
  const time = raw.match(/(\d{2}:\d{2}(:\d{2})?)/);
  return time ? `${date} ${time[0]}` : date;
}

// ── 日期计算 ────────────────────────────────────────────
export function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start.slice(0, 10) + "T00:00:00Z");
  const e = new Date(end.slice(0, 10) + "T00:00:00Z");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
}

export function daysSince(orderTime: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return daysBetween(orderTime, today);
}

/** 校验截止日期：必须 ≥ 购买日期 且 ≤ 今天，返回错误信息或空 */
export function validateEndDate(endDate: string, orderTime: string): string {
  if (!endDate) return "";
  const e = new Date(endDate.slice(0, 10));
  const o = new Date(orderTime.slice(0, 10));
  const today = new Date(new Date().toISOString().slice(0, 10));
  if (isNaN(e.getTime())) return t("toast.invalid_end_date");
  if (e < o) return t("toast.end_before_start");
  if (e > today) return t("toast.end_in_future");
  return "";
}

export function calcDailyAvg(price: number, orderTime: string, endDate?: string, sellPrice?: number): number {
  if (price <= 0) return 0;
  if (!orderTime || isNaN(new Date(orderTime.slice(0, 10)).getTime())) return 0;
  const netCost = endDate && sellPrice !== undefined ? price - sellPrice : price;
  const days = endDate ? daysBetween(orderTime, endDate) : daysSince(orderTime);
  return days > 0 ? Math.round((netCost / days) * 100) / 100 : 0;
}

/** 格式化金额：负值时取绝对值（绿色由CSS处理），正值正常 */
export function formatNetCost(price: number): string {
  return `${currencySymbol}${Math.abs(price).toFixed(currentPrecision)}`;
}

// ── CSV 解析 ────────────────────────────────────────────
export function parseCsv(text: string): string[][] {
  // 去除 UTF-8 BOM（字节序标记 \uFEFF），避免首列名称匹配失败
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { inQuote = false; }
      } else { cell += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        row.push(cell); cell = "";
        if (row.length > 1 || row[0]) rows.push(row);
        row = [];
        if (ch === "\r") i++;
      } else if (ch !== "\r") { cell += ch; }
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0]) rows.push(row);
  return rows;
}

export function extractJdUrl(jsonStr: string, targetName: string): string {
  try {
    const items = JSON.parse(jsonStr);
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item["商品名称"] === targetName) return item["商品链接"] || "";
      }
    }
  } catch { /* ignore */ }
  return "";
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(t("csv.file_read_error")));
    reader.readAsText(file);
  });
}

/** 读取文件为 ArrayBuffer（浏览器端解析 xlsx 用） */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(t("csv.file_read_error")));
    reader.readAsArrayBuffer(file);
  });
}

// ── 防抖 ──────────────────────────────────────────────

/** 防抖：延迟 ms 后执行，期间再次调用会重置计时 */
export function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
