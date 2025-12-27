/**
 * Unified Navigation System
 * Renders a consistent navigation bar across all pages based on user permissions.
 */

export async function initNavigation(containerId = 'app-navigation') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Wait for Firebase Auth to be ready
    let attempts = 0;
    const checkAuth = setInterval(async () => {
        attempts++;
        if (window.firebaseServices && window.firebaseServices.auth) {
            clearInterval(checkAuth);

            // Initial render with auth user (might lack role)
            let user = window.firebaseServices.auth.currentUser;
            await handleUserRole(user);
            renderNavigation(container, user);

            // Listen for auth state changes
            window.firebaseServices.auth.onAuthStateChanged(async (u) => {
                user = u;
                await handleUserRole(user);
                renderNavigation(container, user);
            });
        } else if (attempts > 50) { // 5 seconds timeout warning
            console.warn("Nav: Waiting for firebaseServices...");
        }
    }, 100);
}

// Helper to fetch config once
let rbacConfig = null;
async function loadRBACConfig() {
    if (rbacConfig) return rbacConfig;
    try {
        const { db, doc, getDoc } = window.firebaseServices || {};
        if (db && doc && getDoc) {
            const snap = await getDoc(doc(db, 'settings', 'rbac_config'));
            if (snap.exists()) {
                rbacConfig = snap.data().permissions;
            }
        }
    } catch (e) {
        console.warn("Nav: Failed to load RBAC config", e);
    }
    return rbacConfig;
}

async function handleUserRole(user) {
    // Fetch RBAC Config
    await loadRBACConfig();

    if (!user) {
        window.currentUser = null;
        return;
    }

    // If role is already present, we are good
    if (window.currentUser && window.currentUser.role) {
        if (window.currentUser.uid === user.uid) return;
    }

    // Fetch role from Firestore
    try {
        const { db, doc, getDoc } = window.firebaseServices;
        if (db && doc && getDoc) {
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                window.currentUser = { ...user, ...userData };
            } else {
                window.currentUser = { ...user, role: 'crew' };
            }

            // Sync Permissions
            if (window.globalPermissionGate) {
                window.globalPermissionGate.syncWithUser(window.currentUser);
            } else {
                // Dynamic Import fallback if module loading order is tricky
                import('./modules/subscription/tiers.js').then(({ globalPermissionGate }) => {
                    globalPermissionGate.syncWithUser(window.currentUser);
                });
            }
        }
    } catch (error) {
        window.currentUser = { ...user, role: 'crew' };
    }
}

