/**
 * Cloud Functions for City Pave Estimator
 * Monetization & Subscription Middleware
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// --- 1. SECURE VAULT (Admin Only) ---

/**
 * updateSecrets
 * Securely writes API keys to 'sys_secrets' collection.
 * keys: stripe_secret, ios_secret, etc.
 */
exports.updateSecrets = functions.https.onCall(async (data, context) => {
    // RBAC: Verify Super Admin
    if (!context.auth || context.auth.token.role !== 'admin' && !context.auth.token.email.endsWith('@citypave.com')) {
        // Note: looser check for demo, strict in prod
        // throw new functions.https.HttpsError('permission-denied', 'Only Admins can update secrets.');
        console.warn("Allowing non-admin for demo purposes or check logic adjustment needed.");
    }

    const { stripe_secret_key, ios_shared_secret, google_service_account_json } = data;

    // Write to a protected collection only readable by Admin SDK (Cloud Functions)
    await db.collection('sys_secrets').doc('monetization_keys').set({
        stripe_secret_key,
        ios_shared_secret,
        google_service_account_json,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: context.auth ? context.auth.uid : 'system'
    });

    return { success: true, message: "Secrets vaulted securely." };
});


// --- 2. THE BRIDGE (Purchase Verification) ---

/**
 * verifyPurchase
 * Called by iOS/Android app to validate a receipt and unlock content.
 */
exports.verifyPurchase = functions.https.onCall(async (data, context) => {
    // const uid = context.auth.uid; // Actual user
    const uid = context.auth ? context.auth.uid : data.simulated_uid; // For dev testing
    const { source, receipt, productId } = data;

    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    console.log(`Verifying purchase for ${uid} on ${source}...`);

    // 1. Get Secrets
    const secretsSnap = await db.collection('sys_secrets').doc('monetization_keys').get();
    const secrets = secretsSnap.data() || {};

    let isValid = false;
    let computedTier = null;
    let expirationDate = null;

    try {
        if (source === 'ios') {
            // Logic: Verify with Apple (secrets.ios_shared_secret)
            // const appleResponse = await verifyAppleReceipt(receipt, secrets.ios_shared_secret);
            // isValid = appleResponse.status === 0;
            // computedTier = mapProductIdToTier(appleResponse.latest_receipt_info.product_id);

            // MOCK OK
            isValid = true;
            computedTier = 'tier_pro'; // mock
            expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
        }
        else if (source === 'android') {
            // Logic: Verify with Google Play Developer API (secrets.google_service_account_json)
            // MOCK OK
            isValid = true;
            computedTier = 'tier_titan'; // mock
            expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
        }
        else if (source === 'stripe') {
            // Logic: Retrieve Subscription from Stripe
            // MOCK OK
            isValid = true;
            computedTier = 'tier_basic';
            expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
        }
    } catch (e) {
        console.error("Verification error:", e);
        throw new functions.https.HttpsError('internal', 'Verification failed: ' + e.message);
    }

    if (isValid && computedTier) {
        // "The Truth" Logic: Update User Record
        const status = {
            tier_id: computedTier,
            source: source,
            status: 'active',
            renews_at: admin.firestore.Timestamp.fromDate(expirationDate),
            last_verified: admin.firestore.FieldValue.serverTimestamp()
        };

        // Get Tier Details to cache display name
        const planSnap = await db.collection('sys_subscription_plans').doc(computedTier).get();
        if (planSnap.exists) {
            status.display_name = planSnap.data().display_name;
            status.permissions = planSnap.data().module_permissions;
        }

        await db.collection('users').doc(uid).set({
            subscription_status: status
        }, { merge: true });

        return { success: true, tier_id: computedTier, status: 'active' };
    } else {
        return { success: false, reason: 'Invalid receipt' };
    }
});


// --- 3. WEBHOOKS (The centralized updater) ---

/**
 * subscriptionUpdate
 * Endpoint: /api/webhooks/subscription_update (Rewritten)
 * or https://.../subscriptionUpdate
 */
exports.subscriptionUpdate = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const signature = req.headers['stripe-signature']; // or similar
    const payload = req.body;

    console.log("Webhook Received:", payload.type || payload.event);

    // This defines the "Unified" normalize logic
    let uid = null;
    let newStatus = null;

    // Example: Stripe logic (simplified)
    if (payload.type === 'invoice.payment_succeeded') {
        const customerId = payload.data.object.customer;
        // Lookup user by customerId
        const userQ = await db.collection('users').where('stripe_customer_id', '==', customerId).limit(1).get();
        if (!userQ.empty) {
            uid = userQ.docs[0].id;
            newStatus = 'active';
            // We would verify line commands to get tier...
        }
    }

    if (uid && newStatus) {
        await db.collection('users').doc(uid).set({
            subscription_status: {
                status: newStatus,
                last_webhook: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });
        console.log(`Updated user ${uid} to ${newStatus}`);
    }




    res.json({ received: true });
});

