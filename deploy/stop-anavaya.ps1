# ============================================================================
#  Anavaya — Shutdown Stack Script
#  Stops Nginx, Uvicorn, Ngrok, Vite dev server, and Ollama cleanly.
# ============================================================================

Write-Host "Stopping Anavaya services..." -ForegroundColor Cyan

# 1. Stop Nginx
try {
    if (Test-Path "C:\nginx\nginx.exe") {
        & C:\nginx\nginx.exe -p C:\nginx\ -s stop 2>$null
    }
} catch {}
Get-Process -Name "nginx" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Nginx stopped." -ForegroundColor Green

# 2. Stop Ngrok
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Ngrok stopped." -ForegroundColor Green

# 3. Stop Uvicorn / Backend (:8000)
$conns8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($conns8000) {
    $pids = $conns8000 | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pidToKill in $pids) {
        try { Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue } catch {}
    }
}
Write-Host "  Backend (:8000) stopped." -ForegroundColor Green

# 4. Stop Vite dev server (:8084)
$conns8084 = Get-NetTCPConnection -LocalPort 8084 -ErrorAction SilentlyContinue
if ($conns8084) {
    $pids = $conns8084 | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pidToKill in $pids) {
        try { Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue } catch {}
    }
}
Write-Host "  Vite dev server (:8084) stopped." -ForegroundColor Green

# 5. Stop Ollama
Get-Process -Name "ollama" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Ollama stopped." -ForegroundColor Green

Write-Host "`nAll Anavaya stack services have been stopped successfully." -ForegroundColor Yellow
