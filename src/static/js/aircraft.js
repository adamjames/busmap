import { getMap, getCurrentBounds } from './map.js';

let aircraftLayer = null;
let routeLayer = null;
let aircraftMarkers = new Map();
let routeLines = new Map();
let routeCache = new Map();
let refreshInterval = null;
let isEnabled = false;
let config = null;

const TYPE_MAP = {
    A318: 'a318', A319: 'a319', A320: 'a320', A321: 'a321', A20N: 'a20n', A21N: 'a21n',
    A332: 'a332', A333: 'a333', A338: 'a338', A339: 'a339',
    A342: 'a340', A343: 'a340', A345: 'a340', A346: 'a340',
    A359: 'a350', A35K: 'a350',
    A380: 'a380', A388: 'a380',
    A220: 'a220', BCS1: 'a220', BCS3: 'a220',
    B712: 'b717',
    B731: 'b737', B732: 'b737', B733: 'b737', B734: 'b737', B735: 'b737',
    B736: 'b737', B737: 'b737', B738: 'b738', B739: 'b739',
    B37M: 'b737max', B38M: 'b737max', B39M: 'b737max', B3XM: 'b737max',
    B752: 'b757', B753: 'b757',
    B762: 'b767', B763: 'b767', B764: 'b767',
    B772: 'b777', B773: 'b777', B77L: 'b777', B77W: 'b777', B778: 'b777', B779: 'b777',
    B788: 'b787', B789: 'b787', B78X: 'b787',
    B744: 'b747', B748: 'b747',
    E135: 'e135_145', E145: 'e135_145',
    E170: 'e170_175', E175: 'e170_175',
    E190: 'e190_195', E195: 'e190_195', E290: 'e190_195', E295: 'e190_195',
    CRJ1: 'crj_series', CRJ2: 'crj_series', CRJ7: 'crj_series', CRJ9: 'crj_series', CRJX: 'crj_series',
    MD11: 'md11', MD80: 'md80', MD81: 'md80', MD82: 'md80', MD83: 'md80', MD87: 'md80', MD88: 'md80', MD90: 'md80',
    DC10: 'dc10',
    AT43: 'atr', AT45: 'atr', AT72: 'atr', AT75: 'atr', AT76: 'atr',
    DH8A: 'dash8', DH8B: 'dash8', DH8C: 'dash8', DH8D: 'dash8',
    SF34: 'sf34', J328: 'j328',
    C208: 'c208', C210: 'cessna', C172: 'cessna', C152: 'cessna', C150: 'cessna', C182: 'cessna', C206: 'cessna', C177: 'cessna',
    PA28: 'cessna', PA32: 'cessna', PA34: 'twin_small', PA44: 'twin_small', PA46: 'cessna', PA18: 'cessna', PA38: 'cessna',
    BE35: 'cessna', BE36: 'cessna', BE55: 'twin_small', BE58: 'twin_small', BE76: 'twin_small',
    BE20: 'twin_small', BE30: 'twin_small', BE9L: 'twin_small', B190: 'twin_large', B350: 'twin_small',
    DA20: 'cessna', DA40: 'cessna', DA42: 'twin_small', DA62: 'twin_small',
    SR20: 'sr20_22', SR22: 'sr20_22', S22T: 'sr20_22',
    PC12: 'pc12', PC24: 'pc24',
    TBM7: 'tbm', TBM8: 'tbm', TBM9: 'tbm',
    C525: 'citation', C550: 'citation', C560: 'citation', C56X: 'citation', C680: 'citation', C68A: 'citation', C700: 'citation',
    CL30: 'challenger', CL35: 'challenger', CL60: 'challenger',
    E35L: 'legacy', E50P: 'phenom', E55P: 'phenom',
    F900: 'falcon_tri', FA50: 'falcon_bi', FA7X: 'falcon_tri', FA8X: 'falcon_tri',
    G280: 'gulfstream', G550: 'gulfstream', G650: 'gulfstream', GLEX: 'global', GL5T: 'global', GL7T: 'global',
    GLF4: 'gulfstream', GLF5: 'gulfstream', GLF6: 'gulfstream',
    A109: 'helicopter', A119: 'helicopter', A139: 'helicopter', A169: 'helicopter',
    AS50: 'helicopter', AS55: 'helicopter', AS65: 'helicopter',
    B06: 'helicopter', B105: 'helicopter', B212: 'helicopter', B412: 'helicopter', B429: 'helicopter', B430: 'helicopter',
    EC20: 'helicopter', EC25: 'helicopter', EC30: 'helicopter', EC35: 'helicopter', EC45: 'helicopter', EC55: 'helicopter', EC75: 'helicopter',
    H125: 'helicopter', H130: 'helicopter', H135: 'helicopter', H145: 'helicopter', H155: 'helicopter', H160: 'helicopter', H175: 'helicopter', H215: 'helicopter', H225: 'helicopter',
    R22: 'helicopter', R44: 'helicopter', R66: 'helicopter',
    S76: 'helicopter', S92: 'helicopter',
    C130: 'c130', C17: 'c17', C5M: 'c5',
    A400: 'a400m',
    F16: 'f16', F15: 'f15', F18: 'f18', F35: 'f35',
    EUFI: 'eurofighter', RFAL: 'rafale', TOR: 'tornado',
    B1: 'b1', B2: 'b2', B52: 'b52',
    KC10: 'kc10', KC35: 'kc135', E3CF: 'e3',
    P8: 'p8', E6: 'e6',
    CONC: 'concorde',
    GLID: 'glider', ASK21: 'glider', DG1T: 'glider',
    BALL: 'balloon',
};

