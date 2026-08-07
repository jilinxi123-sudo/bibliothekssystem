@echo off
chcp 65001 >nul

rem Der Server laeuft seit dem Start ohne sichtbares Fenster im Hintergrund (siehe
rem start.bat) - er wird darum hier ueber die Kommandozeile des Prozesses
rem gefunden (enthaelt "run_server.py") statt ueber ein Fenster zum Schliessen.

echo Beende Bibliothek-Server ...
powershell -NoProfile -Command "$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*run_server.py*' }; if ($procs) { $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Host 'Server beendet.' } else { Write-Host 'Kein laufender Server gefunden.' }"

echo.
pause
