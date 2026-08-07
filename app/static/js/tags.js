const TAG_COLOR_PALETTE = [
  "#F7B6C2", "#FBC99B", "#F5E28C", "#A8DFC9", "#A9D3EC", "#C9B6E4",
  "#F0A6B8", "#A3B4A2", "#92A8B8", "#B99CA3", "#C9B79C", "#B0A69A",
  "#FF8FA3", "#FFAB4C", "#FFDD57", "#7ED957", "#4FD9C7", "#6EC6FF",
  "#B583FF", "#FF6FB0",
];

const TagsApi = {
  async list(kind) {
    const res = await fetch(`/api/tags?kind=${encodeURIComponent(kind)}`);
    if (!res.ok) return [];
    return await res.json();
  },
  async create(kind, label, color) {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, label, color }),
    });
    if (!res.ok) throw new Error("Tag konnte nicht erstellt werden");
    return await res.json();
  },
  async update(id, label, color) {
    const res = await fetch(`/api/tags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, color }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Tag konnte nicht aktualisiert werden");
    }
    return await res.json();
  },
  async remove(id) {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
  },
};

function buildColorSwatchRow(selectedColor) {
  const row = document.createElement("div");
  row.className = "color-swatch-row";
  let currentColor = selectedColor || TAG_COLOR_PALETTE[0];

  TAG_COLOR_PALETTE.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.background = color;
    if (color === currentColor) swatch.classList.add("selected");
    swatch.addEventListener("click", () => {
      currentColor = color;
      row.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
      swatch.classList.add("selected");
    });
    row.appendChild(swatch);
  });

  return { element: row, getColor: () => currentColor };
}

function initTagPicker(containerId, kind, inputEl, options = {}) {
  const container = document.getElementById(containerId);
  const multi = !!options.multi;
  let editMode = false;
  let addFormOpen = false;
  let renamingTagId = null;

  // Eigene Werkzeugleiste UEBER der Tag-Box (zwischen Label und Chips): "+ Neu"/
  // "Bearbeiten" sind Werkzeuge zum Verwalten der Tags, keine Tags selbst - dezenter
  // und getrennt von den Chips. Bewusst oberhalb statt unterhalb platziert, damit sie
  // bei vielen Tags (z. B. 30) nicht erst nach dem Scrollen durch alle Chips erreichbar
  // sind, sondern immer direkt sichtbar bleiben.
  const toolbar = document.createElement("div");
  toolbar.className = "tag-picker-toolbar";
  container.insertAdjacentElement("beforebegin", toolbar);

  function selectedValues() {
    if (!multi) return inputEl.value.trim() ? [inputEl.value.trim()] : [];
    return inputEl.value ? inputEl.value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }

  function setSelectedValues(values) {
    inputEl.value = values.join(multi ? "," : "");
    inputEl.dispatchEvent(new Event("change"));
  }

  function buildInlineForm({ initialLabel = "", initialColor = "", onSubmit, submitLabel }) {
    const form = document.createElement("div");
    form.className = "tag-add-form";

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.placeholder = "Name";
    textInput.value = initialLabel;

    const swatches = buildColorSwatchRow(initialColor || TAG_COLOR_PALETTE[0]);

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "secondary";
    submitBtn.textContent = submitLabel;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "secondary";
    cancelBtn.textContent = "Abbrechen";

    submitBtn.addEventListener("click", async () => {
      const label = textInput.value.trim();
      if (!label) return;
      await onSubmit(label, swatches.getColor());
    });
    cancelBtn.addEventListener("click", () => {
      addFormOpen = false;
      renamingTagId = null;
      render();
    });

    form.appendChild(textInput);
    form.appendChild(swatches.element);
    form.appendChild(submitBtn);
    form.appendChild(cancelBtn);
    return form;
  }

  async function render() {
    const tags = await TagsApi.list(kind);
    const selected = selectedValues();
    container.innerHTML = "";
    toolbar.innerHTML = "";

    if (addFormOpen) {
      const form = buildInlineForm({
        submitLabel: "Hinzufügen",
        initialColor: TAG_COLOR_PALETTE[tags.length % TAG_COLOR_PALETTE.length],
        onSubmit: async (label, color) => {
          await TagsApi.create(kind, label, color);
          addFormOpen = false;
          render();
        },
      });
      toolbar.appendChild(form);
    } else {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "tag-toolbar-btn";
      addBtn.textContent = "+ Neu";
      addBtn.addEventListener("click", () => {
        addFormOpen = true;
        render();
      });
      toolbar.appendChild(addBtn);
    }

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "tag-toolbar-btn";
    editBtn.textContent = editMode ? "Fertig" : "Bearbeiten";
    editBtn.addEventListener("click", () => {
      editMode = !editMode;
      renamingTagId = null;
      render();
    });
    toolbar.appendChild(editBtn);

    // Ausgewaehlte Tags zuerst anzeigen, damit man sie sofort sieht; Reihenfolge
    // innerhalb der beiden Gruppen bleibt unveraendert (stabile Sortierung).
    const sortedTags = [...tags].sort((a, b) => {
      const aSel = selected.includes(a.label) ? 0 : 1;
      const bSel = selected.includes(b.label) ? 0 : 1;
      return aSel - bSel;
    });

    sortedTags.forEach((tag) => {
      if (renamingTagId === tag.id) {
        const form = buildInlineForm({
          initialLabel: tag.label,
          initialColor: tag.color,
          submitLabel: "Speichern",
          onSubmit: async (label, color) => {
            if (label !== tag.label) {
              if (
                !(await AppDialogs.confirm(
                  `Alle Bücher mit dem Tag "${tag.label}" werden auf "${label}" aktualisiert. Fortfahren?`
                ))
              )
                return;
            } else if (color !== tag.color) {
              if (
                !(await AppDialogs.confirm(
                  `Die Farbe des Tags "${tag.label}" wird bei allen Büchern mit diesem Tag geändert. Fortfahren?`
                ))
              )
                return;
            }
            try {
              await TagsApi.update(tag.id, label, color);
            } catch (err) {
              await AppDialogs.alert(err.message);
            }
            renamingTagId = null;
            render();
          },
        });
        container.appendChild(form);
        return;
      }

      const isSelected = selected.includes(tag.label);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      if (isSelected) {
        chip.classList.add("selected");
        chip.style.background = tag.color || "#eee";
        chip.style.borderColor = "transparent";
      } else {
        // Nicht ausgewaehlte Tags dezenter darstellen (nur Farbrahmen statt volle
        // Flaeche) - bei vielen Tags sonst zu unruhig/bunt.
        chip.style.background = "transparent";
        chip.style.borderColor = tag.color || "#ccc";
      }

      const text = document.createElement("span");
      text.textContent = tag.label;
      chip.appendChild(text);

      if (editMode) {
        const rename = document.createElement("span");
        rename.className = "tag-rename";
        rename.textContent = "✎";
        rename.title = "Tag bearbeiten";
        rename.addEventListener("click", (evt) => {
          evt.stopPropagation();
          renamingTagId = tag.id;
          render();
        });
        chip.appendChild(rename);

        const remove = document.createElement("span");
        remove.className = "tag-remove";
        remove.textContent = "×";
        remove.title = "Tag löschen";
        remove.addEventListener("click", async (evt) => {
          evt.stopPropagation();
          if (
            !(await AppDialogs.confirm(
              `Tag "${tag.label}" löschen? Es wird bei allen Büchern entfernt, die es verwenden.`
            ))
          )
            return;
          await TagsApi.remove(tag.id);
          render();
        });
        chip.appendChild(remove);
      } else {
        chip.addEventListener("click", () => {
          const current = selectedValues();
          if (multi) {
            const idx = current.indexOf(tag.label);
            if (idx >= 0) current.splice(idx, 1);
            else current.push(tag.label);
            setSelectedValues(current);
          } else {
            setSelectedValues(current[0] === tag.label ? [] : [tag.label]);
          }
          render();
        });
      }

      container.appendChild(chip);
    });
  }

  render();
  return { refresh: render };
}
