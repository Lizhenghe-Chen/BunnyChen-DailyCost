// popup.js — 统一 popup 逻辑
// 自动检测当前标签页平台，显示对应选项，处理开始/停止

const el = (id) => document.getElementById(id);

// ---------- 平台检测 ----------

function detectPlatform(url) {
  if (!url) return null;
  if (/buyertrade\.taobao\.com\/trade\/itemlist\/list_bought_items/i.test(url)) return "tb";
  if (/order\.jd\.com\/center\/list\.action/i.test(url)) return "jd";
  if (/store\.steampowered\.com\/account\/history/i.test(url)) return "steam";
  return null;
}

const PLATFORM_INFO = {
  tb:    { label: "淘宝/天猫", cls: "tb",    msgType: "DCE_TB_START",    stopType: "DCE_TB_STOP" },
  jd:    { label: "京东",      cls: "jd",    msgType: "DCE_JD_START",    stopType: "DCE_JD_STOP" },
  steam: { label: "Steam",     cls: "steam", msgType: "DCE_STEAM_START", stopType: "DCE_STEAM_STOP" }
};

// ---------- 选项收集 ----------

function collectTBOptions() {
  return {
    status: el("tbStatus").value,
    delayMs: Math.max(300, Number(el("tbDelay").value || 1500)),
    maxPages: el("tbMaxPages").value.trim() ? Math.max(1, Number(el("tbMaxPages").value)) : null,
    maskSensitive: el("tbMask")?.checked ?? false
  };
}

function collectJDOptions() {
  return {
    dateMode: el("jdDateMode").value,
    startYear: Number(el("jdStartYear").value || 2014),
    endYear: Number(el("jdEndYear").value || Math.max(2014, new Date().getFullYear() - 1)),
    status: el("jdStatus").value,
    delayMs: Math.max(300, Number(el("jdDelay").value || 1000)),
    maxPages: el("jdMaxPages").value.trim() ? Math.max(1, Number(el("jdMaxPages").value)) : null,
    maskSensitive: el("jdMask")?.checked ?? false
  };
}

function collectSteamOptions() {
  return {
    delayMs: Math.max(300, Number(el("steamDelay").value || 500)),
    maxLoads: Math.max(0, Number(el("steamMaxLoads").value || 0))
  };
}

const COLLECTORS = { tb: collectTBOptions, jd: collectJDOptions, steam: collectSteamOptions };

// ---------- Tab 通信 ----------

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("没有找到当前标签页。");
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    // 如果 content script 未注入，尝试手动注入
    const msg = error instanceof Error ? error.message : String(error);
    if (!/Receiving end does not exist|Could not establish/i.test(msg)) throw error;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["common.js", "content-" + currentPlatform + ".js"]
    });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

// ---------- 状态 ----------

let currentPlatform = null;

function setStatus(text) {
  el("statusText").textContent = text;
}

function setRunning(running) {
  el("startBtn").disabled = running;
  el("stopBtn").disabled = !running;
}

// ---------- 初始化 ----------

async function init() {
  const tab = await getActiveTab();
  currentPlatform = detectPlatform(tab.url || "");

  const badge = el("badge");
  const info = PLATFORM_INFO[currentPlatform];

  // 隐藏所有面板
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

  if (info) {
    badge.textContent = info.label;
    badge.className = "platform-badge " + info.cls;
    el("panel-" + currentPlatform).classList.add("active");
    el("btnRow").style.display = "flex";
    el("landing").classList.remove("active");

    // JD 年份初始化
    if (currentPlatform === "jd") initJDYears();
  } else {
    badge.textContent = "未识别";
    badge.className = "platform-badge unknown";
    el("landing").classList.add("active");
    el("btnRow").style.display = "none";
  }
}

function initJDYears() {
  const nowY = new Date().getFullYear();
  el("jdStartYear").value = "2014";
  el("jdEndYear").value = String(Math.max(2014, nowY - 1));
  el("jdStartYear").max = String(nowY - 1);
  el("jdEndYear").max = String(nowY - 1);

  // 日期模式切换
  el("jdDateMode").addEventListener("change", () => {
    el("jdYearRow").style.display = el("jdDateMode").value === "customYears" ? "grid" : "none";
  });
}

// ---------- 按钮事件 ----------

el("startBtn").addEventListener("click", async () => {
  if (!currentPlatform) return;
  try {
    const info = PLATFORM_INFO[currentPlatform];
    const options = COLLECTORS[currentPlatform]();
    setRunning(true);
    setStatus("已发送导出任务，进度显示在页面右下角。");
    await sendToActiveTab({ type: info.msgType, options });
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e));
    setRunning(false);
  }
});

el("stopBtn").addEventListener("click", async () => {
  if (!currentPlatform) return;
  try {
    const info = PLATFORM_INFO[currentPlatform];
    await sendToActiveTab({ type: info.stopType });
    setStatus("已请求停止。");
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e));
  }
});

// ---------- 启动 ----------

init();
