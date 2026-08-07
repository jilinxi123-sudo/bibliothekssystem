/* Onboarding-Tour: gefuehrter Rundgang durch Scannen/Katalog/Speicher.
   Persistiert den Zustand ueber Seitenwechsel hinweg in localStorage, damit
   "Weiter" auch nach einer echten Seitennavigation an der richtigen Stelle
   weitermacht. */

const TOUR_KEY_ACTIVE = "tour_active";
const TOUR_KEY_STEP = "tour_step";
const TOUR_KEY_NEVER_SHOW = "tour_never_show";
const TOUR_KEY_SKIPPED_SESSION = "tour_skipped_session";

const EXAMPLE_TITLE_PREFIX = "📖 Beispiel: ";
const EXAMPLE_ISBN_1 = "beispiel-buch-1";
const EXAMPLE_ISBN_2 = "beispiel-buch-2";

const TOUR_STEPS = [
  {
    page: "/",
    target: null,
    title: "Überblick",
    text:
      "Dieses System funktioniert über mehrere Geräte im selben WLAN:\n\n" +
      "1. Ein PC speichert alle Daten – das „Hauptgerät“.\n" +
      "2. Handy/Tablet installieren nichts, sie verbinden sich per WLAN und Browser.\n\n" +
      "Zum Scannen gibt es zwei Möglichkeiten:\n" +
      "1. Direkt am PC, falls eine Kamera vorhanden ist.\n" +
      "2. Mit Handy/Tablet über WLAN – meist schneller.\n\n" +
      "Wichtig: Nutzt du dabei Handy oder Tablet über WLAN, muss der PC währenddessen an sein und die Software dort laufen.\n\n" +
      "Das war der Überblick – jetzt Schritt für Schritt, wie das konkret geht.",
  },
  {
    page: "/",
    target: "#btn-start-scan",
    text:
      "Halte den Barcode vor die Kamera – die Erkennung läuft automatisch, halte kurz still. So bekommst du die ISBN-Nummer des Buchs. " +
      "Mit dieser ISBN wird dann online bei der Deutschen Nationalbibliothek und bei Google Books nach Titel und Autor gesucht und die gefundenen Angaben (Titel, Autor, Verlag …) werden automatisch eingetragen – dafür ist eine Internetverbindung nötig.",
  },
  {
    page: "/",
    target: "#btn-phone-scan-hint",
    text: "Mit dem Handy oder Tablet geht das Scannen meist schneller. Hier tippen, um die Verbindung einzurichten.",
  },
  {
    page: "/",
    target: "#manual-isbn-input",
    text:
      "Kein Barcode zur Hand? ISBN eintippen und auf „Suchen“ tippen – damit wird online bei der Deutschen Nationalbibliothek und bei Google Books gesucht, " +
      "und die gefundenen Angaben (Titel, Autor, Verlag …) werden automatisch eingetragen.",
  },
  {
    page: "/",
    target: "#btn-manual-entry",
    text: "Kein Barcode und keine ISBN zur Hand (z. B. selbstgebundenes Buch)? Hier musst du gar nichts eintippen – direkt zur leeren Erfassungsmaske und alle Angaben selbst eintragen.",
  },
  {
    page: "/",
    target: null,
    text: "Ist das Buch schon erfasst, öffnen ein erneutes Scannen oder Eingeben der ISBN automatisch die vorhandenen Angaben zum erneuten Bearbeiten.",
  },
  {
    page: "/katalog",
    target: ".table-wrapper",
    text: "Alle gescannten oder hinzugefügten Bücher landen hier. Zum Ausprobieren wurden zwei Beispielbücher eingefügt (hellblau markiert) – die kannst du jederzeit wieder löschen.",
    beforeShow: async () => {
      if (typeof refreshList === "function") await refreshList();
    },
  },
  {
    page: "/katalog",
    target: `tr[data-isbn="${EXAMPLE_ISBN_1}"] .cover-thumb`,
    text: "Auf ein Cover-Bild in der Tabelle tippen, um es vergrößert anzuzeigen.",
  },
  {
    page: "/katalog",
    target: `tr[data-isbn="${EXAMPLE_ISBN_1}"] .row-calendar-link`,
    text: 'Hat ein Buch ein Rückgabedatum, erscheint in der Spalte „Rückgabe“ dieses Kalender-Symbol 📅 – direkt darauf tippen speichert den Termin in deinem Gerätekalender, ganz ohne das Buch erst zu öffnen.',
  },
  {
    page: "/katalog",
    target: 'th[data-sort-key="title"] .sort-arrow',
    text: 'Auf den kleinen Pfeil neben einer Spaltenüberschrift (z. B. „Titel“, „Autor“) tippen, um danach zu sortieren.',
  },
  {
    page: "/katalog",
    target: "#filter-search",
    text: "Suche nach Titel, Autor, ISBN oder Verlag.",
  },
  {
    page: "/katalog",
    target: "tr.filter-row",
    text: "Über „Filter“ kannst du nach Thema, Herkunft oder Standort filtern – auch mehrere Auswahlmöglichkeiten gleichzeitig.",
  },
  {
    page: "/katalog",
    target: ["#select-all", "#bulk-bar"],
    text: "Mehrere Bücher auswählen (Häkchen links) und dann gemeinsam ein Rückgabedatum setzen (falls von einer Bibliothek ausgeliehen), exportieren oder löschen.",
    beforeShow: async () => {
      tourSelectExampleRows();
    },
    afterHide: async () => {
      tourDeselectExampleRows();
    },
  },
  {
    page: "/katalog",
    target: "#edit-modal-overlay .modal-dialog",
    text: "Ein Klick auf eine Zeile öffnet die Bearbeitung – hier kannst du alle Angaben zu einem Buch ändern.",
    beforeShow: async () => {
      if (typeof openEdit === "function") await openEdit(EXAMPLE_ISBN_1);
    },
  },
  {
    page: "/katalog",
    target: ["#edit-tags-theme", "#edit-tags-source", "#edit-tags-location"],
    text: "Bei Thema, Herkunft und Standort kannst du vorhandene Tags auswählen oder neue erstellen – auch die Farbe eines Tags lässt sich jederzeit ändern.",
    beforeShow: async () => {
      if (typeof openEdit === "function") await openEdit(EXAMPLE_ISBN_1);
    },
  },
  {
    page: "/katalog",
    target: ["#edit-due-date-picker", "#edit-add-to-calendar"],
    text:
      'Hast du das Buch aus einer Bibliothek ausgeliehen? Trag hier das Rückgabedatum ein – es wird dann in der Katalog-Tabelle angezeigt. Möchtest du zusätzlich eine Erinnerung, kannst du es mit „Im Kalender speichern“ auch in deinen Kalender übernehmen (optional). ' +
      "Nutzt du dabei Handy oder Tablet über das WLAN, kann der Termin auch im Kalender dieses Geräts landen.",
    beforeShow: async () => {
      if (typeof openEdit === "function") await openEdit(EXAMPLE_ISBN_1);
    },
  },
  {
    page: "/katalog",
    target: `tr[data-isbn="${EXAMPLE_ISBN_1}"] .btn-history`,
    text: "„Verlauf“ zeigt alle bisherigen Änderungen an diesem Buch.",
    beforeShow: async () => {
      if (typeof closeEdit === "function") closeEdit();
    },
  },
  {
    page: "/katalog",
    target: "#btn-export-open",
    text: "„Exportieren“ erstellt eine Excel-, Word- oder PDF-Datei – du wählst selbst, welche Spalten enthalten sein sollen.",
  },
  {
    page: "/katalog",
    target: ["#export-backup", "#btn-import"],
    text:
      'Möchtest du ein Backup machen oder auf ein neues Gerät umziehen? So geht’s: Auf „Komplettes Backup“ tippen – das lädt eine ZIP-Datei mit allen Büchern und Cover-Bildern herunter. ' +
      'Diese Datei auf das neue Gerät übertragen, dort die Software öffnen, auf „Daten importieren“ tippen und die ZIP-Datei auswählen – fertig.',
  },
  {
    page: "/katalog",
    target: "#nav-speicher-link",
    text:
      "Über „Speicher“ oben in der Navigation siehst du, wo die Software auf der Festplatte installiert ist, wofür jeder " +
      "einzelne Ordner/jede Datei darin da ist, wie viel Arbeitsspeicher und Festplattenspeicher belegt sind – und kannst " +
      "nicht mehr benötigte Systemdateien (z. B. Installations-Werkzeuge) direkt dort löschen.",
  },
  {
    page: "/katalog",
    target: [`tr[data-isbn="${EXAMPLE_ISBN_1}"]`, `tr[data-isbn="${EXAMPLE_ISBN_2}"]`],
    text: "Fertig mit dem Ausprobieren? Häkchen bei den beiden Beispielbüchern setzen und löschen.",
    interactive: true,
    beforeShow: async () => {
      if (typeof refreshList === "function") await refreshList();
    },
  },
  {
    page: "/katalog",
    target: null,
    text:
      "Geschafft! Jetzt kannst du mit deinen eigenen Büchern loslegen 📚\n\n" +
      "Diese Anleitung findest du jederzeit wieder über „❓ Anleitung“ oben in der Navigation.",
  },
];

