/**
 * ContactDirectory.js
 * Manual Contact List for Level 1 (Basic) Users.
 * Provides a fallback when AI Smart Routing is not available.
 */

import { UI } from '../ai-overlay/ui.js';
import { VoiceManager } from '../ai-overlay/voice-manager.js';

export class ContactDirectory {
    constructor() {
        this.isVisible = false;
        this.contacts = [
            { id: 'dispatch', name: 'Dispatch / Main Office', role: 'Support', phone: '555-0101' },
            { id: 'fleet', name: 'Fleet Manager (Mike)', role: 'Mechanical', phone: '555-0102' },
            { id: 'safety', name: 'Safety Officer (Sarah)', role: 'Emergency', phone: '555-0103' },
            { id: 'foreman', name: 'Site Foreman', role: 'Access/Site', phone: '555-0104' }
        ];
    }

    toggle() {
        if (this.isVisible) this.close();
        else this.open();
    }

    open() {
        if (this.isVisible) return;

        // Create Modal Element
        this.modal = document.createElement('div');
        this.modal.id = 'contact-directory-modal';
        this.modal.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm';

        let listHtml = this.contacts.map(c => `
            <div class="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <div>
                    <div class="font-bold text-gray-800">${c.name}</div>
                    <div class="text-xs text-gray-500 uppercase">${c.role} • ${c.phone}</div>
                </div>
                <div class="flex space-x-2">
                    <button onclick="window.contactDirectory.call('${c.id}')" class="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200">
                        📞
                    </button>
                    <button onclick="window.contactDirectory.message('${c.id}')" class="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200">
                        💬
                    </button>
                </div>
            </div>
        `).join('');

        this.modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div class="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 flex justify-between items-center text-white">
                    <div class="font-bold text-lg">📒 Contact Directory</div>
                    <button onclick="window.contactDirectory.close()" class="text-white/80 hover:text-white">✕</button>
                </div>
                <div class="max-h-[60vh] overflow-y-auto">
                    ${listHtml}
                </div>
                <div class="p-3 bg-gray-50 text-center text-xs text-gray-400 border-t border-gray-100">
                    CityPave Communications • Basic Tier
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.isVisible = true;

        // Expose global handler for HTML onclicks
        window.contactDirectory = this;

        VoiceManager.speak("Directory opened.");
    }

    close() {
        if (!this.isVisible || !this.modal) return;
        this.modal.remove();
        this.isVisible = false;
        this.modal = null;
    }

    call(id) {
        const contact = this.contacts.find(c => c.id === id);
        if (contact) {
            console.log(`[Directory] Calling ${contact.name} (${contact.phone})...`);
            // In real app: window.location.href = `tel:${contact.phone}`;
            UI.showToast(`Calling ${contact.name}...`, '📞');
            VoiceManager.speak(`Calling ${contact.name}.`);
        }
    }

    message(id) {
        const contact = this.contacts.find(c => c.id === id);
        if (contact) {
            console.log(`[Directory] Messaging ${contact.name}...`);
            // Simulate opening SMS or Chat
            UI.showToast(`Message draft for ${contact.name}...`, '💬');
            VoiceManager.speak(`Drafting message to ${contact.name}.`);
        }
    }
}

export const contactDirectory = new ContactDirectory();
