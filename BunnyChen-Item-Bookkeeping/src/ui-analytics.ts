// ── 数据分析页 ──────────────────────────────────────────
// 月度消费折线图 + 平台占比饼图 + 资产总览 KPI
// 颜色全部通过 CSS 变量读取，自动跟随亮/暗主题

import { Chart, registerables } from 'chart.js';
import { invoke } from '@tauri-apps/api/core';
import { aggregatePlatform, aggregateCategory, sumTotal, sumDaily, recoveredStats, monthlyTrend } from './aggregate';
import { isTauri, formatPrice, formatNetCost, platformLabel, categoryLabel, showToast, escapeHtml, debounce } from './utils';
import { platformColor, chartPalette, hexToRgba } from './theme';
import { renderEmoji } from './custom-emoji';
import { t } from './i18n';
import type { MonthlySpending, PlatformSummary, CategorySummary, OrderItem, WechatAnalytics, IncomeByType, IncomePeer, IncomeRecord, WechatMonthly } from './types';
import { browserDb } from './db';
import { onDataChange } from './data-events';
import { showItemModal } from './ui-modal';
import { fetchItems } from './data';

Chart.register(...registerables);

// ── 缓存 chart 实例以便销毁 ──────────────────────────────
let _monthlyChart: Chart | null = null;
let _platformChart: Chart | null = null;
let _categoryChart: Chart | null = null;
let _wechatMonthlyChart: Chart | null = null;
let _wechatTypeChart: Chart | null = null;

// ── 加载状态（避免每次切页都重建图表）──────────────────
let _analyticsLoaded = false; // 分析页是否已完成至少一次加载
let _analyticsDirty = true;   // 数据可能已变更，下次激活需重算

// ── 全局分析范围筛选状态（平台 + 时间跨度，作用于整个分析页）──
let _monthlyItems: OrderItem[] = [];          // 全量非归档物品（各区块数据源）
let _rangeMonths: string[] = [];              // 当前筛选下可用的月份（随平台动态同步，排序去重）
let _rangePlatform: string | null = null;     // 全局平台筛选（null=全部）
let _rangeStartMonth = 0;                     // 时间范围起（索引到 _rangeMonths）
let _rangeEndMonth = -1;                      // 时间范围止（-1=最后一个月）
let _monthlyMetric: 'spending' | 'count' = 'spending';
let _monthlyShowCumulative = false;           // 累计消费折线（月度图专用）

// ── 主题颜色工具 ──────────────────────────────────────────

/** 读取 CSS 变量值（从 :root / [data-theme] 继承） */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * 初始化分析页：绑定事件、首次加载数据、监听主题切换
 */
export function initAnalytics(): void {
  // 页面激活时加载数据（仅当尚未加载或数据已变更时，避免每次切页都重建图表）
  const page = document.getElementById('page-analytics')!;
  const pageObserver = new MutationObserver(() => {
    if (page.classList.contains('active') && (!_analyticsLoaded || _analyticsDirty)) {
      _analyticsDirty = false;
      loadAnalytics();
    }
  });
  pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] });

  // 主题（data-theme）变化时重绘，确保深浅模式切换即时生效
  const themeObserver = new MutationObserver(() => {
    if (page.classList.contains('active')) {
      loadAnalytics();
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // 系统配色方案变化（跟随系统模式下自动切换）
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (page.classList.contains('active')) {
      loadAnalytics();
    }
  });

  // 窗口大小变化时重绘图表
  window.addEventListener('resize', debounce(() => {
    if (page.classList.contains('active')) {
      loadAnalytics();
    }
  }, 300));

  // ── 注册数据变更监听：数据变更后若当前在分析页则自动重算 ──
  onDataChange(() => {
    _analyticsDirty = true;
    if (page.classList.contains('active')) {
      loadAnalytics();
    }
  });
}

/**
 * 加载所有分析数据并渲染
 */
let _analyticsLoadSeq = 0; // 加载序号：批量导入多次触发时，过期的 loadAnalytics 不再渲染，防止图表竞态

async function loadAnalytics(): Promise<void> {
  const seq = ++_analyticsLoadSeq;
  try {
    // 拉取全量非归档物品（桌面/浏览器统一数据源）
    const items = await fetchItems();
    if (seq !== _analyticsLoadSeq) return;
    _monthlyItems = items;

    // 平台筛选若已无对应数据则重置为「全部」
    if (_rangePlatform && !items.some(i => i.platform === _rangePlatform)) {
      _rangePlatform = null;
    }

    // 月份列表 = 当前平台筛选下有数据的月份（时间最大跨度随筛选动态同步）
    _rangeMonths = buildRangeMonths();
    if (_rangeStartMonth >= _rangeMonths.length) _rangeStartMonth = Math.max(0, _rangeMonths.length - 1);
    if (_rangeEndMonth >= _rangeMonths.length) _rangeEndMonth = _rangeMonths.length - 1;
    if (_rangeEndMonth !== -1 && _rangeEndMonth < _rangeStartMonth) _rangeEndMonth = _rangeStartMonth;

    // 渲染全部区块（KPI/洞察/分布/对比/微信收支/月度图）+ 构建全局控件
    await renderAllFromState(seq);
    buildRangeControls();
    renderMonthlyControls();
    _analyticsLoaded = true;
  } catch (e) {
    console.error('[Analytics] 加载失败:', e);
    showToast(`❌ ${t('analytics.load_error')}`, 'error');
  }
}

