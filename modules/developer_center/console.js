/**
 * Developer Command Center "The Brain"
 * Main Controller
 */

import { Subscribers } from './subscribers.js';
import { Actions } from './actions.js';
import { SmartMonitor } from './monitor.js';
import { TeamManager } from './team.js'; // NEW
import { PlatformManager } from './platform.js'; // NEW
import { PricingManager } from './pricing_manager.js'; // NEW
import { EstimateFeed } from './estimate_feed.js'; // NEW
import { TimeSheetFeed } from './timesheet_feed.js'; // NEW
import { SafetyFeed } from './safety_feed.js'; // NEW

class DeveloperConsole {
    constructor() {
        this.subscribers = new Subscribers(this);
        this.actions = new Actions(this);
        this.monitor = new SmartMonitor();
        this.team = new TeamManager(this); // NEW
        this.platform = new PlatformManager(this); // NEW
        this.pricing = new PricingManager(this); // NEW
        this.feed = new EstimateFeed(this); // NEW
        this.timeSheet = new TimeSheetFeed(this); // NEW
        this.safety = new SafetyFeed(this); // NEW
        this.activeContext = 'dashboard';
    }

    init() {
        console.log("[The Brain] Initializing...");

        // 1. Setup Rail Navigation
        this.bindRail();

        // 2. Initialize Sub-Modules
        this.subscribers.init();
        this.monitor.init();
        this.team.init(); // NEW
        this.platform.init(); // NEW
        this.pricing.init(); // NEW
        this.feed.init(); // NEW
        this.timeSheet.init(); // NEW
        this.safety.init(); // NEW

        // 3. Set Default State & Permissions
        this.enforcePermissions();
        this.switchContext('dashboard');

        console.log("[The Brain] Ready.");
    }

    enforcePermissions() {
        const user = this.team.currentUser;
        if (!user) return; // Wait for Auth

        // Hide/Show "Business" Rail Button based on view_financials
        const businessBtn = document.querySelector('.rail-btn[data-context="business"]');
        if (businessBtn) {
            if (user.permissions.view_financials) {
                businessBtn.style.display = 'flex';
            } else {
                businessBtn.style.display = 'none';
                // If currently on business view, switch away
                if (this.activeContext === 'business') this.switchContext('dashboard');
            }
        }
    }

    bindRail() {
        const btns = document.querySelectorAll('.rail-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.context; // CurrentTarget to get button, not span
                this.switchContext(target);
            });
        });
    }

    switchContext(contextId) {
        // Update Rail UI
        document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.rail-btn[data-context="${contextId}"]`);
        if (btn) btn.classList.add('active');

        // Update Workspace Visibility
        document.querySelectorAll('.workspace').forEach(ws => ws.classList.remove('active'));
        const ws = document.getElementById(`ws-${contextId}`);
        if (ws) ws.classList.add('active');

        // Update Header
        const titleMap = {
            'dashboard': 'System Overview',
            'tenants': 'Tenant Management',
            'ops': 'Operations & Smart Monitor',
            'platform': 'Platform Settings',
            'business': 'Business Analytics',
            'legal': 'Legal & Compliance'
        };
        document.getElementById('context-title').innerText = titleMap[contextId] || 'Command Center';

        this.activeContext = contextId;
    }

    // --- Inter-Module Communication ---

    onSubscriberSelected(subscriber) {
        this.actions.reset();
        this.subscribers.renderModules(subscriber);
    }

    onModuleSelected(module, subscriber) {
        this.actions.renderConfiguration(module, subscriber);
    }
}

// Bootstrap
window.brain = new DeveloperConsole();
document.addEventListener('DOMContentLoaded', () => window.brain.init());