const CATEGORY_MAP = {
    A0: 'unknown',
    A1: 'cessna',
    A2: 'jet_swept',
    A3: 'jet_swept',
    A4: 'heavy_2e',
    A5: 'heavy_4e',
    A6: 'hi_perf',
    A7: 'helicopter',
    B1: 'glider',
    B2: 'balloon',
    B4: 'cessna',
    B6: 'uav',
    C1: 'ground_emergency',
    C2: 'ground_service',
    C3: 'ground_fixed',
};

const getShapeName = (type, category) => {
    if (type && TYPE_MAP[type]) {
        return TYPE_MAP[type];
    }
    if (category && CATEGORY_MAP[category]) {
        return CATEGORY_MAP[category];
    }
    return 'jet_swept';
};

const getAltitudeColor = (altitude) => {
    if (altitude == null || altitude === 'ground') return '#ffa500';
    
    const alt = typeof altitude === 'string' ? parseInt(altitude, 10) : altitude;
    if (isNaN(alt)) return '#ffa500';
    
    const stops = [
        { alt: 0,     r: 255, g: 255, b: 0   },
        { alt: 2000,  r: 128, g: 255, b: 0   },
        { alt: 10000, r: 0,   g: 255, b: 0   },
        { alt: 20000, r: 0,   g: 255, b: 255 },
        { alt: 30000, r: 0,   g: 128, b: 255 },
        { alt: 40000, r: 128, g: 0,   b: 255 },
        { alt: 50000, r: 255, g: 0,   b: 255 },
    ];
    
    if (alt <= stops[0].alt) return `rgb(${stops[0].r},${stops[0].g},${stops[0].b})`;
    if (alt >= stops[stops.length - 1].alt) {
        const s = stops[stops.length - 1];
        return `rgb(${s.r},${s.g},${s.b})`;
    }
    
    for (let i = 0; i < stops.length - 1; i++) {
        if (alt >= stops[i].alt && alt < stops[i + 1].alt) {
            const t = (alt - stops[i].alt) / (stops[i + 1].alt - stops[i].alt);
            const r = Math.round(stops[i].r + t * (stops[i + 1].r - stops[i].r));
            const g = Math.round(stops[i].g + t * (stops[i + 1].g - stops[i].g));
            const b = Math.round(stops[i].b + t * (stops[i + 1].b - stops[i].b));
            return `rgb(${r},${g},${b})`;
        }
    }
    
    return '#ffa500';
};

