[CmdletBinding()]
param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$InstallerDir = $PSScriptRoot
$ToolsDir = Join-Path $InstallerDir "tools"
$NsisDir = Join-Path $ToolsDir "nsis"
$PyEmbedDir = Join-Path $ToolsDir "python-embed"
$StageDir = Join-Path $InstallerDir "stage"
$DistDir = Join-Path $InstallerDir "dist"

$NsisVersion = "3.10"
$NsisUrl = "https://sourceforge.net/projects/nsis/files/NSIS%203/$NsisVersion/nsis-$NsisVersion.zip/download"
$PythonVersion = "3.11.9"
$PythonEmbedUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$GetPipUrl = "https://bootstrap.pypa.io/get-pip.py"

function Ensure-Dir($path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
    }
}

function Download-File($url, $outFile) {
    # Invoke-WebRequest bekommt von SourceForge/Cloudflare teils nur eine HTML-Zwischenseite
    # statt der echten Datei (Bot-Erkennung anhand des User-Agents). curl.exe (in Windows
    # eingebaut) folgt Redirects zuverlaessig und liefert die echten Binaerdaten.
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

# --- 2. Python embeddable besorgen + pip-Pakete hineininstallieren ---
$RuntimePy = Join-Path $PyEmbedDir "python.exe"
if (-not (Test-Path $RuntimePy)) {
    Write-Host "Lade Python $PythonVersion (embeddable) herunter ..."
    Ensure-Dir $PyEmbedDir
    $pyZip = Join-Path $ToolsDir "python-embed.zip"
    Download-File $PythonEmbedUrl $pyZip
    Expand-Archive -Path $pyZip -DestinationPath $PyEmbedDir -Force
    Remove-Item -Force $pyZip

    $pthFile = Get-ChildItem $PyEmbedDir -Filter "python3*._pth" | Select-Object -First 1
    $lines = Get-Content $pthFile.FullName
    $lines = $lines | ForEach-Object { if ($_ -eq "#import site") { "import site" } else { $_ } }
    if (-not ($lines -contains "Lib\site-packages")) {
        $lines += "Lib\site-packages"
    }
    Set-Content -Path $pthFile.FullName -Value $lines -Encoding ASCII

    $getPip = Join-Path $PyEmbedDir "get-pip.py"
    Download-File $GetPipUrl $getPip
    & $RuntimePy $getPip --no-warn-script-location
    if ($LASTEXITCODE -ne 0) { throw "get-pip.py fehlgeschlagen" }
}

$reqFile = Join-Path $RepoRoot "requirements.txt"
$reqHash = (Get-FileHash -Algorithm SHA256 -Path $reqFile).Hash
$hashMarker = Join-Path $PyEmbedDir ".deps_hash.txt"
$needInstall = $true
if (Test-Path $hashMarker) {
    if ((Get-Content $hashMarker -Raw).Trim() -eq $reqHash) {
        $needInstall = $false
    }
}
if ($needInstall) {
    Write-Host "Installiere Python-Abhaengigkeiten in die eingebettete Laufzeit ..."
    & $RuntimePy -m pip install --no-warn-script-location -r $reqFile
    if ($LASTEXITCODE -ne 0) { throw "pip install fehlgeschlagen" }
    Set-Content -Path $hashMarker -Value $reqHash -Encoding ASCII
} else {
    Write-Host "Python-Abhaengigkeiten sind aktuell (uebersprungen)."
}

# --- 3. Staging-Ordner zusammenstellen ---
Write-Host "Baue Staging-Ordner ..."
if (Test-Path $StageDir) { Remove-Item -Recurse -Force $StageDir }
Ensure-Dir $StageDir

$stageRuntime = Join-Path $StageDir "runtime"
Copy-Item -Recurse -Path $PyEmbedDir -Destination $stageRuntime
Remove-Item -Force (Join-Path $stageRuntime "get-pip.py") -ErrorAction SilentlyContinue
Remove-Item -Force (Join-Path $stageRuntime ".deps_hash.txt") -ErrorAction SilentlyContinue

# pip/setuptools werden nur zum Installieren der Abhaengigkeiten gebraucht (siehe
# Schritt 2 oben), zur Laufzeit importiert die App sie nie - raus damit, spart
# ca. 20 MB ungepackt in jeder Installationsdatei. Bleiben nur im gecachten
# installer\tools\python-embed erhalten, damit kuenftige Builds dort weiter
# "pip install" ausfuehren koennen.
$stageSitePackages = Join-Path $stageRuntime "Lib\site-packages"
$prunePatterns = @(
    "pip", "pip-*.dist-info", "setuptools", "setuptools-*.dist-info", "_distutils_hack", "distutils-precedence.pth",
    # uvicorn[standard]-Extras, die diese App nicht nutzt (kein --reload, keine
    # Websockets, keine YAML-Log-Konfig/.env) - uvicorn faellt dafuer automatisch
    # auf die bereits vorhandenen Basis-Implementierungen zurueck (h11 statt
    # httptools, kein Farb-Log ueber colorama). Mit echtem Server-Start getestet.
    "websockets", "websockets-*.dist-info",
    "watchfiles", "watchfiles-*.dist-info",
    "yaml", "pyyaml-*.dist-info",
    "dotenv", "python_dotenv-*.dist-info",
    "colorama", "colorama-*.dist-info",
    "httptools", "httptools-*.dist-info"
)
foreach ($pattern in $prunePatterns) {
    Get-ChildItem -Path $stageSitePackages -Filter $pattern -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force
}

# .pyc-Caches werden von Python beim ersten Start automatisch neu erzeugt (kurzer,
# unmerklicher Mehraufwand einmalig) - vorab mitgeliefert sparen sie nochmal
# ca. 23 MB ungepackt. Mit echtem Serverstart + allen Exportformaten getestet.
Get-ChildItem -Path $stageRuntime -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force

$stageApp = Join-Path $StageDir "app"
Copy-Item -Recurse -Path (Join-Path $RepoRoot "app") -Destination $stageApp
Get-ChildItem -Path $stageApp -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force

$stageScripts = Join-Path $StageDir "scripts"
Ensure-Dir $stageScripts
foreach ($f in @("run_server.py", "gen_cert.py", "get_lan_ip.py")) {
    Copy-Item -Path (Join-Path $RepoRoot "scripts\$f") -Destination (Join-Path $stageScripts $f)
}

Copy-Item -Path (Join-Path $InstallerDir "payload\launcher.bat") -Destination (Join-Path $StageDir "launcher.bat")
Copy-Item -Path (Join-Path $InstallerDir "payload\launcher_silent.vbs") -Destination (Join-Path $StageDir "launcher_silent.vbs")
Copy-Item -Path (Join-Path $InstallerDir "payload\manage_permissions.bat") -Destination (Join-Path $StageDir "manage_permissions.bat")
Copy-Item -Path (Join-Path $InstallerDir "payload\stop_server.bat") -Destination (Join-Path $StageDir "stop_server.bat")

# --- 4. NSIS kompilieren ---
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
