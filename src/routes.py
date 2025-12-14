from __future__ import annotations

import os
import requests
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from flask import Blueprint, current_app, jsonify, render_template, request

if TYPE_CHECKING:
    from .captcha import CaptchaManager
    from .config import Config
    from .tracker import BusTracker

bp = Blueprint("main", __name__)


def get_tracker() -> BusTracker:
    return current_app.config["tracker"]


def get_captcha() -> CaptchaManager:
    return current_app.config["captcha"]


def get_config() -> Config:
    return current_app.config["app_config"]


@bp.route("/")
def index():
    config = get_config()
    captcha = get_captcha()
    cap_public_url = os.environ.get("CAP_PUBLIC_URL", "http://localhost:3000")

    return render_template(
        "index.html",
        config={
            "center_lat": config.center_lat,
            "center_lon": config.center_lon,
            "refresh_interval_ms": config.refresh_interval_ms,
            "initial_zoom": config.initial_zoom,
            "cluster_radius": config.cluster_radius,
            "cluster_disable_at_zoom": config.cluster_disable_at_zoom,
            "allow_override": config.allow_override,
            "cache_ttl_ms": config.client_cache_ttl_ms,
            "tile_size_degrees": config.tile_size_degrees,
            "realtime_cache_ttl_ms": config.realtime_cache_ttl_ms,
            "realtime_zoom_threshold": config.realtime_zoom_threshold,
            "osrm_url": config.osrm_url,
            "routing_zoom_threshold": config.routing_zoom_threshold,
            "max_requests_per_hour": config.max_requests_per_hour,
            "cap_enabled": captcha.enabled,
            "cap_frontend_interval_ms": config.cap_frontend_interval_ms,
            "cap_challenge_interval": config.cap_challenge_interval,
            "cap_api_endpoint": f"{cap_public_url}/{config.cap_key_id}/" if captcha.enabled else "",
            "cap_assets_url": cap_public_url,
            "aircraft_url": config.aircraft_url,
            "aircraft_refresh_ms": config.aircraft_refresh_ms,
        },
    )


@bp.route("/health")
def health():
    tracker = get_tracker()
    if tracker is None:
        return jsonify({"status": "degraded", "reason": "tracker not initialized"}), 503
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **tracker.get_stats(),
    })

@bp.route("/api/aircraft")
def get_aircraft():
    config = current_app.config["app_config"]
    
    if not config.aircraft_url:
        return jsonify({"error": "Aircraft not configured"}), 404
    
    try:
        resp = requests.get(config.aircraft_url, timeout=10)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/aircraft/routes", methods=["POST"])
def get_aircraft_routes():
    config = current_app.config["app_config"]
    
    if not config.aircraft_route_url:
        return jsonify({"error": "Aircraft routes not configured"}), 404
    
    try:
        resp = requests.post(
            config.aircraft_route_url,
            json=request.get_json(),
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/api/buses")
def get_buses():
    from .captcha import RateLimitExceeded

    tracker = current_app.config["tracker"]
    captcha = current_app.config["captcha"]
    config = current_app.config["app_config"]
    rate_limiter = current_app.config["rate_limiter"]

    if captcha.enabled:
        session_token = request.headers.get("X-Session-Token")

        # Must have valid session
        if not captcha.validate_token(session_token):
            return jsonify({"cap_required": True, "reason": "session"}), 403

        # Heavy usage triggers re-verification
        if captcha.check_required():
            captcha.invalidate_token(session_token)
            return jsonify({
                "cap_required": True,
                "reason": "usage",
                "vehicle_count": captcha.get_vehicle_count()
            }), 403

    try:
        west = float(request.args.get("west", 0))
        south = float(request.args.get("south", 0))
        east = float(request.args.get("east", 0))
        north = float(request.args.get("north", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid bounds"}), 400

    bounds = (west, south, east, north)

    try:
        vehicles = tracker.get_bus_data(bounds, rate_limiter=rate_limiter, captcha=captcha)
    except RateLimitExceeded:
        return jsonify({"error": "Rate limit exceeded", "retry_after": 3600}), 429

    return jsonify({
       "vehicles": vehicles,
       "vehicle_count": captcha.get_vehicle_count() if captcha.enabled else 0,
       "cap_threshold": config.cap_challenge_interval if captcha.enabled else None,
       "rate_remaining": rate_limiter.remaining() if rate_limiter else None,
       "rate_limit": config.max_requests_per_hour
    })

@bp.route("/api/route")
def get_route():
    config = current_app.config["app_config"]

    if not config.osrm_url:
        return jsonify({"error": "Routing not configured"}), 404

    start = request.args.get("start")
    end = request.args.get("end")

    if not start or not end:
        return jsonify({"error": "Missing start or end"}), 400

    try:
        url = f"{config.osrm_url}/route/v1/driving/{start};{end}?geometries=geojson"
        resp = requests.get(url, timeout=5)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/api/cap/verify", methods=["POST"])
def verify_cap():
    captcha = current_app.config["captcha"]
    data = request.get_json()
    token = data.get("token", "")

    result = captcha.verify_token(token)

    if result.get("success"):
        session_token = captcha.generate_token()
        return jsonify({"success": True, "session_token": session_token})

    return jsonify(result)
