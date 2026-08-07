const state = {
  isbn: null,
  isUpdate: false,
  coverUrl: null,
  coverImage: null,
  metadataFetched: false,
  createdAt: null,
};

let scanning = false;
let availableCameras = [];
let selectedDeviceId = null;
let detectionBuffer = [];
let scanMode = null; // "native" | "zxing"
let nativeSupported = null;
let barcodeDetector = null;
let nativeStream = null;
let nativeVideoEl = null;
let nativeTimer = null;
let nativeDetecting = false;
let zxingReader = null;
let zxingControls = null;
let zxingVideoEl = null;

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

const els = {
  reader: document.getElementById("reader"),
  cameraSelect: document.getElementById("camera-select"),
  btnStart: document.getElementById("btn-start-scan"),
  btnStop: document.getElementById("btn-stop-scan"),
  manualInput: document.getElementById("manual-isbn-input"),
  btnManual: document.getElementById("btn-manual-lookup"),
  btnManualEntry: document.getElementById("btn-manual-entry"),
  status: document.getElementById("status"),
  form: document.getElementById("book-form"),
  isbnDisplay: document.getElementById("isbn-display"),
  metaInfo: document.getElementById("meta-info"),
  badge: document.getElementById("meta-badge"),
  title: document.getElementById("field-title"),
  author: document.getElementById("field-author"),
  publisher: document.getElementById("field-publisher"),
  year: document.getElementById("field-year"),
  source: document.getElementById("field-source"),
  location: document.getElementById("field-location"),
  theme: document.getElementById("field-theme"),
  notes: document.getElementById("field-notes"),
  dueDate: document.getElementById("field-due-date"),
  btnAddToCalendar: document.getElementById("btn-add-to-calendar"),
  btnCancel: document.getElementById("btn-cancel"),
  btnSaveAndScanNext: document.getElementById("btn-save-and-scan-next"),
  formHeading: document.getElementById("form-heading"),
  coverPreview: document.getElementById("cover-preview-img"),
  btnTakePhoto: document.getElementById("btn-take-photo"),
  btnChoosePhoto: document.getElementById("btn-choose-photo"),
  coverFileInputLibrary: document.getElementById("cover-file-input-library"),
  btnPhoneScanHint: document.getElementById("btn-phone-scan-hint"),
  btnManagePermissions: document.getElementById("btn-manage-permissions"),
  phoneScanModalOverlay: document.getElementById("phone-scan-modal-overlay"),
  btnPhoneScanClose: document.getElementById("btn-phone-scan-close"),
  btnPhoneScanCloseX: document.getElementById("btn-phone-scan-close-x"),
  phoneScanQr: document.getElementById("phone-scan-qr"),
  phoneScanUrl: document.getElementById("phone-scan-url"),
};

const sourceTagPicker = initTagPicker("tags-source", "source", els.source);
const locationTagPicker = initTagPicker("tags-location", "location", els.location);
const themeTagPicker = initTagPicker("tags-theme", "theme", els.theme, { multi: true });
const dueDatePicker = initDatePicker("field-due-date-picker", els.dueDate);

function showStatus(message, type) {
  els.status.textContent = message;
  els.status.className = `status ${type}`;
  els.status.classList.remove("hidden");
}

function clearStatus() {
  els.status.classList.add("hidden");
}

function toggleScanButtons(isScanning) {
  els.btnStart.classList.toggle("hidden", isScanning);
  els.btnStop.classList.toggle("hidden", !isScanning);
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15);
    oscillator.onended = () => ctx.close();
  } catch (e) {
    /* Web Audio nicht verfügbar - kein Problem, nur akustisches Feedback fehlt */
  }
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(200);
}

