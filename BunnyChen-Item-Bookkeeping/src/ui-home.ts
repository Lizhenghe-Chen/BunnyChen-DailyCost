// ── 主页：物品卡片网格 & 筛选排序 ──────────────────────────

import { invoke } from "@tauri-apps/api/core";
import type { OrderItem } from "./types";
import { browserDb } from "./db";
import { isTauri, formatPrice, formatNetCost, platformLabel, categoryLabel, showToast, showConfirm, escapeHtml, debounce } from "./utils";
import { platformColor, PLATFORM_PALETTE } from "./theme";
import { savePref, loadPref, SETTINGS_CACHE } from "./prefs";
import { showItemModal, showAddItemModal } from "./ui-modal";
import { fetchItems } from "./data";
import { t } from "./i18n";
import { renderEmoji } from "./custom-emoji";
import { onDataChange, notifyDataChanged } from "./data-events";

export let allItems: OrderItem[] = [];
let _filtersInitDone = false;
let _dataLoaded = false; // 标记数据已加载，避免 tab 切换时重复请求
let _cachedItems: OrderItem[] | null = null; // 缓存最近一次加载的条目，避免骨架屏闪烁
let _lastPlatformRenderKey = ""; // 平台下拉上次渲染键（平台集+选中集），避免重复重渲染
let _lastCategoryRenderKey = ""; // 分类下拉上次渲染键
/** 数据可能已变更但未实时刷新时（如从设置页导入数据库），标记下次切回主页时强制重新加载 */
export function markNeedsRefresh() {
  _dataLoaded = false;
  _cachedItems = null;  // 清除缓存，避免数据变更后仍显示旧数据
}

// ── 日均成本粒度切换 ───────────────────────────────────
let _dailyAvgCycle = 0;          // 0=日, 1=周, 2=月, 3=年
let _dailySum = 0;               // 当前筛选后的日均成本总和
const _CYCLE_MULTS = [1, 7, 30.44, 365.25];
const _CYCLE_UNITS = ["/日", "/周", "/月", "/年"];

// ── 批量选择状态 ──────────────────────────────────────
let selectMode = false;
const selectedIds = new Set<number>();
let currentFilteredItems: OrderItem[] = [];

// ── 长按选择（移动端） ──────────────────────────────
// 两阶段计时防止快速滑动误触：Android WebView 中 passive touchstart 会
// 让浏览器把 touchmove 交给合成器线程优化滚动，JS 侧 touchmove 可能
// 延迟到达甚至不触发 — 此时长按计时器会误触发多选。
// 修复：①先等 150ms grace 期确认用户是否滑动（此期间 touchmove 大概率已到达）
// ②grace 期内未取消 → 启动 850ms 真正长按计时，总时长 1000ms
// ③ scroll 事件兜底（touchmove 不触发时 scroll 一定触发）
let _longPressPreTimer: ReturnType<typeof setTimeout> | null = null; // grace 期计时
let _longPressTimer: ReturnType<typeof setTimeout> | null = null;    // 真正的长按计时
let _longPressFired = false;
let _longPressCard: HTMLElement | null = null;
const LONG_PRESS_GRACE_MS = 150;
const LONG_PRESS_MS = 850;

function startLongPress(card: HTMLElement, id: number) {
  _longPressFired = false;
  _longPressCard = card;
  card.classList.add("long-pressing");
  // 阶段 1：grace 期 — 等用户是否开始滑动（touchmove 大概率在此期间到达）
  _longPressPreTimer = setTimeout(() => {
    // 阶段 2：grace 期内未取消 → 确认无滑动，启动真正长按计时
    _longPressTimer = setTimeout(() => {
      _longPressFired = true;
      _longPressCard?.classList.remove("long-pressing");
      _longPressCard = null;
      if (!selectMode) enterSelectMode();
      selectedIds.add(id);
      updateSelectUI();
      navigator.vibrate?.([10]); // 触觉反馈
    }, LONG_PRESS_MS);
  }, LONG_PRESS_GRACE_MS);
}

function cancelLongPress() {
  if (_longPressPreTimer) { clearTimeout(_longPressPreTimer); _longPressPreTimer = null; }
  if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
  _longPressCard?.classList.remove("long-pressing");
  _longPressCard = null;
}

function enterSelectMode() {
  selectMode = true;
  const btn = document.getElementById("btn-select-mode")!;
  btn.innerHTML = `✕ <span>${t("home.cancel_select")}</span>`;
  btn.classList.add("btn-danger-outline");
  // 需重渲染以给卡片加入 checkbox
  if (currentFilteredItems.length > 0) renderItems(currentFilteredItems);
  updateSelectUI();
}

function exitSelectMode() {
  selectMode = false;
  selectedIds.clear();
  const btn = document.getElementById("btn-select-mode")!;
  btn.innerHTML = `☐ <span>${t("home.select")}</span>`;
  btn.classList.remove("btn-danger-outline");
  // 需重渲染以移除卡片上的 checkbox
  if (currentFilteredItems.length > 0) renderItems(currentFilteredItems);
  updateSelectUI();
}

