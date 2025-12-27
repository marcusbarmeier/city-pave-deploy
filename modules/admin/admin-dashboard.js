// © 2025 City Pave. All Rights Reserved.
// Filename: admin-dashboard.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, deleteDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { deleteApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { StorageGatekeeper } from '../../storage-gatekeeper.js';

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
const auth = getAuth(app);

// Expose services for navigation.js
window.firebaseServices = {
    auth,
    db,
    doc,
    getDoc,
    setDoc,
    collection,
    signOut
};

// --- State ---
let users = [];
let vehicles = [];

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadUsers();
    await loadFleet();

    document.getElementById('add-user-form').addEventListener('submit', handleAddUser);

    // Estimator Permissions Logic
    const savePermsBtn = document.getElementById('save-permissions-btn');
    if (savePermsBtn) savePermsBtn.addEventListener('click', saveEstimatorPermissions);
    await loadEstimatorPermissions();

    updateStorageMeter();

    // Initial RBAC Render
    renderRBACMatrix();
});

function updateStorageMeter() {
    const stats = StorageGatekeeper.getStats();
    const bar = document.getElementById('storage-bar');
    const text = document.getElementById('storage-text');
    if (bar && text) {
        bar.style.width = `${stats.percent}%`;
        text.textContent = `${stats.used.toFixed(1)}MB / ${stats.limit}MB`;

        if (stats.percent > 90) {
            bar.classList.remove('bg-blue-600');
            bar.classList.add('bg-red-600');
        }
    }
}

// --- Navigation Logic ---
// --- Navigation Logic ---
window.switchSection = function (sectionId) {
    // Hide all sections
    ['hr', 'fleet', 'finance', 'permissions'].forEach(id => {
        const el = document.getElementById(`sec-${id}`);
        const btn = document.getElementById(`nav-${id}`);

        if (el) el.classList.add('hidden');
        if (btn) {
            btn.classList.remove('active', 'bg-blue-50', 'text-blue-600', 'border-r-4', 'border-blue-600');
            btn.classList.add('text-gray-600', 'hover:bg-gray-50');
        }
    });

    // Show selected
    const target = document.getElementById(`sec-${sectionId}`);
    const targetBtn = document.getElementById(`nav-${sectionId}`);

    if (target) target.classList.remove('hidden');
    if (targetBtn) {
        targetBtn.classList.remove('text-gray-600', 'hover:bg-gray-50');
        targetBtn.classList.add('active', 'bg-blue-50', 'text-blue-600', 'border-r-4', 'border-blue-600');
    }
}


// --- User Management ---

