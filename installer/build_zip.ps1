[CmdletBinding()]
param(
    [switch]$Clean
)

# Baut ein portables ZIP statt eines NSIS-Installers: kein eigenes .exe, darum
# kein SmartScreen-Block beim ersten Ausfuehren. Einfach entpacken und
# launcher.bat / launcher_silent.vbs doppelklicken.

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$InstallerDir = $PSScriptRoot
$StageDir = Join-Path $InstallerDir "stage"
$DistDir = Join-Path $InstallerDir "dist"

if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
}

if ($Clean -and (Test-Path $StageDir)) {
    Remove-Item -Recurse -Force $StageDir
}

# --- Staging-Ordner bauen (Python-Runtime + App + Scripts + Launcher) ---
& (Join-Path $PSScriptRoot "stage.ps1")

# --- ZIP packen ---
$version = (Get-Content (Join-Path $RepoRoot "VERSION") -Raw).Trim()
$zipPath = Join-Path $DistDir "Bibliothekssystem-Portable-$version.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Write-Host "Packe ZIP (Version $version) ..."
Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "Fertig: $zipPath"
