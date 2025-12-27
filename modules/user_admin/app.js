
// modules/user_admin/app.js

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL, getStorage } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";
import { MonetizationService } from "../../classes/MonetizationService.js";

// --- Config ---
const firebaseConfig = {
    apiKey: "AIzaSyADrnYgh1fSTo3IZD7HOEJMyjduzDYIYSs",
    authDomain: "city-pave-estimator.firebaseapp.com",
    projectId: "city-pave-estimator",
    storageBucket: "city-pave-estimator.firebasestorage.app",
    messagingSenderId: "111714884839",
    appId: "1:111714884839:web:2b782a1b7be5be8edc5642"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- State ---
let currentPermissions = {};

document.addEventListener('DOMContentLoaded', async () => {
    // Determine which page we are on
    const path = window.location.pathname;

    if (path.includes('deployment.html')) {
        await initDeploymentPage();
    } else if (path.includes('employees.html')) {
        await initEmployeesPage();
    } else if (path.includes('legal.html')) {
        await initLegalPage();
    } else if (path.includes('store.html')) {
        await initStorePage();
    }
});

// --- Deployment Page Logic ---

async function initDeploymentPage() {
    console.log("Init Deployment Page...");

    // Auth Check (Simple Demo Version)
    const auth = getAuth(app);
    let tenantId = 'citypave'; // Default/Fallback for verify

    if (auth.currentUser) {
        // In real app, we might store tenantId in custom claims or user profile
        // For now, continue using 'citypave' or the user's UID if they are the admin
        tenantId = auth.currentUser.uid;
        // But for the E2E demo to work with the 'citypave' doc we often use...
        // Let's assume we are acting as the 'citypave' tenant admin.
        tenantId = 'citypave';
    }

    // Load Tenant Config (Entitlements)
    let isAuthorized = false;
    try {
        const docRef = doc(db, 'users', tenantId); // Assuming 'users' collection holds tenant configs as per Dev Admin
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            // Check 'services.custom_deployment'
            isAuthorized = data.services && data.services.custom_deployment;
            console.log(`[Tenant] Custom Deployment Authority: ${isAuthorized}`);
        } else {
            console.warn("Tenant config not found, defaulting to unauthorized.");
        }
    } catch (e) {
        console.error("Error fetching tenant config:", e);
    }

    // Load existing permissions
    await loadRBACConfig(isAuthorized); // Pass auth status down

    // Init AI Config
    initAIConfigPanel();

    // Attach listeners to "Deploy Changes" button
    const deployBtn = document.querySelector('button.bg-blue-600');
    if (deployBtn) {
        if (!isAuthorized) {
            deployBtn.style.display = 'none'; // Or keep visible but disabled if utilizing the banner logic
        } else {
            deployBtn.addEventListener('click', saveRBACConfig);
        }
    }
}

// --- AI Overlay Config Logic ---
function initAIConfigPanel() {
    const tierSelect = document.getElementById('ai-master-tier');
    const panel = document.getElementById('ai-config-panel');

    // 1. Load Current Tier (Simulate reading what PermissionGate reads)
    const currentTier = localStorage.getItem('city_pave_tier') || 'LEVEL_1';
    if (tierSelect) {
        tierSelect.value = currentTier;
        tierSelect.addEventListener('change', (e) => {
            const newTier = e.target.value;
            localStorage.setItem('city_pave_tier', newTier);
            // Trigger storage event for live sync in other tabs
            alert(`AI Tier updated to ${newTier}. Reloading simulators...`);
            renderAIFeatures(newTier);
        });
    }

    renderAIFeatures(currentTier);
}

function renderAIFeatures(tier) {
    const panel = document.getElementById('ai-config-panel');
    if (!panel) return;

    // Define Feature availability based on Tier (Client-side view of Tiers.js logic)
    const features = [
        { id: 'ai_geofence', label: 'Geofence Prompts', icon: '📍', minTier: 'LEVEL_2' },
        { id: 'ai_voice', label: 'Voice Interaction', icon: '🎙️', minTier: 'LEVEL_2' },
        { id: 'ai_dispatch', label: 'Dispatch Alerts', icon: '🚚', minTier: 'LEVEL_2' },
        { id: 'ai_bridge', label: 'Data Bridging', icon: '⚡', minTier: 'LEVEL_3' },
        { id: 'ai_global', label: 'Global Context', icon: '🌐', minTier: 'LEVEL_3' }
    ];

    const tierRank = { 'LEVEL_1': 1, 'LEVEL_2': 2, 'LEVEL_3': 3 };
    const currentRank = tierRank[tier] || 1;

    panel.innerHTML = features.map(f => {
        const isUnlocked = currentRank >= tierRank[f.minTier];
        const statusColor = isUnlocked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400';
        const statusText = isUnlocked ? 'Active' : `Requires ${f.minTier}`;
        const opacity = isUnlocked ? 'opacity-100' : 'opacity-60 grayscale';

        return `
            <div class="border rounded-lg p-4 flex items-center justify-between ${opacity} transition-all">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">
                        ${f.icon}
                    </div>
                    <div>
                        <div class="font-bold text-slate-800 text-sm">${f.label}</div>
                        <div class="text-xs text-slate-500">AI Module Feature</div>
                    </div>
                </div>
                <div class="text-xs font-bold px-2 py-1 rounded ${statusColor}">
                    ${statusText}
                </div>
            </div>
        `;
    }).join('');
}

