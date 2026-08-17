// ── 详情浮窗：查看 / 编辑 / 删除 / 添加物品 ────────────────

import { invoke } from "@tauri-apps/api/core";
import type { OrderItem } from "./types";
import { browserDb } from "./db";
import {
  isTauri, showToast, showConfirm,
  formatDate, formatPrice, formatNetCost, platformLabel, escapeHtml,
  daysSince, daysBetween, calcDailyAvg, validateEndDate,
} from "./utils";
import { platformColor } from "./theme";
import { t } from "./i18n";
import { renderEmoji } from "./custom-emoji";
import { fetchItems, fetchArchivedItems } from "./data";
import { notifyDataChanged } from "./data-events";

// ── 平台输入辅助：收集已有平台构建 datalist ─────────────
/** 构建平台输入字段 HTML（input + datalist），支持自由输入自定义平台 */
async function buildPlatformInput(currentValue: string): Promise<string> {
  const knownSet = new Set<string>(["jd", "tb", "steam", "alipay"]);
  // 从现有数据中收集已知平台（统一数据访问层，桌面/浏览器一致）
  try {
    const items = await fetchItems();
    items.forEach(i => knownSet.add(i.platform));
    const archived = await fetchArchivedItems();
    archived.forEach(i => knownSet.add(i.platform));
  } catch { /* 获取失败时仅使用默认值 */ }
  // 确保当前值在列表中
  if (currentValue) knownSet.add(currentValue);

  const options = [...knownSet].map(p =>
    `<option value="${escapeHtml(p)}">${platformLabel(p)}</option>`
  ).join("");

  return `<input type="text" id="edit-platform" list="platform-datalist"
      value="${escapeHtml(currentValue)}" autocomplete="off"
      placeholder="${t("platform.manual")}" />
    <datalist id="platform-datalist">${options}</datalist>`;
}

// ── 入口 ──────────────────────────────────────────────
export function showItemModal(item: OrderItem) {
  renderModalView(item);
}