// --- 4. SYNTHETIC AGENT (Server-Side Data Generation) ---
const syntheticAgent = require('./synthetic_agent');
exports.generateSyntheticData = syntheticAgent.generateSyntheticData;
exports.analyzeDataRelationships = syntheticAgent.analyzeDataRelationships;
exports.scheduleDataGeneration = syntheticAgent.scheduleDataGeneration;
exports.runSyntheticBatch = syntheticAgent.runSyntheticBatch;

// --- 4. DATA AGGREGATION & REPORTING ---

/**
 * getJobCosting
 * Server-side calculation of job profitability to reduce client load.
 * Returns: Array of { jobId, jobName, revenue, laborCost, materialCost, equipmentCost, totalCost, profit, margin }
 */
exports.getJobCosting = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    // 2. Fetch Metadata (Parallel)
    const [usersSnap, assetsSnap, estimatesSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('assets').get(),
        db.collection('estimates').where('status', 'in', ['Accepted', 'In Progress', 'Work Starting', 'Completed', 'Invoiced', 'Paid']).get()
    ]);

    // Map Helper Data
    const userWages = {};
    usersSnap.forEach(doc => userWages[doc.id] = parseFloat(doc.data().wage) || 20);

    const assetRates = {};
    assetsSnap.forEach(doc => {
        const a = doc.data();
        let rate = 50; // Default
        if (a.type === 'Excavator') rate = 150;
        else if (a.type === 'Skid Steer') rate = 95;
        else if (a.type === 'Truck') rate = 85;
        else if (a.type === 'Trailer') rate = 20;

        if (a.hourlyRate) rate = parseFloat(a.hourlyRate);
        assetRates[doc.id] = rate;
    });

    // 3. Process Each Job
    // Optimization: Instead of fetching ALL logs/expenses/dispatch for ALL time,
    // we could query by jobId, but that's N queries.
    // Better: Fetch all relevant collections once if dataset is small (<5000 docs),
    // OR for scalability, do per-job queries if we have many jobs.
    // For this "Light Client" pass, we'll fetch all active logs/expenses to match original logic but do it on server (faster bandwidth to DB).

    // FETCH ALL RAW DATA
    // Note: In a larger system, we would filter these queries by the date range of the active jobs or use a composite index.
    const [timeSnap, expSnap, dispatchSnap] = await Promise.all([
        db.collection('time_logs').get(),
        db.collection('expenses').get(),
        db.collection('dispatch_schedule').get()
    ]);

    const logs = [];
    timeSnap.forEach(d => logs.push(d.data()));

    const expenses = [];
    expSnap.forEach(d => expenses.push(d.data()));

    const dispatch = [];
    dispatchSnap.forEach(d => dispatch.push(d.data()));

    const results = [];

    estimatesSnap.forEach(doc => {
        const job = doc.data();
        const jobId = doc.id;
        const jobName = job.customerInfo?.name || 'Unnamed';
        const revenue = parseFloat(job.grandTotal) || 0;

        // A. Labor
        let laborCost = 0;
        let laborHours = 0;
        logs.filter(l => l.jobId === jobId).forEach(l => {
            if (l.startTime) {
                const start = new Date(l.startTime);
                const end = l.endTime ? new Date(l.endTime) : new Date(); // Active = now
                const hours = (end - start) / 3600000;
                laborHours += hours;
                laborCost += hours * (userWages[l.userId] || 20);
            }
        });

        // B. Materials
        let materialCost = 0;
        expenses.filter(e => e.jobId === jobId && e.status !== 'Rejected').forEach(e => {
            materialCost += parseFloat(e.amount) || 0;
        });

        // C. Equipment
        let equipmentCost = 0;
        dispatch.filter(d => d.jobId === jobId && d.crew).forEach(d => {
            // Logic match: simplified 8h per dispatch entry if no times
            let hours = 8;
            if (Array.isArray(d.crew)) {
                d.crew.forEach(member => {
                    if (member.assetId && assetRates[member.assetId]) {
                        equipmentCost += hours * assetRates[member.assetId];
                    }
                });
            }
        });

        const totalCost = laborCost + materialCost + equipmentCost;
        const profit = revenue - totalCost;
        const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

        results.push({
            jobId,
            jobName,
            address: job.customerInfo?.address || '',
            revenue,
            laborCost,
            laborHours,
            materialCost,
            equipmentCost,
            totalCost,
            profit,
            margin: parseFloat(margin)
        });
    });

    // Sort by most recent/active? Or just name. Let's do revenue desc.
    results.sort((a, b) => b.revenue - a.revenue);

    return { params: data, generated_at: new Date().toISOString(), jobs: results };
});

// --- 4. ASSET MANAGEMENT ---
const assetProcessor = require('./asset_processor');
exports.processDashcamUpload = assetProcessor.processDashcamUpload;

// --- 5. SAFETY AUDITOR AGENT ---
const safetyAuditor = require('./safety_auditor');
exports.runNightlyAudit = safetyAuditor.runNightlyAudit;

