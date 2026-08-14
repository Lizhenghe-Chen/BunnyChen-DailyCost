package com.bunnychen.dailycostvault

import android.app.Activity
import android.net.Uri
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileInputStream

// 修复 tauri-plugin-fs 在 Android 上写 content:// URI 产生 0 字节文件的已知 bug
// （plugins-workspace#3356：fs 插件 Kotlin 侧 getFileDescriptor 调用
//   ParcelFileDescriptor.detachFd() 把原始 fd 交给 Rust，detach 后 Java 侧的
//   ParcelFileDescriptor 失效，content provider 在写入前就收到关闭信号并文件元数据
//   定为 0 字节，后续通过游离 fd 的写入无法更新 provider 记账）
// 方案：全程在原生侧用 ContentResolver.openOutputStream 完成复制，让
// OutputStream（及其底层 ParcelFileDescriptor）在写入期间保持存活、正常关闭，
// 这样 content provider 才能看到正确的最终文件大小。

@InvokeArg
class CopyToUriArgs {
  lateinit var sourcePath: String
  lateinit var destUri: String
}

@TauriPlugin
class BackupPlugin(private val activity: Activity) : Plugin(activity) {

  /**
   * 把应用沙盒内的文件复制到 content:// URI（save 对话框所选位置）。
   * 全程在原生侧完成，保证 content provider 记录正确的最终大小。
   */
  @Command
  fun copyFileToUri(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(CopyToUriArgs::class.java)
      val sourceFile = File(args.sourcePath)
      if (!sourceFile.exists()) {
        invoke.reject("Source file does not exist: ${args.sourcePath}")
        return
      }
      val destUri = Uri.parse(args.destUri)
      val outputStream = activity.contentResolver.openOutputStream(destUri)
        ?: run {
          invoke.reject("Cannot open output stream for URI: ${args.destUri}")
          return
        }
      outputStream.use { output ->
        FileInputStream(sourceFile).use { input ->
          input.copyTo(output)
        }
      }
      invoke.resolve(JSObject())
    } catch (t: Throwable) {
      invoke.reject(t.message ?: "Failed to copy file to content URI")
    }
  }
}