// ── 查看模式 ──────────────────────────────────────────
function renderModalView(item: OrderItem) {
  const overlay = document.getElementById("item-modal")!;
  const content = document.getElementById("modal-content")!;
  const pc = platformColor(item.platform);

  const hasEnd = !!item.end_reason;
  const endLabel = item.end_reason === "sold" ? t("modal.end_sold") : t("modal.end_scrapped");
  const netCost = hasEnd && item.end_reason === "sold" ? item.total_price - item.sell_price : item.total_price;
  const isProfit = netCost < 0;
  const usageDays = hasEnd ? daysBetween(item.order_time, item.end_date) : daysSince(item.order_time);
  const isArchived = item.archived;

  content.innerHTML = `
    ${isArchived ? `<div class="modal-archive-banner">📦 ${t("modal.archived_banner")}</div>` : ""}
    <div class="modal-emoji">${renderEmoji(item.emoji)}</div>
    <div class="modal-name">${item.product_name}</div>
    <div class="modal-details">
      <div class="modal-row"><span class="label">${t("modal.platform")}</span><span class="tag tag-platform" style="background:${pc.bg};color:${pc.fg}">${platformLabel(item.platform)}</span></div>
      ${item.store_name ? `<div class="modal-row"><span class="label">${t("modal.store")}</span><span class="value">${item.store_name}</span></div>` : ""}
      ${item.model_style ? `<div class="modal-row"><span class="label">${t("modal.model")}</span><span class="value" style="white-space:pre-line">${item.model_style}</span></div>` : ""}
      ${item.product_id ? `<div class="modal-row"><span class="label">${t("modal.product_id")}</span><span class="value" style="font-family:monospace;font-size:11px">${item.product_id}</span></div>` : ""}
      <div class="modal-row"><span class="label">${t("modal.purchase_date")}</span><span class="value">${formatDate(item.order_time)}</span></div>
      <div class="modal-row"><span class="label">${t("modal.days_held")}</span><span class="value">${usageDays} ${t("modal.days")}</span></div>
      ${hasEnd ? `<div class="modal-row"><span class="label">${t("modal.end_date")}</span><span class="value">${formatDate(item.end_date)}</span></div>` : ""}
      ${hasEnd ? `<div class="modal-row"><span class="label">${t("modal.end_status")}</span><span class="tag tag-end tag-end-${item.end_reason}">${endLabel}</span></div>` : ""}
      <div class="modal-row"><span class="label">${t("modal.quantity")}</span><span class="value">×${item.quantity}</span></div>
      ${item.parent_order_id ? `<div class="modal-row"><span class="label">${t("modal.parent_order")}</span><span class="value">${item.parent_order_id}</span></div>` : ""}
      <div class="modal-row"><span class="label">${t("modal.order_id")}</span><span class="value">${item.order_id}</span></div>
    </div>
    <div class="modal-costs">
      ${hasEnd && item.end_reason === "sold" ? `
        <div class="modal-cost-item"><span class="label">${t("modal.total_price")}</span><span class="amount">${formatPrice(item.total_price)}</span></div>
        <div class="modal-cost-item"><span class="label">${t("modal.sell_price")}</span><span class="amount ${isProfit ? 'cost-profit' : ''}">${formatPrice(item.sell_price)}</span></div>
        <div class="modal-cost-item"><span class="label">${isProfit ? t("modal.net_profit") : t("modal.net_cost")}</span><span class="amount ${isProfit ? 'cost-profit' : ''}">${formatNetCost(netCost)}</span></div>
      ` : `
        <div class="modal-cost-item"><span class="label">${t("modal.total_price")}</span><span class="amount">${formatPrice(item.total_price)}</span></div>
      `}
      <div class="modal-cost-item"><span class="label">${t("modal.daily_avg_cost")}</span><span class="amount ${item.daily_avg_cost > 10 ? 'cost-high' : item.daily_avg_cost > 1 ? 'cost-mid' : item.daily_avg_cost < 0 ? 'cost-profit' : 'cost-low'}">${formatNetCost(item.daily_avg_cost)}</span></div>
    </div>
    ${item.product_url ? `<a class="modal-link" href="${item.product_url}" target="_blank" rel="noopener">🔗 ${t("modal.view_product")}</a>` : ""}
    <div class="modal-actions">
      ${isArchived
        ? `<button class="btn-icon-only modal-restore-btn" title="${t("modal.restore")}">📥</button>
           <button class="btn-icon-only modal-delete-btn" title="${t("modal.permanent_delete")}">🗑️</button>`
        : `<button class="btn-icon-only modal-edit-btn" title="${t("modal.edit")}">✏️</button>
           <button class="btn-icon-only modal-archive-btn" title="${t("modal.archive")}">📦</button>`
      }
      <button class="btn-icon-only modal-close-btn" id="modal-close-btn" title="${t("modal.close")}">✕</button>
    </div>
  `;

  overlay.classList.add("show");
  document.body.style.overflow = "hidden";
  bindViewEvents(overlay, item);
}

function bindViewEvents(overlay: HTMLElement, item: OrderItem) {
  const close = () => { overlay.classList.remove("show"); document.body.style.overflow = ""; };
  const refreshAfterAction = () => {
    close();
    notifyDataChanged();
  };
  overlay.querySelector("#modal-close-btn")?.addEventListener("click", close);
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); } };
  document.addEventListener("keydown", onEsc);

  // 编辑按钮（仅非归档物品显示）
  overlay.querySelector(".modal-edit-btn")?.addEventListener("click", () => renderModalEdit(item));

  // 归档按钮
  overlay.querySelector(".modal-archive-btn")?.addEventListener("click", async () => {
    const ok = await showConfirm(t("confirm.archive_item", { name: item.product_name.slice(0, 30) }));
    if (!ok) return;
    if (isTauri()) {
      try { await invoke("archive_item", { id: item.id }); } catch (e) { showToast(`${t("toast.archive_failed")}: ${e}`, "error"); return; }
    } else {
      browserDb.archiveItem(item.id);
    }
    showToast(t("toast.archived"), "success");
    refreshAfterAction();
  });

  // 取消归档按钮
  overlay.querySelector(".modal-restore-btn")?.addEventListener("click", async () => {
    if (isTauri()) {
      try { await invoke("restore_item", { id: item.id }); } catch (e) { showToast(`${t("toast.restore_failed")}: ${e}`, "error"); return; }
    } else {
      browserDb.restoreItem(item.id);
    }
    showToast(t("toast.restored"), "success");
    refreshAfterAction();
  });

  // 永久删除按钮（仅归档物品显示）
  overlay.querySelector(".modal-delete-btn")?.addEventListener("click", async () => {
    const ok = await showConfirm(t("confirm.permanent_delete_item", { name: item.product_name.slice(0, 30) }));
    if (!ok) return;
    if (isTauri()) {
      try { await invoke("delete_item", { id: item.id }); } catch (e) { showToast(`${t("toast.delete_failed")}: ${e}`, "error"); return; }
    } else {
      browserDb.permanentDeleteItem(item.id);
    }
    showToast(t("toast.permanent_deleted"), "success");
    refreshAfterAction();
  });
}

