; Bibliothekssystem - NSIS Installer-Skript
; Wird von installer\build.ps1 aufgerufen, nachdem installer\stage\ vollstaendig
; zusammengestellt wurde (runtime\, app\, scripts\, launcher.bat, launcher_silent.vbs).

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!include "MUI2.nsh"

!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "1.0.0"
!endif

!define PRODUCT_NAME "Bibliothekssystem"
!define PRODUCT_PUBLISHER "Bibliothekssystem"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

Name "${PRODUCT_NAME}"
OutFile "dist\Bibliothekssystem-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Bibliothekssystem"
InstallDirRegKey HKCU "Software\${PRODUCT_NAME}" "InstallDir"
RequestExecutionLevel user
BrandingText "${PRODUCT_NAME} ${PRODUCT_VERSION}"

!define MUI_ICON "..\app\static\icon.ico"
!define MUI_UNICON "..\app\static\icon.ico"

; Eigene Grafiken im Farbschema der App statt der NSIS-Standardgrafiken
; (installer\gen_installer_assets.py erzeugt sie aus denselben Farben/demselben
; Icon-Motiv wie die Web-App - bei Design-Aenderungen dort neu generieren).
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "assets\welcome.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "assets\header.bmp"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "German"

VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileDescription" "${PRODUCT_NAME} Installer"
VIAddVersionKey "LegalCopyright" "${PRODUCT_PUBLISHER}"

Section "Bibliothekssystem" SEC_MAIN
  SetOutPath "$INSTDIR"
  File /r "stage\*.*"

  WriteRegStr HKCU "Software\${PRODUCT_NAME}" "InstallDir" "$INSTDIR"

  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Bibliothek.lnk" "$INSTDIR\launcher_silent.vbs" "" "$INSTDIR\app\static\icon.ico"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Bibliothek beenden.lnk" "$INSTDIR\stop_server.bat"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Kamera-Berechtigung verwalten.lnk" "$INSTDIR\manage_permissions.bat"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Deinstallieren.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\Bibliothek.lnk" "$INSTDIR\launcher_silent.vbs" "" "$INSTDIR\app\static\icon.ico"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\app\static\icon.ico"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1

  ; Direkt im Installationsschritt statt an ein Seiten-Ereignis gebunden, damit es
  ; garantiert genau einmal und unabhaengig von MUI-Seiten-Timing erscheint (die
  ; MUI_PAGE_CUSTOMFUNCTION_LEAVE-Variante loeste zuverlaessig auf der falschen
  ; Seite aus, trotz korrekter Platzierung im Skript laut Doku).
  MessageBox MB_OK|MB_ICONINFORMATION "Beim ersten Öffnen zeigt der Browser die Warnung „nicht sicher“.$\r$\n$\r$\nGrund:$\r$\nDiese Software läuft über eine lokale Adresse (localhost bzw. 192.168.x.x) statt eine echte Internet-Adresse. Dafür dürfen offizielle Zertifizierungsstellen grundsätzlich keine Zertifikate ausstellen – die App nutzt deshalb ein selbst erzeugtes, das der Browser nicht kennt. Darum erscheint die Warnung auf jedem Gerät (PC, Handy, Tablet) und jedes Mal wieder. Im eigenen WLAN unbedenklich.$\r$\n$\r$\nEinfach auf „Erweitert“ und dann „Trotzdem fortfahren“ klicken."
SectionEnd

Section "Uninstall"
  ; Server laeuft seit dem Start ohne sichtbares Fenster im Hintergrund (siehe
  ; launcher.bat) - zuerst beenden, sonst sind runtime\/app\ evtl. noch durch den
  ; laufenden Python-Prozess gesperrt und lassen sich unten nicht vollstaendig loeschen.
  ExecWait `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $$_.CommandLine -like '*run_server.py*' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"`

  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\scripts"
  ; certs\ enthaelt nur ein automatisch erzeugtes Zertifikat (keine Nutzdaten) -
  ; wird bei Bedarf beim naechsten Start neu erzeugt, darum ohne Rueckfrage geloescht.
  RMDir /r "$INSTDIR\certs"
  Delete "$INSTDIR\launcher.bat"
  Delete "$INSTDIR\launcher_silent.vbs"
  Delete "$INSTDIR\manage_permissions.bat"
  Delete "$INSTDIR\stop_server.bat"
  Delete "$INSTDIR\Uninstall.exe"

  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Bibliothek.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Bibliothek beenden.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Kamera-Berechtigung verwalten.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Deinstallieren.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$DESKTOP\Bibliothek.lnk"

  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "Software\${PRODUCT_NAME}"

  ; data\ (Buecherdatenbank + Cover) nur nach ausdruecklicher Bestaetigung loeschen -
  ; Vorauswahl "Nein", damit ein versehentlicher Klick keine Daten vernichtet.
  IfFileExists "$INSTDIR\data\*.*" 0 no_data
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Auch deine gespeicherten Bücherdaten (Datenbank + Cover-Bilder) löschen?$\r$\nDas kann nicht rückgängig gemacht werden." IDNO no_data
    RMDir /r "$INSTDIR\data"
  no_data:

  ; $INSTDIR wird nur entfernt, falls es leer ist (z. B. wenn data\ auf Wunsch erhalten blieb).
  RMDir "$INSTDIR"

  IfFileExists "$INSTDIR\data\*.*" 0 +2
    MessageBox MB_OK "Deine Buecherdaten in$\r$\n$INSTDIR\data$\r$\nwurden nicht geloescht. Du kannst den Ordner bei Bedarf manuell entfernen."
SectionEnd
