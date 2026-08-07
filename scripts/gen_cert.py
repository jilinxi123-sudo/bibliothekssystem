import ipaddress
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

sys.path.append(str(Path(__file__).resolve().parent))
from get_lan_ip import get_lan_ip  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent.parent
CERT_DIR = BASE_DIR / "certs"
CERT_PATH = CERT_DIR / "cert.pem"
KEY_PATH = CERT_DIR / "key.pem"
IP_MARKER_PATH = CERT_DIR / "ip.txt"


def _needs_regeneration(current_ip: str) -> bool:
    if not CERT_PATH.exists() or not KEY_PATH.exists() or not IP_MARKER_PATH.exists():
        return True
    return IP_MARKER_PATH.read_text().strip() != current_ip


def generate_certificate(ip: str) -> None:
    CERT_DIR.mkdir(parents=True, exist_ok=True)

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Bibliothekssystem")])

    san_entries = [x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
    if ip != "127.0.0.1":
        san_entries.append(x509.IPAddress(ipaddress.ip_address(ip)))

    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=3650))
        .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
        .sign(key, hashes.SHA256())
    )

    KEY_PATH.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    CERT_PATH.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    IP_MARKER_PATH.write_text(ip)


def main() -> None:
    ip = get_lan_ip()
    if _needs_regeneration(ip):
        print(f"Erzeuge neues Zertifikat für {ip} …")
        generate_certificate(ip)
        print("Zertifikat erstellt.")
    else:
        print("Vorhandenes Zertifikat ist aktuell.")


if __name__ == "__main__":
    main()
