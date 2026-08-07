// Minimaler Service Worker: kein Caching, keine Offline-Daten.
// Zweck ist ausschliesslich, die Installierbarkeits-Kriterien der Browser
// zu erfuellen (Manifest + Service Worker mit fetch-Handler), damit sich
// die Seite als App-Icon installieren laesst. Die Bücherdaten sind live
// vom Hauptgeraet im WLAN abhaengig und werden bewusst nicht zwischengespeichert,
// damit nie veraltete Daten angezeigt werden.

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
