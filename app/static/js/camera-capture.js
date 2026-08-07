function describeCameraError(err) {
  const name = err && err.name ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return (
      "Kamerazugriff wurde blockiert. Falls jetzt kein Erlauben-Popup erscheint, wurde die " +
      "Berechtigung zuvor schon verweigert. Auf der Scannen-Seite den Button " +
      "\"🔧 Kamera-Berechtigung verwalten\" klicken und der Anleitung dort folgen."
    );
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Keine Kamera gefunden.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Kamera wird bereits von einer anderen App verwendet.";
  }
  return String((err && err.message) || err);
}

async function openCameraCapture(onCapture) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";
  dialog.style.maxWidth = "480px";

  const heading = document.createElement("h2");
  heading.textContent = "Foto aufnehmen";
  heading.style.marginTop = "0";

  const video = document.createElement("video");
  video.setAttribute("playsinline", "");
  video.setAttribute("autoplay", "");
  video.muted = true;
  video.style.width = "100%";
  video.style.borderRadius = "12px";
  video.style.background = "#000";

  const hint = document.createElement("p");
  hint.className = "field-readonly";
  hint.textContent = "Buch gut sichtbar vor die Kamera halten und dann auf „Aufnehmen“ tippen.";

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const btnCapture = document.createElement("button");
  btnCapture.type = "button";
  btnCapture.textContent = "Aufnehmen";

  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.className = "secondary";
  btnCancel.textContent = "Abbrechen";

  buttonRow.appendChild(btnCapture);
  buttonRow.appendChild(btnCancel);
  dialog.appendChild(heading);
  dialog.appendChild(video);
  dialog.appendChild(hint);
  dialog.appendChild(buttonRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  let stream = null;

  function cleanup() {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    overlay.remove();
  }

  btnCancel.addEventListener("click", cleanup);
  overlay.addEventListener("click", (evt) => {
    if (evt.target === overlay) cleanup();
  });

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1600 },
        height: { ideal: 1600 },
      },
      audio: false,
    });
    video.srcObject = stream;
  } catch (err) {
    cleanup();
    await AppDialogs.alert("Kamera konnte nicht gestartet werden: " + describeCameraError(err));
    return;
  }

  btnCapture.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        cleanup();
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.9
    );
  });
}
