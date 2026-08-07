const els = {
  search: document.getElementById("filter-search"),
  btnClearFilters: document.getElementById("btn-clear-filters"),
  btnRefresh: document.getElementById("btn-refresh"),
  tableBody: document.getElementById("table-body"),
  selectAll: document.getElementById("select-all"),
  totalCount: document.getElementById("total-count"),
  exportBackup: document.getElementById("export-backup"),
  btnExportOpen: document.getElementById("btn-export-open"),
  btnImport: document.getElementById("btn-import"),
  importFileInput: document.getElementById("import-file-input"),
  bulkBar: document.getElementById("bulk-bar"),
  bulkCount: document.getElementById("bulk-count"),
  btnBulkDueDate: document.getElementById("btn-bulk-due-date"),
  bulkDueDatePickerEl: document.getElementById("bulk-due-date-picker"),
  bulkDueDateInput: document.getElementById("bulk-due-date-input"),
  btnBulkDueDateApply: document.getElementById("btn-bulk-due-date-apply"),
  btnBulkExportOpen: document.getElementById("btn-bulk-export-open"),
  btnBulkDelete: document.getElementById("btn-bulk-delete"),
  btnBulkClear: document.getElementById("btn-bulk-clear"),
  editModalOverlay: document.getElementById("edit-modal-overlay"),
  btnEditCloseX: document.getElementById("btn-edit-close-x"),
  editIsbn: document.getElementById("edit-isbn-display"),
  editMetaInfo: document.getElementById("edit-meta-info"),
  editCoverPreview: document.getElementById("edit-cover-preview-img"),
  btnEditTakePhoto: document.getElementById("edit-btn-take-photo"),
  btnEditChoosePhoto: document.getElementById("edit-btn-choose-photo"),
  btnEditRemovePhoto: document.getElementById("edit-btn-remove-photo"),
  editCoverFileInputLibrary: document.getElementById("edit-cover-file-input-library"),
  editTitle: document.getElementById("edit-title"),
  editAuthor: document.getElementById("edit-author"),
  editPublisher: document.getElementById("edit-publisher"),
  editYear: document.getElementById("edit-year"),
  editSource: document.getElementById("edit-source"),
  editLocation: document.getElementById("edit-location"),
  editTheme: document.getElementById("edit-theme"),
  editNotes: document.getElementById("edit-notes"),
  editDueDate: document.getElementById("edit-due-date"),
  editAddToCalendar: document.getElementById("edit-add-to-calendar"),
  btnEditSave: document.getElementById("btn-edit-save"),
  btnEditCancel: document.getElementById("btn-edit-cancel"),
  btnEditDelete: document.getElementById("btn-edit-delete"),
  status: document.getElementById("status"),
  historyModalOverlay: document.getElementById("history-modal-overlay"),
  btnHistoryCloseX: document.getElementById("btn-history-close-x"),
  btnHistoryClose: document.getElementById("btn-history-close"),
  historyIsbnDisplay: document.getElementById("history-isbn-display"),
  historyModalList: document.getElementById("history-modal-list"),
  exportModalOverlay: document.getElementById("export-modal-overlay"),
  btnExportModalCloseX: document.getElementById("btn-export-modal-close-x"),
  exportColumnsList: document.getElementById("export-columns-list"),
  btnExportColumnsAll: document.getElementById("btn-export-columns-all"),
  btnExportColumnsInvert: document.getElementById("btn-export-columns-invert"),
  btnExportConfirm: document.getElementById("btn-export-confirm"),
  btnExportCancel: document.getElementById("btn-export-cancel"),
  coverLightboxOverlay: document.getElementById("cover-lightbox-overlay"),
  coverLightboxImg: document.getElementById("cover-lightbox-img"),
  btnCoverLightboxCloseX: document.getElementById("btn-cover-lightbox-close-x"),
};