async function refreshCameraOptions() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter((d) => d.kind === "videoinput");
  } catch (e) {
    availableCameras = [];
  }

  if (availableCameras.length > 1) {
    const previousValue = selectedDeviceId;
    els.cameraSelect.innerHTML = "";
    availableCameras.forEach((cam, idx) => {
      const option = document.createElement("option");
      option.value = cam.deviceId;
      option.textContent = cam.label || `Kamera ${idx + 1}`;
      els.cameraSelect.appendChild(option);
    });
    if (!selectedDeviceId) {
      const backCam = availableCameras.find((c) => /back|rear|environment/i.test(c.label || ""));
      selectedDeviceId = backCam ? backCam.deviceId : availableCameras[availableCameras.length - 1].deviceId;
    }
    els.cameraSelect.value = previousValue || selectedDeviceId;
    els.cameraSelect.classList.remove("hidden");
  } else {
    els.cameraSelect.classList.add("hidden");
  }
}

async function checkNativeDetectorSupport() {
  if (nativeSupported !== null) return nativeSupported;
  if (!("BarcodeDetector" in window)) {
    nativeSupported = false;
    return false;
  }
  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    nativeSupported = BARCODE_FORMATS.some((f) => formats.includes(f));
  } catch (e) {
    nativeSupported = false;
  }
  return nativeSupported;
}

function scanConstraints() {
  const constraints = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  if (selectedDeviceId) {
    constraints.deviceId = { exact: selectedDeviceId };
  } else {
    constraints.facingMode = "environment";
  }
  return constraints;
}

function showCameraError(err) {
  const name = err && err.name ? err.name : "";
  showStatus("Kamera konnte nicht gestartet werden: " + describeCameraError(err), "danger");
  const isPermissionError = name === "NotAllowedError" || name === "PermissionDeniedError";
  els.btnManagePermissions.classList.toggle("hidden", !isPermissionError);
}

async function startScan() {
  if (scanning) return;
  els.form.classList.add("hidden");
  clearStatus();
  showStatus("Kamera wird gestartet …", "info");
  els.btnManagePermissions.classList.add("hidden");
  detectionBuffer = [];

  // Moderne Browser (v.a. auf dem Handy, ueber Google Play Services) bringen mit der
  // BarcodeDetector-API eine native, hardwarebeschleunigte Barcode-Erkennung mit -
  // deutlich schneller und zuverlaessiger als jede bildbasierte JS-Erkennung. Wo das
  // nicht verfuegbar ist (z. B. Windows-Desktop-Browser), wird auf ZXing
  // zurueckgefallen, das in Tests deutlich zuverlaessiger als die vorher genutzte
  // Bibliothek Quagga war.
  const useNative = await checkNativeDetectorSupport();
  if (useNative) {
    await startNativeScan();
  } else {
    startZxingScan();
  }
}

function stopScan() {
  if (!scanning) return;
  if (scanMode === "native") {
    stopNativeScan();
  } else {
    stopZxingScan();
  }
}

async function startNativeScan() {
  try {
    nativeStream = await navigator.mediaDevices.getUserMedia({ video: scanConstraints(), audio: false });
  } catch (err) {
    showCameraError(err);
    return;
  }

  try {
    barcodeDetector = new BarcodeDetector({ formats: BARCODE_FORMATS });
  } catch (e) {
    nativeStream.getTracks().forEach((t) => t.stop());
    nativeStream = null;
    startZxingScan();
    return;
  }

  els.reader.innerHTML = "";
  nativeVideoEl = document.createElement("video");
  nativeVideoEl.setAttribute("playsinline", "");
  nativeVideoEl.autoplay = true;
  nativeVideoEl.muted = true;
  nativeVideoEl.style.width = "100%";
  nativeVideoEl.style.display = "block";
  nativeVideoEl.srcObject = nativeStream;
  els.reader.appendChild(nativeVideoEl);

  scanMode = "native";
  scanning = true;
  toggleScanButtons(true);
  clearStatus();
  refreshCameraOptions();

  nativeTimer = setInterval(nativeDetectTick, 150);
}

