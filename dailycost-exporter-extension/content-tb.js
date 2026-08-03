// content-tb.js — 淘宝/天猫订单导出
// 依赖 common.js（先加载，提供 window.__DCE）

(() => {
  if (window.__dceTbLoaded) return;
  window.__dceTbLoaded = true;

  const D = window.__DCE;

  // ---------- CSV 表头（与京东对齐 28 列 + 2 列淘宝专用） ----------

  const HEADERS = [
    "导出批次", "日期范围", "订单编号", "父订单编号", "店铺名称",
    "商品编号", "商品名称", "商品数量", "实付金额", "支付方式",
    "付款时间", "订单返豆", "京豆抵扣金额", "下单时间", "订单状态",
    "收货人姓名", "收货地址", "收货人电话", "物流公司", "快递单号",
    "配送方式", "商品总价", "运费", "详情补充状态", "订单详情域名路径",
    "商品明细JSON", "有售后入口", "有发票入口",
    "型号款式", "商品链接"
  ];

  const STATUS_LABELS = {
    all: "全部订单", waitPay: "待付款", waitSend: "待发货",
    waitConfirm: "待收货", waitRate: "待评价"
  };

  // ---------- 注入 bridge 到 MAIN world ----------

  function injectBridge() {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("bridge.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }

  // ---------- bridge 通信 ----------

  function requestMainWorldData() {
    return new Promise((resolve, reject) => {
      const rid = "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      let timer;
      const handler = (e) => {
        if (e.source !== window) return;
        const d = e.data;
        if (!d || d.type !== "__DCE_TB_DATA_RESULT__" || d.requestId !== rid) return;
        window.removeEventListener("message", handler);
        clearTimeout(timer);
        resolve(d.data);
      };
      window.addEventListener("message", handler);
      window.postMessage({ type: "__DCE_TB_GET_DATA__", requestId: rid }, "*");
      timer = setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(new Error("bridge timeout"));
      }, 5000);
    });
  }

  // ---------- 翻页 ----------

  function getTotalPages() {
    const items = document.querySelectorAll(".ant-pagination-item");
    let max = 1;
    for (const el of items) {
      const n = parseInt(el.textContent.trim(), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    return max;
  }

  function clickPage(pageNum) {
    const items = document.querySelectorAll(".ant-pagination-item");
    for (const el of items) {
      if (el.textContent.trim() === String(pageNum)) {
        el.click();
        return true;
      }
    }
    return false;
  }

  async function hasPageChanged(prevFirstId) {
    try {
      const d = await requestMainWorldData();
      const pm = d.posMap || {};
      const keys = Object.keys(pm);
      return keys.length > 0 && pm[keys[0]] !== prevFirstId;
    } catch (_) { return false; }
  }

  function waitForPageChange(prevFirstId, timeoutMs = 15000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (D.cancelRequested) { resolve(false); return; }
        hasPageChanged(prevFirstId).then(changed => {
          if (changed) { resolve(true); return; }
          if (Date.now() - start < timeoutMs) setTimeout(check, 500);
          else resolve(false);
        }).catch(() => {
          if (Date.now() - start < timeoutMs) setTimeout(check, 500);
          else resolve(false);
        });
      };
      setTimeout(check, 1000);
    });
  }

  // ---------- 协议解析 ----------

  function parseProtocol(batch, statusLabel, proto, posMap) {
    if (!proto) return [];

    // 收集所有订单 ID
    const orderIds = new Set();
    for (const k of Object.keys(proto)) {
      const m = k.match(/^(?:shopInfo|orderPayment|orderStatus|orderLogistics|operations)_(\d+)$/);
      if (m) orderIds.add(m[1]);
    }
    if (orderIds.size === 0) return [];

    // 按页面位置排序
    let sortedIds;
    const posKeys = Object.keys(posMap || {});
    if (posKeys.length > 0) {
      posKeys.sort((a, b) => Number(a) - Number(b));
      sortedIds = [];
      for (const pk of posKeys) {
        const pid = posMap[pk];
        if (orderIds.has(pid)) sortedIds.push(pid);
      }
    } else {
      sortedIds = [...orderIds];
    }

    return sortedIds.map(oid => extractOrder(proto, oid, batch, statusLabel)).filter(Boolean);
  }

  function extractOrder(proto, oid, batch, statusLabel) {
    const si = ((proto["shopInfo_" + oid] || {}).fields || {});
    const pay = ((proto["orderPayment_" + oid] || {}).fields || {});
    const st = ((proto["orderStatus_" + oid] || {}).fields || {});
    const lg = ((proto["orderLogistics_" + oid] || {}).fields || {});

    let detailUrl = si.orderDetailUrl || "";
    if (detailUrl.startsWith("//")) detailUrl = "https:" + detailUrl;

    const actualFee = extMoney(pay.actualFee);
    const postFee = extMoney(pay.pcPostFee);

    // 物流
    const pp = lg.packagePreview || {};
    const pvList = pp.packageViewList || [];
    let cpName = "", mailNo = "";
    if (pvList.length > 0) {
      cpName = pvList[0].cpName || "";
      mailNo = pvList[0].mailNo || "";
    }
    if (!cpName && st.cpCode) cpName = st.cpCode;
    if (!mailNo && st.mailNo) mailNo = st.mailNo;

    // 商品明细
    const itemPrefix = "orderItemInfo_" + oid + "_";
    const pids = [], pnames = [], skus = [], qtys = [], amts = [], urls = [];
    for (const k of Object.keys(proto)) {
      if (!k.startsWith(itemPrefix)) continue;
      const itemF = ((proto[k] || {}).fields || {});
      const item = itemF.item || itemF;
      if (item.itemId) pids.push(String(item.itemId));
      if (item.title) pnames.push(item.title);
      if (item.skuText) skus.push(item.skuText);
      if (item.quantity) qtys.push(String(item.quantity));
      if (item.priceInfo?.actualTotalFee) amts.push(D.parseMoney(String(item.priceInfo.actualTotalFee)));
      if (item.itemUrl) urls.push(item.itemUrl);
    }

    // 地址/电话
    const subTitle = st.subTitle || "";
    let addr = "", phone = "";
    if (subTitle) {
      const am = subTitle.match(/【(.+?)】/);
      if (am) addr = am[1];
      const pm = subTitle.match(/(?:电联|电话)[：:]*\s*[（(]?(\d{3,4}[-\s]?\d{7,11})[）)]?/);
      if (pm) phone = pm[1];
    }

    return {
      "导出批次": batch, "日期范围": statusLabel, "订单编号": String(oid),
      "父订单编号": "", "店铺名称": si.shopName || "",
      "商品编号": pids.join("\n"), "商品名称": pnames.join("\n"),
      "商品数量": qtys.join("\n"), "实付金额": actualFee, "支付方式": "",
      "付款时间": "", "订单返豆": "", "京豆抵扣金额": "",
      "下单时间": D.normTime(si.createTime), "订单状态": st.title || si.tradeTitle || "",
      "收货人姓名": "", "收货地址": addr, "收货人电话": phone,
      "物流公司": cpName, "快递单号": mailNo, "配送方式": "",
      "商品总价": amts.join("\n"), "运费": postFee,
      "详情补充状态": "未请求", "订单详情域名路径": D.hostPath(detailUrl),
      "商品明细JSON": JSON.stringify(
        pids.map((id, idx) => ({
          "商品编号": id, "商品名称": pnames[idx] || "",
          "型号款式": skus[idx] || "", "数量": qtys[idx] || "",
          "商品链接": urls[idx] || ""
        }))
      ),
      "有售后入口": "", "有发票入口": "",
      "型号款式": skus.join("\n"), "商品链接": urls.join("\n"),
      "_detailUrl": detailUrl
    };
  }

  function extMoney(f) {
    if (!f) return "";
    if (typeof f === "string") return D.parseMoney(f);
    if (f.value) return D.parseMoney(String(f.value));
    return "";
  }

  // ---------- 详情补充 ----------

  async function enrichOrder(order) {
    const url = order._detailUrl;
    if (!url || !/^https:\/\/trade\.(taobao|tmall)\.com\//.test(url)) {
      order["详情补充状态"] = "无详情链接";
      return;
    }
    try {
      const html = await D.fetchText(url);
      const doc = D.parseHtml(html);
      const t = D.compactText(doc.body ? doc.body.textContent : "");

      order["收货人姓名"] = order["收货人姓名"] || D.valueByPatterns(t, [
        /收货人[：:]\s*(\S{1,20}?)(?=\s*(?:手机|电话|地址|\d{3}|$))/
      ]);
      order["收货人电话"] = order["收货人电话"] || D.valueByPatterns(t, [
        /(?:联系电话|手机号码|电话)[：:]\s*(\d{3,4}[-\s]?\d{7,11})/,
        /(\d{3}[-\s]?\d{4}[-\s]?\d{4})/
      ]);
      order["收货地址"] = order["收货地址"] || D.valueByPatterns(t, [
        /收货地址[：:]\s*(.+?)(?=\s*(?:收货人|联系电话|手机|$))/
      ]);
      order["付款时间"] = order["付款时间"] || D.valueByPatterns(t, [
        /付款时间[：:]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/
      ]);
      order["支付方式"] = order["支付方式"] || D.valueByPatterns(t, [
        /支付方式[：:]\s*(\S+)/
      ]);
      order["物流公司"] = order["物流公司"] || D.valueByPatterns(t, [
        /物流公司[：:]\s*(\S+)/
      ]);
      order["快递单号"] = order["快递单号"] || D.valueByPatterns(t, [
        /运单号码[：:]\s*([A-Za-z0-9]+)/,
        /快递单号[：:]\s*([A-Za-z0-9]+)/
      ]);
      order["详情补充状态"] = "成功";
    } catch (e) {
      order["详情补充状态"] = "失败：" + (e instanceof Error ? e.message : String(e));
    }
  }

  function prepareOutput(order, mask) {
    const copy = {};
    for (const k in order) {
      if (k !== "_detailUrl" && k !== "_items") copy[k] = order[k];
    }
    if (mask) {
      copy["收货人姓名"] = D.maskName(copy["收货人姓名"]);
      copy["收货地址"] = D.maskAddr(copy["收货地址"]);
      copy["收货人电话"] = D.maskPhone(copy["收货人电话"]);
    }
    return copy;
  }

  // ---------- 主导出 ----------

  async function runExport(options) {
    const batch = D.timestampForName();
    const statusLabel = STATUS_LABELS[options.status] || options.status || "全部";
    const ordersById = new Map();
    const totalPages = getTotalPages();
    const maxPages = options.maxPages ? Math.min(options.maxPages, totalPages) : totalPages;

    D.ensureOverlay();
    D.updateOverlay("开始导出：" + statusLabel + "，共 " + totalPages + " 页，将导出 " + maxPages + " 页...");

    for (let page = 1; page <= maxPages; page++) {
      if (D.cancelRequested) break;
      D.updateOverlay("读取第 " + page + "/" + maxPages + " 页，已收集 " + ordersById.size + " 个订单...");

      if (page > 1) {
        let prevFirstId = "";
        try {
          const prevData = await requestMainWorldData();
          const prevPm = prevData.posMap || {};
          const prevKeys = Object.keys(prevPm);
          if (prevKeys.length > 0) prevFirstId = prevPm[prevKeys[0]];
        } catch (_) {}

        D.updateOverlay("翻到第 " + page + " 页...");
        if (!clickPage(page)) {
          D.updateOverlay("无法翻到第 " + page + " 页，停止翻页。");
          break;
        }
        const changed = await waitForPageChange(prevFirstId, 15000);
        if (!changed) {
          D.updateOverlay("第 " + page + " 页加载超时或未变化，停止翻页。");
          break;
        }
        await D.delay(options.delayMs || 1500);
      }

      const pageOrders = await getPageOrders(batch, statusLabel);
      if (pageOrders.length === 0) {
        D.updateOverlay("第 " + page + " 页无数据，停止翻页。");
        break;
      }
      for (const o of pageOrders) {
        if (!ordersById.has(o["订单编号"])) ordersById.set(o["订单编号"], o);
      }
    }

    const orders = [...ordersById.values()];
    D.updateOverlay("共收集 " + orders.length + " 个订单，开始处理...");

    // 补充详情
    if (options.includeDetails && !D.cancelRequested) {
      for (let i = 0; i < orders.length; i++) {
        if (D.cancelRequested) break;
        D.updateOverlay("补充详情 " + (i + 1) + "/" + orders.length + "：" + D.maskOrderId(orders[i]["订单编号"]));
        await enrichOrder(orders[i]);
        await D.delay(options.delayMs || 1500);
      }
    }

    const final = orders.map(o => prepareOutput(o, options.maskSensitive));
    const suffix = D.cancelRequested ? "partial" : "complete";
    D.downloadCSV("tb-orders-" + batch + "-" + suffix + ".csv", final, HEADERS);
    D.updateOverlay("导出完成：" + final.length + " 个订单。" + (D.cancelRequested ? "（提前停止）" : ""), true);
  }

  async function getPageOrders(batch, statusLabel) {
    try {
      const d = await requestMainWorldData();
      return parseProtocol(batch, statusLabel, d.proto, d.posMap);
    } catch (_) { return []; }
  }

  // ---------- 初始化 ----------

  injectBridge();
  D.setupMessaging("tb", runExport);
})();