/**
 * 基于当前全局筛选状态渲染分析页全部区块（数据源 _monthlyItems）
 * 平台/时间/分类分布、KPI 均在前端基于过滤后的物品计算，桌面/浏览器行为一致
 */
async function renderAllFromState(seq: number): Promise<void> {
  if (seq !== _analyticsLoadSeq) return;
  const filtered = filterItemsByRange(_monthlyItems);

  // KPI / 洞察（前端计算）
  renderKPIsFromItems(filtered);
  renderInsights(filtered);

  // 平台 / 分类分布 + 平台对比
  const platform = aggregatePlatform(filtered);
  const category = aggregateCategory(filtered);
  renderPlatformChart(platform);
  renderCategoryChart(category);
  renderPlatformCompare(filtered, platform);

  // 微信收支：仅当平台筛选为「全部」或「微信」时显示（与当前筛选维度一致），
  // 否则传空数据使其隐藏——避免看京东时还出现微信数据造成困惑
  let wechat: WechatAnalytics;
  if (!_rangePlatform || _rangePlatform === 'wx') {
    const rangeStart = _rangeMonths[_rangeStartMonth];
    const rangeEnd = _rangeMonths[_rangeEndMonth === -1 ? _rangeMonths.length - 1 : _rangeEndMonth];
    wechat = isTauri()
      ? await invoke<WechatAnalytics>('get_wechat_analytics', { start: rangeStart, end: rangeEnd })
      : browserDb.getWechatAnalytics(rangeStart, rangeEnd);
  } else {
    wechat = { overview: { expense_total: 0, income_total: 0, net_total: 0 }, by_type: [], peers: [], monthly: [] };
  }
  if (seq !== _analyticsLoadSeq) return;
  renderWechatSection(wechat);

  // 月度消费图
  renderFilteredMonthlyChart();
}

/** 计算当前筛选下可用的月份列表（平台=全部用全量；否则收敛到该平台数据跨度） */
function buildRangeMonths(): string[] {
  const items = _rangePlatform
    ? _monthlyItems.filter(i => i.platform === _rangePlatform)
    : _monthlyItems;
  const set = new Set<string>();
  for (const item of items) {
    const m = item.order_time.substring(0, 7);
    if (m) set.add(m);
  }
  return [...set].sort();
}

/** 按全局平台 + 时间范围过滤物品（YYYY-MM 字符串字典序比较） */
function filterItemsByRange(list: OrderItem[]): OrderItem[] {
  if (_rangePlatform) list = list.filter(i => i.platform === _rangePlatform);
  const months = _rangeMonths;
  if (months.length === 0) return list;
  const startM = months[_rangeStartMonth];
  const endM = months[_rangeEndMonth === -1 ? months.length - 1 : _rangeEndMonth];
  if (!startM || !endM) return list;
  return list.filter(i => {
    const m = i.order_time.substring(0, 7);
    return m >= startM && m <= endM;
  });
}

/** 决策洞察：最高日均 / 主要平台 / 月度趋势 */
function renderInsights(items: OrderItem[]): void {
  const el = document.getElementById('analytics-insights');
  if (!el) return;
  if (items.length === 0) { el.innerHTML = ''; return; }

  const highestDaily = items.reduce((highest, item) =>
    item.daily_avg_cost > highest.daily_avg_cost ? item : highest,
  items[0]);
  const topPlatform = aggregatePlatform(items)[0];
  const { latestMonth, latestTotal, trend } = monthlyTrend(items);

  el.innerHTML = `
    <div class="insight-card">
      <span class="insight-label">${t('analytics.insight_daily_label')}</span>
      <strong>${escapeHtml(highestDaily.product_name)}</strong>
      <span>${t('analytics.insight_daily_value', { value: formatNetCost(highestDaily.daily_avg_cost) })}</span>
    </div>
    <div class="insight-card">
      <span class="insight-label">${t('analytics.insight_platform_label')}</span>
      <strong>${escapeHtml(platformLabel(topPlatform.platform))}</strong>
      <span>${t('analytics.insight_platform_value', { value: formatPrice(topPlatform.total) })}</span>
    </div>
    <div class="insight-card">
      <span class="insight-label">${t('analytics.insight_trend_label')}</span>
      <strong>${latestMonth || '—'}</strong>
      <span>${trend === null ? t('analytics.insight_trend_first', { value: formatPrice(latestTotal) }) : t(trend > 0 ? 'analytics.insight_trend_up' : 'analytics.insight_trend_down', { value: Math.abs(trend) })}</span>
    </div>`;
}