async function nativeDetectTick() {
  if (!scanning || scanMode !== "native" || nativeDetecting) return;
  if (!nativeVideoEl || nativeVideoEl.readyState < 2) return;
  nativeDetecting = true;
  try {
    const barcodes = await barcodeDetector.detect(nativeVideoEl);
    if (barcodes.length > 0) {
      onScanSuccess({ codeResult: { code: barcodes[0].rawValue } });
    }
  } catch (e) {
    /* einzelner Erkennungsversuch fehlgeschlagen - naechster Tick versucht es erneut */
  } finally {
    nativeDetecting = false;
  }
}

function stopNativeScan() {
  scanning = false;
  scanMode = null;
  toggleScanButtons(false);
  if (nativeTimer) {
    clearInterval(nativeTimer);
    nativeTimer = null;
  }
  if (nativeStream) {
    nativeStream.getTracks().forEach((t) => t.stop());
    nativeStream = null;
  }
  nativeVideoEl = null;
}

function zxingFormats() {
  const F = ZXing.BarcodeFormat;
  return [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128];
}

async function startZxingScan() {
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, zxingFormats());
  zxingReader = new ZXing.BrowserMultiFormatReader(hints);

  els.reader.innerHTML = "";
  zxingVideoEl = document.createElement("video");
  zxingVideoEl.setAttribute("playsinline", "");
  zxingVideoEl.muted = true;
  zxingVideoEl.style.width = "100%";
  zxingVideoEl.style.display = "block";
  els.reader.appendChild(zxingVideoEl);

  try {
    zxingControls = await zxingReader.decodeFromConstraints(
      { video: scanConstraints(), audio: false },
      zxingVideoEl,
      (result) => {
        if (result) {
          onScanSuccess({ codeResult: { code: result.getText() } });
        }
      }
    );
  } catch (err) {
    showCameraError(err);
    return;
  }

  scanMode = "zxing";
  scanning = true;
  toggleScanButtons(true);
  clearStatus();
  refreshCameraOptions();
}

function stopZxingScan() {
  scanning = false;
  scanMode = null;
  toggleScanButtons(false);
  try {
    if (zxingControls) zxingControls.stop();
  } catch (e) {
    /* bereits gestoppt */
  }
  // zxingControls.stop() beendet nur die Erkennung, laesst die Kamera aber an -
  // die Tracks des MediaStreams muessen darum hier selbst gestoppt werden, sonst
  // bleibt das Kamera-Licht/die Freigabe nach "Scannen stoppen" aktiv.
  if (zxingVideoEl && zxingVideoEl.srcObject) {
    zxingVideoEl.srcObject.getTracks().forEach((t) => t.stop());
    zxingVideoEl.srcObject = null;
  }
  zxingControls = null;
  zxingReader = null;
  zxingVideoEl = null;
}

els.cameraSelect.addEventListener("change", () => {
  selectedDeviceId = els.cameraSelect.value;
  if (scanning) {
    stopScan();
    startScan();
  }
});

function isValidEan13(code) {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = code.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === code.charCodeAt(12) - 48;
}

function onScanSuccess(result) {
  const code = result && result.codeResult && result.codeResult.code;
  if (!code) return;
  const trimmed = code.trim();
  const isEan13 = /^\d{13}$/.test(trimmed);

  // ISBN-Barcodes sind EAN-13 mit Pruefziffer. Ein Fehllesen faellt hier meistens
  // schon durch die Pruefziffer auf und wird verworfen, statt eine falsche ISBN
  // zu uebernehmen.
  if (isEan13 && !isValidEan13(trimmed)) {
    return;
  }

  // Die native BarcodeDetector-Erkennung ist deutlich zuverlaessiger und wird sofort
  // akzeptiert. Bei ZXing reicht die Pruefziffer allein sicherheitshalber nicht -
  // dort wird weiterhin eine kurze doppelte Erkennung verlangt, bevor uebernommen wird.
  if (scanMode === "zxing") {
    const confirmWindow = isEan13 ? 3 : 4;
    detectionBuffer.push(trimmed);
    if (detectionBuffer.length > confirmWindow) detectionBuffer.shift();
    const matches = detectionBuffer.filter((c) => c === trimmed).length;
    if (matches < 2) {
      return;
    }
  }

  detectionBuffer = [];
  playBeep();
  vibrate();
  stopScan();
  handleIsbn(trimmed);
}