const EXPORT_COLUMNS = [
  { key: "cover", label: "Cover", defaultChecked: false },
  { key: "isbn", label: "ISBN" },
  { key: "title", label: "Titel" },
  { key: "author", label: "Autor" },
  { key: "publisher", label: "Verlag" },
  { key: "published_year", label: "Jahr" },
  { key: "themes", label: "Themen" },
  { key: "source", label: "Herkunft" },
  { key: "location", label: "Standort" },
  { key: "notes", label: "Notizen" },
  { key: "due_date", label: "Rückgabe" },
  { key: "created_at", label: "Erfasst am" },
  { key: "updated_at", label: "Aktualisiert am" },
  { key: "history", label: "Änderungsverlauf", defaultChecked: false },
];

let currentEditIsbn = null;
let currentEditMetadataFetched = false;
let currentEditCoverUrl = null;
let currentEditCoverImage = null;
let currentEditSavedDueDate = null;
let lastListedIsbns = [];
let lastItems = [];
let currentHistoryIsbn = null;
const selectedIsbns = new Set();
const sortState = { key: null, dir: "asc" };
let sourceColors = {};
let locationColors = {};
let themeColors = {};

const editSourceTagPicker = initTagPicker("edit-tags-source", "source", els.editSource);
const editLocationTagPicker = initTagPicker("edit-tags-location", "location", els.editLocation);
const editThemeTagPicker = initTagPicker("edit-tags-theme", "theme", els.editTheme, { multi: true });
const editDueDatePicker = initDatePicker("edit-due-date-picker", els.editDueDate);
const bulkDueDatePicker = initDatePicker("bulk-due-date-picker", els.bulkDueDateInput);

function currentFilters() {
  return {
    q: els.search.value.trim(),
    location: locationFilter.getSelected(),
    source: sourceFilter.getSelected(),
    theme: themeFilter.getSelected(),
  };
}

function buildFilterMultiselect({ widgetId, toggleId, menuId, kind, placeholder, onChange }) {
  const widget = document.getElementById(widgetId);
  const toggle = document.getElementById(toggleId);
  const menu = document.getElementById(menuId);
  let selected = [];
  let options = [];

  function updateToggleLabel() {
    toggle.textContent = selected.length === 0 ? placeholder : `${placeholder} (${selected.length})`;
  }

  function render() {
    menu.innerHTML = "";
    if (options.length === 0) {
      menu.innerHTML = '<p class="muted" style="margin:8px 16px;">Keine Optionen</p>';
      return;
    }
    options.forEach((opt) => {
      const label = document.createElement("label");
      label.className = "checkbox-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = opt.label;
      cb.checked = selected.includes(opt.label);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          selected.push(opt.label);
        } else {
          selected = selected.filter((s) => s !== opt.label);
        }
        updateToggleLabel();
        onChange();
      });
      label.appendChild(cb);
      label.append(" " + opt.label);
      menu.appendChild(label);
    });
  }

  async function refreshOptions() {
    options = await TagsApi.list(kind);
    render();
  }

  toggle.addEventListener("click", (evt) => {
    evt.stopPropagation();
    menu.classList.toggle("hidden");
  });
  document.addEventListener("click", (evt) => {
    if (!widget.contains(evt.target)) {
      menu.classList.add("hidden");
    }
  });

  return {
    getSelected: () => [...selected],
    clear: () => {
      selected = [];
      updateToggleLabel();
      render();
    },
    refreshOptions,
  };
}

const themeFilter = buildFilterMultiselect({
  widgetId: "filter-theme-widget",
  toggleId: "filter-theme-toggle",
  menuId: "filter-theme-menu",
  kind: "theme",
  placeholder: "Alle",
  onChange: () => {
    wireExportButtons();
    refreshList();
  },
});
const sourceFilter = buildFilterMultiselect({
  widgetId: "filter-source-widget",
  toggleId: "filter-source-toggle",
  menuId: "filter-source-menu",
  kind: "source",
  placeholder: "Alle",
  onChange: () => {
    wireExportButtons();
    refreshList();
  },
});
const locationFilter = buildFilterMultiselect({
  widgetId: "filter-location-widget",
  toggleId: "filter-location-toggle",
  menuId: "filter-location-menu",
  kind: "location",
  placeholder: "Alle",
  onChange: () => {
    wireExportButtons();
    refreshList();
  },
});

