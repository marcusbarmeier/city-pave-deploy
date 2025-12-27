/**
 * EmployeeBridge.js
 * Data Bridge for the Employee Module.
 * Syncs Time Logs and Safety Data to the Admin Dashboard / Payroll System.
 */

import { BaseBridge } from './BaseBridge.js';

export class EmployeeBridge extends BaseBridge {
    constructor() {
        super('employee', 'admin_dashboard');
    }

    /**
     * EXTRACT
     * Fetches raw time logs for a given user or all users.
     * Context: { db, userId, dateRange }
     */
    async extract(context) {
        console.log(`[EmployeeBridge] Extracting time logs for ${context.userId || 'ALL'}...`);

        // Mock Data Extraction (Simulating Firestore Query)
        // In real app: 
        // const q = query(collection(context.db, 'time_logs'), where(...));
        // const snap = await getDocs(q);
        // return snap.docs.map(d => d.data());

        return [
            { id: 'log1', userId: 'u1', date: '2025-05-12', hours: 8.5, job: 'Paving Job A' },
            { id: 'log2', userId: 'u1', date: '2025-05-13', hours: 9.0, job: 'Paving Job B' },
            { id: 'log3', userId: 'u2', date: '2025-05-12', hours: 8.0, job: 'Paving Job A' }
        ];
    }

    /**
     * TRANSFORM
     * Aggregates hours, calculates overtime, and formats for Payroll.
     */
    transform(rawData) {
        console.log(`[EmployeeBridge] Transforming ${rawData.length} records...`);

        const report = {
            generatedAt: new Date().toISOString(),
            totalHours: 0,
            overtimeHours: 0,
            userStats: {}
        };

        rawData.forEach(log => {
            if (!report.userStats[log.userId]) {
                report.userStats[log.userId] = { total: 0, ot: 0, logs: [] };
            }

            report.totalHours += log.hours;
            report.userStats[log.userId].total += log.hours;

            // Simple OT Rule: > 8 hours/day
            if (log.hours > 8) {
                const ot = log.hours - 8;
                report.overtimeHours += ot;
                report.userStats[log.userId].ot += ot;
            }

            report.userStats[log.userId].logs.push(log.id);
        });

        return report;
    }

    /**
     * LOAD
     * Pushes the payroll report to the destination (or logs it).
     */
    async load(processedData, destinationRef) {
        console.log("[EmployeeBridge] Loading data to Payroll System...", processedData);

        // Simulating an API push or DB write
        // await setDoc(destinationRef, processedData);

        return { success: true, reportId: `rpt_${Date.now()}` };
    }
}
