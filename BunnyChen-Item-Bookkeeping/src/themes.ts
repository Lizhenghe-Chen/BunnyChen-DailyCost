// ── 配色主题预设 ──────────────────────────────────────
// glassmorphism 适配：增加鲜艳度，背景色保留供 color-mix 使用

export interface ColorPalette { [key: string]: string; }
export interface ThemePreset { name: string; label: string; emoji: string; light: ColorPalette; dark: ColorPalette; }

const DS={sm:"0 1px 3px rgba(0,0,0,0.32)",md:"0 4px 18px rgba(0,0,0,0.42)",lg:"0 12px 40px rgba(0,0,0,0.58)"};

const T:ThemePreset[]=[
{name:"matcha",label:"抹茶绿",emoji:"🍵",
light:{"--bg":"#EEF8EA","--bg-card":"#D6ECD0","--bg-card-raised":"#DEF2D8","--bg-input":"#E2F4DC","--bg-nav":"rgba(222,242,216,0.82)",
"--text":"#22402A","--text-secondary":"#3C7048","--text-tertiary":"#5C8E66","--text-muted":"#5C8E66",
"--border":"#B8D4AE","--primary":"#88D070","--primary-hover":"#6CBA54","--primary-soft":"#CCECC0",
"--danger":"#DE7668","--danger-hover":"#C9685A","--danger-soft":"#FDF0ED","--success":"#60A870","--success-soft":"#E4F2E6",
"--cost-high":"#D27068","--cost-mid":"#C49068","--cost-low":"#60A870",
"--shadow-sm":"0 1px 3px rgba(34,64,42,0.08)","--shadow-md":"0 4px 18px rgba(34,64,42,0.10)","--shadow-lg":"0 12px 40px rgba(34,64,42,0.13)","--shadow-primary":"0 4px 20px rgba(108,186,84,0.44)",
"--nav-active-color":"#409030","--nav-active-glow":"0 0 0 1px rgba(108,186,84,0.50)",
"--tag-platform-bg":"#CCECC0","--tag-platform-color":"#409030","--tag-store-bg":"#E0ECD8","--tag-store-color":"#3C7048",
"--tag-model-bg":"#FDF5E8","--tag-model-color":"#C88A40",
"--input-focus-glow":"0 0 0 3px rgba(108,186,84,0.22)","--fab-hover-shadow":"0 6px 28px rgba(108,186,84,0.60)"},
dark:{"--bg":"#122A10","--bg-card":"#1E3C1A","--bg-card-raised":"#24471F","--bg-input":"#224018","--bg-nav":"rgba(36,71,31,0.9)",
"--text":"#E6F6E0","--text-secondary":"#9BD08A","--text-tertiary":"#74B064","--text-muted":"#74B064",
"--border":"#2E5A28","--primary":"#6ED85A","--primary-hover":"#54C240","--primary-soft":"#1A3C16",
"--danger":"#E8887A","--danger-soft":"#382420","--success":"#78C088","--success-soft":"#1C3022",
"--shadow-sm":DS.sm,"--shadow-md":DS.md,"--shadow-lg":DS.lg,"--shadow-primary":"0 4px 20px rgba(84,194,64,0.5)",
"--nav-active-color":"#6ED85A","--nav-active-glow":"0 0 0 1px rgba(110,216,90,0.55)",
"--tag-platform-bg":"#20401C","--tag-platform-color":"#6ED85A","--tag-store-bg":"#28401F","--tag-store-color":"#9BD08A",
"--tag-model-bg":"#403C28","--tag-model-color":"#D4A858",
"--input-focus-glow":"0 0 0 3px rgba(84,194,64,0.32)","--fab-hover-shadow":"0 6px 28px rgba(84,194,64,0.6)"}},
{name:"sky",label:"天之蓝",emoji:"☁️",
light:{"--bg":"#E4F0FA","--bg-card":"#C8DEF0","--bg-card-raised":"#D4E6F4","--bg-input":"#D8EAF6","--bg-nav":"rgba(212,230,244,0.82)",
"--text":"#1A3A50","--text-secondary":"#306088","--text-tertiary":"#5080A0","--text-muted":"#5080A0",
"--border":"#A0C8E0","--primary":"#4AACE0","--primary-hover":"#2E94CC","--primary-soft":"#C0E0F6",
"--danger":"#D47068","--danger-hover":"#C06058","--danger-soft":"#FCF1EE","--success":"#5E9E76","--success-soft":"#E4F2E8",
"--cost-high":"#D47068","--cost-mid":"#C08860","--cost-low":"#5E9E76",
"--shadow-sm":"0 1px 3px rgba(26,58,80,0.07)","--shadow-md":"0 4px 18px rgba(26,58,80,0.10)","--shadow-lg":"0 12px 40px rgba(26,58,80,0.13)","--shadow-primary":"0 4px 20px rgba(46,148,204,0.44)",
"--nav-active-color":"#2870A8","--nav-active-glow":"0 0 0 1px rgba(46,148,204,0.50)",
"--tag-platform-bg":"#C0E0F6","--tag-platform-color":"#2870A8","--tag-store-bg":"#D4E6F0","--tag-store-color":"#306088",
"--tag-model-bg":"#FDF5E8","--tag-model-color":"#C88A40",
"--input-focus-glow":"0 0 0 3px rgba(46,148,204,0.22)","--fab-hover-shadow":"0 6px 28px rgba(46,148,204,0.60)"},
dark:{"--bg":"#0E2438","--bg-card":"#1A3850","--bg-card-raised":"#1E4058","--bg-input":"#1C3C54","--bg-nav":"rgba(30,64,88,0.9)",
"--text":"#DCF0FC","--text-secondary":"#96C4E4","--text-tertiary":"#6E9CBC","--text-muted":"#6E9CBC",
"--border":"#2A5478","--primary":"#6ED0F8","--primary-hover":"#4CB6E8","--primary-soft":"#163448",
"--danger":"#E4887C","--danger-soft":"#382420","--success":"#76BE88","--success-soft":"#1C3022",
"--shadow-sm":DS.sm,"--shadow-md":DS.md,"--shadow-lg":DS.lg,"--shadow-primary":"0 4px 20px rgba(76,182,232,0.5)",
"--nav-active-color":"#6ED0F8","--nav-active-glow":"0 0 0 1px rgba(110,208,248,0.55)",
"--tag-platform-bg":"#203C54","--tag-platform-color":"#6ED0F8","--tag-store-bg":"#28404C","--tag-store-color":"#96C4E4",
"--tag-model-bg":"#403C28","--tag-model-color":"#D4A858",
"--input-focus-glow":"0 0 0 3px rgba(76,182,232,0.32)","--fab-hover-shadow":"0 6px 28px rgba(76,182,232,0.6)"}},
{name:"berry",label:"莓之紫",emoji:"🫐",
light:{"--bg":"#F0EAF6","--bg-card":"#E0D0EE","--bg-card-raised":"#E6D8F2","--bg-input":"#EADEF4","--bg-nav":"rgba(230,216,242,0.82)",
"--text":"#30204C","--text-secondary":"#503880","--text-tertiary":"#70589A","--text-muted":"#70589A",
"--border":"#C4B4D8","--primary":"#B888D8","--primary-hover":"#A068C8","--primary-soft":"#DEC8F2",
"--danger":"#CE786C","--danger-hover":"#BA685C","--danger-soft":"#FCF1EE","--success":"#6AA47C","--success-soft":"#E6F2EA",
"--cost-high":"#CE786C","--cost-mid":"#BC8C68","--cost-low":"#6AA47C",
"--shadow-sm":"0 1px 3px rgba(48,32,76,0.07)","--shadow-md":"0 4px 18px rgba(48,32,76,0.09)","--shadow-lg":"0 12px 40px rgba(48,32,76,0.12)","--shadow-primary":"0 4px 20px rgba(160,104,200,0.44)",
"--nav-active-color":"#6840A0","--nav-active-glow":"0 0 0 1px rgba(160,104,200,0.50)",
"--tag-platform-bg":"#DEC8F2","--tag-platform-color":"#6840A0","--tag-store-bg":"#E8DCF0","--tag-store-color":"#503880",
"--tag-model-bg":"#FDF5E8","--tag-model-color":"#C88A40",
"--input-focus-glow":"0 0 0 3px rgba(160,104,200,0.22)","--fab-hover-shadow":"0 6px 28px rgba(160,104,200,0.60)"},
dark:{"--bg":"#1A1430","--bg-card":"#2A2444","--bg-card-raised":"#302A4C","--bg-input":"#2E2848","--bg-nav":"rgba(48,42,76,0.9)",
"--text":"#E8E0F8","--text-secondary":"#B8A8D8","--text-tertiary":"#8E7CB0","--text-muted":"#8E7CB0",
"--border":"#443A68","--primary":"#BC90E8","--primary-hover":"#A474D8","--primary-soft":"#2A2050",
"--danger":"#E4887C","--danger-soft":"#382420","--success":"#76BE88","--success-soft":"#1C3022",
"--shadow-sm":DS.sm,"--shadow-md":DS.md,"--shadow-lg":DS.lg,"--shadow-primary":"0 4px 20px rgba(164,116,216,0.5)",
"--nav-active-color":"#BC90E8","--nav-active-glow":"0 0 0 1px rgba(188,144,232,0.55)",
"--tag-platform-bg":"#342C5C","--tag-platform-color":"#BC90E8","--tag-store-bg":"#38304C","--tag-store-color":"#B8A8D8",
"--tag-model-bg":"#403C28","--tag-model-color":"#D4A858",
"--input-focus-glow":"0 0 0 3px rgba(164,116,216,0.32)","--fab-hover-shadow":"0 6px 28px rgba(164,116,216,0.6)"}},
{name:"peach",label:"桃之粉",emoji:"🍑",
light:{"--bg":"#F8ECEC","--bg-card":"#F0D8D8","--bg-card-raised":"#F4E0E0","--bg-input":"#F6E4E4","--bg-nav":"rgba(244,224,224,0.82)",
"--text":"#482830","--text-secondary":"#744050","--text-tertiary":"#945C6C","--text-muted":"#945C6C",
"--border":"#DCC0C0","--primary":"#D48080","--primary-hover":"#C46060","--primary-soft":"#F0C8C8",
"--danger":"#CE786C","--danger-hover":"#BA685C","--danger-soft":"#FCF1EE","--success":"#6AA47C","--success-soft":"#E6F2EA",
"--cost-high":"#CE786C","--cost-mid":"#BC8C68","--cost-low":"#6AA47C",
"--shadow-sm":"0 1px 3px rgba(72,40,48,0.07)","--shadow-md":"0 4px 18px rgba(72,40,48,0.09)","--shadow-lg":"0 12px 40px rgba(72,40,48,0.12)","--shadow-primary":"0 4px 20px rgba(196,96,96,0.44)",
"--nav-active-color":"#A04848","--nav-active-glow":"0 0 0 1px rgba(196,96,96,0.50)",
"--tag-platform-bg":"#F0C8C8","--tag-platform-color":"#A04848","--tag-store-bg":"#F2DEDE","--tag-store-color":"#744050",
"--tag-model-bg":"#FDF5E8","--tag-model-color":"#C88A40",
"--input-focus-glow":"0 0 0 3px rgba(196,96,96,0.22)","--fab-hover-shadow":"0 6px 28px rgba(196,96,96,0.60)"},
dark:{"--bg":"#2A1616","--bg-card":"#3E2424","--bg-card-raised":"#442A2A","--bg-input":"#422828","--bg-nav":"rgba(68,42,42,0.9)",
"--text":"#F8E4E4","--text-secondary":"#D4A8AC","--text-tertiary":"#B07880","--text-muted":"#B07880",
"--border":"#5C3434","--primary":"#E08888","--primary-hover":"#D06868","--primary-soft":"#502424",
"--danger":"#E4887C","--danger-soft":"#382420","--success":"#76BE88","--success-soft":"#1C3022",
"--shadow-sm":DS.sm,"--shadow-md":DS.md,"--shadow-lg":DS.lg,"--shadow-primary":"0 4px 20px rgba(208,104,104,0.5)",
"--nav-active-color":"#E08888","--nav-active-glow":"0 0 0 1px rgba(224,136,136,0.55)",
"--tag-platform-bg":"#482C2C","--tag-platform-color":"#E08888","--tag-store-bg":"#442E2E","--tag-store-color":"#D4A8AC",
"--tag-model-bg":"#403C28","--tag-model-color":"#D4A858",
"--input-focus-glow":"0 0 0 3px rgba(208,104,104,0.32)","--fab-hover-shadow":"0 6px 28px rgba(208,104,104,0.6)"}},
{name:"tangerine",label:"橘之橙",emoji:"🍊",
light:{"--bg":"#F8F0EA","--bg-card":"#F0DECE","--bg-card-raised":"#F4E6D8","--bg-input":"#F6EADE","--bg-nav":"rgba(244,230,216,0.82)",
"--text":"#4A3020","--text-secondary":"#785034","--text-tertiary":"#987050","--text-muted":"#987050",
"--border":"#DCC8B4","--primary":"#D4A070","--primary-hover":"#C88854","--primary-soft":"#F0DCC8",
"--danger":"#CE786C","--danger-hover":"#BA685C","--danger-soft":"#FCF1EE","--success":"#6AA47C","--success-soft":"#E6F2EA",
"--cost-high":"#CE786C","--cost-mid":"#BC8C68","--cost-low":"#6AA47C",
"--shadow-sm":"0 1px 3px rgba(74,48,32,0.07)","--shadow-md":"0 4px 18px rgba(74,48,32,0.09)","--shadow-lg":"0 12px 40px rgba(74,48,32,0.12)","--shadow-primary":"0 4px 20px rgba(200,136,84,0.44)",
"--nav-active-color":"#A06834","--nav-active-glow":"0 0 0 1px rgba(200,136,84,0.50)",
"--tag-platform-bg":"#F0DCC8","--tag-platform-color":"#A06834","--tag-store-bg":"#F0E4D8","--tag-store-color":"#785034",
"--tag-model-bg":"#FDF5E8","--tag-model-color":"#C88A40",
"--input-focus-glow":"0 0 0 3px rgba(200,136,84,0.22)","--fab-hover-shadow":"0 6px 28px rgba(200,136,84,0.60)"},
dark:{"--bg":"#281A12","--bg-card":"#3C2A1C","--bg-card-raised":"#442F20","--bg-input":"#402D1E","--bg-nav":"rgba(68,47,32,0.9)",
"--text":"#F6E8DC","--text-secondary":"#D0B49C","--text-tertiary":"#B09078","--text-muted":"#B09078",
"--border":"#5A3E28","--primary":"#DCA06C","--primary-hover":"#CC8850","--primary-soft":"#482E1C",
"--danger":"#E4887C","--danger-soft":"#382420","--success":"#76BE88","--success-soft":"#1C3022",
"--shadow-sm":DS.sm,"--shadow-md":DS.md,"--shadow-lg":DS.lg,"--shadow-primary":"0 4px 20px rgba(204,136,80,0.5)",
"--nav-active-color":"#DCA06C","--nav-active-glow":"0 0 0 1px rgba(220,160,108,0.55)",
"--tag-platform-bg":"#483420","--tag-platform-color":"#DCA06C","--tag-store-bg":"#443228","--tag-store-color":"#D0B49C",
"--tag-model-bg":"#403C28","--tag-model-color":"#D4A858",
"--input-focus-glow":"0 0 0 3px rgba(204,136,80,0.32)","--fab-hover-shadow":"0 6px 28px rgba(204,136,80,0.6)"}},
];

