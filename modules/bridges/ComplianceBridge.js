/**
 * ComplianceBridge.js
 * Aggregates Safety and Workforce data to determine Job Site Compliance.
 * Sources: Safety Bot (Logs), Subcontractor Portal (Insurance/Docs).
 */

import { BaseBridge } from './BaseBridge.js';

export class ComplianceBridge extends BaseBridge {
    constructor() {
        super('Safety_Sub_Portal', 'Admin_Dashboard');
    }

    /**
     * EXTRACT
     * Pulls data from Safety Logs and Subcontractor Uploads.
     * Context: { safetyLogs: [], subUsers: [] }
     */
    extract(context) {
        console.log("[ComplianceBridge] Extracting compliance data...");

        // 1. Safety Logs (e.g., "Daily Huddle Signed")
        const dailyLogs = context.safetyLogs || [];

        // 2. Subcontractor Data (e.g., "Insurance Uploaded")
        const subs = context.subUsers || [];

        return { dailyLogs, subs };
    }

    /**
     * TRANSFORM
     * Calculates "Site Compliance Score".
     * Rules:
     * - Every active Sub must have 'verified' status (Insurance).
     * - Every active day must have a Safety Log.
     */
    transform(rawData) {
        const { dailyLogs, subs } = rawData;

        // Sub Compliance
        const totalSubs = subs.length;
        const verifiedSubs = subs.filter(s => s.verified).length;
        const subScore = totalSubs === 0 ? 100 : (verifiedSubs / totalSubs) * 100;

        // Safety Log Consistency (Mock Logic: Check if last 3 days have logs)
        // For prototype, just count raw logs
        const safetyScore = Math.min(dailyLogs.length * 10, 100); // 10 logs = 100%

        // Weighted Total
        // 60% Safety Habits, 40% Admin/Insurance
        const totalScore = (safetyScore * 0.6) + (subScore * 0.4);

        return {
            generatedAt: new Date().toISOString(),
            metrics: {
                totalScore: Math.round(totalScore),
                subCompliance: Math.round(subScore),
                safetyHabits: Math.round(safetyScore)
            },
            flags: subs.filter(s => !s.verified).map(s => `${s.company} missing insurance/verification`)
        };
    }

    /**
     * FETCH UTILITY
     * Retrieves Safety Manual documents (SWPs, Policies) for display.
     */
    async fetchSafetyDocs() {
        if (typeof window === 'undefined' || !window.firebaseServices) return [];

        try {
            const { db, collection, getDocs, query, orderBy } = window.firebaseServices;
            const q = query(collection(db, "safety_manual"), orderBy("title"));
            const snapshot = await getDocs(q);

            const docs = [];
            snapshot.forEach(d => docs.push(d.data()));
            return docs;
        } catch (e) {
            console.error("[ComplianceBridge] Error fetching docs:", e);
            return [];
        }
    }

    /**
     * LOAD
     * Pushes Compliance Report to Admin Dashboard.
     */
    async load(report, dbRef) {
        console.log(`[ComplianceBridge] Loading Report (Score: ${report.metrics.totalScore})...`);

        if (typeof window !== 'undefined' && window.firebaseServices) {
            const { addDoc, collection } = window.firebaseServices;
            await addDoc(collection(dbRef, 'compliance_reports'), report);
        } else {
            console.log("[ComplianceBridge] Mock DB Report:", report);
        }

        return { success: true, score: report.metrics.totalScore };
    }
}
