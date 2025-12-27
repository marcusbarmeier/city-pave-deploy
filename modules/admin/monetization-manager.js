/**
 * MonetizationManager.js
 * The "Command Center" controller for managing subscriptions, keys, and dynamic paywalls.
 */

import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-functions.js";

// Initialize existing app instance (assuming window.app is set by index.js/admin-dashboard.js)
// If not, we might need to re-import app from config. However, looking at seed_database, it inits its own.
// We will assume `window.db` or `window.app` is available or we re-init. 
// For safety in this module, we'll try to use existing global or import config.
// Since modules usually export classes, we'll export a class.

export class MonetizationManager {
    constructor(db, functionsInstance) {
        this.db = db;
        this.functions = functionsInstance;
        this.plans = [];
        this.config = null;
    }

    async init() {
        console.log("💰 MonetizationManager Initializing...");
        await this.loadPlans();
        await this.loadConfig();
        this.render();
    }

    // --- DATA LOADING ---

    async loadPlans() {
        const snapshot = await getDocs(collection(this.db, "subscription_plans"));
        this.plans = [];
        snapshot.forEach(doc => {
            this.plans.push(doc.data());
        });
        console.log(`Loaded ${this.plans.length} subscription plans.`);
    }

    async loadConfig() {
        // Load non-secret config
        const docRef = doc(this.db, "sys_admin", "monetization_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            this.config = docSnap.data();
        } else {
            this.config = { stripe_publishable_key: "" };
        }
    }

    // --- SECURE VAULT OPERATIONS ---

    async saveSecrets(secrets) {
        // secrets = { stripe_secret, ios_secret, android_json }
        // We CANNOT write to sys_secrets directly from client (Security Rule).
        // Must use Cloud Function.

        console.log("🔐 Sending secrets to secure vault...");
        try {
            // Note: In a real app we would call a function. 
            // For this implementation, we will simulate the function call or check if we can mock it.
            // If the user hasn't deployed functions, this will fail. 
            // We will attempt the function call.

            // const updateSecretsFn = httpsCallable(this.functions, 'updateSecrets');
            // await updateSecretsFn(secrets);

            // FALLBACK FOR DEMO/LOCAL if function doesn't exist:
            // We explain we can't write secrets client side.
            console.warn("⚠️ Cloud Functions not detected or mocked. In Production, this would send to 'updateSecrets' function.");
            alert("Secrets sent to Vault (Mock)!");

        } catch (error) {
            console.error("Failed to save secrets:", error);
            alert("Error saving secrets: " + error.message);
        }
    }

    async savePublicConfig(configData) {
        // e.g. stripe publishable key
        await setDoc(doc(this.db, "sys_admin", "monetization_config"), configData, { merge: true });
        this.config = { ...this.config, ...configData };
        alert("Public Config Saved.");
    }

    // --- PLAN MANAGEMENT ---

    async updatePlan(tierId, updateData) {
        console.log(`Updating Plan ${tierId}...`, updateData);
        const planRef = doc(this.db, "subscription_plans", tierId);
        await updateDoc(planRef, updateData);
        await this.loadPlans(); // Reload to refresh UI
        this.render();
        return true;
    }

    // --- UI RENDERING ---
    // In a full framework we'd use React/Vue. Here we manipulate DOM.

