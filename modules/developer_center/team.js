import { auth, db } from './firebase-client.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

/**
 * Team Manager (RBAC)
 * Handles creation of Developer Admins and their permissions.
 */

export class TeamManager {
    constructor(app) {
        this.app = app;
        this.currentUser = null;
        this.team = []; // Initialize empty array to prevent crash
        this.mockMode = false;
    }

    async init() {
        this.listenForAuthContext();
        this.bindEvents();
    }

    listenForAuthContext() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Auth State: Logged In", user.email);
                // Fetch Current User Role
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    this.currentUser = {
                        id: user.uid,
                        name: userData.name || user.email,
                        role: userData.role === 'super_admin' ? 'Super Admin' : 'Developer',
                        permissions: this.getPermissionsForRole(userData.role)
                    };
                } else {
                    this.currentUser = {
                        id: user.uid,
                        name: user.email,
                        role: 'Guest',
                        permissions: { view_financials: false, deploy_modules: false }
                    };
                }

                // Populate Team List (For now, just put current user + a placeholder)
                // TODO: Fetch all users where role == 'super_admin' or 'developer'
                this.team = [this.currentUser];

            } else {
                console.log("Auth State: Logged Out");
                this.currentUser = null;
                this.team = [];
                // Redirect to login if needed, or show login modal
                // For now, let's just alert
                // alert("You are not logged in.");
            }

            this.app.enforcePermissions();
            this.renderTeamList();
        });
    }

    getPermissionsForRole(role) {
        if (role === 'super_admin') {
            return { view_financials: true, deploy_modules: true, manage_team: true };
        }
        return { view_financials: false, deploy_modules: true, manage_team: false };
    }

    renderTeamList() {
        const platformView = document.getElementById('ws-platform');
        if (!platformView) return;

        // Container Check (Idempotent)
        let section = document.getElementById('team-section');
        if (!section) {
            section = document.createElement('div');
            section.id = 'team-section';
            section.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3>Admin Team (RBAC)</h3>
                    <button class="btn-sm" id="btn-add-admin">+ New Admin</button>
                </div>
                <div class="glass-panel" style="background:var(--bg-panel); border:1px solid var(--border-color); border-radius:8px;">
                    <table style="width:100%; text-align:left; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-size:0.8rem;">
                                <th style="padding:12px;">Name</th>
                                <th style="padding:12px;">Role</th>
                                <th style="padding:12px;">Financials</th>
                                <th style="padding:12px;">Deploy</th>
                                <th style="padding:12px;">Action</th>
                            </tr>
                        </thead>
                        <tbody id="team-list-body"></tbody>
                    </table>
                </div>
                
                <div style="margin-top:2rem; padding:1rem; border:1px dashed var(--border-color); border-radius:6px;">
                    <strong>Current Session:</strong> <span id="current-user-name">...</span>
                        <button class="btn-toggle" id="btn-switch-user" style="margin-left:1rem;">Simulate Switch User</button>
                </div>
            `;
            // Append to end of platform view (so it appears below Platform Settings)
            platformView.appendChild(section);
            this.bindEvents(); // Bind events only when creating the DOM
        }

        // Update User Info
        if (this.currentUser) {
            const nameEl = document.getElementById('current-user-name');
            if (nameEl) nameEl.innerText = `${this.currentUser.name} (${this.currentUser.role})`;
        }

        const tbody = document.getElementById('team-list-body');
        if (tbody) {
            tbody.innerHTML = this.team.map(user => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px; font-weight:600;">${user.name}</td>
                    <td><span class="badge" style="background:${user.role === 'Super Admin' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)'}; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${user.role}</span></td>
                    <td>${user.permissions.view_financials ? '✅' : '❌'}</td>
                    <td>${user.permissions.deploy_modules ? '✅' : '❌'}</td>
                    <td><button class="btn-toggle">Edit</button></td>
                </tr>
            `).join('');
        }
    }

    bindEvents() {
        // Simulate User Switching for Testing
        const switchBtn = document.getElementById('btn-switch-user');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                // Toggle between Super Admin and Hired Dev
                if (this.currentUser.role === 'Super Admin') {
                    this.currentUser = this.team[1];
                } else {
                    this.currentUser = this.team[0];
                }
                alert(`Switched to: ${this.currentUser.name}`);
                this.app.enforcePermissions(); // Trigger UI update
                this.renderTeamList();
            });
        }
    }
}
