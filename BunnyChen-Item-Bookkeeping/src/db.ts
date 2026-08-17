// ── 浏览器端内存数据库 ────────────────────────────────────
// Tauri 桌面端走 Rust 后端，浏览器端用 sessionStorage 模拟

import type { OrderItem, ImportResult, IncomeRecord, WechatAnalytics, IncomeByType, IncomePeer, WechatMonthly } from "./types";
import {
  parseCsv, extractJdUrl, platformLabel, detectPlatform,
  calcDailyAvg, normalizeDate, excelSerialToDate,
} from "./utils";
import { t } from "./i18n";

// 浏览器端用 localStorage（持久化），替代 sessionStorage（会话级）
const BROWSER_DB_KEY = "bookkeeping_browser_items";
// 微信收入/回款独立持久化（与物品数据分离，避免污染历史 localStorage 数据）
const BROWSER_DB_INCOME_KEY = "bookkeeping_browser_incomes";
const storage = typeof localStorage !== "undefined" ? localStorage : sessionStorage;

// 有效订单完成态（京东: 已完成；淘宝: 交易成功/已签收/交易完成）
const VALID_ORDER_STATUSES = new Set(["已完成", "交易成功", "已签收", "交易完成"]);

// ── 跨平台去重（微信/支付宝账单 ↔ 京东/淘宝订单）──────────────────
// 同一笔消费可能同时出现在「平台订单 CSV」与「支付账单」中：微信可支付淘宝/京东、
// 支付宝可支付淘宝。账单「商户单号/商家订单号」常以平台订单号为后缀
// （如支付宝商家订单号 `T200P<淘宝订单号>`、微信商户单号即平台订单号）。
// 规则：账单商家单号以订单平台订单号为后缀 且 金额一致（±0.01）→ 跨平台重复。
// 双方向生效：无论先导平台订单还是先导账单，都能拦截重复记账。语义同 Rust 端。

/** 账单记录（微信/支付宝）是否与订单平台（京东/淘宝）已有记录重复 */
function isBillDupWithOrder(productId: string, amount: number, orderPlatform: Map<string, number>): boolean {
  if (!productId || amount <= 0) return false;
  for (const [oid, oamt] of orderPlatform) {
    if (productId.endsWith(oid) && Math.abs((oamt || 0) - amount) < 0.011) return true;
  }
  return false;
}

/** 订单平台记录（京东/淘宝）是否与账单（微信/支付宝）已有记录重复 */
function isOrderDupWithBill(orderId: string, amount: number, bills: Array<[string, number]>): boolean {
  if (!orderId || amount <= 0) return false;
  return bills.some(([pid, amt]) => pid.endsWith(orderId) && Math.abs((amt || 0) - amount) < 0.011);
}

/** 跨平台去重提示文案（n>0 时返回说明，否则空） */
function crossDupNote(n: number): string {
  return n > 0 ? t("csv.cross_platform_dup", { count: n }) : "";
}

class BrowserDb {
  private items: OrderItem[] = [];
  private nextId = 1;
  private incomes: IncomeRecord[] = [];
  private nextIncomeId = 1;

  constructor() {
    this.load();
    this.recalcDailyCost();
  }

  private load() {
    let normalized = false;
    try {
      const raw = storage.getItem(BROWSER_DB_KEY);
      if (raw) {
        this.items = JSON.parse(raw);
        // 迁移：为旧数据补充新字段默认值
        for (const item of this.items) {
          item.end_date ??= "";
          item.end_reason ??= "";
          item.sell_price ??= 0;
          item.archived ??= false;
          item.category ??= "";
        }
        // 迁移：平台值归一化（旧版样例数据用中文 京东/淘宝/Steam，CSV 导入用缩写 jd/tb/steam，
        // 合并同一平台的不同写法，避免平台筛选下拉重复与统计拆分）
        const PLATFORM_NORM: Record<string, string> = { "京东": "jd", "淘宝": "tb", "Steam": "steam", "支付宝": "alipay" };
        for (const item of this.items) {
          const norm = PLATFORM_NORM[item.platform];
          if (norm) { item.platform = norm; normalized = true; }
        }
        this.nextId = this.items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
      }
    } catch { /* ignore */ }
    try {
      const rawIncome = storage.getItem(BROWSER_DB_INCOME_KEY);
      if (rawIncome) {
        this.incomes = JSON.parse(rawIncome);
        this.nextIncomeId = this.incomes.reduce((max, i) => Math.max(max, i.id), 0) + 1;
      }
    } catch { /* ignore */ }
    // 仅当确有脏平台值时持久化一次（避免每次启动写库；此时 items/incomes 均已加载完成）
    if (normalized) this.save();
  }

  private save() {
    try {
      storage.setItem(BROWSER_DB_KEY, JSON.stringify(this.items));
      storage.setItem(BROWSER_DB_INCOME_KEY, JSON.stringify(this.incomes));
    } catch (e) {
      // localStorage 配额耗尽等异常：避免中断当前操作，仅记录告警
      console.warn("[BrowserDb] 保存失败（可能超出 localStorage 配额）:", e);
    }
  }