function updateSelectUI() {
  const bar = document.getElementById("select-batch-bar")!;
  const countEl = document.getElementById("select-batch-count")!;
  const visible = selectMode && selectedIds.size > 0;
  bar.style.display = visible ? "flex" : "none";
  countEl.textContent = visible ? `${selectedIds.size} ${t("home.selected")}` : "";
  // 仅同步 checkbox 选中态，避免每次勾选都整表重渲染（移动端卡顿）
  if (selectMode) {
    document.querySelectorAll<HTMLInputElement>(".item-select-cb").forEach(cb => {
      cb.checked = selectedIds.has(parseInt(cb.dataset.id!));
    });
  }
}

// ── 导航 ──────────────────────────────────────────────
let _currentTabIndex = 0; // 当前 tab 索引，用于判断滑动方向

// ── 页面切换状态机 ────────────────────────────────────
// active 状态由 JS 确定性管理，绝不依赖 animationend 移除：
// 动画被中断、系统开启「减少动态效果」、或页面被 display:none 时，
// animationend 可能永不触发，导致覆盖层（设置/分析页 z-index:50）残留
// active 盖在主页上，拦截滚动与点击。因此滑出动画仅作视觉装饰，
// 切换时立即更新 active，旧页用 animationend + 超时双保险清理。
let _leavingPage: HTMLElement | null = null; // 正在播放滑出动画的页面
let _leaveCleanupTimer: ReturnType<typeof setTimeout> | null = null;

/** 幂等清理滑出页面：仅当该页仍处于「待清理」状态时才移除 active（快速切回时不会误删） */
function cleanupLeavingPage(page: HTMLElement) {
  if (_leavingPage !== page) return;
  _leavingPage = null;
  if (_leaveCleanupTimer) { clearTimeout(_leaveCleanupTimer); _leaveCleanupTimer = null; }
  page.classList.remove("active", "page-slide-out-right", "page-slide-left", "page-slide-right");
}

/** 让页面开始滑出：动画结束或超时后移除 active（双保险，保证覆盖层必被清理） */
function startPageLeave(page: HTMLElement) {
  // 若已有其它页面在滑出，先立即清理，防止多页叠加残留
  if (_leavingPage && _leavingPage !== page) cleanupLeavingPage(_leavingPage);
  page.classList.remove("page-slide-left", "page-slide-right");
  _leavingPage = page;
  page.classList.add("page-slide-out-right");
  const cleanup = () => cleanupLeavingPage(page);
  page.addEventListener("animationend", cleanup, { once: true });
  // 兜底：滑出动画 0.22s，350ms 后强制清理（animationend 可能不触发）
  _leaveCleanupTimer = setTimeout(cleanup, 350);
}

export function initNavigation() {
  const tabs = document.querySelectorAll<HTMLElement>(".nav-tab");
  const getPage = (tabName: string): HTMLElement => document.getElementById(`page-${tabName}`)!;
  tabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab")!;
      const targetIdx = idx;
      const goingForward = targetIdx > _currentTabIndex; // 向右滑动（前进）

      // 旧页 = 当前激活 tab 对应的页面（在更新 tab 前读取；
      // 不能用 querySelector('.page.active')——滑出中的页面与当前页会同时带 active，取到的可能不是真正旧页）
      const activeTab = document.querySelector<HTMLElement>(".nav-tab.active");
      const oldPage = activeTab ? getPage(activeTab.dataset.tab!) : null;
      const newPage = getPage(target);

      // 更新 tab 激活状态
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // 若目标页就是正在滑出的页面（快速切回）：取消其待清理状态，
      // 避免后续 animationend/超时误删它的 active
      if (_leavingPage === newPage) {
        _leavingPage = null;
        if (_leaveCleanupTimer) { clearTimeout(_leaveCleanupTimer); _leaveCleanupTimer = null; }
        newPage.classList.remove("page-slide-out-right");
      }

      if (target === "home") {
        // 主页始终可见，不需要入场动画；非主页旧页滑出后由状态机清理
        if (oldPage && oldPage !== newPage) startPageLeave(oldPage);
        newPage.classList.remove("page-slide-left", "page-slide-right", "page-slide-out-right");
        newPage.classList.add("active");
      } else {
        // 设置/分析页：立即清理任何残留滑出的覆盖层（防止透明层拦截点击），
        // 旧页立即退出激活并清除残留动画类
        if (_leavingPage && _leavingPage !== newPage) cleanupLeavingPage(_leavingPage);
        if (oldPage && oldPage !== newPage) {
          cleanupLeavingPage(oldPage);
          oldPage.classList.remove("active", "page-slide-left", "page-slide-right");
        }
        // 新页入场：先清除残留动画类，再从右侧滑入（固定覆盖层）
        newPage.classList.remove("page-slide-left", "page-slide-right", "page-slide-out-right");
        newPage.classList.add(goingForward ? "page-slide-right" : "page-slide-left");
        newPage.classList.add("active");
      }

      _currentTabIndex = targetIdx;

      if (target === "home") {
        // 数据已加载且无变更时跳过重新请求，避免移动端卡顿/闪烁
        if (!_dataLoaded) loadItems();
      } else if (target === "settings") {
        // 切出主页时退出选择模式，避免批量栏泄漏到设置页
        if (selectMode) exitSelectMode();
        import("./ui-settings").then(m => m.loadBatches());
      } else if (target === "analytics") {
        // 切出主页时退出选择模式
        if (selectMode) exitSelectMode();
      }
    });
  });

  // ── 注册数据变更监听：数据变更后自动刷新 ──────────
  onDataChange(() => {
    const home = document.getElementById("page-home")!;
    if (home.classList.contains("active")) {
      // 主页活跃时直接重新加载，强制清除缓存
      _cachedItems = null;
      _dataLoaded = false;
      loadItems();
    } else {
      markNeedsRefresh();
    }
  });

  // ── 卡片网格事件委托 ─────────────────────────────
  // 事件委托替代「每个卡片各绑 6 个监听器」：网格重渲染（innerHTML）后监听器依然有效，
  // 避免数百个卡片每次渲染都创建/销毁监听器导致的移动端卡顿
  const grid = document.getElementById("items-grid")!;
  const scrollContainer = document.getElementById("page-home")!;
  grid.addEventListener("touchstart", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".item-card");
    if (card) startLongPress(card, parseInt(card.dataset.id!));
  }, { passive: true });
  // touchmove 快速滑动时可能不触发（WebView 交给合成器线程），
  // 但 scroll 事件一定会触发 → 作为取消长按的兜底防线
  scrollContainer.addEventListener("scroll", () => cancelLongPress(), { passive: true });
  grid.addEventListener("touchmove", () => cancelLongPress());
  grid.addEventListener("touchend", () => cancelLongPress());
  grid.addEventListener("touchcancel", () => cancelLongPress());
  grid.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>(".item-card");
    if (!card) return;
    const id = parseInt(card.dataset.id!);
    if (_longPressFired) { _longPressFired = false; return; } // 长按已处理
    if (selectMode) {
      const cb = target.closest<HTMLInputElement>(".item-select-cb");
      if (cb) {
        const cid = parseInt(cb.dataset.id!);
        cb.checked ? selectedIds.add(cid) : selectedIds.delete(cid);
        updateSelectUI();
        return;
      }
      // 选择模式下点击卡片其他区域 → 也切换选中
      if (selectedIds.has(id)) { selectedIds.delete(id); } else { selectedIds.add(id); }
      updateSelectUI();
      return;
    }
    // 正常模式 → 打开详情
    const item = allItems.find(i => i.id === id);
    if (item) showItemModal(item);
  });
}

