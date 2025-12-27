// © 2025 City Pave. All Rights Reserved.
// Filename: snow-operations.js
// Description: Logic for Snow Shifts, Daisychaining, and Billing Splitting

export const SnowOperations = {
    // --- 1. DAISY CHAIN LOGIC ---

    /**
     * Completes the current site log and immediately starts the next one to ensure zero-gap billing.
     * @param {Object} currentLog - The active snow log object being finished
     * @param {Object} nextJob - The next job object to start
     * @param {Object} user - The current user
     * @returns {Object} { finishedLog, newLog }
     */
    daisyChainSite: function (currentLog, nextJob, user) {
        const now = new Date().toISOString();

        // 1. Close current log
        const finishedLog = {
            ...currentLog,
            endTime: now,
            status: 'Completed',
            durationMinutes: this.calculateDurationMinutes(currentLog.startTime, now)
        };

        // 2. Start next log using EXACT same timestamp
        const newLog = {
            id: `snow_log_${Date.now()}`, // simplified ID generation
            shiftId: currentLog.shiftId,
            jobId: nextJob.id,
            propertyId: nextJob.locationId || 'unknown_loc',
            serviceType: 'Clearing', // Default, user can change
            billingType: nextJob.snowContract?.billingType || 'PerPush',
            startTime: now, // Zero-gap
            endTime: null,
            status: 'Active',
            photos: { before: [], after: [], damage: [] },
            materials: {},
            weather: {} // To be populated by weather service
        };

        return { finishedLog, newLog };
    },

    /**
     * Starts a new Snow Shift (Payroll)
     */
    startSnowShift: function (user, assetId) {
        return {
            id: `shift_${user.uid}_${Date.now()}`,
            userId: user.uid,
            userName: user.displayName || user.email,
            assetId: assetId,
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'Active',
            totalHours: 0
        };
    },

    /**
     * Ends the Snow Shift
     */
    endSnowShift: function (shift) {
        const now = new Date().toISOString();
        return {
            ...shift,
            endTime: now,
            status: 'Completed',
            totalHours: this.calculateDurationHours(shift.startTime, now)
        };
    },

    // --- 2. BILLING SPLITTER (THE DATA MATRIX) ---

    /**
     * Takes a list of raw snow logs and calculates the Billable Invoice amounts
     * based on the contract type (Hourly vs PerPush vs Seasonal).
     * 
     * @param {Array} snowLogs - List of completed snow logs
     * @param {Object} contracts - Map of jobId -> Contract Details
     * @returns {Array} List of Invoice Items
     */
    generateInvoiceItems: function (snowLogs, contracts) {
        const invoiceItems = [];

        snowLogs.forEach(log => {
            const contract = contracts[log.jobId]?.snowContract;
            if (!contract) {
                console.warn(`No contract found for job ${log.jobId}`);
                return;
            }

            let billableAmount = 0;
            let description = '';
            let quantity = 0;
            let rate = 0;

            if (contract.billingType === 'Hourly') {
                // Exact time billing
                const hours = log.durationMinutes / 60;
                rate = contract.rates?.clearing || 0;
                billableAmount = hours * rate;
                description = `Snow Clearing (Hourly): ${hours.toFixed(2)} hrs`;
                quantity = hours;
            }
            else if (contract.billingType === 'PerPush') {
                // Per Event billing
                // We assume one "Log" = one "Push" unless split.
                // In a daisy chain, travel time is usually bundled into the previous or next pusher, 
                // BUT for Per Push, travel time is irrelevant to the client invoice (Flat Rate).

                rate = contract.rates?.perPush || 0;
                billableAmount = rate;
                description = `Snow Clearing (Per Push)`;
                quantity = 1;

                // Salting add-on logic
                if (log.serviceType === 'Salting' || log.materials?.saltLbs > 0) {
                    const saltRate = contract.rates?.salting || 0;
                    billableAmount += saltRate;
                    description += ` + Salting`;
                }
            }
            else if (contract.billingType === 'Seasonal') {
                // 0 Billable for the event (billed monthly)
                billableAmount = 0;
                description = `Snow Clearing (Seasonal Contract)`;
                quantity = 1;
                rate = 0;
            }

            invoiceItems.push({
                jobId: log.jobId,
                logId: log.id,
                description,
                quantity,
                rate,
                total: billableAmount,
                date: log.startTime
            });
        });

        return invoiceItems;
    },

    // --- UTILITIES ---

    calculateDurationMinutes: function (startStr, endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        return (end - start) / 60000;
    },

    calculateDurationHours: function (startStr, endStr) {
        return this.calculateDurationMinutes(startStr, endStr) / 60;
    }
};