export const ALL_THEMES:ThemePreset[]=T;
export function getTheme(n:string):ThemePreset|undefined{return T.find(t=>t.name===n)}
export function applyColorTheme(n:string):ThemePreset|undefined{
 const p=getTheme(n);if(!p)return;
 let e=document.getElementById("color-theme-style") as HTMLStyleElement|null;
 if(!e){e=document.createElement("style");e.id="color-theme-style";document.head.appendChild(e)}
 const l=Object.entries(p.light).map(([k,v])=>`${k}:${v}`).join(";");
 const d=Object.entries(p.dark).map(([k,v])=>`${k}:${v}`).join(";");
 // 追加撞色 accent + 分析图表色板（亮色/暗色各一套，保证预设主题也拥有丰富分析色彩）
 const accentL=`--accent-green:#5BA04B;--accent-orange:#E8954A;--accent-blue:#4A8EC0;--accent-purple:#8E6ABE;--chart-0:#5BA04B;--chart-1:#E8954A;--chart-2:#4A8EC0;--chart-3:#8E6ABE;--chart-4:#D4736A;--chart-5:#52A8A0;--chart-6:#B8A040;--chart-7:#D4629A;--chart-8:#6BBA7A;--chart-9:#C07050`;
 const accentD=`--accent-green:#6CD458;--accent-orange:#F0A050;--accent-blue:#5EB8E8;--accent-purple:#A880E0;--chart-0:#6CD458;--chart-1:#F0A050;--chart-2:#5EB8E8;--chart-3:#A880E0;--chart-4:#E88B7D;--chart-5:#5ED4CC;--chart-6:#D4C050;--chart-7:#E86AA8;--chart-8:#74D48A;--chart-9:#D48860`;
 e.textContent=`:root{${l};${accentL}}[data-theme="dark"]{${d};${accentD}}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){${d};${accentD}}}`;
 return p;
}
