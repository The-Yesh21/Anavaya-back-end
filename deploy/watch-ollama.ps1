param([string]$LogDir = "C:\nginx\logs")

$ErrorActionPreference = "Stop"
$mutex = [Threading.Mutex]::new($false, "Local\AnavayaOllamaMonitor")
$ownsMutex = $false
try {
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { return }

    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    $ollama = (Get-Command ollama.exe -CommandType Application).Source
    $monitorLog = Join-Path $LogDir "ollama-monitor.log"
    $managedProcess = $null

    while ($true) {
        try {
            $null = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/version" -TimeoutSec 2
        } catch {
            # Leave an existing instance alone, including one started by the Ollama app.
            $listener = Get-NetTCPConnection -State Listen -LocalPort 11434 -ErrorAction SilentlyContinue
            if (-not $listener -and (-not $managedProcess -or $managedProcess.HasExited)) {
                try {
                    $managedProcess = Start-Process -FilePath $ollama -ArgumentList "serve" -PassThru -WindowStyle Hidden `
                        -RedirectStandardOutput (Join-Path $LogDir "ollama.out.log") `
                        -RedirectStandardError (Join-Path $LogDir "ollama.err.log")
                    Add-Content -LiteralPath $monitorLog -Value "$(Get-Date -Format o) Started Ollama process $($managedProcess.Id)"
                } catch {
                    Add-Content -LiteralPath $monitorLog -Value "$(Get-Date -Format o) Ollama start failed: $_"
                }
            }
        }
        Start-Sleep -Seconds 10
    }
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