// ── 编辑模式 ──────────────────────────────────────────

/** 日期值 → datetime-local 兼容格式 (YYYY-MM-DDTHH:mm:ss) */
function fmtDateTimeLocal(val: string | undefined | null): string {
  if (!val) return "";
  const t = val.includes("T") ? val : val.replace(" ", "T");
  // 补全到 19 字符 (含秒)
  return t.length >= 19 ? t.slice(0, 19) : (t.slice(0, 10) + "T00:00:00").slice(0, 19);
}

/** datetime-local 值 → DB 格式 (YYYY-MM-DD HH:MM:SS) */
function fromDateTimeLocal(val: string): string {
  if (!val) return "";
  const s = val.replace("T", " ");
  return s.length >= 19 ? s : s + ":00";
}

// ── 编辑 / 添加 共用表单 ─────────────────────────────

/** 表单初始值（编辑=物品当前值；添加=空/默认值） */
interface ItemFormValues {
  title: string;            // 标题 HTML（✏️ 编辑 / ➕ 添加）
  product_name: string;
  emoji: string;
  platform: string;
  order_time: string;       // datetime-local 兼容值
  total_price: number;
  quantity: number;
  store_name: string;
  model_style: string;
  product_url: string;
  category: string;
  end_reason: string;
  end_date: string;         // datetime-local 兼容值
  sell_price: number;
  hasOptional: boolean;     // 是否默认展开可选区
  endMin?: string;          // 截止日期最小值（编辑=购买日期，添加=空）
}

/** 生成编辑/添加共用表单 HTML（所有字段 ID 固定，供 readEditForm 读取） */
async function buildItemFormHtml(v: ItemFormValues): Promise<string> {
  const today = new Date().toISOString().slice(0, 19);
  const endMinAttr = v.endMin ? ` min="${v.endMin}"` : "";
  const catSelected = (id: string) => v.category === id ? " selected" : "";
  const endSelected = (val: string) => v.end_reason === val ? " selected" : "";
  return `
    <h3 style="text-align:center;margin-bottom:14px;">${v.title}</h3>
    <div class="edit-form">
      <label>${t("modal.product_name")}<span class="required-badge">${t("modal.required")}</span></label>
      <input type="text" id="edit-name" value="${escapeHtml(v.product_name)}" placeholder="${t("modal.enter_name")}" />
      <label>${t("modal.icon")}<span class="required-badge">${t("modal.required")}</span></label>
      <div id="emoji-picker-container"></div>
      <label>${t("modal.platform")}</label>
      ${await buildPlatformInput(v.platform)}
      <label>${t("modal.purchase_date")}<span class="required-badge">${t("modal.required")}</span></label>
      <input type="datetime-local" id="edit-date" value="${v.order_time}" step="1" />
      <label>${t("modal.total_price")}<span class="required-badge">${t("modal.required")}</span></label>
      <input type="number" id="edit-price" value="${v.total_price}" step="0.01" min="0" />
      <label>${t("modal.quantity")}<span class="required-badge">${t("modal.required")}</span></label>
      <input type="number" id="edit-quantity" value="${v.quantity}" min="1" />

      <div class="optional-section">
        <button class="optional-toggle${v.hasOptional ? " open" : ""}" id="optional-toggle">
          <span>📋 ${t("modal.optional_info")}</span>
          <span class="toggle-arrow">▸</span>
        </button>
        <div class="optional-fields" id="optional-fields" style="display:${v.hasOptional ? "flex" : "none"}">
          <label>${t("modal.store")}</label>
          <input type="text" id="edit-store" value="${escapeHtml(v.store_name)}" placeholder="${t("modal.optional")}" />
          <label>${t("modal.model")}</label>
          <input type="text" id="edit-model" value="${escapeHtml(v.model_style)}" placeholder="${t("modal.optional")}" />
          <label>${t("modal.product_url")}</label>
          <input type="url" id="edit-url" value="${escapeHtml(v.product_url)}" placeholder="${t("modal.url_placeholder")}" />
          <label>${t("category.label")}</label>
          <select id="edit-category">
            <option value="">${t("category.auto_detect")}</option>
            <option value="digital"${catSelected("digital")}>${t("category.digital")}</option>
            <option value="clothing"${catSelected("clothing")}>${t("category.clothing")}</option>
            <option value="food"${catSelected("food")}>${t("category.food")}</option>
            <option value="home"${catSelected("home")}>${t("category.home")}</option>
            <option value="beauty"${catSelected("beauty")}>${t("category.beauty")}</option>
            <option value="game"${catSelected("game")}>${t("category.game")}</option>
            <option value="health"${catSelected("health")}>${t("category.health")}</option>
            <option value="stationery"${catSelected("stationery")}>${t("category.stationery")}</option>
            <option value="auto"${catSelected("auto")}>${t("category.auto")}</option>
            <option value="pet"${catSelected("pet")}>${t("category.pet")}</option>
            <option value="other"${catSelected("other")}>${t("category.other")}</option>
          </select>
          <hr />
          <label>${t("modal.end_status")}</label>
          <select id="edit-end-reason">
            <option value=""${!v.end_reason ? " selected" : ""}>${t("modal.end_active")}</option>
            <option value="sold"${endSelected("sold")}>${t("modal.end_sold")}</option>
            <option value="scrapped"${endSelected("scrapped")}>${t("modal.end_scrapped")}</option>
          </select>
          <div id="end-fields" style="display:${v.end_reason ? "block" : "none"}">
            <label>${t("modal.end_date")}</label>
            <input type="datetime-local" id="edit-end-date" value="${v.end_date}"${endMinAttr} max="${today}" step="1" />
            <div id="sell-price-group" style="display:${v.end_reason === "sold" ? "block" : "none"}">
              <label>${t("modal.sell_price")}</label>
              <input type="number" id="edit-sell-price" value="${v.sell_price}" step="0.01" min="0" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="modal-save-btn">💾 ${t("modal.save")}</button>
      <button class="btn btn-secondary" id="modal-cancel-btn">${t("modal.cancel")}</button>
    </div>
    <button class="btn-icon-only modal-close-btn" id="modal-close-edit-btn" title="${t("modal.close")}">✕</button>
  `;
}