// ── KPI 卡片 ────────────────────────────────────────────

/** KPI 卡片（基于过滤后的物品前端计算，桌面/浏览器统一；总价/日均/件数/已回收） */
function renderKPIsFromItems(items: OrderItem[]): void {
  const el = document.getElementById('analytics-kpi');
  if (!el) return;

  const totalValue = sumTotal(items);
  const recovered = recoveredStats(items, totalValue).value;
  const dailyBurn = sumDaily(items);

  el.innerHTML = `
    <div class="kpi-card">
      <span class="kpi-label">${t('analytics.total_value')}</span>
      <span class="kpi-value">${formatPrice(totalValue)}</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">${t('analytics.daily_burn')}</span>
      <span class="kpi-value">${formatPrice(dailyBurn)}<span class="kpi-unit">/天</span></span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">${t('analytics.active_items')}</span>
      <span class="kpi-value">${items.length}<span class="kpi-unit"> 件</span></span>
    </div>
    <div class="kpi-card kpi-card-secondary">
      <span class="kpi-label">${t('analytics.total_recovered')}</span>
      <span class="kpi-value">${formatPrice(recovered)}</span>
    </div>
  `;
}

// ── 月度图表筛选控件 ────────────────────────────────────

/** 构建全局分析范围控件（平台 + 起止月份 + 重置 + 跨度提示），事件只绑定一次 */
function buildRangeControls(): void {
  const platSel = document.getElementById('range-platform') as HTMLSelectElement;
  const startSel = document.getElementById('range-start-month') as HTMLSelectElement;
  const endSel = document.getElementById('range-end-month') as HTMLSelectElement;
  const resetBtn = document.getElementById('range-reset') as HTMLButtonElement;
  if (!platSel || !startSel || !endSel) return;

  // 平台下拉按显示名排序（平台名统一走 platformLabel，如 wx→微信）
  const platforms = [...new Set(_monthlyItems.map(i => i.platform))]
    .sort((a, b) => platformLabel(a).localeCompare(platformLabel(b)));
  platSel.innerHTML = `<option value="__all__">${t('analytics.monthly_filter_all')}</option>`
    + platforms.map(p => `<option value="${p}">${platformLabel(p)}</option>`).join('');

  const fillMonths = (): void => {
    const months = _rangeMonths;
    const end = _rangeEndMonth === -1 ? months.length - 1 : _rangeEndMonth;
    startSel.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    endSel.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    platSel.value = _rangePlatform ?? '__all__';
    startSel.value = String(Math.min(_rangeStartMonth, Math.max(0, months.length - 1)));
    endSel.value = String(end);
  };
  const syncHint = (): void => {
    const hintEl = document.getElementById('range-hint') as HTMLSpanElement | null;
    const months = _rangeMonths;
    if (!hintEl) return;
    if (months.length === 0) { hintEl.textContent = ''; return; }
    const start = Math.min(_rangeStartMonth, months.length - 1);
    const end = _rangeEndMonth === -1 ? months.length - 1 : _rangeEndMonth;
    hintEl.textContent = `${months[start]} ~ ${months[end]} · ${end - start + 1} ${t('analytics.range_months_unit')}`;
  };
  const syncAndRender = (): void => {
    fillMonths();
    syncHint();
    // renderAllFromState 内部已含 renderFilteredMonthlyChart，此处不再重复调用
    void renderAllFromState(_analyticsLoadSeq);
  };

  fillMonths();
  syncHint();

  platSel.onchange = () => {
    _rangePlatform = platSel.value === '__all__' ? null : platSel.value;
    // 时间最大跨度随平台动态同步：重建可用月份并重置为该平台完整跨度
    _rangeMonths = buildRangeMonths();
    _rangeStartMonth = 0;
    _rangeEndMonth = -1;
    syncAndRender();
  };
  startSel.onchange = () => {
    _rangeStartMonth = parseInt(startSel.value);
    const end = _rangeEndMonth === -1 ? _rangeMonths.length - 1 : _rangeEndMonth;
    if (_rangeStartMonth > end) _rangeEndMonth = _rangeStartMonth;
    syncAndRender();
  };
  endSel.onchange = () => {
    _rangeEndMonth = parseInt(endSel.value);
    if (_rangeStartMonth > _rangeEndMonth) _rangeStartMonth = _rangeEndMonth;
    syncAndRender();
  };
  if (resetBtn) resetBtn.onclick = () => {
    _rangePlatform = null;
    _rangeMonths = buildRangeMonths();
    _rangeStartMonth = 0;
    _rangeEndMonth = -1;
    syncAndRender();
  };
}

