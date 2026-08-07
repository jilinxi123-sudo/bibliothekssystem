@echo off
chcp 65001 >nul

rem Oeffnet ein normales (nicht Kiosk-/App-Modus) Edge-Fenster im GLEICHEN isolierten
rem Profil, das auch das App-Fenster der Bibliothek benutzt - darin lassen sich Kamera-/
rem Mikrofonberechtigungen verwalten, weil hier (anders als im App-Fenster) eine
rem Adressleiste vorhanden ist.
rem
rem Hinweis: Edge blockiert es aus Sicherheitsgruenden, "edge://settings/..."-Seiten
rem direkt per Kommandozeile zu oeffnen - die Adresse muss daher von Hand eingegeben
rem werden (unten stehen die genauen Schritte).

set EDGE_EXE=
for /f "delims=" %%P in ('where msedge.exe 2^>nul') do if not defined EDGE_EXE set EDGE_EXE=%%P
if not defined EDGE_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe

if not defined EDGE_EXE (
    echo Microsoft Edge wurde nicht gefunden.
    pause
    exit /b 1
)

echo.
echo Es oeffnet sich gleich ein normales Edge-Fenster.
echo.
echo Bitte darin oben in die Adressleiste genau das hier eingeben und Enter druecken:
echo.
echo     edge://settings/content/camera
echo.
echo Auf der Seite erscheint eine Liste. Unter "Nicht zulaessig" (oder "Blockiert")
echo nach "localhost:8000" suchen, draufklicken und auf "Zulassen" bzw. das
echo Papierkorb-Symbol zum Entfernen des Eintrags klicken.
echo.
echo Dieses Fenster kann waehrenddessen offen bleiben, falls du nochmal nachlesen willst.
echo.

start "" "%EDGE_EXE%" --user-data-dir="%LOCALAPPDATA%\Bibliothekssystem\EdgeApp"

pause