const createAircraftIcon = (heading = 0, altitude = null, type = null, category = null) => {
    const color = getAltitudeColor(altitude);
    const shapeName = getShapeName(type, category);
    const shape = shapes[shapeName] || shapes['jet_swept'];
    
    const w = shape.w || 32;
    const h = shape.h || 32;
    const viewBox = shape.viewBox || `0 0 ${w} ${h}`;
    const strokeScale = shape.strokeScale || 1;
    const strokeWidth = 0.7 * strokeScale;
    
    const vbParts = viewBox.split(' ').map(Number);
    const cx = vbParts[0] + vbParts[2] / 2;
    const cy = vbParts[1] + vbParts[3] / 2;
    
    let pathContent = '';
    if (Array.isArray(shape.path)) {
        pathContent = shape.path.map(p => `<path d="${p}"/>`).join('');
    } else {
        pathContent = `<path d="${shape.path}"/>`;
    }
    
    const scale = 40 / Math.max(w, h);
    const iconW = Math.round(w * scale);
    const iconH = Math.round(h * scale);
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${iconW}" height="${iconH}">
        <g transform="rotate(${heading}, ${cx}, ${cy})" fill="${color}" stroke="#000" stroke-width="${strokeWidth}">
            ${pathContent}
        </g>
    </svg>`;
    
    return L.divIcon({
        className: 'aircraft-icon',
        html: svg,
        iconSize: [iconW, iconH],
        iconAnchor: [iconW / 2, iconH / 2]
    });
};

const formatAircraftPopup = (ac, routeInfo = null) => {
    const callsign = ac.flight?.trim() || '—';
    const reg = ac.r || '—';
    const type = ac.t || '—';
    const desc = ac.desc || '';
    const operator = ac.ownOp || '';
    
    const alt = ac.alt_baro === 'ground' ? 'Ground' : 
                ac.alt_baro ? `${ac.alt_baro.toLocaleString()} ft` : '—';
    const speed = ac.gs ? `${Math.round(ac.gs)} kts` : '—';
    const vrate = ac.baro_rate ? `${ac.baro_rate > 0 ? '+' : ''}${ac.baro_rate.toLocaleString()} ft/m` : '';
    const heading = ac.track != null ? `${Math.round(ac.track)}°` : '—';
    const squawk = ac.squawk || '';
    
    let routeStr = '';
    if (routeInfo?._airport_codes_iata) {
        const [dep, arr] = routeInfo._airport_codes_iata.split('-');
        if (dep && dep != "unknown" && arr) {
            routeStr = `<div class="ac-route">${dep} → ${arr}</div>`;
        }
        else {
            routeStr = `<div class="ac-route">Private/Not Known</div>`;
        }
    }
    
    const squawkClass = squawk === '7700' ? 'squawk-emergency' : 
                        squawk === '7600' ? 'squawk-radio' :
                        squawk === '7500' ? 'squawk-hijack' : '';
    const squawkStr = squawk ? `<span class="ac-squawk ${squawkClass}">${squawk}</span>` : '';
    
    return `<div class="ac-popup">
        <div class="ac-header">
            <span class="ac-callsign">${callsign}</span>
            ${squawkStr}
        </div>
        <div class="ac-reg">${reg}${type !== '—' ? ` · ${type}` : ''}</div>
        ${desc ? `<div class="ac-desc">${desc}</div>` : ''}
        ${operator ? `<div class="ac-operator">${operator}</div>` : ''}
        ${routeStr}
        <table class="ac-data">
            <tr><td>Altitude</td><td>${alt}${vrate ? ` <span class="ac-vrate">${vrate}</span>` : ''}</td></tr>
            <tr><td>Speed</td><td>${speed}</td></tr>
            <tr><td>Heading</td><td>${heading}</td></tr>
        </table>
        <div class="ac-hex">${ac.hex.toUpperCase()}</div>
    </div>`
};

const fetchAircraft = async () => {
    try {
        const response = await fetch('/api/aircraft');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.aircraft || [];
    } catch (e) {
        console.warn('Aircraft fetch error:', e);
        return [];
    }
};

const fetchRoutes = async (aircraft) => {
    const planes = aircraft
        .filter(ac => ac.flight?.trim() && ac.lat && ac.lon)
        .filter(ac => !routeCache.has(ac.flight.trim()))
        .map(ac => ({
            callsign: ac.flight.trim(),
            lat: ac.lat,
            lng: ac.lon
        }));
    
    if (planes.length === 0) return;
    
    try {
        const response = await fetch('/api/aircraft/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planes })
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        for (const route of data) {
            if (route.callsign && route._airports) {
                routeCache.set(route.callsign, route);
            }
        }
    } catch (e) {
        console.warn('Route fetch error:', e);
    }
};

const drawRoute = (ac, routeInfo) => {
    return;
    const id = ac.hex;
    
    if (routeLines.has(id)) {
        routeLayer.removeLayer(routeLines.get(id));
        routeLines.delete(id);
    }
    
    if (!routeInfo?._airports || routeInfo._airports.length < 2) return;
    
    const coords = routeInfo._airports.map(a => [a.lat, a.lon]);
    
    const line = L.polyline(coords, {
        color: getAltitudeColor(ac.alt_baro),
        weight: 2,
        opacity: 0.6,
        dashArray: '5, 10'
    });
    
    routeLayer.addLayer(line);
    routeLines.set(id, line);
};

const renderAircraft = async () => {
    const map = getMap();
    if (!map || !aircraftLayer || !isEnabled) return;
    
    const bounds = map.getBounds();
    const aircraft = await fetchAircraft();
    const seen = new Set();
    
    const inViewAircraft = aircraft.filter(ac => ac.lat && ac.lon && bounds.contains([ac.lat, ac.lon]));
    await fetchRoutes(inViewAircraft);
    
    for (const ac of aircraft) {
        if (!ac.lat || !ac.lon) continue;
        
        const id = ac.hex;
        const callsign = ac.flight?.trim();
        seen.add(id);
        
        const inView = bounds.contains([ac.lat, ac.lon]);
        const existing = aircraftMarkers.get(id);
        const routeInfo = callsign ? routeCache.get(callsign) : null;
        
        if (inView) {
            const heading = ac.track || ac.true_heading || 0;
            const altitude = ac.alt_baro;
            const type = ac.t || null;
            const category = ac.category || null;
            
            if (existing) {
                existing.setLatLng([ac.lat, ac.lon]);
                existing.setIcon(createAircraftIcon(heading, altitude, type, category));
                existing.setPopupContent(formatAircraftPopup(ac, routeInfo));
            } else {
                const marker = L.marker([ac.lat, ac.lon], { 
                    icon: createAircraftIcon(heading, altitude, type, category),
                    zIndexOffset: 1000
                }).bindPopup(formatAircraftPopup(ac, routeInfo));
                
                marker.on('click', () => drawRoute(ac, routeInfo));
                
                aircraftLayer.addLayer(marker);
                aircraftMarkers.set(id, marker);
            }
        } else if (existing) {
            aircraftLayer.removeLayer(existing);
            aircraftMarkers.delete(id);
            
            if (routeLines.has(id)) {
                routeLayer.removeLayer(routeLines.get(id));
                routeLines.delete(id);
            }
        }
    }
    
    for (const [id, marker] of aircraftMarkers) {
        if (!seen.has(id)) {
            aircraftLayer.removeLayer(marker);
            aircraftMarkers.delete(id);
            
            if (routeLines.has(id)) {
                routeLayer.removeLayer(routeLines.get(id));
                routeLines.delete(id);
            }
        }
    }
};

const startRefresh = () => {
    stopRefresh();
    renderAircraft();
    refreshInterval = setInterval(renderAircraft, config.aircraft_refresh_ms);
};

const stopRefresh = () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
};

const clearLayers = () => {
    aircraftLayer.clearLayers();
    routeLayer.clearLayers();
    aircraftMarkers.clear();
    routeLines.clear();
};

export const setAircraftEnabled = (enabled) => {
    if (!config?.aircraft_url) return;
    
    isEnabled = enabled;
    if (enabled) {
        startRefresh();
    } else {
        stopRefresh();
        clearLayers();
    }
};

export const toggleAircraft = () => {
    if (!config?.aircraft_url) return false;
    
    setAircraftEnabled(!isEnabled);
    return isEnabled;
};

export const isAircraftEnabled = () => isEnabled;

export const initAircraft = (cfg) => {
    config = cfg;
    if (!config.aircraft_url) return;

    const map = getMap();
    routeLayer = L.layerGroup().addTo(map);
    aircraftLayer = L.layerGroup().addTo(map);
    
    document.addEventListener('visibilitychange', () => {
        if (!isEnabled) return;
        if (document.hidden) {
            stopRefresh();
        } else {
            startRefresh();
        }
    });
};