function tourSelectExampleRows() {
  [EXAMPLE_ISBN_1, EXAMPLE_ISBN_2].forEach((isbn) => {
    const cb = document.querySelector(`tr[data-isbn="${isbn}"] .row-select`);
    if (cb && !cb.checked) cb.click();
  });
}

function tourDeselectExampleRows() {
  [EXAMPLE_ISBN_1, EXAMPLE_ISBN_2].forEach((isbn) => {
    const cb = document.querySelector(`tr[data-isbn="${isbn}"] .row-select`);
    if (cb && cb.checked) cb.click();
  });
}

async function ensureExampleBooksSeeded() {
  const data = await Api.listBooks({});
  const hasExamples = data.items.some((b) => b.title && b.title.startsWith(EXAMPLE_TITLE_PREFIX));
  if (hasExamples) return;

  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await Api.saveBook(EXAMPLE_ISBN_1, {
    title: EXAMPLE_TITLE_PREFIX + "Die Insel der blauen Delfine",
    author: "Scott O'Dell",
    publisher: null,
    published_year: null,
    cover_url: "/static/icon-256.png",
    cover_image: null,
    source: null,
    location: null,
    notes: "Dies ist ein Beispielbuch zum Ausprobieren. Du kannst es jederzeit löschen.",
    due_date: dueDate,
    themes: [],
    metadata_fetched: false,
  });

  await Api.saveBook(EXAMPLE_ISBN_2, {
    title: EXAMPLE_TITLE_PREFIX + "Der kleine Prinz",
    author: "Antoine de Saint-Exupéry",
    publisher: null,
    published_year: null,
    cover_url: null,
    cover_image: null,
    source: null,
    location: null,
    notes: "Dies ist ein zweites Beispielbuch zum Ausprobieren. Du kannst es jederzeit löschen.",
    due_date: null,
    themes: [],
    metadata_fetched: false,
  });
}

