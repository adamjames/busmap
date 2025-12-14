from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import defusedxml.ElementTree as ET
import requests

from .config import BBOX_CACHE_KEY_PRECISION, Config
from .models import CacheEntry, Vehicle

if TYPE_CHECKING:
    from xml.etree.ElementTree import Element

logger = logging.getLogger(__name__)


class BusTracker:
    SIRI_NS = {"siri": "http://www.siri.org.uk/siri"}

    def __init__(self, api_key: str, config: Config | None = None):
        self.api_key = api_key
        self.config = config or Config()
        self._cache: dict[str, CacheEntry] = {}
        self._lock = threading.Lock()
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "BusTracker/0.8 (+https://adamjames.me; contact: adam@<domain>)"
        })

    def get_stats(self) -> dict:
        with self._lock:
            return {
                "cache_entries": len(self._cache),
                "cache_max": self.config.cache_max_entries,
            }

    def _make_cache_key(self, bbox: tuple[float, float, float, float]) -> str:
        return ",".join(f"{x:.{BBOX_CACHE_KEY_PRECISION}f}" for x in bbox)

    def _evict_if_needed(self) -> None:
        while len(self._cache) > self.config.cache_max_entries:
            oldest_key = min(self._cache, key=lambda k: self._cache[k].timestamp)
            del self._cache[oldest_key]

    def get_bus_data(self, bounding_box: tuple[float, float, float, float], rate_limiter=None, captcha=None) -> list[dict]:
        cache_key = self._make_cache_key(bounding_box)

        with self._lock:
            entry = self._cache.get(cache_key)
            if entry and entry.is_fresh(self.config.cache_ttl_seconds):
                return [v.to_dict() for v in entry.vehicles]

        vehicles = self._fetch_vehicles(bounding_box, rate_limiter)

        if captcha:
            captcha.add_vehicles(len(vehicles))

        with self._lock:
            self._cache[cache_key] = CacheEntry(datetime.now(timezone.utc), vehicles)
            self._evict_if_needed()

        return [v.to_dict() for v in vehicles]

    def _fetch_vehicles(self, bounding_box: tuple[float, float, float, float], rate_limiter=None) -> list[Vehicle]:
        if rate_limiter and not rate_limiter.check():
            from .captcha import RateLimitExceeded
            raise RateLimitExceeded("Rate limit exceeded")

        url = f"{self.config.api_base}/datafeed"
        params = {
            "api_key": self.api_key,
            "boundingBox": ",".join(str(x) for x in bounding_box),
        }

        try:
            response = self._session.get(
                url, params=params, timeout=self.config.request_timeout
            )
            response.raise_for_status()
            vehicles = self._parse_siri_vm(response.text)
            logger.info(f"Fetched {len(vehicles)} vehicles")
            return vehicles
        except requests.Timeout:
            logger.warning("API request timed out")
            return []
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            return []

    def _parse_siri_vm(self, xml_content: str) -> list[Vehicle]:
        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError as e:
            logger.error(f"XML parse error: {e}")
            return []

        return [
            v
            for activity in root.findall(".//siri:VehicleActivity", self.SIRI_NS)
            if (v := self._parse_vehicle_activity(activity))
        ]

    def _parse_vehicle_activity(self, activity: Element) -> Vehicle | None:
        ns = self.SIRI_NS

        vehicle_ref = activity.find(".//siri:VehicleRef", ns)
        location = activity.find(".//siri:VehicleLocation", ns)
        if vehicle_ref is None or location is None:
            return None

        lat_elem = location.find("siri:Latitude", ns)
        lon_elem = location.find("siri:Longitude", ns)
        if not all(e is not None and e.text for e in (lat_elem, lon_elem)):
            return None

        def get_text(xpath: str, default: str = "Unknown") -> str:
            elem = activity.find(xpath, ns)
            return elem.text if elem is not None and elem.text else default

        try:
            return Vehicle(
                vehicle_id=vehicle_ref.text or "Unknown",
                latitude=float(lat_elem.text),
                longitude=float(lon_elem.text),
                line=get_text(".//siri:LineRef"),
                operator=get_text(".//siri:OperatorRef"),
                destination=get_text(".//siri:DestinationName"),
            )
        except ValueError as e:
            logger.warning(f"Invalid coordinate: {e}")
            return None