/** 月度图表控件（指标切换 + 累计开关；平台与时间范围已提升为全局筛选） */
function renderMonthlyControls(): void {
  const metricSel = document.getElementById('monthly-metric') as HTMLSelectElement;
  if (!metricSel) return;

  metricSel.innerHTML =
    `<option value="spending">${t('analytics.monthly_spending')}</option>` +
    `<option value="count">${t('analytics.monthly_count')}</option>`;
  metricSel.value = _monthlyMetric;
  metricSel.onchange = () => {
    _monthlyMetric = metricSel.value as 'spending' | 'count';
    renderFilteredMonthlyChart();
  };

  // 累计消费切换
  const cumulCb = document.getElementById('monthly-cumulative') as HTMLInputElement;
  if (cumulCb) {
    cumulCb.checked = _monthlyShowCumulative;
    cumulCb.onchange = () => {
      _monthlyShowCumulative = cumulCb.checked;
      renderFilteredMonthlyChart();
    };
  }
}

/** 根据当前全局筛选状态重新计算并渲染月度图表 */
function renderFilteredMonthlyChart(): void {
  // 1. 平台 + 时间范围过滤
  const filtered = filterItemsByRange(_monthlyItems);

  // 2. 按月份聚合
  const monthlyMap = new Map<string, { total: number; count: number }>();
  for (const item of filtered) {
    const month = item.order_time.substring(0, 7);
    const entry = monthlyMap.get(month) || { total: 0, count: 0 };
    entry.total += item.total_price;
    entry.count += 1;
    monthlyMap.set(month, entry);
  }

  // 3. 按时间范围构造连续月份轴
  const months = _rangeMonths;
  const start = _rangeStartMonth;
  const end = _rangeEndMonth === -1 ? months.length - 1 : _rangeEndMonth;
  const monthly: MonthlySpending[] = [];
  for (let i = start; i <= end && i < months.length; i++) {
    const m = months[i];
    const d = monthlyMap.get(m);
    monthly.push({ month: m, total: d?.total ?? 0, count: d?.count ?? 0 });
  }

  renderMonthlyChart(monthly);
}

// ── 月度消费图表 ───────────────────────────────────────

function renderMonthlyChart(data: MonthlySpending[]): void {
  const canvas = prepareChartCanvas('chart-monthly-wrap', 'chart-monthly');
  if (!canvas) return;

  if (_monthlyChart) { _monthlyChart.destroy(); _monthlyChart = null; }

  if (data.length === 0) {
    renderEmptyChart('chart-monthly-wrap', t('analytics.no_monthly_data'));
    return;
  }

  const isCount = _monthlyMetric === 'count';
  const values = data.map(d => isCount ? d.count : d.total);
  const labels = data.map(d => d.month);
  const maxVal = Math.max(...values);

  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  // 值越高颜色越饱和（alpha 0.25 → 0.95），峰值用暖橙高亮
  const color = cssVar(isCount ? '--chart-5' : '--chart-0');
  const accent = cssVar('--chart-1');
  const textSecondary = cssVar('--text-secondary');
  const borderColor = cssVar('--border');

  const barColors = values.map(v =>
    v === maxVal ? accent : hexToRgba(color, 0.25 + ((v - minVal) / range) * 0.70)
  );

  // 数据集：柱状图 + 可选的累计折线
  const datasets: any[] = [{
    type: 'bar',
    label: isCount ? t('analytics.monthly_count') : t('analytics.monthly_spending'),
    data: values,
    backgroundColor: barColors,
    borderColor: barColors,
    borderWidth: 1,
    borderRadius: 4,
    borderSkipped: false,
    order: 1,
  }];

  if (_monthlyShowCumulative && !isCount) {
    const cumul: number[] = [];
    let running = 0;
    for (const v of values) { running += v; cumul.push(Math.round(running * 100) / 100); }
    const cumulColor = cssVar('--chart-1');
    datasets.push({
      type: 'line',
      label: '累计',
      data: cumul,
      borderColor: cumulColor,
      backgroundColor: hexToRgba(cumulColor, 0.08),
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.3,
      fill: true,
      order: 0,
      yAxisID: 'y1',
    });
  }

  const scales: any = {
    x: {
      ticks: { color: textSecondary, maxTicksLimit: 12 },
      grid: { display: false },
    },
    y: {
      ticks: {
        color: textSecondary,
        callback: (v: any) => isCount ? String(Number(v).toFixed(0)) : formatPrice(Number(v)),
      },
      grid: { color: hexToRgba(borderColor, 0.35) },
      beginAtZero: true,
    },
  };

  if (_monthlyShowCumulative && !isCount) {
    scales.y1 = {
      position: 'right',
      ticks: {
        color: cssVar('--chart-1'),
        callback: (v: any) => formatPrice(Number(v)),
      },
      grid: { display: false },
    };
  }

  _monthlyChart = new Chart(canvas, {
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.type === 'line')
                return '累计: ' + formatPrice(ctx.parsed.y ?? 0);
              return isCount
                ? t('analytics.monthly_count') + ': ' + ctx.parsed.y + ' ' + t('analytics.count_unit')
                : t('analytics.monthly_spending') + ': ' + formatPrice(ctx.parsed.y ?? 0);
            },
          },
        },
      },
      onClick: (_e, active) => {
        if (active.length > 0) {
          const idx = active[0].index;
          showMonthlyDrilldown(labels[idx]);
        }
      },
      onHover: (_e, active) => {
        canvas.style.cursor = active.length > 0 ? 'pointer' : 'default';
      },
      scales,
    },
  });
}