// --- Module Registry (Synced from Dev Admin) ---
const AVAILABLE_MODULES = [
    { id: 'estimator', name: 'Estimator Engine', icon: '📊', description: 'Create & Send Proposals', currentEnv: 'prod' },
    { id: 'crew', name: 'Crew Ops', icon: '👷', description: 'Time Cards & Schedules', currentEnv: 'prod' },
    { id: 'ops', name: 'Operations', icon: '🏢', description: 'Dispatch & Job Mgmt', currentEnv: 'prod' },
    { id: 'sketch', name: 'Sketch App', icon: '✏️', description: 'Map Markup', currentEnv: 'prod' },
    { id: 'growth', name: 'Growth Engine', icon: '🚀', description: 'Leads & Sales', currentEnv: 'prod' },
    { id: 'mechanic', name: 'Maintenance', icon: '🔧', description: 'Fleet Repair Logs', currentEnv: 'prod' },
    { id: 'safety', name: 'Safety Bot', icon: '🦺', description: 'Safety Compliance', currentEnv: 'prod' },
    // These will be filtered if not prod, but for demo we show them if desired
    { id: 'ai_overlay', name: 'AI Overlay', icon: '🤖', description: 'Smart Insights', currentEnv: 'staging' },
];

async function loadRBACConfig(isAuthorized) {
    const matrixBody = document.getElementById('rbac-matrix-body');
    if (!matrixBody) return;

    // Default Perms
    currentPermissions = {};
    AVAILABLE_MODULES.forEach(m => {
        currentPermissions[m.id] = ['admin']; // Default admin only
    });

    // Overrides
    const defaults = {
        estimator: ['admin', 'manager', 'estimator'],
        crew: ['admin', 'manager', 'foreman', 'crew'],
        ops: ['admin', 'manager'],
        sketch: ['admin', 'manager', 'estimator'],
        growth: ['admin', 'manager', 'sales'],
        mechanic: ['admin', 'manager', 'mechanic'],
        safety: ['all']
    };
    currentPermissions = { ...currentPermissions, ...defaults };

    try {
        const docRef = doc(db, 'settings', 'rbac_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            // Merge saved with defaults
            const saved = snap.data().permissions || {};
            currentPermissions = { ...currentPermissions, ...saved };
        }
    } catch (e) {
        console.warn("Failed to load RBAC config, using defaults:", e);
    }

    renderDynamicRBAC(isAuthorized);
}

