import { logApi } from './ui.js';
import { tileCache, pendingTiles, getTileBounds, evictOldTiles } from './cache.js';
import { updateCacheVis } from './cache-vis.js';
import { getMap } from './map.js';

export const fetchTile = async (tile) => {
    const map = getMap();
    const bounds = getTileBounds(tile.x, tile.y);
    const params = new URLSearchParams({
        west: bounds.west,
        south: bounds.south,
        east: bounds.east,
        north: bounds.north
    });

    pendingTiles.add(tile.key);
    updateCacheVis(map);

    logApi(`→ Request tile ${tile.x},${tile.y}`, 'request');
    const start = Date.now();

    try {
        const response = await fetch(`/api/buses?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const elapsed = Date.now() - start;

        if (data.cap_required) {
            const err = new Error('CAP_REQUIRED');
            err.capData = data;
            throw err;
        }

        tileCache.set(tile.key, {
            vehicles: data.vehicles,
            timestamp: Date.now()
        });
        evictOldTiles();

        const capInfo = data.cap_threshold ? ` (${data.vehicle_count}/${data.cap_threshold})` : '';
        logApi(`← Response: ${data.vehicles.length} vehicles${capInfo} (${elapsed}ms)`, 'response');

        return { count: data.vehicles.length, vehicleCount: data.vehicle_count, capThreshold: data.cap_threshold };
    } finally {
        pendingTiles.delete(tile.key);
        updateCacheVis(map);
    }
};
