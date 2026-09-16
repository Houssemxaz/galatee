param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  Write-Error "cloudflared est introuvable. Installez-le avec: winget install Cloudflare.cloudflared"
  exit 1
}

$logRoot = Join-Path ([System.IO.Path]::GetTempPath()) "galatee-cloudflared"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$stdoutPath = Join-Path $logRoot "stdout.log"
$stderrPath = Join-Path $logRoot "stderr.log"
Remove-Item $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $cloudflared.Source `
  -ArgumentList @("tunnel", "--url", "http://localhost:$Port", "--no-autoupdate") `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -WindowStyle Hidden `
  -PassThru

$publicUrl = $null
for ($attempt = 0; $attempt -lt 30 -and -not $publicUrl; $attempt++) {
  Start-Sleep -Seconds 1
  $output = @(
    (Get-Content $stdoutPath -Raw -ErrorAction SilentlyContinue),
    (Get-Content $stderrPath -Raw -ErrorAction SilentlyContinue)
  ) -join "`n"
  $match = [regex]::Match($output, "https://[a-z0-9-]+\.trycloudflare\.com")
  if ($match.Success) { $publicUrl = $match.Value }
  if (-not $process.HasExited -and $process.Id) { continue }
  break
}

if (-not $publicUrl) {
  Write-Host "Le tunnel n'a pas fourni d'URL. Consultez les logs: $logRoot" -ForegroundColor Yellow
  if ($process.HasExited) { exit $process.ExitCode }
  exit 1
}

Write-Host ""
Write-Host "Tunnel HTTPS Galatee actif" -ForegroundColor Green
Write-Host "URL publique backend : $publicUrl"
Write-Host "VITE_API_BASE       : $publicUrl/api" -ForegroundColor Cyan
Write-Host "PID du tunnel        : $($process.Id)"
Write-Host "Arret                 : Stop-Process -Id $($process.Id)"
Write-Host "Logs                  : $logRoot"
