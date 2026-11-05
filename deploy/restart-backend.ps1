$conns = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($conns) {
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } catch {}
    }
}
Start-Sleep -Seconds 1
$CertFile = "F:\major_project\case_priority_system\certs\cert.pem"
$KeyFile  = "F:\major_project\case_priority_system\certs\key.pem"
$LogDir   = "C:\nginx\logs"
Start-Process -FilePath "python" -ArgumentList @(
    "-m", "uvicorn", "case_priority_system.app:app",
    "--host", "127.0.0.1", "--port", "8000", "--ws-ping-interval", "0",
    "--timeout-keep-alive", "75",
    "--ssl-certfile", $CertFile, "--ssl-keyfile", $KeyFile
) -WorkingDirectory "F:\major_project" -WindowStyle Hidden -RedirectStandardOutput "$LogDir\uvicorn.out.log" -RedirectStandardError "$LogDir\uvicorn.err.log"

Start-Sleep -Seconds 3
Write-Host "Uvicorn restarted successfully."
