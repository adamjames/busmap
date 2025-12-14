from __future__ import annotations

import logging
import threading

import requests
import time

import secrets
import hashlib
from datetime import datetime, timezone

from .config import Config

logger = logging.getLogger(__name__)

class RateLimitExceeded(Exception):
    pass

class CaptchaManager:
    def __init__(self, config: Config):
        self.config = config
        self._vehicle_count = 0
        self._lock = threading.Lock()
        self._tokens: dict[str, datetime] = {}
        self._token_ttl = 3600  # 1 hour
        self._secret = secrets.token_hex(32)

    def generate_token(self) -> str:
        token = secrets.token_urlsafe(32)
        with self._lock:
            self._tokens[token] = datetime.now(timezone.utc)
            self._cleanup_tokens()
        return token

    def validate_token(self, token: str) -> bool:
        if not token:
            return False
        with self._lock:
            issued = self._tokens.get(token)
            if not issued:
                return False
            age = (datetime.now(timezone.utc) - issued).total_seconds()
            return age < self._token_ttl

    def invalidate_token(self, token: str) -> None:
        with self._lock:
           self._tokens.pop(token, None)

    def _cleanup_tokens(self) -> None:
        now = datetime.now(timezone.utc)
        expired = [t for t, issued in self._tokens.items() 
                   if (now - issued).total_seconds() >= self._token_ttl]
        for t in expired:
            del self._tokens[t]

    @property
    def enabled(self) -> bool:
        return bool(self.config.cap_key_id)

    @property
    def threshold(self) -> int:
        return self.config.cap_challenge_interval

    def get_vehicle_count(self) -> int:
        with self._lock:
            return self._vehicle_count

    def add_vehicles(self, count: int) -> int:
        with self._lock:
            self._vehicle_count += count
            return self._vehicle_count

    def check_required(self) -> bool:
        if not self.enabled:
            return False
        with self._lock:
            return self._vehicle_count >= self.threshold

    def reset_count(self) -> None:
        with self._lock:
            self._vehicle_count = 0
            logger.info("Cap verified, counter reset")

    def verify_token(self, token: str) -> dict:
        if not self.enabled:
            return {"success": True, "message": "Cap not enabled"}

        try:
            verify_url = f"{self.config.cap_url}/{self.config.cap_key_id}/siteverify"
            resp = requests.post(
                verify_url,
                json={"secret": self.config.cap_key_secret, "response": token},
                timeout=10,
            )
            result = resp.json()
            if result.get("success"):
                self.reset_count()
            return result
        except Exception as e:
            logger.error(f"Cap verification failed: {e}")
            return {"success": False, "error": str(e)}

class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int = 3600):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: list[float] = []
        self._lock = threading.Lock()

    def check(self) -> bool:
        now = time.time()
        with self._lock:
            self._requests = [t for t in self._requests if now - t < self.window_seconds]
            if len(self._requests) >= self.max_requests:
                return False
            self._requests.append(now)
            return True

    def remaining(self) -> int:
        now = time.time()
        with self._lock:
            self._requests = [t for t in self._requests if now - t < self.window_seconds]
            return max(0, self.max_requests - len(self._requests))

