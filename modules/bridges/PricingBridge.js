/**
 * PricingBridge.js
 * Bridges the gap between Sketch Geometry and Estimate Line Items.
 * Uses specialized logic (like Snow Efficiency Models) to transform raw area/length into costs.
 */

import { BaseBridge } from './BaseBridge.js';
import { calculateSnowServiceCost } from '../snow_calc/snow-logic-advanced.js';

export class PricingBridge extends BaseBridge {
    constructor() {
        super('Sketch', 'Estimate');
    }

    /**
     * EXTRACT
     * Pulls measurements and user-defined inputs from the Sketch App State.
     */
    extract(context) {
        const { drawings, calculatorManager } = context;

        // Extract Standard Measurements
        const measurements = drawings.map(d => ({
            id: d.id,
            type: d.measurementType, // 'area', 'length', 'volume'
            value: d.measurement,
            serviceId: d.service
        }));

        // Extract Advanced Trade Inputs (if active)
        let tradeInputs = null;
        if (calculatorManager && calculatorManager.mode === 'snow') {
            // For now, we assume the inputs are available in the calculator's state or DOM
            // In a perfect world, calculatorManager would expose a clear .getInputs() method.
            // We will implement a basic extraction here assuming calculatorManager holds data.
            tradeInputs = calculatorManager.data || {};
        }

        return { measurements, tradeInputs, mode: calculatorManager ? calculatorManager.mode : 'standard' };
    }

    /**
     * TRANSFORM
     * Applies the complex pricing models.
     */
    transform(rawData) {
        const { measurements, tradeInputs, mode } = rawData;
        let lineItems = [];
        let summary = { total: 0, type: mode };

        // 1. Process Standard Line Items (Simple Pricing)
        measurements.forEach(m => {
            // ... (Logic to look up simple unit prices would go here)
        });

        // 2. Process Advanced Trade Models
        if (mode === 'snow' && tradeInputs) {
            // Map Sketch Area to Snow Inputs (Naive mapping for V1)
            // Ideally, we'd loop through specific "Snow Areas" defined in Sketch.

            // Construct the input object expected by snow-logic-advanced.js
            const snowInputs = {
                clearing: {
                    enabled: true,
                    loaderArea: parseFloat(tradeInputs.loaderArea) || 0,
                    skidSteerArea: parseFloat(tradeInputs.skidSteerArea) || 0,
                    shovelArea: parseFloat(tradeInputs.shovelArea) || 0
                },
                hauling: {
                    enabled: tradeInputs.haulingEnabled || false,
                    // ... other mapping
                },
                salting: {
                    enabled: tradeInputs.saltingEnabled || false
                },
                // ... Pass through other inputs
                ...tradeInputs
            };

            const result = calculateSnowServiceCost(snowInputs);

            lineItems.push({
                description: 'Snow Clearing Service (Seasonal)',
                price: result.totals.seasonalPrice,
                details: result
            });

            summary.total = result.totals.seasonalPrice;
        }

        return { lineItems, summary };
    }

    /**
     * LOAD
     * Updates the Estimate in Firestore.
     */
    async load(processedData, estimateRef) {
        console.log("[PricingBridge] Loading Estimate...", processedData);

        // Use global services if available, otherwise mock
        if (typeof window !== 'undefined' && window.firebaseServices) {
            const { updateDoc } = window.firebaseServices;
            await updateDoc(estimateRef, {
                lineItems: processedData.lineItems,
                estimatedTotal: processedData.summary.total,
                lastCalculated: new Date().toISOString()
            });
        } else {
            // Test Mode Mock
            console.log("[PricingBridge] Mock DB Update:", {
                lineItems: processedData.lineItems,
                total: processedData.summary.total
            });
        }

        return { success: true };
    }
}
