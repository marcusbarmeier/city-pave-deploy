
/**
 * nav-router.js
 * Wrapper for Route Calculation (Google Maps Directions Service).
 */

export class NavRouter {
    constructor() {
        this.directionsService = null;
        this.currentRoute = null;
    }

    init() {
        if (window.google && window.google.maps) {
            this.directionsService = new google.maps.DirectionsService();
        }
    }

    /**
     * Calculate a route
     * @param {object} origin - { lat, lng }
     * @param {object} destination - { lat, lng }
     * @param {string} profile - 'car' or 'truck'
     * @returns {Promise}
     */
    async calculateRoute(origin, destination, profile = 'truck', options = {}) {
        if (!this.directionsService) this.init();
        if (!this.directionsService) throw new Error("Google Maps API not loaded");

        const request = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true,
            avoidTolls: options.avoidTolls || false,
            avoidHighways: options.avoidHighways || false
        };

        // NOTE: Google Maps JS API Standard Plan does NOT support 'truck' attributes.
        // We simulate truck routing by:
        // 1. Finding routes.
        // 2. (In a real app) Filtering them against a known list of restricted roads or bridge heights.
        // For MVP, we just return the standard driving route but warn the user.

        return new Promise((resolve, reject) => {
            this.directionsService.route(request, (result, status) => {
                if (status === 'OK') {
                    this.currentRoute = result;
                    resolve({
                        result: result,
                        warning: profile === 'truck' ? "Verify Truck Restrictions Manually" : null
                    });
                } else {
                    reject(status);
                }
            });
        });
    }

    /**
     * Parse the first leg's steps for turn-by-turn guidance
     */
    getNextInstruction(stepIndex = 0) {
        if (!this.currentRoute || !this.currentRoute.routes[0]) return null;

        const leg = this.currentRoute.routes[0].legs[0];
        if (stepIndex < leg.steps.length) {
            return {
                instruction: leg.steps[stepIndex].instructions, // HTML string
                distance: leg.steps[stepIndex].distance.text,
                maneuver: leg.steps[stepIndex].maneuver,
                endLocation: leg.steps[stepIndex].end_location
            };
        }
        return { instruction: "Arrived at Destination", distance: "0 m" };
    }

    /**
     * Find the current step index based on user location.
     * Simple MVP: If user is within 30 meters of current step's end, advance.
     */
    getStepIndexForLocation(currentStep, userLoc) {
        if (!this.currentRoute || !this.currentRoute.routes[0]) return 0;
        const leg = this.currentRoute.routes[0].legs[0];

        if (currentStep >= leg.steps.length) return leg.steps.length - 1;

        const stepEnd = leg.steps[currentStep].end_location;
        const dist = this.getDistanceFromLatLonInMeters(
            userLoc.lat, userLoc.lng,
            stepEnd.lat(), stepEnd.lng()
        );

        // If within 40 meters of the turn, advance to next step to show what's AFTER the turn
        // (Or stay on current until passed? GPS lag suggests looking ahead is better)
        if (dist < 40) {
            return Math.min(currentStep + 1, leg.steps.length - 1);
        }

        return currentStep;
    }

    getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = this.deg2rad(lat2 - lat1);
        var dLon = this.deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c * 1000; // Distance in meters
        return d;
    }

    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
}
