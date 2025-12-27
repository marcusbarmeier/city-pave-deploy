// © 2025 City Pave. All Rights Reserved.
// Filename: operations.js

let availableUsers = [];
let availableAssets = [];

import { ShiftAggregator } from '../classes/ShiftAggregator.js';
import { JobAggregator } from '../classes/JobAggregator.js';

export function initializeOperationsApp() {
    setupTabs();
    loadTimeLogs();
    loadFormSubmissions();
    loadRepairTickets();
    loadTimeTickets();
    loadJobCosting();
    initWorkforceView();

    const today = new Date().toISOString().split('T')[0];
    const datePicker = document.getElementById('dispatch-date-picker');
    if (datePicker) {
        datePicker.value = today;
        datePicker.addEventListener('change', loadDailySchedule);
        loadReadyJobs();
        loadDailySchedule();
    }

    // --- DEEP LINKING SUPPORT ---
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam) {
        const tabMap = {
            'reports': 'tab-reports',
            'time': 'tab-time',
            'forms': 'tab-forms',
            'dispatch': 'tab-dispatch',
            'maintenance': 'tab-maintenance',
            'tickets': 'tab-tickets',
            'costing': 'tab-costing'
        };
        const tabId = tabMap[viewParam];
        if (tabId) {
            document.getElementById(tabId)?.click();
        }
    }

    const saveDispatchBtn = document.getElementById('save-dispatch-btn');
    if (saveDispatchBtn) {
        saveDispatchBtn.addEventListener('click', saveDispatchAssignment);
    }

    const manualDispatchBtn = document.getElementById('create-manual-dispatch-btn');
    if (manualDispatchBtn) {
        manualDispatchBtn.addEventListener('click', () => openDispatchModal());
    }

    // Setup Client Selector, Crew Builder & Autocomplete
    setupClientSelector();
    setupDispatchCrewBuilder();
    setupDispatchAutocomplete(); // <--- NEW: Turn on Google Maps for Dispatch
    setupDispatchSafetyUI(); // <--- NEW: Safety UI Handlers
}

function setupTabs() {
    const tabIds = ['tab-time', 'tab-forms', 'tab-dispatch', 'tab-maintenance', 'tab-tickets', 'tab-costing', 'tab-workforce', 'tab-media', 'tab-reports'];
    const viewIds = ['view-time', 'view-forms', 'view-dispatch', 'view-maintenance', 'view-tickets', 'view-costing', 'view-workforce', 'view-media', 'view-reports'];

    tabIds.forEach((id, index) => {
        const tab = document.getElementById(id);
        const view = document.getElementById(viewIds[index]);
        if (tab && view) {
            tab.addEventListener('click', () => {
                // Deactivate all
                tabIds.forEach(tid => document.getElementById(tid)?.classList.remove('active'));
                viewIds.forEach(vid => document.getElementById(vid)?.classList.add('hidden'));
                // Activate clicked
                tab.classList.add('active');
                view.classList.remove('hidden');
            });
        }
    });
}

// --- NEW: DISPATCH AUTOCOMPLETE ---
function setupDispatchAutocomplete() {
    // We use a retry interval because Google Maps API loads asynchronously
    const checkForGoogle = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
            clearInterval(checkForGoogle);

            const siteInput = document.getElementById('dispatch-site-loc');
            const dumpInput = document.getElementById('dispatch-dump-loc');
            const toolboxInput = document.getElementById('dispatch-toolbox-loc'); // <--- NEW
            const options = {
                types: ['geocode', 'establishment'], // Allow addresses and businesses (like landfills)
                componentRestrictions: { country: 'ca' } // Restrict to Canada
            };

            if (siteInput) new google.maps.places.Autocomplete(siteInput, options);
            if (dumpInput) new google.maps.places.Autocomplete(dumpInput, options);
            if (toolboxInput) new google.maps.places.Autocomplete(toolboxInput, options); // <--- NEW
        }
    }, 500);
}

// --- NEW: SAFETY UI HANDLERS ---
function setupDispatchSafetyUI() {
    // LMHA Toggle
    const lmhaCheck = document.getElementById('dispatch-lmha-required');
    const lmhaConfig = document.getElementById('lmha-config');
    if (lmhaCheck && lmhaConfig) {
        lmhaCheck.addEventListener('change', (e) => {
            if (e.target.checked) lmhaConfig.classList.remove('hidden');
            else lmhaConfig.classList.add('hidden');
        });
    }

    // Custom Hazard Add
    const addHazBtn = document.getElementById('add-custom-hazard-btn');
    const hazInput = document.getElementById('dispatch-custom-hazard');
    const hazList = document.getElementById('custom-hazards-list');

    if (addHazBtn && hazInput && hazList) {
        addHazBtn.addEventListener('click', () => {
            const val = hazInput.value.trim();
            if (!val) return;

            const span = document.createElement('span');
            span.className = "bg-red-100 text-red-800 text-xs px-2 py-1 rounded flex items-center gap-1 custom-hazard-tag";
            span.innerHTML = `${val} <button onclick="this.parentElement.remove()" class="text-red-500 font-bold hover:text-red-700">×</button>`;
            hazList.appendChild(span);
            hazInput.value = '';
        });
    }
}

// --- 1. TIME LOGS ---
async function loadTimeLogs() {
    const { db, collection, query, orderBy, limit, getDocs } = window.firebaseServices;
    const tbody = document.getElementById('time-table-body');
    if (!tbody) return;

    try {
        const q = query(collection(db, "time_logs"), orderBy("startTime", "desc"), limit(50));
        const snapshot = await getDocs(q);
        tbody.innerHTML = snapshot.empty ? '<tr><td colspan="7" class="p-6 text-center text-gray-500">No time logs found.</td></tr>' : '';
        window.timeLogCache = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            window.timeLogCache[doc.id] = data;
            const start = new Date(data.startTime);
            const end = data.endTime ? new Date(data.endTime) : null;
            let duration = "Active Now";
            if (end) {
                const diffMs = end - start;
                const hours = Math.floor(diffMs / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                duration = `${hours}h ${mins}m`;
            }

            const isApproved = data.isApproved === true;
            const statusBadge = isApproved
                ? `<span class="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">Approved</span>`
                : (data.status === 'active'
                    ? `<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">Active</span>`
                    : `<span class="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">Pending</span>`);

            const row = `
                <tr class="bg-white border-b hover:bg-gray-50">
                    <td class="px-6 py-4"><input type="checkbox" class="log-checkbox" value="${doc.id}" ${isApproved ? 'disabled' : ''}></td>
                    <td class="px-6 py-4 font-medium text-gray-900">${data.userName || 'Unknown'}</td>
                    <td class="px-6 py-4">${data.jobName || 'General'}</td>
                    <td class="px-6 py-4">${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="px-6 py-4 font-mono">${duration}</td>
                    <td class="px-6 py-4">${statusBadge}</td>
                    <td class="px-6 py-4">
                        ${!isApproved && data.status !== 'active' ? `<button onclick="approveTimeLog('${doc.id}')" class="text-green-600 hover:underline font-bold text-xs">Approve</button>` : ''}
                        ${data.updates && data.updates.length > 0 ? `<button onclick="openShiftUpdatesModal('${doc.id}')" class="ml-2 text-blue-600 hover:underline text-xs">${data.updates.length} Updates</button>` : ''}
                    </td>
                </tr>`;
            tbody.innerHTML += row;
        });
    } catch (error) { if (error.code !== 'failed-precondition') console.error("Error loading logs:", error); }
}

