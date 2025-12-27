/**
 * Global Estimates Feed (Dev Center)
 * Allows Admins to view ALL data flowing from the Estimator Module.
 * Demonstrates Data Bridge: Estimator (Write) -> Firestore -> Dev Admin (Read)
 */

import { db } from './firebase-client.js';
import { collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

export class EstimateFeed {
    constructor(app) {
        this.app = app;
        this.unsub = null;
    }

    init() {
        console.log("[Estimate Feed] Initializing...");
        this.render();
        this.listen();
    }

    listen() {
        // Stream the last 20 estimates from the entire system
        const q = query(collection(db, 'estimates'), orderBy('lastSaved', 'desc'), limit(20));

        this.unsub = onSnapshot(q, (snapshot) => {
            const estimates = [];
            snapshot.forEach(doc => estimates.push({ id: doc.id, ...doc.data() }));
            this.updateTable(estimates);
        });
    }

    render() {
        const platformView = document.getElementById('ws-platform');
        if (!platformView) return;

        let section = document.getElementById('global-estimates-section');
        if (!section) {
            section = document.createElement('div');
            section.id = 'global-estimates-section';
            section.style.marginTop = '3rem';
            section.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3>Global Data Stream: Estimates</h3>
                    <span class="badge" style="background:#3b82f6; color:white;">Live Feed</span>
                </div>
                <div class="glass-panel" style="background:var(--bg-panel); border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
                    <table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color); color:var(--text-secondary);">
                                <th style="padding:10px;">ID / Customer</th>
                                <th style="padding:10px;">Value</th>
                                <th style="padding:10px;">Status</th>
                                <th style="padding:10px;">Last Active</th>
                            </tr>
                        </thead>
                        <tbody id="global-estimates-body">
                            <tr><td colspan="4" style="padding:20px; text-align:center;">Connecting to Data Bridge...</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
            platformView.appendChild(section);
        }
    }

    updateTable(estimates) {
        const tbody = document.getElementById('global-estimates-body');
        if (!tbody) return;

        if (estimates.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding:2rem; text-align:center; opacity:0.5;">No data flowing yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = estimates.map(est => {
            const customerName = est.customerInfo?.name || 'Unknown Client';
            const total = est.financials ? est.financials.grandTotal : 0;
            const date = est.lastSaved ? new Date(est.lastSaved).toLocaleString() : 'N/A';
            const statusColor = this.getStatusColor(est.status);

            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:10px;">
                        <div style="font-weight:600;">${customerName}</div>
                        <div style="font-size:0.7rem; opacity:0.6; font-family:monospace;">${est.id}</div>
                    </td>
                    <td style="padding:10px;">$${parseFloat(total).toLocaleString()}</td>
                    <td style="padding:10px;">
                        <span style="background:${statusColor}20; color:${statusColor}; padding:2px 6px; border-radius:4px; font-size:0.7rem; text-transform:uppercase;">
                            ${est.status || 'DRAFT'}
                        </span>
                    </td>
                    <td style="padding:10px; opacity:0.7;">${date}</td>
                </tr>
            `;
        }).join('');
    }

    getStatusColor(status) {
        switch (status) {
            case 'Accepted': return '#10b981'; // Green
            case 'Sent': return '#3b82f6'; // Blue
            case 'Draft': return '#9ca3af'; // Gray
            case 'Declined': return '#ef4444'; // Red
            default: return '#f59e0b'; // Orange
        }
    }
}