function showStatus(message, type) {
  els.status.textContent = message;
  els.status.className = `status ${type}`;
  els.status.classList.remove("hidden");
}

function clearStatus() {
  els.status.classList.add("hidden");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE");
}

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function openHistoryModal(isbn) {
  currentHistoryIsbn = isbn;
  els.historyIsbnDisplay.textContent = isbn;
  els.historyModalOverlay.classList.remove("hidden");
  await renderHistoryModalList();
}

function closeHistoryModal() {
  currentHistoryIsbn = null;
  els.historyModalOverlay.classList.add("hidden");
}

async function renderHistoryModalList(editingId = null) {
  if (!currentHistoryIsbn) return;
  els.historyModalList.innerHTML = '<p class="muted">Wird geladen …</p>';
  const entries = await Api.getHistory(currentHistoryIsbn);
  if (entries.length === 0) {
    els.historyModalList.innerHTML = '<p class="muted">Noch keine Änderungen aufgezeichnet.</p>';
    return;
  }

  els.historyModalList.innerHTML = "";
  entries.forEach((entry) => {
    if (editingId === entry.id) {
      const form = document.createElement("div");
      form.className = "tag-add-form";

      const fieldInput = document.createElement("input");
      fieldInput.type = "text";
      fieldInput.placeholder = "Feld";
      fieldInput.value = entry.field;

      const oldInput = document.createElement("input");
      oldInput.type = "text";
      oldInput.placeholder = "Alter Wert";
      oldInput.value = entry.old_value || "";

      const newInput = document.createElement("input");
      newInput.type = "text";
      newInput.placeholder = "Neuer Wert";
      newInput.value = entry.new_value || "";

      const dateInput = document.createElement("input");
      dateInput.type = "datetime-local";
      dateInput.value = toDatetimeLocalValue(entry.changed_at);

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "secondary";
      saveBtn.textContent = "Speichern";
      saveBtn.addEventListener("click", async () => {
        try {
          await Api.updateHistoryEntry(currentHistoryIsbn, entry.id, {
            field: fieldInput.value.trim() || entry.field,
            old_value: oldInput.value || null,
            new_value: newInput.value || null,
            changed_at: dateInput.value ? new Date(dateInput.value).toISOString() : entry.changed_at,
          });
          await renderHistoryModalList();
        } catch (err) {
          await AppDialogs.alert(err.message);
        }
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "secondary";
      cancelBtn.textContent = "Abbrechen";
      cancelBtn.addEventListener("click", () => renderHistoryModalList());

      form.appendChild(fieldInput);
      form.appendChild(oldInput);
      form.appendChild(newInput);
      form.appendChild(dateInput);
      form.appendChild(saveBtn);
      form.appendChild(cancelBtn);
      els.historyModalList.appendChild(form);
      return;
    }

    const oldText = entry.old_value ? escapeHtml(entry.old_value) : "<em>leer</em>";
    const newText = entry.new_value ? escapeHtml(entry.new_value) : "<em>leer</em>";
    const row = document.createElement("div");
    row.className = "history-entry";
    row.innerHTML = `
      <div class="history-date">${formatDate(entry.changed_at)}
        <span class="tag-rename" title="Bearbeiten">✎</span>
        <span class="tag-remove" title="Löschen">×</span>
      </div>
      <strong>${escapeHtml(entry.field)}</strong> geändert: ${oldText} → ${newText}`;
    row.querySelector(".tag-rename").addEventListener("click", () => renderHistoryModalList(entry.id));
    row.querySelector(".tag-remove").addEventListener("click", async () => {
      if (!(await AppDialogs.confirm("Diesen Änderungseintrag wirklich löschen?"))) return;
      try {
        await Api.deleteHistoryEntry(currentHistoryIsbn, entry.id);
        await renderHistoryModalList();
      } catch (err) {
        await AppDialogs.alert(err.message);
      }
    });
    els.historyModalList.appendChild(row);
  });
}

els.btnHistoryClose.addEventListener("click", closeHistoryModal);
els.btnHistoryCloseX.addEventListener("click", closeHistoryModal);
els.historyModalOverlay.addEventListener("click", (evt) => {
  if (evt.target === els.historyModalOverlay) closeHistoryModal();
});

function formatDueDate(isoDate) {
  if (!isoDate) return "";
  const formatted = new Date(isoDate + "T00:00:00").toLocaleDateString("de-DE");
  const isOverdue = isoDate < new Date().toISOString().slice(0, 10);
  return isOverdue ? `<span class="badge">${formatted}</span>` : formatted;
}

function rowCalendarLinkHtml(isbn) {
  return ` <a href="/api/books/${encodeURIComponent(isbn)}/calendar.ics" class="row-calendar-link" title="Im Kalender speichern" download>📅</a>`;
}

async function populateFilterOptions() {
  const [locations, sources, themes] = await Promise.all([
    TagsApi.list("location"),
    TagsApi.list("source"),
    TagsApi.list("theme"),
  ]);

  await Promise.all([
    locationFilter.refreshOptions(),
    sourceFilter.refreshOptions(),
    themeFilter.refreshOptions(),
  ]);

  sourceColors = Object.fromEntries(sources.map((t) => [t.label, t.color]));
  locationColors = Object.fromEntries(locations.map((t) => [t.label, t.color]));
  themeColors = Object.fromEntries(themes.map((t) => [t.label, t.color]));
}

function openCoverLightbox(src) {
  els.coverLightboxImg.src = src;
  els.coverLightboxOverlay.classList.remove("hidden");
}

function closeCoverLightbox() {
  els.coverLightboxOverlay.classList.add("hidden");
  els.coverLightboxImg.src = "";
}

els.coverLightboxOverlay.addEventListener("click", (evt) => {
  if (evt.target === els.coverLightboxOverlay) closeCoverLightbox();
});
els.btnCoverLightboxCloseX.addEventListener("click", closeCoverLightbox);

function coverThumbHtml(book) {
  const src = book.cover_image || book.cover_url;
  if (!src) return "";
  return `<img class="cover-thumb" src="${escapeHtml(src)}" alt="Cover" loading="lazy" />`;
}

function renderChips(values, colorMap) {
  if (!values || values.length === 0) return "";
  return values
    .map((v) => {
      const color = colorMap[v] || "#eee";
      return `<span class="table-chip" style="background:${color}" title="${escapeHtml(v)}">${escapeHtml(v)}</span>`;
    })
    .join("");
}

function updateBulkBar() {
  const count = selectedIsbns.size;
  els.bulkBar.classList.toggle("hidden", count === 0);
  els.bulkCount.textContent = String(count);
  els.selectAll.checked = count > 0 && lastListedIsbns.every((isbn) => selectedIsbns.has(isbn));
}

function compareValues(a, b) {
  if (a === null || a === undefined || a === "") return b === null || b === undefined || b === "" ? 0 : 1;
  if (b === null || b === undefined || b === "") return -1;
  return String(a).localeCompare(String(b), "de");
}

function sortValueFor(book, key) {
  if (key === "themes") return (book.themes || []).slice().sort().join(", ");
  return book[key];
}

function isExampleBook(book) {
  return !!(book.title && book.title.startsWith(EXAMPLE_TITLE_PREFIX));
}

function pinExamplesToTop(items) {
  const examples = items.filter(isExampleBook);
  const rest = items.filter((b) => !isExampleBook(b));
  return [...examples, ...rest];
}

function applySort(items) {
  if (!sortState.key) return pinExamplesToTop(items.slice());
  const sorted = items.slice();
  sorted.sort((a, b) => compareValues(sortValueFor(a, sortState.key), sortValueFor(b, sortState.key)));
  if (sortState.dir === "desc") sorted.reverse();
  return pinExamplesToTop(sorted);
}

function updateSortIndicators() {
  document.querySelectorAll("th.sortable").forEach((th) => {
    const arrow = th.querySelector(".sort-arrow");
    if (!arrow) return;
    if (th.dataset.sortKey === sortState.key) {
      arrow.textContent = sortState.dir === "asc" ? "▲" : "▼";
    } else {
      arrow.textContent = "⇅";
    }
  });
}

function wireSortHeaders() {
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (sortState.key === key) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState.key = key;
        sortState.dir = "asc";
      }
      renderTable();
    });
  });
  updateSortIndicators();
}

