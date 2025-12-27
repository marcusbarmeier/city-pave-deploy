const admin = require('firebase-admin');
const sinon = require('sinon');

// 1. Initialize admin logic for mocking
// We DON'T call initializeApp here because index.js does it.
// Instead, we stub it so index.js doesn't crash if we did (or if we want to control it).
// But better yet, we stub it to do NOTHING, so we can control everything via stubs.

if (!admin.initializeApp.restore && !admin.initializeApp.displayname) {
    sinon.stub(admin, 'initializeApp').returns();
}


// 2. Setup Test SDK
const test = require('firebase-functions-test')({
    projectId: 'city-pave-estimator',
});

// 3. Stub Firestore
const firestoreStub = {
    collection: sinon.stub().returnsThis(),
    doc: sinon.stub().returnsThis(),
    batch: sinon.stub().returns({
        set: sinon.spy(),
        commit: sinon.stub().resolves()
    }),
    where: sinon.stub().returnsThis(),
    get: sinon.stub().resolves({
        forEach: (cb) => {
            // Mock data for analysis
            cb({ data: () => ({ status: 'Active', grandTotal: 1000, isSynthetic: true }) });
            cb({ data: () => ({ status: 'Pending', grandTotal: 500, isSynthetic: true }) });
        }
    })
};

// Start Stubbing Firestore
if (!admin.firestore.restore) {
    sinon.stub(admin, 'firestore').get(() => () => firestoreStub);
}

// Import Functions AFTER stubbing
const myFunctions = require('./synthetic_agent');

(async () => {
    console.log("🧪 STARTING VERIFICATION: Synthetic Data Agent");

    try {
        // TEST 1: Generate Data
        console.log("\n[1] Testing generateSyntheticData('jobs', 5)...");
        // myFunctions.generateSyntheticData is the function itself now (from exports)
        const wrappedGenerate = test.wrap(myFunctions.generateSyntheticData);

        const genResult = await wrappedGenerate(
            { type: 'jobs', count: 5 },
            { auth: { uid: 'test-admin', token: { role: 'admin' } } }
        );

        console.log("   -> Result:", genResult);
        if (genResult.success && genResult.count === 5) {
            console.log("   ✅ SUCCESS: Generation logic executed.");
        } else {
            console.error("   ❌ FAILED: Unexpected result.");
        }

        // TEST 2: Analyze Data
        console.log("\n[2] Testing analyzeDataRelationships()...");
        const wrappedAnalyze = test.wrap(myFunctions.analyzeDataRelationships);

        const analyzeResult = await wrappedAnalyze(
            {},
            { auth: { uid: 'test-admin' } }
        );

        console.log("   -> Result:", analyzeResult);
        if (analyzeResult.jobs && analyzeResult.assets) {
            console.log("   ✅ SUCCESS: Analysis returned structured data.");
        } else {
            console.error("   ❌ FAILED: Missing data key.");
        }

    } catch (e) {
        console.error("\n💥 SYSTEM ERROR:", e);
    } finally {
        test.cleanup();
        sinon.restore(); // Restore admin.firestore
    }
})();
