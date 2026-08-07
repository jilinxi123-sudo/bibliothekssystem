@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Erstelle Desktop-Verknuepfung "Bibliothek" ...

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$link = $ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Bibliothek.lnk'));" ^
  "$link.TargetPath = '%CD%\start_silent.vbs';" ^
  "$link.WorkingDirectory = '%CD%';" ^
  "$link.IconLocation = '%CD%\app\static\icon.ico';" ^
  "$link.Description = 'Bibliothekssystem oeffnen';" ^
  "$link.Save()"

echo.
echo Fertig! Auf dem Desktop liegt jetzt die Verknuepfung "Bibliothek".
echo Ein Doppelklick startet den Server und oeffnet die Bibliothek direkt
echo in einem eigenen Fenster (ohne sichtbares Konsolenfenster).
echo.
pause
