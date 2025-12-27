/**
 * Repair Module "Stress Simulator"
 * 
 * Scenario: "The Invisible Ticket"
 * 1. User submits a Repair Request for "Truck 99" (Flat Tire).
 * 2. We verify it lands in 'repair_tickets'.
 * 3. We CRITICALLY check if it lands in 'maintenance_tickets' (The Mechanic's view).
 * 4. We measure the time taken and report the "Disconnect".
 */

/**
 * Repair Module "Stress Simulator" (UI Integration)
 * 
 * Scenario: "The Full Cycle + Fix Verification"
 * 1. Locate the Form Elements on the screen.
 * 2. Select a unit from the new Dropdown (Simulating User Input).
 * 3. Type a description.
 * 4. Click Submit.
 * 5. Verify the ticket appears in 'maintenance_tickets' with status 'Pending Review'.
 */

export async function runSimulation() {
    console.clear();
    console.log("%c 🛠️ REPAIR MODULE: UI STRESS TEST 🛠️ ", "background: #222; color: #bada55; font-size: 16px; padding: 10px;");

    // Import SDK for Verification Steps
    // Now using window.firebaseServices since we fixed it
    const { db, collection, getDocs, query, where, orderBy, limit } = window.firebaseServices;

    // 1. Check if Form Exists
    const equipSelect = document.getElementById('repair-equipment-id');
    const descInput = document.getElementById('repair-description');
    const submitBtn = document.querySelector('form button[type="submit"]');

    if (!equipSelect || !descInput || !submitBtn) {
        console.error("❌ UI Element Missing! setup failed.");
        console.log("Ensure you are on the Repair Request view.");
        return;
    }

    console.group("Step 1: Simulating User Input");

    // Select 2nd option if available
    if (equipSelect.options.length > 1) {
        equipSelect.selectedIndex = 1;
        console.log(`Selected Unit: ${equipSelect.value}`);
    } else {
        // Mock it if text input
        equipSelect.value = "SIM-TRUCK-99";
    }

    const testDesc = `Simulated UI Test ${Date.now()}`;
    descInput.value = testDesc;
    console.log(`Typed Description: "${testDesc}"`);

    // Mock Photo (Can't programmatically set file input due to security, skipping)
    console.log("Info: Skipping photo upload in automated UI test (browser security restriction).");

    console.groupEnd();

    console.group("Step 2: Submitting Form");
    console.log("Clicking Submit...");
    submitBtn.click();

    // Wait for async operations
    console.log("Waiting for network...");
    await new Promise(r => setTimeout(r, 3000)); // Wait 3s
    console.groupEnd();

    console.group("Step 3: Verifying Database");

    try {
        // Query Maintenance Tickets for this description
        const q = query(
            collection(db, 'maintenance_tickets'),
            where('description', '==', testDesc),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const ticket = snapshot.docs[0].data();
            console.log("✅ SUCCESS! Ticket found in [maintenance_tickets].");
            console.log("Status:", ticket.status);
            console.log("Origin:", ticket.origin);

            if (ticket.status === 'Pending Review') {
                console.log("✅ Status Correct: 'Pending Review'");
            } else {
                console.warn(`⚠️ Status Mismatch: Expected 'Pending Review', got '${ticket.status}'`);
            }
        } else {
            console.error("❌ FAILURE: Ticket NOT found in DB after UI submission.");
        }

    } catch (e) {
        console.error("Verification Error:", e);
    }
    console.groupEnd();
}

// Attach to window for easy console execution
window.runRepairSimulation = runSimulation;
