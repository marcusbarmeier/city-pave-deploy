/**
 * FinanceBridge.js
 * Bridges Expense Data to Job Estimates (Actual vs Estimated).
 * Enables Real-Time Job Costing.
 */

import { BaseBridge } from './BaseBridge.js';

export class FinanceBridge extends BaseBridge {
    constructor() {
        super('ExpenseManager', 'JobCosting');
    }

    /**
     * EXTRACT
     * Pulls approved expenses for a specific Job.
     * Context: { jobId: string, expenses: [] }
     */
    extract(context) {
        console.log(`[FinanceBridge] Extracting expenses for Job: ${context.jobId}...`);

        // Filter for expenses related to this job
        // In real app, this might be a DB query: where('jobId', '==', context.jobId)
        return context.expenses.filter(e => e.jobId === context.jobId);
    }

    /**
     * TRANSFORM
     * Aggregates expenses into cost categories.
     */
    transform(rawExpenses) {
        console.log(`[FinanceBridge] Transforming ${rawExpenses.length} expenses...`);

        const costs = {
            totalActual: 0,
            breakdown: {
                material: 0,
                labor: 0,
                equipment: 0,
                other: 0
            },
            updatedAt: new Date().toISOString()
        };

        rawExpenses.forEach(exp => {
            const amount = parseFloat(exp.amount) || (exp.totalKm * 0.58) || 0; // Fallback for mileage
            costs.totalActual += amount;

            // Simple Keyword Categorization
            const desc = (exp.description || '').toLowerCase();
            if (desc.includes('material') || desc.includes('asphalt') || desc.includes('concrete')) {
                costs.breakdown.material += amount;
            } else if (desc.includes('labor') || desc.includes('crew')) {
                costs.breakdown.labor += amount;
            } else if (desc.includes('truck') || desc.includes('fuel') || exp.type === 'mileage') {
                costs.breakdown.equipment += amount;
            } else {
                costs.breakdown.other += amount;
            }
        });

        // Round all numbers
        costs.totalActual = parseFloat(costs.totalActual.toFixed(2));
        for (const k in costs.breakdown) {
            costs.breakdown[k] = parseFloat(costs.breakdown[k].toFixed(2));
        }

        return { jobId: rawExpenses[0]?.jobId, costs };
    }

    /**
     * LOAD
     * Updates the Estimate with Actual Costs.
     */
    async load(processedData, dbRef) {
        console.log(`[FinanceBridge] Loading Job Costing Data...`, processedData.costs);

        if (typeof window !== 'undefined' && window.firebaseServices) {
            const { updateDoc, doc } = window.firebaseServices;
            // Assuming dbRef is the 'estimates' collection
            const estimateDocRef = doc(dbRef, 'estimates', processedData.jobId);

            await updateDoc(estimateDocRef, {
                actualCosts: processedData.costs,
                jobCostingLastUpdated: processedData.costs.updatedAt
            });
        } else {
            console.log("[FinanceBridge] Mock DB Update:", processedData);
        }

        return { success: true, totalActual: processedData.costs.totalActual };
    }
}
