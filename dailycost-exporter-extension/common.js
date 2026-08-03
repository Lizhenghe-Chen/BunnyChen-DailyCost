// common.js — DailyCost Vault Exporter 共享模块
// 所有 content script 之前加载，提供 overlay / 下载 / 工具函数

(() => {
  if (window.__DCE) return;

  const DCE = {
    cancelRequested: false,
    isRunning: false,
    _overlay: null,

    // ========== Overlay ==========

    /** 创建或返回右下角浮动进度面板 */
    ensureOverlay() {
      if (this._overlay) return this._overlay;
      const el = document.createElement("div");
      el.style.cssText = [
        "position:fixed", "right:16px", "bottom:16px", "z-index:2147483647",
        "width:310px", "padding:12px", "border:1px solid #d9e2ec",
        "border-radius:8px", "box-shadow:0 12px 32px rgba(15,23,42,.18)",
        "background:#fff", "color:#102a43",
        "font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
      ].join(";");
      document.body.appendChild(el);
      this._overlay = el;
      return el;
    },

    /** 更新 overlay 文字；done=true 时附加关闭按钮 */
    updateOverlay(msg, done = false) {
      const el = this.ensureOverlay();
      el.textContent = msg;
      if (done) {
        const btn = document.createElement("button");
        btn.textContent = "关闭";
        btn.style.cssText = "display:block;margin-top:8px;padding:4px 10px;border:0;border-radius:5px;background:#52606d;color:#fff;cursor:pointer";
        btn.addEventListener("click", () => { el.remove(); this._overlay = null; });
        el.appendChild(btn);
      }
    },

    // ========== 下载 ==========

    downloadText(filename, text, mime) {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },

    downloadCSV(filename, rows, headers) {
      const csv = this.toCsv(rows, headers);
      this.downloadText(filename, "\uFEFF" + csv, "text/csv;charset=utf-8");
    },

    // ========== CSV 生成 ==========

    toCsv(rows, headers) {
      const h = headers || Object.keys(rows[0] || {});
      const lines = [h, ...rows.map(r => h.map(k => r[k] ?? ""))];
      return lines.map(row => row.map(this.csvCell).join(",")).join("\r\n");
    },

    csvCell(value) {
      const raw = typeof value === "object" && value !== null
        ? JSON.stringify(value) : String(value ?? "");
      const text = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
      return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    },

    // ========== 工具函数 ==========

    timestampForName() {
      const n = new Date();
      const p = v => String(v).padStart(2, "0");
      return n.getFullYear() + p(n.getMonth() + 1) + p(n.getDate())
        + "-" + p(n.getHours()) + p(n.getMinutes()) + p(n.getSeconds());
    },

    delay(ms) {
      return new Promise(r => setTimeout(r, Math.max(0, Number(ms) || 0)));
    },

    sleep: ms => new Promise(r => setTimeout(r, Math.max(0, ms || 0))),

    // ========== 文本处理 ==========

    clean(v) {
      return String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    },

    compactText(v) {
      return this.clean(v).replace(/\s*([：:])/g, "$1");
    },

    parseMoney(v) {
      const m = String(v || "").replace(/,/g, "")
        .match(/[-+－]?\s*[¥￥]?\s*(\d+(?:\.\d+)?)/);
      return m ? m[1] : "";
    },

    parseInteger(v) {
      const m = String(v || "").match(/\d+/);
      return m ? String(Number(m[0])) : "";
    },

    /** "2025 年 11 月 29 日" → "2025-11-29" */
    normDate(v) {
      const m = String(v || "").match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : this.clean(v);
    },

    /** "2024-01-15 12:30:45" → "2024-01-15 12:30:45" (保留精度) */
    normTime(v) {
      if (!v) return "";
      const m = String(v).match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0")
        + " " + m[4].padStart(2, "0") + ":" + m[5] + ":" + (m[6] || "00");
      return String(v);
    },

    hostPath(url) {
      try { const p = new URL(url); return p.hostname + p.pathname; }
      catch (_) { return url; }
    },

    /** 正则匹配组提取，返回第一个匹配成功的组1 */
    valueByPatterns(text, patterns) {
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) return this.clean(m[1]);
      }
      return "";
    },

    // ========== 脱敏 ==========

    maskOrderId(v) {
      const t = String(v || "");
      return t.length <= 4 ? "****" : t.replace(/\d(?=\d{4})/g, "*");
    },

    maskName(v) {
      const t = this.clean(v);
      if (!t) return "";
      return t.length <= 1 ? "*" : t[0] + "*".repeat(Math.max(1, t.length - 1));
    },

    maskAddr(v) {
      const t = this.clean(v);
      if (!t) return "";
      const m = t.match(/^(.{0,16}?(?:省|市|区|县|自治区|特别行政区))/);
      return m ? m[1] + "***" : t.slice(0, 6) + "***";
    },

    maskPhone(v) {
      return this.clean(v).replace(/(\d{3})\d{4}(\d+)/g, "$1****$2");
    },

    // ========== 网络请求 ==========

    /** 通过 background.js 代理 fetch（统一消息类型 DCE_FETCH） */
    async fetchText(url) {
      const u = new URL(url);
      // 同源直接 fetch
      if (u.hostname === location.hostname) {
        const r = await fetch(u.href, { credentials: "include", redirect: "follow" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.text();
      }
      // 跨域通过 background 代理
      const m = await chrome.runtime.sendMessage({ type: "DCE_FETCH", url });
      if (!m || !m.ok) throw new Error(m?.error || "HTTP " + (m?.status || "error"));
      return m.text || "";
    },

    parseHtml(html) {
      return new DOMParser().parseFromString(html, "text/html");
    },

    // ========== 消息监听（统一入口） ==========

    /**
     * 设置平台消息监听
     * @param {string} platform - "tb" | "jd" | "steam"
     * @param {function} runExport - (options) => Promise<void>
     */
    setupMessaging(platform, runExport) {
      const startType = "DCE_" + platform.toUpperCase() + "_START";
      const stopType = "DCE_" + platform.toUpperCase() + "_STOP";

      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (!msg || msg.type === undefined) return false;

        if (msg.type === stopType) {
          DCE.cancelRequested = true;
          DCE.updateOverlay("正在停止...");
          sendResponse({ ok: true });
          return false;
        }

        if (msg.type === startType) {
          if (DCE.isRunning) {
            sendResponse({ ok: false, error: "导出任务已经在运行。" });
            return false;
          }
          DCE.isRunning = true;
          DCE.cancelRequested = false;
          runExport(msg.options || {}).catch(e => {
            DCE.updateOverlay("导出失败：" + (e instanceof Error ? e.message : String(e)), true);
          }).finally(() => { DCE.isRunning = false; });
          sendResponse({ ok: true });
          return false;
        }

        return false;
      });
    }
  };

  window.__DCE = DCE;
})();