function renderTable() {
  updateSortIndicators();
  const sortedItems = applySort(lastItems);

  els.tableBody.innerHTML = sortedItems
    .map(
      (book, index) => `
      <tr data-isbn="${escapeHtml(book.isbn)}" class="${isExampleBook(book) ? "example-row" : ""}">
        <td class="row-select-cell"><input type="checkbox" class="row-select" ${selectedIsbns.has(book.isbn) ? "checked" : ""} /></td>
        <td class="muted col-nr">${index + 1}</td>
        <td>${coverThumbHtml(book)}</td>
        <td>${escapeHtml(book.isbn)}</td>
        <td>${escapeHtml(book.title)}${book.metadata_fetched ? "" : ' <span class="badge">nicht angereichert</span>'}</td>
        <td>${escapeHtml(book.author)}</td>
        <td>${renderChips(book.themes, themeColors)}</td>
        <td>${renderChips(book.source ? [book.source] : [], sourceColors)}</td>
        <td>${renderChips(book.location ? [book.location] : [], locationColors)}</td>
        <td class="notes-cell" title="${escapeHtml(book.notes || "")}">${escapeHtml(book.notes)}</td>
        <td>${formatDueDate(book.due_date)}${book.due_date ? rowCalendarLinkHtml(book.isbn) : ""}</td>
        <td><button type="button" class="secondary btn-history" title="Änderungsverlauf">📜</button></td>
      </tr>`
    )
    .join("");

  els.tableBody.querySelectorAll("tr").forEach((row) => {
    const isbn = row.dataset.isbn;
    row.querySelector(".row-select").addEventListener("click", (evt) => {
      evt.stopPropagation();
      if (evt.target.checked) selectedIsbns.add(isbn);
      else selectedIsbns.delete(isbn);
      updateBulkBar();
    });
    row.querySelector(".btn-history").addEventListener("click", (evt) => {
      evt.stopPropagation();
      openHistoryModal(isbn);
    });
    const coverImg = row.querySelector(".cover-thumb");
    if (coverImg) {
      coverImg.addEventListener("click", (evt) => {
        evt.stopPropagation();
        openCoverLightbox(coverImg.src);
      });
    }
    const calLink = row.querySelector(".row-calendar-link");
    if (calLink) {
      calLink.addEventListener("click", (evt) => evt.stopPropagation());
    }
    row.addEventListener("click", () => openEdit(isbn));
  });

  updateBulkBar();
}

