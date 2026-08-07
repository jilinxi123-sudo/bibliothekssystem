' Startet start.bat mit "silent" (kein "Taste druecken"-Hinweis am Ende - das
' Fenster schliesst sich beim Fertigwerden von selbst). start.bat selbst laeuft
' unsichtbar - die sichtbare Rueckmeldung kommt vom Server-Fenster, das start.bat
' kurz nach dem Start oeffnet (siehe dort).
'
' "True" am Ende laesst dieses Skript (wscript.exe) auf start.bat warten, statt
' sich sofort zu beenden. Windows zeigt den drehenden "laedt"-Mauszeiger naemlich nur,
' solange der von Explorer direkt gestartete Prozess (also dieses Skript) noch laeuft -
' das ueberbrueckt die kurze Zeit bis das Server-Fenster erscheint.
' Wird typischerweise von einer Desktop-Verknuepfung aus aufgerufen,
' siehe create_desktop_shortcut.bat.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
shell.Run """" & scriptDir & "\start.bat"" silent", 0, True
