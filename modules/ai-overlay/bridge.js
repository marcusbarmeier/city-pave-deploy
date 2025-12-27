/**
 * generic Data Bridge for AI Overlay
 * Acts as a secure layer between the AI and the application data.
 */

import { LogicBridge } from '../../logic-bridge.js';

export const Bridge = {
    /**
     * Checks if the current user has permission for the requested action.
     * @param {Object} user - The user object from Firebase auth.
     * @param {string} requiredRole - The minimum role required.
     * @returns {boolean}
     */
    checkPermissions: (user, requiredRole) => {
        if (!user) return false;

        const roles = ['crew', 'foreman', 'manager', 'admin', 'super_admin'];
        const userRoleIndex = roles.indexOf(user.role || 'crew');
        const requiredIndex = roles.indexOf(requiredRole);

        return userRoleIndex >= requiredIndex;
    },

    /**
     * Fetches context-specific data.
     * @param {string} type - data type (e.g., 'asset_availability', 'staff_availability')
     * @param {string} query - The natural language query or ID to extract params from.
     */
    fetchData: async (type, query) => {
        console.log(`[Bridge] Fetching ${type} for Query: ${query}`);

        try {
            switch (type) {
                case 'asset_availability': {
                    // Extract Asset ID (e.g., 'A-101', 'T-500', 'asset_123')
                    const assetMatch = query.match(/\b([A-Z]{1,2}-\d{3}|asset_\w+)\b/i);
                    const assetId = assetMatch ? assetMatch[0] : null;

                    // Extract Date (e.g., '2025-10-10', 'today', 'tomorrow')
                    let date = new Date().toISOString().split('T')[0]; // Default today
                    if (query.toLowerCase().includes('tomorrow')) {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        date = d.toISOString().split('T')[0];
                    }

                    if (!assetId) return { error: "Could not identify an Asset ID." };

                    return await LogicBridge.checkAssetAvailability(assetId, date);
                }

                case 'staff_availability': {
                    // Extract Name or ID... implementing basic check for now
                    return await LogicBridge.checkStaffAvailability('currentUser', new Date().toISOString().split('T')[0]);
                }

                case 'repair_history':
                    // Mock fallback for now until LogicBridge supports it
                    return Bridge._mockRepairHistory(query);

                default:
                    return null;
            }
        } catch (error) {
            console.error("[Bridge] Data fetch failed:", error);
            return { error: "Bridge connection failed." };
        }
    },

    /**
     * [AI ACTION] Clock the user in.
     */
    clockIn: async (user, site) => {
        console.log(`[Bridge] Clocking in ${user.email} at ${site.name}`);
        const { db, collection, addDoc } = window.firebaseServices || {};
        if (!db) return false;

        try {
            await addDoc(collection(db, 'time_records'), {
                userId: user.uid,
                userName: user.displayName || user.email,
                type: 'clock_in',
                siteId: site.id,
                siteName: site.name,
                timestamp: new Date()
            });
            return true;
        } catch (e) {
            console.error("[Bridge] Clock In Failed", e);
            return false;
        }
    },

    /**
     * [AI ACTION] Create a hazard form draft.
     */
    createHazardForm: async (user, site) => {
        console.log(`[Bridge] Creating Hazard Form for ${site.name}`);
        const { db, collection, addDoc } = window.firebaseServices || {};
        if (!db) return false;

        try {
            await addDoc(collection(db, 'safety_forms'), {
                type: 'hazard_assessment',
                status: 'draft',
                userId: user.uid,
                siteId: site.id,
                siteName: site.name,
                createdAt: new Date(),
                riskLevel: 'unknown' // to be filled
            });
            return true;
        } catch (e) {
            console.error("[Bridge] Safety Form Failed", e);
            return false;
        }
    },

    _mockRepairHistory: (assetId) => {
        return [
            { date: '2025-11-10', repair: 'Hydraulic Hoses Replaced', cost: 1200 },
            { date: '2025-08-15', repair: 'Oil Change service', cost: 350 }
        ];
    },

    /**
     * [NEW] for Module Fine Tuner
     * Returns a high-level snapshot of the current module context.
     */
    getSnapshot: () => {
        return {
            timestamp: Date.now(),
            activeData: {
                // In reality, this would pull from global state
                repairs: 2,
                projects: 5
            }
        };
    },

    /**
     * [NEW] Global Snapshot hook (e.g. for Synapse Bridge)
     */
    getAllModuleSnapshots: async () => {
        // Mock aggregator
        return {
            fleet: { activeRepairs: 5, urgentRepairs: 1, lastBreakdown: { assetId: 'T-101', loc: 'Zone-A' } },
            sketch: { activeProjects: 3, delayedProjects: 1, delays: [{ projectId: 'P-500', loc: 'Zone-A' }] },
            employee: { clockedIn: 45, overtimeAlerts: 2 }
        };
    }
};

