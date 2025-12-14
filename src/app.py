from __future__ import annotations

import os
from pathlib import Path

from flask import Flask

from .captcha import CaptchaManager, RateLimiter
from .config import Config
from .routes import bp
from .tracker import BusTracker


def create_app(tracker: BusTracker | None = None, config: Config | None = None) -> Flask:
    config = config or Config()

    app = Flask(
        __name__,
        template_folder=Path(__file__).parent / "templates",
        static_folder=Path(__file__).parent / "static",
    )

    captcha = CaptchaManager(config)
    rate_limiter = RateLimiter(config.max_requests_per_hour)
    app.config["app_config"] = config
    app.config["captcha"] = captcha
    app.config["rate_limiter"] = rate_limiter
    app.config["tracker"] = tracker
    app.register_blueprint(bp)

    return app
