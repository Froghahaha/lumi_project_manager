# Lumi Project Manager - 一键重启
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lumi Project Manager - 一键重启" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# ── 1. 停止旧进程 ──────────────────────────────────
Write-Host "[1/3] 停止旧进程..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$pids = (netstat -ano | Select-String ":8000.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Where-Object { $_ -match '^\d+$' })
foreach ($pid in $pids) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}
Write-Host "      已清理" -ForegroundColor Green
Start-Sleep -Seconds 1

# ── 2. 启动后端 ────────────────────────────────────
Write-Host "[2/3] 启动后端 (port 8000)..." -ForegroundColor Yellow
$backend = Start-Process -FilePath "python" -ArgumentList "scripts/_start_server.py" -WindowStyle Minimized -PassThru

Write-Host "      等待后端启动..." -ForegroundColor Gray
$retry = 0
while ($retry -lt 30) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:8000/persons" -TimeoutSec 1 -UseBasicParsing
        break
    } catch {
        Start-Sleep -Seconds 1
    }
    $retry++
}
if ($retry -ge 30) {
    Write-Host "      后端启动超时，请手动检查" -ForegroundColor Red
} else {
    Write-Host "      后端已就绪" -ForegroundColor Green
}

# ── 3. 启动前端 ────────────────────────────────────
Write-Host "[3/3] 启动前端..." -ForegroundColor Yellow
Set-Location "$root\frontend"
Start-Process -FilePath "cmd" -ArgumentList "/c", "npx vite --host 0.0.0.0 --port 5173" -WindowStyle Minimized

Write-Host "      等待前端启动..." -ForegroundColor Gray
$retry = 0
while ($retry -lt 30) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 1 -UseBasicParsing
        break
    } catch {}
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:5174" -TimeoutSec 1 -UseBasicParsing
        break
    } catch {}
    Start-Sleep -Seconds 1
    $retry++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动完成!" -ForegroundColor Green
Write-Host "  后端: http://localhost:8000" -ForegroundColor White
Write-Host "  前端: http://localhost:5173 (或 5174)" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

