// ── 设置页：CSV / Excel 导入 / 数据管理 / 偏好 ─────────────────────

declare const __APP_VERSION__: string;

import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { ImportResult } from "./types";
import { browserDb } from "./db";
import {
  isTauri, isAndroid, showToast, showConfirm,
  readFileAsText, readFileAsArrayBuffer, decodeTextBytes,
  setPrecision, platformLabel, formatPrice, escapeHtml,
} from "./utils";
import { platformColor } from "./theme";
import { savePref } from "./prefs";
import { loadItems } from "./ui-home";
import { showItemModal } from "./ui-modal";
import { t } from "./i18n";
import { onDataChange, notifyDataChanged } from "./data-events";
import { renderEmoji } from "./custom-emoji";
import { fetchArchivedItems, fetchArchivedCount } from "./data";

let importDoneUnlisten: (() => void) | null = null;

export async function initSettings() {
  // ── 文件选择 ──
  if (isTauri()) {
    document.getElementById("btn-pick-file")!.addEventListener("click", async () => {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ multiple: true, filters: [{ name: t("csv.csv_file"), extensions: ["csv", "xlsx"] }] });
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          const btn = document.getElementById("btn-pick-file")!;
          btn.textContent = `📄 ${t("settings.importing")}`; (btn as HTMLButtonElement).disabled = true;

          // Android: content:// URI 需要前端读取文件内容后传给后端
          const isAndroid = paths[0]?.startsWith("content://");
          if (isAndroid) {
            const { readFile } = await import("@tauri-apps/plugin-fs");
            const { basename } = await import("@tauri-apps/api/path");
            const csvContents: string[] = [];
            const csvNames: string[] = [];
            const xlsxBuffers: Uint8Array[] = [];
            const xlsxNames: string[] = [];
            for (const p of paths) {
              const name = await basename(p);
              try {
                if (name.toLowerCase().endsWith(".xlsx")) {
                  // xlsx 为二进制，readTextFile 读不了 → 读字节后走 import_xlsx_content
                  xlsxBuffers.push(await readFile(p));
                  xlsxNames.push(name);
                } else {
                  // 支付宝等 Windows 导出常为 GBK 编码：读原始字节后按编码解码（readTextFile 仅支持 UTF-8）
                  csvContents.push(decodeTextBytes(await readFile(p)));
                  csvNames.push(name);
                }
              } catch (e) {
                showToast(`${t("toast.operation_failed")}: ${p}`, "error");
              }
            }
            if (csvContents.length > 0) {
              const result = await invoke<ImportResult>("import_csv_content", { contents: csvContents, fileNames: csvNames });
              showImportResult(result);
            }
            for (let i = 0; i < xlsxBuffers.length; i++) {
              const result = await invoke<ImportResult>("import_xlsx_content", { data: Array.from(xlsxBuffers[i]), fileNames: [xlsxNames[i]] });
              showImportResult(result);
            }
          } else {
            // Desktop: 直接传递文件路径给后端
            const result = await invoke<ImportResult>("import_multiple_csv", { paths });
            showImportResult(result);
          }

          btn.textContent = `📄 ${t("settings.select_csv")}`; (btn as HTMLButtonElement).disabled = false;
        }
      } catch (e) { showToast(`${t("toast.operation_failed")}: ${e}`, "error"); resetPickBtn(); }
    });
  } else {
    const fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.accept = ".csv,.xlsx"; fileInput.multiple = true;
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
    document.getElementById("btn-pick-file")!.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const files = fileInput.files;
      if (!files || files.length === 0) return;
      const btn = document.getElementById("btn-pick-file")!;
      btn.textContent = `📄 ${t("settings.importing")}`; (btn as HTMLButtonElement).disabled = true;
      await importBrowserFiles(files, t("csv.no_data"));
      fileInput.value = "";
      btn.textContent = `📄 ${t("settings.select_csv")}`; (btn as HTMLButtonElement).disabled = false;
    });
  }

  initDropZone();
  await initDragDropListener();

  // ── 清除数据 ──
  document.getElementById("btn-clear-data")!.addEventListener("click", async () => {
    const ok = await showConfirm(t("confirm.clear_all"));
    if (!ok) return;
    if (isTauri()) {
      try { await invoke("clear_all_data"); } catch (e) { showToast(`${t("toast.operation_failed")}: ${e}`, "error"); return; }
    } else { browserDb.clearAll(); }
    showToast(t("toast.all_cleared"), "success");
    notifyDataChanged();
  });

  // ── 显示总价开关 ──
  (document.getElementById("toggle-show-total") as HTMLInputElement).addEventListener("change", async function () {
    await savePref("show_total_price", this.checked ? "1" : "0");
    loadItems();
  });

  // ── 精度 ──
  (document.getElementById("select-precision") as HTMLSelectElement).addEventListener("change", async function () {
    const p = parseInt(this.value);
    setPrecision(isNaN(p) ? 2 : p);
    await savePref("precision", this.value);
    loadItems();
  });

  // ── 配色方案 ──
  const { applyColorTheme } = await import("./themes");
  const { COLOR_THEME_KEY } = await import("./theme");
  (document.getElementById("select-color-theme") as HTMLSelectElement).addEventListener("change", async function () {
    applyColorTheme(this.value);
    await savePref(COLOR_THEME_KEY, this.value);
  });

  // ── 导出 / 导入数据库（仅 Tauri） ──
  document.getElementById("btn-export-db")!.addEventListener("click", async () => {
    if (!isTauri()) { showToast(t("toast.export_only_desktop"), "info"); return; }
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const savePath = await save({ defaultPath: t("db.backup_name"), filters: [{ name: t("csv.sqlite"), extensions: ["db"] }] });
      if (!savePath) return;
      if (isAndroid()) {
        // Android：save 返回 content:// URI，Rust 无法直接写入
        // 由原生 ContentResolver 插件（BackupPlugin）可靠地复制备份到所选位置
        showToast(await invoke<string>("export_database_to_uri", { dest_uri: savePath }), "success");
      } else {
        showToast(await invoke<string>("export_database", { path: savePath }), "success");
      }
    } catch (e) { showToast(`${t("toast.export_failed")}: ${e}`, "error"); }
  });

  document.getElementById("btn-import-db")!.addEventListener("click", async () => {
    if (!isTauri()) { showToast(t("toast.import_only_desktop"), "info"); return; }
    if (!(await showConfirm(t("confirm.import_db")))) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, filters: [{ name: t("csv.sqlite"), extensions: ["db"] }] });
      if (!selected) return;
      const btn = document.getElementById("btn-import-db")!;
      btn.textContent = `📥 ${t("settings.importing")}`; (btn as HTMLButtonElement).disabled = true;
      let result: string;
      if (isAndroid()) {
        // Android：open 返回 content:// URI，Rust 无法直接读取
        // 前端 readFile 读字节 → import_database_bytes
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const data = await readFile(selected);
        result = await invoke<string>("import_database_bytes", { data: Array.from(data) });
      } else {
        result = await invoke<string>("import_database", { path: selected });
      }
      showToast(result, "success");
      notifyDataChanged();
      btn.textContent = `📥 ${t("settings.import_db")}`; (btn as HTMLButtonElement).disabled = false;
    } catch (e) { showToast(`${t("toast.import_failed")}: ${e}`, "error"); resetImportBtn(); }
  });

  // ── 智能分类：用户可选择仅覆盖 category 或仅覆盖 emoji ──
  document.getElementById("btn-recalculate-categories")!.addEventListener("click", async () => {
    const mode = (document.getElementById("smart-categorize-mode") as HTMLSelectElement).value;
    const fieldLabel = mode === "emoji" ? t("settings.smart_field_emoji") : t("settings.smart_field_category");
    if (!(await showConfirm(t("confirm.recalculate_categories", { field: fieldLabel })))) return;
    const btn = document.getElementById("btn-recalculate-categories")!;
    btn.textContent = `🤖 ${t("settings.smart_categorizing")}`; (btn as HTMLButtonElement).disabled = true;
    try {
      if (isTauri()) {
        const [total, updated] = await invoke<[number, number]>("recalculate_categories", { mode });
        showToast(t("settings.smart_categorize_done", { total, updated }), "success");
      } else {
        // 浏览器端：根据 mode 仅更新对应字段
        const updates: Array<{ id: number; data: { category?: string; emoji?: string } }> = [];
        const allItems = [...browserDb.getItems(), ...browserDb.getArchivedItems()];
        const { matchProductCategory } = await import("./utils");
        for (const item of allItems) {
          const [cat, em] = matchProductCategory(item.product_name, item.store_name, item.platform);
          if (mode === "emoji") {
            if (item.emoji !== em) updates.push({ id: item.id, data: { emoji: em } });
          } else {
            if (item.category !== cat) updates.push({ id: item.id, data: { category: cat } });
          }
        }
        const updated = browserDb.updateItems(updates);
        const totalItems = browserDb.getItemCount() + browserDb.getArchivedCount();
        showToast(t("settings.smart_categorize_done", { total: totalItems, updated }), updated > 0 ? "success" : "info");
      }
      notifyDataChanged();
    } catch (e) { showToast(`${t("toast.operation_failed")}: ${e}`, "error"); }
    btn.textContent = `🤖 ${t("settings.smart_categorize")}`; (btn as HTMLButtonElement).disabled = false;
  });

  // ── 手动检查更新（双通道：Tauri updater → GitHub API 回退）──
  const btnUpdate = document.getElementById("btn-check-update");
  if (btnUpdate) {
    btnUpdate.addEventListener("click", async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById("update-status")!;
      btnUpdate.textContent = t("about.checking");
      statusEl.textContent = "";
      statusEl.className = "about-update";

      try {
        // 双通道检查：桌面端通道 A（updater）权威，A 不可用才回退通道 B（GitHub API）
        const { checkForUpdates, renderAutoUpdateStatus } = await import("./utils");
        const { update, info, updaterUsable, updaterFailed } = await checkForUpdates(__APP_VERSION__);
        if (update) {
          renderAutoUpdateStatus(update);
          btnUpdate.textContent = t("about.check_update");
          return;
        }
        // 通道 A 可用且无更新 → 已是最新，不再调 GitHub API（避免 api.github.com 限流 403）
        if (updaterUsable) {
          statusEl.textContent = t("about.up_to_date");
          statusEl.className = "about-update";
          statusEl.style.color = "var(--primary)";
          return;
        }
        // 桌面端通道 A 检查失败（网络/临时问题）→ 提示重试，不降级到「前往下载」
        if (updaterFailed) {
          statusEl.textContent = t("about.network_error");
          statusEl.className = "about-update update-error";
          return;
        }
        // 通道 B：GitHub API（Android/浏览器 → 引导手动下载）
        if (info) {
          statusEl.innerHTML = `🆕 <a href="${info.releaseUrl}" target="_blank" style="color:inherit;text-decoration:underline">${t("about.update_manual", { version: info.version })}</a>`;
          statusEl.className = "about-update update-available";
        } else {
          statusEl.textContent = t("about.up_to_date");
          statusEl.className = "about-update";
          statusEl.style.color = "var(--primary)";
        }
      } catch (e) {
        const msg = e instanceof TypeError ? t("about.network_error") : `${t("about.update_failed")}: ${e}`;
        statusEl.textContent = msg;
        statusEl.className = "about-update update-error";
      } finally {
        btnUpdate.textContent = t("about.check_update");
      }
    });
  }

  // ── 注册数据变更监听：数据变更后自动刷新批次和归档计数 ──
  onDataChange(() => {
    loadBatches();
  });
}

