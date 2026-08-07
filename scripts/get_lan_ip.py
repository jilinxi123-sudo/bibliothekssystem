import socket
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
PORT = 8000


def get_lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main() -> None:
    ip = get_lan_ip()
    url = f"https://{ip}:{PORT}"

    print("=" * 50)
    print(f"Auf diesem PC:      https://localhost:{PORT}")
    print(f"Für andere Geräte:  {url}")
    print("=" * 50)

    try:
        import qrcode

        qr_path = BASE_DIR / "app" / "static" / "qr.png"
        qr_path.parent.mkdir(parents=True, exist_ok=True)
        qrcode.make(url).save(qr_path)
        print(f"QR-Code gespeichert unter: {qr_path}")
    except Exception as exc:
        print(f"QR-Code konnte nicht erzeugt werden: {exc}")


if __name__ == "__main__":
    main()
