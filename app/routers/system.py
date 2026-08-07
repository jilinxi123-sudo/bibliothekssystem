import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/system", tags=["system"])

EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def _find_edge() -> Optional[str]:
    found = shutil.which("msedge") or shutil.which("msedge.exe")
    if found:
        return found
    for candidate in EDGE_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    return None


@router.post("/open-permissions-helper")
def open_permissions_helper():
    """Startet ein normales (nicht App-Modus) Edge-Fenster im selben isolierten Profil
    wie das Haupt-App-Fenster, damit Website-Berechtigungen (z. B. Kamera) verwaltet
    werden koennen - das App-Fenster selbst hat dafuer keine Adressleiste.

    Funktioniert nur, wenn Server und Browser auf demselben Rechner laufen (bei Zugriff
    per Handy/Tablet oeffnet sich das Fenster auf dem Server-PC, nicht auf dem Handy).
    """
    edge_path = _find_edge()
    if not edge_path:
        raise HTTPException(status_code=404, detail="Microsoft Edge wurde auf diesem Rechner nicht gefunden.")

    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        raise HTTPException(status_code=500, detail="LOCALAPPDATA-Umgebungsvariable nicht gefunden.")
    profile_dir = Path(local_app_data) / "Bibliothekssystem" / "EdgeApp"

    subprocess.Popen([edge_path, f"--user-data-dir={profile_dir}"])
    return {"ok": True}