export async function loadItems() {
  const grid = document.getElementById("items-grid")!;
  const empty = document.getElementById("items-empty")!;

  // 有缓存数据时先渲染缓存，避免骨架屏闪烁（stale-while-revalidate）
  if (_cachedItems && _cachedItems.length > 0) {
    empty.style.display = "none";
    applyFilters(_cachedItems);
  } else {
    // 首次加载：显示骨架屏
    empty.style.display = "none";
    grid.innerHTML = Array.from({ length: 6 }, () =>
      `<div class="skeleton-card">
        <div class="skeleton-circle"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>`
    ).join("");
    grid.className = "skeleton-grid";
  }

  try {
    const items = await fetchItems();
    _cachedItems = items; // 更新缓存
    // 重置空状态为默认引导内容
    empty.innerHTML = `
      <span class="empty-icon">📦</span>
      <p class="empty-title">${t("empty.title")}</p>
      <p class="empty-subtitle">${t("empty.subtitle")}</p>
      <div class="empty-actions">
        <button class="empty-card" id="empty-add-item">
          <span class="empty-card-icon">➕</span>
          <span class="empty-card-label">${t("empty.add_manual")}</span>
          <span class="empty-card-desc">${t("empty.add_manual_desc")}</span>
        </button>
        <button class="empty-card" id="empty-go-import">
          <span class="empty-card-icon">📄</span>
          <span class="empty-card-label">${t("empty.import_orders")}</span>
          <span class="empty-card-desc">${t("empty.import_orders_desc")}</span>
        </button>
      </div>
      <button class="empty-demo-btn" id="empty-load-demo">
        <span class="empty-demo-icon">🎁</span>
        <span class="empty-demo-text">
          <span class="empty-demo-title">${t("empty.load_demo")}</span>
          <span class="empty-demo-desc">${t("empty.load_demo_desc")}</span>
        </span>
      </button>
      <p class="empty-hint">${t("empty.drag_hint")}</p>
    `;
    bindEmptyActions();
    if (items.length === 0) {
      empty.style.display = "flex";
      grid.innerHTML = "";
      grid.className = "";
    } else {
      empty.style.display = "none";
    }
    _dataLoaded = true;
    applyFilters(items);
  } catch (e) {
    console.error('[Home] loadItems error:', e);
    _dataLoaded = true; // 标记已尝试加载，避免每次切回主页都重试
    empty.style.display = "flex";
    empty.innerHTML = `<span class="empty-icon">⚠️</span><p>${t("empty.load_error")}: ${e}</p>`;
    grid.innerHTML = "";
    grid.className = "";
  }
}

