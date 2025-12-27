import { db } from './firebase-client.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { TIER_LEVELS } from '../subscription/tiers.js';

export class Subscribers {
    constructor(app) {
        this.app = app;
        this.tenants = [];
        this.selectedTenantId = null;
    }

    async init() {
        // Fetch Real Data
        try {
            this.tenants = await this.fetchTenants();
            console.log("Fetched Tenants:", this.tenants);
        } catch (e) {
            console.error("Error fetching tenants:", e);
        }
        this.renderList();
        this.bindEvents();
    }

    async fetchTenants() {
        const tenants = [];
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Normalize Data for Dev Center
            tenants.push({
                id: doc.id,
                // Fallback to email if name is missing
                name: data.name || data.email || 'Unknown User',
                // Fallback to 'Basic' if no role/tier defined, handle 'super_admin'
                tier: this.mapRoleToTier(data),
                status: 'active' // Assuming active if they exist in DB for now
            });
        });
        return tenants;
    }

    mapRoleToTier(data) {
        if (data.role === 'super_admin') return TIER_LEVELS.LEVEL_3;
        if (data.role === 'admin') return TIER_LEVELS.LEVEL_2;
        // Handle Mini-App Specific Tiers later if stored in DB
        return data.tier || TIER_LEVELS.LEVEL_1;
    }

    renderList() {
        const container = document.getElementById('subscriber-list');
        if (!container) return;

        container.innerHTML = this.tenants.map(t => `
            <div class="list-item" data-id="${t.id}">
                <div class="tenant-name">${t.name}</div>
                <div class="tenant-meta">
                    <span class="status-indicator" style="padding:2px 6px; font-size:10px; border-color:transparent; background:${t.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${t.status === 'active' ? 'var(--success)' : 'var(--danger)'}">
                        ${t.tier}
                    </span>
                    • ID: ${t.id.substring(0, 6)}...
                </div>
            </div>
        `).join('');
    }

    bindEvents() {
        const list = document.getElementById('subscriber-list');
        list.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (!item) return;

            // UI Selection
            list.querySelectorAll('.list-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            // Logic
            this.selectedTenantId = item.dataset.id;
            const tenant = this.tenants.find(t => t.id === this.selectedTenantId);
            this.app.onSubscriberSelected(tenant);
        });

        // Search Filter
        document.getElementById('subscriber-search').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = list.querySelectorAll('.list-item');
            items.forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = text.includes(term) ? 'block' : 'none';
            });
        });
    }

    // --- Module Rendering (Col 2) ---

    renderModules(tenant) {
        document.getElementById('module-grid-empty').classList.add('hidden');
        const grid = document.getElementById('module-grid');
        grid.classList.remove('hidden');

        // Full Catalogue of Modules
        const allModules = [
            { id: 'estimator', name: 'Estimator', version: '2.1.0' },
            { id: 'sketch', name: 'Sketch Tool', version: '1.4.5' },
            { id: 'growth', name: 'Growth', version: '1.0.2' },
            { id: 'employee', name: 'Employee Portal', version: '3.0.1' },
            { id: 'operations', name: 'Operations Hub', version: '2.5.0' },
            { id: 'dispatch', name: 'Dispatch', version: '1.2.0' },
            { id: 'safety', name: 'Safety Manual', version: '4.0.0' },
            { id: 'fleet', name: 'Fleet Manager', version: '2.1.0' },
            { id: 'snow', name: 'Snow Calculator', version: '1.0.0' }, // NEW
            { id: 'excavator', name: 'Excavator Calculator', version: '1.0.0' }, // NEW
            { id: 'maintenance', name: 'Maintenance & Repairs', version: '1.1.0' }, // NEW
            { id: 'expenses', name: 'Expenses', version: '1.0.0' }, // NEW
            { id: 'whitelabel', name: 'White Labeling', version: '1.0.0' }, // NEW: Dedicated Global Module
            { id: 'ai_overlay', name: 'AI Overlay', version: '1.0.0' },
            { id: 'module_tuner', name: 'Module Tuner', version: '0.9.0' }
        ];

        // Determine status based on Tier
        const renderedModules = allModules.map(m => {
            let status = 'locked';

            // Logic for Mini-Apps vs Full Suite
            if (tenant.tier.includes('All Modules') || tenant.tier.includes('Super Admin') || tenant.tier === 'Enterprise') {
                status = 'active';
            } else if (tenant.tier.includes('Mini-App')) {
                // Check if specific mini-app is allowed
                if (tenant.tier.includes(m.name) || tenant.tier.includes(m.id)) {
                    status = 'active';
                }
            }

            return { ...m, status };
        });

        grid.innerHTML = renderedModules.map(m => `
            <div class="module-card ${m.status === 'locked' ? 'locked-card' : ''}" data-id="${m.id}" style="${m.status === 'locked' ? 'opacity:0.5;' : ''}">
                <div style="display:flex; align-items:center;">
                    <div class="mod-status ${m.status}"></div>
                    <div>
                        <div style="font-weight:600; font-size:0.9rem;">${m.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">v${m.version}</div>
                    </div>
                </div>
                ${m.status === 'locked' ? '🔒' : ''}
            </div>
        `).join('');

        // Bind Module Clicks
        grid.querySelectorAll('.module-card').forEach(card => {
            card.addEventListener('click', () => {
                grid.querySelectorAll('.module-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                const mod = renderedModules.find(m => m.id === card.dataset.id);
                this.app.onModuleSelected(mod, tenant);
            });
        });
    }
}
