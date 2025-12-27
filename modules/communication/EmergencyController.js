/**
 * EmergencyController.js
 * Handles the "Red Phone" Protocol.
 * High-priority logic for accidents and critical hazards.
 */

import { notificationEngine } from './notification-engine.js'; // Reusing backend logic

export class EmergencyController {
    constructor() {
        this.activeIncident = null;
        this.emergencyTypes = [
            { id: 'accident', label: 'ACCIDENT', color: 'bg-red-600' },
            { id: 'injury', label: 'INJURY', color: 'bg-red-700' },
            { id: 'fire', label: 'FIRE / HAZARD', color: 'bg-orange-600' },
            { id: 'security', label: 'SECURITY', color: 'bg-slate-800' }
        ];
    }

    /**
     * Initiates the Emergency Flow.
     * Stops non-essential services, grabs GPS, and prepares broadcasts.
     * @param {Object} userContext 
     */
    triggerEmergency(userContext) {
        console.warn("🚨 EMERGENCY PROTOCOL INITIATED 🚨");

        // 1. Create Incident Object
        this.activeIncident = {
            id: `INC-${Date.now()}`,
            timestamp: new Date().toISOString(),
            user: userContext.name || 'Unknown User',
            location: userContext.location || null, // Expects {lat, lng}
            status: 'active'
        };

        // 2. Stop "Clock" logic (Simulation)
        // In real app: import timeTracker and pause.
        console.log("[Emergency] Pausing standard time tracking...");

        // 3. Prepare Broadcast List (Mock)
        this.crisisTeam = ['Owner', 'SafetyOfficer', 'Admin'];

        // 4. Dispatch Global Event (Hooks for DashCam / Nav)
        window.dispatchEvent(new CustomEvent('system-emergency', {
            detail: {
                incidentId: this.activeIncident.id,
                location: this.activeIncident.location,
                timestamp: this.activeIncident.timestamp
            }
        }));

        return this.activeIncident;
    }

    /**
     * Confirm type and broadcast.
     * @param {string} typeId - 'accident', 'injury', etc.
     */
    async confirmEmergencyType(typeId) {
        if (!this.activeIncident) return;

        const typeObj = this.emergencyTypes.find(t => t.id === typeId);
        this.activeIncident.type = typeObj ? typeObj.label : 'UNKNOWN EMERGENCY';

        // 1. Log Event
        notificationEngine.logEvent('emergency_triggered', this.activeIncident);

        // 2. Broadcast High Priority Alert
        console.log(`[Emergency] Broadcasting ALERT to: ${this.crisisTeam.join(', ')}`);

        // 3. Generate Magic Link
        const magicLink = this.generateMagicLink();
        this.activeIncident.magicLink = magicLink;

        return {
            message: "Help is on the way. Incident Reported.",
            magicLink: magicLink
        };
    }

    generateMagicLink() {
        // In real app, this generates a JWT token signed link
        // For Simulator: relative path with params
        const baseUrl = window.location.origin.includes('127.0.0.1') || window.location.origin.includes('localhost')
            ? window.location.origin + '/modules/communication'
            : '/modules/communication';

        return `${baseUrl}/secure-view.html?incidentId=${this.activeIncident.id}`;
    }
}

export const emergencyController = new EmergencyController();
