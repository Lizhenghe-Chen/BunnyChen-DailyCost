// ── Custom Emoji 配置（emoji-mart Picker "Custom" 分类）──────────
// Party Parrots · Reactions (SVG) · Cats · Mascots

// ── Vite glob 自动导入所有 emoji 图片 ──────────────────
const assets = import.meta.glob<{ default: string }>("./assets/emoji/*.{gif,png}", { eager: true });
const src = (filename: string): string => {
  for (const [path, mod] of Object.entries(assets)) {
    if (path.endsWith("/" + filename)) return mod.default;
  }
  throw new Error(`Emoji asset not found: ${filename}`);
};

// ── 内联 SVG Reaction 表情（blob 风格，零额外请求）─────

const svgDataUri = (body: string) => `data:image/svg+xml,${encodeURIComponent(body)}`;

const K = { y: "#FFD93D", r: "#FF6B6B", b: "#4ECDC4", g: "#6BCB77", p: "#A66CFF", o: "#FF8C42", k: "#FF85A1", w: "#FFFFFF", n: "#333333", br: "#C4956A" };

const blob = (face: string, color = K.y) => svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="34" r="28" fill="${color}"/>${face}</svg>`
);

// prettier-ignore
const reactions: [string, string, string[], string][] = [
  ["blob_think", "Think Blob",    ["think","hmm","ponder","wonder"], blob(`<circle cx="22" cy="28" r="4" fill="${K.n}"/><circle cx="42" cy="28" r="4" fill="${K.n}"/><rect x="26" y="28" width="12" height="4" rx="2" fill="${K.y}"/><path d="M32 44 Q32 50 28 50" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="46" cy="22" r="8" fill="${K.b}" opacity="0.7"/><text x="43" y="26" font-size="10">?</text>`, K.b)],
  ["blob_wow",   "Wow Blob",      ["wow","surprised","shocked","omg"], blob(`<circle cx="22" cy="28" r="7" fill="${K.w}"/><circle cx="22" cy="28" r="3.5" fill="${K.n}"/><circle cx="42" cy="28" r="7" fill="${K.w}"/><circle cx="42" cy="28" r="3.5" fill="${K.n}"/><ellipse cx="32" cy="45" rx="7" ry="5" fill="${K.n}"/>`)],
  ["blob_cool",  "Cool Blob",     ["cool","sunglasses","swag"], blob(`<rect x="14" y="22" width="36" height="12" rx="4" fill="${K.n}"/><rect x="16" y="24" width="14" height="8" rx="3" fill="${K.n}"/><rect x="34" y="24" width="14" height="8" rx="3" fill="${K.n}"/><circle cx="22" cy="28" r="1.5" fill="${K.w}"/><circle cx="40" cy="28" r="1.5" fill="${K.w}"/><path d="M24 44 Q32 50 40 44" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/>`)],
  ["blob_love",  "Love Blob",     ["love","heart","like","adore"], blob(`<circle cx="22" cy="28" r="3.5" fill="${K.n}"/><circle cx="42" cy="28" r="3.5" fill="${K.n}"/><path d="M22 22 Q22 16 28 16 Q32 16 32 20 Q32 16 36 16 Q42 16 42 22 Q42 30 32 38 Q22 30 22 22Z" fill="${K.r}"/><path d="M24 45 Q32 52 40 45" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/>`, K.k)],
  ["blob_laugh", "Laugh Blob",    ["laugh","lol","funny","haha","joy"], blob(`<path d="M18 26 Q22 22 26 26" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M38 26 Q42 22 46 26" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="32" cy="42" rx="10" ry="7" fill="${K.n}"/><ellipse cx="32" cy="39" rx="8" ry="4" fill="${K.r}"/><circle cx="28" cy="38" r="1.5" fill="${K.w}"/><circle cx="36" cy="38" r="1.5" fill="${K.w}"/>`)],
  ["blob_cry",   "Cry Blob",      ["cry","sad","tears","sob"], blob(`<circle cx="22" cy="30" r="4" fill="${K.n}"/><circle cx="42" cy="30" r="4" fill="${K.n}"/><path d="M18 26 Q14 22 18 20" stroke="${K.b}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M46 26 Q50 22 46 20" stroke="${K.b}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M24 44 Q32 38 40 44" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="18" cy="40" r="3" fill="${K.b}" opacity="0.6"/><circle cx="46" cy="40" r="3" fill="${K.b}" opacity="0.6"/>`)],
  ["blob_angry", "Angry Blob",    ["angry","mad","rage","furious"], blob(`<line x1="16" y1="22" x2="26" y2="30" stroke="${K.n}" stroke-width="3.5" stroke-linecap="round"/><line x1="26" y1="22" x2="16" y2="30" stroke="${K.n}" stroke-width="3.5" stroke-linecap="round"/><line x1="38" y1="22" x2="48" y2="30" stroke="${K.n}" stroke-width="3.5" stroke-linecap="round"/><line x1="48" y1="22" x2="38" y2="30" stroke="${K.n}" stroke-width="3.5" stroke-linecap="round"/><path d="M24 46 Q32 40 40 46" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/>`, K.r)],
  ["blob_sweat", "Sweat Blob",    ["sweat","nervous","anxiety","stress"], blob(`<circle cx="22" cy="28" r="4.5" fill="${K.n}"/><circle cx="42" cy="28" r="4.5" fill="${K.n}"/><path d="M24 42 Q32 36 40 42 Q32 48 24 42Z" fill="${K.n}"/><circle cx="32" cy="42" r="2" fill="${K.w}"/><ellipse cx="50" cy="18" rx="4" ry="6" fill="${K.b}" opacity="0.7"/>`)],
  ["blob_party", "Party Blob",    ["party","celebrate","birthday","fun"], blob(`<circle cx="22" cy="28" r="3" fill="${K.n}"/><circle cx="42" cy="28" r="3" fill="${K.n}"/><ellipse cx="32" cy="42" rx="9" ry="6" fill="${K.n}"/><path d="M26 16 L32 4 L38 16Z" fill="${K.p}"/><rect x="29" y="4" width="6" height="6" rx="3" fill="${K.p}"/><circle cx="20" cy="12" r="4" fill="${K.o}"/><circle cx="44" cy="10" r="4" fill="${K.g}"/><circle cx="32" cy="2" r="3" fill="${K.k}"/><circle cx="18" cy="18" r="2.5" fill="${K.b}"/><circle cx="46" cy="18" r="2.5" fill="${K.r}"/>`)],
  ["blob_zzz",   "Sleep Blob",    ["sleep","zzz","tired","boring"], blob(`<line x1="18" y1="26" x2="26" y2="30" stroke="${K.n}" stroke-width="3" stroke-linecap="round"/><line x1="38" y1="26" x2="46" y2="30" stroke="${K.n}" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="44" rx="5" ry="4" fill="${K.n}"/><text x="38" y="18" font-size="12" font-weight="bold" fill="${K.p}" font-family="sans-serif">Z</text><text x="46" y="10" font-size="16" font-weight="bold" fill="${K.p}" font-family="sans-serif">Z</text><text x="54" y="4" font-size="20" font-weight="bold" fill="${K.p}" font-family="sans-serif">Z</text>`, K.g)],
  ["blob_clap",  "Clap Blob",     ["clap","applause","bravo","congrats"], blob(`<circle cx="22" cy="30" r="3" fill="${K.n}"/><circle cx="42" cy="30" r="3" fill="${K.n}"/><path d="M24 42 Q32 38 40 42" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="16" cy="18" rx="8" ry="6" fill="${K.o}" transform="rotate(-20 16 18)"/><ellipse cx="48" cy="18" rx="8" ry="6" fill="${K.o}" transform="rotate(20 48 18)"/><circle cx="32" cy="14" r="5" fill="${K.o}" opacity="0.5"/>`)],
  ["blob_shrug", "Shrug Blob",    ["shrug","idk","whatever","dunno"], blob(`<circle cx="22" cy="28" r="4" fill="${K.n}"/><circle cx="42" cy="28" r="4" fill="${K.n}"/><path d="M24 44 Q32 40 40 44" stroke="${K.n}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 14 Q16 6 20 14" stroke="${K.br}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M44 14 Q48 6 52 14" stroke="${K.br}" stroke-width="4" fill="none" stroke-linecap="round"/>`, K.o)],
];