  /** 解析 CSV 文本并导入 */
  async importFromCsvText(text: string, fileName: string): Promise<ImportResult> {
    // 文件名前缀优先，失败时按内容头回退（与 Rust 端规则一致）
    const platform = detectPlatform(fileName, text);
    const rows = parseCsv(text);
    if (rows.length < 2) return { success: false, imported: 0, skipped: 0, message: t("csv.invalid") };

    if (platform === "unknown") {
      return { success: false, imported: 0, skipped: 0, message: `无法识别 "${fileName}" 的平台类型，请确保文件名以 jd-/tb-/steam-/wx- 开头` };
    }

    if (platform === "steam") return this.importSteamCsv(rows, fileName);
    if (platform === "wx") return this.importWechatRows(rows, fileName);
    if (platform === "alipay") return this.importAlipayRows(rows, fileName);
    return this.importJdTbCsv(rows, fileName, platform);
  }

  private async importJdTbCsv(rows: string[][], fileName: string, platform: string): Promise<ImportResult> {
    const headers = rows[0];
    const col: Record<string, number> = {};
    headers.forEach((h, i) => { col[h.trim()] = i; });
    const { matchProductCategory } = await import("./utils");

    // 校验必需列头（避免列名变化时静默全跳过）
    const missing = ["订单编号", "商品名称"].filter(h => !headers.some(x => x.trim() === h));
    if (missing.length > 0) {
      return { success: false, imported: 0, skipped: 0, message: `CSV 缺少必需列: ${missing.join("、")}（请使用浏览器扩展导出的标准文件）` };
    }

    // 预构建去重缓存（Set 内存比对，避免逐条 O(n²) 线性扫描）
    const multiDedup = new Set<string>();   // key: order_id
    const singleDedup = new Set<string>();  // key: order_id::product_name::model_style
    for (const it of this.items) {
      if (it.platform !== platform) continue;
      multiDedup.add(it.order_id);
      singleDedup.add(`${it.order_id}::${it.product_name}::${it.model_style}`);
    }

    // 拆分 \n 连接的多值字段（JD/TB 导出器对多商品订单使用 \n 拼接）
    const splitLines = (raw: string): string[] =>
      raw.split("\n").map(s => s.trim()).filter(s => s.length > 0);

    // 跨平台去重索引：淘宝/京东可被微信/支付宝支付，检查是否已在账单入库
    const billProducts: Array<[string, number]> = this.items
      .filter(i => (i.platform === "wx" || i.platform === "alipay") && i.product_id && i.total_price > 0)
      .map(i => [i.product_id, i.total_price]);

    let imported = 0, skipped = 0, crossDup = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2) { skipped++; continue; }

      const orderId = (row[col["订单编号"]] || "").trim();
      if (!orderId) { skipped++; continue; }

      // 只保留有效完成态的订单（京东: 已完成；淘宝: 交易成功/已签收/交易完成）
      const status = (row[col["订单状态"]] || "").trim();
      if (status && !VALID_ORDER_STATUSES.has(status)) { skipped++; continue; }

      const parentOrderId = (row[col["父订单编号"]] || "").trim();
      const storeName = (row[col["店铺名称"]] || "").trim();
      const importBatch = `${platformLabel(platform)} · ${(row[col["导出批次"]] || fileName).trim()}`;
      const orderTime = normalizeDate((row[col["付款时间"]] || row[col["下单时间"]] || "").trim());

      // 拆分 \n 连接的多商品字段
      const names = splitLines(row[col["商品名称"]] || "");
      const styles = splitLines(row[col["型号款式"]] || "");
      const pids = splitLines(row[col["商品编号"]] || "");
      const qtyStrs = splitLines(row[col["商品数量"]] || "");
      const paidAmount = (row[col["实付金额"]] || "").trim();
      const priceStrs = splitLines(row[col["商品总价"]] || paidAmount || "");
      const urls = splitLines(row[col["商品链接"]] || "");
      const n = names.length || 1;

