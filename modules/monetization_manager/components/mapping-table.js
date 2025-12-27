/**
 * Component: MappingTable
 * Renders the "Rosetta Stone" table.
 */
export class MappingTable {
    constructor(containerId, plans) {
        this.containerId = containerId;
        this.plans = plans || [];
        this.onEdit = (id) => { };
    }

    updatePlans(plans) {
        this.plans = plans;
        this.render();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const plansEmpty = this.plans.length === 0;

        container.innerHTML = `
             <div class="plans-section bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                <div class="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 class="text-lg font-bold text-green-400 flex items-center gap-2">
                        <span>💎</span> Tier Mapping & Dynamic Paywall
                    </h3>
                     ${plansEmpty ? `
                        <button id="seed-plans-btn" class="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2">
                            <span>🌱</span> Seed Defaults
                        </button>
                    ` : ''}
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-gray-300">
                        <thead class="bg-gray-900 text-gray-500 uppercase text-xs font-bold">
                            <tr>
                                <th class="px-4 py-3">Tier ID</th>
                                <th class="px-4 py-3">Display Name</th>
                                <th class="px-4 py-3">Store IDs (iOS / Android / Stripe)</th>
                                <th class="px-4 py-3">Config</th>
                                <th class="px-4 py-3">Marketing Tagline</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-700">
                            ${this.plans.map(plan => this.renderRow(plan)).join('')}
                            ${plansEmpty ? '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">No plans found.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Bind Edit buttons
        this.plans.forEach(plan => {
            const btn = document.getElementById(`edit-btn-${plan.internal_tier_id}`);
            if (btn) btn.onclick = () => this.onEdit(plan.internal_tier_id);
        });

        const seedBtn = document.getElementById('seed-plans-btn');
        if (seedBtn) seedBtn.onclick = () => this.onSeed();
    }

    renderRow(plan) {
        const storeIds = plan.store_product_ids || {};
        const modules = plan.module_permissions || [];

        return `
            <tr class="hover:bg-gray-700/50 transition">
                <td class="px-4 py-3 font-mono text-xs text-blue-300">${plan.internal_tier_id}</td>
                <td class="px-4 py-3">
                    <div class="font-bold text-white text-base">${plan.display_name}</div>
                    <div class="text-xs text-green-400 font-mono">${plan.price_label_override}</div>
                </td>
                <td class="px-4 py-3 text-xs text-gray-400 space-y-1">
                    <div class="flex items-center gap-2" title="iOS"><span class="w-4 text-center">🍎</span> ${storeIds.ios || '-'}</div>
                    <div class="flex items-center gap-2" title="Google Play"><span class="w-4 text-center">🤖</span> ${storeIds.android || '-'}</div>
                    <div class="flex items-center gap-2" title="Stripe"><span class="w-4 text-center">💳</span> ${storeIds.stripe || '-'}</div>
                </td>
                <td class="px-4 py-3 text-xs">
                     <div class="mb-1">
                        <span class="text-white font-bold">${modules.length}</span> modules
                     </div>
                </td>
                <td class="px-4 py-3 italic text-gray-400">"${plan.marketing_tagline}"</td>
                <td class="px-4 py-3 text-right">
                    <button id="edit-btn-${plan.internal_tier_id}" 
                        class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-bold">
                        Edit
                    </button>
                </td>
            </tr>
        `;
    }

    onSeed() { console.log('Seed requested'); }
}