function renderDynamicRBAC(isAuthorized) {
    const matrixBody = document.getElementById('rbac-matrix-body');
    if (!matrixBody) return;
    matrixBody.innerHTML = '';

    // Check Authority (Mock: In real app, fetch tenant.custom_authority from DB)
    // For demo purposes, we can toggle this manually or assume TRUE for now, BUT the prompt asks for "Read Only" logic.
    // Let's assume a global 'window.mockTenantConfig' or similar. 
    // We will hardcode it to TRUE for the "Authorized" state demo, but add the banner logic.
    // const isAuthorized = true; // Set to false to test Read Only mode // REMOVED

    const messageContainer = document.getElementById('deployment-message');
    if (messageContainer) {
        if (!isAuthorized) {
            messageContainer.innerHTML = `
                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-yellow-700">
                                <strong>Read Only Mode:</strong> Your organization is not subscribed to <strong>Custom Deployment</strong>. <br>
                                Please contact your Plan Administrator or Developer to enable granular access control.
                            </p>
                        </div>
                    </div>
                </div>
            `;
            // Disable Save Button
            const btn = document.querySelector('button.bg-blue-600');
            if (btn) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.title = "Managed by Provider";
            }
        } else {
            messageContainer.innerHTML = ''; // Clear
        }
    }

    AVAILABLE_MODULES.forEach(mod => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50 transition';

        const isProd = mod.currentEnv === 'prod';
        const badge = !isProd ? `<span class="ml-2 text-[10px] bg-purple-100 text-purple-800 px-1 rounded border border-purple-200 uppercase tracking-wide">${mod.currentEnv}</span>` : '';

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 text-xl flex items-center justify-center bg-blue-100 rounded-lg">
                        ${mod.icon}
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-bold text-slate-900 flex items-center">${mod.name} ${badge}</div>
                        <div class="text-xs text-slate-500">${mod.description}</div>
                    </div>
                </div>
            </td>
            ${renderTierCell(mod.id, 'admin', isAuthorized)}
            ${renderTierCell(mod.id, 'manager', isAuthorized)}
            ${renderTierCell(mod.id, 'estimator', isAuthorized)}
            ${renderTierCell(mod.id, 'crew', isAuthorized)}
        `;
        matrixBody.appendChild(row);
    });
}

function renderTierCell(moduleId, role, isAuthorized = true) {
    // Current value could be 'LEVEL_1', 'LEVEL_2', 'LEVEL_3' OR boolean true/false (legacy)
    let val = currentPermissions[moduleId]?.[role] || 'OFF';
    if (val === true) val = 'LEVEL_3'; // Migrate legacy True to Max

    // If permission structure is array based (moduleId: ['admin', 'manager']), we need to find if role is present
    // The previous implementation used an array of roles. We should upgrade this to object map or parse the array.
    // Let's assume for this "Advanced" version we migrate data structure to: { estimator: { admin: 'LEVEL_3' } }
    // BUT to maintain compatibility with the previous `currentPermissions[m.id] = ['admin']` structure:
    // We'll check if role exists in array -> if so, Tier = LEVEL_3 (Default), else OFF.
    // Ideally we'd store complex objects, but let's stick to the Array = Permissions for now, 
    // AND add a separate map for Tiers if we want granular control?

    // Plan B: The prompt implies they can set the Tier Level.
    // So we need a data structure change.
    // `permissions` = { estimator: { admin: 'LEVEL_3', crew: 'LEVEL_1' } }

    // MOCK ADAPTER:
    // If it's an array (Legacy), we assume LEVEL_3 for anyone in it.
    let currentTier = 'OFF';
    if (Array.isArray(currentPermissions[moduleId])) {
        if (currentPermissions[moduleId].includes(role)) currentTier = 'LEVEL_3';
    } else if (currentPermissions[moduleId] && typeof currentPermissions[moduleId] === 'object') {
        currentTier = currentPermissions[moduleId][role] || 'OFF';
    }

    const id = `cb-${moduleId}-${role}`;

    // Style the select to look like a badge
    const tierColors = {
        'OFF': 'bg-gray-100 text-gray-400',
        'LEVEL_1': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        'LEVEL_2': 'bg-blue-50 text-blue-700 border-blue-200',
        'LEVEL_3': 'bg-green-50 text-green-700 border-green-200'
    };

    const bgClass = tierColors[currentTier] || tierColors['OFF'];

    return `
        <td class="px-6 py-4 whitespace-nowrap text-center">
            <select 
                id="${id}"
                data-module="${moduleId}" 
                data-role="${role}" 
                ${!isAuthorized ? 'disabled' : ''}
                class="text-xs font-bold rounded-full px-2 py-1 border focus:ring-2 focus:ring-blue-500 cursor-pointer ${bgClass} rbac-select"
                style="appearance:none; text-align-last:center;"
                onchange="this.className = 'text-xs font-bold rounded-full px-2 py-1 border focus:ring-2 focus:ring-blue-500 cursor-pointer rbac-select ' + ({'OFF':'bg-gray-100 text-gray-400','LEVEL_1':'bg-yellow-50 text-yellow-700 border-yellow-200','LEVEL_2':'bg-blue-50 text-blue-700 border-blue-200','LEVEL_3':'bg-green-50 text-green-700 border-green-200'}[this.value])"
            >
                <option value="OFF" ${currentTier === 'OFF' ? 'selected' : ''}>OFF</option>
                <option value="LEVEL_1" ${currentTier === 'LEVEL_1' ? 'selected' : ''}>L1</option>
                <option value="LEVEL_2" ${currentTier === 'LEVEL_2' ? 'selected' : ''}>L2</option>
                <option value="LEVEL_3" ${currentTier === 'LEVEL_3' ? 'selected' : ''}>L3</option>
            </select>
        </td>
    `;
}

// function renderMatrixState() { ... removed in favor of renderDynamicRBAC ... }

async function saveRBACConfig() {
    const selects = document.querySelectorAll('.rbac-select');
    const newPermissions = {};

    selects.forEach(sel => {
        const module = sel.dataset.module;
        const role = sel.dataset.role;
        const tier = sel.value;

        if (!newPermissions[module]) newPermissions[module] = {};

        // Store as Granular Object: { admin: 'LEVEL_3', crew: 'LEVEL_1' }
        if (tier !== 'OFF') {
            newPermissions[module][role] = tier;
        }
    });

    // Ensure modules not in the matrix (like 'home') are preserved or defaulted?
    // For this prototype, we merge with existing to be safe.
    const mergedPermissions = { ...currentPermissions, ...newPermissions };

    const btn = document.querySelector('button.bg-blue-600');
    const originalText = btn.textContent;
    btn.textContent = "Deploying...";
    btn.disabled = true;

    try {
        await setDoc(doc(db, 'settings', 'rbac_config'), {
            permissions: mergedPermissions,
            updatedAt: new Date().toISOString()
        });
        alert("Configuration deployed successfully! User navigation will update on next reload.");
    } catch (e) {
        console.error("Error saving RBAC:", e);
        alert("Failed to deploy changes: " + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- Employee Manager Logic ---

async function initEmployeesPage() {
    console.log("Init Employees Page...");
    await loadUsers();

    const createBtn = document.getElementById('create-user-btn');
    if (createBtn) createBtn.addEventListener('click', createUser);
}

async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">Loading team...</td></tr>';

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const users = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });
        renderUserTable(users);
    } catch (e) {
        console.error("Error loading users:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-red-500">Error: ${e.message}</td></tr>`;
    }
}