      // 多商品订单 → 合并为一行，总价取实付金额（真实订单总额）
      if (n > 1) {
        const pn = names[0];
        const items = names.map((nm, i) => `${nm}${pids[i] ? ` #${pids[i]}` : ""}`);
        const summary = `共${n}件\n${items.join("\n")}`;
        const rawQtySum = qtyStrs.reduce((s, v) => s + (parseInt(v) || 1), 0);
        const totalQty = rawQtySum > 0 ? rawQtySum : n;
        const price = parseFloat(paidAmount) || priceStrs.reduce((s, v) => s + (parseFloat(v) || 0), 0);
        const pid = pids[0] || "";
        const productUrl = platform === "tb" ? (urls[0] || "") : extractJdUrl(row[col["商品明细JSON"]] || "", pn);

        // 跨平台去重：该订单已以微信/支付宝账单入库 → 跳过
        if (isOrderDupWithBill(orderId, price, billProducts)) { crossDup++; skipped++; continue; }

        if (!multiDedup.has(orderId)) {
          const [cat, emoji] = matchProductCategory(pn, storeName, platform);
          this.items.push({
            id: this.nextId++,
            order_id: orderId,
            parent_order_id: parentOrderId,
            product_id: pid,
            platform,
            store_name: storeName,
            product_name: pn,
            model_style: summary,
            quantity: totalQty,
            total_price: price,
            order_time: orderTime,
            daily_avg_cost: 0,
            emoji,
            import_batch: importBatch,
            product_url: productUrl,
            end_date: "",
            end_reason: "",
            sell_price: 0,
            archived: false,
            category: cat,
          });
          multiDedup.add(orderId);
          singleDedup.add(`${orderId}::${pn}::${summary}`);
          imported++;
        } else {
          skipped++;
        }
        continue;
      }

      for (let i = 0; i < n; i++) {
        const pn = names[i] || "";
        if (!pn || pn === "商品名称") { skipped++; continue; }

        const ms = styles[i] || "";
        const pid = pids[i] || "";
        const qty = parseInt(qtyStrs[i] || "1") || 1;
        // 单商品：优先取实付金额（订单真实支付总额），数量>1 时商品总价可能仅为单价
        const paidPrice = parseFloat(paidAmount) || 0;
        const price = paidPrice > 0 ? paidPrice : (parseFloat(priceStrs[i] || priceStrs[0] || "0") || 0);

        let productUrl = "";
        if (platform === "tb") {
          productUrl = urls[i] || "";
        } else if (platform === "jd") {
          productUrl = extractJdUrl(row[col["商品明细JSON"]] || "", pn);
        }

        // 去重：同平台+同订单+同商品名+同型号才视为重复（Set 内存比对）
        const dedupKey = `${orderId}::${pn}::${ms}`;
        if (singleDedup.has(dedupKey)) { skipped++; continue; }

        // 跨平台去重：该订单已以微信/支付宝账单入库 → 跳过
        if (isOrderDupWithBill(orderId, price, billProducts)) { crossDup++; skipped++; continue; }

        const [catSingle, emojiSingle] = matchProductCategory(pn, storeName, platform);
        this.items.push({
          id: this.nextId++,
          order_id: orderId,
          parent_order_id: parentOrderId,
          product_id: pid,
          platform,
          store_name: storeName,
          product_name: pn,
          model_style: ms,
          quantity: qty,
          total_price: price,
          order_time: orderTime,
          daily_avg_cost: 0,
          emoji: emojiSingle,
          import_batch: importBatch,
          product_url: productUrl,
          end_date: "",
          end_reason: "",
          sell_price: 0,
          archived: false,
          category: catSingle,
        });
        singleDedup.add(dedupKey);
        multiDedup.add(orderId);
        imported++;
      }
    }