// ── 柱状图下钻：点击查看当月商品 ──────────────────────

function showMonthlyDrilldown(month: string): void {
  const panel = document.getElementById('monthly-drilldown')!;
  const titleEl = document.getElementById('drilldown-title')!;
  const itemsEl = document.getElementById('drilldown-items')!;
  if (!panel || !titleEl || !itemsEl) return;

  // 按全局平台过滤 + 月份过滤
  const filtered = _rangePlatform
    ? _monthlyItems.filter(i => i.platform === _rangePlatform && i.order_time.startsWith(month))
    : _monthlyItems.filter(i => i.order_time.startsWith(month));

  if (filtered.length === 0) {
    panel.style.display = 'none';
    return;
  }

  // 按总价从高到低排列（下钻列表便于浏览高价物品）
  filtered.sort((a, b) => b.total_price - a.total_price);

  const total = filtered.reduce((s, i) => s + i.total_price, 0);
  titleEl.textContent = `${month} — ${filtered.length} ${t('analytics.count_unit')} ${formatPrice(total)}`;

  itemsEl.innerHTML = filtered.map(item => {
    const pc = platformColor(item.platform);
    return `<div class="drilldown-item" data-id="${item.id}">
      <span class="drilldown-emoji">${renderEmoji(item.emoji)}</span>
      <span class="drilldown-name">${escapeHtml(item.product_name)}</span>
      <span class="tag tag-platform" style="background:${pc.bg};color:${pc.fg};font-size:10px">${platformLabel(item.platform)}</span>
      <span class="drilldown-price">${formatPrice(item.total_price)}</span>
      <span class="drilldown-daily">${formatNetCost(item.daily_avg_cost)}<span class="cost-unit">/天</span></span>
    </div>`;
  }).join('');

  panel.style.display = 'block';

  // 绑定点击事件 — 打开详情弹窗
  itemsEl.querySelectorAll('.drilldown-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt((el as HTMLElement).dataset.id!);
      const item = _monthlyItems.find(i => i.id === id);
      if (item) {
        showItemModal(item);
      }
    });
  });

  // 关闭按钮
  const closeBtn = document.getElementById('drilldown-close');
  if (closeBtn) closeBtn.onclick = () => { panel.style.display = 'none'; };
}

// ── 平台 & 分类饼图（label 统一走 i18n categoryLabel） ──

/** 渲染可点击 HTML 图例，点击切换对应扇区显隐 */
function renderDonutLegend(
  elId: string, chart: Chart | null,
  labels: string[], palette: string[], total: number, values: number[],
): void {
  const el = document.getElementById(elId);
  if (!el || !chart) return;
  const meta = chart.getDatasetMeta(0);
  el.innerHTML = labels.map((label, i) => {
    const pct = ((values[i] / total) * 100).toFixed(1);
    const hidden = (meta.data[i] as any)?.hidden ? ' legend-hidden' : '';
    return `<span class="chart-donut-legend-item${hidden}" data-index="${i}">
      <span class="chart-donut-legend-dot" style="background:${palette[i % palette.length]}"></span>
      ${label} ${pct}%
    </span>`;
  }).join('');

  el.onclick = (e) => {
    const item = (e.target as HTMLElement).closest('.chart-donut-legend-item') as HTMLElement;
    if (!item) return;
    const idx = parseInt(item.dataset.index!);
    const meta2 = chart.getDatasetMeta(0);
    const d = meta2.data[idx] as any;
    d.hidden = !d.hidden;
    chart.update();
    item.classList.toggle('legend-hidden');
  };
}

/** 过滤占比 <0.05%（显示为 0.0%）的微小扇区，保持环形图与图例干净 */
function filterTinySlices<T extends { total: number }>(data: T[]): T[] {
  const total = data.reduce((s, d) => s + d.total, 0);
  if (total <= 0) return [];
  return data.filter(d => d.total / total >= 0.0005);
}

/** 统一渲染环形图 + HTML 图例（平台/分类/微信回款结构三处共用） */
function renderDonutChart(
  canvasId: string,
  wrapId: string,
  legendId: string,
  labels: string[],
  values: number[],
  emptyMsg: string,
  hoverVar: string,                                                              // '--chart-2' | '--chart-3'
  tooltipLabel: (label: string, value: number, pct: string) => string,
): Chart | null {
  const canvas = prepareChartCanvas(wrapId, canvasId);
  if (!canvas) return null;
  if (values.length === 0) {
    renderEmptyChart(wrapId, emptyMsg);
    return null;
  }
  const palette = chartPalette(values.length);
  const bgCard = cssVar('--bg-card');
  const total = values.reduce((s, v) => s + v, 0);
  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: palette,
        borderColor: bgCard,
        borderWidth: 3,
        hoverBorderColor: cssVar(hoverVar),
        hoverBorderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => tooltipLabel(labels[ctx.dataIndex], values[ctx.dataIndex], ((values[ctx.dataIndex] / total) * 100).toFixed(1)),
          },
        },
      },
    },
  });
  renderDonutLegend(legendId, chart, labels, palette, total, values);
  return chart;
}