function resetPickBtn() { const b = document.getElementById("btn-pick-file")!; b.textContent = `📄 ${t("settings.select_csv")}`; (b as HTMLButtonElement).disabled = false; }
function resetImportBtn() { const b = document.getElementById("btn-import-db")!; b.textContent = `📥 ${t("settings.import_db")}`; (b as HTMLButtonElement).disabled = false; }

/** 浏览器端批量导入文件（xlsx→微信解析，csv→通用解析），聚合结果后展示 */
async function importBrowserFiles(files: Iterable<File>, emptyMessage: string): Promise<void> {
  let result: ImportResult = { success: false, imported: 0, skipped: 0, message: "" };
  for (const file of files) {
    const low = file.name.toLowerCase();
    try {
      if (low.endsWith(".xlsx")) {
        const buf = await readFileAsArrayBuffer(file);
        const r = await browserDb.importBillXlsx(buf, file.name);
        result.imported += r.imported; result.skipped += r.skipped;
        result.success = result.success || r.success;
        result.message += (result.message ? "\n" : "") + r.message;
      } else {
        const text = await readFileAsText(file);
        const r = await browserDb.importFromCsvText(text, file.name);
        result.imported += r.imported;
        result.skipped += r.skipped;
        result.success = result.success || r.success;
        result.message += (result.message ? "\n" : "") + r.message;
      }
    } catch { result.skipped++; }
  }
  if (!result.message) result.message = emptyMessage;
  showImportResult(result);
}

