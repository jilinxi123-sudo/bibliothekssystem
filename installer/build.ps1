[CmdletBinding()]
param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$InstallerDir = $PSScriptRoot
$ToolsDir = Join-Path $InstallerDir "tools"
$NsisDir = Join-Path $ToolsDir "nsis"
$StageDir = Join-Path $InstallerDir "stage"
$DistDir = Join-Path $InstallerDir "dist"

$NsisVersion = "3.10"
$NsisUrl = "https://sourceforge.net/projects/nsis/files/NSIS%203/$NsisVersion/nsis-$NsisVersion.zip/download"

function Ensure-Dir($path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
    }
}

function Download-File($url, $outFile) {
    & curl.exe -L --fail -o $outFile $url
    if ($LASTEXITCODE -ne 0) {
        throw "Download fehlgeschlagen: $url"
    }
}

Ensure-Dir $ToolsDir
Ensure-Dir $DistDir

if ($Clean -and (Test-Path $StageDir)) {
    Remove-Item -Recurse -Force $StageDir
}

# --- 1. NSIS besorgen (portable ZIP, kein System-Install) ---
$MakeNsis = Join-Path $NsisDir "makensis.exe"
if (-not (Test-Path $MakeNsis)) {
    Write-Host "Lade NSIS $NsisVersion herunter ..."
    $nsisZip = Join-Path $ToolsDir "nsis.zip"
    Download-File $NsisUrl $nsisZip
    $nsisExtractTmp = Join-Path $ToolsDir "nsis_extract_tmp"
    if (Test-Path $nsisExtractTmp) { Remove-Item -Recurse -Force $nsisExtractTmp }
    Expand-Archive -Path $nsisZip -DestinationPath $nsisExtractTmp -Force
    $inner = Get-ChildItem $nsisExtractTmp -Directory | Select-Object -First 1
    if (Test-Path $NsisDir) { Remove-Item -Recurse -Force $NsisDir }
    Move-Item $inner.FullName $NsisDir
    Remove-Item -Recurse -Force $nsisExtractTmp
    Remove-Item -Force $nsisZip
}
if (-not (Test-Path $MakeNsis)) {
    throw "makensis.exe wurde nach dem Download nicht gefunden: $MakeNsis"
}

# --- 2. Staging-Ordner bauen (Python-Runtime + App + Scripts + Launcher) ---
& (Join-Path $PSScriptRoot "stage.ps1")

# --- 3. NSIS kompilieren ---
$version = (Get-Content (Join-Path $RepoRoot "VERSION") -Raw).Trim()
Write-Host "Kompiliere Installer (Version $version) ..."
Push-Location $InstallerDir
try {
    & $MakeNsis "/DPRODUCT_VERSION=$version" "Bibliothekssystem.nsi"
    if ($LASTEXITCODE -ne 0) { throw "makensis fehlgeschlagen" }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Fertig: $(Join-Path $DistDir 'Bibliothekssystem-Setup.exe')"
