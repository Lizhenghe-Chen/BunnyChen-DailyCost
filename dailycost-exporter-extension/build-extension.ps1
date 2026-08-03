# ============================================================================
# 打包浏览器扩展 → 网站可直接下载的 zip
# 用法：在 dailycost-exporter-extension 目录下运行  .\build-extension.ps1
# 输出：docs/assets/dailycost-exporter-extension.zip（随网站自动发布）
# ============================================================================
$ErrorActionPreference = 'Stop'

$src     = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $src
$outDir  = Join-Path $repoRoot 'docs\assets'
$outZip  = Join-Path $outDir 'dailycost-exporter-extension.zip'

# 排除打包脚本本身与旧 zip
$files = Get-ChildItem -Path $src -File | Where-Object { $_.Extension -notin @('.ps1', '.zip') }
if (-not $files) { throw "未在 $src 找到扩展文件" }

# 在临时目录组装干净的扩展目录（避免带入打包脚本）
$tmpRoot = Join-Path $env:TEMP 'dailycost-exporter-extension-build'
$tmpExt  = Join-Path $tmpRoot 'dailycost-exporter-extension'
if (Test-Path $tmpRoot) { Remove-Item $tmpRoot -Recurse -Force }
New-Item -ItemType Directory -Path $tmpExt -Force | Out-Null
Copy-Item $files.FullName $tmpExt

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
Compress-Archive -Path $tmpExt -DestinationPath $outZip -Force
Remove-Item $tmpRoot -Recurse -Force

$size = [math]::Round((Get-Item $outZip).Length / 1KB, 1)
Write-Host "OK 已生成: $outZip ($size KB)"
