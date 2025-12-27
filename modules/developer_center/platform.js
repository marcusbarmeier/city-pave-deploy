/**
 * Platform Manager
 * Handles API Keys, Webhooks, Mobile Config, and Global Maintenance.
 * Co-exists with TeamManager in the 'ws-platform' workspace.
 */

export class PlatformManager {
    constructor(app) {
        this.app = app;
        this.state = {
            maintenanceMode: false,
            sandboxMode: false,
            apiKeys: [
                { id: 'pk_live_...', name: 'iOS App Prod', created: '2025-01-15' },
                { id: 'pk_test_...', name: 'Test Runner', created: '2025-02-20' }
            ],
            webhooks: [
                { url: 'https://hooks.slack.com/...', event: 'deployment.failed', status: 'active' }
            ]
        };
    }

    init() {
        this.render();
    }

    render() {
        const platformView = document.getElementById('ws-platform');
        if (!platformView) return;

        // Clear existing message but KEEP the team-section if it exists (or rely on TeamManager to re-render)
        // Best approach: Create a container for "System Settings" if not exists

        let container = document.getElementById('platform-settings-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'platform-settings-container';
            container.style.marginTop = '2rem';
            // Insert before team section if exists, or append
            platformView.appendChild(container);
        }

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; margin-bottom:2rem;">
                
                <!-- API & Security -->
                <div class="glass-panel" style="background:var(--bg-panel); border:1px solid var(--border-color); border-radius:8px; padding:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="margin:0; font-size:1rem;">API Keys</h3>
                        <button class="btn-sm" style="background:rgba(255,255,255,0.1);">+ Generate</button>
                    </div>
                    ${this.state.apiKeys.map(k => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.8rem;">
                            <div>
                                <div style="font-family:var(--font-mono); color:var(--accent-color);">${k.id}</div>
                                <div style="color:var(--text-secondary); font-size:0.7rem;">${k.name}</div>
                            </div>
                            <button class="btn-toggle" style="color:var(--danger); font-size:0.7rem;">Revoke</button>
                        </div>
                    `).join('')}
                </div>

                <!-- Webhooks & Integrations -->
                <div class="glass-panel" style="background:var(--bg-panel); border:1px solid var(--border-color); border-radius:8px; padding:1.5rem;">
                     <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="margin:0; font-size:1rem;">Webhooks</h3>
                        <button class="btn-sm" style="background:rgba(255,255,255,0.1);">+ Add Endpoint</button>
                    </div>
                     ${this.state.webhooks.map(w => `
                        <div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.8rem;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                <span style="font-weight:600;">${w.event}</span>
                                <span class="status-indicator" style="background:rgba(16,185,129,0.2); color:var(--success); padding:2px 6px; border-radius:4px;">${w.status}</span>
                            </div>
                            <div style="font-family:var(--font-mono); color:var(--text-secondary); font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${w.url}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Global Controls -->
            <div class="glass-panel" style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:1.5rem; margin-bottom:2rem;">
                 <h3 style="margin:0 0 1rem 0; font-size:1rem; color:var(--danger);">Danger Zone</h3>
                 
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div>
                        <strong style="display:block; font-size:0.9rem;">Maintenance Mode</strong>
                        <span style="font-size:0.8rem; color:var(--text-secondary);">Disconnect all users and show "Under Maintenance" screen.</span>
                    </div>
                    <label class="toggle-switch" style="position:relative; display:inline-block; width:44px; height:24px;">
                        <input type="checkbox" id="maintenance-toggle" ${this.state.maintenanceMode ? 'checked' : ''}>
                        <span class="slider" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#333; transition:.4s; border-radius:34px;"></span>
                        <span class="knob" style="position:absolute; content:''; height:18px; width:18px; left:3px; bottom:3px; background-color:white; transition:.4s; border-radius:50%;"></span>
                    </label>
                 </div>

                 <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="display:block; font-size:0.9rem;">Sandbox Mode</strong>
                        <span style="font-size:0.8rem; color:var(--text-secondary);">Force all API calls to use Test Data.</span>
                    </div>
                     <label class="toggle-switch" style="position:relative; display:inline-block; width:44px; height:24px;">
                        <input type="checkbox" id="sandbox-toggle" ${this.state.sandboxMode ? 'checked' : ''}>
                        <span class="slider" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#333; transition:.4s; border-radius:34px;"></span>
                        <span class="knob" style="position:absolute; content:''; height:18px; width:18px; left:3px; bottom:3px; background-color:white; transition:.4s; border-radius:50%;"></span>
                    </label>
                 </div>
            </div>
            
            <style>
                #maintenance-toggle:checked + .slider { background-color: var(--danger); }
                #maintenance-toggle:checked + .slider .knob { transform: translateX(20px); }
                
                #sandbox-toggle:checked + .slider { background-color: var(--warning); }
                #sandbox-toggle:checked + .slider .knob { transform: translateX(20px); }
            </style>
        `;

        // Bind Events
        document.getElementById('maintenance-toggle').addEventListener('change', (e) => {
            this.state.maintenanceMode = e.target.checked;
            if (this.state.maintenanceMode) {
                alert("⚠️ ACTIVATING MAINTENANCE MODE\n\nAll non-admin users will be disconnected.");
            }
        });
    }
}