async function refreshList() {
  try {
    const data = await Api.listBooks(currentFilters());
    els.totalCount.textContent = `${data.total} Bücher insgesamt`;
    lastItems = data.items;
    lastListedIsbns = data.items.map((b) => b.isbn);
    renderTable();
  } catch (err) {
    showStatus("Katalog konnte nicht geladen werden: " + err.message, "danger");
  }
}

els.selectAll.addEventListener("change", () => {
  const rows = Array.from(els.tableBody.querySelectorAll("tr"));
  if (els.selectAll.checked) {
    rows.forEach((row) => selectedIsbns.add(row.dataset.isbn));
  } else {
    rows.forEach((row) => selectedIsbns.delete(row.dataset.isbn));
  }
  rows.forEach((row) => {
    row.querySelector(".row-select").checked = selectedIsbns.has(row.dataset.isbn);
  });
  updateBulkBar();
});

els.btnBulkClear.addEventListener("click", () => {
  selectedIsbns.clear();
  refreshList();
});

els.btnBulkDelete.addEventListener("click", async () => {
  const isbns = [...selectedIsbns];
  if (isbns.length === 0) return;
  if (!(await AppDialogs.confirm(`${isbns.length} Bücher wirklich löschen?`))) return;
  try {
    await Api.bulkDelete(isbns);
    showStatus(`${isbns.length} Bücher gelöscht.`, "success");
    selectedIsbns.clear();
    refreshList();
  } catch (err) {
    showStatus("Fehler beim Löschen: " + err.message, "danger");
  }
});

