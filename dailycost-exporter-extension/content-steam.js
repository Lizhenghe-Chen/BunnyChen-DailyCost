// content-steam.js — Steam 消费历史导出
// 依赖 common.js（先加载，提供 window.__DCE）

(() => {
  if (window.__dceSteamLoaded) return;
  window.__dceSteamLoaded = true;

  const D = window.__DCE;

  const HEADERS = [
    "导出批次", "交易ID", "日期", "物品名称", "类型", "支付方式",
    "折扣", "原价", "折扣价", "税额", "运费", "总计", "钱包变更", "钱包余额"
  ];

  const BADGES = new Set(["退款", "已退款", "refund", "Refund"]);

  // ---------- 主导出 ----------

  async function runExport(options) {
    const batch = D.timestampForName();
    const map = new Map();

    D.ensureOverlay();

    // 1) 初始页
    D.updateOverlay("读取初始页...");
    const res = await fetch("https://store.steampowered.com/account/history", { credentials: "include" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();

    const cur = text.match(/g_historyCursor\s*=\s*(\{[^}]+\})/);
    const sid = text.match(/g_sessionID\s*=\s*["']([^"']+)["']/);
    if (!cur || !sid) throw new Error("未检测到登录状态，请刷新 Steam 消费历史页。");

    let cursor = JSON.parse(cur[1]);
    const sessionId = sid[1];

    addAll(map, parseRows(D.parseHtml(text), batch));

    // 2) AJAX 循环加载更多
    let n = 0;
    while (cursor && !D.cancelRequested) {
      const max = options.maxLoads || 0;
      if (max && n >= max) { D.updateOverlay("已达最大批次 " + max); break; }
      n++;
      D.updateOverlay("加载第 " + n + " 批，已收集 " + map.size + " 条...");

      const body = buildForm(cursor, "cursor") + "&sessionid=" + encodeURIComponent(sessionId);
      const resp = await fetch("https://store.steampowered.com/account/AjaxLoadMoreHistory/", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
      });
      const data = await resp.json();
      if (!data.html) break;

      // DOMParser 需要 <table> 包裹裸 <tr>
      addAll(map, parseRows(D.parseHtml("<table>" + data.html + "</table>"), batch));
      if (!data.cursor) break;
      cursor = data.cursor;
      await D.sleep(options.delayMs || 500);
    }

    // 3) 导出
    const list = [...map.values()];
    const suffix = D.cancelRequested ? "partial" : "complete";
    D.downloadJSONL("steam-orders-" + batch + "-" + suffix + ".jsonl", list);
    D.downloadCSV("steam-orders-" + batch + "-" + suffix + ".csv", list, HEADERS);
    D.updateOverlay(
      "导出完成：" + list.length + " 条。" + (D.cancelRequested ? "（已提前停止）" : ""),
      true
    );
  }

  // ---------- 行解析 ----------

  function parseRows(doc, batch) {
    return [...doc.querySelectorAll("tr.wallet_table_row")].map(row => {
      const tid = (row.getAttribute("onclick") || "").match(/transid=(\d+)/);
      if (!tid) return null;

      // 跳过已被退款的购买行：Steam 以 td.wht_type 上的 wht_refunded 类标记
      // "该购买已退款"（退款行本身 wht_type 无此标记，仍正常导出，由客户端过滤）
      const typeCell = row.querySelector(".wht_type");
      if (typeCell?.classList.contains("wht_refunded")) return null;

      // 物品名（过滤 "退款" 徽章）
      const itemCell = row.querySelector(".wht_items");
      const items = [];
      if (itemCell) {
        for (const div of itemCell.querySelectorAll(":scope > div")) {
          const s = D.clean(div.textContent);
          if (s && !BADGES.has(s)) items.push(s);
        }
      }
      if (!items.length && itemCell) {
        const s = D.clean(itemCell.textContent);
        if (s) items.push(s);
      }

      // 类型 & 支付方式
      const paymentDivs = typeCell ? [...typeCell.querySelectorAll(".wth_payment div")]
        .map(d => D.clean(d.textContent)).filter(Boolean) : [];

      // 价格列
      const pc = row.querySelector(".wht_base_price");

      return {
        "导出批次": batch,
        "交易ID": tid[1],
        "日期": normSteamDate(D.clean(cellText(row, ".wht_date"))),
        "物品名称": items.join("\n"),
        "类型": D.clean(cellText(typeCell, "div:first-child")),
        "支付方式": paymentDivs.join("\n"),
        "折扣": D.clean(cellText(pc, ".wht_discount_pct")),
        "原价": D.parseMoney(cellText(pc, ".wht_original_price")),
        "折扣价": D.parseMoney(cellText(pc, ".wht_discounted_price")),
        "税额": D.parseMoney(cellText(row, ".wht_tax")),
        "运费": D.parseMoney(cellText(row, ".wht_shipping")),
        "总计": D.parseMoney(cellText(row, ".wht_total")),
        "钱包变更": parseSignedMoney(cellText(row, ".wht_wallet_change")),
        "钱包余额": D.parseMoney(cellText(row, ".wht_wallet_balance"))
      };
    }).filter(Boolean);
  }

  function addAll(map, rows) {
    for (const r of rows) {
      // 去重键需能区分同一交易 ID 的多笔同类型行（如同一订单部分退款出现多笔退款行），
      // 否则会把它们合并为一行，导致退款金额丢失、客户端净额计算偏高
      const k = r["交易ID"] + "|" + r["类型"] + "|" + r["物品名称"] + "|" + r["总计"] + "|" + r["日期"];
      if (!map.has(k)) map.set(k, r);
    }
  }

  // ---------- 工具 ----------

  function cellText(el, sel) {
    const n = el?.querySelector(sel);
    return n?.textContent || "";
  }

  /** "2025 年 11 月 29 日" → "2025-11-29" */
  function normSteamDate(v) {
    const m = String(v || "").match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : D.clean(v);
  }

  /** 保留正负号的钱额解析 */
  function parseSignedMoney(v) {
    const s = String(v || "").replace(/,/g, "");
    const m = s.match(/([-+－])?\s*[¥￥]?\s*(\d+(?:\.\d+)?)/);
    if (!m) return "";
    const sign = m[1] === "-" || m[1] === "－" ? "-" : m[1] === "+" ? "+" : "";
    return sign + m[2];
  }

  /** 将嵌套对象递归编码为 form-urlencoded */
  function buildForm(obj, prefix) {
    const parts = [];
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const key = prefix ? `${prefix}[${k}]` : k;
      if (typeof v === "object" && v !== null && !Array.isArray(v))
        parts.push(buildForm(v, key));
      else
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(v));
    }
    return parts.join("&");
  }

  // ---------- 初始化 ----------

  D.setupMessaging("steam", runExport);
})();
