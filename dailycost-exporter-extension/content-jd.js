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

  // ---------- 列表接口 ----------
  // 2026 年改版后，list.action 只下发空壳，#orderLite 由 React 前端调接口渲染；
  // 直接抓 HTML 会拿到 0 个订单。这里改为调用前端同款接口拿 JSON。
  // 该接口不要求 h5st 签名，仅依赖登录 cookie，且对 order.jd.com 放行 CORS。

  const LIST_API = "https://api.m.jd.com/api";
  const LIST_QUERY = "appid=order-jd-com&client=pc&clientVersion=1.0.0&loginType=3"
    + "&functionId=pcorder_center_list&source=pc";
  const PAGE_SIZE = 20;

  // 接口在个别订单上只返回 orderState 数值、缺 orderStateName，按已验证取值兜底
  const JD_STATE_NAMES = { 18: "已完成", "-100": "已取消" };

  async function fetchJdOrderPage(dateValue, statusValue, page) {
    const status = Number(statusValue);
    const date = Number(dateValue);
    const payload = {
      page,
      s: Number.isFinite(status) ? status : 4096,
      d: Number.isFinite(date) ? date : 1
    };
    const url = `${LIST_API}?${LIST_QUERY}&t=${Date.now()}`;
    const text = await D.postForm(url, "body=" + encodeURIComponent(JSON.stringify(payload)));

    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      throw new Error("订单接口返回非 JSON 内容，请刷新订单页并确认已登录");
    }
    if (json.success !== true) {
      throw new Error("订单接口返回异常" + (json.msg ? "：" + json.msg : "")
        + "，请刷新订单页并确认登录状态");
    }
    // 该日期段没有订单时，京东会省略 data 字段（只剩 revision/success/traceId 等），
    // 这是正常空结果而非错误
    if (!json.data) {
      return { orders: [], total: 0, businessInfo: {} };
    }
    const data = json.data;
    return {
      orders: data.orderList || [],
      total: Number(data.totalNum) || 0,
      businessInfo: data.orderListBusinessInfo || {}
    };
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

  // ---------- 列表解析（接口 JSON → CSV 行）----------

  function mapApiOrder(o, dateLabel, batch, businessInfo) {
    const items = (o.wareList || []).map(w => ({
      "商品编号": String(w.productId || ""),
      "商品名称": D.clean(w.name),
      "数量": w.num === undefined || w.num === null ? "" : String(w.num),
      "商品链接": w.wareUrl ? stripQuery(normalizeUrl(w.wareUrl)) : ""
    })).filter(it => it["商品名称"] || it["商品编号"]);

    const pay = o.itemPayInfo || {};
    const consignee = o.consigneeInfo || {};
    const detailUrl = o.itemDetail && o.itemDetail.itemUrl
      ? normalizeUrl(o.itemDetail.itemUrl) : "";
    const invoice = (businessInfo.invoiceMap || {})[o.orderId];
    const beans = (businessInfo.orderSendBeansMap || {})[o.orderId];
    // 售后按钮挂在商品级（wareButtonList），订单级（operateButtonList）只有删除/立即购买
    const buttons = [
      ...(o.operateButtonList || []).map(b => b.buttonName || ""),
      ...(o.wareList || []).flatMap(w => (w.wareButtonList || []).map(b => b.buttonName || ""))
    ].join(" ");
    const parentId = o.parentId === undefined || o.parentId === null ? "" : String(o.parentId);
    // 接口的 totalPrice 比列表页展示更准（补贴单页面显示 ¥0.00，接口给真实成交价）
    // 注意：0 是有效金额，不能走 `|| ""`，否则零元单会被当成空值
    const payAmount = pay.totalPrice ?? pay.price ?? pay.shouldPay;
    // 部分订单（如京东大药房/互联网医院）只给 orderState 数值、缺 orderStateName，
    // 按已验证的取值兜底，避免状态列空白
    const stateInfo = o.statusInfo || {};
    const stateName = D.clean(stateInfo.orderStateName)
      || JD_STATE_NAMES[stateInfo.orderState] || "";

    return {
      "导出批次": batch, "日期范围": dateLabel,
      "订单编号": String(o.orderId || ""),
      "父订单编号": parentId === "0" ? "" : parentId,
      "店铺名称": D.clean((o.shopInfo || {}).shopName),
      "商品编号": items.map(it => it["商品编号"]).filter(Boolean).join("\n"),
      "商品名称": items.map(it => it["商品名称"]).filter(Boolean).join("\n"),
      "商品数量": items.map(it => it["数量"]).filter(v => v !== "").join("\n"),
      "实付金额": payAmount === undefined || payAmount === null
        ? "" : D.parseMoney(String(payAmount)),
      "支付方式": D.clean(pay.paymentTypeName),
      "付款时间": "",
      "订单返豆": beans && beans.beanNumTotal ? String(beans.beanNumTotal) : "",
      "京豆抵扣金额": "",
      "下单时间": D.clean(o.dateSubmit),
      "订单状态": stateName,
      "收货人姓名": D.clean(consignee.customerName),
      "收货地址": D.clean(consignee.address),
      "收货人电话": D.clean(consignee.mobile),
      "物流公司": "", "快递单号": "",
      // 接口已给配送方式，无需从详情页正则提取（旧正则会误抓到「付款方式」标签）
      "配送方式": D.clean(o.shipmentTypeName),
      "商品总价": "", "运费": "",
      "详情补充状态": "未请求",
      "订单详情域名路径": detailUrl ? D.hostPath(detailUrl) : "",
      "商品明细JSON": JSON.stringify(items),
      "有售后入口": /售后|退款|退货|换货/.test(buttons) ? "是" : "否",
      "有发票入口": invoice && invoice.ivcLandStatus === 1 ? "是" : "否",
      "_detailUrl": detailUrl
    };
  }

  // ---------- 详情补充 ----------

  async function enrichOrderFromDetail(order) {
    const url = order._detailUrl;
    if (!url || !/^https:\/\/(details\.(jd|yiyaojd)\.com|svp\.jd\.com)\//.test(url)) {
      order["详情补充状态"] = url ? "不支持的详情页" : "无详情链接";
      return;
    }
    try {
      const html = await D.fetchText(url);
      assertLoggedIn(html, url);
      const doc = D.parseHtml(html);
      const t = D.compactText(doc.body?.textContent || "");
      let hits = 0;
      // 只统计「真正补上了空字段」的次数，避免详情页没有有效内容却报成功
      const set = (key, value) => {
        if (!value || order[key]) return;
        order[key] = value;
        hits++;
      };

      set("付款时间", D.valueByPatterns(t, [
        /付款时间：\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/
      ]));
      set("支付方式", D.valueByPatterns(t, [
        /付款方式：\s*([^\s：]+支付|货到付款|公司转账|银行卡|微信|白条)/
      ]));
      set("物流公司", D.valueByPatterns(t, [
        /承运人：\s*(.*?)(?:快递咨询|货运单号：|\s{2,}|$)/,
        /国内物流承运方：\s*(.*?)\s*货运单号：/,
        /交付([\u4e00-\u9fa5A-Za-z]+)，/
      ]));
      set("快递单号", D.valueByPatterns(t, [
        /货运单号：\s*([A-Za-z0-9-]+)/,
        /运单号为\s*([A-Za-z0-9-]+)/,
        /快递单号：\s*([A-Za-z0-9-]+)/
      ]));
      set("配送方式", D.valueByPatterns(t, [
        /送货方式[：:]\s*([^\s：:]{1,12}(?:快递|配送|自提))/
      ]));
      set("商品总价", D.parseMoney(D.valueByPatterns(t, [
        /商品总(?:价|额)：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])));
      set("运费", D.parseMoney(D.valueByPatterns(t, [
        /运费：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])));
      set("京豆抵扣金额", D.parseMoney(D.valueByPatterns(t, [
        /京豆：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])));
      set("订单返豆", D.parseInteger(D.valueByPatterns(t, [/购物返京豆已获得\s*(\d+)\s*京豆/])));

      // svp.jd.com 等新版详情页由前端渲染，抓到的 HTML 可能没有正文字段
      order["详情补充状态"] = hits > 0 ? "成功" : "无有效详情";
    } catch (e) {
      order["详情补充状态"] = "失败：" + (e instanceof Error ? e.message : String(e));
    }
  }

  // ---------- 工具 ----------

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
      let fetched = 0;
      let total = 0;
      while (!D.cancelRequested) {
        if (options.maxPages && page > options.maxPages) break;

        D.updateOverlay("读取 " + range.label + " 第 " + page + " 页，已收集 " + ordersById.size + " 个订单...");

        const { orders: pageOrders, total: pageTotal, businessInfo } =
          await fetchJdOrderPage(range.value, options.status || "4096", page);
        total = pageTotal;

        for (const raw of pageOrders) {
          const row = mapApiOrder(raw, range.label, batch, businessInfo);
          if (row["订单编号"] && !ordersById.has(row["订单编号"])) {
            ordersById.set(row["订单编号"], row);
          }
        }
        fetched += pageOrders.length;

        // 接口会返回总数，按总数与空页判断结束，避免多余请求
        if (pageOrders.length < PAGE_SIZE || fetched >= total) break;
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
    D.downloadCSV("jd-orders-" + batch + "-" + suffix + ".csv", final, HEADERS);
    D.updateOverlay(
      "导出完成：" + final.length + " 个订单。" + (D.cancelRequested ? "（提前停止）" : "")
        // 0 条最常见的成因就是站点改版/接口变动，此时直接给反馈入口
        + (final.length === 0 ? "若确认有订单却导出为 0，可能是京东改版，请到 GitHub Issues 或 B 站视频评论区反馈。" : ""),
      true
    );
  }

  // ---------- 初始化 ----------

  D.setupMessaging("jd", runExport);
})();