// ── 拖拽导入 ──────────────────────────────────────────
function initDropZone() {
  const dropZone = document.getElementById("drop-zone")!;
  if (!dropZone) return;
  ["dragenter", "dragover"].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add("drop-zone-active"); }));
  ["dragleave", "drop"].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove("drop-zone-active")));

  dropZone.addEventListener("drop", async (e: Event) => {
    e.preventDefault();
    const files = (e as DragEvent).dataTransfer?.files;
    if (!files || files.length === 0) return;

    if (isTauri()) {
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const p = (files[i] as any).path || files[i].name;
        const low = p.toLowerCase();
        if (low.endsWith(".csv") || low.endsWith(".xlsx")) paths.push(p);
      }
      if (paths.length === 0) { showToast(t("toast.csv_only"), "error"); return; }
      try {
        showImportResult(await invoke<ImportResult>("import_multiple_csv", { paths }));
      } catch (e) { showToast(`${t("toast.import_failed")}: ${e}`, "error"); }
    } else {
      // 仅保留 CSV/Excel（保持原有拖拽过滤行为，非目标文件静默跳过）
      const csvFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const low = files[i].name.toLowerCase();
        if (low.endsWith(".csv") || low.endsWith(".xlsx")) csvFiles.push(files[i]);
      }
      await importBrowserFiles(csvFiles, t("csv.no_csv"));
    }
  });
}

