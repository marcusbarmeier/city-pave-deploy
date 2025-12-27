// © 2025 City Pave. All Rights Reserved.
// Filename: growth.js

let hopperList = [];
let activeLeads = [];
let currentImportItem = null;
let leadEstimatesMap = {}; // Stores estimate counts for each lead

export function initializeGrowthApp() {
    loadLeads();

    // UI Listeners
    document.getElementById('import-contacts-btn').addEventListener('click', () => document.getElementById('csv-upload-input').click());
    document.getElementById('csv-upload-input').addEventListener('change', handleCSVUpload);

    document.getElementById('qualify-score').addEventListener('input', (e) => {
        document.getElementById('score-display').textContent = e.target.value;
    });

    document.getElementById('save-lead-btn').addEventListener('click', saveQualifiedLead);
    document.getElementById('trash-contact-btn').addEventListener('click', trashCurrentContact);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'bg-blue-100', 'text-blue-800', 'border-blue-200'));
            e.target.classList.add('active', 'bg-blue-100', 'text-blue-800', 'border-blue-200');
            renderLeads(e.target.dataset.filter);
        });
    });

    document.getElementById('search-leads').addEventListener('input', (e) => renderLeads('search', e.target.value));

    // --- NEW: EXPORT BUTTON ---
    const header = document.querySelector('header');
    const exportBtn = document.createElement('button');
    exportBtn.className = "ml-4 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-bold hover:bg-gray-50 shadow flex items-center gap-2";
    exportBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Export Google CSV`;
    exportBtn.addEventListener('click', exportLeadsToCSV);
    header.appendChild(exportBtn);

    // --- NEW: SYNC BUTTON LISTENER ---
    const syncBtn = document.getElementById('sync-contacts-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncContactsFromEstimator);
    }
}

// --- CSV IMPORT LOGIC ---
function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        complete: function (results) {
            const contacts = results.data.map(row => {
                // Smart mapping for Google Contacts / Facebook / LinkedIn
                const name = row['Name'] || row['First Name'] + ' ' + row['Last Name'] || row['Given Name'] || 'Unknown';
                const phone = row['Phone 1 - Value'] || row['Phone'] || row['Mobile Phone'] || '';
                const email = row['E-mail 1 - Value'] || row['Email'] || row['Email Address'] || '';
                const notes = row['Notes'] || '';

                if (!name || name.trim().includes('undefined')) return null;

                return {
                    name: name.trim(),
                    phone: phone.trim(),
                    email: email.trim(),
                    notes: notes.trim(),
                    originalData: row
                };
            }).filter(Boolean);

            hopperList = [...hopperList, ...contacts];
            renderHopper();
            alert(`Imported ${contacts.length} contacts to the Hopper!`);
        }
    });
    e.target.value = '';
}

function renderHopper() {
    const container = document.getElementById('hopper-list');
    container.innerHTML = '';

    if (hopperList.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 text-sm py-10">Hopper empty.</p>';
        return;
    }

    hopperList.forEach((contact, index) => {
        const div = document.createElement('div');
        div.className = "p-3 bg-white border border-gray-200 rounded shadow-sm hover:border-blue-400 cursor-pointer transition-all flex justify-between items-center";
        div.innerHTML = `
            <div class="overflow-hidden">
                <p class="font-bold text-sm text-gray-700 truncate">${contact.name}</p>
                <p class="text-xs text-gray-400 truncate">${contact.email || contact.phone || 'No contact info'}</p>
            </div>
            <span class="text-xs bg-gray-100 text-gray-500 px-1 rounded">New</span>`;
        div.addEventListener('click', () => openQualifyModal(contact, index));
        container.appendChild(div);
    });
}

function openQualifyModal(contact, index) {
    currentImportItem = { ...contact, index };

    document.getElementById('qualify-name').value = contact.name;
    document.getElementById('qualify-score').value = 5;
    document.getElementById('score-display').textContent = 5;

    // Pre-fill notes if available from CSV
    let prefillNotes = contact.notes || '';
    if (contact.email) prefillNotes += `\nEmail: ${contact.email}`;
    if (contact.phone) prefillNotes += `\nPhone: ${contact.phone}`;
    document.getElementById('qualify-notes').value = prefillNotes;

    document.getElementById('qualify-modal').classList.remove('hidden');
}

// --- DATABASE LOGIC ---

async function saveQualifiedLead() {
    const { db, collection, addDoc, auth } = window.firebaseServices;
    const user = auth.currentUser;
    const btn = document.getElementById('save-lead-btn');

    const name = document.getElementById('qualify-name').value;
    const rank = parseInt(document.getElementById('qualify-score').value);
    const notes = document.getElementById('qualify-notes').value;

    // Extract Email/Phone from notes if user edited them there (Simple parsing)
    const emailMatch = notes.match(/Email:\s*([^\s]+)/i);
    const phoneMatch = notes.match(/Phone:\s*([^\n]+)/i);
    const email = emailMatch ? emailMatch[1] : (currentImportItem?.email || '');
    const phone = phoneMatch ? phoneMatch[1] : (currentImportItem?.phone || '');

    if (!name) return alert("Name is required.");

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        await addDoc(collection(db, "leads"), {
            tenantId: 'citypave',
            ownerId: user.uid,
            name: name,
            rank: rank,
            status: 'Qualified',
            notes: notes,
            contactInfo: { phone, email, address: '' },
            createdAt: new Date().toISOString(),
            lastInteraction: null,
            referralSource: 'Manual Import' // Default
        });

        if (currentImportItem && currentImportItem.index !== undefined) {
            hopperList.splice(currentImportItem.index, 1);
            renderHopper();
        }

        document.getElementById('qualify-modal').classList.add('hidden');
        loadLeads();

    } catch (error) {
        console.error(error);
        alert("Error saving lead: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Add to Rolodex";
    }
}

function trashCurrentContact() {
    if (currentImportItem && currentImportItem.index !== undefined) {
        hopperList.splice(currentImportItem.index, 1);
        renderHopper();
    }
    document.getElementById('qualify-modal').classList.add('hidden');
}

async function loadLeads() {
    const { db, collection, query, where, getDocs } = window.firebaseServices;
    const container = document.getElementById('leads-grid');

    try {
        // 1. Load Leads
        const q = query(collection(db, "leads"), where("tenantId", "==", "citypave"));
        const snapshot = await getDocs(q);

        activeLeads = [];
        snapshot.forEach(doc => activeLeads.push({ id: doc.id, ...doc.data() }));

        // 2. Load Estimates for Reverse Lookup (Simple name matching for now)
        const estSnap = await getDocs(collection(db, "estimates"));
        leadEstimatesMap = {};
        estSnap.forEach(doc => {
            const est = doc.data();
            const name = est.customerInfo?.name;
            if (name) {
                // Normalize name for better matching (lowercase, trim)
                const key = name.toLowerCase().trim();
                if (!leadEstimatesMap[key]) leadEstimatesMap[key] = 0;
                leadEstimatesMap[key]++;
            }
        });

        renderLeads('all');
    } catch (error) {
        console.error("Error loading leads:", error);
        container.innerHTML = `<p class="col-span-full text-center text-red-500">Error loading relationships.</p>`;
    }
}

function renderLeads(filter, searchTerm = '') {
    const container = document.getElementById('leads-grid');
    container.innerHTML = '';

    let filtered = activeLeads;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(l => l.name.toLowerCase().includes(term) || (l.notes || '').toLowerCase().includes(term));
    } else if (filter === 'vip') {
        filtered = filtered.filter(l => l.rank >= 9);
    } else if (filter === 'warm') {
        filtered = filtered.filter(l => l.rank >= 6 && l.rank <= 8);
    } else if (filter === 'cold') {
        filtered = filtered.filter(l => l.rank <= 5);
    }

    filtered.sort((a, b) => b.rank - a.rank);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-10"><p class="text-gray-400 text-lg">No relationships found.</p></div>';
        return;
    }

    filtered.forEach(lead => {
        const rankColor = lead.rank >= 9 ? 'text-purple-600' : (lead.rank >= 6 ? 'text-green-600' : 'text-gray-500');

        // Check for Estimate Match
        const estimateCount = leadEstimatesMap[lead.name.toLowerCase().trim()] || 0;
        const estimateBadge = estimateCount > 0
            ? `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold ml-2">${estimateCount} Jobs</span>`
            : '';

        // --- NEW METRICS DISPLAY ---
        const referralSource = lead.referralSource || 'Unknown';
        const phone = lead.contactInfo?.phone || 'No Phone';
        const email = lead.contactInfo?.email || 'No Email';

        const card = document.createElement('div');
        card.className = "bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow relative group";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-lg text-gray-800 flex items-center">${lead.name} ${estimateBadge}</h3>
                    <p class="text-xs text-gray-500 italic">${lead.notes ? lead.notes.substring(0, 50) + '...' : 'No notes.'}</p>
                </div>
                <div class="text-right">
                    <span class="block text-2xl font-black ${rankColor}">${lead.rank}</span>
                </div>
            </div>
            
            <div class="text-xs text-gray-600 space-y-1 mb-3">
                <p><span class="font-bold">Source:</span> ${referralSource}</p>
                <p><span class="font-bold">Phone:</span> ${phone}</p>
                <p><span class="font-bold">Email:</span> ${email}</p>
            </div>

            <div class="border-t pt-3 mt-3 flex justify-between items-center">
                <div class="text-xs text-gray-400">
                    Last Contact: ${lead.lastInteraction ? new Date(lead.lastInteraction).toLocaleDateString() : 'Never'}
                </div>
                <div class="flex gap-2">
                    <button class="create-est-btn bg-green-50 text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-100 border border-green-200">Estimate</button>
                    <button class="log-touch-btn bg-blue-50 text-blue-600 px-3 py-1 rounded text-xs font-bold hover:bg-blue-100 border border-blue-200">Log</button>
                    <button class="delete-lead-btn text-gray-400 hover:text-red-500 px-2">×</button>
                </div>
            </div>
        `;

        // --- BRIDGE 1: CREATE ESTIMATE ---
        card.querySelector('.create-est-btn').addEventListener('click', () => {
            if (confirm(`Create a new estimate for ${lead.name}?`)) {
                // We use the Quick Add logic via URL params or direct creation
                // For now, let's use a URL redirect to the estimator which can parse params
                // We need to create the record first or pass params.
                // Simpler: Create the record here, then redirect.
                createNewEstimateForLead(lead);
            }
        });

        card.querySelector('.delete-lead-btn').addEventListener('click', async () => {
            if (confirm(`Delete ${lead.name}?`)) {
                const { db, doc, deleteDoc } = window.firebaseServices;
                await deleteDoc(doc(db, "leads", lead.id));
                loadLeads();
            }
        });

        card.querySelector('.log-touch-btn').addEventListener('click', async () => {
            const note = prompt(`Log interaction with ${lead.name}:`);
            if (note) {
                const { db, doc, updateDoc } = window.firebaseServices;
                await updateDoc(doc(db, "leads", lead.id), {
                    lastInteraction: new Date().toISOString(),
                    notes: lead.notes ? lead.notes + `\n[${new Date().toLocaleDateString()}] ${note}` : note
                });
                loadLeads();
            }
        });

        container.appendChild(card);
    });
}

// --- BRIDGE 1 HELPER: CREATE ESTIMATE ---
async function createNewEstimateForLead(lead) {
    const { db, collection, addDoc, query, where, getDocs } = window.firebaseServices;

    let existingClient = null;
    const email = lead.contactInfo?.email;
    const phone = lead.contactInfo?.phone;

    // 1. Fuzzy Match Logic (Bridge C)
    if (email || phone) {
        try {
            const matches = [];

            if (email) {
                const qEmail = query(collection(db, "estimates"), where("customerInfo.email", "==", email));
                const snapEmail = await getDocs(qEmail);
                snapEmail.forEach(doc => matches.push(doc.data()));
            }

            // If no email match, try phone
            if (matches.length === 0 && phone) {
                const qPhone = query(collection(db, "estimates"), where("customerInfo.phone", "==", phone));
                const snapPhone = await getDocs(qPhone);
                snapPhone.forEach(doc => matches.push(doc.data()));
            }

            if (matches.length > 0) {
                // Found a match!
                const match = matches[0]; // Take the first one
                const confirmMsg = `Found existing client "${match.customerInfo.name}" with matching contact info.\n\nUse existing client details (Address: ${match.customerInfo.address})?`;

                if (confirm(confirmMsg)) {
                    existingClient = match.customerInfo;
                }
            }
        } catch (e) {
            console.warn("Bridge C Lookup Failed:", e);
        }
    }

    try {
        const newEst = {
            customerInfo: {
                name: existingClient ? existingClient.name : lead.name,
                phone: existingClient ? existingClient.phone : (lead.contactInfo?.phone || ''),
                email: existingClient ? existingClient.email : (lead.contactInfo?.email || ''),
                address: existingClient ? existingClient.address : (lead.contactInfo?.address || '')
            },
            status: 'Draft',
            tags: ['New Leads', 'From Growth Tab'],
            createdAt: new Date().toISOString(),
            lastSaved: new Date().toISOString(),
            // ... Add other required defaults to avoid null errors ...
            pricing: { options: {}, dynamicOptions: [], selectedOptions: [] },
            siteVisits: [], sketches: [], workPhotos: [], beforeAndAfter: []
        };

        const docRef = await addDoc(collection(db, "estimates"), newEst);
        window.location.href = `../estimator/index.html?estimateId=${docRef.id}&view=editor`;

    } catch (e) {
        alert("Error creating estimate: " + e.message);
    }
}

// --- BRIDGE 2: EXPORT TO CSV ---
function exportLeadsToCSV() {
    if (activeLeads.length === 0) return alert("No leads to export.");

    // Format for Google Contacts Import
    const csvData = activeLeads.map(l => ({
        'Name': l.name,
        'Given Name': l.name.split(' ')[0],
        'Family Name': l.name.split(' ').slice(1).join(' '),
        'Phone 1 - Type': 'Mobile',
        'Phone 1 - Value': l.contactInfo?.phone || '',
        'E-mail 1 - Type': 'Work',
        'E-mail 1 - Value': l.contactInfo?.email || '',
        'Notes': `Rank: ${l.rank}/10\n${l.notes || ''}`
    }));

    const csvString = Papa.unparse(csvData);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `city_pave_leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- NEW: SYNC FROM ESTIMATOR ---
