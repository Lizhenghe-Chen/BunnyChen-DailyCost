// bridge.js — 注入到淘宝页面 MAIN world
// 读取 window._export_order_protocol，通过 postMessage 回传
(() => {
  if (window.__dcBridgeInstalled) return;
  window.__dcBridgeInstalled = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.type !== "__DCE_TB_GET_DATA__") return;

    const proto = window._export_order_protocol;
    const posMap = window._posToOrderId;

    window.postMessage({
      type: "__DCE_TB_DATA_RESULT__",
      requestId: msg.requestId,
      data: { proto: proto || null, posMap: posMap || null }
    }, "*");
  });
})();
