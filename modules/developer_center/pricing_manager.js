/**
 * Pricing Manager (Dev Center)
 * Allows Admins to manage the Global Pricing Library used by the Estimator Module.
 * Demonstrates Data Bridge: Dev Admin (Write) -> Firestore -> Estimator (Read)
 */

import { db } from './firebase-client.js';
import { collection, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { Modal, Button, Input } from '../../ui-components.js';

export class PricingManager {
    constructor(app) {
        this.app = app;
        this.items = [];
    }

    async init() {
        console.log("[Pricing Manager] Initializing...");
        await this.fetchLibrary();
        this.render();
    }

    async fetchLibrary() {
        try {
            const snapshot = await getDocs(collection(db, 'pricing_library'));
            this.items = [];
            snapshot.forEach(docSnap => {
                if (docSnap.id !== 'global_settings') {
                    this.items.push({ id: docSnap.id, ...docSnap.data() });
                }
            });
            this.items.sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            console.error("Error fetching pricing library:", e);
        }
    }

    render() {
        const platformView = document.getElementById('ws-platform');
        if (!platformView) return;

        // Container Check
        let section = document.getElementById('pricing-manager-section');
        if (!section) {
            section = document.createElement('div');
            section.id = 'pricing-manager-section';
            section.style.marginTop = '3rem';
            section.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3>Global Pricing Library (Estimator Bridge)</h3>
                    <button class="btn-sm" id="btn-add-price-item">+ Add Item</button>
                </div>
                <div class="glass-panel" style="background:var(--bg-panel); border:1px solid var(--border-color); border-radius:8px;">
                    <table style="width:100%; text-align:left; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-size:0.8rem;">
                                <th style="padding:12px;">Item Name</th>
                                <th style="padding:12px;">Type</th>
                                <th style="padding:12px; text-align:right;">Default Price</th>
                                <th style="padding:12px; text-align:center;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="pricing-list-body"></tbody>
                    </table>
                </div>
            `;
            platformView.appendChild(section);

            document.getElementById('btn-add-price-item').addEventListener('click', () => this.openAddModal());
        }

        const tbody = document.getElementById('pricing-list-body');
        if (tbody) {
            if (this.items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="padding:2rem; text-align:center; opacity:0.5;">No items in library. Add one to start.</td></tr>`;
            } else {
                tbody.innerHTML = this.items.map(item => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:12px; font-weight:600;">${item.name}</td>
                        <td style="padding:12px; font-size:0.8rem; opacity:0.8;">${item.type || 'Standard'}</td>
                        <td style="padding:12px; text-align:right; font-family:monospace;">$${parseFloat(item.defaultPrice || 0).toFixed(2)}</td>
                        <td style="padding:12px; text-align:center;">
                            <button class="btn-icon delete-price-btn" data-id="${item.id}" style="color:var(--danger); cursor:pointer;">&times;</button>
                        </td>
                    </tr>
                `).join('');

                // Re-bind delete buttons
                tbody.querySelectorAll('.delete-price-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.openDeleteModal(e.target.dataset.id));
                });
            }
        }
    }

    openAddModal() {
        const content = document.createElement('div');
        content.className = "space-y-4";

        content.appendChild(Input({ id: 'new-price-name', label: 'Item Name', placeholder: 'e.g. Asphalt Premium' }));
        content.appendChild(Input({ id: 'new-price-value', label: 'Default Price', type: 'number', placeholder: '0.00' }));

        const saveBtn = Button({
            text: 'Save Item',
            onClick: () => {
                const name = document.getElementById('new-price-name').value;
                const price = document.getElementById('new-price-value').value;
                if (name && price) {
                    this.addItem(name, price);
                    modal.close();
                } else {
                    alert("Please fill in all fields");
                }
            }
        });

        const modal = Modal({
            id: 'add-price-modal',
            title: 'Add Pricing Item',
            content: content,
            actions: [saveBtn]
        });
    }

    async addItem(name, price) {
        const id = 'item_' + Date.now();
        const newItem = {
            name,
            defaultPrice: parseFloat(price),
            type: 'material',
            description: 'Created via Dev Center'
        };

        try {
            await setDoc(doc(db, 'pricing_library', id), newItem);
            this.items.push({ id, ...newItem });
            this.render();
        } catch (e) {
            console.error("Error adding item:", e);
        }
    }

    openDeleteModal(id) {
        const item = this.items.find(i => i.id === id);
        const modal = Modal({
            id: 'delete-price-modal',
            title: 'Delete Item',
            content: `<p class="text-slate-600 dark:text-slate-300">Are you sure you want to delete <strong>${item ? item.name : 'this item'}</strong>?</p>`,
            actions: [
                Button({
                    text: 'Delete',
                    variant: 'danger',
                    onClick: () => {
                        this.deleteItem(id);
                        modal.close();
                    }
                })
            ]
        });
    }

    async deleteItem(id) {
        try {
            await deleteDoc(doc(db, 'pricing_library', id));
            this.items = this.items.filter(i => i.id !== id);
            this.render();
        } catch (e) {
            console.error("Error deleting item:", e);
            alert("Failed to delete item.");
        }
    }
}