function bindEmptyActions() {
  document.getElementById("empty-add-item")?.addEventListener("click", () => {
    showAddItemModal();
  });
  document.getElementById("empty-go-import")?.addEventListener("click", () => {
    (document.querySelector(".nav-tab[data-tab='settings']") as HTMLElement)?.click();
  });
  document.getElementById("empty-load-demo")?.addEventListener("click", async () => {
    const btn = document.getElementById("empty-load-demo")! as HTMLButtonElement;
    const titleEl = btn.querySelector(".empty-demo-title")!;
    const descEl = btn.querySelector(".empty-demo-desc") as HTMLElement | null;
    const setLoading = (loading: boolean) => {
      btn.disabled = loading;
      titleEl.textContent = loading ? `⏳ ${t("empty.loading_demo")}` : t("empty.load_demo");
      if (descEl) descEl.style.display = loading ? "none" : "";
    };
    setLoading(true);
    try {
      if (isTauri()) {
        const msg = await invoke("import_example_data") as string;
        showToast(msg, "success");
      } else {
        const msg = await browserDb.importExampleData();
        showToast(msg, "success");
      }
      _dataLoaded = false;
      _cachedItems = null;
      notifyDataChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(msg || t("toast.operation_failed"), "error");
      setLoading(false);
    }
  });
}

