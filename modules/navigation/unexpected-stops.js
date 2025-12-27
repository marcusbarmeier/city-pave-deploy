/**
 * unexpected-stops.js
 * Logic for detecting when a driver has been stationary for too long
 * and triggering an AI prompt.
 */

export class UnexpectedStopMonitor {
    constructor(options = {}) {
        // Configuration
        this.stationaryThresholdMeters = options.distanceThreshold || 20; // 20 meters radius
        this.stationaryTimeMs = options.timeThreshold || 5 * 60 * 1000; // 5 minutes default

        // Callbacks
        this.onStopDetected = options.onStopDetected || (() => { });
        this.onMotionDetected = options.onMotionDetected || (() => { });

        // State
        this.lastSignificantLocation = null;
        this.stationarySince = null;
        this.isPromptActive = false;

        // Debug
        this.debug = options.debug || false;
    }

    /**
     * Update the current location to check for stationarity.
     * @param {Object} location - { lat: number, lng: number }
     */
    updateLocation(location) {
        if (!location || !location.lat || !location.lng) return;

        // Initialize if first point
        if (!this.lastSignificantLocation) {
            this.lastSignificantLocation = location;
            this.stationarySince = Date.now();
            return;
        }

        // Calculate distance from last significant point
        const distance = this.getDistanceFromLatLonInMeters(
            this.lastSignificantLocation.lat,
            this.lastSignificantLocation.lng,
            location.lat,
            location.lng
        );

        if (distance > this.stationaryThresholdMeters) {
            // MOVED: Reset stationarity
            if (this.debug) console.log(`[StopMonitor] Moved ${distance.toFixed(1)}m. Resetting timer.`);
            this.lastSignificantLocation = location;
            this.stationarySince = Date.now();

            if (this.isPromptActive) {
                // Determine if we should auto-dismiss or just notify app
                this.isPromptActive = false;
                this.onMotionDetected();
            }

        } else {
            // STATIONARY: Check time
            const elapsed = Date.now() - this.stationarySince;
            if (this.debug) console.log(`[StopMonitor] Stationary for ${(elapsed / 1000).toFixed(1)}s (Radius: ${distance.toFixed(1)}m)`);

            if (elapsed > this.stationaryTimeMs && !this.isPromptActive) {
                this.isPromptActive = true;
                this.onStopDetected(elapsed);
            }
        }
    }

    /**
     * Reset the monitor (e.g. after user responds to prompt)
     */
    reset() {
        this.stationarySince = Date.now();
        this.isPromptActive = false;
    }

    // --- Utility: Haversine Formula ---
    getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = this.deg2rad(lat2 - lat1);
        var dLon = this.deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d * 1000;
    }

    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
}
