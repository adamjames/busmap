import { OPERATOR_COLORS, DEFAULT_OPERATOR_COLOR, ICON_SIZE, ICON_ANCHOR, BUS_ICON } from './config.js';
import { escapeHtml } from './ui.js';
import { getRoute, animateAlongRoute } from './routing.js';

let config = null;
let map = null;
let busMarkers = null;
let currentZoom = 0;
let currentBounds = null;

const vehicleData = new Map();
const visibleMarkers = new Map();
const lastUpdateTime = new Map();
const animatingIds = new Set();

export const getMap = () => map;

export const getCurrentBounds = () => currentBounds;

export const setCurrentBounds = (bounds) => {
    currentBounds = bounds;
};

export const setCurrentZoom = (zoom) => {
     currentZoom = zoom;
};

export const getCurrentZoom = () => currentZoom;

const UK_BOUNDS = [
    [47.5, -7.5],   // Southwest
    [61.0, 2.0]    // Northeast
];

export const initMap = (cfg) => {
    config = cfg;
    map = L.map('map', {
        rotate: true,
        rotateControl: {
           closeOnZeroBearing: false
        },
        maxBounds: UK_BOUNDS,
        maxBoundsViscosity: 0.8
    }).setView(
        [config.center_lat, config.center_lon],
        config.initial_zoom
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    busMarkers = L.markerClusterGroup({
        maxClusterRadius: config.cluster_radius,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: config.cluster_disable_at_zoom
    });

    map.addLayer(busMarkers);

    setCurrentZoom(Math.floor(map.getZoom()));
    setCurrentBounds(map.getBounds());

    return map;
};

const getOperatorColor = (operator) => {
    const key = (operator || '').substring(0, 4).toUpperCase();
    return OPERATOR_COLORS[key] || DEFAULT_OPERATOR_COLOR;
};

const createBusIcon = (operator) => L.divIcon({
    className: '',
    html: `<div class="bus-icon">${BUS_ICON}</div>`,
    iconSize: ICON_SIZE,
    iconAnchor: ICON_ANCHOR
});

const formatDestination = (dest) => {
    return (dest || 'Unknown').replace(/_+/g, ' ');
};

const formatPopup = (v) => `
    <div class="popup-header">
        <span class="popup-line">${escapeHtml(v.line)}</span>
        <span class="popup-operator">${escapeHtml(v.operator)}</span>
    </div>
    <div class="popup-dest">→ ${escapeHtml(formatDestination(v.destination))}</div>
    <div class="popup-details">
        Vehicle: ${escapeHtml(v.vehicle_id)}<br>
        Updated: ${new Date(v.timestamp).toLocaleTimeString()}
    </div>`;

export const isAnimating = () => {
    return animatingIds.size > 0;
};

export const renderVehicles = async (vehicles, bounds) => {
    try {
        const updatedIds = new Set();
        // Technically dont need vehicleData now - marker used
        for (const v of vehicles) {
            vehicleData.set(v.vehicle_id, v);
            updatedIds.add(v.vehicle_id);
        }

        for (const id of updatedIds) {
            const v = vehicleData.get(id);
            const inView = bounds.contains([v.latitude, v.longitude]);
            const marker = visibleMarkers.get(id);

            if (inView) {
                if (marker) {
                    const pos = marker.getLatLng()

                    // 0.0001 degrees is about 10 metres;
                    const moved = Math.abs(pos.lat - v.latitude) > 0.0001 || Math.abs(pos.lng - v.longitude) > 0.0001;
                    if (moved) {
                        const now = Date.now();
                        const lastTime = lastUpdateTime.get(id);
                        const duration = lastTime ? now - lastTime : 2000;
                        lastUpdateTime.set(id, now);

                        const distance = Math.sqrt(
                            Math.pow(pos.lat - v.latitude, 2) +
                            Math.pow(pos.lng - v.longitude, 2)
                        );

                        const useRouting = config.osrm_url &&
                            currentZoom >= config.routing_zoom_threshold &&
                            distance > 0.001; // 100m

                        animatingIds.add(id);

                        if (useRouting) {
                            const route = await getRoute(pos, [v.latitude, v.longitude]);
                            if (route && route.coords?.length > 1) {
                                const routedAnimDuration = Math.max(duration, route.duration);
                                animateAlongRoute(marker, route.coords, routedAnimDuration, () => { animatingIds.delete(id); });
                            } else {
                                const straightLine = [[pos.lng, pos.lat], [v.longitude, v.latitude]];
                                animateAlongRoute(marker, straightLine, duration, () => animatingIds.delete(id));
                            }
                        } else {
                            const straightLine = [[pos.lng, pos.lat], [v.longitude, v.latitude]];
                            animateAlongRoute(marker, straightLine, duration, () => animatingIds.delete(id));
                        }

                        marker.setPopupContent(formatPopup(v));
                    }
                } else {
                    const newMarker = L.marker([v.latitude, v.longitude], { icon: createBusIcon(v.operator) })
                        .bindPopup(formatPopup(v))
                    newMarker._animationPaused = false;

                    newMarker.on('mouseover', () => { newMarker._animationPaused = true; });
                    newMarker.on('mouseout', () => { newMarker._animationPaused = false; });

                    busMarkers.addLayer(newMarker);
                    visibleMarkers.set(id, newMarker);
                    lastUpdateTime.set(id, Date.now());
                }
            } else if (marker && !animatingIds.has(id)) {
                busMarkers.removeLayer(marker);
                visibleMarkers.delete(id);
            }
        }

        for (const [id, marker] of visibleMarkers) {
            if (!bounds.contains(marker.getLatLng()) && !animatingIds.has(id)) {
                busMarkers.removeLayer(marker);
                visibleMarkers.delete(id);
            }
        }
    } catch (e) {
        console.warn('renderVehicles error:', e);
    }

    document.getElementById('stats').textContent = visibleMarkers.size;
};
