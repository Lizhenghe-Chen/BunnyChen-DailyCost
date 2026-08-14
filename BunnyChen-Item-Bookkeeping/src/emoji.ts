// ── Emoji 匹配 & 选择器 UI（基于 emoji-mart）──────────

import data from "@emoji-mart/data";
import { Picker, Data, init as initEmojiMart } from "emoji-mart";
import { customEmoji, customEmojiSrc } from "./custom-emoji";

let _initPromise: Promise<void> | null = null;

/**
 * 确保 emoji-mart 已初始化（含 custom），并防止 Picker 二次 init 的过滤。
 *
 * emoji-mart 内部机制：Picker 的 connectedCallback 会第二次调用 init()，
 * 其中 case 36 通过 `!!c.name` 过滤掉所有自定义分类。
 * 解决：在第一次 init 后去掉 Data.categories 中自定义分类的 name，
 * 让 case 36 的检查失效，自定义分类得以保留。
 */
async function ensureInit() {
  if (!_initPromise) {
    _initPromise = initEmojiMart({ data, custom: customEmoji }).then(() => {
      const customIds = new Set(customEmoji.map(c => c.id));
      if (Data?.categories) {
        for (const cat of Data.categories) {
          if (customIds.has(cat.id)) delete cat.name;
        }
      }
    });
  }
  await _initPromise;
}

// ── Emoji 选择面板（emoji-mart Picker）──────────

/** 将 app 主颜色同步到 emoji-mart Picker（穿透 Shadow DOM） */
function syncPickerTheme(pickerEl: HTMLElement): void {
  const cs = getComputedStyle(document.documentElement);
  const hex2rgb = (hex: string) => {
    const h = hex.trim().replace("#", "");
    if (h.length < 6) return "";
    return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
  };
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const bg = hex2rgb(v("--bg-card"));
  const fg = hex2rgb(v("--text"));
  const accent = hex2rgb(v("--primary"));
  const inputBg = hex2rgb(v("--bg-input"));
  const border = v("--border");

  // 批量设置 CSS 变量
  const vars: Record<string, string> = {
    "--em-rgb-background": bg, "--em-rgb-color": fg, "--em-rgb-accent": accent, "--em-rgb-input": inputBg,
    "--rgb-accent": accent, "--rgb-color": fg, "--rgb-background": bg, "--rgb-input": inputBg,
    "--em-color-border": border,
    "--text": v("--text"), "--border": border, "--text-tertiary": v("--text-tertiary"), "--shadow": "none",
  };
  for (const [k, val] of Object.entries(vars)) pickerEl.style.setProperty(k, val);
}

export async function initEmojiPicker(containerEl: HTMLElement, currentEmoji: string): Promise<void> {
  await ensureInit();
  let selected = currentEmoji || "📦";

  containerEl.innerHTML = `
    <div class="emoji-picker-wrap">
      <button type="button" class="emoji-btn" id="emoji-btn">${selected}</button>
      <div class="emoji-popover emoji-mart-popover" id="emoji-popover"></div>
    </div>
  `;

  const btn = containerEl.querySelector("#emoji-btn")!;
  const popover = containerEl.querySelector("#emoji-popover")!;

  // 如果当前 emoji 是自定义表情 ID，按钮显示对应图片
  const initSrc = customEmojiSrc[selected];
  if (initSrc) {
    btn.innerHTML = `<img src="${initSrc}" style="width:40px;height:40px;object-fit:contain;" />`;
  }

  const picker = new Picker({
    data,
    onEmojiSelect: (e: { native?: string; id?: string }) => {
      if (e.native) {
        // 标准 Unicode emoji → 直接显示文字
        selected = e.native;
        btn.innerHTML = "";
        btn.textContent = e.native;
      } else {
        // 自定义图片表情 → 存 ID，按钮显示图片（通过查表获取 src）
        selected = e.id || "📦";
        const src = customEmojiSrc[e.id || ""];
        if (src) {
          btn.innerHTML = `<img src="${src}" style="width:40px;height:40px;object-fit:contain;" />`;
        } else {
          btn.textContent = e.id || "📦";
        }
      }
      popover.classList.remove("show");
    },
    theme: (() => {
      const t = document.documentElement.getAttribute("data-theme");
      if (t === "dark") return "dark";
      if (t === "light") return "light";
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    })(),
    set: "native",
    locale: "zh",
    previewPosition: "none",
    maxFrequentRows: 2,
    emojiButtonSize: 36,
    emojiSize: 22,
  });

  popover.appendChild(picker as unknown as HTMLElement);

  // 同步 app 主颜色到 emoji-mart
  syncPickerTheme(picker as unknown as HTMLElement);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const willShow = !popover.classList.contains("show");
    // Close all other popovers first
    document.querySelectorAll(".emoji-popover.show").forEach(p => p.classList.remove("show"));
    if (willShow) popover.classList.add("show");
  });

  // Click outside to close (delegated to document, only when picker is visible)
  document.addEventListener("click", function closePopover(e: Event) {
    if (!popover.classList.contains("show")) return;
    const target = e.target as Node;
    if (!containerEl.contains(target)) popover.classList.remove("show");
  });

  (containerEl as HTMLElement & { __getEmoji?: () => string }).__getEmoji = () => selected;
}
