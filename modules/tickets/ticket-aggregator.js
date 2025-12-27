// modules/tickets/ticket-aggregator.js

/**
 * Aggregates all work artifacts for a specific user and job context to build a Smart Ticket.
 */
export class TicketAggregator {
    constructor(firebaseServices) {
        this.db = firebaseServices.db;
        this.collection = firebaseServices.collection;
        this.query = firebaseServices.query;
        this.where = firebaseServices.where;
        this.getDocs = firebaseServices.getDocs;
        this.orderBy = firebaseServices.orderBy;
        this.limit = firebaseServices.limit;
    }

    /**
     * Finds potential "Ticket Candidates" for the current user's activty today or recent days.
     * Returns list of { jobId, jobName, date, timeLogCount, lastActivity }
     */
    async findTicketCandidates(userId, daysBack = 7) {
        const candidates = new Map(); // Key: jobId_dateString

        // 1. Fetch recent TimeLogs
        // Note: Ideally index on userId + timestamp, but for prototype we'll grab recent via client-side filter if needed or simple query
        // Implementing simple "get recent logs" query assuming composite index or low volume
        const logsRef = this.collection(this.db, "time_logs");
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const q = this.query(logsRef,
            this.where("userId", "==", userId),
            this.where("timestamp", ">=", startDate.toISOString())
        );

        const snapshot = await this.getDocs(q);

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.jobId) return;

            const dateStr = new Date(data.timestamp).toLocaleDateString();
            const key = `${data.jobId}_${dateStr}`;

            if (!candidates.has(key)) {
                candidates.set(key, {
                    key,
                    jobId: data.jobId,
                    jobName: data.jobName || 'Unknown Job',
                    date: dateStr,
                    startTime: data.timestamp,
                    endTime: data.timestamp,
                    logCount: 0,
                    activities: []
                });
            }

            const c = candidates.get(key);
            c.logCount++;
            if (data.timestamp < c.startTime) c.startTime = data.timestamp;
            if (data.timestamp > c.endTime) c.endTime = data.timestamp;
        });

        return Array.from(candidates.values()).sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
    }

    /**
     * Full Aggregate: Gathers EVERYTHING for a specific Job + Date
     */
    async aggregateJobData(userId, jobId, dateStr) {
        if (!userId || !jobId) throw new Error("Missing UserID or JobID");

        const startOfDay = new Date(dateStr);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateStr);
        endOfDay.setHours(23, 59, 59, 999);

        const isoStart = startOfDay.toISOString();
        const isoEnd = endOfDay.toISOString();

        // Parallel Fetch
        const [timeLogs, expenses, forms, media] = await Promise.all([
            this._fetchTimeLogs(userId, jobId, isoStart, isoEnd),
            this._fetchExpenses(userId, jobId, isoStart, isoEnd),
            this._fetchForms(userId, jobId, isoStart, isoEnd),
            this._fetchMedia(userId, jobId, isoStart, isoEnd) // Hypothetical media collection or tagged files
        ]);

        return {
            summary: {
                totalTime: this._calculateTotalTime(timeLogs),
                tripCount: this._calculateTrips(timeLogs),
                expenseTotal: expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
            },
            timeLogs,
            expenses,
            forms,
            media
        };
    }

    async _fetchTimeLogs(userId, jobId, start, end) {
        const q = this.query(this.collection(this.db, "time_logs"),
            this.where("userId", "==", userId),
            this.where("jobId", "==", jobId),
            this.where("timestamp", ">=", start),
            this.where("timestamp", "<=", end)
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(d => d.data());
    }

    async _fetchExpenses(userId, jobId, start, end) {
        // Expenses might store timestamp or date field
        const q = this.query(this.collection(this.db, "expenses"),
            this.where("userId", "==", userId),
            this.where("jobId", "==", jobId)
            // Ideally also date filter, but schema varies. Doing client side filter for safety if needed
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(d => d.data()).filter(e => e.timestamp >= start && e.timestamp <= end);
    }

    async _fetchForms(userId, jobId, start, end) {
        const q = this.query(this.collection(this.db, "form_submissions"),
            this.where("userId", "==", userId),
            // this.where("jobId", "==", jobId) // Assuming forms have jobId
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(d => d.data()).filter(d => {
            // Rough match context
            const ts = d.timestamp || d.submittedAt;
            return ts >= start && ts <= end && (!d.jobId || d.jobId === jobId); // Loose match if jobId missing
        });
    }

    async _fetchMedia(userId, jobId, start, end) {
        // Placeholder: Fetch from a 'job_media' collection or similar
        return [];
    }

    _calculateTotalTime(logs) {
        // Simple logic: If we have Clock In / Clock Out pairs, calc diff.
        // For now, return rough duration between first and last log if simplistic
        if (logs.length < 2) return 0;
        // Sort
        logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let totalMs = 0;
        let clockInTime = null;

        for (const log of logs) {
            if (log.action === 'CLOCK_IN' || log.status === 'Active') {
                clockInTime = new Date(log.timestamp);
            } else if ((log.action === 'CLOCK_OUT' || log.status === 'Completed') && clockInTime) {
                totalMs += (new Date(log.timestamp) - clockInTime);
                clockInTime = null;
            }
        }
        return (totalMs / 1000 / 60 / 60).toFixed(2); // Hours
    }

    /**
     * Fetches historical tickets and logs based on a filter range.
     * @param {string} userId 
     * @param {string} filter 'shift' | '7days' | '30days' | '6months' | '12months'
     */
    async fetchHistory(userId, filter = '7days') {
        const now = new Date();
        let startDate = new Date();

        switch (filter) {
            case 'shift':
                startDate.setHours(startDate.getHours() - 24); // Approximation for "Last Shift"
                break;
            case '7days':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30days':
                startDate.setDate(now.getDate() - 30);
                break;
            case '6months':
                startDate.setMonth(now.getMonth() - 6);
                break;
            case '12months':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                startDate.setDate(now.getDate() - 7);
        }

        const isoDate = startDate.toISOString();

        // Fetch Tickets
        const ticketsQ = this.query(this.collection(this.db, "time_tickets"),
            this.where("userId", "==", userId),
            this.where("createdAt", ">=", isoDate),
            this.orderBy("createdAt", "desc")
        );

        const ticketsSnap = await this.getDocs(ticketsQ);
        return ticketsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'TICKET' }));
    }

    _calculateTrips(logs) {
        // Look for specific log actions or "Load" events
        // Assuming there might be a "Complete Trip" action or we rely on user input
        // Returns count of logs that look like trip completions
        return logs.filter(l => l.action?.toLowerCase().includes('trip') || l.action?.toLowerCase().includes('load')).length;
    }
}
