// © 2025 City Pave. All Rights Reserved.
// Filename: maintenance.js

import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

export function initializeMaintenanceModule() {
    const tab = document.getElementById('tab-maintenance');
    const view = document.getElementById('view-maintenance');

    if (tab && view) {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
            tab.classList.add('active');
            view.classList.remove('hidden');
            loadMaintenanceTickets();
        });
    }

    // Add "New Ticket" button if not exists
    const container = view.querySelector('.p-4'); // Header container
    if (container && !document.getElementById('create-ticket-btn')) {
        const btn = document.createElement('button');
        btn.id = 'create-ticket-btn';
        btn.className = 'bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-md hover:bg-red-700 shadow-sm transition-all';
        btn.textContent = '+ New Repair Ticket';
        btn.onclick = openCreateTicketModal;
        container.appendChild(btn);
    }
}

async function loadMaintenanceTickets() {
    const { db } = window.firebaseServices;
    const tbody = document.getElementById('maintenance-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center">Loading tickets...</td></tr>';

    try {
        const q = query(collection(db, "maintenance_tickets"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-gray-500">No active tickets.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const ticket = docSnap.data();
            const statusColors = {
                'Open': 'bg-red-100 text-red-800',
                'In Progress': 'bg-yellow-100 text-yellow-800',
                'Resolved': 'bg-green-100 text-green-800'
            };

            const row = `
                <tr class="bg-white border-b hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-500">${new Date(ticket.createdAt).toLocaleDateString()}</td>
                    <td class="px-6 py-4 font-bold text-gray-900">${ticket.assetId}</td>
                    <td class="px-6 py-4 text-gray-600">${ticket.issue}</td>
                    <td class="px-6 py-4 text-sm">${ticket.reportedBy || 'Unknown'}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded-full text-xs font-bold ${statusColors[ticket.status] || 'bg-gray-100'}">${ticket.status}</span>
                        ${ticket.attachments && ticket.attachments.length > 0 ?
                    `<div class="mt-1 text-xs text-blue-600 font-medium cursor-pointer" onclick="alert('View Attachments: ' + '${ticket.attachments.length}')">📎 ${ticket.attachments.length} Files</div>`
                    : ''}
                    </td>
                    <td class="px-6 py-4 text-right">
                        ${ticket.status !== 'Resolved' ?
                    `<button onclick="resolveTicket('${docSnap.id}', '${ticket.assetId}')" class="text-green-600 hover:underline text-xs font-bold mr-2">Resolve</button>` :
                    ''
                }
                    ${ticket.status === 'Pending Review' ?
                    `<button onclick="reviewTicket('${docSnap.id}')" class="text-blue-600 hover:underline text-xs font-bold mr-2">Review Request</button>` : ''
                }
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error("Error loading tickets:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
}

async function openCreateTicketModal() {
    // Simple prompt for now, can be a modal later
    const assetId = prompt("Enter Asset ID (e.g., T-101):");
    if (!assetId) return;

    const issue = prompt("Describe the issue:");
    if (!issue) return;

    await createTicket(assetId, issue);
}

export async function createTicket(assetId, issue) {
    const { db } = window.firebaseServices;
    const user = window.currentUser || { email: 'Anonymous' };

    try {
        // 1. Create Ticket
        await addDoc(collection(db, "maintenance_tickets"), {
            assetId,
            issue,
            reportedBy: user.email,
            status: 'Open',
            createdAt: new Date().toISOString()
        });

        // 2. Update Asset Status (The Bridge)
        // We need to find the asset doc by unitId field, or assume assetId is the doc ID?
        // The prompt asked for "Unit ID" which is a field, not necessarily the doc ID.
        // Let's query for it.
        const assetQ = query(collection(db, "assets"), where("unitId", "==", assetId));
        const assetSnap = await getDocs(assetQ);

        if (!assetSnap.empty) {
            const assetDoc = assetSnap.docs[0];
            await updateDoc(doc(db, "assets", assetDoc.id), {
                status: 'Down'
            });
        }

        alert("Ticket created & Asset marked as DOWN.");
        loadMaintenanceTickets();

    } catch (error) {
        alert("Error creating ticket: " + error.message);
    }
}

window.resolveTicket = async function (ticketId, assetUnitId) {
    if (!confirm("Mark this ticket as Resolved and Asset as Operational?")) return;

    const { db } = window.firebaseServices;
    try {
        // 1. Update Ticket
        await updateDoc(doc(db, "maintenance_tickets", ticketId), {
            status: 'Resolved',
            resolvedAt: new Date().toISOString()
        });

        // 2. Update Asset Status
        const assetQ = query(collection(db, "assets"), where("unitId", "==", assetUnitId));
        const assetSnap = await getDocs(assetQ);

        if (!assetSnap.empty) {
            const assetDoc = assetSnap.docs[0];
            await updateDoc(doc(db, "assets", assetDoc.id), {
                status: 'Operational'
            });
        }

        loadMaintenanceTickets();

    } catch (error) {
        alert("Error: " + error.message);
    }
};

window.reviewTicket = async function (ticketId) {
    const { db } = window.firebaseServices;
    // Simple review: Clerk/Mechanic accepts it -> 'Open'
    if (confirm("Accept this request and add to Open Work Orders?")) {
        try {
            await updateDoc(doc(db, "maintenance_tickets", ticketId), {
                status: 'Open',
                reviewedBy: window.currentUser?.email || 'System',
                reviewedAt: new Date().toISOString()
            });
            loadMaintenanceTickets();
        } catch (e) {
            alert("Error: " + e.message);
        }
    }
};


/**
 * Check if asset usage has crossed a maintenance threshold.
 * @param {object} asset - The asset document data (must include unitId, serviceIntervalHours, etc.)
 * @param {string} assetDocId - The Firestore Doc ID of the asset
 * @param {number} newHours - The updated total hours
 * @param {number} newMiles - The updated total miles
 */
export async function checkMaintenanceTriggers(asset, assetDocId, newHours, newMiles) {
    const { db, addDoc, collection } = window.firebaseServices;

    // Check Hours
    if (asset.serviceIntervalHours && newHours > 0) {
        const interval = asset.serviceIntervalHours;
        const lastService = asset.lastServiceHours || 0;

        // If we have crossed a multiple of the interval since the last service
        // Example: Interval 500. Last Service 0. New Hours 501.
        // Next Due: 500. 501 >= 500. Trigger!

        const nextDue = lastService + interval;

        if (newHours >= nextDue) {
            console.log(`Triggering Maintenance for ${asset.unitId} (Hours: ${newHours})`);

            // Create Ticket
            await addDoc(collection(db, "maintenance_tickets"), {
                assetId: asset.unitId,
                issue: `ROUTINE MAINTENANCE: ${interval} Hour Service Due (${newHours} hrs)`,
                reportedBy: "System (Smart Trigger)",
                status: 'Open',
                createdAt: new Date().toISOString(),
                isRoutine: true
            });

            // Update Asset "Down" status? Maybe just warn for routine.
            // Let's mark as "Needs Service" but not necessarily "Down" unless critical.
            // For now, we just create the ticket.
        }
    }

    // Check Miles (Same logic)
    if (asset.serviceIntervalMiles && newMiles > 0) {
        const interval = asset.serviceIntervalMiles;
        const lastService = asset.lastServiceMiles || 0;
        const nextDue = lastService + interval;

        if (newMiles >= nextDue) {
            await addDoc(collection(db, "maintenance_tickets"), {
                assetId: asset.unitId,
                issue: `ROUTINE MAINTENANCE: ${interval} km Service Due (${newMiles} km)`,
                reportedBy: "System (Smart Trigger)",
                status: 'Open',
                createdAt: new Date().toISOString(),
                isRoutine: true
            });
        }
    }
}
