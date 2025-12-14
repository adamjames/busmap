from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass(frozen=True)
class Vehicle:
    vehicle_id: str
    latitude: float
    longitude: float
    line: str
    operator: str
    destination: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "vehicle_id": self.vehicle_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "line": self.line,
            "operator": self.operator,
            "destination": self.destination,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class CacheEntry:
    timestamp: datetime
    vehicles: list[Vehicle]

    def is_fresh(self, ttl_seconds: int) -> bool:
        age = (datetime.now(timezone.utc) - self.timestamp).total_seconds()
        return age < ttl_seconds
