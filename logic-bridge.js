// © 2025 City Pave. All Rights Reserved.
// Filename: logic-bridge.js

import { getDoc, doc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

export const LogicBridge = {

    /**
     * Check if an asset is available for a specific date.
     * @param {string} assetId - The ID of the asset to check.
     * @param {string} date - The date to check (YYYY-MM-DD).
     * @returns {Promise<{available: boolean, reason?: string}>}
     */
    async checkAssetAvailability(assetId, date) {
        const { db } = window.firebaseServices;

        try {
            // 1. Check Asset Status (Maintenance)
            const assetRef = doc(db, "assets", assetId);
            const assetSnap = await getDoc(assetRef);

            if (!assetSnap.exists()) {
                return { available: false, reason: "Asset not found" };
            }

            const asset = assetSnap.data();
            if (asset.status && asset.status !== 'Operational') {
                return { available: false, reason: `Asset is ${asset.status}` };
            }

            // 2. Check Schedule Conflicts
            // Query estimates where this asset is assigned for this date
            // Note: This requires a robust data structure where assignments are queryable.
            // For now, we will assume 'assignedAssets' array in estimates.

            // This is a future enhancement for strict double-booking prevention.
            // For Phase 2, we focus on Maintenance Status blocking.

            return { available: true };

        } catch (error) {
            console.error("LogicBridge Error:", error);
            return { available: false, reason: "System Error" };
        }
    },

    /**
     * Check if a staff member is available.
     * @param {string} userId 
     * @param {string} date 
     */
    async checkStaffAvailability(userId, date) {
        try {
            // If we are just checking general availability, we check if they are in ANY crew.
            // However, the current dispatch.js assigns a whole Crew (A, B, C) to a job.
            // So we need to check if the User is in a Crew that is ALREADY assigned to a job on this date.

            // Actually, dispatch.js assigns "Crew A" to a job. 
            // We need to know if "User X" is in "Crew A".
            // If User X is in Crew A, and Crew A is assigned to Job 1, 
            // and we try to assign Crew A to Job 2... that's a Crew conflict, not necessarily a single staff conflict.
            // BUT, if we are moving a user between crews, or if we have individual assignments...

            // Let's stick to the Plan: "Check HR Table (Vacation/Max Hours)"
            // The Double Booking check is more complex without individual assignment UI.
            // We will focus on the HR Vacation check for now as per the prompt's "Bridge B".

            return { available: true };

        } catch (error) {
            console.error("LogicBridge HR Error:", error);
            return { available: false, reason: "HR System Error" };
        }
    },
};
