from __future__ import annotations

import os
from dataclasses import dataclass, field

# Map Display
# London Bridge
DEFAULT_CENTER_LAT = 51.5079
DEFAULT_CENTER_LON = -0.0877
DEFAULT_INITIAL_ZOOM = 16

# Server
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 5000
DEFAULT_REQUEST_TIMEOUT_SECONDS = 15
DEFAULT_CACHE_TTL_SECONDS = 300
DEFAULT_CACHE_MAX_ENTRIES = 500
BBOX_CACHE_KEY_PRECISION = 2

# OSRM
DEFAULT_OSRM_URL = ""
DEFAULT_ROUTING_ZOOM_THRESHOLD = 17

# Client
DEFAULT_REFRESH_INTERVAL_MS = 30000
DEFAULT_CLIENT_CACHE_TTL_MS = 3000
DEFAULT_REALTIME_CACHE_TTL_MS = 300;
DEFAULT_REALTIME_ZOOM_THRESHOLD = 16
DEFAULT_TILE_SIZE_DEGREES = 0.1

# Clustering
DEFAULT_CLUSTER_RADIUS = 40
DEFAULT_CLUSTER_DISABLE_ZOOM = 17

# Rate Limiting & CAPTCHA
DEFAULT_MAX_REQUESTS_PER_HOUR = 300
DEFAULT_CAP_CHALLENGE_INTERVAL = 5000
DEFAULT_CAP_FRONTEND_INTERVAL_MS = 600000

# PiCraft Integration
DEFAULT_AIRCRAFT_URL = ""
DEFAULT_AIRCRAFT_ROUTE_URL= ""
DEFAULT_AIRCRAFT_REFRESH_MS = 5000

def _env_int(key: str, default: int) -> int:
    val = os.environ.get(key)
    return int(val) if val else default


def _env_float(key: str, default: float) -> float:
    val = os.environ.get(key)
    return float(val) if val else default


@dataclass
class Config:
    # Map Display
    center_lat: float = field(
        default_factory=lambda: _env_float("MAP_CENTER_LAT", DEFAULT_CENTER_LAT)
    )
    center_lon: float = field(
        default_factory=lambda: _env_float("MAP_CENTER_LON", DEFAULT_CENTER_LON)
    )
    initial_zoom: int = field(
        default_factory=lambda: _env_int("MAP_INITIAL_ZOOM", DEFAULT_INITIAL_ZOOM)
    )

    # Server
    host: str = field(
        default_factory=lambda: os.environ.get("HOST", DEFAULT_HOST)
    )
    port: int = field(
        default_factory=lambda: _env_int("PORT", DEFAULT_PORT)
    )
    api_base: str = field(
        default_factory=lambda: os.environ.get(
            "BUS_API_BASE", "https://data.bus-data.dft.gov.uk/api/v1"
        )
    )
    request_timeout: int = field(
        default_factory=lambda: _env_int("REQUEST_TIMEOUT", DEFAULT_REQUEST_TIMEOUT_SECONDS)
    )
    cache_ttl_seconds: int = field(
        default_factory=lambda: _env_int("CACHE_TTL", DEFAULT_CACHE_TTL_SECONDS)
    )
    cache_max_entries: int = field(
        default_factory=lambda: _env_int("CACHE_MAX", DEFAULT_CACHE_MAX_ENTRIES)
    )

    # OSRM
    osrm_url: str = field(
        default_factory=lambda: os.environ.get("OSRM_URL", DEFAULT_OSRM_URL)
    )
    routing_zoom_threshold: int = field(
        default_factory=lambda: _env_int("ROUTING_ZOOM_THRESHOLD", DEFAULT_ROUTING_ZOOM_THRESHOLD)
    )

    # Client
    refresh_interval_ms: int = field(
        default_factory=lambda: _env_int("REFRESH_INTERVAL_MS", DEFAULT_REFRESH_INTERVAL_MS)
    )
    client_cache_ttl_ms: int = field(
        default_factory=lambda: _env_int("CLIENT_CACHE_TTL_MS", DEFAULT_CLIENT_CACHE_TTL_MS)
    )
    realtime_cache_ttl_ms: int = field(
        default_factory=lambda: _env_int("REALTIME_CACHE_TTL_MS", DEFAULT_REALTIME_CACHE_TTL_MS)
    )
    realtime_zoom_threshold: int = field(
        default_factory=lambda: _env_int("REALTIME_ZOOM_THRESHOLD", DEFAULT_REALTIME_ZOOM_THRESHOLD)
    )
    tile_size_degrees: float = field(
        default_factory=lambda: _env_float("TILE_SIZE_DEGREES", DEFAULT_TILE_SIZE_DEGREES)
    )
    allow_override: bool = field(
        default_factory=lambda: os.environ.get("ALLOW_OVERRIDE", "").lower() in ("1", "true")
    )

    # Clustering
    cluster_radius: int = field(
        default_factory=lambda: _env_int("CLUSTER_RADIUS", DEFAULT_CLUSTER_RADIUS)
    )
    cluster_disable_at_zoom: int = field(
        default_factory=lambda: _env_int("CLUSTER_DISABLE_ZOOM", DEFAULT_CLUSTER_DISABLE_ZOOM)
    )

    # Rate Limiting & CAPTCHA
    max_requests_per_hour: int = field(
        default_factory=lambda: _env_int("MAX_REQUESTS_PER_HOUR", DEFAULT_MAX_REQUESTS_PER_HOUR)
    )
    cap_url: str = field(
        default_factory=lambda: os.environ.get("CAP_URL", "")
    )
    cap_public_url: str = field(
        default_factory=lambda: os.environ.get("CAP_PUBLIC_URL", "")
    )
    cap_key_id: str = field(
        default_factory=lambda: os.environ.get("CAP_KEY_ID", "")
    )
    cap_key_secret: str = field(
        default_factory=lambda: os.environ.get("CAP_KEY_SECRET", "")
    )
    cap_challenge_interval: int = field(
        default_factory=lambda: _env_int("CAP_CHALLENGE_INTERVAL", DEFAULT_CAP_CHALLENGE_INTERVAL)
    )
    cap_frontend_interval_ms: int = field(
        default_factory=lambda: _env_int("CAP_FRONTEND_INTERVAL_MS", DEFAULT_CAP_FRONTEND_INTERVAL_MS)
    )

    # PiCraft Integration
    aircraft_url: str = field(
        default_factory=lambda: os.environ.get("AIRCRAFT_URL", "")
    )
    aircraft_route_url: str = field(
        default_factory=lambda: os.environ.get("AIRCRAFT_ROUTE_URL", "")
    )
    aircraft_refresh_ms: int = field(
        default_factory=lambda: _env_int("AIRCRAFT_REFRESH_MS", DEFAULT_AIRCRAFT_REFRESH_MS)
    )