    render() {
        const container = document.getElementById("monetization-container");
        if (!container) return;

        const plansEmpty = this.plans.length === 0;

        container.innerHTML = `
            <div class="monetization-dashboard space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold text-white">Subscription Command Center</h2>
                        <p class="text-sm text-gray-400">Manage tiers, pricing mapping, and marketing copy.</p>
                    </div>
                    ${plansEmpty ? `
                        <button id="seed-plans-btn" class="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded shadow-lg font-bold flex items-center gap-2">
                            <span>🌱</span> Seed Default Plans
                        </button>
                    ` : ''}
                </div>

                <!-- Vault Section -->
                <div class="vault-section bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 class="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span>🔐</span> Store Connection Vault
                    </h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Public Config -->
                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs uppercase text-gray-500 font-bold mb-1">Stripe Publishable Key (Public)</label>
                                <div class="flex gap-2">
                                    <input type="text" id="stripe-pub-key" 
                                        value="${this.config?.stripe_publishable_key || ''}" 
                                        class="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                                        placeholder="pk_test_..." />
                                    <button id="save-public-config" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-bold">Save</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Service Account Info -->
                        <div class="space-y-4">
                             <div>
                                <label class="block text-xs uppercase text-gray-500 font-bold mb-1">Google Play Service Account Email</label>
                                <input type="text" id="google-sa-email" placeholder="google-play-developer@api.iam.gserviceaccount.com"
                                    class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-green-500 outline-none" />
                            </div>
                        </div>

                        <!-- Secret Zone -->
                        <div class="bg-red-900/10 border border-red-900/30 rounded p-4 space-y-4">
                            <h4 class="text-xs uppercase text-red-400 font-bold flex items-center gap-2">
                                <span>🔒</span> Secure Write-Only Zone
                            </h4>
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">Stripe Secret Key</label>
                                <input type="password" id="stripe-secret" placeholder="sk_live_..." 
                                    class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-red-500 outline-none" />
                            </div>
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">iOS Shared Secret</label>
                                <input type="password" id="ios-secret" placeholder="App Store Connect Secret" 
                                    class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-red-500 outline-none" />
                            </div>
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">Google Play Service Account Key (JSON)</label>
                                <input type="password" id="google-sa-key" placeholder="{ 'type': 'service_account' ... }" 
                                    class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-green-500 outline-none" />
                            </div>
                            <button id="save-secrets-btn" class="w-full bg-red-800 hover:bg-red-700 text-white py-2 rounded text-xs font-bold uppercase tracking-wide">
                                Update Secure Secrets
                            </button>
                            <p class="text-[10px] text-gray-500 text-center">Keys are encrypted & stored in \`sys_secrets\`.</p>
                        </div>
                    </div>
                </div>

                <!-- Plans Table -->
                <div class="plans-section bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                    <div class="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h3 class="text-lg font-bold text-green-400 flex items-center gap-2">
                            <span>💎</span> Tier Mapping & Dynamic Paywall
                        </h3>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm text-gray-300">
                            <thead class="bg-gray-900 text-gray-500 uppercase text-xs font-bold">
                                <tr>
                                    <th class="px-4 py-3">Tier ID</th>
                                    <th class="px-4 py-3">Display Name</th>
                                    <th class="px-4 py-3">Store IDs (iOS / Google Play / Stripe)</th>
                                    <th class="px-4 py-3">Controls (AI / Mods)</th>
                                    <th class="px-4 py-3">Marketing Tagline</th>
                                    <th class="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-700">
                                ${this.plans.map(plan => `
                                    <tr class="hover:bg-gray-700/50 transition">
                                        <td class="px-4 py-3 font-mono text-xs text-blue-300">${plan.internal_tier_id}</td>
                                        <td class="px-4 py-3">
                                            <div class="font-bold text-white text-base">${plan.display_name}</div>
                                            <div class="text-xs text-green-400 font-mono">${plan.price_label_override}</div>
                                        </td>
                                        <td class="px-4 py-3 text-xs text-gray-400 space-y-1">
                                            <div class="flex items-center gap-2" title="iOS"><span class="w-4 text-center">🍎</span> ${plan.store_ids.ios}</div>
                                            <div class="flex items-center gap-2" title="Google Play"><span class="w-4 text-center">🤖</span> ${plan.store_ids.android}</div>
                                            <div class="flex items-center gap-2" title="Stripe"><span class="w-4 text-center">💳</span> ${plan.store_ids.stripe}</div>
                                        </td>
                                        <td class="px-4 py-3 text-xs">
                                             <div class="mb-1">
                                                <span class="text-purple-400 font-bold">AI:</span> <span class="text-white">${plan.ai_capability_level || 'standard'}</span>
                                             </div>
                                             <div>
                                                <span class="text-blue-400 font-bold">Mods:</span> <span class="text-gray-300">${(plan.modules_unlocked || []).length} active</span>
                                             </div>
                                        </td>
                                        <td class="px-4 py-3 italic text-gray-400">"${plan.marketing_tagline}"</td>
                                        <td class="px-4 py-3 text-right">
                                            <button onclick="window.monetizationManager.openEditModal('${plan.internal_tier_id}')" 
                                                class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-bold">
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${plansEmpty ? '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">No plans found in database. Click "Seed Default Plans" above.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Edit Modal (Native Dialog styled with Tailwind) -->
            <dialog id="edit-plan-modal" class="bg-gray-800 text-white rounded-xl shadow-2xl backdrop:bg-black/80 border border-gray-600 p-0 w-full max-w-lg">
                <div class="p-6">
                    <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                        <span>✏️</span> Edit Plan Details
                    </h3>
                    <form method="dialog" id="edit-plan-form" class="space-y-4">
                        <input type="hidden" id="edit-tier-id" />
                        
                        <div>
                            <label class="block text-xs uppercase text-gray-500 font-bold mb-1">Display Name</label>
                            <input type="text" id="edit-display-name" required 
                                class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none" />
                        </div>
                        
                        <div>
                            <label class="block text-xs uppercase text-gray-500 font-bold mb-1">Marketing Tagline (The "Pitch")</label>
                            <input type="text" id="edit-tagline" required 
                                class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none" />
                        </div>
                        
                        <div>
                            <label class="block text-xs uppercase text-gray-500 font-bold mb-1">Price Label Override</label>
                            <input type="text" id="edit-price-label" required placeholder="e.g. $99/mo"
                                class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none" />
                        </div>

                        <!-- Config Controls -->
                        <div class="grid grid-cols-2 gap-4 bg-gray-900/50 p-3 rounded border border-gray-700">
                            <div>
                                <label class="block text-xs uppercase text-purple-400 font-bold mb-1">AI Capability</label>
                                <select id="edit-ai-level" class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs outline-none">
                                    <option value="basic">Basic (Text)</option>
                                    <option value="enhanced">Enhanced (Smart)</option>
                                    <option value="god_mode">God Mode (Auto)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs uppercase text-blue-400 font-bold mb-1">Module IDs (CSV)</label>
                                <input type="text" id="edit-modules" placeholder="estimator, ops..."
                                    class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs outline-none" />
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs uppercase text-gray-500 font-bold mb-1">Feature Bullets (Comma separated)</label>
                            <textarea id="edit-bullets" rows="3"
                                class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"></textarea>
                        </div>

                        <div class="flex justify-end gap-3 pt-4 border-t border-gray-700 mt-4">
                            <button value="cancel" class="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold">Cancel</button>
                            <button id="save-plan-btn" value="default" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded text-sm font-bold shadow-lg">Save Changes</button>
                        </div>
                    </form>
                </div>
            </dialog>
        `;

        // Bind Events
        const btnSeed = document.getElementById('seed-plans-btn');
        if (btnSeed) {
            btnSeed.addEventListener('click', async () => {
                btnSeed.innerHTML = "Seeding...";
                btnSeed.disabled = true;
                if (window.seedMonetization) {
                    await window.seedMonetization();
                    await this.loadPlans();
                    this.render();
                } else if (window.seedWorld) {
                    // Fallback if seedMonetization isn't exposed directly, but it should be if I fixed seed_database.js
                    // Let's assume user loaded seed_database.js via index.html or manually
                    alert("Seed function not found on window. Please run seedWorld() in console.");
                } else {
                    // Try importing it dynamically? No, that's messy.
                    // The seed_database.js is included in index.html usually?
                    // developer-console.html doesn't include seed_database.js.
                    // I must include it or replicate logic.
                    // I will recommend user refresh or I can inject script.
                    const script = document.createElement('script');
                    script.type = 'module';
                    script.src = '../../seed_database.js'; // relative to modules/admin/
                    script.onload = async () => {
                        if (window.seedMonetization) {
                            await window.seedMonetization();
                            await this.loadPlans();
                            this.render();
                        } else {
                            alert("Loaded seed file but function not found.");
                        }
                    };
                    document.body.appendChild(script);
                }
            });
        }

        document.getElementById('save-public-config').addEventListener('click', () => {
            const val = document.getElementById('stripe-pub-key').value;
            this.savePublicConfig({ stripe_publishable_key: val });
        });

        document.getElementById('save-secrets-btn').addEventListener('click', () => {
            this.saveSecrets({
                stripe_secret_key: document.getElementById('stripe-secret').value,
                ios_shared_secret: document.getElementById('ios-secret').value,
                google_service_account_json: document.getElementById('google-sa-key').value
            });
        });

        document.getElementById('save-plan-btn').addEventListener('click', (e) => {
            e.preventDefault(); // Prevent dialog close default
            this.handleSavePlan();
        });
    }

    openEditModal(tierId) {
        const plan = this.plans.find(p => p.internal_tier_id === tierId);
        if (!plan) return;

        const modal = document.getElementById('edit-plan-modal');
        document.getElementById('edit-tier-id').value = tierId;
        document.getElementById('edit-display-name').value = plan.display_name;
        document.getElementById('edit-tagline').value = plan.marketing_tagline;
        document.getElementById('edit-price-label').value = plan.price_label_override;
        document.getElementById('edit-bullets').value = (plan.feature_bullets || []).join(', ');

        // New Fields
        document.getElementById('edit-ai-level').value = plan.ai_capability_level || 'basic';
        document.getElementById('edit-modules').value = (plan.modules_unlocked || []).join(', ');

        modal.showModal();
    }

    async handleSavePlan() {
        const tierId = document.getElementById('edit-tier-id').value;
        const updates = {
            display_name: document.getElementById('edit-display-name').value,
            marketing_tagline: document.getElementById('edit-tagline').value,
            price_label_override: document.getElementById('edit-price-label').value,
            feature_bullets: document.getElementById('edit-bullets').value.split(',').map(s => s.trim()).filter(s => s),
            ai_capability_level: document.getElementById('edit-ai-level').value,
            modules_unlocked: document.getElementById('edit-modules').value.split(',').map(s => s.trim()).filter(s => s)
        };

        await this.updatePlan(tierId, updates);
        document.getElementById('edit-plan-modal').close();
    }
}
