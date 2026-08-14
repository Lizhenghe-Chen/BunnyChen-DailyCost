// ── 分享与报告：资产墙 / 年度报告 海报生成 ────────────────
// 预览：HTML 网页组件（清晰可滚动，非图片）；保存时才用纯前端 canvas 渲染 PNG。
//   Web 端下载 PNG；Tauri 端走 dialog.save + fs.writeFile 保存。零新增依赖、不碰 Rust 后端。
// 数据复用主页已加载的 allItems（全量非归档物品），不新增 IPC。
// 入口：主页导航栏 📤（资产墙）、分析页「年度报告」、设置页「分享与报告」。

import type { OrderItem } from "./types";
import { isTauri, formatNetCost, platformLabel, categoryLabel, showToast, currencySymbol, debounce } from "./utils";
import { aggregatePlatform, aggregateCategory, sumTotal, sumDaily, recoveredStats, monthlyTrend, aggregateMonthly, aggregateMonthlyCount } from "./aggregate";
import { chartPalette } from "./theme";
import { customEmojiSrc } from "./custom-emoji";
import logoUrl from "./assets/logo-32.png";
import { t, currentLang } from "./i18n";
import { allItems } from "./ui-home";
import { savePref, loadPref } from "./prefs";

// ── 海报常量（1080×1440 竖版 3:4，适配小红书/朋友圈）────
const W = 1080;
const H = 1440;
const PAD = 56;
const TEXT = "#ffffff";
const TEXT_DIM = "#9fb3c8";
const TEXT_MUTED = "#6b7f92";
const CARD_BG = "#1b2733";
const CARD_BORDER = "#2b3a49";
const ACCENT_A = "#5BA04B";
const ACCENT_B = "#4A8EC0";
const FONT = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, -apple-system, sans-serif";
const LOGO_URL = logoUrl;
const REPO_LABEL = "GitHub · BunnyChen-DailyCost";

// ── 可自定义模块：用户选择海报展示哪些区块（复用分析页/主页已有数据）──
export interface ShareModules {
  kpi: boolean;
  recovered: boolean;
  insight: boolean;
  expensive: boolean;
  trend: boolean;
  monthcount: boolean;
  dist: boolean;
  plat: boolean;
  ranking: boolean;
}
const ALL_MODULES: ShareModules = { kpi: true, recovered: true, insight: true, expensive: true, trend: true, monthcount: true, dist: true, plat: true, ranking: true };
function readModules(): ShareModules {
  const m: ShareModules = { ...ALL_MODULES };
  document.querySelectorAll<HTMLInputElement>("#share-modules-list input[data-mod]").forEach((el) => {
    const key = el.dataset.mod as keyof ShareModules;
    if (key in m) m[key] = el.checked;
  });
  return m;
}

let _sharePlan: { filename: string; draw: (mods: ShareModules) => Promise<HTMLCanvasElement>; mods: ShareModules } | null = null;
let _customShareTitle = ""; // 用户自定义海报标题（资产墙；空=默认语言标题）
let _renderSeq = 0; // 渲染序号，丢弃过期渲染结果
let _shareCanvas: HTMLCanvasElement | null = null;

// ── 基础绘制工具 ────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 按码点切分，避免中文/emoji 被半截断 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of [...text]) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** 超长文本省略号截断（按码点，避免拆坏 emoji） */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = "";
  for (const ch of [...text]) {
    if (ctx.measureText(t + ch + "…").width > maxWidth) break;
    t += ch;
  }
  return t + "…";
}

/** 预加载海报用到的自定义表情图（GIF/PNG），失败自动回退文本 emoji */
async function loadEmojiImages(ids: string[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  const unique = [...new Set(ids.filter((id) => customEmojiSrc[id]))];
  await Promise.all(unique.map((id) => new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => { map.set(id, img); resolve(); };
    img.onerror = () => resolve();
    img.src = customEmojiSrc[id];
  })));
  return map;
}

/** 加载单张本地图片（Logo/二维码），失败返回 null */
function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 绘制 emoji：自定义表情用图片（contain 缩放），否则按 Unicode 文本绘制 */
function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number, imgs: Map<string, HTMLImageElement>): void {
  const src = customEmojiSrc[emoji];
  const img = src ? imgs.get(emoji) : undefined;
  if (img) {
    const ratio = Math.min(size / (img.width || size), size / (img.height || size));
    const w = (img.width || size) * ratio;
    const h = (img.height || size) * ratio;
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  } else {
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, x + size / 2, y + size / 2 + size * 0.06);
  }
}