/** 渲染表单并绑定公共事件（emoji 选择器 / 可选区折叠 / 截止联动 / 保存取消） */
async function initItemForm(values: ItemFormValues, onSubmit: () => void, onCancel: () => void): Promise<void> {
  const content = document.getElementById("modal-content")!;
  content.innerHTML = await buildItemFormHtml(values);
  const { initEmojiPicker } = await import("./emoji");
  await initEmojiPicker(document.getElementById("emoji-picker-container")!, values.emoji);
  bindEndReasonToggle();
  bindOptionalToggle();
  document.getElementById("modal-save-btn")!.addEventListener("click", onSubmit);
  document.getElementById("modal-cancel-btn")!.addEventListener("click", onCancel);
  document.getElementById("modal-close-edit-btn")!.addEventListener("click", onCancel);
}

async function renderModalEdit(item: OrderItem) {
  const hasOptional = item.store_name || item.model_style || item.product_url || item.end_reason || item.category;
  const values: ItemFormValues = {
    title: `✏️ ${t("modal.edit_title")}`,
    product_name: item.product_name,
    emoji: item.emoji,
    platform: item.platform,
    order_time: fmtDateTimeLocal(item.order_time),
    total_price: item.total_price,
    quantity: item.quantity,
    store_name: item.store_name,
    model_style: item.model_style,
    product_url: item.product_url,
    category: item.category,
    end_reason: item.end_reason || "",
    end_date: fmtDateTimeLocal(item.end_date),
    sell_price: item.sell_price || 0,
    hasOptional: !!hasOptional,
    endMin: fmtDateTimeLocal(item.order_time),
  };
  await initItemForm(values, () => saveItemEdit(item), () => renderModalView(item));
}

function bindEndReasonToggle() {
  const sel = document.getElementById("edit-end-reason") as HTMLSelectElement;
  const endFields = document.getElementById("end-fields")!;
  const sellGroup = document.getElementById("sell-price-group")!;
  if (!sel) return;
  sel.addEventListener("change", () => {
    const v = sel.value;
    endFields.style.display = v ? "block" : "none";
    sellGroup.style.display = v === "sold" ? "block" : "none";
  });
}

function bindOptionalToggle() {
  const toggle = document.getElementById("optional-toggle");
  const fields = document.getElementById("optional-fields");
  if (!toggle || !fields) return;
  toggle.addEventListener("click", () => {
    const isOpen = fields.style.display !== "none";
    fields.style.display = isOpen ? "none" : "flex";
    toggle.classList.toggle("open", !isOpen);
  });
}

