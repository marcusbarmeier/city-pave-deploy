// © 2025 City Pave. All Rights Reserved.
// Filename: saas-ai.js

import { ModuleHierarchy } from './saas-modules.js';

/**
 * Guardian AI: Developer Safety Net
 */
export const GuardianAI = {
    /**
     * Checks for conflicts when changing a tenant's subscription tier.
     * @param {string} tenantId 
     * @param {string} currentTier 
     * @param {string} newTier 
     * @param {object} tenantUsageStats Mock usage stats for the tenant
     * @returns {object} { allowed: boolean, warning: string | null }
     */
    checkDowngradeConflict: (tenantId, currentTier, newTier, tenantUsageStats) => {
        if (currentTier === 'titan' && newTier !== 'titan') {
            // Check for Titan-exclusive data usage
            if (tenantUsageStats.storageUsed > 100) { // e.g., > 100GB
                return {
                    allowed: false,
                    warning: `WAIT! This client has ${tenantUsageStats.storageUsed}GB of Dash Cam footage stored. Downgrading will make this data inaccessible. Do you want to archive it first?`
                };
            }
        }
        return { allowed: true, warning: null };
    },

    /**
     * Analyzes usage to suggest upsells.
     * @param {object} usageStats 
     * @returns {string | null} Upsell suggestion or null
     */
    analyzeUpsellOpportunity: (usageStats) => {
        if (usageStats.schedulerOpens > 40 && !usageStats.hasProScheduler) {
            return "Client is using the 'Basic Scheduler' frequently. High-probability target for 'Pro Scheduler' upsell.";
        }
        return null;
    }
};

/**
 * Conflict AI: Client-Side Permissions Logic
 */
export const ConflictAI = {
    /**
     * Checks for logical inconsistencies in permission assignments.
     * @param {object} permissions Object where keys are feature IDs and values are booleans
     * @returns {string | null} Warning message or null
     */
    checkPermissionLogic: (permissions) => {
        // Example: Parts Inventory Manager needs Maintenance Triage
        // In our hierarchy: 'inventory_auto' (Enhancement) usually implies access to 'mechanic_triage' (Feature)
        // But let's use the specific example from the prompt:
        // "Client enables 'Parts Inventory Manager' for a user but disables 'Maintenance Triage'."

        if (permissions['inventory_auto'] && !permissions['mechanic_triage']) {
            return "Logic Error: You are asking this user to manage parts, but they cannot see the Repair Tickets that require parts. Enable 'Mechanic Triage Board' as well?";
        }

        // Example: Geofencing needs Time Clock
        if (permissions['geofencing'] && !permissions['time_clock']) {
            return "Logic Error: Geofencing enforces Time Clock rules. Please enable 'Time Clock' for this user.";
        }

        return null;
    }
};