function tourCurrentStepIndex() {
  return parseInt(sessionStorage.getItem(TOUR_KEY_STEP) || "0", 10);
}

function tourSetStep(idx) {
  sessionStorage.setItem(TOUR_KEY_ACTIVE, "1");
  sessionStorage.setItem(TOUR_KEY_STEP, String(idx));
}

function removeTourUi() {
  document.querySelectorAll(".tour-blocker, .tour-spotlight, .tour-bubble").forEach((el) => el.remove());
}

function waitForElements(selectors, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function attempt() {
      const found = selectors.map((s) => document.querySelector(s)).filter(Boolean);
      if (found.length === selectors.length || Date.now() - start > timeoutMs) {
        resolve(found);
      } else {
        setTimeout(attempt, 80);
      }
    }
    attempt();
  });
}

function unionRect(rects) {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function positionSpotlight(el, rect) {
  const pad = 8;
  el.style.left = rect.left - pad + "px";
  el.style.top = rect.top - pad + "px";
  el.style.width = rect.width + pad * 2 + "px";
  el.style.height = rect.height + pad * 2 + "px";
}

// Probiert alle vier Seiten des hervorgehobenen Bereichs (unten/oben/rechts/links)
// und nimmt die erste, auf der die Sprechblase in ihrer natuerlichen Groesse ohne
// Ueberlappung Platz hat. Passt keine Seite, wird die Seite mit dem meisten Platz
// genutzt und die Blase dort hinein verkleinert (Text scrollt bei Bedarf dank
// overflow-y:auto in .tour-bubble). Am Ende wird immer hart auf den sichtbaren
// Bereich geclampt, damit die Blase nie ausserhalb des Bildschirms landet -
// unabhaengig von Bildschirmgroesse/-aufloesung.
function positionBubble(bubbleEl, rect) {
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Natuerliche Groesse frisch messen (CSS-Standardwerte, keine Beschraenkung
  // aus einem vorherigen Aufruf).
  bubbleEl.style.maxWidth = "";
  bubbleEl.style.maxHeight = "";
  let bw = bubbleEl.offsetWidth;
  let bh = bubbleEl.offsetHeight;

  const sides = [
    { name: "bottom", space: vh - rect.bottom - margin, axis: "v" },
    { name: "top", space: rect.top - margin, axis: "v" },
    { name: "right", space: vw - rect.right - margin, axis: "h" },
    { name: "left", space: rect.left - margin, axis: "h" },
  ];

  let chosen = sides.find((s) => s.space >= (s.axis === "v" ? bh : bw));

  if (!chosen) {
    // Nirgends passt die natuerliche Groesse -> Seite mit dem meisten Platz
    // nehmen und die Blase dort hinein schrumpfen lassen.
    chosen = sides.reduce((a, b) => (b.space > a.space ? b : a));
    if (chosen.axis === "v") {
      bubbleEl.style.maxHeight = Math.max(chosen.space, 120) + "px";
      bubbleEl.style.maxWidth = Math.min(340, vw - margin * 2) + "px";
    } else {
      bubbleEl.style.maxWidth = Math.max(chosen.space, 220) + "px";
      bubbleEl.style.maxHeight = vh - margin * 2 + "px";
    }
    bw = bubbleEl.offsetWidth;
    bh = bubbleEl.offsetHeight;
  }

  let top, left;
  if (chosen.name === "bottom") {
    top = rect.bottom + margin;
    left = rect.left + rect.width / 2 - bw / 2;
  } else if (chosen.name === "top") {
    top = rect.top - margin - bh;
    left = rect.left + rect.width / 2 - bw / 2;
  } else if (chosen.name === "right") {
    left = rect.right + margin;
    top = rect.top + rect.height / 2 - bh / 2;
  } else {
    left = rect.left - margin - bw;
    top = rect.top + rect.height / 2 - bh / 2;
  }

  left = Math.min(Math.max(left, margin), Math.max(margin, vw - bw - margin));
  top = Math.min(Math.max(top, margin), Math.max(margin, vh - bh - margin));

  bubbleEl.style.left = left + "px";
  bubbleEl.style.top = top + "px";
}

async function showStep(idx) {
  const step = TOUR_STEPS[idx];
  if (!step) {
    endTour({ completed: false });
    return;
  }
  removeTourUi();
  if (step.beforeShow) await step.beforeShow();

  let rect = null;
  if (step.target) {
    const selectors = Array.isArray(step.target) ? step.target : [step.target];
    const foundEls = await waitForElements(selectors);
    if (foundEls.length) {
      // "instant" statt "smooth": bei animiertem Scrollen war das Element beim
      // Vermessen (naechster Frame) oft noch mitten in der Scroll-Animation,
      // wodurch Spotlight/Sprechblase an der falschen Stelle landeten.
      foundEls[0].scrollIntoView({ behavior: "instant", block: "center" });
      await nextFrame();
      await nextFrame();
      // Versteckte Elemente (z. B. der Kalender-Button, bevor ein Rueckgabedatum
      // gesetzt ist) liefern ein Nullmass-Rect - das wuerde die Vereinigung
      // verfaelschen, darum hier ausgefiltert.
      const visibleEls = foundEls.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (visibleEls.length) {
        rect = unionRect(visibleEls.map((el) => el.getBoundingClientRect()));
      }
    }
  }

  const blocker = document.createElement("div");
  blocker.className = "tour-blocker" + (step.interactive ? " tour-pass-through" : "");
  document.body.appendChild(blocker);

  if (rect) {
    const spotlight = document.createElement("div");
    spotlight.className = "tour-spotlight";
    positionSpotlight(spotlight, rect);
    document.body.appendChild(spotlight);
  }

  const bubble = document.createElement("div");
  bubble.className = "tour-bubble" + (rect ? "" : " tour-centered");

  const counter = document.createElement("div");
  counter.className = "tour-bubble-counter";
  counter.textContent = `Schritt ${idx + 1} von ${TOUR_STEPS.length}`;
  bubble.appendChild(counter);

  if (step.title) {
    const titleEl = document.createElement("h3");
    titleEl.className = "tour-bubble-title";
    titleEl.textContent = step.title;
    bubble.appendChild(titleEl);
  }

  const text = document.createElement("p");
  text.className = "tour-bubble-text";
  text.textContent = step.text;
  bubble.appendChild(text);

  const row = document.createElement("div");
  row.className = "button-row";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "secondary";
  backBtn.textContent = "Zurück";
  backBtn.disabled = idx === 0;
  backBtn.addEventListener("click", tourPrevStep);
  row.appendChild(backBtn);

  const isLast = idx === TOUR_STEPS.length - 1;
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.textContent = isLast ? "Fertig" : "Weiter";
  nextBtn.addEventListener("click", () => {
    if (isLast) endTour({ completed: true });
    else tourNextStep();
  });
  row.appendChild(nextBtn);

  bubble.appendChild(row);

  if (!isLast) {
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "tour-skip-link";
    skipBtn.textContent = "Tour überspringen";
    skipBtn.addEventListener("click", () => endTour({ completed: false }));
    bubble.appendChild(skipBtn);
  }

  document.body.appendChild(bubble);
  if (rect) positionBubble(bubble, rect);
}

function tourGotoStepPage(idx) {
  const step = TOUR_STEPS[idx];
  if (!step) {
    endTour({ completed: false });
    return;
  }
  if (step.page !== location.pathname) {
    location.href = step.page;
  } else {
    showStep(idx);
  }
}

async function tourNextStep() {
  const idx = tourCurrentStepIndex();
  const step = TOUR_STEPS[idx];
  if (step && step.afterHide) await step.afterHide();
  const nextIdx = idx + 1;
  if (nextIdx >= TOUR_STEPS.length) {
    endTour({ completed: true });
    return;
  }
  tourSetStep(nextIdx);
  tourGotoStepPage(nextIdx);
}

async function tourPrevStep() {
  const idx = tourCurrentStepIndex();
  if (idx <= 0) return;
  const step = TOUR_STEPS[idx];
  if (step && step.afterHide) await step.afterHide();
  const prevIdx = idx - 1;
  tourSetStep(prevIdx);
  tourGotoStepPage(prevIdx);
}

async function startTour() {
  removeWelcomeModal();
  try {
    await ensureExampleBooksSeeded();
  } catch (e) {
    /* Beispielbücher konnten nicht angelegt werden - Tour trotzdem starten */
  }
  tourSetStep(0);
  tourGotoStepPage(0);
}

function endTour(opts) {
  const completed = !!(opts && opts.completed);
  sessionStorage.removeItem(TOUR_KEY_ACTIVE);
  sessionStorage.removeItem(TOUR_KEY_STEP);
  if (completed) {
    localStorage.setItem(TOUR_KEY_NEVER_SHOW, "1");
  } else {
    sessionStorage.setItem(TOUR_KEY_SKIPPED_SESSION, "1");
  }
  removeTourUi();
}

let welcomeModalOverlay = null;

function removeWelcomeModal() {
  if (welcomeModalOverlay) {
    welcomeModalOverlay.remove();
    welcomeModalOverlay = null;
  }
}

function showWelcomeModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";
  dialog.style.maxWidth = "560px";

  const heading = document.createElement("h2");
  heading.style.marginTop = "0";
  heading.textContent = "Willkommen! 📚";
  dialog.appendChild(heading);

  const body = document.createElement("p");
  body.textContent = "Beim ersten Mal empfehlen wir eine kurze Anleitung. Dauer: ca. 5 Minuten.";
  dialog.appendChild(body);

  const row = document.createElement("div");
  row.className = "button-row";
  row.style.flexWrap = "nowrap";

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.textContent = "Ja, zeig mir alles";
  viewBtn.addEventListener("click", () => startTour());
  row.appendChild(viewBtn);

  const laterBtn = document.createElement("button");
  laterBtn.type = "button";
  laterBtn.className = "secondary";
  laterBtn.textContent = "Später";
  laterBtn.addEventListener("click", () => {
    sessionStorage.setItem(TOUR_KEY_SKIPPED_SESSION, "1");
    removeWelcomeModal();
  });
  row.appendChild(laterBtn);

  const neverBtn = document.createElement("button");
  neverBtn.type = "button";
  neverBtn.className = "secondary";
  neverBtn.textContent = "Nicht mehr fragen";
  neverBtn.addEventListener("click", async () => {
    localStorage.setItem(TOUR_KEY_NEVER_SHOW, "1");
    removeWelcomeModal();
    await AppDialogs.alert(
      'Kein Problem. Falls du die Anleitung später doch noch sehen willst: Oben in der Navigation findest du jederzeit den Button „❓ Anleitung“.'
    );
  });
  row.appendChild(neverBtn);

  dialog.appendChild(row);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  welcomeModalOverlay = overlay;
}

function wireTourNavButton() {
  const btn = document.getElementById("nav-tour-btn");
  if (!btn) return;
  btn.addEventListener("click", (evt) => {
    evt.preventDefault();
    startTour();
  });
}

function tourInit() {
  wireTourNavButton();

  if (sessionStorage.getItem(TOUR_KEY_ACTIVE) === "1") {
    showStep(tourCurrentStepIndex());
    return;
  }

  if (location.pathname !== "/") return;
  if (localStorage.getItem(TOUR_KEY_NEVER_SHOW) === "1") return;
  if (sessionStorage.getItem(TOUR_KEY_SKIPPED_SESSION) === "1") return;
  showWelcomeModal();
}

tourInit();
