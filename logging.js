/**
 * Cloud-Native Logging Module
 * Integrates with Firebase Performance & Analytics (Crashlytics equivalent for Web)
 */

import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-analytics.js";
import { getPerformance, trace } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-performance.js";
import { getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";

let analytics;
let perf;

export function initLogging() {
    try {
        const app = getApp();
        analytics = getAnalytics(app);
        perf = getPerformance(app);
        console.log("[Cloud Logging] Initialized Analytics & Performance Monitoring");
    } catch (e) {
        console.warn("[Cloud Logging] Failed to initialize Firebase services. Running in offline/dev mode?", e);
    }
}

export function logError(error, context = {}) {
    console.error("[Cloud Error Log]", error, context);
    if (analytics) {
        logEvent(analytics, 'exception', {
            description: error.message || error.toString(),
            fatal: true,
            ...context
        });
    }
}

export function logAction(actionName, params = {}) {
    console.log("[Cloud Action Log]", actionName, params);
    if (analytics) {
        logEvent(analytics, actionName, params);
    }
}

// Performance Tracing Decorator
export async function traceAction(actionName, fn) {
    if (!perf) return await fn();

    const t = trace(perf, actionName);
    t.start();
    try {
        const result = await fn();
        return result;
    } finally {
        t.stop();
    }
}
