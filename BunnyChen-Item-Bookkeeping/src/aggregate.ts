// ── 数据聚合工具（纯函数，无 DOM / 无副作用）─────────────
// 分析页与分享海报共用，避免重复实现。所有函数只读 items，
// 返回新数组、不修改入参。空分类统一归入「未分类」
// （空分类归入「未分类」，语义与原后端 SQL COALESCE(NULLIF(category,''),'未分类') 一致）

import type { OrderItem, PlatformSummary, CategorySummary } from "./types";

/** 按平台汇总消费（total/count，按 total 降序） */
export function aggregatePlatform(items: OrderItem[]): PlatformSummary[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    const e = map.get(item.platform) || { total: 0, count: 0 };
    e.total += item.total_price;
    e.count += 1;
    map.set(item.platform, e);
  }
  return Array.from(map.entries())
    .map(([platform, v]) => ({ platform, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

/** 按分类汇总消费（total/count，按 total 降序）；空分类归入「未分类」 */
export function aggregateCategory(items: OrderItem[]): CategorySummary[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    const c = item.category || "未分类";
    const e = map.get(c) || { total: 0, count: 0 };
    e.total += item.total_price;
    e.count += 1;
    map.set(c, e);
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

/** 总花费 */
export function sumTotal(items: OrderItem[]): number {
  return items.reduce((s, i) => s + i.total_price, 0);
}

/** 日均可变成本合计 */
export function sumDaily(items: OrderItem[]): number {
  return items.reduce((s, i) => s + i.daily_avg_cost, 0);
}

/** 已回收统计：件数 / 回款额 / 回收率（相对 total） */
export function recoveredStats(items: OrderItem[], total: number): { count: number; value: number; rate: number } {
  const sold = items.filter((i) => i.end_reason === "sold");
  const value = sold.reduce((s, i) => s + i.sell_price, 0);
  return { count: sold.length, value, rate: total > 0 ? (value / total) * 100 : 0 };
}

/** 月度消费额聚合（按月份升序；limit 只取最近 N 个月） */
export function aggregateMonthly(items: OrderItem[], limit?: number): { month: string; total: number }[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const m = it.order_time.substring(0, 7);
    if (m) map.set(m, (map.get(m) || 0) + it.total_price);
  }
  const arr = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ month, total }));
  return limit ? arr.slice(-limit) : arr;
}

/** 月度趋势：最近两个有消费月份的金额与环比涨跌（%）；不足两月或无环比基数时 trend 为 null */
export function monthlyTrend(items: OrderItem[]): { latestMonth: string | null; prevMonth: string | null; latestTotal: number; prevTotal: number; trend: number | null } {
  const monthly = aggregateMonthly(items);
  const latest = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const latestMonth = latest?.month ?? null;
  const prevMonth = prev?.month ?? null;
  const latestTotal = latest?.total ?? 0;
  const prevTotal = prev?.total ?? 0;
  const trend = prevMonth && prevTotal > 0 ? Math.round(((latestTotal - prevTotal) / prevTotal) * 100) : null;
  return { latestMonth, prevMonth, latestTotal, prevTotal, trend };
}

/** 月度件数聚合（按月份升序；limit 只取最近 N 个月） */
export function aggregateMonthlyCount(items: OrderItem[], limit = 12): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const m = it.order_time.substring(0, 7);
    if (m) map.set(m, (map.get(m) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-limit)
    .map(([month, count]) => ({ month, count }));
}
