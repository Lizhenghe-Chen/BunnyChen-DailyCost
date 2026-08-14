// ── 统一数据访问层 ──────────────────────────────────────────
// 桌面端走 Rust Tauri 命令，浏览器端走 BrowserDb（localStorage）。
// 各 UI 模块通过本层读取数据，避免各处重复书写 isTauri() 分支。

import { invoke } from "@tauri-apps/api/core";
import type { OrderItem } from "./types";
import { browserDb } from "./db";
import { isTauri } from "./utils";

/** 获取全部未归档物品（桌面=invoke get_items / 浏览器=BrowserDb） */
export async function fetchItems(): Promise<OrderItem[]> {
  return isTauri() ? await invoke<OrderItem[]>("get_items") : browserDb.getItems();
}

/** 获取全部已归档物品 */
export async function fetchArchivedItems(): Promise<OrderItem[]> {
  return isTauri() ? await invoke<OrderItem[]>("get_archived_items") : browserDb.getArchivedItems();
}

/** 获取已归档物品计数 */
export async function fetchArchivedCount(): Promise<number> {
  return isTauri() ? await invoke<number>("get_archived_count") : browserDb.getArchivedCount();
}
