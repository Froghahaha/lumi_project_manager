# Lumi 项目管理系统 — 一键构建脚本
# 用法: .\build.ps1

$ErrorActionPreference = "Stop"
chcp 65001 > $null
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$ScriptDir = $PSScriptRoot
$Python = "C:\ProgramData\anaconda3\python.exe"
$env:PYTHONPATH = $ScriptDir

Write-Host "=== 1. 构建前端 ===" -ForegroundColor Cyan
Push-Location "$ScriptDir\frontend"
try {
    npm run build
} finally {
    Pop-Location
}

Write-Host "=== 2. 复制静态文件 ===" -ForegroundColor Cyan
$StaticDir = "$ScriptDir\backend\static"
if (Test-Path $StaticDir) { Remove-Item $StaticDir -Recurse -Force }
Copy-Item -Recurse "$ScriptDir\frontend\dist" $StaticDir

Write-Host "=== 3. PyInstaller 打包 ===" -ForegroundColor Cyan
Push-Location $ScriptDir
try {
    pyinstaller lumi_server.spec --distpath "$ScriptDir\dist" --workpath "$ScriptDir\build" --clean
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== 完毕 ===" -ForegroundColor Green
Write-Host "输出: $ScriptDir\dist\lumi_server.exe"
Write-Host "运行: .\dist\lumi_server.exe --port 8000"
