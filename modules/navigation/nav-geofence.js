
/**
 * nav-geofence.js
 * Core logic for detecting Geofence events (Enter/Exit).
 * Dependencies: Google Maps Geometry Library
 */

export class GeofenceManager {
    constructor() {
        this.zones = []; // { id, name, type, polygon: google.maps.Polygon }
        this.currentZoneId = null;
        this.listeners = {
            'enter': [],
            'exit': [],
            'dwell': [] // future: for load counting
        };
        // Dwell tracking
        this.zoneEnterTime = null;
    }

    /**
     * Define a monitoring zone
     * @param {object} zoneConfig - { id, name, type, paths: [{lat, lng}, ...] }
     */
    addZone(zoneConfig) {
        if (!window.google || !window.google.maps) {
            console.warn("Google Maps not ready for Geofence");
            return;
        }

        const polygon = new google.maps.Polygon({
            paths: zoneConfig.paths
        });

        this.zones.push({
            id: zoneConfig.id,
            name: zoneConfig.name,
            type: zoneConfig.type, // 'job', 'dump', 'shop'
            polygon: polygon
        });

        console.log(`Geofence added: ${zoneConfig.name} (${zoneConfig.type})`);
    }

    /**
     * Check current location against all zones
     * @param {object} position - { lat, lng }
     */
    checkLocation(position) {
        if (!window.google || !window.google.maps) return;

        const latLng = new google.maps.LatLng(position.lat, position.lng);
        let foundZone = null;

        for (const zone of this.zones) {
            if (google.maps.geometry.poly.containsLocation(latLng, zone.polygon)) {
                foundZone = zone;
                break; // Assume non-overlapping zones for MVP
            }
        }

        // State Machine
        if (foundZone) {
            if (this.currentZoneId !== foundZone.id) {
                // Event: ENTER
                this.handleEnter(foundZone);
            } else {
                // Event: DWELL (Still in same zone)
                // update dwell time logic here if needed
            }
        } else {
            if (this.currentZoneId !== null) {
                // Event: EXIT
                this.handleExit(this.getZoneById(this.currentZoneId));
            }
        }
    }

    handleEnter(zone) {
        console.log(`Entered Zone: ${zone.name}`);
        this.currentZoneId = zone.id;
        this.zoneEnterTime = Date.now();
        this._emit('enter', zone);
        // [AI OVERLAY TRIGGER]
        window.dispatchEvent(new CustomEvent('geofence-enter', { detail: zone }));
    }

    handleExit(zone) {
        console.log(`Exited Zone: ${zone ? zone.name : 'Unknown'}`);
        // Calculate Dwell Duration
        const duration = this.zoneEnterTime ? (Date.now() - this.zoneEnterTime) : 0;

        this.currentZoneId = null;
        this.zoneEnterTime = null;
        this._emit('exit', { zone, duration });
        // [AI OVERLAY TRIGGER]
        window.dispatchEvent(new CustomEvent('geofence-exit', { detail: { zone, duration } }));
    }

    getZoneById(id) {
        return this.zones.find(z => z.id === id);
    }

    /**
     * Get currently active zone or null
     */
    getCurrentZone() {
        if (!this.currentZoneId) return null;
        return this.getZoneById(this.currentZoneId);
    }

    // Event Emitter Pattern
    on(event, callback) {
        if (this.listeners[event]) this.listeners[event].push(callback);
    }

    _emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}