els.btnBulkDueDate.addEventListener("click", () => {
  els.bulkDueDatePickerEl.classList.remove("hidden");
  els.btnBulkDueDateApply.classList.remove("hidden");
});

els.btnBulkDueDateApply.addEventListener("click", async () => {
  const isbns = [...selectedIsbns];
  const dueDate = els.bulkDueDateInput.value;
  if (isbns.length === 0 || !dueDate) return;
  try {
    await Api.bulkDueDate(isbns, dueDate);
    showStatus(`Rückgabedatum für ${isbns.length} Bücher gesetzt.`, "success");
    await Api.downloadBatchCalendar(isbns, "rueckgabe-auswahl.ics");
    els.bulkDueDatePickerEl.classList.add("hidden");
    els.btnBulkDueDateApply.classList.add("hidden");
    bulkDueDatePicker.clear();
    refreshList();
  } catch (err) {
    showStatus("Fehler beim Setzen des Rückgabedatums: " + err.message, "danger");
  }
});

function setCoverPreview(imgEl, book) {
  const src = book.cover_image || book.cover_url;
  if (src) {
    imgEl.src = src;
    imgEl.classList.remove("hidden");
  } else {
    imgEl.classList.add("hidden");
  }
  if (imgEl === els.editCoverPreview) {
    els.btnEditRemovePhoto.classList.toggle("hidden", !src);
  }
}

async function openEdit(isbn) {
  const result = await Api.getBook(isbn);
  if (!result.found) {
    showStatus("Buch nicht gefunden.", "danger");
    return;
  }
  const book = result.book;
  currentEditIsbn = book.isbn;
  currentEditMetadataFetched = book.metadata_fetched;
  currentEditCoverUrl = book.cover_url;
  currentEditCoverImage = book.cover_image;
  currentEditSavedDueDate = book.due_date || null;

  els.editIsbn.textContent = book.isbn;
  els.editMetaInfo.textContent = `Erfasst am: ${formatDate(book.created_at)} · Aktualisiert am: ${formatDate(book.updated_at)}`;
  setCoverPreview(els.editCoverPreview, book);
  els.editTitle.value = book.title || "";
  els.editAuthor.value = book.author || "";
  els.editPublisher.value = book.publisher || "";
  els.editYear.value = book.published_year || "";
  els.editSource.value = book.source || "";
  els.editLocation.value = book.location || "";
  els.editTheme.value = (book.themes || []).join(",");
  els.editNotes.value = book.notes || "";
  editDueDatePicker.setValue(book.due_date || null);

  editSourceTagPicker.refresh();
  editLocationTagPicker.refresh();
  editThemeTagPicker.refresh();
  updateEditCalendarLink();

  els.editModalOverlay.classList.remove("hidden");
}

