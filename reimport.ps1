# 清空数据库并重新导入 Excel 数据
# 用法: .\reimport.ps1 [excel文件路径]

param(
    [string]$Xlsx
)

$ErrorActionPreference = "Stop"

# 强制 UTF-8 编码，解决中文路径/输出乱码
chcp 65001 > $null
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Db = Join-Path $ScriptDir "data.db"
$Python = "C:\ProgramData\anaconda3\python.exe"

# 未指定文件时自动寻找 docs 下第一个 xlsx
if (-not $Xlsx) {
    $found = Get-ChildItem -Path (Join-Path $ScriptDir "docs") -Filter "*.xlsx" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $Xlsx = $found.FullName
    } else {
        Write-Error "未找到 xlsx 文件，请指定路径"
        exit 1
    }
}

Write-Host "=== 停止后端 ===" -ForegroundColor Cyan
Get-Process -Name "python*" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "=== 清空数据库 ===" -ForegroundColor Cyan
if (Test-Path $Db) {
    Remove-Item $Db -Force
    Write-Host "已删除 $Db"
}

Write-Host "=== 导入数据: $Xlsx ===" -ForegroundColor Cyan
Set-Location $ScriptDir
& $Python -m backend.scripts.import_legacy $Xlsx

Write-Host "=== 重启后端 ===" -ForegroundColor Cyan
Start-Process -NoNewWindow $Python -ArgumentList "-m", "uvicorn", "backend.app.main:app", "--port", "8000"
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "=== 完毕 ===" -ForegroundColor Green
Write-Host "后端: http://localhost:8000"
Write-Host "前端: http://localhost:3000"
