' Startet launcher.bat mit "silent" (kein "Taste druecken"-Hinweis am Ende - das
' Fenster schliesst sich beim Fertigwerden von selbst). launcher.bat selbst laeuft
' unsichtbar - die sichtbare Rueckmeldung kommt vom Server-Fenster, das launcher.bat
' kurz nach dem Start oeffnet (siehe dort).
'
' "True" am Ende laesst dieses Skript (wscript.exe) auf launcher.bat warten, statt
' sich sofort zu beenden. Windows zeigt den drehenden "laedt"-Mauszeiger naemlich nur,
' solange der von Explorer direkt gestartete Prozess (also dieses Skript) noch laeuft -
' das ueberbrueckt die kurze Zeit bis das Server-Fenster erscheint.
' Ziel der Desktop- und Startmenue-Verknuepfungen.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
shell.Run """" & scriptDir & "\launcher.bat"" silent", 0, True
