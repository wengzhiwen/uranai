#!/usr/bin/env python3
"""占卜应用启动入口"""

import os
from pathlib import Path

# gevent monkey-patch MUST be first
import gevent.monkey
gevent.monkey.patch_all()

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent / ".env")

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 9529))
    app.run(port=port, debug=True)
