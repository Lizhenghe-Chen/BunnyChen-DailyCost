// ── 国际化模块 ──────────────────────────────────────────
// 基于 i18next，语言检测优先级：用户偏好 → navigator.language → 'zh-CN'

import i18next from "i18next";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import en from "./locales/en.json";
import { savePref } from "./prefs";

export const SUPPORTED_LANGS = ["zh-CN", "zh-TW", "en"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const LANG_KEY = "language";

function detectLang(): SupportedLang {
  const nav = navigator.language;
  if (nav.startsWith("zh-TW") || nav.startsWith("zh-HK")) return "zh-TW";
  if (nav.startsWith("zh")) return "zh-CN";
  if (nav.startsWith("en")) return "en";
  return "zh-CN";
}

export async function initI18n(storedLang?: string): Promise<void> {
  const lng = (storedLang || detectLang()) as SupportedLang;
  await i18next.init({
    lng,
    fallbackLng: "zh-CN",
    resources: { "zh-CN": { translation: zhCN }, "zh-TW": { translation: zhTW }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  applyDocLang(lng);
}

export function t(key: string, options?: Record<string, any>): string {
  return i18next.t(key, options);
}

export function currentLang(): SupportedLang {
  return i18next.language as SupportedLang;
}

export async function changeLang(lng: SupportedLang): Promise<void> {
  await i18next.changeLanguage(lng);
  applyDocLang(lng);
  await savePref(LANG_KEY, lng);
}

function applyDocLang(lng: string) {
  document.documentElement.lang = lng;
  // 更新所有标记了 data-i18n 的元素（仅 textContent，不含 title/placeholder 专用属性）
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n")!;
    el.textContent = t(key);
  });
  // 更新 title 属性
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")!));
  });
  // 更新 placeholder 属性
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder")!);
  });
  // 更新 <title> 和 meta
  document.title = t("app.title");
  const descEl = document.querySelector("meta[name='description']");
  if (descEl) descEl.setAttribute("content", t("app.description"));
}

// 翻译整个 DOM（初始化时调用，将所有 [data-i18n] 元素替换为翻译文本）
export function translateDOM() {
  applyDocLang(currentLang());
}
