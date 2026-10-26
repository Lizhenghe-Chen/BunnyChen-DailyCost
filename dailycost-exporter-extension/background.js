// background.js — 统一 fetch 代理
// 京东和淘宝详情页跨域请求通过此 service worker 代理

const ALLOWED_HOSTS = new Set([
  // 淘宝
  "trade.taobao.com",
  "trade.tmall.com",
  "buyertrade.taobao.com",
  // 京东（order.jd.com 境内 / order.jd.hk 港站，两者是同一订单中心应用）
  "order.jd.com",
  "order.jd.hk",
  "details.jd.com",
  "details.jd.hk",
  "details.yiyaojd.com",
  "svp.jd.com",
  "svp.jd.hk",
  "api.m.jd.com"
]);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "DCE_FETCH") return false;

  (async () => {
    try {
      const url = new URL(message.url);
      if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
        throw new Error("Blocked non-whitelisted URL: " + url.hostname);
      }

      const method = (message.method || "GET").toUpperCase();
      const init = { credentials: "include", redirect: "follow", method };
      if (method !== "GET" && method !== "HEAD") {
        init.headers = message.headers || {};
        init.body = message.body || "";
      }

      const response = await fetch(url.href, init);
      const text = await response.text();
      sendResponse({
        ok: response.ok,
        status: response.status,
        finalUrl: response.url,
        text
      });
    } catch (error) {
      sendResponse({
        ok: false,
        status: 0,
        finalUrl: message.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();

  return true; // 保持消息通道开放
});