async function initDragDropListener() {
  if (importDoneUnlisten) { importDoneUnlisten(); importDoneUnlisten = null; }
  if (!isTauri()) return;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    importDoneUnlisten = await listen<ImportResult>("import-done", e => showImportResult(e.payload));
  } catch { /* ignore */ }
}

export function showImportResult(result: ImportResult) {
  // 确保 notifyDataChanged 不被前面任何异常阻塞
  try {
    const el = document.getElementById("import-status");
    if (el) el.innerHTML = `<div class="status-${result.success ? "success" : "error"}">${(result.message || "").replace(/\n/g, "<br>")}</div>`;
    showToast(result.success ? t("toast.import_done") : (result.message || t("toast.operation_failed")), result.success ? "success" : "error");
  } catch (e) { console.warn("[Import] UI error:", e); }
  // 无论 UI 更新是否成功，数据变更通知必须发出
  notifyDataChanged();
}

// ── 批次 ──────────────────────────────────────────────
export async function loadBatches() {
  const list = document.getElementById("batches-list")!;
  const dbPathEl = document.getElementById("db-path-text");
  if (isTauri()) {
    try {
      // 并行获取批次与数据库路径，减少串行 IPC 往返（移动端切页更跟手）
      const [batches, dbPath] = dbPathEl
        ? await Promise.all([
            invoke<string[]>("get_import_batches"),
            invoke<string>("get_database_path"),
          ])
        : [await invoke<string[]>("get_import_batches"), ""];
      list.innerHTML = batches.length === 0
        ? `<div class="empty-inline">${t("settings.no_batches")}</div>`
        : batches.map(b => `<div class="batch-item">📅 ${b}</div>`).join("");
      if (dbPathEl) {
        dbPathEl.textContent = dbPath;
        dbPathEl.classList.add("clickable-path");
        if (isAndroid()) {
          // Android：数据库在应用私有目录，文件管理器不可访问，点击引导使用「导出存档」备份
          dbPathEl.title = t("settings.db_path_android");
          dbPathEl.addEventListener("click", () => showToast(t("toast.db_path_android"), "info"));
        } else {
          dbPathEl.title = t("settings.db_path_click");
          dbPathEl.addEventListener("click", () => {
            revealItemInDir(dbPath).catch(() => showToast(t("toast.open_folder_failed"), "error"));
          });
        }
      }
    } catch (e) { list.innerHTML = `<div class="empty-inline">${t("empty.load_error")}: ${e}</div>`; }
  } else {
    const batches = browserDb.getBatches();
    list.innerHTML = batches.length === 0
      ? `<div class="empty-inline">${t("settings.no_batches_browser")}</div>`
      : batches.map(b => `<div class="batch-item">📅 ${b}</div>`).join("");
    if (dbPathEl) {
      dbPathEl.textContent = t("settings.db_path_browser");
      dbPathEl.classList.remove("clickable-path");
      dbPathEl.title = "";
    }
  }
  loadArchivedCount();
}

// ── 归档管理 ──────────────────────────────────────────
let archivedItems: import("./types").OrderItem[] = [];
const selectedArchived = new Set<number>();

