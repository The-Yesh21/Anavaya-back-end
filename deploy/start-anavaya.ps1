# ============================================================================
#  Anavaya — Remote demo launcher
#  One run brings up the whole public flow:
#     <ngrok-url>/landing/   -> landing page (vite dev, base /landing/)
#     <ngrok-url>/           -> dashboard + courtroom (FastAPI)
#  The ngrok dev domain is STABLE (free plan) so the URL survives restarts.
#
#  Prereqs (one-time):
#    1. ngrok account  ->  https://dashboard.ngrok.com/signup
#    2. C:\nginx\ngrok.exe config add-authtoken <YOUR_TOKEN>
#    3. Backend / landing code unchanged from the repo at F:\major_project
# ============================================================================

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Anavaya Remote Launcher"

$RepoRoot      = "F:\major_project"
$NginxDir      = "C:\nginx"
$LogDir        = "$NginxDir\logs"
$NgrokExe      = "$NginxDir\ngrok.exe"
$CertFile      = "$RepoRoot\case_priority_system\certs\cert.pem"
$KeyFile       = "$RepoRoot\case_priority_system\certs\key.pem"
$NgrokLocalApi = "http://127.0.0.1:4040/api/tunnels"

if (-not (Test-Path $NgrokExe)) { Write-Host "ngrok not found at $NgrokExe - reinstall." -ForegroundColor Red; exit 1 }
if (-not (Test-Path "$RepoRoot\case_priority_system\app.py")) { Write-Host "Repo not found at $RepoRoot" -ForegroundColor Red; exit 1 }
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Test-Port($Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-Port($Port, $Label, $Seconds = 60) {
    Write-Host ("  waiting for {0} on :{1} ..." -f $Label, $Port)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while (-not (Test-Port $Port)) {
        if ($sw.Elapsed.TotalSeconds -gt $Seconds) { Write-Host ("  {0} did not come up in time" -f $Label) -ForegroundColor Red; exit 1 }
        Start-Sleep -Milliseconds 700
    }
    Write-Host ("  {0} up on :{1}" -f $Label, $Port) -ForegroundColor Green
}

function Get-NgrokUrl {
    try {
        $t = Invoke-RestMethod -Uri $NgrokLocalApi -TimeoutSec 3
        foreach ($tn in $t.tunnels) {
            if ($tn.public_url -and $tn.public_url.StartsWith("https://")) { return $tn.public_url.TrimEnd('/') }
        }
    } catch { }
    return $null
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Anavaya - Remote Demo Launcher" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Set-Location $RepoRoot

# --- 1. Backend (FastAPI, https :8000, repo self-signed certs) ---
if (Test-Port 8000) {
    Write-Host "[1/4] Backend already running on :8000" -ForegroundColor Green
} else {
    Write-Host "[1/4] Starting backend (uvicorn :8000)..."
    $be = Start-Process -FilePath "python" -ArgumentList @(
        "-m", "uvicorn", "case_priority_system.app:app",
        "--host", "127.0.0.1", "--port", "8000", "--ws-ping-interval", "0",
        "--ssl-certfile", $CertFile, "--ssl-keyfile", $KeyFile
    ) -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput "$LogDir\uvicorn.out.log" -RedirectStandardError "$LogDir\uvicorn.err.log" -PassThru
    Wait-Port 8000 "backend"
}

# --- 2. nginx (combined listener :8083 -> dashboard root + /landing/) ---
if (Test-Port 8083) {
    Write-Host "[2/4] nginx already running (:8083)" -ForegroundColor Green
} else {
    Write-Host "[2/4] Starting nginx..."
    $ng = Start-Process -FilePath "$NginxDir\nginx.exe" -ArgumentList @("-p", "$NginxDir\", "-c", "$NginxDir\conf\nginx.conf") -WorkingDirectory $NginxDir -WindowStyle Hidden -RedirectStandardOutput "$LogDir\nginx.out.log" -RedirectStandardError "$LogDir\nginx.err.log" -PassThru
    Wait-Port 8083 "nginx"
}

# --- 3. ngrok tunnel (stable dev domain -> :8083) ---
Write-Host "[3/4] Ensuring ngrok tunnel to :8083 ..."
$publicUrl = Get-NgrokUrl
if (-not $publicUrl) {
    # Not running (or no tunnel yet) - start it; the dev domain URL is stable
    # across restarts on the free plan.
    $ngrk = Start-Process -FilePath $NgrokExe -ArgumentList @("http", "8083") -WorkingDirectory $NginxDir -WindowStyle Hidden -RedirectStandardOutput "$LogDir\ngrok.out.log" -RedirectStandardError "$LogDir\ngrok.err.log" -PassThru
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while (-not $publicUrl) {
        if ($sw.Elapsed.TotalSeconds -gt 45) {
            Write-Host "ngrok did not open a tunnel. Did you set the authtoken?" -ForegroundColor Red
            Write-Host "  Run:  C:\nginx\ngrok.exe config add-authtoken <YOUR_TOKEN>" -ForegroundColor Yellow
            Write-Host "Log:" -ForegroundColor Yellow; Get-Content "$LogDir\ngrok.err.log" -ErrorAction SilentlyContinue | Select-Object -Last 8
            exit 1
        }
        Start-Sleep -Seconds 1
        $publicUrl = Get-NgrokUrl
    }
    Write-Host ("  tunnel open: {0}" -f $publicUrl) -ForegroundColor Green
} else {
    Write-Host ("  tunnel already open: {0}" -f $publicUrl) -ForegroundColor Green
}

# --- 4. Landing page on :8084 with VITE_BASE=/landing/ and CTA -> tunnel root ---
if (Test-Port 8084) {
    Write-Host "[4/4] Stopping previous landing instance on :8084 (to pick up new env)..."
    Get-NetTCPConnection -LocalPort 8084 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}
Write-Host "[4/4] Starting landing page (vite :8084, base /landing/)..."
$env:VITE_BASE = "/landing/"
$env:VITE_APP_URL = $publicUrl
$lp = Start-Process -FilePath "npx.cmd" -ArgumentList @("vite", "dev", "--port", "8084", "--strictPort") -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput "$LogDir\vite-landing.out.log" -RedirectStandardError "$LogDir\vite-landing.err.log" -PassThru
Remove-Item Env:\VITE_BASE -ErrorAction SilentlyContinue
Remove-Item Env:\VITE_APP_URL -ErrorAction SilentlyContinue
Wait-Port 8084 "landing page"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  READY - share these:" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ("  Landing page : {0}/landing/" -f $publicUrl) -ForegroundColor White
Write-Host ("  Dashboard     : {0}/" -f $publicUrl) -ForegroundColor White
Write-Host ("  Courtroom     : {0}/court/<room_id>" -f $publicUrl) -ForegroundColor White
Write-Host ""
Write-Host "  Opening the landing page in your browser..."
try { Start-Process "$publicUrl/landing/" } catch { }
Write-Host ""
Write-Host "  This window stays open while the demo runs." -ForegroundColor DarkGray
Write-Host "  Close this window when done (services keep running until you stop them)." -ForegroundColor DarkGray
Write-Host ""