function updateCalendarLink() {
  els.btnAddToCalendar.classList.toggle("hidden", !els.dueDate.value);
}

els.dueDate.addEventListener("change", updateCalendarLink);

function buildPayload() {
  const themes = els.theme.value ? els.theme.value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return {
    title: els.title.value || null,
    author: els.author.value || null,
    publisher: els.publisher.value || null,
    published_year: els.year.value || null,
    cover_url: state.coverUrl,
    cover_image: state.coverImage,
    source: els.source.value || null,
    location: els.location.value || null,
    themes,
    notes: els.notes.value || null,
    due_date: els.dueDate.value || null,
    metadata_fetched: state.metadataFetched,
  };
}

async function persistBook() {
  const result = await Api.saveBook(state.isbn, buildPayload());
  state.isUpdate = true;
  return result;
}

els.btnAddToCalendar.addEventListener("click", async () => {
  if (!els.dueDate.value) return;
  try {
    if (!state.isUpdate) {
      await persistBook();
      showStatus("Zwischengespeichert.", "success");
    }
    Api.downloadSingleCalendar(state.isbn);
  } catch (err) {
    showStatus("Kalendereintrag konnte nicht erstellt werden: " + err.message, "danger");
  }
});

function updateCoverPreview() {
  const src = state.coverImage || state.coverUrl;
  if (src) {
    els.coverPreview.src = src;
    els.coverPreview.classList.remove("hidden");
  } else {
    els.coverPreview.classList.add("hidden");
  }
}

async function handleCoverFile(file) {
  if (!file || !state.isbn) return;
  try {
    const result = await Api.uploadCover(state.isbn, file);
    state.coverImage = result.cover_image;
    updateCoverPreview();
    showStatus("Foto gespeichert.", "success");
  } catch (err) {
    showStatus("Foto-Upload fehlgeschlagen: " + err.message, "danger");
  }
}

els.btnTakePhoto.addEventListener("click", () => openCameraCapture(handleCoverFile));

els.btnChoosePhoto.addEventListener("click", () => els.coverFileInputLibrary.click());
els.coverFileInputLibrary.addEventListener("change", () =>
  handleCoverFile(els.coverFileInputLibrary.files[0])
);