export async function loadArchivedCount() {
  const countEl = document.getElementById("archived-count");
  const listEl = document.getElementById("archived-items-list");
  const barEl = document.getElementById("archive-batch-bar");
  if (!countEl || !listEl) return;

  try {
    const [count, items] = await Promise.all([
      fetchArchivedCount(),
      fetchArchivedItems(),
    ]);

    archivedItems = items;
    selectedArchived.clear();
    countEl.textContent = `${count}`;
    if (barEl) barEl.style.display = "none";

    if (items.length === 0) {
      listEl.innerHTML = `<div class="empty-inline">${t("archive.no_items")}</div>`;
      return;
    }

    const allChecked = selectedArchived.size === items.length;
    listEl.innerHTML = `
      <div class="archive-select-all">
        <label class="archive-check-label">
          <input type="checkbox" id="archive-select-all" ${allChecked ? "checked" : ""} />
          <span>${t("archive.select_all")}</span>
        </label>
        <span class="archive-selected-hint" id="archive-selected-hint">${selectedArchived.size > 0 ? t("archive.selected_count", { count: selectedArchived.size }) : ""}</span>
      </div>
      ${items.map(item => {
        const pc = platformColor(item.platform);
        const checked = selectedArchived.has(item.id) ? "checked" : "";
        return `
        <div class="batch-item archived-item" data-id="${item.id}">
          <input type="checkbox" class="archive-item-cb" data-id="${item.id}" ${checked} />
          <span class="archived-item-emoji">${renderEmoji(item.emoji)}</span>
          <span class="archived-item-name">${escapeHtml(item.product_name)}</span>
          <span class="tag tag-platform" style="background:${pc.bg};color:${pc.fg}">${platformLabel(item.platform)}</span>
          <span class="archived-item-price">${formatPrice(item.total_price)}</span>
        </div>`;
      }).join("")}
    `;

    // 全选
    const selectAllCb = listEl.querySelector<HTMLInputElement>("#archive-select-all")!;
    selectAllCb.addEventListener("change", () => {
      const cbs = listEl.querySelectorAll<HTMLInputElement>(".archive-item-cb");
      if (selectAllCb.checked) {
        cbs.forEach(cb => { cb.checked = true; selectedArchived.add(parseInt(cb.dataset.id!)); });
      } else {
        cbs.forEach(cb => { cb.checked = false; selectedArchived.delete(parseInt(cb.dataset.id!)); });
      }
      updateBatchBar();
    });

    // 单项选择
    listEl.querySelectorAll<HTMLInputElement>(".archive-item-cb").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = parseInt(cb.dataset.id!);
        cb.checked ? selectedArchived.add(id) : selectedArchived.delete(id);
        selectAllCb.checked = selectedArchived.size === items.length;
        updateBatchBar();
      });
    });

    // 点击行跳详情（排除 checkbox 区域）
    listEl.querySelectorAll(".archived-item").forEach(row => {
      row.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("input[type=checkbox]")) return;
        const id = parseInt(row.getAttribute("data-id")!);
        const item = archivedItems.find(i => i.id === id);
        if (item) showItemModal(item);
      });
    });

    // 批量操作栏按钮
    if (barEl) {
      barEl.querySelector("#btn-batch-restore")?.addEventListener("click", batchRestore);
      barEl.querySelector("#btn-batch-delete")?.addEventListener("click", batchDelete);
    }
  } catch (e) {
    countEl.textContent = "0";
    listEl.innerHTML = `<div class="empty-inline">${t("empty.load_error")}: ${e}</div>`;
  }
}

function updateBatchBar() {
  const barEl = document.getElementById("archive-batch-bar");
  const hint = document.getElementById("archive-selected-hint");
  if (!barEl) return;
  const show = selectedArchived.size > 0;
  barEl.style.display = show ? "flex" : "none";
  if (hint) hint.textContent = show ? t("archive.selected_count", { count: selectedArchived.size }) : "";
}

async function batchRestore() {
  if (selectedArchived.size === 0) return;
  const ok = await showConfirm(t("confirm.batch_restore", { count: selectedArchived.size }));
  if (!ok) return;
  const ids = [...selectedArchived];
  if (isTauri()) {
    try { await invoke("batch_restore_items", { ids }); } catch (e) { showToast(`${t("toast.operation_failed")}: ${e}`, "error"); return; }
  } else {
    browserDb.batchRestoreItems(ids);
  }
  showToast(t("toast.batch_restored", { count: ids.length }), "success");
  refreshAfterArchiveAction();
}

async function batchDelete() {
  if (selectedArchived.size === 0) return;
  const ok = await showConfirm(t("confirm.batch_permanent_delete", { count: selectedArchived.size }));
  if (!ok) return;
  const ids = [...selectedArchived];
  if (isTauri()) {
    try { await invoke("batch_delete_items", { ids }); } catch (e) { showToast(`${t("toast.operation_failed")}: ${e}`, "error"); return; }
  } else {
    browserDb.batchPermanentDeleteItems(ids);
  }
  showToast(t("toast.batch_deleted", { count: ids.length }), "success");
  refreshAfterArchiveAction();
}

function refreshAfterArchiveAction() {
  selectedArchived.clear();
  notifyDataChanged();
}
