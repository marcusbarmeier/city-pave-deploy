
import { TIER_LEVELS, CAPABILITIES, PermissionGate, BUNDLES } from './tiers.js';

console.log('--- Unit Test: Subscription & Tier Framework ---\n');

const gate = new PermissionGate();

// Test Helper
function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
    } else {
        console.error(`❌ FAIL: ${message}`);
    }
}

// 1. Test LEVEL 1 (Basic)
console.log('Testing LEVEL 1...');
gate.setTier(TIER_LEVELS.LEVEL_1);
assert(!gate.can(CAPABILITIES.AI_OVERLAY_GLOBAL), 'Level 1 NOT allow Global AI');
assert(!gate.can(CAPABILITIES.GEO_FENCING), 'Level 1 NOT allow Geo-Fencing');
assert(gate.can(CAPABILITIES.BUNDLE_ONLY_BRIDGING), 'Level 1 ALLOW Bundle Only Bridging');

// 2. Test LEVEL 2 (Mid)
console.log('\nTesting LEVEL 2...');
gate.setTier(TIER_LEVELS.LEVEL_2);
assert(!gate.can(CAPABILITIES.AI_OVERLAY_GLOBAL), 'Level 2 NOT allow Global AI');
assert(gate.can(CAPABILITIES.AI_OVERLAY_PAGE), 'Level 2 ALLOW Page-Level AI');
assert(gate.can(CAPABILITIES.MANUAL_DATA_TRANSFER), 'Level 2 ALLOW Manual Data Transfer');

// 3. Test LEVEL 3 (Top)
console.log('\nTesting LEVEL 3...');
gate.setTier(TIER_LEVELS.LEVEL_3);
assert(gate.can(CAPABILITIES.AI_OVERLAY_GLOBAL), 'Level 3 ALLOW Global AI');
assert(gate.can(CAPABILITIES.GEO_FENCING), 'Level 3 ALLOW Geo-Fencing');
assert(gate.can(CAPABILITIES.FULL_DATA_BRIDGING), 'Level 3 ALLOW Full Data Bridging');

// 4. Test Bundles
console.log('\nTesting Bundles...');
const bundleKeys = Object.keys(BUNDLES);
assert(bundleKeys.length >= 4, 'Bundles defined (at least 4)');
assert(BUNDLES.ESTIMATOR_SUITE.modules.includes('estimator'), 'Estimator Suite includes estimator');
assert(BUNDLES.FIELD_OPS.modules.includes('dispatch'), 'Field Ops includes dispatch');
assert(BUNDLES.GROWTH_ENGINE.modules.includes('growth'), 'Growth Engine includes growth');
assert(BUNDLES.ENTERPRISE.modules.length > 5, 'Enterprise includes many modules');

// 5. Test Dual-Layer Governance
console.log('\nTesting Dual-Layer Governance...');

// Scenario A: Enterprise Org (Level 3), but User blocked to Level 1
gate.setTier(TIER_LEVELS.LEVEL_3);
let isAllowed = gate.check(CAPABILITIES.AI_OVERLAY_GLOBAL, TIER_LEVELS.LEVEL_1);
assert(!isAllowed, 'Level 3 Org + Level 1 User -> NO Global AI');

isAllowed = gate.check(CAPABILITIES.BUNDLE_ONLY_BRIDGING, TIER_LEVELS.LEVEL_1);
assert(isAllowed, 'Level 3 Org + Level 1 User -> ALLOW Bundle Only Bridge');


// Scenario B: Pro Org (Level 2), User wants Level 3 features
gate.setTier(TIER_LEVELS.LEVEL_2);
isAllowed = gate.check(CAPABILITIES.AI_OVERLAY_GLOBAL, TIER_LEVELS.LEVEL_3);
assert(!isAllowed, 'Level 2 Org + Level 3 User -> NO Global AI (Capped by Org)');

isAllowed = gate.check(CAPABILITIES.AI_OVERLAY_PAGE, TIER_LEVELS.LEVEL_3);
assert(isAllowed, 'Level 2 Org + Level 3 User -> ALLOW Page AI (Effective Level 2)');

console.log('\n--- All Tests Completed ---');