function fillForm(book) {
  state.isbn = book.isbn;
  state.coverUrl = book.cover_url || null;
  state.coverImage = book.cover_image || null;
  state.metadataFetched = !!book.metadata_fetched;
  state.createdAt = book.created_at || null;

  els.isbnDisplay.textContent = book.isbn;
  els.title.value = book.title || "";
  els.author.value = book.author || "";
  els.publisher.value = book.publisher || "";
  els.year.value = book.published_year || "";
  els.source.value = book.source || "";
  els.location.value = book.location || "";
  els.theme.value = (book.themes || []).join(",");
  els.notes.value = book.notes || "";
  dueDatePicker.setValue(book.due_date || null);

  els.metaInfo.textContent = book.created_at
    ? `Erfasst am: ${new Date(book.created_at).toLocaleString("de-DE")}`
    : "Wird beim Speichern automatisch erfasst.";
  els.badge.classList.toggle("hidden", state.metadataFetched);
  els.formHeading.textContent = state.isUpdate
    ? "Vorhandenes Buch aktualisieren"
    : "Neues Buch erfassen";

  sourceTagPicker.refresh();
  locationTagPicker.refresh();
  themeTagPicker.refresh();
  updateCalendarLink();
  updateCoverPreview();

  els.form.classList.remove("hidden");
  els.formHeading.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleIsbn(isbn) {
  if (!isbn) return;
  clearStatus();
  showStatus(`ISBN ${isbn} erkannt – suche Datensatz…`, "info");

  const existing = await Api.getBook(isbn);
  if (existing.found) {
    state.isUpdate = true;
    fillForm(existing.book);
    showStatus("Vorhandenes Buch gefunden – Angaben können aktualisiert werden.", "success");
    return;
  }

  state.isUpdate = false;
  const lookup = await Api.lookup(isbn);

  if (lookup.found) {
    fillForm({
      isbn,
      title: lookup.title,
      author: lookup.author,
      publisher: lookup.publisher,
      published_year: lookup.published_year,
      cover_url: lookup.cover_url,
      source: "",
      location: "",
      notes: "",
      due_date: "",
      metadata_fetched: true,
      created_at: null,
    });
    showStatus("Neues Buch – Metadaten automatisch gefunden. Bitte Herkunft/Standort ergänzen.", "success");
  } else {
    fillForm({
      isbn,
      title: "",
      author: "",
      publisher: "",
      published_year: "",
      cover_url: null,
      source: "",
      location: "",
      notes: "",
      due_date: "",
      metadata_fetched: false,
      created_at: null,
    });
    if (lookup.reason === "network_error") {
      showStatus("Keine Internetverbindung – Metadaten konnten nicht geladen werden. Bitte manuell ausfüllen.", "warning");
    } else {
      showStatus("Keine Online-Metadaten gefunden. Bitte manuell ausfüllen.", "warning");
    }
  }
}

function resetForm(autoStartScan) {
  els.form.classList.add("hidden");
  state.isbn = null;
  state.isUpdate = false;
  if (autoStartScan) startScan();
}

async function saveAndReset(autoStartScan) {
  try {
    const result = await Api.saveBook(state.isbn, buildPayload());
    showStatus(result.created ? "Neu angelegt." : "Aktualisiert.", "success");
    resetForm(autoStartScan);
  } catch (err) {
    showStatus("Fehler beim Speichern: " + err.message, "danger");
  }
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  saveAndReset(false);
});

els.btnSaveAndScanNext.addEventListener("click", () => saveAndReset(true));

els.btnCancel.addEventListener("click", () => {
  clearStatus();
  resetForm(false);
});

els.btnStart.addEventListener("click", startScan);
els.btnStop.addEventListener("click", stopScan);

async function openPhoneScanHint() {
  els.phoneScanModalOverlay.classList.remove("hidden");
  els.phoneScanQr.src = `/static/qr.png?t=${Date.now()}`;
  els.phoneScanUrl.textContent = "wird geladen …";
  try {
    const res = await fetch("/api/lan-info");
    const data = await res.json();
    els.phoneScanUrl.textContent = data.url;
  } catch (e) {
    els.phoneScanUrl.textContent = "Konnte nicht ermittelt werden.";
  }
}

function closePhoneScanHint() {
  els.phoneScanModalOverlay.classList.add("hidden");
}

els.btnPhoneScanHint.addEventListener("click", openPhoneScanHint);
els.btnPhoneScanClose.addEventListener("click", closePhoneScanHint);
els.btnPhoneScanCloseX.addEventListener("click", closePhoneScanHint);
els.phoneScanModalOverlay.addEventListener("click", (evt) => {
  if (evt.target === els.phoneScanModalOverlay) closePhoneScanHint();
});

