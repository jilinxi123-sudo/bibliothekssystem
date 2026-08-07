const AppDialogs = (() => {
  function buildOverlay(maxWidth) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.style.maxWidth = maxWidth;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    return { overlay, dialog };
  }

  function buildMessage(dialog, message) {
    const text = document.createElement("p");
    text.style.marginTop = "0";
    text.style.whiteSpace = "pre-line";
    text.textContent = message;
    dialog.appendChild(text);
  }

  function confirmDialog(message) {
    return new Promise((resolve) => {
      const { overlay, dialog } = buildOverlay("420px");
      buildMessage(dialog, message);

      const row = document.createElement("div");
      row.className = "button-row";
      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.textContent = "OK";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "secondary";
      cancelBtn.textContent = "Abbrechen";
      row.appendChild(okBtn);
      row.appendChild(cancelBtn);
      dialog.appendChild(row);

      function cleanup(result) {
        overlay.remove();
        resolve(result);
      }
      okBtn.addEventListener("click", () => cleanup(true));
      cancelBtn.addEventListener("click", () => cleanup(false));
      overlay.addEventListener("click", (evt) => {
        if (evt.target === overlay) cleanup(false);
      });
      okBtn.focus();
    });
  }

  function alertDialog(message) {
    return new Promise((resolve) => {
      const { overlay, dialog } = buildOverlay("420px");
      buildMessage(dialog, message);

      const row = document.createElement("div");
      row.className = "button-row";
      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.textContent = "OK";
      row.appendChild(okBtn);
      dialog.appendChild(row);

      function cleanup() {
        overlay.remove();
        resolve();
      }
      okBtn.addEventListener("click", cleanup);
      overlay.addEventListener("click", (evt) => {
        if (evt.target === overlay) cleanup();
      });
      okBtn.focus();
    });
  }

  return { confirm: confirmDialog, alert: alertDialog };
})();
