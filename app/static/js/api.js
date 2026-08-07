const Api = {
  async getBook(isbn) {
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(isbn)}`);
      if (res.status === 404) return { found: false };
      if (!res.ok) return { found: false, error: true };
      return { found: true, book: await res.json() };
    } catch (e) {
      return { found: false, error: true, offline: true };
    }
  },

  async lookup(isbn) {
    try {
      const res = await fetch(`/api/lookup/${encodeURIComponent(isbn)}`);
      if (!res.ok) return { found: false, reason: "network_error" };
      return await res.json();
    } catch (e) {
      return { found: false, reason: "network_error" };
    }
  },

  async saveBook(isbn, payload) {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Speichern fehlgeschlagen (${res.status})`);
    return await res.json();
  },

  async deleteBook(isbn) {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`Löschen fehlgeschlagen (${res.status})`);
  },

  async listBooks(params) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((v) => query.append(key, v));
      } else {
        query.set(key, value);
      }
    });
    const res = await fetch(`/api/books?${query.toString()}`);
    if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
    return await res.json();
  },

  exportUrl(format, params) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((v) => query.append(key, v));
      } else {
        query.set(key, value);
      }
    });
    return `/api/export/${format}?${query.toString()}`;
  },

  downloadExport(format, params) {
    const link = document.createElement("a");
    link.href = this.exportUrl(format, params);
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  async bulkDelete(isbns) {
    const res = await fetch("/api/books/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbns }),
    });
    if (!res.ok) throw new Error(`Löschen fehlgeschlagen (${res.status})`);
    return await res.json();
  },

  async bulkDueDate(isbns, dueDate) {
    const res = await fetch("/api/books/bulk-due-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbns, due_date: dueDate }),
    });
    if (!res.ok) throw new Error(`Aktualisieren fehlgeschlagen (${res.status})`);
    return await res.json();
  },

  async uploadCover(isbn, file) {
    const formData = new FormData();
    formData.append("file", file, file.name || "cover.jpg");
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}/cover`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`Foto konnte nicht hochgeladen werden (${res.status})`);
    return await res.json();
  },

  downloadSingleCalendar(isbn) {
    const link = document.createElement("a");
    link.href = `/api/books/${encodeURIComponent(isbn)}/calendar.ics`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  async getHistory(isbn) {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}/history`);
    if (!res.ok) return [];
    return await res.json();
  },

  async updateHistoryEntry(isbn, id, payload) {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}/history/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Speichern fehlgeschlagen (${res.status})`);
    return await res.json();
  },

  async deleteHistoryEntry(isbn, id) {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}/history/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Löschen fehlgeschlagen (${res.status})`);
  },

  exportBackupUrl() {
    return "/api/backup/export";
  },

  async importBackup(file) {
    const formData = new FormData();
    formData.append("file", file, file.name || "backup.zip");
    const res = await fetch("/api/backup/import", { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Import fehlgeschlagen (${res.status})`);
    }
    return await res.json();
  },

  async downloadSelectedExport(format, isbns, filename, columns) {
    const res = await fetch(`/api/export/selected/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbns, columns }),
    });
    if (!res.ok) throw new Error(`Export fehlgeschlagen (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  async downloadBatchCalendar(isbns, filename) {
    const res = await fetch("/api/calendar/batch.ics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbns }),
    });
    if (!res.ok) throw new Error(`Kalenderdatei konnte nicht erstellt werden (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