// Die Adresse fuer die Website-Berechtigungen unterscheidet sich je nach Browser
// (edge:// vs. chrome:// vs. Firefox' about:preferences vs. Safaris Menue-Weg ohne
// URL-Schema) - darum wird der tatsaechlich benutzte Browser anhand des User-Agent
// erkannt, statt pauschal von Edge auszugehen.
function detectPermissionGuidance() {
  const ua = navigator.userAgent;
  const host = location.hostname;
  const isEdge = /Edg\//.test(ua);
  const isChrome = !isEdge && /Chrome\//.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isSafari = !isEdge && !isChrome && !isFirefox && /Safari\//.test(ua);
  // Der Auto-Oeffnen-Trick startet einen Prozess auf dem Server-PC - das hilft nur,
  // wenn Browser und Server auf demselben Geraet laufen (Haupt-PC ueber
  // https://localhost:8000), nicht bei Zugriff per Handy/Tablet ueber die LAN-IP.
  const isSameMachine = host === "localhost" || host === "127.0.0.1";

  if (isEdge) {
    return {
      canAutoOpen: isSameMachine,
      text:
        "Bitte oben in die Adressleiste eingeben und Enter drücken:\n\n" +
        "edge://settings/content/camera\n\n" +
        `Dort „${host}“ suchen: entweder auf „Zulassen“ stellen oder den Eintrag über das ` +
        "Papierkorb-Symbol entfernen (dann wird beim nächsten Scan-Start erneut gefragt).",
    };
  }
  if (isChrome) {
    return {
      canAutoOpen: false,
      text:
        "Bitte oben in die Adressleiste eingeben und Enter drücken:\n\n" +
        "chrome://settings/content/camera\n\n" +
        `Dort „${host}“ suchen: entweder auf „Zulassen“ stellen oder den Eintrag über das ` +
        "Papierkorb-Symbol entfernen (dann wird beim nächsten Scan-Start erneut gefragt).",
    };
  }
  if (isFirefox) {
    return {
      canAutoOpen: false,
      text:
        "Bitte oben in die Adressleiste eingeben und Enter drücken:\n\n" +
        "about:preferences#privacy\n\n" +
        `Dort bei „Berechtigungen“ → „Kamera“ auf „Einstellungen …“ klicken und den Eintrag für „${host}“ ` +
        "auf „Erlauben“ setzen oder entfernen.",
    };
  }
  if (isSafari) {
    return {
      canAutoOpen: false,
      text:
        "Safari verwaltet Website-Berechtigungen nicht über eine eintippbare Adresse, sondern über das Menü:\n\n" +
        `Safari → Einstellungen für diese Website (oder Safari-Menü → Einstellungen → Websites → Kamera) – dort „${host}“ ` +
        "auf „Erlauben“ stellen.",
    };
  }
  return {
    canAutoOpen: false,
    text:
      "Bitte in den Website-Einstellungen dieses Browsers (meist über das Schloss-/Info-Symbol links neben der " +
      `Adresse erreichbar) die Kamera-Berechtigung für „${host}“ auf „Erlauben“ stellen.`,
  };
}

els.btnManagePermissions.addEventListener("click", async () => {
  const guidance = detectPermissionGuidance();

  if (!guidance.canAutoOpen) {
    await AppDialogs.alert(guidance.text);
    return;
  }

  try {
    const res = await fetch("/api/system/open-permissions-helper", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Fehler (${res.status})`);
    }
    await AppDialogs.alert("Ein neues Edge-Fenster sollte sich gerade geöffnet haben.\n\n" + guidance.text);
  } catch (err) {
    await AppDialogs.alert(
      "Das Berechtigungs-Fenster konnte nicht automatisch geöffnet werden (" +
        err.message +
        ").\n\nBitte manuell ein Edge-Fenster öffnen und Folgendes eingeben:\n\n" +
        guidance.text
    );
  }
});

els.btnManual.addEventListener("click", () => {
  const isbn = els.manualInput.value.trim();
  if (!isbn) return;
  stopScan();
  els.manualInput.value = "";
  handleIsbn(isbn);
});

els.manualInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    els.btnManual.click();
  }
});

els.btnManualEntry.addEventListener("click", () => {
  stopScan();
  clearStatus();
  els.manualInput.value = "";
  state.isUpdate = false;
  fillForm({
    isbn: "manuell-" + Date.now(),
    title: "",
    author: "",
    publisher: "",
    published_year: "",
    cover_url: null,
    source: "",
    location: "",
    notes: "",
    due_date: "",
    metadata_fetched: false,
    created_at: null,
  });
  showStatus("Manuelle Erfassung ohne ISBN – bitte alle Angaben selbst eintragen.", "info");
  els.title.focus();
});
