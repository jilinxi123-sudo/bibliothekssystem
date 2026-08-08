' Zeigt einen kurzen Hinweis, waehrend Server + App-Fenster im Hintergrund
' hochfahren (das dauert ein paar Sekunden, in denen sonst gar nichts sichtbar
' passiert - leicht mit "nichts passiert/haengt" zu verwechseln). launcher.bat
' schliesst dieses Fenster aktiv, kurz bevor es das eigentliche App-Fenster
' oeffnet (siehe dort, Stop-Process auf "please_wait.vbs"). Der Timeout hier
' ist nur ein Sicherheitsnetz, falls das aus irgendeinem Grund nicht klappt.
Set shell = CreateObject("WScript.Shell")
shell.Popup "Bibliothek wird gestartet, bitte kurz warten ...", 25, "Bibliothekssystem", 64