// ── 表情配置：统一数据结构 [id, name, keywords, src] ─────
type EmojiDef = [string, string, string[], string];

const e = (id: string, name: string, keywords: string[], file: string): EmojiDef =>
  [id, name, keywords, file.startsWith("data:") ? file : src(file)];

const parrots: EmojiDef[] = [
  e("party_parrot",        "Party Parrot",       ["party","dance","celebrate","parrot"],  "party_parrot.gif"),
  e("parrot_conga",        "Conga Parrot",       ["conga","line","dance","parrot"],       "parrot_conga.gif"),
  e("parrot_fast",         "Fast Parrot",        ["fast","speed","nyoom","parrot"],       "parrot_fast.gif"),
  e("parrot_deal_with_it", "Deal With It",       ["cool","sunglasses","deal","parrot"],   "parrot_deal_with_it.gif"),
  e("parrot_wow",          "Shuffle Parrot",     ["shuffle","dance","party","parrot"],    "parrot_wow.gif"),
  e("parrot_sad",          "Sad Parrot",         ["sad","cry","parrot"],                  "parrot_sad.gif"),
  e("parrot_angry",        "Angry Parrot",       ["angry","mad","parrot"],                "parrot_angry.gif"),
  e("parrot_coffee",       "Coffee Parrot",      ["coffee","cafe","morning","parrot"],    "parrot_coffeeparrot.gif"),
  e("parrot_science",      "Science Parrot",     ["science","experiment","lab","parrot"], "parrot_scienceparrot.gif"),
  e("parrot_gentleman",    "Gentleman Parrot",   ["gentleman","classy","tophat","parrot"],"parrot_gentlemanparrot.gif"),
  e("parrot_popcorn",      "Popcorn Parrot",     ["popcorn","movie","snack","parrot"],    "parrot_popcornparrot.gif"),
  e("parrot_spy",          "Spy Parrot",         ["spy","secret","agent","parrot"],       "parrot_spyparrot.gif"),
  e("parrot_twin",         "Twin Parrot",        ["twin","double","parrot"],              "parrot_twinsparrot.gif"),
  e("parrot_wine",         "Wine Parrot",        ["wine","drink","cheers","parrot"],      "parrot_wineparrot.gif"),
  e("parrot_parrot",       "Classic Parrot",     ["parrot","classic","original"],          "parrot_parrot.gif"),
];