function renderUserTable(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">No team members found. Add one!</td></tr>';
        return;
    }

    users.forEach(user => {
        const roleColors = {
            admin: 'bg-purple-100 text-purple-800',
            manager: 'bg-indigo-100 text-indigo-800',
            estimator: 'bg-blue-100 text-blue-800',
            foreman: 'bg-green-100 text-green-800',
            crew: 'bg-yellow-100 text-yellow-800',
            mechanic: 'bg-orange-100 text-orange-800',
            sales: 'bg-teal-100 text-teal-800'
        };
        const badgeClass = roleColors[user.role] || 'bg-gray-100 text-gray-800';

        const row = `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 text-xl font-bold rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                            ${(user.name || 'U').charAt(0)}
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.name || 'Unknown'}</div>
                            <div class="text-sm text-gray-500">${user.email || 'No Email'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}">
                        ${(user.role || 'crew').toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Active
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="deleteUser('${user.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

async function createUser() {
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const btn = document.getElementById('create-user-btn');

    if (!name || !email || !password) return alert("Please fill in all fields.");

    btn.textContent = "Creating...";
    btn.disabled = true;

    // Use Secondary App pattern to create user without logging out admin
    const secondaryApp = initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = getAuth(secondaryApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        // Create Firestore Doc
        await setDoc(doc(db, "users", uid), {
            uid: uid,
            name: name,
            email: email,
            role: role,
            createdAt: new Date().toISOString(),
            status: 'active'
        });

        alert("User created successfully!");
        document.getElementById('create-user-modal').classList.add('hidden');
        document.getElementById('new-user-password').value = ''; // clear sensitive
        loadUsers();

    } catch (e) {
        console.error("Error creating user:", e);
        alert("Failed to create user: " + e.message);
    } finally {
        await deleteApp(secondaryApp);
        btn.textContent = "Create Account";
        btn.disabled = false;
    }
}

// --- Legal Hub Logic ---

let activeUploadType = null;

async function initLegalPage() {
    console.log("Init Legal Page...");

    // File Input Listener
    const input = document.getElementById('legal-upload-input');
    if (input) {
        input.addEventListener('change', handleContractUpload);
    }

    // Expose trigger globally (for onclick)
    window.triggerUpload = (type) => {
        activeUploadType = type;
        if (input) input.click();
    };
}

async function handleContractUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!activeUploadType) return alert("Upload type not specified.");

    // Filename logic: contracts/TYPE_TIMESTAMP_name
    const path = `contracts/${activeUploadType}_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);

    // Provide UI feedback (simple loading spinner or toast in real app)
    const originalText = e.target.previousElementSibling?.textContent; // Not reliable, better to use a global loader
    document.body.style.cursor = 'wait';

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        console.log("Uploaded to:", url);

        // Update Firestore
        // We'll store a map: { [type]: { url, updatedAt, name } }
        await setDoc(doc(db, "settings", "legal_docs"), {
            [activeUploadType]: {
                url: url,
                name: file.name,
                updatedAt: new Date().toISOString()
            }
        }, { merge: true });

        alert(`Success! Uploaded new ${activeUploadType} document.`);

    } catch (e) {
        console.error("Upload failed:", e);
        alert("Upload failed: " + e.message);
    } finally {
        document.body.style.cursor = 'default';
        e.target.value = ''; // Reset input
    }
}

