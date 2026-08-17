// Vite 编译时注入的版本号（来自 package.json）
declare const __APP_VERSION__: string;

// ── BunnyChen 资产管理 — 入口 ─────────────────────────────

import { initI18n, changeLang, translateDOM, currentLang, type SupportedLang } from './i18n';
import { loadPref, savePref, loadAllPrefs } from './prefs';
import { initTheme } from './theme';
import { setPrecision, setCurrency, checkForUpdates, renderAutoUpdateStatus, showToast } from './utils';
import { initNavigation, loadItems } from './ui-home';
import { showAddItemModal } from './ui-modal';
import { initAnalytics } from './ui-analytics';

// ── iOS WKWebView 安全区兜底 ────────────────────────────
// 已知问题：iOS WKWebView 首次布局时 env(safe-area-inset-*) 可能尚未计算
// （返回 0，旋转后恢复），导致依赖安全区的 fixed 定位（如底部导航栏）偏移。
// 这里在首帧后强制触发一次重排，并在视觉视口/旋转变化时刷新，
// 促使 WebKit 尽早按 viewport-fit=cover 重新计算安全区。
function patchIOSSafeArea(): void {
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
  const forceReflow = () => {
    void document.body.offsetHeight; // 强制同步 reflow
    window.dispatchEvent(new Event('resize'));
  };
  requestAnimationFrame(() => requestAnimationFrame(forceReflow));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', forceReflow);
  }
  window.addEventListener('orientationchange', () => setTimeout(forceReflow, 150));
}

