/**
 * GrowthBridge.js
 * Bridges Marketing/CRM Leads to Estimator.
 * Converts "Qualified" leads into "Draft" Estimates.
 */

import { BaseBridge } from './BaseBridge.js';

export class GrowthBridge extends BaseBridge {
    constructor() {
        super('GrowthCRM', 'Estimator');
    }

    /**
     * EXTRACT
     * Pulls leads marked as "Qualified" from the CRM.
     * Context: { leads: [] } or database query
     */
    extract(context) {
        console.log("[GrowthBridge] Scanning CRM for qualified leads...");
        const leads = context.leads || []; // In real app, this would be a DB query

        // Filter for Qualified leads that haven't been processed
        // (Mocking the 'not processed' check)
        return leads.filter(l => l.status === 'Qualified');
    }

    /**
     * TRANSFORM
     * Maps Lead Data (Name, Address) to Estimate Customer Object.
     */
    transform(rawLeads) {
        console.log(`[GrowthBridge] Transforming ${rawLeads.length} leads...`);

        return rawLeads.map(lead => ({
            customerInfo: {
                name: lead.contactName || lead.businessName,
                email: lead.email,
                phone: lead.phone,
                address: lead.address || 'Address Pending'
            },
            status: 'Draft',
            source: 'Growth Engine',
            sourceLeadId: lead.id,
            createdAt: new Date().toISOString(),
            lineItems: [] // Empty estimate to start
        }));
    }

    /**
     * LOAD
     * Creates new Estimate Documents in Firestore.
     */
    async load(processedEstimates, dbRef) {
        console.log(`[GrowthBridge] Creating ${processedEstimates.length} draft estimates...`);

        const results = [];

        if (typeof window !== 'undefined' && window.firebaseServices) {
            const { addDoc, collection } = window.firebaseServices;
            for (const est of processedEstimates) {
                const ref = await addDoc(collection(dbRef, 'estimates'), est);
                results.push({ id: ref.id, sourceId: est.sourceLeadId });
            }
        } else {
            // Mock
            console.log("[GrowthBridge] Mock DB Insert:", processedEstimates);
            processedEstimates.forEach((e, i) => results.push({ id: `mock_est_${i}`, sourceId: e.sourceLeadId }));
        }

        return { success: true, created: results };
    }
}