// --- Module Store Logic ---

async function initStorePage() {
    console.log("Init Store Page...");

    const monService = new MonetizationService();
    await monService.init(db);

    const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3'); // Basic selector
    if (!container) return;

    // Show loading
    container.innerHTML = '<div class="col-span-3 text-center py-10 text-gray-400">Loading Subscription Plans...</div>';

    try {
        const plans = await monService.getPlans();
        const currentSub = await monService.getCurrentSubscription();

        container.innerHTML = ''; // Clear

        plans.forEach(plan => {
            const isCurrent = currentSub && currentSub.tier_id === plan.internal_tier_id;
            const btnState = isCurrent
                ? `<button class="w-full block text-center bg-gray-100 border border-gray-300 text-gray-400 font-bold py-2 rounded-lg cursor-not-allowed" disabled>Current Plan</button>`
                : `<button onclick="subscribeToPlan('${plan.internal_tier_id}')" class="w-full block text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg shadow">Subscribe</button>`;

            const featureList = (plan.feature_bullets || []).map(f => `
                <div class="flex items-center text-sm text-gray-600">
                    <svg class="h-5 w-5 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    ${f}
                </div>
            `).join('');

            const colorClass = plan.internal_tier_id === 'tier_enterprise' ? 'bg-purple-600' : (plan.internal_tier_id === 'tier_pro' ? 'bg-indigo-600' : 'bg-gray-400');

            const card = `
                <div class="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 transition-all hover:shadow-xl">
                    <div class="${colorClass} h-2"></div>
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-xl font-bold text-gray-900">${plan.display_name}</h3>
                            <span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded-full">${plan.price_label_override}</span>
                        </div>
                        <p class="text-gray-600 text-sm mb-6">${plan.marketing_tagline}</p>
                        <div class="space-y-3 mb-6">${featureList}</div>
                        ${btnState}
                    </div>
                </div>
            `;
            container.innerHTML += card;
        });

        // Add Logic Helper
        window.subscribeToPlan = async (tierId) => {
            if (!confirm(`Switch to ${tierId}?`)) return;
            // Mock Subscribe
            alert(`Redirecting to Stripe/Store for ${tierId}...`);
            // In real app, call backend to get checkout URL
        };

        // Add Restore Purchases Button if needed (maybe in header?)
        // const header = document.querySelector('.mb-8.flex');
        // if(header) header.innerHTML += `<button onclick="window.monService.restorePurchases()">Restore Purchases</button>`;
        // Note: keeping it simple for now as requested by "Part 2"

    } catch (e) {
        console.error("Failed to load plans", e);
        container.innerHTML = `<div class="text-red-500">Error loading plans: ${e.message}</div>`;
    }
}

async function purchaseModule(moduleId, btn) {
    const originalText = btn.textContent;
    btn.textContent = "Processing...";
    btn.disabled = true;

    // Simulate Stripe Checkout
    await new Promise(r => setTimeout(r, 1500));

    // Confirm (Mock)
    if (confirm("Proceed with payment? (Demo Mode: Card will be approved instantly)")) {
        try {
            // Write to Billing/Modules 
            // In a real app, successful stripe webhook would do this
            await setDoc(doc(db, "tenants", "citypave"), {
                modules: {
                    [moduleId]: true
                }
            }, { merge: true });

            btn.textContent = "Purchased";
            btn.className = "w-full block text-center bg-gray-100 border border-gray-300 text-gray-400 font-bold py-2 rounded-lg cursor-not-allowed";
            alert("Payment Successful! Module enabled.");

        } catch (e) {
            alert("Error: " + e.message);
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } else {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

window.deleteUser = async function (userId) {
    if (!confirm("Are you sure you want to delete this user? They will lose access immediately.")) return;

    try {
        await deleteDoc(doc(db, "users", userId));
        alert("User deleted.");
        loadUsers();
    } catch (e) {
        console.error("Delete failed:", e);
        alert("Failed to delete: " + e.message);
    }
}