function baseCanvas(height: number = H): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#22313f");
  bg.addColorStop(1, "#131b24");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, height);
  // 顶部/底部轻微品牌光晕，增加质感
  const topGlow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, height * 0.45);
  topGlow.addColorStop(0, "rgba(91,160,75,0.10)");
  topGlow.addColorStop(1, "rgba(91,160,75,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, height);
  const botGlow = ctx.createRadialGradient(W / 2, height, 0, W / 2, height, height * 0.45);
  botGlow.addColorStop(0, "rgba(74,142,192,0.08)");
  botGlow.addColorStop(1, "rgba(74,142,192,0)");
  ctx.fillStyle = botGlow;
  ctx.fillRect(0, 0, W, height);
  return [canvas, ctx];
}

/** 海报顶部品牌区：Logo + 应用名 + 口号（左）+ 标题（右）+ 仓库标识（中） */
function drawBrand(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, title: string, slogan: string): void {
  if (logo) ctx.drawImage(logo, PAD, 40, 56, 56);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(t("about.app_name"), PAD + 72, 78);
  ctx.font = `500 20px ${FONT}`;
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(ellipsize(ctx, slogan, 400), PAD + 72, 112);
  ctx.textAlign = "right";
  ctx.font = `700 38px ${FONT}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(title, W - PAD, 82);
  ctx.textAlign = "center";
  ctx.font = `500 19px ${FONT}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(REPO_LABEL, W / 2, 144);
  const g = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  g.addColorStop(0, ACCENT_A);
  g.addColorStop(1, ACCENT_B);
  rr(ctx, PAD, 166, W - PAD * 2, 4, 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawStatCards(ctx: CanvasRenderingContext2D, stats: { emoji: string; label: string; value: string; unit?: string; color: string; colorEnd: string; gold?: boolean }[], y: number, imgs: Map<string, HTMLImageElement>): void {
  const gap = 20;
  const cardW = (W - PAD * 2 - gap * (stats.length - 1)) / stats.length;
  const cardH = 148;
  stats.forEach((s, i) => {
    const x = PAD + i * (cardW + gap);
    const cx = x + cardW / 2;
    rr(ctx, x, y, cardW, cardH, 18);
    ctx.fillStyle = CARD_BG;
    ctx.fill();
    ctx.strokeStyle = CARD_BORDER;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 顶部主题色条
    const barGrad = ctx.createLinearGradient(x + 24, 0, x + cardW - 24, 0);
    barGrad.addColorStop(0, s.color);
    barGrad.addColorStop(1, s.colorEnd);
    rr(ctx, x + 24, y, cardW - 48, 3, 1.5);
    ctx.fillStyle = barGrad;
    ctx.fill();
    // emoji 圆角色块
    rr(ctx, cx - 21, y + 16, 42, 42, 12);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawEmoji(ctx, s.emoji, cx - 15, y + 21, 30, imgs);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(s.label, cx, y + 92);
    ctx.font = `700 38px ${FONT}`;
    const vw = ctx.measureText(s.value).width;
    const uw = s.unit ? ctx.measureText(s.unit).width : 0;
    const total = vw + (s.unit ? 10 + uw : 0);
    ctx.fillStyle = s.gold ? "#ffd27d" : TEXT;
    ctx.fillText(s.value, cx - total / 2 + vw / 2, y + 128);
    if (s.unit) {
      ctx.font = `500 20px ${FONT}`;
      ctx.fillStyle = TEXT_MUTED;
      ctx.fillText(s.unit, cx - total / 2 + vw + 10 + uw / 2, y + 126);
    }
  });
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  const g = ctx.createLinearGradient(x, 0, x + 4, 0);
  g.addColorStop(0, ACCENT_A);
  g.addColorStop(1, ACCENT_B);
  rr(ctx, x, y - 16, 4, 16, 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(text, x + 14, y);
}

/** 区块卡片：每个分析模块独立底卡，避免内容拥挤 */
function drawSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rr(ctx, x, y, w, h, 22);
  ctx.fillStyle = "rgba(27, 39, 51, 0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(43, 58, 73, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawFooter(ctx: CanvasRenderingContext2D, text: string, y: number = H - 44): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 22px ${FONT}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(text, W / 2, y);
}

// ── 图表工具（复用分析页视觉：CSS 变量色板 + 撞色；chartPalette 见 theme.ts）────────

/** 金额紧凑格式：≥1 万显示「x.x万」（英文用 k），避免长数字溢出 */
function shortMoney(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${currencySymbol}${(v / 1e8).toFixed(2)}${currentLang() === "en" ? "B" : "亿"}`;
  if (abs >= 1e4) return `${currencySymbol}${(v / 1e4).toFixed(1)}${currentLang() === "en" ? "k" : "万"}`;
  return `${currencySymbol}${Math.round(v)}`;
}

/** 月份短标签：`2026-03` → 「3月」/「Mar」 */
function monthLabel(m: string): string {
  const n = parseInt(m.split("-")[1] || "0", 10);
  if (currentLang() === "en") {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return names[n - 1] || m;
  }
  return `${n}月`;
}

/** 柱状图（月度趋势/件数）：标题色条 + 简化刻度网格 + 柱顶数值 + 底部月份标签 */
function drawBarChart(ctx: CanvasRenderingContext2D, data: { label: string; value: number }[], title: string, x: number, y: number, w: number, h: number, fmt: (v: number) => string = shortMoney, unitLabel = ""): void {
  const palette = chartPalette();
  // 标题 + 渐变色条
  const tg = ctx.createLinearGradient(x, 0, x + 4, 0);
  tg.addColorStop(0, ACCENT_A);
  tg.addColorStop(1, ACCENT_B);
  rr(ctx, x, y - 16, 4, 16, 2);
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(title, x + 14, y);
  const topY = y + 34;
  const baseY = y + h - 26;
  const chartH = baseY - topY;
  const max = Math.max(1, ...data.map((d) => d.value));
  // 简化刻度网格线：100% / 66.6% / 33.3% / 0
  [1, 0.666, 0.333, 0].forEach((ratio) => {
    const ly = baseY - chartH * ratio;
    ctx.strokeStyle = ratio === 1 || ratio === 0 ? "rgba(159,179,200,0.30)" : "rgba(107,127,146,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + w, ly);
    ctx.stroke();
  });
  // Y 轴刻度标签（最大 / 0）
  ctx.font = `600 18px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(`${fmt(max)}${unitLabel}`, x + w, topY - 6);
  ctx.fillText("0", x + w, baseY + 2);
  const gap = 10;
  const barW = (w - gap * (data.length - 1)) / data.length;
  data.forEach((d, i) => {
    const bh = Math.max(4, (d.value / max) * chartH);
    const bx = x + i * (barW + gap);
    const by = baseY - bh;
    const g = ctx.createLinearGradient(bx, by, bx, baseY);
    g.addColorStop(0, palette[i % palette.length]);
    g.addColorStop(1, "#1d2a37");
    rr(ctx, bx, by, barW, bh, 6);
    ctx.fillStyle = g;
    ctx.fill();
    // 柱顶数值（最高柱与顶部刻度重复则跳过）
    if (d.value !== max && bh > 24) {
      ctx.font = `700 18px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(fmt(d.value), bx + barW / 2, by - 8);
    }
    // 月份标签
    ctx.font = `600 18px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText(d.label, bx + barW / 2, baseY + 18);
  });
}

/** 圆环图（平台/分类分布）：标题 + 环 + 中心总额 + 图例 Top3 */
function drawDonut(ctx: CanvasRenderingContext2D, data: { label: string; value: number }[], title: string, cx: number, cy: number, r: number): void {
  const palette = chartPalette();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  ctx.textAlign = "center";
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(title, cx, cy - r - 16);
  let start = -Math.PI / 2;
  data.slice(0, 6).forEach((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = palette[i % palette.length];
    ctx.fill();
    start += angle;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = "#141c26";
  ctx.fill();
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(shortMoney(data.reduce((s, d) => s + d.value, 0)), cx, cy + 4);
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(t("share.stat_total"), cx, cy + 30);
  // 图例 Top3
  data.slice(0, 3).forEach((d, i) => {
    const ly = cy + r + 34 + i * 34;
    ctx.fillStyle = palette[i % palette.length];
    ctx.beginPath();
    ctx.arc(cx - 110, ly - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = `500 20px ${FONT}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(d.label, cx - 92, ly);
    ctx.textAlign = "right";
    ctx.fillStyle = TEXT;
    ctx.fillText(shortMoney(d.value), cx + 110, ly);
  });
}

// ── 海报高度按所选模块动态计算（见 drawGearWall / drawYearReport）──

/** 最贵单品 Top3 卡片（资产墙 / 年度报告共用；仅 x/cardW/firstTop 可配，内部偏移固定） */
function drawTop3Cards(
  ctx: CanvasRenderingContext2D,
  top3: OrderItem[],
  imgs: Map<string, HTMLImageElement>,
  x: number,        // 卡片区左上 x
  y: number,        // 区块内容起点 y
  firstTop: number, // 第一张卡片相对 y 的垂直偏移
  cardW: number,    // 卡片宽度
): void {
  top3.forEach((item, idx) => {
    const cy = y + firstTop + idx * 130;
    rr(ctx, x, cy, cardW, 112, 16);
    ctx.fillStyle = CARD_BG;
    ctx.fill();
    ctx.strokeStyle = CARD_BORDER;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawEmoji(ctx, item.emoji, x + 24, cy + 24, 60, imgs);
    ctx.textAlign = "left";
    ctx.font = `600 25px ${FONT}`;
    ctx.fillStyle = TEXT;
    ctx.fillText(ellipsize(ctx, `${idx + 1}. ${item.product_name}`, W - PAD * 2 - 296), x + 112, cy + 40);
    ctx.font = `500 21px ${FONT}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(platformLabel(item.platform), x + 112, cy + 78);
    ctx.textAlign = "right";
    ctx.font = `700 30px ${FONT}`;
    ctx.fillStyle = "#ffd27d";
    ctx.fillText(shortMoney(item.total_price), x + cardW - 24, cy + 78);
  });
}

/** 平台横向条形排行（资产墙 / 年度报告共用） */
function drawPlatBars(
  ctx: CanvasRenderingContext2D,
  rows: { label: string; value: number }[],
  y: number,        // 区块内容起点 y
  firstTop: number, // 第一行相对 y 的垂直偏移
  rowGap: number,   // 行间距
  insetX: number,   // 左内边距（右边界 = W - insetX）
  fontPx: number,   // 标签/数值字号
  barTop: number,   // 条相对行 y 的垂直偏移
  barH: number,     // 条高度
  barR: number,     // 条圆角
): void {
  const maxV = rows[0]?.value || 1;
  const leftX = insetX;
  const rightX = W - insetX;
  rows.forEach((row, idx) => {
    const py = y + firstTop + idx * rowGap;
    ctx.textAlign = "left";
    ctx.font = `600 ${fontPx}px ${FONT}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(row.label, leftX, py);
    ctx.textAlign = "right";
    ctx.font = `700 ${fontPx}px ${FONT}`;
    ctx.fillStyle = TEXT;
    ctx.fillText(shortMoney(row.value), rightX, py);
    const avail = rightX - leftX;
    const barW = avail * (row.value / maxV);
    const g = ctx.createLinearGradient(leftX, 0, leftX + barW, 0);
    g.addColorStop(0, ACCENT_A);
    g.addColorStop(1, ACCENT_B);
    rr(ctx, leftX, py + barTop, Math.max(8, barW), barH, barR);
    ctx.fillStyle = g;
    ctx.fill();
  });
}

export async function drawGearWall(items: OrderItem[], mods: ShareModules): Promise<HTMLCanvasElement> {
  const imgs = await loadEmojiImages(items.slice(0, 60).map((i) => i.emoji));
  const logo = await loadImg(LOGO_URL);

  // ── 数据准备（聚合统一走 ./aggregate，与分析页保持一致）──
  const total = sumTotal(items);
  const daily = sumDaily(items);
  const byDaily = [...items].sort((a, b) => b.daily_avg_cost - a.daily_avg_cost);
  const highest = byDaily[0];
  const platformSummary = aggregatePlatform(items);
  const topPlat = platformSummary[0];
  const plats = platformSummary.map((p) => ({ label: platformLabel(p.platform), value: p.total }));
  const cats = aggregateCategory(items).map((c) => ({ label: categoryLabel(c.category), value: c.total }));
  const { latestMonth, latestTotal, trend } = monthlyTrend(items);
  const trendText = trend === null
    ? (latestMonth ? t("analytics.insight_trend_first", { value: shortMoney(latestTotal) }) : "—")
    : (trend === 0 ? t("share.trend_flat") : trend > 0 ? t("share.trend_up", { value: trend }) : t("share.trend_down", { value: -trend }));
  const months = aggregateMonthly(items, 12).map((m) => ({ label: monthLabel(m.month), value: m.total }));
  const monthCounts = aggregateMonthlyCount(items, 12).map((m) => ({ label: monthLabel(m.month), value: m.count }));

  // ── 动态高度（按所选模块堆叠）──
  const BLOCK: Record<keyof ShareModules, number> = { kpi: 172, recovered: 240, insight: 150, expensive: 500, trend: 324, monthcount: 324, dist: 444, plat: 460, ranking: 1140 };
  const height = 200 + (mods.kpi ? BLOCK.kpi : 0) + (mods.recovered ? BLOCK.recovered : 0) + (mods.insight ? BLOCK.insight : 0) + (mods.expensive ? BLOCK.expensive : 0) + (mods.trend ? BLOCK.trend : 0) + (mods.monthcount ? BLOCK.monthcount : 0) + (mods.dist ? BLOCK.dist : 0) + (mods.plat ? BLOCK.plat : 0) + (mods.ranking ? BLOCK.ranking : 0) + 60;
  const [canvas, ctx] = baseCanvas(height);
  drawBrand(ctx, logo, _customShareTitle.trim() || t("share.title_gear"), t("share.gear_slogan"));

  let y = 200;
  // KPI 三卡（emoji 图标 + 数值/单位）
  if (mods.kpi) {
    drawStatCards(ctx, [
      { emoji: "📋", color: "#5BA04B", colorEnd: "#7ED0A0", label: t("share.stat_items"), value: `${items.length}`, unit: t("share.items_unit") },
      { emoji: "💰", color: "#F0A050", colorEnd: "#FFCF8A", gold: true, label: t("share.stat_total"), value: shortMoney(total), unit: "" },
      { emoji: "📅", color: "#4A8EC0", colorEnd: "#7FB8E8", label: t("share.stat_daily"), value: formatNetCost(daily), unit: t("share.per_day") },
    ], y, imgs);
    y += BLOCK.kpi;
  }
  // 已回收
  if (mods.recovered) {
    const { count: soldCount, value: recoveredTotal, rate: recoveredRate } = recoveredStats(items, total);
    drawSection(ctx, 44, y, W - 88, 216);
    drawSectionTitle(ctx, t("share.recovered_title"), 70, y + 40);
    drawStatCards(ctx, [
      { emoji: "♻️", color: "#5BA04B", colorEnd: "#7ED0A0", label: t("share.recovered_count"), value: `${soldCount}`, unit: t("share.items_unit") },
      { emoji: "💰", color: "#F0A050", colorEnd: "#FFCF8A", gold: true, label: t("share.recovered_value"), value: shortMoney(recoveredTotal), unit: "" },
      { emoji: "📈", color: "#4A8EC0", colorEnd: "#7FB8E8", label: t("share.recovered_rate"), value: `${recoveredRate.toFixed(1)}`, unit: "%" },
    ], y + 52, imgs);
    y += BLOCK.recovered;
  }
  // 决策洞察三行（独立区块 + 顶部留白，避免与上方卡片贴边）
  if (mods.insight) {
    drawSection(ctx, 44, y, W - 88, 128);
    ctx.textAlign = "left";
    ctx.font = `500 24px ${FONT}`;
    ctx.fillStyle = TEXT_DIM;
    if (highest) {
      const label = `${t("share.insight_highest")} `;
      const val = ` ${formatNetCost(highest.daily_avg_cost)}${t("share.per_day")}`;
      const name = ellipsize(ctx, highest.product_name, W - PAD * 2 - ctx.measureText(label + val).width);
      ctx.fillText(`${label}${name}${val}`, PAD, y + 42);
    }
    if (topPlat) ctx.fillText(`${t("share.insight_platform")} ${platformLabel(topPlat.platform)} ${shortMoney(topPlat.total)}`, PAD, y + 76);
    ctx.fillText(`${t("share.insight_trend")} ${latestMonth ? monthLabel(latestMonth) : "—"} ${trendText}`, PAD, y + 110);
    y += BLOCK.insight;
  }
  // 最贵单品 Top3
  if (mods.expensive) {
    const top3 = [...items].sort((a, b) => b.total_price - a.total_price).slice(0, 3);
    drawSection(ctx, 44, y, W - 88, 470);
    drawSectionTitle(ctx, t("share.top_expensive"), 70, y + 40);
    drawTop3Cards(ctx, top3, imgs, PAD + 8, y, 70, W - PAD * 2 - 16);
    y += BLOCK.expensive;
  }
  // 月度消费趋势
  if (mods.trend && months.length > 0) {
    drawSection(ctx, 44, y, W - 88, 300);
    drawBarChart(ctx, months, t("share.monthly_trend"), 74, y + 68, W - 148, 200);
    y += BLOCK.trend;
  }
  // 月度件数
  if (mods.monthcount && monthCounts.length > 0) {
    drawSection(ctx, 44, y, W - 88, 300);
    drawBarChart(ctx, monthCounts, t("share.month_count_title"), 74, y + 68, W - 148, 200, (v) => String(v), t("share.items_unit"));
    y += BLOCK.monthcount;
  }
  // 平台 + 分类 双饼图
  if (mods.dist) {
    drawSection(ctx, 44, y, W - 88, 420);
    drawDonut(ctx, plats, t("share.platform_dist"), 296, y + 180, 96);
    drawDonut(ctx, cats, t("share.by_category"), 784, y + 180, 96);
    y += BLOCK.dist;
  }
  // 平台排行（横向条形）
  if (mods.plat) {
    drawSection(ctx, 44, y, W - 88, 440);
    drawSectionTitle(ctx, t("share.plat_rank_title"), 70, y + 40);
    drawPlatBars(ctx, plats.slice(0, 4), y, 70, 92, PAD + 8, 22, 22, 16, 8);
    y += BLOCK.plat;
  }
  // 物品排行网格：10 件（2×5，卡片更宽避免长名称截断）
  if (mods.ranking) {
    const top = byDaily.slice(0, 10);
    drawSection(ctx, 44, y, W - 88, 1116);
    drawSectionTitle(ctx, t("share.top_items"), 70, y + 44);
    const cols = 2;
    const gap = 24;
    const gridLeft = 74;
    const gridW = W - 148;
    const cardW = (gridW - gap * (cols - 1)) / cols;
    const gridTop = y + 84;
    const rowH = 185;
    top.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = gridLeft + col * (cardW + gap);
      const gy = gridTop + row * (rowH + gap);
      rr(ctx, x, gy, cardW, rowH, 16);
      ctx.fillStyle = CARD_BG;
      ctx.fill();
      ctx.strokeStyle = CARD_BORDER;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 排名徽章（金银铜）
      const rx = x + cardW - 18;
      const ry = gy + 18;
      ctx.beginPath();
      ctx.arc(rx, ry, 24, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? "#d89a2b" : idx === 1 ? "#a9b4c0" : idx === 2 ? "#b9763e" : "#2b3a49";
      ctx.fill();
      ctx.fillStyle = idx < 3 ? "#1a1206" : "#9fb3c8";
      ctx.font = `700 17px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(idx + 1), rx, ry + 1);
      drawEmoji(ctx, item.emoji, x + (cardW - 48) / 2, gy + 18, 48, imgs);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `600 22px ${FONT}`;
      ctx.fillStyle = TEXT;
      wrapText(ctx, item.product_name, cardW - 44).slice(0, 2).forEach((ln, li) => ctx.fillText(ln, x + cardW / 2, gy + 88 + li * 28));
      ctx.font = `700 28px ${FONT}`;
      ctx.fillStyle = item.daily_avg_cost > 0 ? "#ffd27d" : "#7ee2a8";
      ctx.fillText(`${formatNetCost(item.daily_avg_cost)}${t("share.per_day")}`, x + cardW / 2, gy + rowH - 32);
    });
  }
  drawFooter(ctx, t("share.by_app"), height - 44);
  return canvas;
}

// ── 年度消费报告海报 ────────────────────────────────────
export async function drawYearReport(items: OrderItem[], year: number, mods: ShareModules): Promise<HTMLCanvasElement> {
  const yearItems = items.filter((i) => i.order_time.startsWith(String(year)));
  const imgs = await loadEmojiImages(yearItems.slice(0, 40).map((i) => i.emoji));
  const logo = await loadImg(LOGO_URL);

  const total = sumTotal(yearItems);
  const now = new Date();
  const isCur = now.getFullYear() === year;
  const start = new Date(year, 0, 1);
  const end = isCur ? now : new Date(year + 1, 0, 1);
  const daily = total / Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const top3 = [...yearItems].sort((a, b) => b.total_price - a.total_price).slice(0, 3);
  const plats = aggregatePlatform(yearItems).slice(0, 4);
  const monthCounts = aggregateMonthlyCount(yearItems, 12).map((m) => ({ label: monthLabel(m.month), value: m.count }));

  // ── 动态高度（按所选模块堆叠；trend/expensive/plat/ranking 不适用年度报告）──
  const height = 200 + (mods.kpi ? 172 : 0) + (mods.recovered ? 240 : 0) + (mods.insight ? 500 : 0) + (mods.monthcount ? 324 : 0) + (mods.dist ? 430 : 0) + 60;
  const [canvas, ctx] = baseCanvas(height);
  drawBrand(ctx, logo, `${year} ${t("share.title_year")}`, t("share.gear_slogan"));

  let y = 200;
  // KPI 三卡
  if (mods.kpi) {
    drawStatCards(ctx, [
      { emoji: "💰", color: "#F0A050", colorEnd: "#FFCF8A", gold: true, label: t("share.year_expense"), value: shortMoney(total), unit: "" },
      { emoji: "📅", color: "#4A8EC0", colorEnd: "#7FB8E8", label: t("share.year_daily"), value: formatNetCost(daily), unit: t("share.per_day") },
      { emoji: "📋", color: "#5BA04B", colorEnd: "#7ED0A0", label: t("share.year_count"), value: `${yearItems.length}`, unit: t("share.items_unit") },
    ], y, imgs);
    y += 172;
  }
  // 已回收
  if (mods.recovered) {
    const { count: soldCount, value: recoveredTotal, rate: recoveredRate } = recoveredStats(yearItems, total);
    drawSection(ctx, 44, y, W - 88, 216);
    drawSectionTitle(ctx, t("share.recovered_title"), 70, y + 40);
    drawStatCards(ctx, [
      { emoji: "♻️", color: "#5BA04B", colorEnd: "#7ED0A0", label: t("share.recovered_count"), value: `${soldCount}`, unit: t("share.items_unit") },
      { emoji: "💰", color: "#F0A050", colorEnd: "#FFCF8A", gold: true, label: t("share.recovered_value"), value: shortMoney(recoveredTotal), unit: "" },
      { emoji: "📈", color: "#4A8EC0", colorEnd: "#7FB8E8", label: t("share.recovered_rate"), value: `${recoveredRate.toFixed(1)}`, unit: "%" },
    ], y + 52, imgs);
    y += 228;
  }
  // 最贵单品 Top3
  if (mods.insight) {
    drawSectionTitle(ctx, t("share.top_expensive"), PAD, y + 40);
    drawTop3Cards(ctx, top3, imgs, PAD, y, 100, W - PAD * 2);
    y += 500;
  }
  // 月度件数
  if (mods.monthcount && monthCounts.length > 0) {
    drawSection(ctx, 44, y, W - 88, 300);
    drawBarChart(ctx, monthCounts, t("share.month_count_title"), 74, y + 68, W - 148, 200, (v) => String(v), t("share.items_unit"));
    y += 324;
  }
  // 平台分布（横向条形）
  if (mods.dist) {
    drawSectionTitle(ctx, t("share.platform_dist"), PAD, y + 40);
    drawPlatBars(ctx, plats.map((p) => ({ label: platformLabel(p.platform), value: p.total })), y, 90, 100, PAD, 24, 26, 18, 9);
  }
  drawFooter(ctx, t("share.by_app"), height - 44);
  return canvas;
}

// ── 预览：直接渲染 canvas 作为预览（与保存图完全一致）──

// ── 弹窗 / 保存 ─────────────────────────────────────────

/** 按当前模块/标题实时重渲染预览：后台绘制新 canvas，完成后原位替换（不闪烁）；过期渲染自动丢弃 */
function rerenderShare(): void {
  if (!_sharePlan) return;
  _sharePlan.mods = readModules();
  const seq = ++_renderSeq;
  const wrap = document.getElementById("share-canvas-wrap")!;
  const btn = document.getElementById("share-download") as HTMLButtonElement;
  btn.disabled = true;
  _sharePlan.draw(_sharePlan.mods).then((c) => {
    if (!_sharePlan || seq !== _renderSeq) return;
    _shareCanvas = c;
    const old = wrap.querySelector("canvas");
    if (old) wrap.replaceChild(c, old);
    else wrap.appendChild(c);
    if (btn) btn.disabled = false;
  }).catch((e) => {
    if (seq !== _renderSeq) return;
    console.error("[Share] render failed:", e);
    if (btn) btn.disabled = false;
  });
}

export function initShare(): void {
  document.getElementById("btn-share")?.addEventListener("click", openGearWall);
  document.getElementById("btn-year-report")?.addEventListener("click", () => openYearReport(selectedYear()));
  document.getElementById("btn-share-gear")?.addEventListener("click", openGearWall);
  document.getElementById("btn-share-year")?.addEventListener("click", () => openYearReport(new Date().getFullYear()));
  document.getElementById("share-close")?.addEventListener("click", closeShareModal);
  document.getElementById("share-download")?.addEventListener("click", () => void downloadShare());
  // 模块开关变化 → 实时重渲染预览（与保存图完全一致）
  document.querySelectorAll<HTMLInputElement>("#share-modules-list input[data-mod]").forEach((el) => {
    el.addEventListener("change", rerenderShare);
  });
  // 自定义海报标题（资产墙）→ 保存偏好 + 防抖重渲染（停止输入后再重绘，避免逐字重建闪烁）
  const rerenderTitleDebounced = debounce(rerenderShare, 400);
  const titleInput = document.getElementById("share-title-input") as HTMLInputElement | null;
  titleInput?.addEventListener("input", () => {
    _customShareTitle = titleInput.value.trim();
    void savePref("share_title", _customShareTitle);
    const titleEl = document.getElementById("share-title");
    if (titleEl) titleEl.textContent = _customShareTitle || t("share.title_gear");
    rerenderTitleDebounced();
  });
  const overlay = document.getElementById("share-modal");
  overlay?.addEventListener("click", (e) => { if (e.target === overlay) closeShareModal(); });
}

/** 读取分析页时间范围选中的年份（未设置则用当前年） */
function selectedYear(): number {
  const sel = document.getElementById("range-start-month") as HTMLSelectElement | null;
  const m = sel?.value.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}

/** 打开资产墙：加载自定义标题，渲染 canvas 作为预览，保存时直接导出 */
async function openGearWall(): Promise<void> {
  const items = allItems;
  if (items.length === 0) { showToast(t("share.empty"), "info"); return; }
  const mods = readModules();
  _customShareTitle = await loadPref("share_title", "");
  const input = document.getElementById("share-title-input") as HTMLInputElement | null;
  if (input) input.value = _customShareTitle;
  void openShare(_customShareTitle || t("share.title_gear"), "日耗仓-资产墙.png", (m) => drawGearWall(items, m), mods);
}

/** 打开年度报告：渲染 canvas 作为预览，保存时直接导出 */
function openYearReport(year: number): void {
  const items = allItems;
  if (items.length === 0) { showToast(t("share.empty"), "info"); return; }
  const mods = readModules();
  void openShare(`${year} ${t("share.title_year")}`, `日耗仓-${year}-年度报告.png`, (m) => drawYearReport(items, year, m), mods);
}

async function openShare(title: string, filename: string, draw: (mods: ShareModules) => Promise<HTMLCanvasElement>, mods: ShareModules): Promise<void> {
  const overlay = document.getElementById("share-modal")!;
  const wrap = document.getElementById("share-canvas-wrap")!;
  const btn = document.getElementById("share-download") as HTMLButtonElement;
  document.getElementById("share-title")!.textContent = title;
  _sharePlan = { filename, draw, mods };
  _shareCanvas = null;
  btn.disabled = true;
  wrap.innerHTML = `<p class="share-loading">${t("share.generating")}…</p>`;
  overlay.classList.add("show");
  try {
    _shareCanvas = await draw(mods);
    wrap.innerHTML = "";
    wrap.appendChild(_shareCanvas);
    btn.disabled = false;
  } catch (e) {
    console.error("[Share] render failed:", e);
    wrap.innerHTML = `<p class="share-loading">${t("toast.operation_failed")}</p>`;
    btn.disabled = false;
  }
}

function closeShareModal(): void {
  document.getElementById("share-modal")!.classList.remove("show");
  _shareCanvas = null;
  _sharePlan = null;
}

/** 保存：按需生成 PNG（仅此时才渲染 canvas），再保存/下载 */
async function downloadShare(): Promise<void> {
  if (!_sharePlan) return;
  const btn = document.getElementById("share-download") as HTMLButtonElement;
  const span = btn.querySelector("span");
  btn.disabled = true;
  if (span) span.textContent = t("share.generating");
  try {
    if (!_shareCanvas) _shareCanvas = await _sharePlan.draw(_sharePlan.mods);
    if (await saveCanvas(_shareCanvas, _sharePlan.filename)) showToast(t("share.saved"), "success");
  } catch (e) {
    console.error("[Share] save failed:", e);
    showToast(t("toast.operation_failed"), "error");
  } finally {
    btn.disabled = false;
    if (span) span.textContent = t("share.download");
  }
}

async function saveCanvas(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return false;
  // Tauri：系统保存对话框 + 写入文件（dialog.save 由用户选择路径，无跨平台问题）
  if (isTauri()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({ defaultPath: filename, filters: [{ name: "PNG", extensions: ["png"] }] });
      if (!path) return false; // 用户取消
      await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
      return true;
    } catch (e) {
      console.warn("[Share] Tauri save failed, falling back to browser download:", e);
    }
  }
  // Web / 兜底：Blob 下载
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
