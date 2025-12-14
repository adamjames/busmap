import { DEBOUNCE_MS, MIN_ZOOM_FOR_FETCH } from './config.js';
import { getIsLoading, setLoading, showError, showInfoPopup, logApi, updateLastUpdate } from './ui.js';
import { loadCapScript, isCapPending, checkFrontendCapRequired, showCapModal, resetCapTime, getSessionToken } from './captcha.js';
import { initMap, getMap, renderVehicles, isAnimating, setCurrentBounds, setCurrentZoom, getCurrentZoom } from './map.js';
import { initRouting } from './routing.js';
import { initAircraft, toggleAircraft, isAircraftEnabled, setAircraftEnabled } from './aircraft.js';

let debounceTimer = null;
let refreshInterval = null;

let lastFetch = { time: 0, key: null };

const getQuantizedBounds = (map, config) => {
    const size = config.tile_size_degrees;
    const quantize = (val) => Math.floor(val / size) * size;
    const bounds = map.getBounds();

    return {
        west: +quantize(bounds.getWest()).toFixed(6),
        south: +quantize(bounds.getSouth()).toFixed(6),
        east: +(quantize(bounds.getEast()) + size).toFixed(6),
        north: +(quantize(bounds.getNorth()) + size).toFixed(6)
    };
};

const getBoundsKey = (b) => `${b.west.toFixed(6)},${b.south.toFixed(6)},${b.east.toFixed(6)},${b.north.toFixed(6)}`;

let scenicMode = false;
const SCENIC_REFRESH_MS = 20000;

const getRefreshInterval = (config) => {
    return scenicMode ? SCENIC_REFRESH_MS : config.refresh_interval_ms;
};

const toggleScenic = (config) => {
    scenicMode = !scenicMode;
    //document.getElementById('scenic-btn').textContent = scenicMode ? 'Fast Mode': 'Scenic Mode';
    startAutoRefresh(config);
};

const updateBuses = async (config, force = false) => {
    const map = getMap();

    if (getIsLoading() || document.hidden || isCapPending() || isAnimating()) return;

    if (checkFrontendCapRequired(config)) {
        logApi(`CAPTCHA required`, 'skipped');
        await showCapModal(config);
        resetCapTime();
    }

    const zoom = getCurrentZoom();
    if (zoom < MIN_ZOOM_FOR_FETCH) {
        updateLastUpdate('Zoom in to update');
        logApi(`Skipped: zoom ${zoom} < ${MIN_ZOOM_FOR_FETCH}`, 'skipped');
        return;
    }

    const qBounds = getQuantizedBounds(map, config);
    const boundsKey = getBoundsKey(qBounds);
    const now = Date.now();
    const ttl = zoom >= config.realtime_zoom_threshold ? config.realtime_cache_ttl_ms : config.cache_ttl_ms;

    if (!force && lastFetch.key === boundsKey && (now - lastFetch.time) < ttl) {
        logApi(`Cache hit (${Math.round((now - lastFetch.time) / 1000)}s old)`, 'skipped');
        return;
    }

    setLoading(true);

    try {
        const params = new URLSearchParams({
            west: qBounds.west.toFixed(6),
            south: qBounds.south.toFixed(6),
            east: qBounds.east.toFixed(6),
            north: qBounds.north.toFixed(6)
        });

        logApi(`→ Request viewport`, 'request');
        const start = Date.now();
        const headers = {};
        const token = getSessionToken();
        if (token) {
            headers['X-Session-Token'] = token;
        }

        const response = await fetch(`/api/buses?${params}`, { headers });
        if (response.status === 403) {
            const data = await response.json();
            if (data.cap_required) {
                logApi(`CAPTCHA required (${data.reason})`, 'skipped');
                setLoading(false);
                await showCapModal(config, data.reason);
                resetCapTime();
                updateBuses(config, force);
                return;
            }
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.rate_remaining !== null) {
           document.getElementById('rate-remaining').textContent = `${data.rate_remaining}`;
        }

        if (data.vehicles.length > 500 && data.vehicles.length < 1000) {
            showInfoPopup(`Woah, cool! ${data.vehicles.length} buses!`, () => {});
        }

        if (data.vehicles.length < 500 && scenicMode) { scenicMode = false; logApi("! Fast Refresh enabled")};
        if (data.vehicles.length > 1000 && !scenicMode) { scenicMode = true; logApi("! Scenic Mode enabled (20s background refresh)")};

        const elapsed = Date.now() - start;
        lastFetch = { time: Date.now(), key: boundsKey };

        renderVehicles(data.vehicles, map.getBounds());

        updateLastUpdate(`Updated ${new Date().toLocaleTimeString()}`);
        const capInfo = data.cap_threshold ? ` [srv:${data.vehicle_count}/${data.cap_threshold}]` : '';
        logApi(`← ${data.vehicles.length} vehicles${capInfo} (${elapsed}ms)`, 'response');
    } catch (error) {
        console.error('Error:', error);
        showError(`Failed to load: ${error.message}`);
        logApi(`Error: ${error.message}`);
    } finally {
        setLoading(false);
    }
};

