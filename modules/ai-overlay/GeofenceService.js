/**
 * GeofenceService.js
 * Monitors GPS position and detects entry/exit of Job Sites.
 */

export const GeofenceService = {
    state: {
        activeSites: [], // List of { id, name, lat, lng, radius }
        currentSite: null,
        isTracking: false
    },

    init: (sites = []) => {
        GeofenceService.state.activeSites = sites;
        console.log(`[Geofence] Initialized with ${sites.length} sites.`);
    },

    startTracking: () => {
        if (!navigator.geolocation) {
            console.warn("[Geofence] Geolocation not supported");
            return;
        }
        GeofenceService.state.isTracking = true;

        // In real app: watchPosition
        // navigator.geolocation.watchPosition(GeofenceService.checkLocation);
        console.log("[Geofence] Tracking started...");
    },

    /**
     * Checks a coordinate against active sites.
     * @param {Object} coords - { lat, lng }
     */
    checkLocation: (coords) => {
        const { lat, lng } = coords;
        let foundSite = null;

        for (const site of GeofenceService.state.activeSites) {
            const dist = GeofenceService.getDistanceFromLatLonInKm(lat, lng, site.lat, site.lng);
            // Default radius 0.5km if not specified
            const r = site.radius || 0.5;

            if (dist <= r) {
                foundSite = site;
                break; // Assume only one site at a time
            }
        }

        if (foundSite && (!GeofenceService.state.currentSite || GeofenceService.state.currentSite.id !== foundSite.id)) {
            GeofenceService.enterSite(foundSite);
        } else if (!foundSite && GeofenceService.state.currentSite) {
            GeofenceService.exitSite();
        }

        return foundSite;
    },

    enterSite: (site) => {
        console.log(`[Geofence] Entered Site: ${site.name}`);
        GeofenceService.state.currentSite = site;
        // Dispatch Event
        window.dispatchEvent(new CustomEvent('geofence-enter', { detail: site }));
    },

    exitSite: () => {
        if (GeofenceService.state.currentSite) {
            console.log(`[Geofence] Exited Site: ${GeofenceService.state.currentSite.name}`);
            window.dispatchEvent(new CustomEvent('geofence-exit', { detail: GeofenceService.state.currentSite }));
            GeofenceService.state.currentSite = null;
        }
    },

    // Haversine Formula
    getDistanceFromLatLonInKm: (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of the earth in km
        const dLat = GeofenceService.deg2rad(lat2 - lat1);
        const dLon = GeofenceService.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(GeofenceService.deg2rad(lat1)) * Math.cos(GeofenceService.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    },

    deg2rad: (deg) => {
        return deg * (Math.PI / 180);
    }
};