function renderPlatformChart(data: PlatformSummary[]): void {
  if (_platformChart) { _platformChart.destroy(); _platformChart = null; }
  // 过滤显示为 0.0% 的微小扇区；平台名统一走 platformLabel（wx→微信）
  const filtered = filterTinySlices(data);
  _platformChart = renderDonutChart(
    'chart-platform', 'chart-platform-wrap', 'platform-legend',
    filtered.map(d => platformLabel(d.platform)),
    filtered.map(d => d.total),
    t('analytics.no_platform_data'),
    '--chart-2',
    (_label, value, pct) => `${formatPrice(value)} (${pct}%)`,
  );
}

// ── 分类消费饼图 ─────────────────────────────────────────

function renderCategoryChart(data: CategorySummary[]): void {
  if (_categoryChart) { _categoryChart.destroy(); _categoryChart = null; }
  // 过滤显示为 0.0% 的微小分类扇区
  const filtered = filterTinySlices(data);
  _categoryChart = renderDonutChart(
    'chart-category', 'chart-category-wrap', 'category-legend',
    filtered.map(d => categoryLabel(d.category) || d.category),
    filtered.map(d => d.total),
    t('analytics.no_category_data'),
    '--chart-3',
    (_label, value, pct) => `${formatPrice(value)} (${pct}%)`,
  );
}

// ── 微信收支区块 ────────────────────────────────────────

/** 渲染「微信收支」区块：KPI + 月度支出/回款/净支出图 + 回款结构 + 来源 Top 榜 */
function renderWechatSection(data: WechatAnalytics): void {
  const section = document.getElementById('wechat-section');
  if (!section) return;

  // 无任何微信数据时隐藏整个区块
  if (data.overview.expense_total === 0 && data.overview.income_total === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  // KPI 迷你卡片：微信支出 / 微信回款 / 微信净支出 / 回款率
  const kpiEl = document.getElementById('wechat-kpi');
  if (kpiEl) {
    const incomeCount = data.by_type.reduce((s, t) => s + t.count, 0);
    const rate = data.overview.expense_total > 0
      ? ((data.overview.income_total / data.overview.expense_total) * 100).toFixed(1)
      : '0.0';
    kpiEl.innerHTML = `
      <div class="wechat-kpi-card">
        <span class="kpi-label">${t('analytics.wechat_expense')}</span>
        <span class="kpi-value">${formatPrice(data.overview.expense_total)}</span>
      </div>
      <div class="wechat-kpi-card">
        <span class="kpi-label">${t('analytics.wechat_income')}</span>
        <span class="kpi-value">${formatPrice(data.overview.income_total)}<span class="kpi-unit"> ${t('analytics.income_unit', { count: incomeCount })}</span></span>
      </div>
      <div class="wechat-kpi-card">
        <span class="kpi-label">${t('analytics.wechat_net')}</span>
        <span class="kpi-value">${formatPrice(data.overview.net_total)}</span>
      </div>
      <div class="wechat-kpi-card wechat-kpi-secondary">
        <span class="kpi-label">${t('analytics.wechat_refund_rate')}</span>
        <span class="kpi-value">${rate}<span class="kpi-unit">%</span></span>
      </div>`;
  }

  renderWechatMonthlyChart(data.monthly);
  renderWechatTypeChart(data.by_type);
  renderWechatPeers(data.peers);
}

/** 微信月度图表：支出/回款双柱 + 净支出折线 */
function renderWechatMonthlyChart(data: WechatMonthly[]): void {
  const canvas = prepareChartCanvas('chart-wechat-monthly-wrap', 'chart-wechat-monthly');
  if (!canvas) return;
  if (_wechatMonthlyChart) { _wechatMonthlyChart.destroy(); _wechatMonthlyChart = null; }

  const wrap = document.getElementById('chart-wechat-monthly-wrap');
  if (data.length === 0) {
    if (wrap) wrap.innerHTML = `<div class="chart-empty">📊<p>${t('analytics.no_monthly_data')}</p></div>`;
    return;
  }

  const labels = data.map(d => d.month);
  const expenseColor = cssVar('--chart-0');
  const incomeColor = cssVar('--chart-1');
  const netColor = cssVar('--chart-2');
  const textSecondary = cssVar('--text-secondary');
  const borderColor = cssVar('--border');

  _wechatMonthlyChart = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: t('analytics.wechat_expense'),
          data: data.map(d => d.expense),
          backgroundColor: hexToRgba(expenseColor, 0.75),
          borderColor: expenseColor,
          borderWidth: 1,
          borderRadius: 4,
          order: 2,
        },
        {
          type: 'bar',
          label: t('analytics.wechat_income'),
          data: data.map(d => d.income),
          backgroundColor: hexToRgba(incomeColor, 0.55),
          borderColor: incomeColor,
          borderWidth: 1,
          borderRadius: 4,
          order: 2,
        },
        {
          type: 'line',
          label: t('analytics.wechat_net'),
          data: data.map(d => d.net),
          borderColor: netColor,
          backgroundColor: hexToRgba(netColor, 0.08),
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: false,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: textSecondary, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: textSecondary, maxTicksLimit: 12 }, grid: { display: false } },
        y: {
          ticks: { color: textSecondary, callback: (v: any) => formatPrice(Number(v)) },
          grid: { color: hexToRgba(borderColor, 0.35) },
          beginAtZero: true,
        },
      },
    },
  });
}

