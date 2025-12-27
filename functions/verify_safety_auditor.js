const admin = require('firebase-admin');
const sinon = require('sinon');

// 0. IMPORTANT: Mock FieldValue BEFORE anything else tries to use it.
// The code in safety_auditor.js uses `admin.firestore.FieldValue.serverTimestamp()`.
// `admin.firestore` is a function, `admin.firestore.FieldValue` is a property on it (or loosely on admin in some versions).
// But for testing, we just need it to exist.
if (!admin.firestore.FieldValue) {
    admin.firestore.FieldValue = {
        serverTimestamp: () => new Date().toISOString()
    };
}

// 1. Initialize admin logic for mocking
if (!admin.initializeApp.restore && !admin.initializeApp.displayname) {
    sinon.stub(admin, 'initializeApp').returns();
}

// 2. Setup Test SDK
const test = require('firebase-functions-test')({
    projectId: 'city-pave-estimator',
});

// 3. Mock Firestore Data
const mockDb = {
    // 1. time_logs (Active Shift > 14h)
    shifts: [
        { id: 'shift_fatigue', data: () => ({ userId: 'u1', userName: 'Tired Tom', status: 'active', startTime: new Date(Date.now() - 15 * 3600000).toISOString() }) },
        { id: 'shift_ok', data: () => ({ userId: 'u2', userName: 'Fresh Fred', status: 'active', startTime: new Date().toISOString() }) }
    ],
    // 2. form_submissions (Pre-Trips)
    forms: [
        // u2 submitted pre-trip
        { id: 'form_pt_u2', data: () => ({ userId: 'u2', formType: 'pre-trip', submittedAt: new Date().toISOString() }) },
        // u1 has NO pre-trip (will come up empty in query)
        // Keyword risk form
        { id: 'form_accident', data: () => ({ userId: 'u3', formType: 'incident', submittedAt: new Date().toISOString(), notes: "There was a bad accident here." }) }
    ],
    // 3. maintenance_tickets (Stale)
    tickets: [
        { id: 'ticket_old', data: () => ({ status: 'Open', reportedAt: new Date(Date.now() - 40 * 86400000).toISOString() }) }, // 40 days old
        { id: 'ticket_new', data: () => ({ status: 'Open', reportedAt: new Date().toISOString() }) }
    ]
};

// 4. Stub Firestore
const firestoreStub = {
    batch: sinon.stub().returns({
        set: sinon.spy(),
        commit: sinon.stub().resolves()
    }),
    collection: (name) => ({
        doc: () => ({ id: 'new_doc_id' }),
        add: sinon.stub().resolves(),
        where: function (field, op, val) {
            // Simple mock query logic
            this._query = this._query || [];
            this._query.push({ field, op, val });
            return this;
        },
        limit: function () { return this; },
        get: async function () {
            // DATA RETURN LOGIC
            if (name === 'time_logs') {
                // Return all shifts for simplicity of mock structure, or filter if we want to be fancy.
                // The code queries for > 14h ago.
                // Let's just return what the specific test case expects based on 'name'
                return { forEach: (cb) => mockDb.shifts.forEach(cb) };
            }
            if (name === 'form_submissions') {
                // If checking for pre-trip for u1 (Tired Tom), return empty
                // If checking for u2, return 1
                // If checking for keywords, return risk form

                // Hacky context aware return based on previous .where calls?
                // Or just return everything and let code filter? 
                // Code uses specific queries.
                // Let's return EVERYTHING and rely on the fact that forEach won't break logic 
                // BUT the code checks .empty for pre-trip.

                const isPreTripQuery = this._query && this._query.some(q => q.val === 'pre-trip');
                const isUser1 = this._query && this._query.some(q => q.val === 'u1');

                if (isPreTripQuery && isUser1) return { empty: true, forEach: () => { } };
                return { empty: false, forEach: (cb) => mockDb.forms.forEach(cb) };
            }
            if (name === 'maintenance_tickets') {
                return { forEach: (cb) => mockDb.tickets.forEach(cb) };
            }
            return { forEach: () => { }, empty: true };
        }
    })
};

// Create a mock function for admin.firestore()
const firestoreMockFunc = () => firestoreStub;
// Attach FieldValue to it
firestoreMockFunc.FieldValue = {
    serverTimestamp: () => new Date().toISOString()
};

if (!admin.firestore.restore) {
    // We stub the PROPERTY 'firestore' if it's a getter, or VALUE if it's a function. 
    // Usually it's a getter/namespace in the lib.
    // Safest is to try to stub the property.
    try {
        sinon.stub(admin, 'firestore').get(() => firestoreMockFunc);
    } catch (e) {
        // Fallback if it's not a configurable property (unlikely with Sinon)
        admin.firestore = firestoreMockFunc;
    }
}

// 5. Run Test
const safetyAuditor = require('./safety_auditor');

(async () => {
    console.log("🧪 STARTING VERIFICATION: Safety Auditor Agent");

    try {
        const result = await safetyAuditor.auditLogic(firestoreStub);

        console.log("   -> Result:", result);

        // Assertions (Visual)
        if (result.riskCount >= 3) {
            console.log("   ✅ SUCCESS: Detected risks (Expected at least 3: Fatigue u1, Missing Pre-Trip u1, Stale Ticket, Keyword hit).");
        } else {
            console.log("   ⚠️ PARTIAL: Detected fewer risks than expected. Check logic.");
        }

    } catch (e) {
        console.error("   ❌ ERROR:", e);
    } finally {
        test.cleanup();
        sinon.restore();
    }
})();
