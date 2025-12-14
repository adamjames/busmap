from __future__ import annotations

import logging
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from .app import create_app
from .config import DEFAULT_HOST, DEFAULT_PORT, Config
from .tracker import BusTracker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _env_int(key: str, default: int) -> int:
    return int(os.environ.get(key, default))


def main() -> None:
    api_key = os.environ.get("BUS_API_KEY")
    if not api_key:
        logger.error("BUS_API_KEY environment variable not set")
        print("\nUsage:")
        print("  export BUS_API_KEY=your_api_key_here")
        print("  python -m bus_tracker")
        sys.exit(1)

    config = Config()
    tracker = BusTracker(api_key, config)
    app = create_app(tracker, config)

    debug = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true")
    host = os.environ.get("HOST", DEFAULT_HOST)
    port = _env_int("PORT", DEFAULT_PORT)

    logger.info(f"Starting Bus Tracker on http://{host}:{port}")
    app.run(debug=debug, host=host, port=port, threaded=True)


if __name__ == "__main__":
    main()