function closeEdit() {
  currentEditIsbn = null;
  els.editModalOverlay.classList.add("hidden");
  populateFilterOptions();
}

els.editModalOverlay.addEventListener("click", (evt) => {
  if (evt.target === els.editModalOverlay) closeEdit();
});
els.btnEditCloseX.addEventListener("click", closeEdit);

function updateEditCalendarLink() {
  els.editAddToCalendar.classList.toggle("hidden", !els.editDueDate.value);
}

els.editDueDate.addEventListener("change", updateEditCalendarLink);

function buildEditPayload() {
  const themes = els.editTheme.value ? els.editTheme.value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return {
    title: els.editTitle.value || null,
    author: els.editAuthor.value || null,
    publisher: els.editPublisher.value || null,
    published_year: els.editYear.value || null,
    cover_url: currentEditCoverUrl,
    cover_image: currentEditCoverImage,
    source: els.editSource.value || null,
    location: els.editLocation.value || null,
    themes,
    notes: els.editNotes.value || null,
    due_date: els.editDueDate.value || null,
    metadata_fetched: currentEditMetadataFetched,
  };
}

els.editAddToCalendar.addEventListener("click", async () => {
  if (!els.editDueDate.value || !currentEditIsbn) return;
  try {
    if (els.editDueDate.value !== currentEditSavedDueDate) {
      await Api.saveBook(currentEditIsbn, buildEditPayload());
      currentEditSavedDueDate = els.editDueDate.value;
      showStatus("Zwischengespeichert.", "success");
    }
    Api.downloadSingleCalendar(currentEditIsbn);
  } catch (err) {
    showStatus("Kalendereintrag konnte nicht erstellt werden: " + err.message, "danger");
  }
});

async function handleEditCoverFile(file) {
  if (!file || !currentEditIsbn) return;
  try {
    const result = await Api.uploadCover(currentEditIsbn, file);
    currentEditCoverImage = result.cover_image;
    setCoverPreview(els.editCoverPreview, { cover_image: currentEditCoverImage, cover_url: currentEditCoverUrl });
    showStatus("Foto hochgeladen. Zum Übernehmen bitte speichern.", "success");
  } catch (err) {
    showStatus("Foto-Upload fehlgeschlagen: " + err.message, "danger");
  }
}

els.btnEditTakePhoto.addEventListener("click", () => openCameraCapture(handleEditCoverFile));

els.btnEditChoosePhoto.addEventListener("click", () => els.editCoverFileInputLibrary.click());
els.editCoverFileInputLibrary.addEventListener("change", () =>
  handleEditCoverFile(els.editCoverFileInputLibrary.files[0])
);

els.btnEditRemovePhoto.addEventListener("click", async () => {
  if (!(await AppDialogs.confirm("Cover wirklich entfernen?"))) return;
  currentEditCoverImage = null;
  currentEditCoverUrl = null;
  setCoverPreview(els.editCoverPreview, { cover_image: null, cover_url: null });
  showStatus("Cover entfernt. Zum Übernehmen bitte speichern.", "success");
});

els.btnEditSave.addEventListener("click", async () => {
  if (!currentEditIsbn) return;
  try {
    await Api.saveBook(currentEditIsbn, buildEditPayload());
    showStatus("Aktualisiert.", "success");
    closeEdit();
    refreshList();
  } catch (err) {
    showStatus("Fehler beim Speichern: " + err.message, "danger");
  }
});

els.btnEditDelete.addEventListener("click", async () => {
  if (!currentEditIsbn) return;
  if (!(await AppDialogs.confirm(`Buch ${currentEditIsbn} wirklich löschen?`))) return;
  try {
    await Api.deleteBook(currentEditIsbn);
    showStatus("Gelöscht.", "success");
    closeEdit();
    refreshList();
  } catch (err) {
    showStatus("Fehler beim Löschen: " + err.message, "danger");
  }
});

