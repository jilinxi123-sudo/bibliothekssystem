@echo off
chcp 65001 >nul
cd /d "%~dp0"

set SKIP_PAUSE=
if /i "%~1"=="silent" set SKIP_PAUSE=1

set RUNTIME_PY=runtime\python.exe

if not exist "%RUNTIME_PY%" (
    echo FEHLER: %RUNTIME_PY% wurde nicht gefunden. Die Installation scheint beschaedigt zu sein.
    pause
    exit /b 1
)

powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('localhost',8000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
    rem Es laeuft schon ein Server (typischerweise: die App wurde schon gestartet und
    rem man klickt versehentlich ein zweites Mal) - keinen zweiten Server starten,
    rem sondern einfach das App-Fenster auf den vorhandenen Server zeigen lassen.
    rem Wichtig: hier NICHT einfach abbrechen, sonst passiert im "silent"-Modus
    rem (Start ueber launcher_silent.vbs) rein gar nichts sichtbares.
    call :open_app_window
    exit /b 0
)

start "" wscript.exe "%~dp0please_wait.vbs"

"%RUNTIME_PY%" scripts\gen_cert.py
rem Nur diese kleine Helferaufgabe (LAN-IP ermitteln, QR-Code erzeugen) laeuft
rem unsichtbar - der Server selbst bekommt bewusst ein sichtbares Fenster (siehe
rem unten), damit man sieht, dass gerade etwas passiert.
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%RUNTIME_PY%' -ArgumentList 'scripts\get_lan_ip.py' -WindowStyle Hidden"

echo.
echo Starte Server in einem separaten Fenster ...
start "Bibliothekssystem Server" "%RUNTIME_PY%" scripts\run_server.py

echo Warte auf Serverstart ...
set /a RETRIES=0
:wait_for_server
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('localhost',8000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto server_ready
set /a RETRIES+=1
if %RETRIES% lss 30 goto wait_for_server

:server_ready
call :open_app_window

echo.
echo Fertig! Die Bibliothek sollte sich automatisch in einem eigenen Fenster geoeffnet haben.
echo Falls nicht, bitte manuell aufrufen: https://localhost:8000
echo.
echo Der Server laeuft im separaten Fenster "Bibliothekssystem Server" weiter - dieses
echo Fenster bitte offen lassen, solange die Bibliothek genutzt wird (auch fuer Zugriff
echo per Handy/Tablet im WLAN). Zum Beenden einfach dieses Fenster schliessen.
echo.
if not defined SKIP_PAUSE pause
exit /b 0

:open_app_window
rem Den "wird gestartet"-Hinweis (siehe please_wait.vbs) jetzt schliessen, da
rem gleich das echte Fenster erscheint - Popup hat kein Fernsteuerungs-API,
rem darum einfach den Prozess beenden (schliesst das Fenster sofort).
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*please_wait.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>nul

rem Ein haengengebliebener Edge-Prozess mit demselben --user-data-dir (z. B. von
rem einem frueheren Start, dessen Fenster minimiert/verdeckt irgendwo offen ist)
rem verhindert bei Chromium oft unsichtbar ein neues Fenster - es passiert dann
rem einfach gar nichts, ohne Fehlermeldung. Darum vor dem Start sauber schliessen.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*Bibliothekssystem\EdgeApp*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>nul

set EDGE_EXE=
for /f "delims=" %%P in ('where msedge.exe 2^>nul') do if not defined EDGE_EXE set EDGE_EXE=%%P
if not defined EDGE_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe

if defined EDGE_EXE (
    start "" "%EDGE_EXE%" --app=https://localhost:8000 --window-size=1360,860 --user-data-dir="%LOCALAPPDATA%\Bibliothekssystem\EdgeApp"
) else (
    start "" "https://localhost:8000"
)
exit /b 0
