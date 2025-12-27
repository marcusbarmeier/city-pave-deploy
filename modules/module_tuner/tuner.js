/**
 * Module Fine Tuner - Development Agent Mode
 * Orchestrates the 7-Step Perfection Process.
 */

import { UXOverlay } from './ux_overlay.js';
import { globalPermissionGate } from '../subscription/tiers.js';
import aiOverlay from '../ai-overlay/ai-overlay.js';

class ModuleTuner {
    constructor() {
        this.ux = new UXOverlay();
        // Mock State - In real app, save to localStorage or DB
        this.modules = [
            { id: 'fleet', name: 'Fleet Manager', status: 'optimal', progress: 0 },
            { id: 'sketch', name: 'Sketch Estimator', status: 'active', progress: 2 },
            { id: 'employee', name: 'Employee Portal', status: 'idle', progress: 0 },
            { id: 'safety', name: 'Safety Compliance', status: 'warning', progress: 5 }
        ];

        this.steps = [
            { id: 1, title: 'Purpose', desc: 'Define goals & bleeding-edge functionality' },
            { id: 2, title: 'Dreamer Design', desc: 'Brainstorm AI overlays, geo-fencing, & gate logic' },
            { id: 3, title: 'Implementation', desc: 'Build solutions & upgrades' },
            { id: 4, title: 'Data Bridge', desc: 'Design Synapse data hooks' },
            { id: 5, title: 'User Admin', desc: 'Governance controls & portal' },
            { id: 6, title: 'Dev Admin', desc: 'Deployment hierarchical logic' },
            { id: 7, title: 'Test', desc: 'Verify inputs & logic' }
        ];

        this.selectedModuleId = null;
    }

    async init() {
        console.log("[Dev Agent] Initializing...");
        this.ux.init();

        this.renderModuleList();
        this.bindEvents();

        // Initialize Tier Selector
        const selector = document.getElementById('tier-selector');
        if (selector) {
            selector.value = globalPermissionGate.currentTier;
            selector.addEventListener('change', (e) => {
                globalPermissionGate.setTier(e.target.value);
                // Visual feedback
                this.ux.showToast ? this.ux.showToast(`Switched to ${e.target.value}`) : alert(`Switched to ${e.target.value}`);
            });
        }

        // Initialize AI Overlay for Validation
        this.ux.showToast ? this.ux.showToast("Initializing AI Overlay...") : console.log("Initializing AI...");
        try {
            aiOverlay.init();
        } catch (err) {
            console.error("Failed to init AI Overlay in Tuner:", err);
        }

        this.ux.playIntroAnimation();
    }

    renderModuleList() {
        const listEl = document.getElementById('module-list');
        if (!listEl) return;

        listEl.innerHTML = this.modules.map(mod => `
            <div class="nav-item ${this.selectedModuleId === mod.id ? 'active' : ''}" data-id="${mod.id}">
                <span class="pulse-orb" style="background:${this.getStatusColor(mod.status)}; width:8px; height:8px;"></span>
                <span>${mod.name}</span>
                <span style="font-size:0.7rem; opacity:0.5; margin-left:auto;">Step ${mod.progress}/7</span>
            </div>
        `).join('');

        // Re-bind clicks
        listEl.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', () => {
                this.selectModule(el.dataset.id);
            });
        });
    }

    selectModule(id) {
        this.selectedModuleId = id;
        const module = this.modules.find(m => m.id === id);

        // Update Header
        document.getElementById('selected-module-name').innerText = module.name;
        document.getElementById('current-stage-name').innerText =
            module.progress < 7 ? `Step ${module.progress + 1}: ${this.steps[module.progress].title}` : 'Complete';

        document.getElementById('module-context-header').style.display = 'block';
        document.getElementById('empty-state').style.display = 'none';

        // Enable buttons
        document.getElementById('action-btn').disabled = false;
        document.getElementById('brainstorm-btn').disabled = false;
        document.getElementById('action-btn').innerText = `WORK ON ${this.steps[Math.min(module.progress, 6)].title.toUpperCase()}`;

        this.renderSteps(module);
        this.renderModuleList(); // Update active state
    }

    renderSteps(module) {
        const container = document.getElementById('step-tracker');
        container.style.display = 'flex';

        container.innerHTML = this.steps.map((step, index) => {
            const isCompleted = index < module.progress;
            const isActive = index === module.progress;

            return `
                <div class="step-card ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" onclick="window.tuner.handleStepClick(${index})">
                    <div class="step-icon">
                        ${isCompleted ? '✓' : step.id}
                    </div>
                    <div class="step-content">
                        <div class="step-title">${step.title}</div>
                        <div class="step-desc">${step.desc}</div>
                    </div>
                    ${isActive ? '<div class="pulse-orb" style="margin:0;"></div>' : ''}
                </div>
            `;
        }).join('');
    }

    getStatusColor(status) {
        switch (status) {
            case 'optimal': return '#00f2fe';
            case 'active': return '#4facfe';
            case 'warning': return '#f83a3a';
            default: return '#94a3b8';
        }
    }

    bindEvents() {
        document.getElementById('action-btn').addEventListener('click', () => {
            alert("Agent would now start generating code/docs for this step.");
        });

        document.getElementById('brainstorm-btn').addEventListener('click', () => {
            alert("Agent would now open Dreamer Mode to brainstorm ideas.");
        });
    }

    // Exposed for inline onclicks
    handleStepClick(index) {
        const module = this.modules.find(m => m.id === this.selectedModuleId);
        if (module && index <= module.progress) {
            console.log(`Reviewing step ${index + 1}`);
        }
    }
}

const tuner = new ModuleTuner();
// Expose for global onclicks
window.tuner = tuner;
document.addEventListener('DOMContentLoaded', () => tuner.init());

export default tuner;