// ── 筛选排序 ──────────────────────────────────────────
export function applyFilters(items: OrderItem[]) {
  allItems = [...items];
  const filterInput = document.getElementById("filter-input") as HTMLInputElement;
  const btnPlatformDrop = document.getElementById("btn-platform-drop")!;
  const platformDrop = document.getElementById("platform-drop")!;
  const platformCount = document.getElementById("platform-count")!;
  const filterSort = document.getElementById("filter-sort") as HTMLSelectElement;
  const btnSortDir = document.getElementById("btn-sort-dir")!;
  let sortDesc = (btnSortDir.dataset.desc || "1") === "1";

  const allPlatforms = [...new Set(allItems.map(i => i.platform))].sort();
  loadPref("filter_platform", "").then(pref => {
    const activeSet = new Set(pref ? pref.split(",").filter(Boolean) : allPlatforms);
    // 平台集合/选中集合未变化时跳过下拉重渲染（避免每次加载都重建 DOM + 监听器）
    const key = allPlatforms.join("\u0001") + "\u0002" + [...activeSet].sort().join("\u0001");
    if (key !== _lastPlatformRenderKey) {
      _lastPlatformRenderKey = key;
      renderPlatformCheckboxes(allPlatforms, activeSet);
    } else {
      updatePlatformLabel();
    }
  });

  // 分类筛选
  const allCategories = [...new Set(allItems.map(i => i.category).filter(Boolean))];
  loadPref("filter_category", "").then(pref => {
    const activeSet = new Set(pref ? pref.split(",").filter(Boolean) : allCategories);
    const key = allCategories.join("\u0001") + "\u0002" + [...activeSet].sort().join("\u0001");
    if (key !== _lastCategoryRenderKey) {
      _lastCategoryRenderKey = key;
      renderCategoryCheckboxes(allCategories, activeSet);
    } else {
      updateCategoryLabel();
    }
  });

  function renderPlatformCheckboxes(platforms: string[], active: Set<string>) {
    platformDrop.innerHTML = platforms.map(p => {
      const checked = active.size === 0 || active.has(p) ? "checked" : "";
      const pc = platformColor(p);
      return `<div class="multi-select-item">
        <input type="checkbox" value="${p}" ${checked} />
        <span class="platform-color-dot" data-dot="${p}" style="background:${pc.fg};flex-shrink:0;"></span>
        <span class="multi-select-label">${platformLabel(p)}</span>
      </div>`;
    }).join("");

    platformDrop.querySelectorAll(".multi-select-item").forEach(row => {
      row.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".platform-color-dot")) return;
        const cb = row.querySelector<HTMLInputElement>("input[type=checkbox]")!;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    // 色点 → 调色板
    let palettePopup: HTMLElement | null = null;
    const closePalette = () => { if (palettePopup) { palettePopup.remove(); palettePopup = null; } };

    platformDrop.querySelectorAll(".platform-color-dot").forEach(dot => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        closePalette();
        const p = (dot as HTMLElement).dataset.dot!;
        const current = SETTINGS_CACHE[`pc_${p}`] || "";
        palettePopup = document.createElement("div");
        palettePopup.className = "color-palette-popup";
        palettePopup.innerHTML = PLATFORM_PALETTE.map(c =>
          `<button class="color-palette-swatch${c === current ? ' active' : ''}" style="background:${c}" data-color="${c}"></button>`
        ).join("");
        palettePopup.addEventListener("click", async (ev) => {
          const swatch = (ev.target as HTMLElement).closest(".color-palette-swatch") as HTMLElement;
          if (!swatch) return;
          const hex = swatch.dataset.color!;
          await savePref(`pc_${p}`, hex);
          SETTINGS_CACHE[`pc_${p}`] = hex;
          (dot as HTMLElement).style.background = hex;
          closePalette();
          doFilter();
        });
        document.body.appendChild(palettePopup);
        const dotRect = (dot as HTMLElement).getBoundingClientRect();
        const popupW = 294;
        let left = dotRect.left;
        if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
        if (left < 8) left = 8;
        palettePopup.style.top = (dotRect.bottom + 4) + "px";
        palettePopup.style.left = left + "px";
        setTimeout(() => document.addEventListener("click", closePalette, { once: true }), 0);
      });
    });

    updatePlatformLabel();
    platformDrop.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => { updatePlatformLabel(); savePlatformPref(); doFilter(); });
    });
  }

  const getCheckedPlatforms = (): Set<string> => {
    const s = new Set<string>();
    platformDrop.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked").forEach(cb => s.add(cb.value));
    return s;
  };
  const updatePlatformLabel = () => { platformCount.textContent = `(${getCheckedPlatforms().size})`; };
  const savePlatformPref = () => { savePref("filter_platform", [...getCheckedPlatforms()].join(",")); };

  // ── 分类下拉逻辑 ──
  // 注意：按钮开合与 document 关闭监听只能在 `_filtersInitDone` 一次性绑定，
  // 否则每次 applyFilters()（导入/加载/偏好变更）都会重复添加监听，
  // 偶数个 toggle 监听互相抵消 → 点击后下拉无法打开（“分类按钮无法点击”）。
  const btnCategoryDrop = document.getElementById("btn-category-drop")!;
  const categoryDrop = document.getElementById("category-drop")!;
  const categoryCount = document.getElementById("category-count")!;

  function renderCategoryCheckboxes(categories: string[], active: Set<string>) {
    if (categories.length === 0) { categoryDrop.innerHTML = ""; updateCategoryLabel(); return; }
    categoryDrop.innerHTML = categories.map(c => {
      const checked = active.has(c) ? "checked" : "";
      return `<div class="multi-select-item">
        <input type="checkbox" value="${c}" ${checked} />
        <span class="multi-select-label">${categoryLabel(c)}</span>
      </div>`;
    }).join("");

    categoryDrop.querySelectorAll(".multi-select-item").forEach(row => {
      row.addEventListener("click", () => {
        const cb = row.querySelector<HTMLInputElement>("input[type=checkbox]")!;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    updateCategoryLabel();
    categoryDrop.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => { updateCategoryLabel(); savePref("filter_category", [...getCheckedCategories()].join(",")); doFilter(); });
    });
  }

  const getCheckedCategories = (): Set<string> => {
    const s = new Set<string>();
    categoryDrop.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked").forEach(cb => s.add(cb.value));
    return s;
  };
  const updateCategoryLabel = () => { categoryCount.textContent = `(${getCheckedCategories().size})`; };

  const updateDirBtn = () => { btnSortDir.textContent = sortDesc ? "▼" : "▲"; };
  updateDirBtn();

  const doFilter = () => {
    const keyword = filterInput.value.toLowerCase();
    const platforms = getCheckedPlatforms();
    const categories = getCheckedCategories();
    const sort = filterSort.value;

    let filtered = allItems.filter(i => {
      if (keyword && !(
        i.product_name.toLowerCase().includes(keyword) ||
        i.store_name.toLowerCase().includes(keyword) ||
        i.model_style.toLowerCase().includes(keyword) ||
        i.order_id.toLowerCase().includes(keyword) ||
        i.parent_order_id.toLowerCase().includes(keyword)
      )) return false;
      if (platforms.size > 0 && !platforms.has(i.platform)) return false;
      if (categories.size > 0 && !categories.has(i.category) && !(categories.has("other") && !i.category)) return false;
      return true;
    });

    const key = sort === "price" ? "total_price" as const : sort === "daily" ? "daily_avg_cost" as const : "order_time" as const;
    filtered.sort((a, b) => {
      const va: string | number = a[key];
      const vb: string | number = b[key];
      if (typeof va === "string") return sortDesc ? (vb as string).localeCompare(va) : va.localeCompare(vb as string);
      return sortDesc ? (vb as number) - (va as number) : (va as number) - (vb as number);
    });

    currentFilteredItems = filtered;
    renderItems(filtered);
    updateStats(filtered);
    renderActiveFilters(keyword, platforms, categories, sort, sortDesc, allPlatforms, allCategories);
  };

  function renderActiveFilters(
    keyword: string,
    platforms: Set<string>,
    categories: Set<string>,
    sort: string,
    descending: boolean,
    availablePlatforms: string[],
    availableCategories: string[],
  ) {
    const summary = document.getElementById("active-filters")!;
    const chips: string[] = [];
    if (keyword) chips.push(`<button class="filter-chip" data-filter-type="keyword">${t("filter.search")}: ${escapeHtml(keyword)} <span aria-hidden="true">×</span></button>`);
    if (platforms.size > 0 && platforms.size < availablePlatforms.length) {
      chips.push(`<button class="filter-chip" data-filter-type="platform">${t("filter.platform")}: ${platforms.size}/${availablePlatforms.length} <span aria-hidden="true">×</span></button>`);
    }
    if (categories.size > 0 && categories.size < availableCategories.length) {
      chips.push(`<button class="filter-chip" data-filter-type="category">${t("category.label")}: ${categories.size}/${availableCategories.length} <span aria-hidden="true">×</span></button>`);
    }
    // 默认排序为日均成本降序，故仅在非默认状态下显示排序 chip
    if (sort !== "daily" || !descending) {
      const label = sort === "price" ? t("filter.price") : sort === "daily" ? t("filter.daily_cost") : t("filter.time");
      chips.push(`<button class="filter-chip" data-filter-type="sort">${t("filter.sort")}: ${label} ${descending ? "↓" : "↑"} <span aria-hidden="true">×</span></button>`);
    }

    if (chips.length === 0) {
      summary.innerHTML = "";
      summary.classList.remove("has-filters");
      return;
    }

    summary.classList.add("has-filters");
    summary.innerHTML = `<span class="active-filters-label">${t("filter.active")}</span>${chips.join("")}<button class="filter-reset" data-filter-type="all">${t("filter.clear_all")}</button>`;
    summary.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
      button.addEventListener("click", () => {
        const type = button.dataset.filterType;
        if (type === "keyword" || type === "all") {
          filterInput.value = "";
          document.getElementById("btn-search-clear")!.style.display = "none";
        }
        if (type === "platform" || type === "all") {
          platformDrop.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach(cb => { cb.checked = true; });
          updatePlatformLabel();
          savePlatformPref();
        }
        if (type === "category" || type === "all") {
          categoryDrop.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach(cb => { cb.checked = true; });
          updateCategoryLabel();
          savePref("filter_category", [...getCheckedCategories()].join(","));
        }
        if (type === "sort" || type === "all") {
          filterSort.value = "daily";
          sortDesc = true;
          btnSortDir.dataset.desc = "1";
          updateDirBtn();
          savePref("filter_sort", "daily");
          savePref("sort_desc", "1");
        }
        doFilter();
      });
    });
  }

  if (!_filtersInitDone) {
    _filtersInitDone = true;
    // 搜索输入防抖：避免每个按键都全量重渲染网格（移动端卡顿），最终结果不变
    const onSearchDebounced = debounce(doFilter, 120);
    filterInput.oninput = () => {
      const btn = document.getElementById("btn-search-clear")!;
      btn.style.display = filterInput.value ? "flex" : "none";
      onSearchDebounced();
    };
    // 搜索清空按钮（一次性绑定，避免每次 applyFilters 重复累加监听器）
    document.getElementById("btn-search-clear")!.addEventListener("click", () => {
      filterInput.value = "";
      document.getElementById("btn-search-clear")!.style.display = "none";
      doFilter();
    });
    btnPlatformDrop.addEventListener("click", (e) => { e.stopPropagation(); platformDrop.classList.toggle("show"); categoryDrop.classList.remove("show"); });
    document.addEventListener("click", () => platformDrop.classList.remove("show"));
    platformDrop.addEventListener("click", (e) => e.stopPropagation());
    // 分类下拉：一次性绑定，防止重复监听导致按钮无法点击
    btnCategoryDrop.addEventListener("click", (e) => { e.stopPropagation(); categoryDrop.classList.toggle("show"); platformDrop.classList.remove("show"); });
    document.addEventListener("click", () => categoryDrop.classList.remove("show"));
    // 阻止分类下拉内部点击冒泡到 document（防止误关闭）
    categoryDrop.addEventListener("click", (e) => e.stopPropagation());
    btnSortDir.addEventListener("click", () => {
      sortDesc = !sortDesc;
      btnSortDir.dataset.desc = sortDesc ? "1" : "0";
      updateDirBtn();
      savePref("sort_desc", sortDesc ? "1" : "0");
      doFilter();
    });
    filterSort.onchange = () => { savePref("filter_sort", filterSort.value); doFilter(); };

    // 选择模式按钮
    document.getElementById("btn-select-mode")!.addEventListener("click", () => {
      if (selectMode) { exitSelectMode(); } else { enterSelectMode(); }
    });
    document.getElementById("btn-cancel-select")!.addEventListener("click", exitSelectMode);
    document.getElementById("btn-batch-archive")!.addEventListener("click", batchArchiveSelected);

    // 日均可变成本整卡点击切换粒度
    const statDailyCard = document.querySelector("#stats-bar .stat-card:last-child")! as HTMLElement;
    const statDailyEl = document.getElementById("stat-daily")!;
    const statDailyLabel = statDailyCard.querySelector<HTMLElement>(".stat-label")!;
    const _cycleLabels = ["日均可变成本", "周均可变成本", "月均可变成本", "年均可变成本"];
    statDailyCard.addEventListener("click", () => {
      _dailyAvgCycle = (_dailyAvgCycle + 1) % 4;
      const mult = _CYCLE_MULTS[_dailyAvgCycle];
      statDailyEl.textContent = formatNetCost(_dailySum * mult) + _CYCLE_UNITS[_dailyAvgCycle];
      statDailyLabel.textContent = _cycleLabels[_dailyAvgCycle];
    });
  }

  doFilter();
}