const cats: EmojiDef[] = [
  e("cat_vibing",  "Vibing Cat",  ["cat","vibe","dance","music"],          "cat_vibing.gif"),
  e("cat_happy",   "Happy Cat",   ["cat","happy","joy","smile"],           "cat_happy.gif"),
  e("cat_serious", "Serious Cat", ["cat","serious","stern","judge"],       "cat_serious.gif"),
  e("cat_banana",  "Banana Cat",  ["cat","banana","fruit","funny"],        "cat_banana.gif"),
  e("cat_huh",     "Huh Cat",     ["cat","huh","confused","what"],         "cat_huh.gif"),
  e("cat_pop",     "Pop Cat",     ["cat","pop","surprise","shock"],        "cat_pop.gif"),
];

// ── 导出 ────────────────────────────────────────────

function toCategory(id: string, name: string, defs: EmojiDef[]) {
  return {
    id, name,
    emojis: defs.map(([eid, ename, keywords, emojiSrc]) => ({
      id: eid, name: ename, keywords, skins: [{ src: emojiSrc }],
    })),
  };
}

export const customEmoji = [
  toCategory("parrots",   "Party Parrots", parrots),
  toCategory("reactions", "Reactions",     reactions),
  toCategory("cats",      "Cats",          cats),
  toCategory("mascots",   "Mascots",       [
    e("octocat", "Octocat", ["github","octocat","cat","dev"], "octocat.png"),
    e("star",    "Star",    ["star","favorite","shine"],       "star.png"),
    e("rocket",  "Rocket",  ["rocket","launch","space"],       "rocket.png"),
    e("fire",    "Fire",    ["fire","flame","hot"],             "fire.png"),
  ]),
];

// ── 快速查找：emoji ID → 图片 URL ──────────────────
export const customEmojiSrc: Record<string, string> = {};
for (const cat of customEmoji) {
  for (const emoji of cat.emojis) {
    if (emoji.skins[0]?.src) customEmojiSrc[emoji.id] = emoji.skins[0].src;
  }
}

/** 渲染 emoji：Unicode → 文本，自定义 ID/URL → <img> */
export function renderEmoji(emoji: string): string {
  const imgSrc = customEmojiSrc[emoji] || (/^(\/|data:|http)/.test(emoji) ? emoji : "");
  return imgSrc
    ? `<img src="${imgSrc}" style="width:1.15em;height:1.15em;vertical-align:middle;object-fit:contain;" />`
    : emoji;
}
