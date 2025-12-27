const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Nightly Safety Audit
 * Runs every day at 23:00 to check for compliance violations and risks.
 * 
 * Checks:
 * 1. Fatigue Risk: Active shifts > 14 hours.
 * 2. Missing Pre-Trip: Users working today without a pre-trip inspection.
 * 3. Stale Maintenance: Tickets open > 30 days.
 * 4. Keyword Detection: "accident", "injury", etc. in recent forms.
 */

exports.auditLogic = async (db) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const logBatch = db.batch();
    const risksFound = [];

    console.log(`Starting Consolidated Nightly Safety Audit for ${todayStr}...`);

    // --- 1. FATIGUE RISK (Active Shifts > 14 Hours) ---
    const fourteenHoursAgo = new Date(now.getTime() - (14 * 60 * 60 * 1000));
    const activeShiftsSnap = await db.collection('time_logs')
        .where('status', '==', 'active')
        .where('startTime', '<=', fourteenHoursAgo.toISOString())
        .get();

    activeShiftsSnap.forEach(doc => {
        const data = doc.data();
        const alertRef = db.collection('compliance_logs').doc();
        const alert = {
            type: 'FATIGUE_RISK',
            userId: data.userId,
            userName: data.userName,
            details: `Shift active > 14 hours. Started: ${data.startTime}`,
            severity: 'HIGH',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            resolved: false
        };
        logBatch.set(alertRef, alert);
        risksFound.push(alert);
        console.log(`[Audit] Flagged Shift: ${doc.id} (${data.userName})`);
    });

    // --- 2. MISSING PRE-TRIP INSPECTIONS ---
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get unique users who worked today
    const todayShiftsSnap = await db.collection('time_logs')
        .where('startTime', '>=', todayStart.toISOString())
        .get();

    const usersWorkingToday = new Set();
    todayShiftsSnap.forEach(doc => usersWorkingToday.add(doc.data().userId));

    for (const userId of usersWorkingToday) {
        // Optimization: In real app, might want to batch these queries or use a subcollection
        const preTripSnap = await db.collection('form_submissions')
            .where('userId', '==', userId)
            .where('formType', '==', 'pre-trip')
            .where('submittedAt', '>=', todayStart.toISOString())
            .limit(1)
            .get();

        if (preTripSnap.empty) {
            const alertRef = db.collection('compliance_logs').doc();
            const alert = {
                type: 'MISSING_INSPECTION',
                userId: userId,
                details: `Worked on ${todayStr} without Pre-Trip Inspection.`,
                severity: 'MEDIUM',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                resolved: false
            };
            logBatch.set(alertRef, alert);
            risksFound.push(alert);
            console.log(`[Audit] Missing Pre-Trip: ${userId}`);
        }
    }

    // --- 3. STALE MAINTENANCE TICKETS (> 30 Days) ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    // Note: Timestamp format depends on DB. Assuming ISO string or Timestamp object.
    // If using ISO strings for dates locally:
    const staleTicketsSnap = await db.collection('maintenance_tickets')
        .where('status', '==', 'Open') // Case sensitive? 'Open' based on seeding
        // .where('reportedAt', '<', thirtyDaysAgo.toISOString()) // Requires index usually
        .get();

    // Manual filtering for "reportedAt" if index missing, or just trust the query if indexed.
    // Let's iterate to be safe and flexible on date format if mixed.
    staleTicketsSnap.forEach(doc => {
        const d = doc.data();
        const reportedAt = new Date(d.reportedAt || d.created_at); // Handle both fields
        if (d.status === 'Open' && reportedAt < thirtyDaysAgo) {
            const alertRef = db.collection('compliance_logs').doc();
            const alert = {
                type: 'STALE_TICKET',
                ticketId: doc.id,
                details: `Maintenance ticket open > 30 days. Reported: ${reportedAt.toISOString()}`,
                severity: 'LOW',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                resolved: false
            };
            logBatch.set(alertRef, alert);
            risksFound.push(alert);
            console.log(`[Audit] Stale Ticket: ${doc.id}`);
        }
    });

    // --- 4. RISK KEYWORD DETECTION (Last 24h) ---
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentForms = await db.collection('form_submissions')
        .where('submittedAt', '>=', yesterday.toISOString())
        .get();

    const riskKeywords = ['accident', 'injury', 'crash', 'spill', 'hazard', 'fire', 'smoke'];

    recentForms.forEach(doc => {
        const data = doc.data();
        const content = JSON.stringify(data).toLowerCase();
        // Check if ANY keyword is in the content
        const hit = riskKeywords.find(kw => content.includes(kw));

        if (hit) {
            const alertRef = db.collection('compliance_logs').doc();
            const alert = {
                type: 'RISK_KEYWORD',
                formId: doc.id,
                details: `Detected risk keyword "${hit}" in form submission.`,
                severity: 'HIGH',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                resolved: false
            };
            logBatch.set(alertRef, alert);
            risksFound.push(alert);
            console.log(`[Audit] Keyword Hit: ${hit} in ${doc.id}`);
        }
    });

    // --- 5. COMMIT & SUMMARY ---
    await logBatch.commit();

    // Create a nightly summary report
    await db.collection('safety_audits').add({
        date: admin.firestore.FieldValue.serverTimestamp(),
        dateStr: todayStr,
        riskCount: risksFound.length,
        risks: risksFound, // Embed array for easy viewing
        status: risksFound.length > 0 ? 'FLAGGED' : 'CLEAN'
    });

    console.log(`Nightly Audit Completed. Total Risks: ${risksFound.length}`);
    return { success: true, riskCount: risksFound.length };
};

const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.runNightlyAudit = onSchedule('every day 23:00', async (event) => {
    return exports.auditLogic(admin.firestore());
});
