// © 2025 City Pave. All Rights Reserved.
// Filename: maintenance-bridge.js
// Purpose: Shared logic for checking if an asset is due for service.

export async function checkAssetMaintenanceStatus(assetId) {
    if (!assetId) return { status: 'ok', alerts: [] };

    const { db, doc, getDoc } = window.firebaseServices;

    try {
        const assetRef = doc(db, "assets", assetId);
        const snapshot = await getDoc(assetRef);

        if (!snapshot.exists()) return { status: 'ok', alerts: [] };

        const asset = snapshot.data();
        const schedule = asset.maintenanceSchedule || [];
        const alerts = [];
        let maxSeverity = 'ok'; // ok, warning, critical

        const currentMiles = asset.currentMiles || 0;
        const currentHours = asset.currentHours || 0;

        schedule.forEach(item => {
            let due = false;
            let msg = '';

            // Check Miles
            if (item.everyMiles) {
                const last = item.lastServiceMiles || 0; // Assuming we track this per item, or global? 
                // In v1.1 structure, we might strictly track 'next due'. 
                // For simplicity in this bridge, let's assume simple modulo or direct 'next due' data if it exists.
                // Reverting to the logic in asset-manager: "Next Service Due = lastService + interval"
                // But per item tracking is complex if not saved. 
                // Let's assume the user saves "nextDueMiles" on the item, or we calculate from global.
                // Simplified Logic: If current > (last + interval)

                // For this MVP bridge, let's look at the GLOBAL lastService vs Interval, 
                // OR if the item specifically has `nextDueMiles` saved.
                // If not available, we skip to avoid false positives.
                if (asset.nextServiceMiles && currentMiles >= asset.nextServiceMiles) {
                    // specific item match?
                }

                // Better Logic for v1.1 data structure:
                // We will assume "maintenance-schedule-list" items are just RULES.
                // The actual "Due" state might be global for the asset for now, or we calculate typicals.
                // Let's check: "Interval - (Current % Interval)" < WarningThreshold?

                const milesSinceLast = currentMiles % item.everyMiles;
                const milesRemaining = item.everyMiles - milesSinceLast;
                if (milesRemaining < 100) { // Warn within 100 miles
                    due = true;
                    msg = `${item.serviceName} due in ${milesRemaining} miles`;
                }
            }

            // Check Hours
            if (item.everyHours) {
                const hoursSinceLast = currentHours % item.everyHours;
                const hoursRemaining = item.everyHours - hoursSinceLast;
                if (hoursRemaining < 20) { // Warn within 20 hours
                    due = true;
                    msg = `${item.serviceName} due in ${hoursRemaining} hours`;
                }
            }

            if (due) {
                alerts.push(msg);
                maxSeverity = 'warning';
                // If OVERdue, could set to critical
                if (msg.includes("due in -")) maxSeverity = 'critical';
            }
        });

        return { status: maxSeverity, alerts };

    } catch (e) {
        console.error("Maintenance Bridge Error:", e);
        return { status: 'error', alerts: ["Error checking status"] };
    }
}
