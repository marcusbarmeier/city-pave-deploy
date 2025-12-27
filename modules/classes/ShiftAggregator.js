// © 2025 City Pave. All Rights Reserved.
// Filename: ShiftAggregator.js

export class ShiftAggregator {
    constructor(firebaseServices) {
        this.services = firebaseServices;
        this.db = firebaseServices.db;
        this.collection = firebaseServices.collection;
        this.query = firebaseServices.query;
        this.where = firebaseServices.where;
        this.getDocs = firebaseServices.getDocs;
    }

    /**
     * Aggregates all resources for a specific user and date.
     * @param {string} userId - The user's UID.
     * @param {string} dateString - The date in YYYY-MM-DD format.
     */
    async getShiftData(userId, dateString) {
        if (!userId || !dateString) throw new Error("Missing userId or dateString");

        // Define Start and End of day for timestamp queries (Force Local Time)
        // new Date("YYYY-MM-DD") is UTC, but we want 00:00 Local
        const startOfDay = new Date(dateString + 'T00:00:00');
        const endOfDay = new Date(dateString + 'T23:59:59.999');

        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();

        console.log(`[ShiftAggregator] Fetching for User: ${userId}, Date: ${dateString}`);
        console.log(`[ShiftAggregator] TimeRange: ${startISO} -> ${endISO}`);

        try {
            const [timeLogs, tickets, forms, routes, dispatch, dashcam] = await Promise.all([
                this.fetchTimeLogs(userId, startISO, endISO),
                this.fetchTickets(userId, dateString),
                this.fetchForms(userId, startISO, endISO),
                this.fetchRoutes(userId, startISO, endISO),
                this.fetchDispatch(userId, dateString),
                this.fetchDashcamClips(userId, startISO, endISO)
            ]);

            return {
                date: dateString,
                userId: userId,
                dispatch: dispatch,
                assets: {
                    timeLogs,
                    tickets,
                    forms,
                    routes,
                    dashcam
                },
                summary: this.calculateSummary(timeLogs, tickets, routes)
            };
        } catch (error) {
            console.error("Error aggregating shift data:", error);
            throw error;
        }
    }

    async fetchTimeLogs(userId, startISO, endISO) {
        const q = this.query(
            this.collection(this.db, "time_logs"),
            this.where("userId", "==", userId),
            this.where("startTime", ">=", startISO),
            this.where("startTime", "<=", endISO)
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async fetchTickets(userId, dateString) {
        // Tickets use a simple 'date' string field
        const q = this.query(
            this.collection(this.db, "time_tickets"),
            this.where("userId", "==", userId),
            this.where("date", "==", dateString)
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async fetchForms(userId, startISO, endISO) {
        const q = this.query(
            this.collection(this.db, "form_submissions"),
            this.where("userId", "==", userId),
            this.where("submittedAt", ">=", startISO),
            this.where("submittedAt", "<=", endISO)
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async fetchRoutes(userId, startISO, endISO) {
        const q = this.query(
            this.collection(this.db, "route_logs"),
            this.where("userId", "==", userId),
            this.where("timestamp", ">=", startISO),
            this.where("timestamp", "<=", endISO)
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async fetchDashcamClips(userId, startISO, endISO) {
        // Dashcam clips are stored in 'dashcam_clips'
        // Using 'timestamp' field for the time of recording
        const q = this.query(
            this.collection(this.db, "dashcam_clips"),
            this.where("userId", "==", userId),
            this.where("timestamp", ">=", startISO),
            this.where("timestamp", "<=", endISO)
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async fetchDispatch(userId, dateString) {
        // Dispatch is stored by date. We need to find the doc for this date, 
        // then check if the user is in the 'crew' array.
        const q = this.query(
            this.collection(this.db, "dispatch_schedule"),
            this.where("date", "==", dateString)
        );
        const snap = await this.getDocs(q);

        const jobs = [];
        snap.forEach(doc => {
            const data = doc.data();
            // Check if user is in crew
            if (Array.isArray(data.crew)) {
                const member = data.crew.find(m => m.userId === userId);
                if (member) {
                    jobs.push({
                        id: doc.id,
                        clientName: data.clientName,
                        siteAddress: data.siteAddress,
                        role: member.note,
                        asset: member.assetName,
                        shopTime: data.shopTime
                    });
                }
            } else if (typeof data.crew === 'string' && data.crew.includes(userId)) {
                // Legacy support
                jobs.push({ id: doc.id, clientName: data.clientName, legacy: true });
            }
        });
        return jobs;
    }

    calculateSummary(timeLogs, tickets, routes) {
        let totalHours = 0;
        let totalLoads = 0;
        let totalKms = 0; // If we had distance in routes

        // Calculate Hours from Time Logs
        timeLogs.forEach(log => {
            if (log.endTime) {
                const start = new Date(log.startTime);
                const end = new Date(log.endTime);
                totalHours += (end - start) / 3600000;
            } else {
                // Active log
                const start = new Date(log.startTime);
                const now = new Date();
                totalHours += (now - start) / 3600000;
            }
        });

        // Calculate Loads/Tons from Tickets
        tickets.forEach(t => {
            if (t.unitType === 'Loads') totalLoads += parseFloat(t.quantity) || 0;
            // You could add Tons here too if needed
        });

        return {
            hours: totalHours.toFixed(2),
            loads: totalLoads,
            jobsCount: new Set(timeLogs.map(l => l.jobId)).size
        };
    }
}
