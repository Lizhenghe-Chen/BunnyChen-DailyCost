import { defineConfig } from "vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// 从 tauri.conf.json 读取版本号（唯一版本来源），注入为编译时常量
import { readFileSync } from "node:fs";
const tauriConf = JSON.parse(readFileSync("./src-tauri/tauri.conf.json", "utf-8"));

// https://vite.dev/config/
export default defineConfig(() => ({
  base: process.env.VITE_BASE || "/",
  define: { __APP_VERSION__: JSON.stringify(tauriConf.version) },
  build: {
    // emoji-mart is isolated in a lazy-loaded chunk (~508 kB minified).
    chunkSizeWarningLimit: 550,
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
