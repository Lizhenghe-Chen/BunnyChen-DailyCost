// ── 主题 & 颜色系统 ───────────────────────────────────────

import { SETTINGS_CACHE, savePref, loadPref } from "./prefs";
import { applyColorTheme } from "./themes";

export const COLOR_THEME_KEY = "color_theme";
export const DEFAULT_COLOR_THEME = "matcha";

// ── 平台调色板 ──────────────────────────────────────────
export const PLATFORM_PALETTE = [
  "#D4736A","#C8956B","#C8A840","#6BAF7B","#5A8A9E",
  "#6B7FBF","#8B6FAE","#CC7DA8","#7A8A7A","#9E8A6E",
];

export function darkMode(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark" ||
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches && !document.documentElement.getAttribute("data-theme"));
}

export function hexToPlatformStyle(hex: string): { bg: string; fg: string } {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  if (darkMode()) return { bg: `rgba(${r},${g},${b},0.18)`, fg: hex };
  return { bg: `rgba(${r},${g},${b},0.12)`, fg: hex };
}

export function platformColor(platform: string): { bg: string; fg: string } {
  const saved = SETTINGS_CACHE[`pc_${platform}`];
  if (saved) return hexToPlatformStyle(saved);
  // 哈希索引调色板
  let hash = 0;
  for (let i = 0; i < platform.length; i++) {
    hash = platform.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hexToPlatformStyle(PLATFORM_PALETTE[Math.abs(hash) % PLATFORM_PALETTE.length]);
}

// ── 三态主题 ────────────────────────────────────────────
export type Theme = "light" | "dark" | "system";
const THEME_KEY = "theme";
const themeIcons: Record<Theme, string> = { light: "☀️", dark: "🌙", system: "🌓" };
const themeNext: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };

function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  document.getElementById("btn-theme")!.textContent = themeIcons[theme];
}

export async function initTheme() {
  // ── 配色方案 ──
  const colorTheme = (await loadPref(COLOR_THEME_KEY, DEFAULT_COLOR_THEME));
  applyColorTheme(colorTheme);

  // ── 明暗模式 ──
  const saved = (await loadPref(THEME_KEY, "system")) as Theme;
  applyTheme(saved);
  document.getElementById("btn-theme")!.addEventListener("click", async () => {
    const current = (document.documentElement.getAttribute("data-theme") || "system") as Theme;
    const next = themeNext[current] || "system";
    applyTheme(next);
    await savePref(THEME_KEY, next);
  });
}

// ── 图表工具（分析页 / 分享海报共用）─────────────────────

/** hex → rgba（图表半透明填充用） */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 图表色板：读取 --chart-0..9 CSS 变量（自动跟随主题），缺失时回退内置 10 色；可选截取/循环到 count */
export function chartPalette(count?: number): string[] {
  const cs = getComputedStyle(document.documentElement);
  const fallback = ["#5BA04B", "#4A8EC0", "#C77DFF", "#FFB84D", "#F45B69", "#34D399", "#60A5FA", "#F472B6", "#A3E635", "#FBBF24"];
  const base: string[] = [];
  for (let i = 0; i < fallback.length; i++) {
    base.push(cs.getPropertyValue(`--chart-${i}`).trim() || fallback[i]);
  }
  if (count === undefined) return base;
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}