/** 微信回款结构环形图：按交易类型（退款/转账/红包/收款等） */
function renderWechatTypeChart(data: IncomeByType[]): void {
  if (_wechatTypeChart) { _wechatTypeChart.destroy(); _wechatTypeChart = null; }

  // 只保留金额 > 0 的类型；超出前 5 项聚合为「其他」，保持环形图与图例紧凑
  const positive = data.filter(d => d.total > 0);
  let display = positive.slice(0, 5);
  const rest = positive.slice(5);
  if (rest.length > 0) {
    display = display.concat([{
      income_type: t('analytics.wechat_other'),
      total: rest.reduce((s, x) => s + x.total, 0),
      count: rest.reduce((s, x) => s + x.count, 0),
    }]);
  }
  // 尾部聚合后若占比仍 <0.05%（显示 0.0%）则直接丢弃，避免图例出现 0.0% 项
  display = filterTinySlices(display);
  _wechatTypeChart = renderDonutChart(
    'chart-wechat-type', 'chart-wechat-type-wrap', 'wechat-type-legend',
    display.map(d => d.income_type),
    display.map(d => d.total),
    t('analytics.no_category_data'),
    '--chart-3',
    (label, value, pct) => `${label}: ${formatPrice(value)} (${pct}%)`,
  );
}

/** 微信回款来源 Top 10 榜：按金额降序；点击行展开下钻面板查看该来源的流水细节 */
const PEER_DEFAULT_LIMIT = 10;

function renderWechatPeers(data: IncomePeer[]): void {
  const el = document.getElementById('wechat-peers');
  if (!el) return;
  if (data.length === 0) {
    el.innerHTML = '';
    return;
  }

  const visible = data.slice(0, PEER_DEFAULT_LIMIT);
  const max = data[0]?.total || 1;

  el.innerHTML = `
    <h3 class="chart-subtitle">${t('analytics.wechat_peers_title')}</h3>
    <div class="wechat-peer-list">
      ${visible.map((d, i) => `
        <div class="wechat-peer-row wechat-peer-clickable" data-peer="${escapeHtml(d.peer)}">
          <span class="wechat-peer-rank${i < 3 ? ' top3' : ''}">${i + 1}</span>
          <span class="wechat-peer-name">${escapeHtml(d.peer)}</span>
          <span class="wechat-peer-bar-wrap"><span class="wechat-peer-bar" style="width:${((d.total / max) * 100).toFixed(1)}%"></span></span>
          <span class="wechat-peer-amount">${formatPrice(d.total)}<span class="kpi-unit"> ${t('analytics.income_unit', { count: d.count })}</span></span>
          <span class="wechat-peer-chevron">›</span>
        </div>`).join('')}
    </div>`;

  // 点击行 → 展开/收起该来源的完整回款流水（手风琴式，再点即收起）
  el.querySelectorAll('.wechat-peer-clickable').forEach((row) => {
    row.addEventListener('click', () => {
      const el = row as HTMLElement;
      // 已展开 → 收起
      if (el.classList.contains('wechat-peer-active')) {
        closeWechatPeerDrilldown();
        return;
      }
      const peer = el.dataset.peer || '';
      const item = visible.find(p => p.peer === peer);
      if (item) openWechatPeerDrilldown(el, item);
    });
  });
}

/** 关闭已展开的回款来源下钻面板 */
function closeWechatPeerDrilldown(): void {
  document.querySelectorAll('.wechat-peer-drilldown').forEach(el => el.remove());
  document.querySelectorAll('.wechat-peer-clickable.wechat-peer-active').forEach(el => el.classList.remove('wechat-peer-active'));
}

