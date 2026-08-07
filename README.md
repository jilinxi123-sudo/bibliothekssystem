# Bibliothekssystem

Ein lokales Bibliotheksverwaltungssystem für private Büchersammlungen. Ein Gerät im WLAN
(z. B. dieser PC) läuft als Server, alle Tablets/Handys im selben WLAN greifen per Browser
darauf zu — gescannt, gesucht und exportiert wird auf allen Geräten mit denselben Daten.

## Erststart

**Portables ZIP (empfohlen):** [Download über die Projektseite](https://bibliothekssystem.netlify.app)
oder direkt von [GitHub Releases](https://github.com/jilinxi123-sudo/bibliothekssystem/releases/latest).
ZIP an einem beliebigen Ort entpacken, dann `launcher_silent.vbs` doppelklicken – startet
Server und App-Fenster. Kein separat installiertes Python nötig (eine eingebettete
Python-Laufzeit ist im Paket enthalten), kein Installationsassistent, darum auch keine
SmartScreen-Warnung wie beim früheren `.exe`-Installer. Optional `create_desktop_shortcut.bat`
einmal ausführen für eine Desktop-Verknüpfung. Neu bauen lässt sich das Paket jederzeit mit
`installer\build_zip.ps1`.

**NSIS-Installer (`installer/dist/Bibliothekssystem-Setup.exe`, Legacy):** Baut sich weiterhin
mit `installer\build.ps1`, bietet eine "richtige" Windows-Deinstallation über „Apps &
Features" – dafür löst die unsignierte `.exe` beim ersten Ausführen eine SmartScreen-Warnung
aus. Für neue Installationen wird das ZIP-Paket oben empfohlen.

**Direkt aus dem Quellordner (für Entwicklung):** Python 3.11 oder neuer muss auf dem
Rechner installiert sein.

1. Doppelklick auf `start.bat`.
2. Beim ersten Start werden automatisch eine virtuelle Python-Umgebung angelegt, alle
   Pakete installiert und ein Zertifikat erzeugt (bei späteren Starts wird das übersprungen,
   solange sich nichts geändert hat – der Start ist dann deutlich schneller). Der Server
   startet in einem eigenen Fenster („Bibliothekssystem Server") und die Bedienoberfläche
   öffnet sich danach automatisch in einem **eigenen App-Fenster** (Microsoft Edge im
   App-Modus, ohne Adressleiste/Tabs – kein normaler Browser-Tab) unter `https://localhost:8000`.
3. Optional: `create_desktop_shortcut.bat` einmal ausführen, um eine Desktop-Verknüpfung
   „Bibliothek" mit eigenem Icon anzulegen. Ein Doppelklick darauf startet den Server und
   öffnet die App direkt, ganz ohne sichtbares Konsolenfenster.
4. Das ursprüngliche `start.bat`-Fenster kann nach dem Start geschlossen werden, ohne den
   Server zu beenden. Zum Beenden das Fenster „Bibliothekssystem Server" schließen.

## Auf Tablets/Handys öffnen

Auf der Scannen-Seite gibt es den Button **„📱 Mit Handy/Tablet scannen"** – er zeigt die
Adresse für andere Geräte und den QR-Code direkt in der App an. Alternativ:

1. Tablet mit demselben WLAN verbinden wie den Server-PC.
2. Browser öffnen und die angezeigte `https://<IP-Adresse>:8000`-Adresse eingeben
   (oder den QR-Code scannen).
3. Da ein selbstsigniertes Zertifikat verwendet wird, zeigt der Browser einmalig eine
   Sicherheitswarnung. Auf **„Erweitert“ → „Trotzdem fortfahren“** tippen. Das ist normal
   für ein privates Netzwerk-Tool und muss pro Gerät nur einmal bestätigt werden.
4. Die Seite als Lesezeichen/„Zum Home-Bildschirm hinzufügen“ speichern für schnellen Zugriff.

**Empfehlung:** Im Router eine feste IP-Adresse (DHCP-Reservierung) für den Server-PC
einrichten, damit sich die Adresse nicht ändert und Zertifikat/Lesezeichen/QR-Code
weiterhin gültig bleiben.

**Falls die Kamera auf dem Handy blockiert bleibt** ("Diese Website kann keine Berechtigung
anfordern" o. ä.): Das liegt meist daran, dass die Kamera-Berechtigung vorher schon verweigert
wurde. Im Browser-Menü → Website-Einstellungen (bzw. auf das Schloss-/Warnsymbol neben der
Adresse tippen) → Kamera → auf „Zulassen" stellen, Seite neu laden. Bleibt die Option
ausgegraut, hilft nur ein von den Geräten als vertrauenswürdig anerkanntes Zertifikat statt
eines selbstsignierten – bei Bedarf einfach nachfragen.

## Kamera-Berechtigung auf dem Server-PC verwalten

Das App-Fenster (Edge im App-Modus) hat keine Adressleiste, darum lässt sich eine einmal
blockierte Kamera-Berechtigung darin nicht direkt zurücksetzen. Dafür gibt es die
Startmenü-Verknüpfung **„Kamera-Berechtigung verwalten"** (bzw. `manage_permissions.bat` im
Installationsordner) – sie öffnet ein normales Edge-Fenster im selben (isolierten) Profil wie
das App-Fenster, direkt auf der Berechtigungsseite für `https://localhost:8000`. Dort Kamera
auf „Zulassen" stellen und die Bibliothek neu starten.

## Nutzung

- **Scannen-Seite**: Kamera starten, Barcode (ISBN) des Buchs scannen.
  - Ist das Buch schon erfasst, erscheinen die vorhandenen Daten zum Bearbeiten
    (z. B. Standort aktualisieren).
  - Ist es neu, werden bei bestehender Internetverbindung automatisch Titel, Autor,
    Verlag und Jahr ausgefüllt. Herkunft, Standort und Notizen bitte manuell ergänzen.
    Der Erfassungszeitpunkt wird automatisch gesetzt.
  - Ohne Internetverbindung bleibt das Formular leer und manuell ausfüllbar; das Buch
    ist als „nicht angereichert“ markiert und kann später bei erneutem Scan (mit
    Internet) automatisch vervollständigt werden.
- **Katalog-Seite**: Alle Bücher durchsuchen/filtern, einzelne Einträge bearbeiten oder
  löschen, und den aktuellen (gefilterten) Bestand als Excel, Word oder PDF exportieren.

## Daten & Sicherung

Alle Daten liegen in `data/library.db` (SQLite-Datei), Buchcover liegen als Bilddateien in
`data/covers/`. Für ein einfaches Backup genügt es, den ganzen `data`-Ordner zu kopieren.

Für den Umzug auf einen anderen Rechner (oder ein reguläres Backup „zum Anfassen") gibt es
in der Katalog-Seite unter „Exportieren ▾" den Punkt **„Komplettes Backup (.zip)"**: Das
lädt eine ZIP-Datei mit allen Büchern, Tags, der Änderungshistorie und allen Cover-Bildern
herunter. Über den Button **„Daten importieren"** (ebenfalls auf der Katalog-Seite) lässt
sich so eine Backup-Datei auf einem anderen Rechner wieder einspielen – vorhandene Bücher
mit gleicher ISBN werden dabei durch die Backup-Version aktualisiert, alles andere bleibt
erhalten.