/** 读取编辑表单所有字段，返回数据对象 */
function readEditForm() {
  const endReason = (document.getElementById("edit-end-reason") as HTMLSelectElement).value;
  const endDate = endReason ? fromDateTimeLocal((document.getElementById("edit-end-date") as HTMLInputElement).value) : "";
  const sellPrice = endReason === "sold" ? parseFloat((document.getElementById("edit-sell-price") as HTMLInputElement).value) || 0 : 0;
  return {
    emoji: (document.getElementById("emoji-picker-container")! as any).__getEmoji?.() || "📦",
    product_name: (document.getElementById("edit-name") as HTMLInputElement).value.trim(),
    platform: (document.getElementById("edit-platform") as HTMLInputElement).value.trim(),
    store_name: (document.getElementById("edit-store") as HTMLInputElement).value.trim(),
    model_style: (document.getElementById("edit-model") as HTMLInputElement).value.trim(),
    order_time: fromDateTimeLocal((document.getElementById("edit-date") as HTMLInputElement).value),
    total_price: parseFloat((document.getElementById("edit-price") as HTMLInputElement).value) || 0,
    quantity: parseInt((document.getElementById("edit-quantity") as HTMLInputElement).value) || 1,
    product_url: (document.getElementById("edit-url") as HTMLInputElement).value.trim(),
    end_date: endDate,
    end_reason: endReason,
    sell_price: sellPrice,
    category: (document.getElementById("edit-category") as HTMLSelectElement).value,
  };
}

async function saveItemEdit(item: OrderItem) {
  const updates = readEditForm();
  if (!updates.product_name) { showToast(t("toast.name_required"), "error"); return; }
  const dateErr = validateEndDate(updates.end_date, updates.order_time);
  if (dateErr) { showToast(dateErr, "error"); return; }

  if (isTauri()) {
    try { await invoke("update_item", { id: item.id, ...updates }); } catch (e) { showToast(`${t("toast.save_failed")}: ${e}`, "error"); return; }
  } else {
    browserDb.updateItem(item.id, updates);
  }

  Object.assign(item, updates);
  item.daily_avg_cost = calcDailyAvg(updates.total_price, updates.order_time, updates.end_date || undefined, updates.end_reason === "sold" ? updates.sell_price : undefined);
  showToast(t("toast.saved"), "success");
  renderModalView(item);
  notifyDataChanged();
}

// ── 添加物品 ──────────────────────────────────────────
export async function showAddItemModal() {
  const overlay = document.getElementById("item-modal")!;
  const values: ItemFormValues = {
    title: `➕ ${t("modal.add_title")}`,
    product_name: "",
    emoji: "📦",
    platform: "manual",
    order_time: new Date().toISOString().slice(0, 19),
    total_price: 0,
    quantity: 1,
    store_name: "",
    model_style: "",
    product_url: "",
    category: "",
    end_reason: "",
    end_date: "",
    sell_price: 0,
    hasOptional: false,
  };

  const close = () => { overlay.classList.remove("show"); document.body.style.overflow = ""; };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); } };
  document.addEventListener("keydown", onEsc);

  await initItemForm(values, () => saveNewItem(close), close);
  overlay.classList.add("show");
  document.body.style.overflow = "hidden";
}

async function saveNewItem(close: () => void) {
  const data = readEditForm();
  if (!data.product_name) { showToast(t("toast.name_required"), "error"); return; }
  const dateErr = validateEndDate(data.end_date, data.order_time);
  if (dateErr) { showToast(dateErr, "error"); return; }

  if (isTauri()) {
    try {
      await invoke("add_item", {
        order_id: `manual-${Date.now()}`,
        platform: data.platform,
        store_name: data.store_name,
        product_name: data.product_name,
        model_style: data.model_style,
        quantity: data.quantity,
        total_price: data.total_price,
        order_time: data.order_time,
        emoji: data.emoji,
        product_url: data.product_url,
        end_date: data.end_date,
        end_reason: data.end_reason,
        sell_price: data.sell_price,
        category: data.category,
      });
    } catch (e) { showToast(`${t("toast.add_failed")}: ${e}`, "error"); return; }
  } else {
    await browserDb.addItem(data);
  }

  showToast(t("toast.added"), "success");
  close();
  notifyDataChanged();
}
