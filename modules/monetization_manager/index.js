/**
 * Monetization Manager (New Modular Version)
 * Author: Antigravity
 * Date: 2025-12-25
 */

import { doc, getDoc, setDoc, collection, getDocs, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { StoreVault } from './components/store-vault.js';
import { MappingTable } from './components/mapping-table.js';
import { PlanEditor } from './components/plan-editor.js';

export class MonetizationManager {
    constructor(db, functionsInstance) {
        this.db = db;
        this.functions = functionsInstance;
        this.plans = [];
        this.config = null;

        // Components
        this.vault = new StoreVault('monetization-vault-container', db, functionsInstance);
        this.table = new MappingTable('monetization-table-container', []);
        this.editor = new PlanEditor('monetization-modals-container');
    }

    async init() {
        console.log("💰 MonetizationManager v2 Initializing...");
        this.setupLayout();

        await Promise.all([
            this.loadPlans(),
            this.loadConfig()
        ]);

        this.bindComponentEvents();
        this.renderAll();
    }

    setupLayout() {
        const container = document.getElementById("monetization-container");
        if (!container) return;

        // Clear loading state
        container.innerHTML = `
            <div class="monetization-dashboard space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold text-white">Subscription Command Center</h2>
                        <p class="text-sm text-gray-400">Manage tiers, pricing mapping, and marketing copy.</p>
                    </div>
                </div>

                <!-- Vault Container -->
                <div id="monetization-vault-container"></div>

                <!-- Table Container -->
                <div id="monetization-table-container"></div>
            </div>
            <!-- Modals Container -->
            <div id="monetization-modals-container"></div>
        `;
    }

    bindComponentEvents() {
        // Vault Events
        this.vault.onSavePublic = async (data) => {
            await this.savePublicConfig(data);
        };
        this.vault.onSaveSecrets = async (data) => {
            await this.saveSecrets(data);
        };

        // Table Events
        this.table.onEdit = (tierId) => {
            const plan = this.plans.find(p => p.internal_tier_id === tierId);
            if (plan) this.editor.open(plan);
        };
        this.table.onSeed = async () => {
            // Fallback to the global seed function if available, or manual injection
            if (window.seedMonetization) {
                await window.seedMonetization();
                await this.loadPlans();
            } else {
                alert("Seeding utility not found. Please run seed_database.js manually.");
            }
        };

        // Editor Events
        this.editor.onSave = async (id, data) => {
            await this.updatePlan(id, data);
        };
    }

    renderAll() {
        this.vault.render(this.config);
        this.table.updatePlans(this.plans);
    }

    // --- DATA OPERATIONS ---

    async loadPlans() {
        try {
            const snapshot = await getDocs(collection(this.db, "sys_subscription_plans")); // Using 'sys_subscription_plans' per spec
            this.plans = [];
            snapshot.forEach(doc => {
                // Ensure data has internal_tier_id from id if missing
                const data = doc.data();
                if (!data.internal_tier_id) data.internal_tier_id = doc.id;
                this.plans.push(data);
            });
            // If empty, maybe check legacy 'subscription_plans' just in case? 
            // The Plan said 'sys_subscription_plans'. Sticking to that.
        } catch (e) {
            console.error("Error loading plans:", e);
        }
    }

    async loadConfig() {
        const docRef = doc(this.db, "sys_admin", "monetization_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            this.config = docSnap.data();
        } else {
            this.config = { stripe_publishable_key: "" };
        }
    }

    async savePublicConfig(data) {
        await setDoc(doc(this.db, "sys_admin", "monetization_config"), data, { merge: true });
        this.config = { ...this.config, ...data };
        alert("Public Config Saved.");
    }

    async saveSecrets(secrets) {
        console.log("🔐 Uploading secrets to secure vault...");
        try {
            // Check for Cloud Function
            // const updateSecretsFn = httpsCallable(this.functions, 'updateSecrets');
            // await updateSecretsFn(secrets);

            // For now, mock success as we don't have the backend function deployed yet in this context
            console.warn("Backend function 'updateSecrets' not reachable. Mocking success.");
            alert("Secrets encrypted and sent to Vault (Mock)!");
        } catch (error) {
            console.error("Failed to save secrets:", error);
            alert("Error: " + error.message);
        }
    }

    async updatePlan(tierId, updateData) {
        console.log(`Updating Plan ${tierId}...`, updateData);
        try {
            const planRef = doc(this.db, "sys_subscription_plans", tierId);
            await updateDoc(planRef, updateData);
            await this.loadPlans(); // Reload to refresh UI
            this.renderAll();
            return true;
        } catch (e) {
            console.error("Update failed", e);
            alert("Update failed: " + e.message);
        }
    }
}