export function updateStats(items: OrderItem[]) {
  let total = 0, daily = 0;
  for (const i of items) { total += i.total_price; daily += i.daily_avg_cost; }
  _dailySum = daily;
  document.getElementById("stat-count")!.textContent = `${items.length}`;
  document.getElementById("stat-total")!.textContent = formatPrice(total);
  const mult = _CYCLE_MULTS[_dailyAvgCycle];
  document.getElementById("stat-daily")!.textContent = formatNetCost(daily * mult) + _CYCLE_UNITS[_dailyAvgCycle];
}

// ── 虚拟列表（大列表只渲染可视窗口，DOM 常驻少量卡片）────
const VIRTUAL_THRESHOLD = 200; // 超过该条数启用虚拟化
let _virtualEnabled = false;   // 当前是否处于虚拟化渲染
let _virtualRowHeight = 190;   // 估算行高，渲染后自适应校正
let _virtualScrollBound = false;
let _virtualLastStartRow = -1;
let _virtualLastEndRow = -1;
let _scrollRafPending = false;

/** 生成卡片 HTML（带单次调用的局部缓存，避免重复计算平台颜色/标签/emoji/i18n） */
function buildCardsHtml(items: OrderItem[], showTotal: boolean): string {
  const colorCache = new Map<string, { bg: string; fg: string }>();
  const platformLabelCache = new Map<string, string>();
  const categoryLabelCache = new Map<string, string>();
  const emojiCache = new Map<string, string>();
  const perDay = t("card.per_day");
  const emojiHtml = (e: string): string => {
    let h = emojiCache.get(e);
    if (h === undefined) { h = renderEmoji(e); emojiCache.set(e, h); }
    return h;
  };
  let html = "";
  for (const item of items) {
    let pc = colorCache.get(item.platform);
    if (!pc) { pc = platformColor(item.platform); colorCache.set(item.platform, pc); }
    let pLabel = platformLabelCache.get(item.platform);
    if (pLabel === undefined) { pLabel = platformLabel(item.platform); platformLabelCache.set(item.platform, pLabel); }
    let cLabel: string | undefined;
    if (item.category) {
      cLabel = categoryLabelCache.get(item.category);
      if (cLabel === undefined) {
        cLabel = categoryLabel(item.category);
        categoryLabelCache.set(item.category, cLabel);
      }
    } else {
      cLabel = "";
    }
    const ended = item.end_reason ? ` item-ended` : "";
    const endTag = item.end_reason ? `<span class="item-end-tag tag-end-${item.end_reason}">${item.end_reason === "sold" ? "💰" : "🗑️"}</span>` : "";
    const checked = selectMode && selectedIds.has(item.id) ? "checked" : "";
    html += `
    <div class="item-card${ended}" data-id="${item.id}">
      ${selectMode ? `<input type="checkbox" class="item-select-cb" data-id="${item.id}" ${checked} />` : ""}
      <div class="item-tags">
        <span class="item-platform-tag" style="background:${pc.bg};color:${pc.fg}">${pLabel}</span>
        ${item.category ? `<span class="item-category-tag">${cLabel}</span>` : ""}
      </div>
      ${endTag}
      <div class="item-emoji">${emojiHtml(item.emoji)}</div>
      <div class="item-name">${item.product_name}</div>
      ${item.model_style ? `<div class="item-model">${item.model_style.startsWith("共") ? item.model_style.split("\n")[0] : item.model_style}</div>` : ""}
      <div class="item-cost">
        <span class="cost-value ${item.daily_avg_cost > 10 ? 'cost-high' : item.daily_avg_cost > 1 ? 'cost-mid' : item.daily_avg_cost < 0 ? 'cost-profit' : 'cost-low'}">${formatNetCost(item.daily_avg_cost)}<span class="cost-unit">${perDay}</span></span>
        ${showTotal ? `<span class="cost-total-sub">${formatPrice(item.total_price)}</span>` : ""}
      </div>
    </div>`;
  }
  return html;
}

