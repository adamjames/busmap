import { getCurrentBounds, setCurrentBounds } from './map.js';

let config = null;
export const initRouting = (cfg) => {
    config = cfg;
};

export const getRoute = async (from, to) => {
    if (!config?.osrm_url) return null;

    try {
        const start = `${from.lng},${from.lat}`;
        const end = `${to[1]},${to[0]}`;
        const resp = await fetch(`/api/route?start=${start}&end=${end}`);
        const data = await resp.json();

        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
            return {
                coords: data.routes[0].geometry.coordinates,
                duration: data.routes[0].duration * 1000,
                distance: data.routes[0].distance,
                roadName: data.waypoints?.[1]?.name || null
            };
        }
    } catch (e) {
        console.warn('Routing failed:', e);
    }
    return null;
};

export const animateAlongRoute = (marker, coords, duration, onComplete) => {
    if (!marker) {
        if (onComplete) onComplete();
        return;
    }

    if (!coords || coords.length == 0) {
        if (onComplete) onComplete();
        return;
    }

    const validCoords = coords.filter(c => Array.isArray(c) &&
       c.length >= 2 && typeof c[0] === 'number'
                     && typeof c[1] === 'number');

    if (validCoords.length === 0) {
	if (onComplete) onComplete();
	return;
    }

    const pos = marker.getLatLng();
    if (validCoords.length === 1) {
        // Add the present position
        // so we can LERP normally.
        validCoords.unshift([pos.lng, pos.lat]);
    }

    const bounds = getCurrentBounds();
    const [finalLng, finalLat] = validCoords[validCoords.length - 1];

    if (bounds && !bounds.contains(pos)) {
        // Don't animate, just snap.
        marker.setLatLng([finalLat, finalLng]);
        if (onComplete) onComplete();
        return;
    }

    let startTime = null;
    const animation = (now) => {

        if (marker._animationPaused) {
           requestAnimationFrame(animation);
           return;
        }

        // The first frame.
        if (startTime === null) startTime = now;
        const progress = (now - startTime) / duration;

        // Eventually now - startTime exceeds duration, making progress >= 1...
        if (progress >= 1) {
            // We should be done, snap to the final position.
            marker.setLatLng([finalLat, finalLng]);
            if (onComplete) onComplete();
            return;
        }

        // If no longer in bounds, complete immediately
        const bounds = getCurrentBounds();
        if (bounds && !bounds.contains(marker.getLatLng())) {
            marker.setLatLng([finalLat, finalLng]);
            if (onComplete) onComplete();
            return;
        }

        // Otherwise, in progress, LERP.
        /// Linear interpolation between two points.
        const position = progress * (validCoords.length - 1);
        const markerPos = marker.getLatLng();
        const segmentIndex = Math.floor(position);

        // console.debug('Animation debug:', {
        //    position,
        //    segmentIndex,
        //    validCoordsLength: validCoords.length,
        //    c1: validCoords[segmentIndex],
        //    c2: validCoords[segmentIndex + 1]
        // });

        // segmentProgress: 0.0 = at A, 0.5 = halfway, 1.0 = at B
        const segmentProgress = position - segmentIndex;

        // Point A: (lat1, lng1)  ←── start of segment
        const [lng1, lat1] = validCoords[segmentIndex];
        // Point B: (lat2, lng2)  ←── end of segment
        const [lng2, lat2] = validCoords[segmentIndex + 1];

        // Formula: A + (B - A) * progress -- e.g.:
        // progress = 0.0  means  lat1 + (lat2 - lat1) * 0.0  =  lat1
        // progress = 0.5  means  lat1 + (lat2 - lat1) * 0.5  =  midpoint
        // progress = 1.0  means  lat1 + (lat2 - lat1) * 1.0  =  lat2

        // So if the bus is 70% through segment 3, we're calculating
        // the exact lat/lng that's 70% of the way between coords[3]
        // and coords[4].

        const newLat = lat1 + (lat2 - lat1) * segmentProgress;
        const newLng = lng1 + (lng2 - lng1) * segmentProgress

        // Only call setLatLng this frame where there's a change in position > 2m
        // Helps to prevent icons flickering in place where the dt is small
        if (Math.abs(markerPos.lat - newLat) > 0.000005 || Math.abs(markerPos.lng - newLng) > 0.000005) {
          marker.setLatLng([newLat, newLng]);
        };

        requestAnimationFrame(animation);
    };

    requestAnimationFrame(animation);
};
