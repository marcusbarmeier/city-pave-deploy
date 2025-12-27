
/**
 * Test: Full End-to-End Repair Verification
 * 
 * 1. Simulates Employee submitting a request under "Pending Review".
 * 2. Simulates Mechanic App loading that request.
 * 3. Verifies data consistency.
 */

async function runEndToEndTest() {
    console.log("🚀 Starting End-to-End Test: Repair Request -> Mechanic Dashboard");

    const { db, collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } = window.firebaseServices;

    // --- STEP 1: EMPLOYEE SUBMISSION ---
    console.log("Stage 1: Simulating Employee Submission...");
    const testId = `TEST-${Date.now()}`;
    const ticketData = {
        assetId: 'T-999',
        description: `E2E Test Ticket ${testId}`,
        priority: 'High',
        status: 'Pending Review',
        submittedBy: 'e2e-tester-uid',
        submittedByName: 'E2E Tester',
        createdAt: new Date().toISOString(),
        location: { lat: 34.0522, lng: -118.2437 },
        attachments: []
    };

    let ticketId;

    try {
        const docRef = await addDoc(collection(db, 'maintenance_tickets'), ticketData);
        ticketId = docRef.id;
        console.log(`✅ Ticket Created ID: ${ticketId}`);
    } catch (e) {
        console.error("❌ Stage 1 Failed:", e);
        return;
    }

    // --- STEP 2: MECHANIC APP VERIFICATION ---
    // In a real browser test we'd switch URLs, but here we can simulate the "Mechanic Read" logic
    // by running the EXACT query the Mechanic App uses.

    console.log("Stage 2: Verifying Mechanic App Query Access...");
    // Mechanic Query: collection(db, "maintenance_tickets"), orderBy("createdAt", "desc")

    setTimeout(async () => {
        try {
            const mechQuery = query(collection(db, "maintenance_tickets"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(mechQuery);

            const found = snapshot.docs.find(d => d.id === ticketId);

            if (found) {
                const data = found.data();
                console.log("✅ MECHANIC VERIFICATION SUCCESS!");
                console.log("   - Ticket Found in Query");
                console.log(`   - Status: ${data.status} (Expected: Pending Review)`);
                console.log(`   - Asset: ${data.assetId} (Expected: T-999)`);
                console.log(`   - Description: ${data.description}`);
                console.log(`   - Created At: ${data.createdAt}`);

                if (!data.description || !data.createdAt) {
                    console.error("❌ MISSING DATA FIELDS! Check mechanic.js mapping.");
                } else {
                    console.log("✅ All required fields present.");
                }

                // Cleanup
                console.log("🧹 Cleaning up test data...");
                await updateDoc(doc(db, 'maintenance_tickets', ticketId), { status: 'Archived (Test)' });
                console.log("✅ Test Complete.");
            } else {
                console.error("❌ MECHANIC VERIFICATION FAILED: Ticket not found in Mechanic Query results.");
            }

        } catch (e) {
            console.error("❌ Stage 2 Failed (Mechanic Query Error):", e);
            if (e.message.includes("index")) {
                console.warn("⚠️  INDEX MISSING: The Mechanic App needs a composite index for this query if filters are applied.");
            }
        }
    }, 2000);
}

window.runEndToEndTest = runEndToEndTest;
console.log("Test script loaded. Run 'window.runEndToEndTest()' to execute.");
