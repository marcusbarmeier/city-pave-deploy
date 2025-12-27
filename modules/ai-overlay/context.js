/**
 * Context Awareness Module
 * Tracks user journey, location, and activity state.
 */

import { GeofenceService } from './GeofenceService.js';

export const Context = {
    state: {
        lastLocation: null,
        currentLocation: window.location.pathname,
        startTime: Date.now(),
        interactions: []
    },

    init: () => {
        // Track navigation
        Context.updateLocation();
        window.addEventListener('popstate', Context.updateLocation);

        // rudimentary interaction tracking (clicks)
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
                Context.logInteraction(`Clicked ${e.target.innerText || e.target.tagName}`);
            }
        });

        // Initialize Geofence with mock sites
        // In real app, fetch from Estimator (Active Jobs)
        GeofenceService.init([
            { id: 'site_A', name: 'Downtown Plaza Paving', lat: 40.7128, lng: -74.0060, radius: 0.5 },
            { id: 'site_B', name: 'Westside Highway Repair', lat: 40.7589, lng: -73.9851, radius: 0.8 }
        ]);

        console.log("[AI Context] Initialized.");
    },

    updateLocation: () => {
        Context.state.lastLocation = Context.state.currentLocation;
        Context.state.currentLocation = window.location.pathname;
        console.log(`[AI Context] Location changed: ${Context.state.currentLocation}`);
    },

    logInteraction: (action) => {
        Context.state.interactions.push({
            action,
            timestamp: Date.now()
        });
        // Keep only last 10 interactions
        if (Context.state.interactions.length > 10) {
            Context.state.interactions.shift();
        }
    },

    /**
     * Returns a snapshot of the current user context.
     * Used to prompt the AI.
     */
    getSnapshot: () => {
        // Try global currentUser, then Firebase Auth, then default
        let role = 'guest';
        let email = 'unknown';

        if (window.currentUser) {
            role = window.currentUser.role || 'guest';
            email = window.currentUser.email || 'unknown';
        } else if (window.firebaseServices && window.firebaseServices.auth && window.firebaseServices.auth.currentUser) {
            // If nav hasn't set currentUser yet
            email = window.firebaseServices.auth.currentUser.email;
            // Best guess if roles aren't loaded
            role = 'authenticated';
        }

        // Determine "Module" from URL
        const pathParts = window.location.pathname.split('/');
        const moduleIndex = pathParts.indexOf('modules');
        const currentModule = (moduleIndex !== -1 && pathParts[moduleIndex + 1])
            ? pathParts[moduleIndex + 1]
            : 'Dashboard';

        return {
            userRole: role,
            userEmail: email,
            currentModule: currentModule,
            page: pathParts.pop() || 'index.html',
            recentActivity: Context.state.interactions.slice(-3)
        };
    }
};