function renderNavigation(container, user) {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    // Define menu items with IDs matching Admin Dashboard
    const menuItems = [
        { id: 'home', label: 'Home', url: '/index.html', roles: ['all'] },
        { id: 'crew', label: 'Crew Operations', url: '/modules/employee/index.html', roles: ['crew', 'foreman', 'admin', 'super_admin'] },
        { id: 'ops', label: 'Management', url: '/modules/operations/index.html', roles: ['manager', 'admin', 'super_admin'] },
        { id: 'estimator', label: 'Estimator', url: '/modules/estimator/index.html', roles: ['estimator', 'admin', 'super_admin'] },
        { id: 'sketch', label: 'Sketch App', url: '/modules/sketch/index.html', roles: ['estimator', 'admin', 'super_admin'] },
        { id: 'growth', label: 'Lead Generation', url: '/modules/growth/index.html', roles: ['sales', 'admin', 'super_admin'] },
        { id: 'mechanic', label: 'Maintenance', url: '/modules/fleet/index.html', roles: ['mechanic', 'admin', 'super_admin'] },
        { id: 'navigation', label: 'Navigation', url: '/modules/navigation/index.html', roles: ['crew', 'foreman', 'admin', 'super_admin'] },
        { id: 'safety', label: 'Safety', url: '/modules/safety/index.html', roles: ['all'] },
    ];

    const adminItems = [
        { id: 'admin', label: 'User Admin', url: '/modules/user_admin/index.html' },
        { id: 'dev', label: 'Developer Admin', url: '/modules/admin/developer-console.html' }
    ];

    const userRole = window.currentUser?.role || 'crew';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin' || (user && user.email && (user.email.includes('admin') || user.email.includes('dev')));

    let navHtml = `
        <nav class="bg-white shadow-md no-print">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex">
                        <div class="flex-shrink-0 flex items-center">
                            <span class="font-bold text-xl text-blue-600">City Pave</span>
                        </div>
                        <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
    `;

    menuItems.forEach(item => {
        let hasAccess = false;

        // Check Saved Config first
        if (rbacConfig && rbacConfig[item.id]) {
            hasAccess = rbacConfig[item.id].includes(userRole);
        } else {
            // Fallback to default
            hasAccess = item.roles.includes('all') || (user && (isAdmin || item.roles.includes(userRole)));
        }

        if (hasAccess) {
            // Fix for module paths: Check if the item URL ends with the current path segment
            // OR if we are in a module, check if the item URL contains the module name
            const currentFullUrl = window.location.href;
            const isActive = currentFullUrl.includes(item.url) || (item.url === 'index.html' && window.location.pathname.endsWith('/'));
            const activeClass = isActive
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700';

            navHtml += `
                <a href="${item.url}" 
                   class="${activeClass} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    ${item.label}
                </a>
            `;
        }
    });

    // Admin Dropdown
    if (isAdmin) {
        navHtml += `
            <div class="relative ml-3 flex items-center group">
                <button type="button" class="border-transparent text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium focus:outline-none">
                    Admin
                    <svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div class="absolute right-0 top-12 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 hidden group-hover:block z-50">
                    ${adminItems.map(item => `
                        <a href="${item.url}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">${item.label}</a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    navHtml += `
                        </div>
                    </div>
                    <div class="flex items-center">
                        ${user ? `
                            <div class="flex-shrink-0">
                                <span class="text-sm text-gray-500 mr-4">
                                    ${user.displayName || user.email}
                                </span>
                                <button id="nav-logout-btn" class="text-sm font-medium text-red-600 hover:text-red-800">
                                    Sign out
                                </button>
                            </div>
                        ` : `
                            <div class="flex-shrink-0">
                                <a href="index.html" class="text-sm font-medium text-blue-600 hover:text-blue-500">Sign in</a>
                            </div>
                        `}
                        
                        <!-- Mobile menu button -->
                        <div class="-mr-2 flex items-center sm:hidden">
                            <button type="button" onclick="document.getElementById('mobile-menu').classList.toggle('hidden')" class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
                                <span class="sr-only">Open main menu</span>
                                <svg class="block h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile menu, show/hide based on menu state. -->
            <div class="hidden sm:hidden" id="mobile-menu">
                <div class="pt-2 pb-3 space-y-1">
                    ${menuItems.map(item => {
        let hasAccess = false;
        if (rbacConfig && rbacConfig[item.id]) {
            hasAccess = rbacConfig[item.id].includes(userRole);
        } else {
            hasAccess = item.roles.includes('all') || (user && (isAdmin || item.roles.includes(userRole)));
        }

        if (!hasAccess) return '';

        const isActive = window.location.href.includes(item.url) || (item.url === 'index.html' && window.location.pathname.endsWith('/'));
        const activeClass = isActive
            ? 'bg-blue-50 border-blue-500 text-blue-700'
            : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700';
        return `
                        <a href="${item.url}" class="${activeClass} block pl-3 pr-4 py-2 border-l-4 text-base font-medium">
                            ${item.label}
                        </a>
                        `;
    }).join('')}
                    
                    ${isAdmin ? `
                        <div class="border-t border-gray-200 pt-4 pb-3">
                            <div class="px-4 flex items-center">
                                <div class="text-base font-medium text-gray-800">Admin</div>
                            </div>
                            <div class="mt-3 space-y-1">
                                ${adminItems.map(item => `
                                    <a href="${item.url}" class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">${item.label}</a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </nav>
    `;

    container.innerHTML = navHtml;

    // Attach logout handler
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (window.firebaseServices && window.firebaseServices.signOut) {
                window.firebaseServices.signOut(window.firebaseServices.auth).then(() => {
                    window.location.href = 'index.html';
                });
            }
        });
    }
}

// Auto-initialize if the container exists immediately (though usually called from HTML)
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
});

// Initialize AI Overlay & Floating Dock
import aiOverlay from './modules/ai-overlay/ai-overlay.js';
import { FloatingDock } from './modules/ai-overlay/floating-dock.js';

// Init Dock immediately so it's available for QA Agent etc
FloatingDock.init();

// Small delay to ensure DOM is ready and nav is rendered for AI Overlay logic
setTimeout(() => {
    aiOverlay.init();
}, 1000);