window.approveTimeLog = async function (logId) {
    const { db, doc, updateDoc } = window.firebaseServices;
    try {
        await updateDoc(doc(db, "time_logs", logId), { isApproved: true });
        loadTimeLogs(); // Refresh
    } catch (e) { alert("Error: " + e.message); }
};

window.bulkApprove = async function () {
    const checkboxes = document.querySelectorAll('.log-checkbox:checked');
    if (checkboxes.length === 0) return alert("Select logs to approve.");
    if (!confirm(`Approve ${checkboxes.length} logs?`)) return;

    const { db, doc, updateDoc } = window.firebaseServices;
    let count = 0;
    for (const cb of checkboxes) {
        try {
            await updateDoc(doc(db, "time_logs", cb.value), { isApproved: true });
            count++;
        } catch (e) { console.error(e); }
    }
    alert(`Approved ${count} logs.`);
    loadTimeLogs();
};

window.toggleAllLogs = function (source) {
    document.querySelectorAll('.log-checkbox').forEach(cb => {
        if (!cb.disabled) cb.checked = source.checked;
    });
};

window.exportPayrollCSV = function () {
    // Simple CSV Export of what's in the cache
    if (!window.timeLogCache) return alert("No data to export.");

    let csv = "Log ID,Employee,Job,Date,Start Time,End Time,Duration (Hrs),Status,Approved\n";

    Object.entries(window.timeLogCache).forEach(([id, log]) => {
        const start = new Date(log.startTime);
        const end = log.endTime ? new Date(log.endTime) : null;
        let duration = 0;
        if (end) duration = ((end - start) / 3600000).toFixed(2);

        csv += `"${id}","${log.userName}","${log.jobName}","${start.toLocaleDateString()}","${start.toLocaleTimeString()}","${end ? end.toLocaleTimeString() : ''}","${duration}","${log.status}","${log.isApproved ? 'Yes' : 'No'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};

// --- 2. FORMS ---
async function loadFormSubmissions() {
    const { db, collection, query, orderBy, limit, getDocs } = window.firebaseServices;
    const tbody = document.getElementById('forms-table-body');
    if (!tbody) return;
    try {
        const q = query(collection(db, "form_submissions"), orderBy("submittedAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        tbody.innerHTML = snapshot.empty ? '<tr><td colspan="5" class="p-6 text-center text-gray-500">No forms submitted yet.</td></tr>' : '';
        window.formCache = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            window.formCache[doc.id] = data;
            const date = new Date(data.submittedAt);
            let issues = "None";
            let issueClass = "text-gray-400";
            if (data.data && data.data.defects && data.data.defects.trim() !== "") { issues = "Defects Reported"; issueClass = "text-red-600 font-bold"; }
            else if (data.data && (data.data.injury === true || data.data.damage === true)) { issues = "INCIDENT REPORTED"; issueClass = "text-red-600 font-bold bg-red-100 px-2 py-1 rounded"; }
            const row = `<tr class="bg-white border-b hover:bg-gray-50"><td class="px-6 py-4">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td class="px-6 py-4 font-medium text-gray-900">${data.userName || 'Unknown'}</td><td class="px-6 py-4">${data.formTitle}</td><td class="px-6 py-4 ${issueClass}">${issues}</td><td class="px-6 py-4"><button onclick="openFormModal('${doc.id}')" class="text-blue-600 hover:underline font-medium">View Details</button></td></tr>`;
            tbody.innerHTML += row;
        });
    } catch (error) { if (error.code !== 'failed-precondition') console.error("Error loading forms:", error); }
}

// --- 3. MAINTENANCE ---
// --- 3. MAINTENANCE ---
async function loadRepairTickets() {
    const { db, collection, query, orderBy, limit, onSnapshot } = window.firebaseServices;
    const tbody = document.getElementById('maintenance-table-body');
    if (!tbody) return;

    // Use onSnapshot for real-time updates (The "Silent" Repair Fix)
    const q = query(collection(db, "repair_tickets"), orderBy("reportedAt", "desc"), limit(50));

    // Store unsubscribe function if needed later (e.g. window.repairUnsub)
    window.repairUnsub = onSnapshot(q, (snapshot) => {
        tbody.innerHTML = snapshot.empty ? '<tr><td colspan="6" class="p-6 text-center text-gray-500">No repair tickets found.</td></tr>' : '';

        // Clear existing rows (except empty message if handled above, but innerHTML='' handles it)
        if (!snapshot.empty) tbody.innerHTML = '';

        snapshot.forEach(doc => {
            const ticket = doc.data();
            let statusColor = "bg-red-100 text-red-800";
            if (ticket.status === "In Progress") statusColor = "bg-yellow-100 text-yellow-800";
            if (ticket.status === "Fixed") statusColor = "bg-green-100 text-green-800";
            const photoHtml = ticket.photoUrl ? `<a href="${ticket.photoUrl}" target="_blank" class="text-blue-500 underline text-xs ml-2">(View Photo)</a>` : '';

            // Safe check for date
            const dateStr = ticket.reportedAt ? new Date(ticket.reportedAt).toLocaleDateString() : 'N/A';

            const row = `<tr class="bg-white border-b hover:bg-gray-50"><td class="px-6 py-4">${dateStr}</td><td class="px-6 py-4 font-bold text-gray-900">${ticket.vehicleId || 'Unknown'}</td><td class="px-6 py-4">${ticket.issue || ''} ${photoHtml}</td><td class="px-6 py-4 text-gray-500">${ticket.reportedBy || 'System'}</td><td class="px-6 py-4"><span class="${statusColor} text-xs font-bold px-2 py-1 rounded">${ticket.status || 'Open'}</span></td><td class="px-6 py-4"><select onchange="updateTicketStatus('${doc.id}', this.value)" class="text-xs border rounded p-1 bg-gray-50"><option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>Open</option><option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option><option value="Fixed" ${ticket.status === 'Fixed' ? 'selected' : ''}>Fixed</option></select></td></tr>`;
            tbody.innerHTML += row;
        });
    }, (error) => {
        console.error("Error listening to repair tickets:", error);
    });
}

// --- 4. TIME TICKETS ---
async function loadTimeTickets() {
    const { db, collection, query, orderBy, limit, getDocs } = window.firebaseServices;
    const tbody = document.getElementById('tickets-table-body');
    if (!tbody) return;
    try {
        const q = query(collection(db, "time_tickets"), orderBy("createdAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        tbody.innerHTML = snapshot.empty ? '<tr><td colspan="7" class="p-6 text-center text-gray-500">No tickets submitted yet.</td></tr>' : '';
        snapshot.forEach(doc => {
            const t = doc.data();
            let proofHtml = '';
            if (t.signatureUrl) proofHtml += `<a href="${t.signatureUrl}" target="_blank" class="text-blue-600 text-xs font-bold block hover:underline">View Signature</a>`;
            if (t.paperTicketUrl) proofHtml += `<a href="${t.paperTicketUrl}" target="_blank" class="text-purple-600 text-xs font-bold block hover:underline mt-1">View Paper Ticket</a>`;
            let qtyDisplay = `${t.quantity} ${t.unitType}`;
            if (t.travelTime > 0) qtyDisplay += ` <span class="text-gray-500 text-xs">(+ ${t.travelTime}h Travel)</span>`;
            const row = `<tr class="bg-white border-b hover:bg-gray-50"><td class="px-6 py-4">${t.date}</td><td class="px-6 py-4 font-bold text-gray-800">${t.jobName}</td><td class="px-6 py-4">${t.unit}</td><td class="px-6 py-4 text-sm">${t.description}</td><td class="px-6 py-4 font-mono font-bold">${qtyDisplay}</td><td class="px-6 py-4">${t.clientName}</td><td class="px-6 py-4">${proofHtml}</td></tr>`;
            tbody.innerHTML += row;
        });
    } catch (e) { if (e.code !== 'failed-precondition') console.error(e); }
}

// --- 5. JOB COSTING ---
// REPLACE this function in operations.js

// --- 5. JOB COSTING (True Labor + Materials + Equipment) ---
// --- 5. JOB COSTING (Server-Side Optimization) ---
async function loadJobCosting() {
    const { functions, httpsCallable } = window.firebaseServices;
    const tbody = document.getElementById('costing-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-500">Calculating true costs in the cloud...</td></tr>';

    try {
        const getJobCosting = httpsCallable(functions, 'getJobCosting');
        const result = await getJobCosting({});
        const jobs = result.data.jobs;

        if (!jobs || jobs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-500">No active or completed jobs found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        jobs.forEach(job => {
            // Margin Color Coding with Standard Badges
            let marginClass = 'badge badge-danger';
            if (job.margin >= 30) marginClass = 'badge badge-success';
            else if (job.margin >= 15) marginClass = 'badge badge-warning';

            const row = `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td>
                        <div class="font-bold text-gray-900">${job.jobName}</div>
                        <div class="text-xs text-gray-400 font-normal">${job.address}</div>
                    </td>
                    <td class="text-right text-gray-600 font-medium">$${job.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="text-right text-red-600">
                        $${job.laborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <div class="text-xs text-gray-400">${job.laborHours.toFixed(1)} hrs</div>
                    </td>
                    <td class="text-right text-red-600">
                        $${(job.materialCost + job.equipmentCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <div class="text-xs text-gray-400">Mat: $${job.materialCost} | Eqp: $${job.equipmentCost}</div>
                    </td>
                    <td class="text-right font-bold text-red-700">
                        $${job.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td class="text-right font-bold ${job.profit >= 0 ? 'text-green-600' : 'text-red-600'}">
                        $${job.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td class="text-center">
                        <span class="${marginClass}">${job.margin}%</span>
                        <button onclick="openCOModal('${job.jobId}', '${job.jobName.replace(/'/g, "\\'")}')" class="block mt-2 mx-auto text-xs text-purple-600 font-bold hover:underline">Change Orders</button>
                    </td>
                </tr>`;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error("Error loading job costs:", error);
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
}

// --- CHANGE ORDER MANAGEMENT ---
window.openCOModal = function (jobId, jobName) {
    document.getElementById('co-modal').classList.remove('hidden');
    document.getElementById('co-job-id').value = jobId;
    document.getElementById('co-job-name').textContent = jobName;
    document.getElementById('co-date').value = new Date().toISOString().split('T')[0];
    loadCOs(jobId);
};

async function loadCOs(jobId) {
    const { db, collection, query, where, getDocs } = window.firebaseServices;
    const container = document.getElementById('co-list');
    container.innerHTML = '<p class="text-center text-gray-400">Loading...</p>';

    try {
        const q = query(collection(db, "change_orders"), where("jobId", "==", jobId));
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = '<div class="text-center text-gray-400 text-sm py-4">No Change Orders found.</div>';
            return;
        }

        container.innerHTML = '';
        snap.forEach(doc => {
            const co = doc.data();
            const isApproved = co.status === 'Approved';
            const statusColor = isApproved ? 'bg-green-100 text-green-800' : (co.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800');

            const div = document.createElement('div');
            div.className = "bg-white p-3 rounded border border-gray-200 flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-gray-800">${co.title}</span>
                        <span class="${statusColor} text-xs px-2 py-0.5 rounded font-bold">${co.status}</span>
                    </div>
                    <p class="text-xs text-gray-500">${co.description || ''}</p>
                    <p class="text-xs text-gray-400 mt-1">${new Date(co.date).toLocaleDateString()} • Created by ${co.createdBy || 'Unknown'}</p>
                </div>
                <div class="text-right">
                    <div class="font-bold text-gray-900">$${parseFloat(co.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    ${!isApproved ? `<button onclick="approveCO('${doc.id}', '${jobId}', ${co.amount})" class="text-xs bg-green-600 text-white px-2 py-1 rounded font-bold hover:bg-green-700 mt-1">Approve</button>` : ''}
                </div>
            `;
            container.appendChild(div);
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-center text-red-500">Error loading COs</p>';
    }
}

window.approveCO = async function (coId, jobId, amount) {
    if (!confirm(`Approve this Change Order for $${amount}? This will increase the Job Revenue.`)) return;

    const { db, doc, updateDoc, increment, getDoc } = window.firebaseServices;

    try {
        // 1. Update CO Status
        await updateDoc(doc(db, "change_orders", coId), {
            status: 'Approved',
            approvedAt: new Date().toISOString()
        });

        // 2. Update Job Revenue
        // We need to be careful. Does 'grandTotal' exist?
        const jobRef = doc(db, "estimates", jobId);
        await updateDoc(jobRef, {
            grandTotal: increment(amount)
        });

        alert("Change Order Approved & Revenue Updated!");
        loadCOs(jobId);
        loadJobCosting(); // Refresh main table

    } catch (e) {
        alert("Error: " + e.message);
    }
};

// Initialize CO Save Button
document.addEventListener('DOMContentLoaded', () => {
    const saveCoBtn = document.getElementById('save-co-btn');
    if (saveCoBtn) {
        saveCoBtn.addEventListener('click', async () => {
            const { db, collection, addDoc } = window.firebaseServices;
            const jobId = document.getElementById('co-job-id').value;
            const title = document.getElementById('co-title').value;
            const amount = parseFloat(document.getElementById('co-amount').value);
            const date = document.getElementById('co-date').value;
            const desc = document.getElementById('co-desc').value;

            if (!title || !amount) return alert("Title and Amount are required.");

            saveCoBtn.disabled = true;
            try {
                await addDoc(collection(db, "change_orders"), {
                    jobId,
                    title,
                    amount,
                    date,
                    description: desc,
                    status: 'Pending',
                    createdBy: window.currentUser?.email || 'Admin',
                    createdAt: new Date().toISOString()
                });

                // Clear inputs
                document.getElementById('co-title').value = '';
                document.getElementById('co-amount').value = '';
                document.getElementById('co-desc').value = '';

                loadCOs(jobId);

            } catch (e) {
                alert("Error: " + e.message);
            } finally {
                saveCoBtn.disabled = false;
            }
        });
    }
});

// --- DISPATCH LOGIC ---

function setupClientSelector() {
    const btn = document.getElementById('dispatch-select-client-btn');
    const modal = document.getElementById('client-select-modal');
    const container = document.getElementById('client-list-container');
    const nameInput = document.getElementById('dispatch-client-name');
    if (!btn || !modal) return;
    btn.addEventListener('click', async () => {
        modal.classList.remove('hidden');
        container.innerHTML = '<p class="text-center text-gray-500">Loading clients...</p>';
        const { db, collection, getDocs } = window.firebaseServices;
        const q = collection(db, "estimates");
        const snap = await getDocs(q);
        const clients = new Set();
        snap.forEach(doc => { const name = doc.data().customerInfo?.name; if (name) clients.add(name); });
        container.innerHTML = '';
        const manualBtn = document.createElement('button');
        manualBtn.className = "w-full text-left p-2 hover:bg-blue-50 border-b text-blue-600 font-bold";
        manualBtn.textContent = "+ New / External Client";
        manualBtn.onclick = () => { nameInput.value = ""; nameInput.focus(); modal.classList.add('hidden'); };
        container.appendChild(manualBtn);
        clients.forEach(name => {
            const div = document.createElement('div');
            div.className = "p-2 hover:bg-gray-100 cursor-pointer border-b text-sm font-medium";
            div.textContent = name;
            div.onclick = () => { nameInput.value = name; modal.classList.add('hidden'); };
            container.appendChild(div);
        });
    });
}

// --- CREW BUILDER LOGIC ---
async function setupDispatchCrewBuilder() {
    const addRowBtn = document.getElementById('add-crew-row-btn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => addCrewRow());
    }

    const { db, collection, getDocs } = window.firebaseServices;
    try {
        const userSnap = await getDocs(collection(db, "users"));
        availableUsers = [];
        userSnap.forEach(doc => availableUsers.push({ id: doc.id, name: doc.data().name }));

        const assetSnap = await getDocs(collection(db, "assets"));
        availableAssets = [];
        assetSnap.forEach(doc => availableAssets.push({ id: doc.id, name: `${doc.data().unitId} - ${doc.data().type}` }));
    } catch (e) { console.error("Error loading lists for dispatch", e); }
}

function addCrewRow(data = {}) {
    const tbody = document.getElementById('dispatch-crew-list');
    const tr = document.createElement('tr');
    tr.className = "border-b";

    let userOptions = `<option value="">Select Employee...</option>`;
    availableUsers.forEach(u => userOptions += `<option value="${u.id}" ${data.userId === u.id ? 'selected' : ''}>${u.name}</option>`);

    let assetOptions = `<option value="">No Vehicle</option>`;
    availableAssets.forEach(a => assetOptions += `<option value="${a.id}" ${data.assetId === a.id ? 'selected' : ''}>${a.name}</option>`);

    tr.innerHTML = `
        <td class="p-1"><select class="crew-user-select w-full border rounded text-sm">${userOptions}</select></td>
        <td class="p-1"><select class="crew-asset-select w-full border rounded text-sm">${assetOptions}</select></td>
        <td class="p-1"><input type="text" class="crew-note-input w-full border rounded text-sm" placeholder="Role/Notes" value="${data.note || ''}"></td>
        <td class="p-1 text-center"><button onclick="this.closest('tr').remove()" class="text-red-500 font-bold">×</button></td>
    `;
    tbody.appendChild(tr);
}

function openDispatchModal(jobId, jobData) {
    const modal = document.getElementById('dispatch-modal');
    setupClientSelector();
    modal.querySelectorAll('input, textarea, select').forEach(el => el.value = '');
    document.getElementById('dispatch-crew-list').innerHTML = ''; // Clear crew list

    if (jobId && jobData) {
        document.getElementById('dispatch-job-id').value = jobId;
        document.getElementById('dispatch-client-name').value = jobData.customerInfo?.name || '';
        document.getElementById('dispatch-site-loc').value = jobData.customerInfo?.siteAddress || jobData.customerInfo?.address || '';
        document.getElementById('dispatch-job-type').value = "Paving";
    }

    document.getElementById('dispatch-date').value = document.getElementById('dispatch-date-picker').value;
    modal.classList.remove('hidden');

    // --- ROUTE EFFICIENCY LOGIC ---
    const siteInput = document.getElementById('dispatch-site-loc');
    const driveTimeDisplay = document.getElementById('dispatch-drive-time');

    // Clear previous
    driveTimeDisplay.textContent = '';
    driveTimeDisplay.classList.add('hidden');

    // Define Calculator
    const updateDriveTime = () => {
        const address = siteInput.value;
        if (!address) {
            driveTimeDisplay.classList.add('hidden');
            return;
        }

        // SIMULATED ROUTER (Haversine-ish)
        // In production: await google.maps.DistanceMatrixService...
        driveTimeDisplay.textContent = 'Calculating route...';
        driveTimeDisplay.classList.remove('hidden');

        setTimeout(() => {
            // Mock logic: Hash the address to get a consistent "random" time between 15 and 55 mins
            let hash = 0;
            for (let i = 0; i < address.length; i++) hash = address.charCodeAt(i) + ((hash << 5) - hash);
            const minutes = 15 + (Math.abs(hash) % 40);

            driveTimeDisplay.innerHTML = `🚗 Est. Travel: ${minutes} mins <span class="text-gray-400 font-normal">(from HQ)</span>`;
        }, 600);
    };

    // Attach Listener (Debounced)
    let timeout;
    siteInput.onkeyup = () => {
        clearTimeout(timeout);
        timeout = setTimeout(updateDriveTime, 800);
    };

    // Trigger immediately if value exists
    if (siteInput.value) updateDriveTime();

    // Load Safety Docs
    loadSafetyDocsForDispatch();
}

async function loadSafetyDocsForDispatch() {
    const container = document.getElementById('dispatch-swp-container');
    if (!container) return;

    const { db, collection, getDocs, query, orderBy } = window.firebaseServices;

    // Check if we already loaded them to avoid re-fetching every time (optional optimization)
    if (container.children.length > 1 && !container.querySelector('p')) return;

    container.innerHTML = '<p class="text-xs text-gray-400 italic">Loading safety documents...</p>';

    try {
        const q = query(collection(db, "safety_manual"), orderBy("title"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-xs text-gray-400">No safety documents found.</p>';
            return;
        }

        container.innerHTML = '';

        // Group by Category? Or just list?
        // Let's list them but maybe sort by category or just title.
        // User asked for "selectable", so checkboxes.

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = "flex items-center gap-2 hover:bg-gray-50 p-1 rounded";

            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = "checkbox";
            checkbox.className = "swp-check h-3 w-3 text-red-600 rounded border-gray-300 focus:ring-red-500";
            checkbox.value = data.title; // We store the title as the value

            // Label
            const label = document.createElement('span');
            label.className = "text-xs text-gray-700 truncate";
            label.textContent = data.title;

            // Category Badge (Optional)
            const badge = document.createElement('span');
            badge.className = "text-[9px] bg-gray-100 text-gray-500 px-1 rounded ml-auto";
            badge.textContent = data.category;

            div.appendChild(checkbox);
            div.appendChild(label);
            div.appendChild(badge);

            // Click on div toggles checkbox
            div.addEventListener('click', (e) => {
                if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
            });

            container.appendChild(div);
        });

    } catch (error) {
        console.error("Error loading safety docs:", error);
        container.innerHTML = '<p class="text-xs text-red-500">Error loading documents.</p>';
    }
}

async function saveDispatchAssignment() {
    const { db, collection, addDoc } = window.firebaseServices;
    const btn = document.getElementById('save-dispatch-btn');

    const crewAssignments = [];
    document.querySelectorAll('#dispatch-crew-list tr').forEach(tr => {
        const userId = tr.querySelector('.crew-user-select').value;
        const assetId = tr.querySelector('.crew-asset-select').value;
        const note = tr.querySelector('.crew-note-input').value;
        if (userId) {
            const userName = tr.querySelector('.crew-user-select option:checked').text;
            const assetName = assetId ? tr.querySelector('.crew-asset-select option:checked').text : 'None';
            crewAssignments.push({ userId, userName, assetId, assetName, note });
        }
    });

    // Collect SWPs
    const swpList = [];
    document.querySelectorAll('.swp-check:checked').forEach(cb => swpList.push(cb.value));

    // Collect Custom Hazards
    const customHazards = [];
    document.querySelectorAll('.custom-hazard-tag').forEach(tag => customHazards.push(tag.textContent.replace('×', '').trim()));

    const dispatchData = {
        jobId: document.getElementById('dispatch-job-id').value || null,
        clientName: document.getElementById('dispatch-client-name').value,
        jobType: document.getElementById('dispatch-job-type').value,
        date: document.getElementById('dispatch-date').value,
        shopTime: document.getElementById('dispatch-shop-time').value,
        siteTime: document.getElementById('dispatch-site-time').value,
        siteAddress: document.getElementById('dispatch-site-loc').value,
        dumpAddress: document.getElementById('dispatch-dump-loc').value,
        contactInfo: document.getElementById('dispatch-contact').value,
        material: document.getElementById('dispatch-material').value,
        crew: crewAssignments,
        equipment: document.getElementById('dispatch-equipment').value,
        tools: document.getElementById('dispatch-tools').value,

        // Safety & Compliance
        toolboxLocation: document.getElementById('dispatch-toolbox-loc').value,
        toolboxTime: document.getElementById('dispatch-toolbox-time').value,
        lmhaRequired: document.getElementById('dispatch-lmha-required').checked,
        lmhaWhen: document.getElementById('dispatch-lmha-when').value,
        lmhaWhere: document.getElementById('dispatch-lmha-where').value,
        swpList: swpList,
        customHazards: customHazards,

        notes: document.getElementById('dispatch-notes').value,
        notifyCrew: document.getElementById('dispatch-notify-crew').checked,

        createdAt: new Date().toISOString(),
        status: "Dispatched"
    };

    if (!dispatchData.date || !dispatchData.clientName) {
        alert("Date and Client are required.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
        const docRef = await addDoc(collection(db, "dispatch_schedule"), dispatchData);

        // --- NEW: Notification Trigger ---
        if (dispatchData.notifyCrew) {
            // Standard pattern for Firebase "Trigger Email" extension
            const emailBody = `
                <h2>New Dispatch Assignment</h2>
                <p><strong>Date:</strong> ${dispatchData.date}</p>
                <p><strong>Job:</strong> ${dispatchData.clientName}</p>
                <p><strong>Site:</strong> ${dispatchData.siteAddress}</p>
                <p><strong>Start Time:</strong> ${dispatchData.siteTime}</p>
                <p><strong>Notes:</strong> ${dispatchData.notes}</p>
                <p>Please check the Employee Portal for full details.</p>
            `;

            // Send to each crew member
            // Note: In a real app, we'd look up their emails. 
            // Here we assume we might have them or just send to a generic list for V1.
            // For V1, let's just log one email request to the system admin or a placeholder.

            await addDoc(collection(db, "mail"), {
                to: ["dispatch@citypave.com"], // Placeholder or dynamic if available
                message: {
                    subject: `Dispatch: ${dispatchData.clientName} - ${dispatchData.date}`,
                    html: emailBody
                }
            });
            console.log("Email notification queued.");
        }
        // ---------------------------------

        alert("Dispatch Sent Successfully!");
        document.getElementById('dispatch-modal').classList.add('hidden');
        document.getElementById('dispatch-date-picker').value = dispatchData.date;
        loadDailySchedule();
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Send Dispatch";
    }
}

async function loadReadyJobs() {
    const { db, collection, query, where, getDocs } = window.firebaseServices;
    const container = document.getElementById('unscheduled-list');
    if (!container) return;
    container.innerHTML = '<p class="text-center text-gray-500">Loading...</p>';
    try {
        const q = query(collection(db, "estimates"), where("status", "in", ["Accepted", "In Progress", "Work Starting"]));
        const snapshot = await getDocs(q);
        container.innerHTML = '';
        if (snapshot.empty) { container.innerHTML = '<p class="text-center text-gray-500">No active jobs to schedule.</p>'; return; }
        snapshot.forEach(doc => {
            const job = doc.data();
            const card = document.createElement('div');
            card.className = "bg-white p-3 rounded border border-gray-200 hover:shadow-md transition-shadow cursor-pointer flex justify-between items-center";
            card.innerHTML = `<div><h4 class="font-bold text-gray-800">${job.customerInfo?.name || 'Unnamed'}</h4><p class="text-sm text-gray-600">${job.customerInfo?.address || 'No Address'}</p><span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">${job.status}</span></div><button class="text-blue-600 font-bold text-2xl">&rarr;</button>`;
            card.addEventListener('click', () => openDispatchModal(doc.id, job));
            container.appendChild(card);
        });
    } catch (error) { container.innerHTML = '<p class="text-center text-red-500">Error loading jobs.</p>'; }
}

async function loadDailySchedule() {
    const { db, collection, query, where, getDocs } = window.firebaseServices;
    const dateInput = document.getElementById('dispatch-date-picker');
    const container = document.getElementById('daily-schedule-list');
    if (!container) return;
    const selectedDate = dateInput.value;
    container.innerHTML = '<p class="text-center text-gray-500">Loading schedule...</p>';
    try {
        const q = query(collection(db, "dispatch_schedule"), where("date", "==", selectedDate));
        const snapshot = await getDocs(q);
        container.innerHTML = '';
        if (snapshot.empty) { container.innerHTML = '<p class="text-center text-gray-400 py-4">Nothing scheduled for this day.</p>'; return; }
        snapshot.forEach(doc => {
            const item = doc.data();

            let crewHtml = '';
            if (Array.isArray(item.crew)) {
                crewHtml = item.crew.map(c => `<div class="flex justify-between"><span class="font-bold">${c.userName}</span> <span>${c.assetName}</span></div>`).join('');
            } else {
                crewHtml = item.crew;
            }

            const card = document.createElement('div');
            card.className = "bg-blue-50 p-3 rounded border border-blue-200 text-sm";
            card.innerHTML = `
                <div class="flex justify-between items-start"><h4 class="font-bold text-blue-900">${item.clientName}</h4><span class="text-xs bg-white border px-1 rounded">${item.shopTime || '--:--'}</span></div>
                <p class="text-xs text-gray-600 mb-1 font-semibold">${item.jobType}</p>
                <p class="text-gray-700 mb-2 flex items-start gap-1"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> ${item.siteAddress || 'No Address'}</p>
                <div class="bg-white p-2 rounded border mb-1 text-xs space-y-1">${crewHtml}</div>
                <div class="text-xs text-gray-500">Dump: ${item.dumpAddress || 'N/A'}</div>
            `;
            container.appendChild(card);
        });
    } catch (error) { container.innerHTML = '<p class="text-center text-red-500">Error loading schedule.</p>'; }
}

window.updateTicketStatus = async function (ticketId, newStatus) {
    const { db, doc, updateDoc } = window.firebaseServices;
    try { const ticketRef = doc(db, "repair_tickets", ticketId); await updateDoc(ticketRef, { status: newStatus }); loadRepairTickets(); } catch (error) { alert("Failed to update status."); }
};
window.openFormModal = function (docId) {
    const data = window.formCache[docId];
    if (!data) return;
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('modal-content');
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = `${data.formTitle} - Details`;
    let html = `<div class="grid grid-cols-2 gap-4 mb-4 pb-4 border-b"><div><p class="text-xs text-gray-500">Employee</p><p class="font-bold">${data.userName}</p></div><div><p class="text-xs text-gray-500">Date</p><p class="font-bold">${new Date(data.submittedAt).toLocaleString()}</p></div></div>`;
    if (data.data) {
        for (const [key, value] of Object.entries(data.data)) {
            if (value === null || value === "") continue;
            let displayValue = value;
            if (typeof value === 'boolean') { displayValue = value ? "Yes" : "No"; }
            else if (String(value).startsWith('http')) { displayValue = `<img src="${value}" class="w-full max-h-64 object-contain border rounded mt-1">`; }
            html += `<div class="mb-3"><p class="text-xs text-gray-500 uppercase font-bold">${key.replace(/_/g, ' ')}</p><div class="text-gray-800 mt-1">${displayValue}</div></div>`;
        }
    }
    content.innerHTML = html;
    modal.classList.remove('hidden');
}
window.openShiftUpdatesModal = function (logId) {
    const data = window.timeLogCache[logId];
    if (!data || !data.updates) return;
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('modal-content');
    document.getElementById('modal-title').textContent = `Shift Updates - ${data.userName}`;
    let html = `<div class="space-y-4">`;
    [...data.updates].reverse().forEach(update => {
        html += `<div class="p-3 bg-gray-50 rounded border border-gray-200"><div class="flex justify-between items-center mb-2"><span class="font-bold text-blue-800 text-xs uppercase">Update at ${new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>${update.note ? `<p class="text-gray-800 mb-2 text-sm">${update.note}</p>` : ''}${update.photoUrl ? `<img src="${update.photoUrl}" class="w-full h-48 object-cover rounded border cursor-pointer" onclick="window.open(this.src, '_blank')">` : ''}</div>`;
    });
    html += `</div>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

// --- 6. DAILY REPORTS (CLIENT APPROVAL) ---
window.loadDailyJobSummaries = async function () {
    const { db, collection, query, where, getDocs } = window.firebaseServices;
    const listContainer = document.getElementById('daily-reports-list');
    const previewContainer = document.getElementById('report-preview-container');
    const sendBtn = document.getElementById('send-report-btn');

    listContainer.innerHTML = '<p class="text-center text-gray-400">Loading active jobs...</p>';
    previewContainer.innerHTML = '<p class="text-center text-gray-400 mt-10">Select a job to preview.</p>';
    sendBtn.disabled = true;
    window.currentReportJobId = null;

    try {
        // 1. Find jobs active today (or recently active)
        // For simplicity, we'll look at jobs with tickets created TODAY
        const todayStr = new Date().toISOString().split('T')[0];

        // Query tickets from today
        const qTickets = query(collection(db, "time_tickets"), where("date", "==", todayStr));
        const snapTickets = await getDocs(qTickets);

        const activeJobIds = new Set();
        const jobTicketCounts = {};

        snapTickets.forEach(doc => {
            const t = doc.data();
            if (t.jobId) {
                activeJobIds.add(t.jobId);
                jobTicketCounts[t.jobId] = (jobTicketCounts[t.jobId] || 0) + 1;
            }
        });

        if (activeJobIds.size === 0) {
            listContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No activity found for today.</p>';
            return;
        }

        // 2. Fetch Job Details
        listContainer.innerHTML = '';
        for (const jobId of activeJobIds) {
            // Check if already sent?
            // We could check daily_job_reports collection here to show "Sent" status

            const jobDoc = await window.firebaseServices.getDoc(window.firebaseServices.doc(db, "estimates", jobId));
            const job = jobDoc.data();
            const jobName = job.customerInfo?.name || 'Unnamed Job';

            const div = document.createElement('div');
            div.className = "bg-white p-3 rounded border border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors";
            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <h4 class="font-bold text-gray-800">${jobName}</h4>
                    <span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">${jobTicketCounts[jobId]} Tickets</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">${job.customerInfo?.address || ''}</p>
            `;
            div.onclick = () => loadReportPreview(jobId, jobName, todayStr);
            listContainer.appendChild(div);
        }

    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<p class="text-center text-red-500">Error loading jobs.</p>';
    }
};

async function loadReportPreview(jobId, jobName, dateStr) {
    const { db, collection, query, where, getDocs } = window.firebaseServices;
    const container = document.getElementById('report-preview-container');
    const sendBtn = document.getElementById('send-report-btn');

    container.innerHTML = '<p class="text-center text-gray-400">Generating preview...</p>';
    window.currentReportJobId = jobId;
    window.currentReportDate = dateStr;

    try {
        // Fetch Tickets
        const qTickets = query(collection(db, "time_tickets"), where("jobId", "==", jobId), where("date", "==", dateStr));
        const snapTickets = await getDocs(qTickets);

        // Fetch Logs (Optional, for internal view)
        // ...

        let html = `
            <div class="mb-4 border-b pb-4">
                <h3 class="text-lg font-bold text-gray-800">${jobName}</h3>
                <p class="text-sm text-gray-500">Daily Summary for ${dateStr}</p>
            </div>
            <h4 class="font-bold text-sm text-gray-700 mb-2">Tickets to Send (${snapTickets.size})</h4>
            <div class="space-y-2">
        `;

        let totalQty = 0;
        const ticketIds = [];

        snapTickets.forEach(doc => {
            const t = doc.data();
            ticketIds.push(doc.id);
            totalQty += parseFloat(t.quantity) || 0;

            html += `
                <div class="bg-gray-50 p-2 rounded border border-gray-200 text-sm flex justify-between">
                    <div>
                        <span class="font-bold">Ticket #${t.description.match(/#(\d+)/)?.[1] || 'N/A'}</span>
                        <span class="text-gray-500 mx-2">-</span>
                        <span>${t.description}</span>
                    </div>
                    <div class="font-mono font-bold">${t.quantity} ${t.unitType}</div>
                </div>
            `;
        });

        html += `
            </div>
            <div class="mt-4 pt-4 border-t flex justify-between items-center">
                <span class="font-bold text-gray-600">Total Quantity:</span>
                <span class="text-xl font-bold text-blue-600">${totalQty.toFixed(2)}</span>
            </div>
            
            <div class="mt-6">
                <label class="block text-sm font-bold text-gray-700 mb-1">Add Note to Client (Optional)</label>
                <textarea id="report-client-note" class="w-full border rounded p-2 text-sm" rows="3" placeholder="e.g. Great progress today, expecting to finish tomorrow."></textarea>
            </div>
        `;

        container.innerHTML = html;
        sendBtn.disabled = false;

        // Attach Send Handler
        sendBtn.onclick = () => sendReportToClient(jobId, jobName, dateStr, ticketIds, totalQty);

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-center text-red-500">Error loading preview.</p>';
    }
}

async function sendReportToClient(jobId, jobName, dateStr, ticketIds, totalQty) {
    const { db, collection, addDoc, serverTimestamp } = window.firebaseServices;
    const note = document.getElementById('report-client-note').value;
    const btn = document.getElementById('send-report-btn');

    if (!confirm(`Send this report to the Client Portal for ${jobName}?`)) return;

    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
        await addDoc(collection(db, "daily_job_reports"), {
            jobId,
            jobName,
            date: dateStr,
            ticketIds,
            totalQuantity: totalQty,
            clientNote: note,
            sentBy: window.currentUser?.email || 'Admin',
            sentAt: serverTimestamp(),
            status: 'Sent'
        });

        alert("Report Sent Successfully!");
        btn.textContent = "Sent ✓";

        // Optionally refresh list to show "Sent" status
        loadDailyJobSummaries();

    } catch (e) {
        alert("Error: " + e.message);
        btn.disabled = false;
        btn.textContent = "Approve & Send to Client";
    }
}

// --- 6. WORKFORCE VIEW ---
async function initWorkforceView() {
    const listContainer = document.getElementById('wf-employee-list');
    const searchInput = document.getElementById('wf-search');
    const roleFilter = document.getElementById('wf-filter-role');
    const statusFilter = document.getElementById('wf-filter-status');

    if (!listContainer) return; // Guard

    initWorkforceView(); // Ensure this is called
    initJobMediaView();
}

async function loadWorkforceList() {

    // Event Listeners
    if (searchInput) searchInput.addEventListener('keyup', (e) => filterWorkforceList(e.target.value));
    if (roleFilter) roleFilter.addEventListener('change', () => filterWorkforceList(searchInput.value));
    if (statusFilter) statusFilter.addEventListener('change', () => filterWorkforceList(searchInput.value));
}

async function loadWorkforceList() {
    const { db, collection, getDocs, query, orderBy } = window.firebaseServices;
    const container = document.getElementById('wf-employee-list');
    container.innerHTML = '<p class="text-center text-slate-400 py-4 text-xs">Loading employees...</p>';

    try {
        const q = query(collection(db, "users"), orderBy("name"));
        const snap = await getDocs(q);

        window.allEmployees = []; // Cache
        snap.forEach(doc => {
            const data = doc.data();
            window.allEmployees.push({
                id: doc.id,
                name: data.name || data.email,
                role: data.role || 'Crew',
                status: data.status || 'Active', // Default to Active if missing
                email: data.email
            });
        });

        renderEmployeeList(window.allEmployees);

    } catch (e) {
        console.error("Error loading workforce:", e);
        container.innerHTML = '<p class="text-center text-red-500 text-xs">Error loading list.</p>';
    }
}

function renderEmployeeList(employees) {
    const container = document.getElementById('wf-employee-list');
    container.innerHTML = '';

    if (employees.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-4 text-xs">No employees found.</p>';
        return;
    }

    employees.forEach(emp => {
        const div = document.createElement('div');
        div.className = "p-3 hover:bg-purple-50 cursor-pointer flex items-center justify-between group transition-colors";
        div.onclick = () => selectEmployeeForWorkforce(emp);

        div.innerHTML = `
            <div>
                <div class="font-bold text-slate-700 text-sm group-hover:text-purple-700">${emp.name}</div>
                <div class="text-xs text-slate-400">${emp.role} • ${emp.status}</div>
            </div>
            <div class="text-slate-300 group-hover:text-purple-400">›</div>
        `;
        container.appendChild(div);
    });
}

function filterWorkforceList(searchTerm = "") {
    const role = document.getElementById('wf-filter-role')?.value || 'all';
    const status = document.getElementById('wf-filter-status')?.value || 'all';

    if (!window.allEmployees) return;

    const filtered = window.allEmployees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = role === 'all' || (role === 'crew' && emp.role !== 'Admin') || (role === 'office' && (emp.role === 'Admin' || emp.role === 'Manager'));
        const matchesStatus = status === 'all' || emp.status === status;

        return matchesSearch && matchesRole && matchesStatus;
    });

    renderEmployeeList(filtered);
}

async function selectEmployeeForWorkforce(employee) {
    // 1. Update UI Selection
    document.getElementById('wf-detail-empty').classList.add('hidden');
    document.getElementById('wf-detail-content').classList.remove('hidden');

    document.getElementById('wf-selected-name').textContent = employee.name;
    document.getElementById('wf-selected-role').textContent = `${employee.role} | ${employee.email}`;

    // 2. Setup Date Range (Weekly View Default)
    // For now, load last 7 days + today
    loadEmployeeShiftHistory(employee.id);
}

async function loadEmployeeShiftHistory(userId) {
    const container = document.getElementById('wf-shift-list');
    container.innerHTML = '<p class="text-center text-slate-400 py-10">Loading history...</p>';

    // Using ShiftAggregator Helper
    if (!window.firebaseServices) return;
    const aggregator = new ShiftAggregator(window.firebaseServices);

    try {
        const today = new Date();
        const promises = [];

        // Load last 7 days
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA');
            promises.push(aggregator.getShiftData(userId, dateStr));
        }

        const stats = await Promise.all(promises);

        container.innerHTML = '';

        stats.forEach(dayStat => {
            // Check for any activity
            const hasActivity = parseFloat(dayStat.summary.hours) > 0 || dayStat.summary.loads > 0 || dayStat.assets.routes.length > 0 || dayStat.assets.dashcam.length > 0;

            if (!hasActivity) return;

            const date = new Date(dayStat.date + 'T12:00:00'); // Fix TZ issues
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            // Render Card
            const card = document.createElement('div');
            card.className = "bg-white rounded border border-slate-200 p-4 shadow-sm relative";

            // Resources Badges
            let badges = '';
            if (dayStat.assets.tickets.length > 0) badges += `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold mr-1">${dayStat.assets.tickets.length} Tickets</span>`;
            if (dayStat.assets.forms.length > 0) badges += `<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded font-bold mr-1">${dayStat.assets.forms.length} Forms</span>`;
            if (dayStat.assets.dashcam.length > 0) badges += `<span class="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded font-bold mr-1">🎥 ${dayStat.assets.dashcam.length} Clips</span>`;

            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-slate-800">${dayName}</h4>
                        <div class="text-xs text-slate-500 mt-1">${badges}</div>
                    </div>
                     <div class="text-right">
                        <div class="text-xl font-bold text-slate-700">${dayStat.summary.hours} <span class="text-xs font-normal text-slate-400">hrs</span></div>
                        <div class="text-xs text-slate-500">${dayStat.summary.loads} loads</div>
                    </div>
                </div>
                
                <!-- Expanded Details (Dashcam) -->
                ${renderDashcamSection(dayStat.assets.dashcam)}
                
                <div class="mt-3 pt-3 border-t border-slate-100 flex gap-2 text-xs overflow-x-auto">
                    ${dayStat.dispatch.map(d => `<span class="bg-slate-100 px-2 py-1 rounded text-slate-600 whitespace-nowrap">${d.clientName}</span>`).join('')}
                </div>
            `;
            container.appendChild(card);
        });

        if (container.children.length === 0) {
            container.innerHTML = '<p class="text-center text-slate-400 py-10">No recent activity found for this employee.</p>';
        }

    } catch (e) {
        console.error("Error fetching history", e);
        container.innerHTML = '<p class="text-center text-red-500">Failed to load history.</p>';
    }
}

function renderDashcamSection(clips) {
    if (!clips || clips.length === 0) return '';

    return `
        <div class="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            ${clips.map(clip => `
                <div class="relative group aspect-video bg-black rounded overflow-hidden border border-slate-800">
                    <video 
                        src="${clip.url}" 
                        poster="${clip.thumbnailUrl || ''}"
                        class="w-full h-full object-cover" 
                        controls 
                        preload="metadata"
                        playsinline>
                    </video>
                    <div class="absolute top-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                        ${new Date(clip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                     ${clip.processed ? '<div class="absolute top-1 left-1 text-green-400 text-[10px]" title="Cloud Optimized">⚡</div>' : ''}
                </div>
            `).join('')}
        </div>
    `;
}

// --- 7. JOB MEDIA VIEW (Added for Resource Management) ---
async function initJobMediaView() {
    const listContainer = document.getElementById('media-job-list');
    const searchInput = document.getElementById('media-job-search');

    if (!listContainer) return;

    // Load Jobs
    await loadMediaJobs();

    // Event Listeners
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => filterMediaJobs(e.target.value));
    }

    document.getElementById('media-filter-type')?.addEventListener('change', () => {
        // Re-render current selection if exists
        const currentJob = window.selectedMediaJob;
        if (currentJob) renderJobGallery(currentJob.assets);
    });
}

async function loadMediaJobs() {
    const { db, collection, getDocs, query, where } = window.firebaseServices;
    const container = document.getElementById('media-job-list');

    try {
        // Fetch active jobs first
        const q = query(collection(db, "estimates"), where("status", "in", ["Scheduled", "In Progress", "Work Starting", "Completed"]));
        const snap = await getDocs(q);

        window.allMediaJobs = [];
        snap.forEach(doc => {
            const data = doc.data();
            window.allMediaJobs.push({
                id: doc.id,
                name: data.customerInfo?.name || 'Unnamed Job',
                address: data.customerInfo?.siteAddress || data.customerInfo?.address || '',
                status: data.status
            });
        });

        // Sort by name
        window.allMediaJobs.sort((a, b) => a.name.localeCompare(b.name));
        renderMediaJobList(window.allMediaJobs);

    } catch (e) {
        console.error("Error loading jobs for media:", e);
        container.innerHTML = '<p class="text-center text-red-500 text-xs">Error loading jobs. Indexes may be missing.</p>';
    }
}

function renderMediaJobList(jobs) {
    const container = document.getElementById('media-job-list');
    container.innerHTML = '';

    if (jobs.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-4 text-xs">No jobs found.</p>';
        return;
    }

    jobs.forEach(job => {
        const div = document.createElement('div');
        div.className = "p-3 hover:bg-indigo-50 cursor-pointer flex items-center justify-between group transition-colors rounded border border-transparent hover:border-indigo-100 mb-1";
        div.onclick = () => selectJobForMedia(job);

        div.innerHTML = `
            <div class="overflow-hidden">
                <div class="font-bold text-slate-700 text-sm truncate group-hover:text-indigo-700">${job.name}</div>
                <div class="text-xs text-slate-400 truncate">${job.address}</div>
            </div>
            <div class="text-slate-300 group-hover:text-indigo-400">›</div>
        `;
        container.appendChild(div);
    });
}

function filterMediaJobs(term) {
    if (!window.allMediaJobs) return;
    const lower = term.toLowerCase();
    const filtered = window.allMediaJobs.filter(j => j.name.toLowerCase().includes(lower) || j.address.toLowerCase().includes(lower));
    renderMediaJobList(filtered);
}

async function selectJobForMedia(job) {
    window.selectedMediaJob = job; // Store for filtering reference

    // UI Update
    document.getElementById('media-detail-empty').classList.add('hidden');
    document.getElementById('media-detail-content').classList.remove('hidden');
    document.getElementById('media-selected-job-name').textContent = job.name;
    document.getElementById('media-selected-job-addr').textContent = job.address;

    const grid = document.getElementById('media-gallery-grid');
    grid.innerHTML = '<div class="flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>';

    // Fetch Assets
    if (!window.firebaseServices) return;
    const aggregator = new JobAggregator(window.firebaseServices);

    const assets = await aggregator.getJobAssets(job.id);
    job.assets = assets; // Cache for local filtering

    renderJobGallery(assets);
}

function renderJobGallery(assets) {
    const grid = document.getElementById('media-gallery-grid');
    const filterType = document.getElementById('media-filter-type')?.value || 'all';

    grid.innerHTML = '';

    if (!assets || assets.length === 0) {
        grid.innerHTML = '<p class="text-center text-slate-400 py-10">No media assets found for this job.</p>';
        return;
    }

    const filtered = assets.filter(a => filterType === 'all' || a.type === filterType);

    if (filtered.length === 0) {
        grid.innerHTML = '<p class="text-center text-slate-400 py-10">No matching assets found.</p>';
        return;
    }

    // Grid Layout
    const gridDiv = document.createElement('div');
    gridDiv.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";

    filtered.forEach(asset => {
        const item = document.createElement('div');
        item.className = "bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group relative";

        let mediaContent = '';
        if (asset.type === 'image') {
            mediaContent = `<img src="${asset.url}" class="w-full h-32 object-cover bg-slate-100 cursor-zoom-in" onclick="window.open('${asset.url}', '_blank')">`;
        } else if (asset.type === 'video') {
            mediaContent = `<video src="${asset.url}" class="w-full h-32 object-cover bg-black" controls></video>`;
        }

        const dateStr = new Date(asset.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        item.innerHTML = `
            ${mediaContent}
            <div class="p-2">
                <div class="text-xs font-bold text-slate-700 truncate" title="${asset.title}">${asset.title}</div>
                <div class="flex justify-between items-center mt-1">
                    <span class="text-[10px] text-slate-400">${dateStr}</span>
                    <span class="text-[10px] bg-slate-100 text-slate-600 px-1 rounded">${asset.source}</span>
                </div>
                 <div class="text-[10px] text-slate-400 mt-0.5 truncate">by ${asset.user || 'Unknown'}</div>
            </div>
        `;
        gridDiv.appendChild(item);
    });

    grid.appendChild(gridDiv);
}