els.btnEditCancel.addEventListener("click", closeEdit);
els.btnRefresh.addEventListener("click", () => {
  clearStatus();
  populateFilterOptions();
  refreshList();
});

function wireExportButtons() {
  els.exportBackup.href = Api.exportBackupUrl();
}

els.btnImport.addEventListener("click", () => els.importFileInput.click());
els.importFileInput.addEventListener("change", async () => {
  const file = els.importFileInput.files[0];
  els.importFileInput.value = "";
  if (!file) return;
  if (
    !(await AppDialogs.confirm(
      "Import führt zur Zusammenführung mit den vorhandenen Daten: Bücher mit gleicher ISBN werden durch die Backup-Version überschrieben. Fortfahren?"
    ))
  )
    return;
  try {
    const result = await Api.importBackup(file);
    showStatus(
      `Import abgeschlossen: ${result.books} Bücher, ${result.tags} Tags, ${result.history} Verlaufseinträge, ${result.covers} Cover.`,
      "success"
    );
    populateFilterOptions();
    refreshList();
  } catch (err) {
    showStatus("Import fehlgeschlagen: " + err.message, "danger");
  }
});

function exportFilename(format) {
  const ext = format === "excel" ? "xlsx" : format === "word" ? "docx" : "pdf";
  return `Bibliothek-Export.${ext}`;
}

let exportDialogIsbns = null;

function openExportDialog(isbns) {
  exportDialogIsbns = isbns;
  els.exportColumnsList.innerHTML = "";
  EXPORT_COLUMNS.forEach((col) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = col.key;
    cb.checked = col.defaultChecked !== false;
    label.appendChild(cb);
    label.append(" " + col.label);
    els.exportColumnsList.appendChild(label);
  });
  els.exportModalOverlay.classList.remove("hidden");
}

function closeExportDialog() {
  els.exportModalOverlay.classList.add("hidden");
}

els.btnExportOpen.addEventListener("click", () => openExportDialog(null));
els.btnBulkExportOpen.addEventListener("click", () => {
  const isbns = [...selectedIsbns];
  if (isbns.length === 0) return;
  openExportDialog(isbns);
});
els.btnExportModalCloseX.addEventListener("click", closeExportDialog);
els.btnExportCancel.addEventListener("click", closeExportDialog);
els.exportModalOverlay.addEventListener("click", (evt) => {
  if (evt.target === els.exportModalOverlay) closeExportDialog();
});

els.btnExportColumnsAll.addEventListener("click", () => {
  els.exportColumnsList.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = true));
});
els.btnExportColumnsInvert.addEventListener("click", () => {
  els.exportColumnsList.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = !cb.checked));
});

els.btnExportConfirm.addEventListener("click", async () => {
  const columns = Array.from(els.exportColumnsList.querySelectorAll('input[type="checkbox"]:checked')).map(
    (cb) => cb.value
  );
  if (columns.length === 0) {
    await AppDialogs.alert("Bitte mindestens eine Spalte auswählen.");
    return;
  }
  const format = els.exportModalOverlay.querySelector('input[name="export-format"]:checked').value;
  try {
    if (exportDialogIsbns) {
      await Api.downloadSelectedExport(format, exportDialogIsbns, exportFilename(format), columns);
    } else {
      Api.downloadExport(format, { ...currentFilters(), columns });
    }
    closeExportDialog();
  } catch (err) {
    showStatus("Export fehlgeschlagen: " + err.message, "danger");
  }
});

let searchDebounceTimer = null;
els.search.addEventListener("input", () => {
  wireExportButtons();
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(refreshList, 300);
});
els.search.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(searchDebounceTimer);
    refreshList();
  }
});
els.btnClearFilters.addEventListener("click", () => {
  els.search.value = "";
  themeFilter.clear();
  sourceFilter.clear();
  locationFilter.clear();
  wireExportButtons();
  refreshList();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshList();
});

wireExportButtons();
wireSortHeaders();
populateFilterOptions().then(refreshList);
