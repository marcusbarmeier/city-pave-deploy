
import * as DispatchModule from './index.js';

// --- MOCK FIREBASE ---
const mockDB = {
    estimates: [
        { id: 'job_101', status: 'Accepted', customerInfo: { name: 'Pave Corp', address: '123 Industrial Dr' } },
        { id: 'job_102', status: 'In Progress', customerInfo: { name: 'City Hall', address: '500 Main St' } }
    ],
    dispatch_schedule: [],
    users: [
        { id: 'u1', data: () => ({ name: 'Alice (Foreman)' }) },
        { id: 'u2', data: () => ({ name: 'Bob (Laborer)' }) }
    ],
    assets: [
        { id: 'a1', data: () => ({ unitId: 'T-99', type: 'Dump Truck' }) }
    ],
    mail: []
};

// Mock Firebase Services
window.firebaseServices = {
    db: {},
    collection: (db, name) => name,
    query: (col, ...constraints) => ({ col, constraints }),
    where: (field, op, val) => ({ field, op, val }),
    orderBy: (field) => ({ field }),
    getDocs: async (q) => {
        const colName = q.col || q; // Handle simple collection ref
        let data = mockDB[colName] || [];

        // Simple mock filtering
        if (q.constraints) {
            q.constraints.forEach(c => {
                if (c.op === '==') data = data.filter(d => d[c.field] === c.val);
                // "in" and others ignored for simplicity in this basic sim
            });
        }

        return {
            empty: data.length === 0,
            forEach: (cb) => data.forEach(d => cb({ id: d.id || 'mock_id', data: () => d }))
        };
    },
    addDoc: async (colName, data) => {
        const id = 'doc_' + Date.now();
        const doc = { ...data, id };
        if (mockDB[colName]) mockDB[colName].push(doc);
        simLog(`[DB WRITE] Added to ${colName}:`, data);
        return { id };
    },
    doc: (db, col, id) => ({ col, id }),
    getDoc: async (ref) => {
        const doc = mockDB[ref.col].find(d => d.id === ref.id);
        return {
            exists: () => !!doc,
            data: () => doc
        };
    },
    updateDoc: async (ref, updates) => {
        const docIndex = mockDB[ref.col].findIndex(d => d.id === ref.id);
        if (docIndex > -1) {
            mockDB[ref.col][docIndex] = { ...mockDB[ref.col][docIndex], ...updates };
            simLog(`[DB UPDATE] Updated ${ref.col}/${ref.id}:`, updates);
        }
    }
};

// --- SIMULATION RUNNER ---
const consoleOutput = document.getElementById('console-output');
function simLog(msg, data = '') {
    const div = document.createElement('div');
    div.className = "mb-1";
    div.innerHTML = `<span class="text-gray-400">[${new Date().toLocaleTimeString()}]</span> ${msg} <span class="text-yellow-300">${data ? JSON.stringify(data).substring(0, 100) + '...' : ''}</span>`;
    consoleOutput.appendChild(div);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
    console.log(msg, data);
}

function assert(condition, desc) {
    const div = document.createElement('div');
    if (condition) {
        div.innerHTML = `✅ <span class="pass">PASS:</span> ${desc}`;
    } else {
        div.innerHTML = `❌ <span class="fail">FAIL:</span> ${desc}`;
    }
    consoleOutput.appendChild(div);
}

async function runSimulation() {
    simLog("Starting 'The Flexible Fleet' Simulation...");

    // 1. Initialize Module
    simLog("Step 1: Initializing Dispatch Module...");
    await DispatchModule.loadReadyJobs();
    await DispatchModule.setupDispatchCrewBuilder();

    // 2. Open Dispatch Modal for Job 101
    simLog("Step 2: Dispatcher selects 'Pave Corp' (Job 101)...");
    DispatchModule.openDispatchModal('job_101', mockDB.estimates[0]);

    // 3. Configure as "Broadcast" (Simulating User Input)
    simLog("Step 3: Configuring 'Broadcast' Dispatch...");
    document.getElementById('dispatch-broadcast-mode').checked = true;
    document.getElementById('dispatch-target-group').value = 'laborers';
    document.getElementById('dispatch-notes').value = "Need extra hands for raking.";

    // 4. Submit
    simLog("Step 4: Submitting Dispatch...");
    await DispatchModule.saveDispatchAssignment();

    // 5. Verify Database State
    simLog("Step 5: Verifying DB Records...");
    const lastDispatch = mockDB.dispatch_schedule[mockDB.dispatch_schedule.length - 1];

    assert(lastDispatch, "Dispatch record created");

    if (lastDispatch) {
        assert(lastDispatch.status === "Open" || lastDispatch.status === "Pending", "Status should be 'Open' for broadcast (Current: " + lastDispatch.status + ")");
        assert(lastDispatch.targetGroup === "laborers", "Record has targetGroup 'laborers' (Current: " + lastDispatch.targetGroup + ")");
    }

    // 6. Simulate Employee "Claiming" (The Missing Flow)
    simLog("Step 6: Simulating Employee 'Claim' Action...");

    if (lastDispatch && lastDispatch.targetGroup) {
        // Act as User 'u2' (Bob) claiming the job
        const user = { id: 'u2', name: 'Bob (Laborer)' };
        const result = await DispatchModule.claimJob(lastDispatch.id, user);

        simLog("Claim Result:", result);
        assert(result.success, "Claim was successful");

        // 7. Verify Job is now Dispatched
        const scheduleRef = mockDB.dispatch_schedule.find(d => d.id === lastDispatch.id);
        assert(scheduleRef.status === "Dispatched", "Job status updated to 'Dispatched'");
        assert(scheduleRef.claimedBy === 'u2', "Job claimed by u2");
    } else {
        assert(false, "Cannot claim: Target Group missing or Dispatch failed.");
    }

    simLog("Simulation Complete.");
}

document.getElementById('run-sim-btn').addEventListener('click', runSimulation);
