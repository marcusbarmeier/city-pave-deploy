// © 2025 City Pave. All Rights Reserved.
// Filename: permissions-wizard.js

import { ModuleHierarchy, SaaSConfig } from './saas-modules.js';
import { ConflictAI } from './saas-ai.js';

let currentTenantTier = 'growth'; // Mock: Default to Growth for demo purposes
let selectedRole = 'laborer';

export function initializePermissionsWizard() {
    renderWizardUI();
    setupWizardListeners();
}

function renderWizardUI() {
    const container = document.getElementById('permissions-wizard-container');
    if (!container) return;

    const currentTierInfo = SaaSConfig.tiers[currentTenantTier];

    let html = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6 border-b pb-4">
                <div>
                    <h2 class="text-2xl font-bold flex items-center gap-2">
                        <span class="text-blue-600">🛡️</span> Permissions Wizard
                    </h2>
                    <p class="text-sm text-gray-500">Manage access for your team.</p>
                </div>
                <div class="text-right">
                    <div class="text-xs text-gray-400 uppercase font-bold">Current Plan</div>
                    <div class="px-3 py-1 rounded-full font-bold text-sm border ${currentTierInfo.color}">
                        ${currentTierInfo.name.toUpperCase()}
                    </div>
                </div>
            </div>
            
            <div class="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label class="block text-sm font-bold text-gray-700 mb-2">Select Role to Configure</label>
                <select id="wizard-role-select" class="w-full border border-gray-300 rounded p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="laborer">Laborer</option>
                    <option value="foreman">Foreman</option>
                    <option value="mechanic">Mechanic</option>
                    <option value="estimator">Estimator</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    `;

    Object.values(ModuleHierarchy).forEach(mod => {
        html += `
            <div class="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div class="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="font-bold text-gray-800">${mod.name}</h3>
                </div>
                <div class="p-4 space-y-3 bg-white">
        `;

        Object.values(mod.features).forEach(feat => {
            const isIncluded = SaaSConfig.includesTier(currentTenantTier, feat.tier);
            const isLocked = !isIncluded;

            // Visual Styles
            const opacity = isLocked ? 'opacity-60 grayscale' : '';
            const cursor = isLocked ? 'cursor-not-allowed' : 'cursor-pointer';

            // Badge Logic
            let badgeColor = 'bg-gray-100 text-gray-600';
            if (feat.tier === 'growth') badgeColor = 'bg-blue-50 text-blue-600 border-blue-100';
            if (feat.tier === 'titan') badgeColor = 'bg-purple-50 text-purple-600 border-purple-100';

            const badge = `<span class="text-[10px] px-1.5 py-0.5 rounded border ${badgeColor} font-bold ml-2">${feat.tier.toUpperCase()}</span>`;

            html += `
                <div class="flex items-start justify-between group relative ${opacity}">
                    <div class="flex items-start gap-3">
                        <div class="pt-0.5">
                            <input type="checkbox" id="perm-${feat.id}" class="w-4 h-4 text-blue-600 rounded ${cursor}" 
                                ${isLocked ? 'disabled' : ''} onchange="window.checkWizardConflict()">
                        </div>
                        <div>
                            <label for="perm-${feat.id}" class="text-sm font-medium text-gray-700 ${cursor} block">
                                ${feat.name} ${badge}
                            </label>
                            <p class="text-xs text-gray-400 mt-0.5">${feat.description}</p>
                        </div>
                    </div>
                    ${isLocked ? `
                        <div class="flex items-center">
                            <span class="text-xs text-purple-600 font-bold mr-2 hidden group-hover:block animate-pulse">Upgrade</span>
                            <span class="text-gray-400">🔒</span>
                        </div>
                        <!-- Tooltip -->
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded p-2 z-10 text-center shadow-lg">
                            Requires <strong>${feat.tier}</strong> Plan.<br>Contact Sales to Unlock.
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += `</div></div>`;
    });

    html += `
            </div>

            <!-- AI Conflict Warning Area -->
            <div id="wizard-ai-warning" class="mt-8 hidden bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-bold text-yellow-800">Conflict AI Warning</h3>
                        <p id="wizard-ai-message" class="text-sm text-yellow-700 mt-1"></p>
                    </div>
                </div>
            </div>

            <div class="mt-8 flex justify-end gap-4 border-t pt-6">
                <button class="px-4 py-2 text-gray-600 font-bold hover:text-gray-800">Reset to Default</button>
                <button class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-all active:scale-95">
                    Save Permissions
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function setupWizardListeners() {
    window.checkWizardConflict = () => {
        const permissions = {};
        document.querySelectorAll('input[type="checkbox"][id^="perm-"]').forEach(cb => {
            const id = cb.id.replace('perm-', '');
            permissions[id] = cb.checked;
        });

        const warning = ConflictAI.checkPermissionLogic(permissions);
        const warningBox = document.getElementById('wizard-ai-warning');
        const warningMsg = document.getElementById('wizard-ai-message');

        if (warning) {
            warningMsg.textContent = warning;
            warningBox.classList.remove('hidden');
        } else {
            warningBox.classList.add('hidden');
        }
    };
}