/** 在点击行下方展开下钻面板：展示该交易对方的全部收入流水（手风琴式，类似月度柱状图下钻） */
async function openWechatPeerDrilldown(row: HTMLElement, peer: IncomePeer): Promise<void> {
  // 只保留一个展开面板：先关闭其他行
  closeWechatPeerDrilldown();

  // 面板直接插入到点击行之后（行内展开）
  const panel = document.createElement('div');
  panel.className = 'monthly-drilldown wechat-peer-drilldown';
  panel.innerHTML = `
    <div class="drilldown-header">
      <span class="drilldown-title">${escapeHtml(peer.peer)} — ${peer.count} ${t('analytics.count_unit')} ${formatPrice(peer.total)}</span>
    </div>
    <div class="drilldown-items"></div>`;
  row.insertAdjacentElement('afterend', panel);
  row.classList.add('wechat-peer-active');

  const itemsEl = panel.querySelector('.drilldown-items') as HTMLElement;
  itemsEl.innerHTML = `<div class="drilldown-empty">⏳ …</div>`;

  let records: IncomeRecord[];
  try {
    records = isTauri()
      ? await invoke<IncomeRecord[]>('get_income_records_by_peer', { peer: peer.peer })
      : browserDb.getIncomeRecordsByPeer(peer.peer);
  } catch {
    records = [];
  }

  // 加载期间用户可能已切换/关闭面板，面板被移除则丢弃本次结果
  if (!panel.isConnected) return;

  if (records.length === 0) {
    itemsEl.innerHTML = `<div class="drilldown-empty">—</div>`;
  } else {
    itemsEl.innerHTML = records.map(r => `
      <div class="drilldown-item">
        <span class="drilldown-emoji">${incomeTypeEmoji(r.income_type)}</span>
        <span class="drilldown-name">${escapeHtml(r.income_type || '—')}${r.status ? ` · ${escapeHtml(r.status)}` : ''}</span>
        <span class="drilldown-price">${formatPrice(r.amount)}</span>
        <span class="drilldown-daily">${r.order_time ? r.order_time.slice(0, 16) : '—'}</span>
      </div>`).join('');
  }
}

/** 按收入类型返回对应 emoji（下钻列表展示） */
function incomeTypeEmoji(type: string): string {
  if (type.includes('退款')) return '↩️';
  if (type.includes('群收款')) return '👥';
  if (type.includes('红包')) return '🧧';
  if (type.includes('转账')) return '🔁';
  if (type.includes('收款')) return '📥';
  return '💸';
}

// ── 平台价值对比 ────────────────────────────────────────

function renderPlatformCompare(items: OrderItem[], platformData: PlatformSummary[]): void {
  const section = document.getElementById('platform-compare-section');
  const grid = document.getElementById('platform-compare-grid');
  if (!section || !grid || platformData.length === 0) return;

  section.style.display = 'block';

  // 按平台聚合日均成本
  const dailyMap = new Map<string, number>();
  for (const item of items) {
    dailyMap.set(item.platform, (dailyMap.get(item.platform) || 0) + item.daily_avg_cost);
  }

  grid.innerHTML = platformData.map((p) => {
    const pc = platformColor(p.platform);
    const avgPrice = p.total / p.count;
    const daily = dailyMap.get(p.platform) || 0;
    const avgDaily = p.count > 0 ? daily / p.count : 0;
    return '<div class="compare-card">' +
      '<span class="compare-platform" style="color:' + pc.fg + '">' +
      platformLabel(p.platform) + '</span>' +
      '<div class="compare-stats">' +
      '<div class="compare-stat"><span class="compare-num">' + p.count + '</span><span class="compare-label">' + t('analytics.compare_items') + '</span></div>' +
      '<div class="compare-stat"><span class="compare-num">' + formatPrice(p.total) + '</span><span class="compare-label">' + t('analytics.compare_total') + '</span></div>' +
      '<div class="compare-stat"><span class="compare-num">' + formatPrice(avgPrice) + '</span><span class="compare-label">' + t('analytics.compare_avg_price') + '</span></div>' +
      '<div class="compare-stat"><span class="compare-num">' + formatNetCost(avgDaily) + '</span><span class="compare-label">' + t('analytics.compare_daily_per') + '</span></div>' +
      '</div>' +
      '</div>';
  }).join('');
}

// ── 空图表占位 ──────────────────────────────────────────

/** 图表渲染前准备：恢复 canvas 显示、清理空态占位（canvas 元素始终保留，数据恢复后可重建图表） */
function prepareChartCanvas(wrapId: string, canvasId: string): HTMLCanvasElement | null {
  const wrap = document.getElementById(wrapId);
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return null;
  if (canvas.style.display === 'none') canvas.style.display = '';
  wrap?.querySelectorAll('.chart-empty').forEach(el => el.remove());
  return canvas;
}

function renderEmptyChart(wrapId: string, message: string): void {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  // 只隐藏 canvas 并追加占位，绝不替换掉 canvas 元素——
  // 否则数据恢复后 getElementById(canvas) 为 null，图表永远无法重建（必须刷新页面才恢复）
  const canvas = wrap.querySelector('canvas');
  if (canvas) canvas.style.display = 'none';
  wrap.querySelectorAll('.chart-empty').forEach(el => el.remove());
  wrap.insertAdjacentHTML('beforeend', `<div class="chart-empty">📊<p>${message}</p></div>`);
}

// ── 工具函数 ────────────────────────────────────────────