const debouncedUpdate = (config) => {
    const map = getMap();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateBuses(config), DEBOUNCE_MS);
};

const startAutoRefresh = (config) => {
    stopAutoRefresh();
    refreshInterval = setInterval(() => updateBuses(config), getRefreshInterval(config));
};

const stopAutoRefresh = () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
};

export const init = (config) => {
    const map = initMap(config);
    initRouting(config);
    initAircraft(config);

    let userMarker = null;
    let followMode = false;
    let orientMode = false;
    let watchId = null;
    let orientationWatchId = null;

    const updateUserLocation = (position) => {
        const userLatLng = [position.coords.latitude, position.coords.longitude];
        
        if (!userMarker) {
            userMarker = L.marker(userLatLng, {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '<div style="width:16px;height:16px;background:#4285f4;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(0,0,0,0.3)"></div>',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                })
            }).addTo(map);
        } else {
            userMarker.setLatLng(userLatLng);
        }
        
        if (followMode) {
            map.setView(userLatLng, map.getZoom());
        }
    };

    const handleOrientation = (event) => {
        if (!orientMode) return;
        
        let heading = event.alpha;
        if (event.webkitCompassHeading) {
            heading = event.webkitCompassHeading;
        }
        
        if (heading !== null) {
            map.setBearing(-heading);
        }
    };

    const startOrientMode = () => {
        orientMode = true;
        
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
                        window.addEventListener('deviceorientation', handleOrientation, true);
                    }
                })
                .catch(console.error);
        } else {
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            window.addEventListener('deviceorientation', handleOrientation, true);
        }
    };

    const stopOrientMode = () => {
        orientMode = false;
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
        map.setBearing(0);
    };

    const startFollowMode = () => {
        followMode = true;
        map.dragging.disable();
        watchId = navigator.geolocation.watchPosition(
            updateUserLocation,
            (error) => console.error('Location error:', error),
            { enableHighAccuracy: true, maximumAge: 5 }
        );
    };

    const stopFollowMode = () => {
        followMode = false;
        map.dragging.enable();
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
    };

    document.getElementById('find-me-btn')?.addEventListener('click', () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updateUserLocation(position);
                map.setView([position.coords.latitude, position.coords.longitude], map.getZoom());
                setCurrentZoom(math.floor(map.getZoom()));
            },
            (error) => console.error('Location error:', error),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 5 }
        );
    });

    document.getElementById('follow-toggle')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            startFollowMode();
        } else {
            stopFollowMode();
        }
    });

    document.getElementById('orient-toggle')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            startOrientMode();
        } else {
            stopOrientMode();
        }
    });

    const updateVisibility = () => {
        const busesActive = getCurrentZoom() >= MIN_ZOOM_FOR_FETCH;
        setAircraftEnabled(!busesActive);
    };

    ['moveend', 'zoomend'].forEach(evt => {
        map.on(evt, () => {
           setCurrentBounds(map.getBounds());
           setCurrentZoom(Math.floor(map.getZoom()));
           debouncedUpdate(config);
           updateVisibility();
        });
    });

    ['movestart', 'zoomstart'].forEach(evt => {
        map.on(evt, () => {
            stopAutoRefresh();
        });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            updateBuses(config);
            startAutoRefresh(config);
        }
    });

    document.getElementById('welcome-dismiss')?.addEventListener('click', () => {
        document.getElementById('welcome-modal').style.display = 'none';
        loadCapScript(config);
         setCurrentBounds(map.getBounds());
         setCurrentZoom(Math.floor(map.getZoom()));
         debouncedUpdate(config);
         updateVisibility();
    });

    document.getElementById('refresh-btn')?.addEventListener('click', () => updateBuses(config));
    document.getElementById('scenic-btn')?.addEventListener('click', () => toggleScenic(config));
    document.getElementById('force-fetch-btn')?.addEventListener('click', () => updateBuses(config, true));

    document.getElementById('top-panel-minimize')?.addEventListener('click', () => {
        const panel = document.querySelector('.info-panel');
        const btn = document.getElementById('top-panel-minimize');
        panel.classList.toggle('minimized');
        btn.textContent = panel.classList.contains('minimized') ? '+' : '−';
    });

    document.getElementById('log-minimize')?.addEventListener('click', () => {
        const panel = document.querySelector('.log-panel');
        const btn = document.getElementById('log-minimize');
        panel.classList.toggle('minimized');
        btn.textContent = panel.classList.contains('minimized') ? '+' : '−';
    });

    document.getElementById('whats-new-btn')?.addEventListener('click', () => {
      document.getElementById('whats-new-modal').style.display = 'flex';
    });

    document.getElementById('whats-new-dismiss')?.addEventListener('click', () => {
      document.getElementById('whats-new-modal').style.display = 'none';
    });

    const logPanel = document.querySelector('.log-panel');
    logPanel?.addEventListener('touchmove', (e) => {
       const entries = document.getElementById('log-entries');
       if (!entries.contains(e.target) || entries.scrollHeight <= entries.clientHeight) {
        e.preventDefault();
       }
    }, { passive: false });
};