window.addEventListener('DOMContentLoaded', async () => {
  patchIOSSafeArea();          // iOS 安全区首次计算兜底
  const t0 = performance.now();  // Splash 起始时间

  // ── 首次使用检测：无任何偏好记录 → 应用初始默认值 ──
  const allPrefs = await loadAllPrefs();
  if (Object.keys(allPrefs).length === 0) {
    await savePref('theme', 'system');     // 跟随系统明暗
    await savePref('precision', '1');      // 保留 1 位小数
    // color_theme 'matcha' 和 language 跟随系统 均为代码默认，无需显式保存
  }

  // 并行加载全部偏好（串行 await 在首次运行/缓存未命中时会多次 IPC 往返）
  const [storedLang, savedSort, savedSortDesc, savedShowTotal, savedPrecision, savedColorTheme, savedCurrency] = await Promise.all([
    loadPref('language', ''),
    loadPref('filter_sort', 'daily'),
    loadPref('sort_desc', '1'),
    loadPref('show_total_price', '1'),
    loadPref('precision', '2'),
    loadPref('color_theme', 'matcha'),
    loadPref('currency', '¥'),
  ]);

  // 初始化 i18n
  await initI18n(storedLang || undefined);
  translateDOM();

  // 恢复偏好
  if (savedSort) (document.getElementById('filter-sort') as HTMLSelectElement).value = savedSort;

  const btnSortDir = document.getElementById('btn-sort-dir')!;
  btnSortDir.textContent = savedSortDesc === '0' ? '▲' : '▼';
  btnSortDir.dataset.desc = savedSortDesc;

  (document.getElementById('toggle-show-total') as HTMLInputElement).checked = savedShowTotal !== '0';

  const p = parseInt(savedPrecision);
  setPrecision(isNaN(p) ? 2 : p);
  (document.getElementById('select-precision') as HTMLSelectElement).value = savedPrecision;

  // 配色方案
  (document.getElementById('select-color-theme') as HTMLSelectElement).value = savedColorTheme;

  // 货币符号（独立于语言）
  setCurrency(savedCurrency);
  (document.getElementById('select-currency') as HTMLSelectElement).value = savedCurrency;
  document.getElementById('select-currency')!.addEventListener('change', async function () {
    const v = (this as HTMLSelectElement).value;
    setCurrency(v);
    await savePref('currency', v);
    loadItems();
  });

  // 语言选择器
  const langSelect = document.getElementById('select-language') as HTMLSelectElement;
  langSelect.value = currentLang();
  langSelect.addEventListener('change', async () => {
    await changeLang(langSelect.value as SupportedLang);
    translateDOM();
    loadItems();
    const { loadBatches } = await import('./ui-settings');
    loadBatches();
  });

  // 初始化
  initTheme();
  initNavigation();
  const { initSettings } = await import('./ui-settings');
  await initSettings();
  initAnalytics();
  const { initShare } = await import('./ui-share');
  initShare();
  loadItems();

  // FAB
  document.getElementById('btn-add-item')!.addEventListener('click', showAddItemModal);

  // 回到顶部按钮
  initBackToTop();

  // 版本号（编译时从 package.json 注入）
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = `V${__APP_VERSION__}`;

  // ── 后台检查更新（延时 3 秒，避免影响启动）──
  setTimeout(async () => {
    try {
      // 双通道检查：桌面端通道 A（updater）权威，A 不可用才回退通道 B（GitHub API）
      const { update, info, updaterUsable, updaterFailed } = await checkForUpdates(__APP_VERSION__);
      if (update) {
        renderAutoUpdateStatus(update);
        showToast(`🆕 发现新版本 ${update.version}，点击「关于」区域自动更新`, 'info');
        return;
      }
      // 通道 A 可用且无更新 → 已是最新，无需再查 GitHub API（避免 api.github.com 限流 403）
      if (updaterUsable) return;
      // 桌面端通道 A 检查失败（网络/临时问题）→ 提示稍后重试，不降级到「前往下载」
      if (updaterFailed) {
        const statusEl = document.getElementById('update-status');
        if (statusEl) {
          statusEl.textContent = '⚠️ 网络不稳定，自动更新检查失败，可稍后在「设置 → 检查更新」重试';
          statusEl.className = 'about-update update-error';
        }
        return;
      }
      // 通道 B：GitHub API（Android/浏览器 → 引导手动下载）
      if (info) {
        const statusEl = document.getElementById('update-status');
        if (statusEl) {
          statusEl.innerHTML = `🆕 <a href="${info.releaseUrl}" target="_blank" style="color:inherit;text-decoration:underline">发现新版本 ${info.version}，前往下载</a>`;
          statusEl.className = 'about-update update-available';
        }
        showToast(`🆕 发现新版本 ${info.version}，前往 Release 页面下载`, 'info');
      }
    } catch (e) {
      // 后台检查失败时在关于区域显示错误，方便用户排查
      const statusEl = document.getElementById('update-status');
      if (statusEl) {
        statusEl.textContent = `❌ 检查更新失败: ${e}`;
        statusEl.className = 'about-update update-error';
      }
    }
  }, 3000);

  // ── Splash 结束：加载完成后关闭（最低 200ms 防止闪屏）──
  const elapsed = performance.now() - t0;
  const minDelay = Math.max(0, 200 - elapsed);
  setTimeout(() => {
    const splash = document.getElementById('splash')!;
    splash.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 400, easing: 'ease', fill: 'forwards',
    }).onfinish = () => splash.remove();
  }, minDelay);
});

// ── 回到顶部 ──────────────────────────────────────────
function initBackToTop() {
  const btn = document.getElementById('btn-back-to-top')!;

  const update = () => {
    const page = document.querySelector('.page.active') as HTMLElement | null;
    if (page && page.scrollTop > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  };

  // 监听所有页面的滚动事件
  document.querySelectorAll('.page').forEach(p => {
    p.addEventListener('scroll', update, { passive: true });
  });

  // 监听页面 class 变化（切换页面时触发更新）
  const observer = new MutationObserver(update);
  document.querySelectorAll('.page').forEach(p => {
    observer.observe(p, { attributes: true, attributeFilter: ['class'] });
  });

  // 点击回到顶部
  btn.addEventListener('click', () => {
    const page = document.querySelector('.page.active') as HTMLElement | null;
    page?.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