async function syncContactsFromEstimator() {
    const { db, collection, getDocs, addDoc, query, where, updateDoc, doc } = window.firebaseServices;
    const btn = document.getElementById('sync-contacts-btn');

    if (!confirm("This will scan all estimates and add missing contacts to the CRM. Continue?")) return;

    btn.disabled = true;
    btn.textContent = "Syncing...";

    try {
        // 1. Get all estimates
        const estSnap = await getDocs(collection(db, "estimates"));
        let addedCount = 0;
        let updatedCount = 0;

        // 2. Get all existing leads to check for duplicates
        const leadsSnap = await getDocs(query(collection(db, "leads"), where("tenantId", "==", "citypave")));
        const existingLeads = [];
        leadsSnap.forEach(d => existingLeads.push({ id: d.id, ...d.data() }));

        // Helper to find existing lead
        const findLead = (email, phone, name) => {
            // Priority 1: Email
            if (email) {
                const match = existingLeads.find(l => l.contactInfo?.email?.toLowerCase() === email.toLowerCase());
                if (match) return match;
            }
            // Priority 2: Phone
            if (phone) {
                const match = existingLeads.find(l => l.contactInfo?.phone?.replace(/\D/g, '') === phone.replace(/\D/g, ''));
                if (match) return match;
            }
            // Priority 3: Exact Name Match (Weakest)
            if (name) {
                const match = existingLeads.find(l => l.name.toLowerCase() === name.toLowerCase());
                if (match) return match;
            }
            return null;
        };

        for (const estDoc of estSnap.docs) {
            const est = estDoc.data();
            const info = est.customerInfo;
            if (!info || !info.name) continue;

            const name = info.name.trim();
            const email = info.email ? info.email.trim() : null;
            const phone = info.phone ? info.phone.trim() : null;
            const address = info.address || '';

            // Extract other metrics
            const rank = est.leadRating || 5;
            const source = est.contactHistory?.source || 'Estimator Import';
            const notes = est.contactHistory?.description || '';

            const existingLead = findLead(email, phone, name);

            if (existingLead) {
                // Update logic (Optional: Only update if missing info?)
                // For now, let's just update the lastInteraction to be safe
                // await updateDoc(doc(db, "leads", existingLead.id), { lastInteraction: new Date().toISOString() });
                // updatedCount++;
            } else {
                // Create new lead
                await addDoc(collection(db, "leads"), {
                    tenantId: 'citypave',
                    ownerId: 'system', // or current user
                    name: name,
                    rank: rank,
                    status: 'Qualified',
                    notes: notes,
                    contactInfo: { phone: phone || '', email: email || '', address: address },
                    createdAt: new Date().toISOString(),
                    lastInteraction: est.createdAt || new Date().toISOString(),
                    referralSource: source
                });

                // Add to local list to prevent duplicates within this loop
                existingLeads.push({
                    contactInfo: { phone, email },
                    name: name
                });

                addedCount++;
            }
        }

        alert(`Sync Complete!\nAdded: ${addedCount} new contacts.\nUpdated: ${updatedCount} existing contacts.`);
        loadLeads();

    } catch (error) {
        console.error("Sync Error:", error);
        alert("Sync Failed: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Sync from Estimator`;
    }
}