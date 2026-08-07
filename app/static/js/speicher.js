function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

const FRIENDLY_ENTRIES = {
  data: { icon: "📚", label: "Gespeicherte Daten: library.db (Datenbank) und covers/ (hochgeladene Cover-Bilder)" },
  app: { icon: "⚙️", label: "Programmcode: Python-, HTML-, CSS- und JavaScript-Dateien der eigentlichen Bibliotheks-Software" },
  scripts: { icon: "⚙️", label: "Programmcode: kleine Hilfsskripte (Server starten, Zertifikat erzeugen, WLAN-Adresse ermitteln)" },
  certs: { icon: "🔐", label: "Zertifikate für die verschlüsselte Verbindung (https) übers WLAN – keine Programmlogik, keine Nutzdaten" },
  installer: { icon: "📦", label: "Werkzeuge zum Erstellen der Installationsdatei – nur für die Entwicklung, nicht für den laufenden Betrieb" },
  runtime: { icon: "🐍", label: "Python selbst + benötigte Programmbibliotheken – technische Voraussetzung, damit die App läuft" },
  venv: { icon: "🐍", label: "Python selbst + benötigte Programmbibliotheken – technische Voraussetzung, damit die App läuft" },
  ".venv": { icon: "🐍", label: "Python selbst + benötigte Programmbibliotheken – technische Voraussetzung, damit die App läuft" },
  node_modules: { icon: "🧩", label: "JavaScript-Programmbibliotheken – technische Voraussetzung" },
  ".git": { icon: "🕓", label: "Versionsverlauf des Programmcodes (Git)" },
  ".claude": { icon: "🤖", label: "Konfiguration der KI-gestützten Entwicklungsumgebung, mit der diese Software programmiert wurde – nur für die Entwicklung, nicht für den Betrieb" },
  ".gitignore": { icon: "📄", label: "Konfigurationsdatei für die Versionskontrolle (Git)" },
  "requirements.txt": { icon: "📄", label: "Liste der verwendeten Python-Pakete" },
  "README.md": { icon: "📄", label: "Projektbeschreibung" },
  VERSION: { icon: "📄", label: "Enthält die aktuelle Versionsnummer" },
  "start.bat": { icon: "📄", label: "Startet die Software (Doppelklick zum Starten)" },
  "start_silent.vbs": { icon: "📄", label: "Startet die Software ohne sichtbares Fenster (für den Autostart)" },
  "launcher.bat": { icon: "📄", label: "Startet die Software (Doppelklick zum Starten)" },
  "launcher_silent.vbs": { icon: "📄", label: "Startet die Software ohne sichtbares Fenster (für den Autostart)" },
  "create_desktop_shortcut.bat": { icon: "📄", label: "Erstellt eine Desktop-Verknüpfung" },
  "manage_permissions.bat": { icon: "📄", label: "Verwaltet die Windows-Firewall-Freigabe für diese App" },
  "stop_server.bat": { icon: "📄", label: "Beendet den im Hintergrund laufenden Server" },
};

function friendlyEntry(name, isDir) {
  return FRIENDLY_ENTRIES[name] || { icon: isDir ? "🗂️" : "📄", label: name };
}

function storageRowHtml(html, deletable, name, reason) {
  const btn = deletable
    ? `<button type="button" class="danger btn-delete-item" data-name="${escapeHtml(name)}" data-reason="${escapeHtml(reason || "")}">🗑️ Löschen</button>`
    : "";
  return `<div class="storage-row"><span>${html}</span>${btn}</div>`;
}

const els = {
  installPath: document.getElementById("install-path"),
  installBreakdown: document.getElementById("install-breakdown"),
  ramUsage: document.getElementById("ram-usage"),
  totalSize: document.getElementById("total-size"),
  breakdownBooks: document.getElementById("storage-breakdown-books"),
  breakdownSystem: document.getElementById("storage-breakdown-system"),
};

function wireDeleteButtons(container) {
  container.querySelectorAll(".btn-delete-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const name = btn.dataset.name;
      const reason = btn.dataset.reason;
      if (!(await AppDialogs.confirm(`„${name}" wirklich löschen?\n\n${reason}`))) return;

      const res = await fetch(`/api/storage/project-item/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        await AppDialogs.alert(`Löschen fehlgeschlagen: ${err.detail || res.statusText}`);
        return;
      }
      await loadSummary();
    });
  });
}

async function loadSummary() {
  const res = await fetch("/api/storage/summary");
  const data = await res.json();

  els.installPath.textContent = data.install_path || "unbekannt";

  els.installBreakdown.innerHTML = (data.project_breakdown || [])
    .map((item) => {
      const { icon, label } = friendlyEntry(item.name, item.is_dir);
      const name = item.is_dir ? `${item.name}/` : item.name;
      return `<li><code>${escapeHtml(name)}</code> – ${icon} ${escapeHtml(label)}</li>`;
    })
    .join("");

  els.ramUsage.textContent = formatBytes(data.ram_bytes);
  els.totalSize.textContent = `💾 Speicherplatz auf der Festplatte (kompletter Programmordner): ${formatBytes(data.project_bytes)}`;

  els.breakdownBooks.innerHTML =
    storageRowHtml(`📄 Datenbank (deine Bucheinträge): ${formatBytes(data.db_bytes)}`, false) +
    storageRowHtml(`🖼️ Cover-Bilder (${data.covers_count} Dateien): ${formatBytes(data.covers_bytes)}`, false);

  const systemRows = (data.project_breakdown || [])
    .filter((item) => item.name !== "data")
    .map((item) => {
      const { icon, label } = friendlyEntry(item.name, item.is_dir);
      const status = item.deletable ? "kann gelöscht werden" : "wird benötigt, nicht löschen";
      return storageRowHtml(
        `${icon} ${escapeHtml(label)} – ${status}: ${formatBytes(item.bytes)}`,
        item.deletable,
        item.name,
        item.delete_reason
      );
    });
  els.breakdownSystem.innerHTML = systemRows.join("");

  wireDeleteButtons(els.breakdownSystem);
}

loadSummary();
