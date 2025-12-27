/**
 * Component: SubscriptionSettings ("The Wallet")
 * Handles user subscription status, restore purchases, and management links.
 */

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-functions.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

export class SubscriptionSettings {
    constructor(containerId, db, user) {
        this.containerId = containerId;
        this.db = db;
        this.user = user; // The auth user object (uid, email)
        this.status = null;
    }

    async init() {
        await this.loadStatus();
        this.render();
    }

    async loadStatus() {
        if (!this.user || !this.user.uid) {
            console.warn("No user configured for SubscriptionSettings.");
            return;
        }

        try {
            const userRef = doc(this.db, "users", this.user.uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const data = snap.data();
                this.status = data.subscription_status || {
                    tier_id: 'free_tier',
                    source: 'none',
                    status: 'inactive',
                    renews_at: null
                };
            }
        } catch (e) {
            console.error("Failed to load subscription status", e);
        }
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (!this.status) {
            container.innerHTML = `<div class="p-4 text-gray-400">Loading subscription details...</div>`;
            return;
        }

        const isIos = this.status.source === 'ios';
        const isAndroid = this.status.source === 'android';
        const isWeb = this.status.source === 'stripe' || this.status.source === 'web';

        const renewsDate = this.status.renews_at ? new Date(this.status.renews_at.seconds * 1000).toLocaleDateString() : 'N/A';
        const tierName = this.status.display_name || this.status.tier_id || 'Free Tier'; // ideally we join with Plans table

        container.innerHTML = `
            <div class="subscription-wallet bg-gray-900 border border-gray-700 rounded-xl overflow-hidden max-w-md mx-auto">
                <!-- Header -->
                <div class="bg-gradient-to-r from-blue-900 to-gray-900 p-6 border-b border-gray-700">
                    <h2 class="text-xl font-bold text-white flex items-center gap-2">
                        <span>💳</span> Subscription Wallet
                    </h2>
                    <div class="mt-4 flex justify-between items-end">
                        <div>
                            <div class="text-xs text-blue-300 uppercase font-bold">Current Plan</div>
                            <div class="text-2xl font-bold text-white">${tierName}</div>
                        </div>
                         <div class="text-right">
                             <div class="badge ${this.status.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} px-2 py-1 rounded text-xs font-bold uppercase border border-white/10">
                                ${this.status.status}
                             </div>
                        </div>
                    </div>
                </div>

                <!-- Body -->
                <div class="p-6 space-y-6">
                    
                    <!-- Details Grid -->
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="bg-gray-800/50 p-3 rounded">
                            <div class="text-gray-500 text-xs mb-1">Next Renewal</div>
                            <div class="text-white font-mono">${renewsDate}</div>
                        </div>
                        <div class="bg-gray-800/50 p-3 rounded">
                            <div class="text-gray-500 text-xs mb-1">Source</div>
                            <div class="text-white capitalize flex items-center gap-2">
                                ${this.getSourceIcon(this.status.source)}
                                ${this.status.source}
                            </div>
                        </div>
                    </div>

                    <!-- Manage Actions (Compliance) -->
                    <div>
                         ${this.renderManageButton(isIos, isAndroid, isWeb)}
                         <p class="text-[10px] text-gray-500 mt-2 text-center">
                            Subscriptions auto-renew unless canceled at least 24 hours before the end of the current period.
                         </p>
                    </div>

                    <!-- Restore Purchases (Critical for iOS) -->
                    <div class="pt-4 border-t border-gray-800">
                        <button id="restore-btn" class="w-full text-blue-400 hover:text-blue-300 text-xs font-bold uppercase tracking-wide py-2">
                            Restore Purchases
                        </button>
                    </div>

                </div>
            </div>
        `;

        // Bind Events
        document.getElementById('restore-btn')?.addEventListener('click', () => this.restorePurchases());
    }

    getSourceIcon(source) {
        if (source === 'ios') return '🍎';
        if (source === 'android') return '🤖';
        if (source === 'stripe' || source === 'web') return '💳';
        return '⚪';
    }

    renderManageButton(isIos, isAndroid, isWeb) {
        let url = '#';
        let label = 'Manage Subscription';

        if (isIos) {
            url = 'https://apps.apple.com/account/subscriptions';
            label = 'Manage on App Store';
        } else if (isAndroid) {
            url = 'https://play.google.com/store/account/subscriptions';
            label = 'Manage on Google Play';
        } else if (isWeb) {
            // In real app, this calls a function to get Stripe Portal URL
            return `<button onclick="window.location.href='/billing-portal'" class="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg shadow transition">
                Manage Billing (Stripe)
            </button>`;
        } else {
            return `<button disabled class="w-full bg-gray-800 text-gray-500 font-bold py-3 rounded-lg cursor-not-allowed">
                No Active Subscription
            </button>`;
        }

        // Deep Link Button for Mobile
        return `
            <a href="${url}" target="_blank" class="block w-full text-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg shadow transition">
                ${label}
            </a>
        `;
    }

    // --- RESTORE LOGIC ---
    async restorePurchases() {
        const btn = document.getElementById('restore-btn');
        if (btn) {
            btn.innerHTML = "Restoring...";
            btn.disabled = true;
        }

        console.log("🔄 Starting Restore Purchase Flow...");

        try {
            // Platform Check (Simulated)
            // In capacitor: const platform = Capacitor.getPlatform();
            const platform = 'ios'; // Mock for now or detect navigator

            // 1. Get Receipt from Device (Plugin call)
            // const receipt = await CdvPurchase.store.validator...
            const mockReceipt = "MIITCQYJKoZIhvcNAQcCoIIT..."; // Dummy base64

            // 2. Call Backend
            console.log(`Sending receipt to backend for validation (${platform})...`);

            // const verifyFn = httpsCallable(getFunctions(), 'verifyPurchase');
            // const result = await verifyFn({ source: platform, receipt: mockReceipt });

            // MOCK RESULT
            await new Promise(r => setTimeout(r, 1500));

            alert("Purchases Restored! Your entitlements have been synced.");
            await this.loadStatus();
            this.render();

        } catch (error) {
            console.error("Restore failed:", error);
            alert("Restore failed: " + error.message);
        } finally {
            if (btn) {
                btn.innerHTML = "Restore Purchases";
                btn.disabled = false;
            }
        }
    }
}
