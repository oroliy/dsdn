$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $root "package.json") | ConvertFrom-Json
$releaseDir = Join-Path $root "release"
$zipPath = Join-Path $releaseDir ("synology-download-station-extension-{0}.zip" -f $package.version)
$distDir = Join-Path $root "dist"

if (-not (Test-Path $distDir)) {
  throw "dist does not exist. Run npm run build before npm run package."
}

New-Item -ItemType Directory -Force $releaseDir | Out-Null
if (Test-Path $zipPath) {
  Remove-Item $zipPath
}

Compress-Archive -Path (Join-Path $distDir "*") -DestinationPath $zipPath
Write-Host $zipPath
