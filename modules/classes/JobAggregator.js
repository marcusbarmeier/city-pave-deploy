// © 2025 City Pave. All Rights Reserved.
// Filename: JobAggregator.js

export class JobAggregator {
    constructor(firebaseServices) {
        this.services = firebaseServices;
        this.db = firebaseServices.db;
        this.collection = firebaseServices.collection;
        this.query = firebaseServices.query;
        this.where = firebaseServices.where;
        this.getDocs = firebaseServices.getDocs;
        this.orderBy = firebaseServices.orderBy;
    }

    /**
     * Aggregates all media/assets for a specific Job ID.
     * @param {string} jobId - The Job ID (Estimate ID).
     */
    async getJobAssets(jobId) {
        if (!jobId) throw new Error("Missing jobId");

        try {
            const [forms, tickets, expenses] = await Promise.all([
                this.fetchJobForms(jobId),
                this.fetchJobTickets(jobId),
                this.fetchJobExpenses(jobId)
            ]);

            // Normalize them into a single "Asset" structure for the gallery
            // Structure: { type: 'image'|'doc'|'video', url: '...', thumbnail: '...', title: '...', date: '...', source: '...' }

            const gallery = [];

            // 1. Process Forms (Incident Photos, Inspection Photos)
            forms.forEach(f => {
                const date = f.submittedAt ? new Date(f.submittedAt) : new Date();

                // Check for 'photos' array in form data (common pattern)
                // Or specific fields like 'incidentPhoto'
                // This depends on the form schema. We'll look for known URL patterns or specific fields.

                if (f.data) {
                    // Generic recursive search for URLs in the form data could be useful, 
                    // but let's stick to known fields for now to avoid junk.

                    // Safety/Incident Forms often have photos
                    if (f.data.photos && Array.isArray(f.data.photos)) {
                        f.data.photos.forEach(p => {
                            gallery.push({
                                type: 'image',
                                url: p.url || p, // Handle string or object
                                title: `${f.formTitle} Photo`,
                                date: date,
                                source: 'Form',
                                user: f.userName
                            });
                        });
                    }
                }
            });

            // 2. Process Tickets (Signatures, Paper Tickets)
            tickets.forEach(t => {
                const date = t.date ? new Date(t.date) : new Date();

                if (t.signatureUrl) {
                    gallery.push({
                        type: 'image',
                        url: t.signatureUrl,
                        title: `Ticket #${t.ticketNumber || 'Draft'} Signature`,
                        date: date,
                        source: 'Ticket',
                        user: t.userName
                    });
                }
                if (t.paperTicketUrl) {
                    gallery.push({
                        type: 'image',
                        url: t.paperTicketUrl,
                        title: `Ticket #${t.ticketNumber || 'Draft'} Paper Copy`,
                        date: date,
                        source: 'Ticket',
                        user: t.userName
                    });
                }
            });

            // 3. Process Expenses (Receipts)
            expenses.forEach(e => {
                const date = e.date ? new Date(e.date) : new Date();
                if (e.receiptUrl) {
                    gallery.push({
                        type: 'image',
                        url: e.receiptUrl,
                        title: `Expense: ${e.description || 'Receipt'}`,
                        date: date,
                        source: 'Expense',
                        user: e.userName
                    });
                }
            });

            // Sort by date desc
            return gallery.sort((a, b) => b.date - a.date);

        } catch (error) {
            console.error("Error aggregating job assets:", error);
            return []; // Return empty on error to not crash UI
        }
    }

    async fetchJobForms(jobId) {
        // Needs Index: jobId ASC, submittedAt DESC
        const q = this.query(
            this.collection(this.db, "form_submissions"),
            this.where("jobId", "==", jobId),
            this.orderBy("submittedAt", "desc")
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async fetchJobTickets(jobId) {
        // Needs Index: jobId ASC, date DESC
        const q = this.query(
            this.collection(this.db, "time_tickets"),
            this.where("jobId", "==", jobId),
            this.orderBy("date", "desc")
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async fetchJobExpenses(jobId) {
        // Needs Index: jobId ASC, date DESC
        const q = this.query(
            this.collection(this.db, "expenses"),
            this.where("jobId", "==", jobId),
            this.orderBy("date", "desc")
        );
        const snap = await this.getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}