async function loadUsers() {
    const tbody = document.getElementById('staff-list-body');
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Loading staff...</td></tr>';

    try {
        const snap = await getDocs(collection(db, 'users')); // In real app, filter by tenantId
        users = [];
        snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

        // Mock data if empty
        if (users.length === 0) {
            users = [
                { id: 'u1', name: 'John Doe', role: 'foreman', status: 'Active', certs: ['OSHA 10'] },
                { id: 'u2', name: 'Jane Smith', role: 'admin', status: 'Active', certs: [] },
                { id: 'u3', name: 'Mike Ross', role: 'laborer', status: 'Onboarding', certs: [] }
            ];
        }

        renderUsers();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error loading staff</td></tr>`;
    }
}

function renderUsers() {
    const tbody = document.getElementById('staff-list-body');
    tbody.innerHTML = '';

    users.forEach(u => {
        const roleBadge = u.role === 'admin' ? 'bg-purple-100 text-purple-800' : (u.role === 'foreman' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800');
        const statusDot = u.status === 'Active' ? 'bg-green-500' : 'bg-yellow-500';

        const row = `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-4 font-medium text-gray-900">${u.name}</td>
                <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold uppercase ${roleBadge}">${u.role}</span></td>
                <td class="p-4 text-sm text-gray-500">${u.certs ? u.certs.join(', ') : '-'}</td>
                <td class="p-4 flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full ${statusDot}"></div>
                    <span class="text-sm text-gray-600">${u.status}</span>
                </td>
                <td class="p-4 text-right">
                    <button class="text-gray-400 hover:text-blue-600 font-bold text-sm">Edit</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}



async function handleAddUser(e) {
    e.preventDefault();
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;

    if (password.length < 6) return alert("Password must be at least 6 characters.");

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Creating...";

    // Create secondary app to avoid logging out current admin
    const secondaryApp = initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = getAuth(secondaryApp);

    try {
        // 1. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        // 2. Create Firestore Profile
        const newUser = {
            uid: uid,
            name, email, role,
            status: 'Active',
            certs: [],
            createdAt: new Date().toISOString(),
            tenantId: 'citypave'
        };

        await setDoc(doc(db, 'users', uid), newUser);

        // 3. Update UI
        users.push({ id: uid, ...newUser });
        renderUsers();

        document.getElementById('add-user-modal').classList.add('hidden');
        document.getElementById('add-user-form').reset();
        alert(`User ${name} created successfully!`);

    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            alert("This email is already registered. Please log in with this account or use a different email.");
        } else {
            alert("Error creating user: " + error.message);
        }
    } finally {
        await deleteApp(secondaryApp);
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// --- Fleet Management ---

async function loadFleet() {
    const list = document.getElementById('vehicle-list');

    // Mock Data
    vehicles = [
        { id: 'v1', name: 'Ford F-250 (Unit 101)', type: 'Truck', status: 'Active' },
        { id: 'v2', name: 'Bobcat S70', type: 'Skid Steer', status: 'Maintenance' },
        { id: 'v3', name: 'Dump Trailer 12ft', type: 'Trailer', status: 'Active' }
    ];

    list.innerHTML = '';
    vehicles.forEach(v => {
        const icon = v.type === 'Truck' ? '🚛' : (v.type === 'Skid Steer' ? '🚜' : '🛒');
        const statusColor = v.status === 'Active' ? 'text-green-600' : 'text-orange-500';

        const item = `
            <li class="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                <div class="flex items-center gap-3">
                    <span class="text-xl">${icon}</span>
                    <div>
                        <div class="font-bold text-gray-800 text-sm">${v.name}</div>
                        <div class="text-xs text-gray-500">${v.type}</div>
                    </div>
                </div>
                <div class="text-xs font-bold ${statusColor}">${v.status}</div>
            </li>
        `;
        list.innerHTML += item;
    });
}

// --- Estimator Permissions ---

async function loadEstimatorPermissions() {
    try {
        const settingsSnap = await getDocs(collection(db, 'settings'));
        let config = {};
        settingsSnap.forEach(d => {
            if (d.id === 'estimator_config') config = d.data();
        });

        if (config) {
            if (document.getElementById('perm-terms-default')) document.getElementById('perm-terms-default').checked = config.allowTermsDefault ?? true;
            if (document.getElementById('perm-terms-all')) document.getElementById('perm-terms-all').checked = config.allowTermsAll ?? false;
            if (document.getElementById('perm-appendix-default')) document.getElementById('perm-appendix-default').checked = config.allowAppendixDefault ?? true;
            if (document.getElementById('perm-appendix-all')) document.getElementById('perm-appendix-all').checked = config.allowAppendixAll ?? false;
        }
    } catch (e) {
        console.error("Error loading permissions:", e);
    }
}

async function saveEstimatorPermissions() {
    const btn = document.getElementById('save-permissions-btn');
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    const config = {
        allowTermsDefault: document.getElementById('perm-terms-default').checked,
        allowTermsAll: document.getElementById('perm-terms-all').checked,
        allowAppendixDefault: document.getElementById('perm-appendix-default').checked,
        allowAppendixAll: document.getElementById('perm-appendix-all').checked,
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, 'settings', 'estimator_config'), config, { merge: true });
        alert("Permissions saved successfully.");
    } catch (e) {
        console.error(e);
        alert("Error saving permissions: " + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- RBAC Matrix Logic (Permissions Board) ---

// Removed modal event listener, now part of tab switching

window.renderRBACMatrix = async function () {
    const tbody = document.getElementById('rbac-matrix-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Loading permissions...</td></tr>';

    // 1. Check if Advanced RBAC is deployed
    let isEditable = false;
    let savedConfig = null;
    try {
        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js");

        // Check Feature Flag
        const modSnap = await getDoc(doc(db, 'settings', 'modules'));
        if (modSnap.exists() && modSnap.data().advancedRBAC) {
            isEditable = true;
        }

        // Fetch Saved Config
        const configSnap = await getDoc(doc(db, 'settings', 'rbac_config'));
        if (configSnap.exists()) {
            savedConfig = configSnap.data().permissions;
        }
    } catch (e) {
        console.warn("Error checking RBAC modules:", e);
    }

    // Update UI Status Indicator
    const statusIndicator = document.getElementById('rbac-status-indicator');
    const actionsBar = document.getElementById('rbac-actions');

    if (isEditable) {
        if (statusIndicator) {
            statusIndicator.className = "px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200";
            statusIndicator.textContent = "Editable Mode";
        }
        if (actionsBar) actionsBar.classList.remove('hidden');
    } else {
        if (statusIndicator) {
            statusIndicator.className = "px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200";
            statusIndicator.textContent = "Read-Only Mode";
        }
        if (actionsBar) actionsBar.classList.add('hidden');
    }

    tbody.innerHTML = '';

    // Define the matrix based on navigation.js (Base Defaults)
    const roles = ['admin', 'manager', 'estimator', 'foreman', 'crew', 'mechanic', 'sales'];
    const pages = [
        { id: 'home', name: 'Home', defaultAccess: ['all'] },
        { id: 'crew', name: 'Crew Operations', defaultAccess: ['crew', 'foreman', 'admin', 'super_admin'] },
        { id: 'ops', name: 'Management', defaultAccess: ['manager', 'admin', 'super_admin'] },
        { id: 'estimator', name: 'Estimator', defaultAccess: ['estimator', 'admin', 'super_admin'] },
        { id: 'sketch', name: 'Sketch App', defaultAccess: ['estimator', 'admin', 'super_admin'] },
        { id: 'growth', name: 'Lead Generation', defaultAccess: ['sales', 'admin', 'super_admin'] },
        { id: 'mechanic', name: 'Maintenance', defaultAccess: ['mechanic', 'admin', 'super_admin'] },
        { id: 'safety', name: 'Safety', defaultAccess: ['all'] },
        { id: 'admin', name: 'User Admin', defaultAccess: ['admin', 'super_admin'] },
        { id: 'dev', name: 'Developer Admin', defaultAccess: ['admin', 'super_admin'] }
    ];

    pages.forEach(page => {
        let rowHtml = `<tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" data-page-id="${page.id}">${page.name}</td>`;

        // Only show columns for Admin, Manager, Staff (Estimator/Foreman/Crew grouped?), Viewer
        // For simplicity, let's stick to the columns in the HTML: Admin, Manager, Staff, Viewer
        // Mapping internal roles to these columns:
        // Admin -> admin
        // Manager -> manager
        // Staff -> estimator, foreman, crew, mechanic, sales (We'll use 'staff' as a generic key for now, or pick one representative)
        // Viewer -> viewer (not in roles list, let's add it or map it)

        // Revised Strategy: Render columns for specific key roles that match the HTML headers
        const displayRoles = ['admin', 'manager', 'staff', 'viewer'];
        // Note: 'staff' and 'viewer' aren't in the `roles` array above. 
        // We need to map them or update the HTML headers to match actual roles.
        // Let's update the Logic to match the HTML headers: Admin, Manager, Staff, Viewer.
        // And assume 'staff' maps to 'estimator/foreman' etc in the backend, but for this UI we treat them as abstract roles.

        displayRoles.forEach(role => {
            // Determine access: Saved Config > Default
            let hasAccess = false;

            // Default Logic Mapping
            if (savedConfig && savedConfig[page.id]) {
                hasAccess = savedConfig[page.id].includes(role);
            } else {
                // Approximate defaults for these abstract roles
                if (role === 'admin') hasAccess = true;
                else if (role === 'manager' && ['ops', 'estimator', 'growth'].includes(page.id)) hasAccess = true;
                else if (role === 'staff' && ['crew', 'mechanic', 'safety'].includes(page.id)) hasAccess = true;
                else if (role === 'viewer' && ['home', 'safety'].includes(page.id)) hasAccess = true;
                else if (page.defaultAccess.includes('all')) hasAccess = true;
            }

            let cellContent = '';
            if (isEditable) {
                const isLocked = (role === 'admin' && (page.id === 'admin' || page.id === 'dev'));

                // Toggle Switch UI
                cellContent = `
                    <label class="relative inline-flex items-center cursor-pointer justify-center w-full">
                        <input type="checkbox" class="rbac-checkbox sr-only peer" 
                            data-page="${page.id}" data-role="${role}" 
                            ${hasAccess ? 'checked' : ''} ${isLocked ? 'disabled checked' : ''}>
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[calc(50%-1.125rem+2px)] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                `;
            } else {
                cellContent = hasAccess
                    ? `<span class="text-green-500 font-bold">ON</span>`
                    : `<span class="text-gray-300">OFF</span>`;
            }
            rowHtml += `<td class="px-6 py-4 whitespace-nowrap text-center text-sm">${cellContent}</td>`;
        });

        rowHtml += `</tr>`;
        tbody.innerHTML += rowHtml;
    });
}

window.saveRBACChanges = async function () {
    const btn = document.querySelector('#rbac-actions button:last-child');
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
        const permissions = {};
        const checkboxes = document.querySelectorAll('.rbac-checkbox');

        checkboxes.forEach(cb => {
            const page = cb.dataset.page;
            const role = cb.dataset.role;
            if (!permissions[page]) permissions[page] = [];

            if (cb.checked) {
                permissions[page].push(role);
            }
        });

        await setDoc(doc(db, 'settings', 'rbac_config'), {
            permissions: permissions,
            updatedAt: new Date().toISOString()
        });

        alert("Permissions updated successfully.");

    } catch (e) {
        console.error("Error saving RBAC:", e);
        alert("Failed to save permissions.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
