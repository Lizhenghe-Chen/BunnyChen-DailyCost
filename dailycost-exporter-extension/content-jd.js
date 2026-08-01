// content-jd.js — 京东订单导出
// 依赖 common.js（先加载，提供 window.__DCE）

(() => {
  if (window.__dceJdLoaded) return;
  window.__dceJdLoaded = true;

  const D = window.__DCE;

  // ---------- 常量 ----------

  const HEADERS = [
    "导出批次", "日期范围", "订单编号", "父订单编号", "店铺名称",
    "商品编号", "商品名称", "商品数量", "实付金额", "支付方式",
    "付款时间", "订单返豆", "京豆抵扣金额", "下单时间", "订单状态",
    "收货人姓名", "收货地址", "收货人电话", "物流公司", "快递单号",
    "配送方式", "商品总价", "运费", "详情补充状态", "订单详情域名路径",
    "商品明细JSON", "有售后入口", "有发票入口"
  ];

  const DATE_LABELS = {
    recent3m: "近三个月订单",
    currentYear: "今年内订单",
    pre2014: "2014年以前订单"
  };

  const nowYear = new Date().getFullYear();

  // ---------- 日期范围 ----------

  function buildDateRanges(options) {
    if (options.dateMode === "recent3m")
      return [{ label: DATE_LABELS.recent3m, value: "1" }];
    if (options.dateMode === "currentYear")
      return [{ label: DATE_LABELS.currentYear, value: "2" }];
    if (options.dateMode === "customYears") {
      const start = clamp(options.startYear, 2014, nowYear - 1);
      const end = clamp(options.endYear, 2014, nowYear - 1);
      const low = Math.min(start, end), high = Math.max(start, end);
      return yearRanges(high, low);
    }
    // 全量
    return [
      { label: DATE_LABELS.currentYear, value: "2" },
      ...yearRanges(nowYear - 1, 2014),
      { label: DATE_LABELS.pre2014, value: "3" }
    ];
  }

  function yearRanges(start, end) {
    const ranges = [];
    for (let y = start; y >= end; y--)
      ranges.push({ label: y + "年订单", value: String(y) });
    return ranges;
  }

  function clamp(v, min, max) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : min;
  }

  function buildListUrl(dateValue, statusValue, page) {
    return `https://order.jd.com/center/list.action?d=${dateValue}&s=${statusValue}&page=${page}`;
  }

  // ---------- 登录检测 ----------

  function assertLoggedIn(html, url) {
    const doc = D.parseHtml(html);
    const title = D.clean(doc.title);
    if (doc.querySelector("#loginname, #nloginpwd, #loginsubmit, .login-tab, .login-form")
      || /passport\.jd\.com\/new\/login\.aspx|ReturnUrl=/.test(html)
      || /京东-欢迎登录|欢迎登录/.test(title)) {
      throw new Error("登录状态不可用，请刷新订单页并确认已登录：" + safeUrl(url));
    }
  }

  function safeUrl(url) {
    return D.hostPath(url) || "当前页面";
  }

  // ---------- 列表解析 ----------

  function parseOrderList(doc, dateLabel, batch) {
    const rows = doc.querySelectorAll(".td-void > tbody");
    const orders = [];

    for (const row of rows) {
      const rowId = row.getAttribute("id") || "";
      if (rowId.startsWith("parent-")) continue;

      const orderLink = row.querySelector('[name="orderIdLinks"]');
      const orderId = firstMatch(D.clean(orderLink?.textContent || ""), /\d{6,}/);
      if (!orderId) continue;

      const amountTexts = [...row.querySelectorAll(".amount span")]
        .map(n => D.clean(n.textContent)).filter(Boolean);
      const rowText = D.clean(row.textContent);
      const detailUrl = normalizeUrl(orderLink?.getAttribute("href"));
      const items = parseGoods(row);

      const pids = items.map(it => it["商品编号"]).filter(Boolean);
      const pnames = items.map(it => it["商品名称"]).filter(Boolean);
      const pqty = items.map(it => it["数量"]).filter(v => v !== "");

      orders.push({
        "导出批次": batch, "日期范围": dateLabel, "订单编号": orderId,
        "父订单编号": row.getAttribute("data-parentid") || "",
        "店铺名称": D.clean(textOf(row, ".shop-txt")),
        "商品编号": pids.join("\n"), "商品名称": pnames.join("\n"),
        "商品数量": pqty.join("\n"),
        "实付金额": D.parseMoney(amountTexts.find(t => /¥|￥/.test(t)) || ""),
        "支付方式": amountTexts.find(t => !/¥|￥/.test(t))
          || firstMatch(rowText, /(在线支付|货到付款|公司转账|京东支付|微信支付|白条支付|银行卡支付)/),
        "付款时间": "", "订单返豆": D.parseInteger(textOf(row, 'a[href*="myJingBean/list"]')),
        "京豆抵扣金额": "", "下单时间": D.clean(textOf(row, ".dealtime")),
        "订单状态": D.clean(textOf(row, ".status span")) || D.clean(textOf(row, ".order-status")),
        "收货人姓名": D.clean(textOf(row, ".pc strong")),
        "收货地址": D.clean(textOf(row, ".pc p:nth-of-type(1)")),
        "收货人电话": D.clean(textOf(row, ".pc p:nth-of-type(2)")),
        "物流公司": "", "快递单号": "", "配送方式": "",
        "商品总价": "", "运费": "", "详情补充状态": "未请求",
        "订单详情域名路径": detailUrl ? D.hostPath(detailUrl) : "",
        "商品明细JSON": JSON.stringify(items),
        "有售后入口": /申请售后/.test(rowText) ? "是" : "否",
        "有发票入口": /查看发票|发票详情/.test(rowText) ? "是" : "否",
        "_detailUrl": detailUrl
      });
    }
    return orders;
  }

  function parseGoods(row) {
    return [...row.querySelectorAll(".goods-item")].map(item => {
      const link = item.querySelector(".p-name a.a-link") || item.querySelector(".p-name a") || item.querySelector("a");
      const href = link ? normalizeUrl(link.getAttribute("href")) : "";
      const pid = firstMatch(href, /\d{3,}/);
      const qty = D.clean(textOf(item, ".goods-number")).replace(/^x/i, "");
      return {
        "商品编号": pid || "",
        "商品名称": D.clean(link ? link.textContent : textOf(item, ".p-name")),
        "数量": qty,
        "商品链接": href ? stripQuery(href) : ""
      };
    }).filter(it => it["商品名称"] || it["商品编号"]);
  }

  function hasListEnded(doc) {
    if (doc.querySelector(".empty-box")) return true;
    return !!(doc.querySelector(".next-disabled")) || !doc.querySelector(".next");
  }

  // ---------- 详情补充 ----------

  async function enrichOrderFromDetail(order) {
    const url = order._detailUrl;
    if (!url || !/^https:\/\/details\.(jd|yiyaojd)\.com\//.test(url)) {
      order["详情补充状态"] = "无详情链接";
      return;
    }
    try {
      const html = await D.fetchText(url);
      assertLoggedIn(html, url);
      const doc = D.parseHtml(html);
      const t = D.compactText(doc.body?.textContent || "");
      const stateText = D.clean(textOf(doc, ".order-state"));

      order["付款时间"] = order["付款时间"] || D.valueByPatterns(t, [
        /付款时间：\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/
      ]);
      order["支付方式"] = order["支付方式"] || D.valueByPatterns(t, [
        /付款方式：\s*([^\s：]+支付|货到付款|公司转账|银行卡|微信|白条)/
      ]);
      order["物流公司"] = D.valueByPatterns(t, [
        /承运人：\s*(.*?)(?:快递咨询|货运单号：|\s{2,}|$)/,
        /国内物流承运方：\s*(.*?)\s*货运单号：/,
        /交付([\u4e00-\u9fa5A-Za-z]+)，/
      ]) || order["物流公司"];
      order["快递单号"] = D.valueByPatterns(t, [
        /货运单号：\s*([A-Za-z0-9-]+)/,
        /运单号为\s*([A-Za-z0-9-]+)/,
        /快递单号：\s*([A-Za-z0-9-]+)/
      ]) || order["快递单号"];
      order["配送方式"] = D.valueByPatterns(t, [
        /送货方式：\s*([^\s]+(?:快递|配送|自提)?)/,
        /配送方式：\s*([^\s]+(?:快递|配送|自提)?)/
      ]) || order["配送方式"];
      order["商品总价"] = D.parseMoney(D.valueByPatterns(t, [
        /商品总(?:价|额)：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])) || order["商品总价"];
      order["运费"] = D.parseMoney(D.valueByPatterns(t, [
        /运费：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])) || order["运费"];
      order["京豆抵扣金额"] = D.parseMoney(D.valueByPatterns(t, [
        /京豆：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])) || order["京豆抵扣金额"];

      const returnedBeans = D.parseInteger(D.valueByPatterns(t, [/购物返京豆已获得\s*(\d+)\s*京豆/]));
      if (returnedBeans && !order["订单返豆"]) order["订单返豆"] = returnedBeans;
      if (!order["订单状态"] && stateText) order["订单状态"] = stateText;

      order["详情补充状态"] = "成功";
    } catch (e) {
      order["详情补充状态"] = "失败：" + (e instanceof Error ? e.message : String(e));
    }
  }

  // ---------- 工具 ----------

  function textOf(root, sel) {
    const n = root.querySelector(sel);
    return n ? n.textContent || "" : "";
  }

  function firstMatch(v, re) {
    const m = String(v || "").match(re);
    return m ? m[0] : "";
  }

  function normalizeUrl(href) {
    if (!href) return "";
    if (href.startsWith("//")) return "https:" + href;
    if (href.startsWith("/")) return location.origin + href;
    return href;
  }

  function stripQuery(url) {
    try { const p = new URL(url); return p.origin + p.pathname; }
    catch (_) { return url; }
  }

  function prepareOutput(order, mask) {
    const copy = { ...order };
    delete copy._detailUrl;
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
    const dateRanges = buildDateRanges(options);
    const ordersById = new Map();

    D.ensureOverlay();
    D.updateOverlay("开始导出：" + dateRanges.length + " 个日期段...");

    for (const range of dateRanges) {
      let page = 1;
      while (!D.cancelRequested) {
        if (options.maxPages && page > options.maxPages) break;

        const listUrl = buildListUrl(range.value, options.status || "4096", page);
        D.updateOverlay("读取 " + range.label + " 第 " + page + " 页，已收集 " + ordersById.size + " 个订单...");

        const html = await D.fetchText(listUrl);
        assertLoggedIn(html, listUrl);
        const doc = D.parseHtml(html);
        const pageOrders = parseOrderList(doc, range.label, batch);

        for (const o of pageOrders) {
          if (!ordersById.has(o["订单编号"])) ordersById.set(o["订单编号"], o);
        }

        if (pageOrders.length === 0 || hasListEnded(doc)) break;
        page++;
        await D.delay(options.delayMs || 1000);
      }
    }

    const orders = [...ordersById.values()];

    // 补充详情
    if (options.includeDetails && !D.cancelRequested) {
      for (let i = 0; i < orders.length; i++) {
        if (D.cancelRequested) break;
        D.updateOverlay("补充详情 " + (i + 1) + "/" + orders.length + "：" + D.maskOrderId(orders[i]["订单编号"]));
        await enrichOrderFromDetail(orders[i]);
        await D.delay(options.delayMs || 1000);
      }
    }

    const final = orders.map(o => prepareOutput(o, options.maskSensitive));
    const suffix = D.cancelRequested ? "partial" : "complete";
    D.downloadJSONL("jd-orders-" + batch + "-" + suffix + ".jsonl", final);
    D.downloadCSV("jd-orders-" + batch + "-" + suffix + ".csv", final, HEADERS);
    D.updateOverlay(
      "导出完成：" + final.length + " 个订单。" + (D.cancelRequested ? "（提前停止）" : ""),
      true
    );
  }

  // ---------- 初始化 ----------

  D.setupMessaging("jd", runExport);
})();
