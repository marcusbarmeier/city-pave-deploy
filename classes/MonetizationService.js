/**
 * MonetizationService.js
 * The "Wallet" logic for the user. Handles subscription status, plan fetching, and restore purchases.
 */

import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

export class MonetizationService {
    constructor() {
        // Initialize Firebase instances if not already globally available
        // Assuming global app initialization in index.js
        // We'll try to re-use or re-init safely.
        // For this file pattern, we often assume 'app' is imported or active.
        // But to be robust:
        // this.db = getFirestore(); 
        // We will accept db in init or get it from global window if set.
    }

    async init(db) {
        this.db = db;
        this.auth = getAuth();
        console.log("💳 MonetizationService Initialized.");
    }

    // --- READ OPERATIONS ---

    async getPlans() {
        // Fetches all active plans for the Pricing Page
        const plansRef = collection(this.db, "subscription_plans");
        const snap = await getDocs(plansRef);
        const plans = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.active) plans.push(data);
        });
        return plans.sort((a, b) => a.internal_tier_id === 'tier_free' ? -1 : 1);
    }

    async getCurrentSubscription(userId) {
        if (!userId && this.auth.currentUser) userId = this.auth.currentUser.uid;
        if (!userId) return null;

        const userDoc = await getDoc(doc(this.db, "users", userId));
        if (userDoc.exists()) {
            return userDoc.data().subscription || null; // { tier_id, source, status, expiry }
        }
        return null;
    }

    // --- ACTION OPERATIONS ---

    async restorePurchases() {
        console.log("♻️ Restore Purchases Triggered...");
        const userId = this.auth.currentUser?.uid;
        if (!userId) throw new Error("User not logged in.");

        // In a real app, this calls the StoreKit/Play Billing wrapper to get local receipt,
        // then sends it to our Cloud Function "verifyReceipt".

        // Mock Implementation for Prototype:
        // We simulate a check against the "Store" which returns a "Tier 3" receipt.

        const mockReceipt = {
            platform: 'ios',
            receipt_data: 'base64_receipt_mock_12345',
            product_id: 'com.citypave.tier.pro'
        };

        try {
            // Call Cloud Function
            // const functions = getFunctions();
            // const verifyFn = httpsCallable(functions, 'verifyReceipt');
            // const result = await verifyFn({ receipt: mockReceipt });

            // SIMULATION:
            console.log("   -> Sending receipt to backend...");
            await new Promise(r => setTimeout(r, 1500)); // Network delay

            const simulatedResult = {
                success: true,
                tier_id: 'tier_pro',
                source: 'ios',
                message: "Restored 'Pro Crew' subscription from App Store."
            };

            alert(simulatedResult.message);
            // In real app, the backend updates the User doc, so we just reload.
            window.location.reload();

        } catch (e) {
            console.error("Restore failed", e);
            alert("Restore failed: " + e.message);
        }
    }

    getManageSubscriptionUrl(source) {
        if (source === 'ios') return 'https://apps.apple.com/account/subscriptions';
        if (source === 'android') return 'https://play.google.com/store/account/subscriptions';
        if (source === 'stripe' || source === 'web') return '/billing-portal'; // Or Stripe link
        return '#';
    }
}
