/**
 * Test Script for Synapse Bridge
 * Verifies that the correlation algorithm correctly identifies hidden links between modules.
 */

import { SynapseBridge } from '../modules/module_tuner/synapse_bridge.js';

async function runTests() {
    console.log("Starting Synapse Bridge Verification...");
    const bridge = new SynapseBridge();
    let passed = 0;
    let failed = 0;

    // Test Case 1: Correlated Breakdown and Project Delay
    try {
        const mockData1 = {
            fleet: { lastBreakdown: { assetId: 'T-101', loc: 'Zone-A' }, activeRepairs: 1 },
            sketch: { delays: [{ projectId: 'P-500', loc: 'Zone-A' }], activeProjects: 1 },
            employee: { active: true }
        };

        const insights1 = bridge.calculateCorrelations(mockData1);
        const rootCause = insights1.find(i => i.title.includes("Root Cause"));

        if (rootCause && rootCause.score === 98) {
            console.log("✅ [PASS] Detected Breakdown <-> Delay Correlation");
            passed++;
        } else {
            console.error("❌ [FAIL] Failed to detect Breakdown <-> Delay correlation");
            console.log("Insights Found:", insights1);
            failed++;
        }
    } catch (e) {
        console.error("❌ [FAIL] Exception in Test 1", e);
        failed++;
    }

    // Test Case 2: Nominal System
    try {
        const mockData2 = {
            fleet: { lastBreakdown: null, activeRepairs: 0 },
            sketch: { delays: [], activeProjects: 5 },
            employee: { active: true }
        };

        const insights2 = bridge.calculateCorrelations(mockData2);
        const nominal = insights2.find(i => i.title === "System Nominal");

        if (nominal) {
            console.log("✅ [PASS] Detected Nominal System state");
            passed++;
        } else {
            console.error("❌ [FAIL] Failed to detect Nominal state");
            failed++;
        }
    } catch (e) {
        console.error("❌ [FAIL] Exception in Test 2", e);
        failed++;
    }

    console.log(`\nTest Summary: ${passed} Passed, ${failed} Failed.`);
}

runTests();
