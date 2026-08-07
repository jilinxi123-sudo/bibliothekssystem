import asyncio
import sys
from pathlib import Path

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uvicorn

BASE_DIR = Path(__file__).resolve().parent.parent

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        ssl_keyfile=str(BASE_DIR / "certs" / "key.pem"),
        ssl_certfile=str(BASE_DIR / "certs" / "cert.pem"),
    )
