// ── 统一偏好设置 API ──────────────────────────────────────
// Tauri: SQLite settings 表 / 浏览器: localStorage (键前缀 bk_)

import { invoke } from "@tauri-apps/api/core";

export const SETTINGS_CACHE: Record<string, string> = {};

export async function savePref(key: string, value: string) {
  SETTINGS_CACHE[key] = value;
  try { await invoke("save_setting", { key, value }); } catch {
    try { localStorage.setItem(`bk_${key}`, value); } catch { /* ignore */ }
  }
}

export async function loadPref(key: string, fallback = ""): Promise<string> {
  if (SETTINGS_CACHE[key]) return SETTINGS_CACHE[key];
  try {
    const val = await invoke<string>("get_setting", { key });
    if (val) { SETTINGS_CACHE[key] = val; return val; }
  } catch {
    try {
      const val = localStorage.getItem(`bk_${key}`);
      if (val) { SETTINGS_CACHE[key] = val; return val; }
    } catch { /* ignore */ }
  }
  return fallback;
}

export async function loadAllPrefs(): Promise<Record<string, string>> {
  try {
    const map = await invoke<Record<string, string>>("get_all_settings");
    Object.assign(SETTINGS_CACHE, map);
    return map;
  } catch {
    const result: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("bk_")) result[k.slice(3)] = localStorage.getItem(k) || "";
    }
    Object.assign(SETTINGS_CACHE, result);
    return result;
  }
}