    this.recalcDailyCost();
    this.save();
    return { success: imported > 0, imported, skipped, message: t("csv.import_success", { imported, skipped }) + crossDupNote(crossDup) };
  }

  private async importSteamCsv(rows: string[][], fileName: string): Promise<ImportResult> {
    const headers = rows[0];
    const col: Record<string, number> = {};
    headers.forEach((h, i) => { col[h.trim()] = i; });
    const { matchProductCategory } = await import("./utils");

    // 校验必需列头（避免列名变化时静默全跳过）
    const missing = ["交易ID", "物品名称"].filter(h => !headers.some(x => x.trim() === h));
    if (missing.length > 0) {
      return { success: false, imported: 0, skipped: 0, message: `Steam CSV 缺少必需列: ${missing.join("、")}（请使用浏览器扩展导出的标准文件）` };
    }

    // 预构建 Steam 去重缓存（Set 内存比对，避免逐条 O(n²) 线性扫描）
    const steamDedup = new Set(this.items.filter(i => i.platform === "steam").map(i => i.order_id));

    // 收集退款金额（按交易 ID）：Steam 对"购买后退款"导出两行（原购买行 + 退款行）。
    // 整单退款购买行与退款行金额相等 → 净额 0，整体跳过；
    // 部分退款（同订单仅部分物品被退）→ 购买行金额大于退款行，保留净额。
    // 同时跳过钱包充值（"已购买 XX 钱包资金"），避免与后续钱包消费重复计入。
    const refundByTid = new Map<string, number>();
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const tid = (row[col["交易ID"]] || "").trim();
      if (tid && (row[col["类型"]] || "").trim() === "退款") {
        refundByTid.set(tid, (refundByTid.get(tid) || 0) + (parseFloat((row[col["总计"]] || "0").trim()) || 0));
      }
    }

    let imported = 0, skipped = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2) { skipped++; continue; }

      const transactionId = (row[col["交易ID"]] || "").trim();
      if (!transactionId) { skipped++; continue; }

      const orderType = (row[col["类型"]] || "").trim();
      if (orderType === "退款") { skipped++; continue; }

      const productName = (row[col["物品名称"]] || "").trim();
      if (!productName || productName === "物品名称") { skipped++; continue; }
      // 跳过钱包充值（非物品购买）
      if (productName.includes("钱包资金")) { skipped++; continue; }

      if (steamDedup.has(transactionId)) {
        skipped++; continue;
      }

      const totalPrice = parseFloat((row[col["总计"]] || "0").trim()) || 0;
      if (totalPrice <= 0) { skipped++; continue; }

      // 净额 = 购买金额 - 该交易退款金额（整单退款 → 净额 0 跳过；部分退款 → 保留净额）
      const netPrice = totalPrice - (refundByTid.get(transactionId) || 0);
      if (netPrice <= 0) { skipped++; continue; }

      const importBatch = `Steam · ${(row[col["导出批次"]] || fileName).trim()}`;
      const [cat, emoji] = matchProductCategory(productName, "", "steam");

      this.items.push({
        id: this.nextId++,
        order_id: transactionId,
        parent_order_id: "",
        product_id: "",
        platform: "steam",
        store_name: "",
        product_name: productName,
        model_style: "",
        quantity: 1,
        total_price: netPrice,
        order_time: normalizeDate((row[col["日期"]] || "").trim()),
        daily_avg_cost: 0,
        emoji,
        import_batch: importBatch,
        product_url: "",
        end_date: "",
        end_reason: "",
        sell_price: 0,
        archived: false,
        category: cat,
      });
      steamDedup.add(transactionId);
      imported++;
    }

    this.recalcDailyCost();
    this.save();
    return { success: imported > 0, imported, skipped, message: t("csv.import_success_steam", { imported, skipped }) };
  }

  /** 从微信账单 CSV 文本导入 */
  async importWechatCsv(text: string, fileName: string): Promise<ImportResult> {
    return this.importWechatRows(parseCsv(text), fileName);
  }

  /** 从账单 xlsx（ArrayBuffer）导入：浏览器端用 SheetJS 读为二维数组；自动识别微信/支付宝表头 */
  async importBillXlsx(buffer: ArrayBuffer, fileName: string): Promise<ImportResult> {
    const { default: XLSX } = await import("@e965/xlsx");
    const wb = XLSX.read(buffer, { type: "array" });
    for (const sheetName of wb.SheetNames) {
      const sheetData = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, raw: false, defval: "" });
      // 支付宝表头（交易订单号）优先判断，与微信（交易单号）互不包含
      if (sheetData.some(r => r.includes("交易订单号") && r.includes("金额"))) {
        return this.importAlipayRows(sheetData, fileName);
      }
      if (sheetData.some(r => r.includes("交易单号") && r.includes("金额(元)"))) {
        return this.importWechatRows(sheetData, fileName);
      }
    }
    return { success: false, imported: 0, skipped: 0, message: `xlsx 中未找到微信/支付宝账单表头（需含「交易单号」或「交易订单号」列）` };
  }

  /** 微信账单核心解析（CSV/xlsx 共用二维数组）——语义同 Rust 端 parse_wechat_rows */
  private async importWechatRows(rows: string[][], fileName: string): Promise<ImportResult> {
    // 定位表头行（跳过前 5 行元数据，至多扫描前 200 行）
    let headerIdx = -1;
    const col: Record<string, number> = {};
    const findCol = (r: string[]) => {
      col["交易时间"] = r.indexOf("交易时间");
      col["交易对方"] = r.indexOf("交易对方");
      col["商品"] = r.indexOf("商品");
      col["收/支"] = r.indexOf("收/支");
      col["交易类型"] = r.indexOf("交易类型");
      col["金额(元)"] = r.indexOf("金额(元)");
      col["支付方式"] = r.indexOf("支付方式");
      col["当前状态"] = r.indexOf("当前状态");
      col["交易单号"] = r.indexOf("交易单号");
      col["商户单号"] = r.indexOf("商户单号");
      col["备注"] = r.indexOf("备注");
    };
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const r = rows[i];
      if (r.includes("交易单号") && r.includes("金额(元)")) { headerIdx = i; findCol(r); break; }
    }
    const cell = (row: string[], key: string): string => {
      const idx = col[key];
      return idx !== undefined && idx >= 0 ? (row[idx] || "").trim() : "";
    };
    if (headerIdx === -1) {
      return { success: false, imported: 0, skipped: 0, message: `未找到微信账单表头（需含「交易单号」「金额(元)」列），请确认文件为微信支付账单流水` };
    }

    // 预构建微信去重缓存（支出与收入各自独立，交易单号互不冲突）
    const wxDedup = new Set(this.items.filter(i => i.platform === "wx").map(i => i.order_id));
    const incomeDedup = new Set(this.incomes.map(i => i.order_id));
    const { matchProductCategory } = await import("./utils");

    // 跨平台去重索引：微信可支付淘宝/京东，检查是否已在京东/淘宝订单入库
    const orderPlatform = new Map<string, number>(
      this.items.filter(i => (i.platform === "jd" || i.platform === "tb") && i.order_id && i.total_price > 0)
        .map(i => [i.order_id, i.total_price]),
    );

    let imported = 0, incomeImported = 0, skipped = 0, crossDup = 0;
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) { skipped++; continue; }
      const orderId = cell(row, "交易单号");
      if (!orderId) { skipped++; continue; }
      // 收/支分流：支出 → items 物品表；收入（AA 转账回款/退款/红包等）→ incomes 回款表
      const incomeExpense = cell(row, "收/支");
      if (incomeExpense === "收入") {
        // 排除法：仅跳过明显失败/未完成流水（收入行状态值多样，避免漏导回款）
        const status = cell(row, "当前状态");
        if (["交易失败", "支付失败", "已关闭", "已撤销", "已冻结", "失败"].includes(status)) { skipped++; continue; }
        const amount = Math.abs(parseFloat(cell(row, "金额(元)").replace(/[^\d.\-]/g, "")) || 0);
        if (amount <= 0) { skipped++; continue; }
        if (incomeDedup.has(orderId)) { skipped++; continue; }
        this.incomes.push({
          id: this.nextIncomeId++,
          order_id: orderId,
          platform: "wx",
          peer: cell(row, "交易对方"),
          income_type: cell(row, "交易类型"),
          amount,
          order_time: normalizeDate(excelSerialToDate(cell(row, "交易时间"))),
          status,
          import_batch: `微信 · ${fileName}`,
        });
        incomeDedup.add(orderId);
        incomeImported++;
        continue;
      }
      // 仅导入支出流水（不计收支/`/` 跳过）
      if (incomeExpense !== "支出") { skipped++; continue; }
      // 状态白名单（退款/异常等跳过；已转账/对方已收钱 = 扫二维码付款/转账等非购物流水完成态，须放行）
      const status = cell(row, "当前状态");
      if (status && !["", "/", "支付成功", "已支付", "交易成功", "完成", "已转账", "对方已收钱"].includes(status)) { skipped++; continue; }

      // 商品名回退到交易对方
      let productName = cell(row, "商品");
      if (!productName || productName === "/") productName = cell(row, "交易对方");
      if (!productName) { skipped++; continue; }

      // 金额取绝对值（兼容 ¥/千分位格式；与 Rust 端 parse_wechat_amount 一致）
      const amount = Math.abs(parseFloat(cell(row, "金额(元)").replace(/[^\d.\-]/g, "")) || 0);
      if (amount <= 0) { skipped++; continue; }
      if (wxDedup.has(orderId)) { skipped++; continue; }

      // 跨平台去重：同一笔消费已以京东/淘宝订单入库（商户单号=平台单号后缀+金额一致）→ 跳过
      const productId = cell(row, "商户单号");
      if (isBillDupWithOrder(productId, amount, orderPlatform)) { crossDup++; skipped++; continue; }

      // 支付方式 + 备注合并到型号区
      let remark = cell(row, "备注");
      if (remark === "/") remark = "";
      const payMethod = cell(row, "支付方式");
      const modelStyle = !remark ? payMethod
        : (!payMethod || payMethod === "/") ? remark
        : `${payMethod}\n${remark}`;

      const storeName = cell(row, "交易对方");
      const [cat, emoji] = matchProductCategory(productName, storeName, "wx");
      const importBatch = `微信 · ${fileName}`;

      this.items.push({
        id: this.nextId++,
        order_id: orderId,
        parent_order_id: "",
        product_id: productId,
        platform: "wx",
        store_name: storeName,
        product_name: productName,
        model_style: modelStyle,
        quantity: 1,
        total_price: amount,
        order_time: normalizeDate(excelSerialToDate(cell(row, "交易时间"))),
        daily_avg_cost: 0,
        emoji,
        import_batch: importBatch,
        product_url: "",
        end_date: "",
        end_reason: "",
        sell_price: 0,
        archived: false,
        category: cat,
      });
      wxDedup.add(orderId);
      imported++;
    }

    this.recalcDailyCost();
    this.save();
    return {
      success: imported > 0 || incomeImported > 0,
      imported,
      skipped,
      message: t("csv.import_success_wx", { imported, income: incomeImported, skipped }) + crossDupNote(crossDup),
    };
  }

  /** 支付宝账单核心解析（CSV/xlsx 共用二维数组）——语义同 Rust 端 parse_alipay_rows。
   *  仅导入「支出」订单进物品表；「收入」「不计收支」（退款/转账/提现/余额宝等）跳过。 */
  private async importAlipayRows(rows: string[][], fileName: string): Promise<ImportResult> {
    // 定位表头行（跳过前 ~20 行元数据/提示/分隔线，至多扫描前 200 行）
    let headerIdx = -1;
    const col: Record<string, number> = {};
    const findCol = (r: string[]) => {
      col["交易时间"] = r.indexOf("交易时间");
      col["交易分类"] = r.indexOf("交易分类");
      col["交易对方"] = r.indexOf("交易对方");
      col["对方账号"] = r.indexOf("对方账号");
      // 商品说明列名在不同版本/区域可能为「商品说明」或「产品说明」，统一到 product
      col["商品说明"] = r.indexOf("商品说明");
      col["产品说明"] = r.indexOf("产品说明");
      col["product"] = Math.max(col["商品说明"], col["产品说明"]);
      col["收/支"] = r.indexOf("收/支");
      col["金额"] = r.indexOf("金额");
      col["收/付款方式"] = r.indexOf("收/付款方式");
      col["交易状态"] = r.indexOf("交易状态");
      col["交易订单号"] = r.indexOf("交易订单号");
      col["商家订单号"] = r.indexOf("商家订单号");
      col["备注"] = r.indexOf("备注");
    };
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const r = rows[i];
      if (r.includes("交易订单号") && r.includes("金额")) { headerIdx = i; findCol(r); break; }
    }
    const cell = (row: string[], key: string): string => {
      const idx = col[key];
      return idx !== undefined && idx >= 0 ? (row[idx] || "").trim() : "";
    };
    if (headerIdx === -1) {
      return { success: false, imported: 0, skipped: 0, message: `未找到支付宝账单表头（需含「交易订单号」「金额」列），请确认文件为支付宝交易明细导出` };
    }

    // 预构建支付宝去重缓存（仅支出订单，交易订单号全局唯一）
    const aliDedup = new Set(this.items.filter(i => i.platform === "alipay").map(i => i.order_id));
    const { matchProductCategory } = await import("./utils");

    // 跨平台去重索引：支付宝可支付淘宝，检查是否已在京东/淘宝订单入库
    const orderPlatform = new Map<string, number>(
      this.items.filter(i => (i.platform === "jd" || i.platform === "tb") && i.order_id && i.total_price > 0)
        .map(i => [i.order_id, i.total_price]),
    );

    // 用户可能滤掉「收/支」列：缺列时无法区分收支，按「支出」处理
    // （应用定位为订单/支出账本），并靠状态白名单兜底过滤退款/交易关闭等
    const incomeExpenseMissing = col["收/支"] < 0;

    let imported = 0, skipped = 0, crossDup = 0;
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) { skipped++; continue; }
      const orderId = cell(row, "交易订单号");
      if (!orderId) { skipped++; continue; }
      // 仅导入支出流水；收入/不计收支/退款（退款、转账、提现、余额宝等）跳过
      const incomeExpense = incomeExpenseMissing ? "支出" : cell(row, "收/支");
      if (incomeExpense !== "支出") { skipped++; continue; }
      // 状态白名单（退款成功/交易关闭/解冻等跳过）
      const status = cell(row, "交易状态");
      if (status && !["", "/", "交易成功", "支付成功"].includes(status)) { skipped++; continue; }
      // 交易分类=退款 的退款行（即使收/支被滤掉按支出处理）不入库
      if (cell(row, "交易分类") === "退款") { skipped++; continue; }

      // 商品名逐级回退：商品说明 → 交易对方 → 交易分类 → 对方账号（列被滤掉时逐级回退）
      let productName = cell(row, "product");
      if (!productName || productName === "/" || productName === "null") productName = cell(row, "交易对方");
      if (!productName || productName === "/" || productName === "null") productName = cell(row, "交易分类");
      if (!productName || productName === "/" || productName === "null") productName = cell(row, "对方账号");
      if (!productName || productName === "/" || productName === "null") { skipped++; continue; }

      // 金额取绝对值（兼容 ¥/千分位格式；与 Rust 端 parse_wechat_amount 一致）
      const amount = Math.abs(parseFloat(cell(row, "金额").replace(/[^\d.\-]/g, "")) || 0);
      if (amount <= 0) { skipped++; continue; }
      if (aliDedup.has(orderId)) { skipped++; continue; }

      // 跨平台去重：同一笔消费已以京东/淘宝订单入库（商家订单号=平台单号后缀+金额一致）→ 跳过
      const productId = cell(row, "商家订单号");
      if (isBillDupWithOrder(productId, amount, orderPlatform)) { crossDup++; skipped++; continue; }

      // 店铺名回退：交易对方 → 对方账号 → 交易分类
      let storeName = cell(row, "交易对方");
      if (!storeName || storeName === "/" || storeName === "null") storeName = cell(row, "对方账号");
      if (!storeName || storeName === "/" || storeName === "null") storeName = cell(row, "交易分类");

      // 收/付款方式 + 备注合并到型号区
      let remark = cell(row, "备注");
      if (remark === "/") remark = "";
      const payMethod = cell(row, "收/付款方式");
      const modelStyle = !remark ? payMethod
        : (!payMethod || payMethod === "/") ? remark
        : `${payMethod}\n${remark}`;

      const [cat, emoji] = matchProductCategory(productName, storeName, "alipay");
      const importBatch = `支付宝 · ${fileName}`;

      this.items.push({
        id: this.nextId++,
        order_id: orderId,
        parent_order_id: "",
        product_id: productId,
        platform: "alipay",
        store_name: storeName,
        product_name: productName,
        model_style: modelStyle,
        quantity: 1,
        total_price: amount,
        order_time: normalizeDate(excelSerialToDate(cell(row, "交易时间"))),
        daily_avg_cost: 0,
        emoji,
        import_batch: importBatch,
        product_url: "",
        end_date: "",
        end_reason: "",
        sell_price: 0,
        archived: false,
        category: cat,
      });
      aliDedup.add(orderId);
      imported++;
    }

    this.recalcDailyCost();
    this.save();
    return { success: imported > 0, imported, skipped, message: t("csv.import_success_alipay", { imported, skipped }) + crossDupNote(crossDup) };
  }

  /** 重新计算所有物品的日均成本（每个物品基于自身价格和日期独立计算） */
  private recalcDailyCost() {
    for (const item of this.items) {
      if (item.archived || item.total_price <= 0) { item.daily_avg_cost = 0; continue; }
      item.daily_avg_cost = calcDailyAvg(
        item.total_price, item.order_time,
        item.end_date || undefined,
        item.end_reason === "sold" ? item.sell_price : undefined,
      );
    }
  }

  getItems(): OrderItem[] {
    return [...this.items].filter(i => !i.archived).sort((a, b) => b.order_time.localeCompare(a.order_time));
  }

  getItemCount(): number { return this.items.filter(i => !i.archived).length; }

  getBatches(): string[] {
    return [...new Set(this.items.filter(i => !i.archived).map(i => i.import_batch).filter(Boolean))].sort();
  }

  /** 查询某个回款来源（交易对方）的全部收入流水，按时间倒序（语义同 Rust 端 get_income_records_by_peer） */
  getIncomeRecordsByPeer(peer: string): IncomeRecord[] {
    return this.incomes
      .filter(i => (i.peer || "未知") === peer)
      .sort((a, b) => b.order_time.localeCompare(a.order_time));
  }

  /** 微信收支分析（总览/回款结构/来源 Top/月度）——语义同 Rust 端 get_wechat_analytics
   *  @param start 可选起始月份 "YYYY-MM"（含），@param end 可选截止月份 "YYYY-MM"（含） */
  getWechatAnalytics(start?: string, end?: string): WechatAnalytics {
    const inRange = (m: string): boolean =>
      (!start || m >= start) && (!end || m <= end);
    const wxItems = this.items.filter(i =>
      i.platform === "wx" && !i.archived && inRange(i.order_time.substring(0, 7)));
    const rangeIncomes = this.incomes.filter(i => inRange(i.order_time.substring(0, 7)));
    const expenseTotal = wxItems.reduce((s, i) => s + i.total_price, 0);
    const incomeTotal = rangeIncomes.reduce((s, i) => s + i.amount, 0);

    // 回款结构（按交易类型；含"退款"的类型统一归为"退款"，与 Rust 端 CASE 一致）
    const typeMap = new Map<string, { total: number; count: number }>();
    for (const inc of rangeIncomes) {
      const key = inc.income_type.includes("退款") ? "退款" : (inc.income_type || "未知");
      const e = typeMap.get(key) || { total: 0, count: 0 };
      e.total += inc.amount; e.count += 1;
      typeMap.set(key, e);
    }
    const by_type: IncomeByType[] = Array.from(typeMap.entries())
      .map(([income_type, v]) => ({ income_type, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total);

    // 回款来源 Top 10（按交易对方）
    const peerMap = new Map<string, { total: number; count: number }>();
    for (const inc of rangeIncomes) {
      const key = inc.peer || "未知";
      const e = peerMap.get(key) || { total: 0, count: 0 };
      e.total += inc.amount; e.count += 1;
      peerMap.set(key, e);
    }
    const peers: IncomePeer[] = Array.from(peerMap.entries())
      .map(([peer, v]) => ({ peer, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 月度收支：合并微信支出与回款，按月对齐
    const monthMap = new Map<string, { expense: number; income: number }>();
    for (const item of wxItems) {
      const m = item.order_time.substring(0, 7);
      if (!m) continue;
      const e = monthMap.get(m) || { expense: 0, income: 0 };
      e.expense += item.total_price;
      monthMap.set(m, e);
    }
    for (const inc of rangeIncomes) {
      const m = inc.order_time.substring(0, 7);
      if (!m) continue;
      const e = monthMap.get(m) || { expense: 0, income: 0 };
      e.income += inc.amount;
      monthMap.set(m, e);
    }
    const monthly: WechatMonthly[] = Array.from(monthMap.entries())
      .map(([month, v]) => ({ month, expense: v.expense, income: v.income, net: v.expense - v.income }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      overview: { expense_total: expenseTotal, income_total: incomeTotal, net_total: expenseTotal - incomeTotal },
      by_type,
      peers,
      monthly,
    };
  }

  updateItem(id: number, data: Partial<OrderItem>) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    Object.assign(this.items[idx], data);
    this.recalcDailyCost();
    this.save();
  }

  updateItems(updates: Array<{ id: number; data: Partial<Pick<OrderItem, "category" | "emoji">> }>): number {
    const changes = new Map(updates.map(({ id, data }) => [id, data]));
    let updated = 0;
    for (const item of this.items) {
      const data = changes.get(item.id);
      if (data) { Object.assign(item, data); updated++; }
    }
    if (updated > 0) {
      this.recalcDailyCost();
      this.save();
    }
    return updated;
  }

  archiveItem(id: number) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    this.items[idx].archived = true;
    this.recalcDailyCost();
    this.save();
  }

  restoreItem(id: number) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    this.items[idx].archived = false;
    this.recalcDailyCost();
    this.save();
  }

  permanentDeleteItem(id: number) {
    this.items = this.items.filter(i => i.id !== id);
    this.recalcDailyCost();
    this.save();
  }

  getArchivedItems(): OrderItem[] {
    return [...this.items.filter(i => i.archived)].sort((a, b) => b.order_time.localeCompare(a.order_time));
  }

  getArchivedCount(): number {
    return this.items.filter(i => i.archived).length;
  }

  batchRestoreItems(ids: number[]) {
    const idSet = new Set(ids);
    for (const item of this.items) {
      if (idSet.has(item.id)) item.archived = false;
    }
    this.recalcDailyCost();
    this.save();
  }

  batchPermanentDeleteItems(ids: number[]) {
    const idSet = new Set(ids);
    this.items = this.items.filter(i => !idSet.has(i.id));
    this.recalcDailyCost();
    this.save();
  }

  batchArchiveItems(ids: number[]) {
    const idSet = new Set(ids);
    for (const item of this.items) {
      if (idSet.has(item.id)) item.archived = true;
    }
    this.recalcDailyCost();
    this.save();
  }

  clearAll() { this.items = []; this.nextId = 1; this.incomes = []; this.nextIncomeId = 1; this.save(); }

  /** 导入内置示例数据（浏览器端，首次使用引导）——含微信物品 + 微信回款 */
  async importExampleData(): Promise<string> {
    const { matchProductCategory, normalizeDate } = await import("./utils");

    // 获取已存在的 (platform, order_id) 去重键 + 回款 order_id 去重键
    const existing = new Set(this.items.map(i => `${i.platform}::${i.order_id}`));
    const incomeExisting = new Set(this.incomes.map(i => i.order_id));

    // 静态 import JSON → Vite 打包时内联，零网络请求
    const data = (await import("./assets/example-data.json")).default as Array<{
      order_id: string;
      parent_order_id: string;
      product_id: string;
      platform: string;
      store_name: string;
      product_name: string;
      model_style: string;
      quantity: number;
      total_price: number;
      order_time: string;
      import_batch: string;
      product_url: string;
      emoji: string;
      end_date: string;
      end_reason: string;
      sell_price: number;
    }>;

    let imported = 0;
    let skipped = 0;

    for (const row of data) {
      const key = `${row.platform}::${row.order_id}`;
      if (existing.has(key)) {
        skipped++;
        continue;
      }

      // 自动匹配分类（若示例中未预设）
      const [cat, em] = row.emoji
        ? [matchProductCategory(row.product_name, row.store_name, row.platform)[0], row.emoji]
        : matchProductCategory(row.product_name, row.store_name, row.platform);

      // 日期归一化
      const orderTime = normalizeDate(row.order_time);
      const endDate = row.end_date ? normalizeDate(row.end_date) : "";

      this.items.push({
        id: this.nextId++,
        order_id: row.order_id,
        parent_order_id: row.parent_order_id || "",
        product_id: row.product_id || "",
        platform: row.platform,
        store_name: row.store_name || "",
        product_name: row.product_name,
        model_style: row.model_style || "",
        quantity: row.quantity || 1,
        total_price: row.total_price,
        order_time: orderTime,
        daily_avg_cost: 0,
        emoji: em,
        import_batch: row.import_batch || "",
        product_url: row.product_url || "",
        end_date: endDate,
        end_reason: row.end_reason || "",
        sell_price: row.sell_price || 0,
        archived: false,
        category: cat,
      });
      imported++;
    }

    // 微信回款流水（收入/退款/红包等）→ incomes 回款表，独立去重
    const incomes = (await import("./assets/example-incomes.json")).default as Array<{
      order_id: string;
      platform: string;
      peer: string;
      income_type: string;
      amount: number;
      order_time: string;
      status: string;
      import_batch: string;
    }>;

    let incomeImported = 0;
    for (const inc of incomes) {
      if (incomeExisting.has(inc.order_id)) {
        skipped++;
        continue;
      }
      this.incomes.push({
        id: this.nextIncomeId++,
        order_id: inc.order_id,
        platform: inc.platform,
        peer: inc.peer || "",
        income_type: inc.income_type || "",
        amount: inc.amount || 0,
        order_time: normalizeDate(inc.order_time),
        status: inc.status || "",
        import_batch: inc.import_batch || "",
      });
      incomeExisting.add(inc.order_id);
      incomeImported++;
    }

    this.recalcDailyCost();
    this.save();
    return `成功导入 ${imported} 条物品、${incomeImported} 条微信回款，跳过 ${skipped} 条已存在`;
  }

  async addItem(data: Partial<OrderItem> & { product_name: string; total_price: number }): Promise<OrderItem> {
    const { matchProductCategory } = await import("./utils");
    const now = new Date();
    const productName = data.product_name || "";
    const [cat, em] = matchProductCategory(productName, data.store_name || "", data.platform || "manual");
    const item: OrderItem = {
      id: this.nextId++,
      order_id: data.order_id || `manual-${now.getTime()}`,
      parent_order_id: data.parent_order_id || "",
      product_id: data.product_id || "",
      platform: data.platform || "manual",
      store_name: data.store_name || "",
      product_name: productName,
      model_style: data.model_style || "",
      quantity: data.quantity || 1,
      total_price: data.total_price,
      order_time: normalizeDate(data.order_time || now.toISOString().replace("T", " ").slice(0, 10)),
      daily_avg_cost: 0,
      emoji: data.emoji || em,
      import_batch: data.import_batch || t("db.custom"),
      product_url: data.product_url || "",
      end_date: data.end_date || "",
      end_reason: data.end_reason || "",
      sell_price: data.sell_price || 0,
      archived: false,
      category: data.category || cat,
    };
    this.items.push(item);
    this.recalcDailyCost();
    this.save();
    return item;
  }
}

export const browserDb = new BrowserDb();