/** 虚拟列表：渲染当前可视窗口内的卡片，用网格上下内边距撑起整表高度（滚动条表现与全量渲染一致） */
function renderVirtualWindow(items: OrderItem[]) {
  const grid = document.getElementById("items-grid");
  const scrollEl = document.getElementById("page-home");
  if (!grid || !scrollEl || items.length === 0) return;
  const showTotal = (document.getElementById("toggle-show-total") as HTMLInputElement)?.checked ?? true;

  // 响应式网格：实时读取当前列数与行间距
  const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").length);
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 14;
  const rowPitch = Math.max(50, _virtualRowHeight + gap);
  const totalRows = Math.ceil(items.length / cols);

  const scrollTop = scrollEl.scrollTop;
  const viewportH = Math.max(scrollEl.clientHeight, 300);
  const bufferPx = viewportH; // 上下各缓冲一屏，滚动时提前渲染
  let startRow = Math.floor((scrollTop - bufferPx) / rowPitch);
  let endRow = Math.ceil((scrollTop + viewportH + bufferPx) / rowPitch);
  startRow = Math.max(0, startRow);
  endRow = Math.min(totalRows, endRow);
  if (startRow >= endRow) { startRow = 0; endRow = Math.min(totalRows, 1); }

  // 可视窗口未变化则跳过（滚动事件高频触发，只命中一次）
  if (startRow === _virtualLastStartRow && endRow === _virtualLastEndRow) return;

  const startIdx = startRow * cols;
  const endIdx = Math.min(items.length, endRow * cols);
  grid.style.paddingTop = `${startRow * rowPitch}px`;
  grid.style.paddingBottom = `${(totalRows - endRow) * rowPitch}px`;
  grid.innerHTML = buildCardsHtml(items.slice(startIdx, endIdx), showTotal);
  _virtualLastStartRow = startRow;
  _virtualLastEndRow = endRow;

  // 自适应校正行高：取可视卡片平均高度（grid 同行等高），平滑更新
  let sum = 0, n = 0;
  grid.querySelectorAll<HTMLElement>(".item-card").forEach(c => { sum += c.offsetHeight; n++; });
  if (n > 0) {
    const avg = sum / n;
    _virtualRowHeight = Math.round(_virtualRowHeight * 0.6 + avg * 0.4);
  }
}

