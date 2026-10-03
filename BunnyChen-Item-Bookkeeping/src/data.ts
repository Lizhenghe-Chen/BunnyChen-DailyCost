// ── 统一数据访问层 ──────────────────────────────────────────
// 桌面端走 Rust Tauri 命令，浏览器端走 BrowserDb（localStorage）。
// 各 UI 模块通过本层读取数据，避免各处重复书写 isTauri() 分支。

import { invoke } from "@tauri-apps/api/core";
import type { OrderItem, IncomeRecord, BillAnalytics } from "./types";
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

/** 获取某账单平台（wx/alipay）的收支分析（支出/回款结构/来源 Top/月度） */
export async function fetchBillAnalytics(platform: string, start?: string, end?: string): Promise<BillAnalytics> {
  return isTauri()
    ? await invoke<BillAnalytics>("get_bill_analytics", { platform, start, end })
    : browserDb.getBillAnalytics(platform, start, end);
}

/** 查询某账单平台某回款来源（交易对方）的全部收入流水（回款来源 Top 榜点击下钻） */
export async function fetchIncomeRecordsByPeer(platform: string, peer: string): Promise<IncomeRecord[]> {
  return isTauri()
    ? await invoke<IncomeRecord[]>("get_income_records_by_peer", { platform, peer })
    : browserDb.getIncomeRecordsByPeer(platform, peer);
}
