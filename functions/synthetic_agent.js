const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { CloudTasksClient } = require('@google-cloud/tasks');

// Initialize Cloud Tasks Client
const tasksClient = new CloudTasksClient();

const db = admin.firestore();

// --- 1. DATA GENERATORS ---

/**
 * Generate synthetic users
 */
async function generateUsers(count) {
    const batch = db.batch();
    const roles = ['admin', 'employee', 'mechanic'];

    for (let i = 0; i < count; i++) {
        const id = `syn_user_${Date.now()}_${i}`;
        const role = roles[Math.floor(Math.random() * roles.length)];
        const docRef = db.collection('users').doc(id);

        batch.set(docRef, {
            name: `Synthetic User ${i}`,
            email: `syn.user.${i}@citypave.fake`,
            role: role,
            wage: role === 'admin' ? 45 : (role === 'mechanic' ? 35 : 22),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isSynthetic: true
        });
    }

    await batch.commit();
    return { success: true, count, type: 'users' };
}

/**
 * Generate synthetic assets
 */
async function generateAssets(count) {
    const batch = db.batch();
    const types = ['Truck', 'Paver', 'Loader', 'Roller'];
    const statuses = ['Active', 'Maintenance', 'Archived'];

    for (let i = 0; i < count; i++) {
        const id = `syn_asset_${Date.now()}_${i}`;
        const type = types[Math.floor(Math.random() * types.length)];
        const docRef = db.collection('assets').doc(id);

        batch.set(docRef, {
            unitId: `S-${1000 + i}`,
            type: type,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            name: `Synthetic ${type} ${i}`,
            isSynthetic: true
        });
    }

    await batch.commit();
    return { success: true, count, type: 'assets' };
}

/**
 * Generate synthetic jobs
 */
async function generateJobs(count) {
    const batch = db.batch();
    const statuses = ['Pending', 'Scheduled', 'In Progress', 'Completed'];

    for (let i = 0; i < count; i++) {
        const id = `syn_job_${Date.now()}_${i}`;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const grandTotal = Math.floor(Math.random() * 50000) + 500;
        const docRef = db.collection('estimates').doc(id);

        batch.set(docRef, {
            status: status,
            customerInfo: {
                name: `Syn Customer ${i}`,
                address: `${i} Synthetic Lane`,
                siteAddress: `${i} Synthetic Lane`
            },
            grandTotal: grandTotal,
            durationDays: Math.floor(Math.random() * 10) + 1,
            tentativeStartDate: new Date().toISOString(),
            description: `Synthetic Job #${i}`,
            isSynthetic: true
        });
    }

    await batch.commit();
    return { success: true, count, type: 'jobs' };
}

// --- 2. EXPORTED FUNCTIONS ---

const { onCall } = require("firebase-functions/v2/https");

/**
 * generateSyntheticData
 * Direct callable for smaller batches or testing.
 * request.data: { type: 'users'|'assets'|'jobs', count: number }
 */
exports.generateSyntheticData = onCall(async (request) => {
    // Basic Auth Check
    console.log("generateSyntheticData called.", {
        uid: request.auth?.uid
    });

    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
    }

    const data = request.data;
    const type = data.type || 'jobs';
    const count = Math.min(data.count || 10, 500); // Cap for direct calls

    console.log(`Generating ${count} ${type}...`);

    try {
        if (type === 'users') return await generateUsers(count);
        if (type === 'assets') return await generateAssets(count);
        if (type === 'jobs') return await generateJobs(count);
        return { success: false, error: 'Unknown type' };
    } catch (e) {
        console.error("Generation failed:", e);
        throw new functions.https.HttpsError('internal', e.message);
    }
});

/**
 * analyzeDataRelationships
 * Remote exploratory lane.
 */
exports.analyzeDataRelationships = onCall(async (request) => {
    if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    // 1. Calculate Total Asset Utilization (Active vs Others)
    const assetSnap = await db.collection('assets').where('isSynthetic', '==', true).get();
    let assetStats = { total: 0, active: 0, maintenance: 0 };
    assetSnap.forEach(doc => {
        const d = doc.data();
        assetStats.total++;
        if (d.status === 'Active') assetStats.active++;
        if (d.status === 'Maintenance') assetStats.maintenance++;
    });

    // 2. Revenue Analysis from Jobs
    const jobSnap = await db.collection('estimates').where('isSynthetic', '==', true).get();
    let jobStats = { total: 0, totalRevenue: 0, avgValue: 0, statusCounts: {} };
    jobSnap.forEach(doc => {
        const d = doc.data();
        jobStats.total++;
        jobStats.totalRevenue += (d.grandTotal || 0);
        jobStats.statusCounts[d.status] = (jobStats.statusCounts[d.status] || 0) + 1;
    });
    if (jobStats.total > 0) jobStats.avgValue = jobStats.totalRevenue / jobStats.total;

    return {
        assets: assetStats,
        jobs: jobStats,
        generatedAt: new Date().toISOString()
    };
});

/**
 * scheduleDataGeneration
 * Dispatcher for massive jobs using Cloud Tasks.
 * data: { type: 'jobs', count: 10000 }
 */
exports.scheduleDataGeneration = onCall(async (request) => {
    if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const data = request.data;
    const project = process.env.GCLOUD_PROJECT || 'city-pave-estimator';
    const queue = 'synthetic-data-queue'; // Must exist in GCP
    const location = 'us-central1'; // Or your function region

    const parent = tasksClient.queuePath(project, location, queue);
    const count = data.count || 100;
    const type = data.type || 'jobs';

    // Split into chunks of 500
    const chunkSize = 500;
    const chunks = Math.ceil(count / chunkSize);

    const tasks = [];

    // URL of the handler function (needs to be the HTTP trigger URL)
    // For now we assume a standard URL structure or use a relative path if supported, 
    // but usually needs full URL. We'll use a placeholder or config.
    const url = `https://${location}-${project}.cloudfunctions.net/runSyntheticBatch`;

    for (let i = 0; i < chunks; i++) {
        const payload = { type, count: chunkSize };
        const task = {
            httpRequest: {
                httpMethod: 'POST',
                url: url,
                body: Buffer.from(JSON.stringify(payload)).toString('base64'),
                headers: {
                    'Content-Type': 'application/json',
                },
                // Add auth oidc token if needed for security
            },
        };
        tasks.push(tasksClient.createTask({ parent, task }));
    }

    try {
        await Promise.all(tasks);
        return { success: true, message: `Scheduled ${chunks} tasks for ${count} items.` };
    } catch (e) {
        console.warn("Cloud Tasks dispatch failed (Queue might not exist):", e.message);
        // Fallback: Just run one batch directly for demo purposes if specific error? 
        // Or just return error.
        throw new functions.https.HttpsError('cancelled', 'Failed to schedule tasks. check queue.');
    }
});

/**
 * runSyntheticBatch
 * The worker function for Cloud Tasks.
 */
exports.runSyntheticBatch = functions.https.onRequest(async (req, res) => {
    const { type, count } = req.body;

    try {
        let result;
        if (type === 'users') result = await generateUsers(count);
        else if (type === 'assets') result = await generateAssets(count);
        else if (type === 'jobs') result = await generateJobs(count);
        else result = { error: 'Unknown type' };

        res.json(result);
    } catch (e) {
        console.error("Batch failed", e);
        res.status(500).send(e.message);
    }
});