export function renderItems(items: OrderItem[]) {
  const grid = document.getElementById("items-grid")!;
  grid.className = "";
  // 小列表/空列表：关闭虚拟化并清除撑高内边距
  if (_virtualEnabled) {
    _virtualEnabled = false;
    grid.style.paddingTop = "";
    grid.style.paddingBottom = "";
  }
  if (items.length === 0) {
    if (allItems.length === 0) return;
    const kw = (document.getElementById("filter-input") as HTMLInputElement).value;
    const platforms = document.querySelectorAll<HTMLInputElement>("#platform-drop input[type=checkbox]");
    const platformFilterOn = platforms.length > 0 && [...platforms].some(cb => !cb.checked);
    let hint = "";
    if (kw && platformFilterOn) hint = t("filter.no_match_kw_platform");
    else if (kw) hint = t("filter.no_match_kw", { kw });
    else if (platformFilterOn) hint = t("filter.no_match_platform");
    else hint = t("filter.no_match");
    grid.innerHTML = `<div class="empty-filter">
      <span class="empty-filter-icon">🔍</span>
      <p class="empty-filter-title">${hint}</p>
      <p class="empty-filter-hint">${t("filter.try_adjust")}</p>
      <button class="btn btn-sm btn-ghost" id="btn-clear-filters">${t("filter.clear_all")}</button>
    </div>`;
    document.getElementById("btn-clear-filters")?.addEventListener("click", () => {
      const fi = document.getElementById("filter-input") as HTMLInputElement;
      fi.value = "";
      document.getElementById("btn-search-clear")!.style.display = "none";
      document.querySelectorAll<HTMLInputElement>("#platform-drop input[type=checkbox]").forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); });
      document.querySelectorAll<HTMLInputElement>("#category-drop input[type=checkbox]").forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); });
      fi.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return;
  }
  const showTotal = (document.getElementById("toggle-show-total") as HTMLInputElement)?.checked ?? true;

  if (items.length > VIRTUAL_THRESHOLD) {
    // 大列表：虚拟化 —— 只渲染可视窗口，DOM 常驻少量卡片，布局/滚动始终轻量。
    // 卡片交互（长按/点击/选择模式）由 initNavigation 中绑定的事件委托统一处理，不受影响。
    _virtualEnabled = true;
    _virtualLastStartRow = -1;
    _virtualLastEndRow = -1;
    if (!_virtualScrollBound) {
      _virtualScrollBound = true;
      const page = document.getElementById("page-home")!;
      page.addEventListener("scroll", () => {
        if (_scrollRafPending || !_virtualEnabled) return;
        _scrollRafPending = true;
        requestAnimationFrame(() => {
          _scrollRafPending = false;
          if (_virtualEnabled) renderVirtualWindow(currentFilteredItems);
        });
      }, { passive: true });
      // 窗口/横竖屏变化时列数改变，需重算可视窗口
      window.addEventListener("resize", () => {
        if (!_virtualEnabled) return;
        _virtualLastStartRow = -1;
        _virtualLastEndRow = -1;
        renderVirtualWindow(currentFilteredItems);
      });
    }
    renderVirtualWindow(items);
    return;
  }

  // 小列表：一次性同步渲染。≤200 条卡片在慢设备上也 <100ms，且不依赖 rAF——
  // 4 倍 CPU 减速等环境下 requestAnimationFrame 会被大幅延迟，分块渲染会迟迟不出现。
  grid.innerHTML = buildCardsHtml(items, showTotal);
}

// ── 批量归档 ──────────────────────────────────────────
async function batchArchiveSelected() {
  if (selectedIds.size === 0) return;
  const ok = await showConfirm(t("confirm.batch_archive", { count: selectedIds.size }));
  if (!ok) return;
  const ids = [...selectedIds];
  if (isTauri()) {
    try { await invoke("batch_archive_items", { ids }); } catch (e) { showToast(`${t("toast.operation_failed")}: ${e}`, "error"); return; }
  } else {
    browserDb.batchArchiveItems(ids);
  }
  showToast(t("toast.batch_archived", { count: ids.length }), "success");
  // 先清除选择状态，再通知数据变更（各模块自动刷新）
  selectMode = false;
  selectedIds.clear();
  document.getElementById("select-batch-bar")!.style.display = "none";
  const btn = document.getElementById("btn-select-mode")!;
  btn.innerHTML = `☐ <span>${t("home.select")}</span>`;
  btn.classList.remove("btn-danger-outline");
  notifyDataChanged();
}
