// © 2025 City Pave. All Rights Reserved.
// Filename: dispatch.js

let calendar;
let map;
let allJobs = [];
let snowRoutes = []; // Store snow routes
let isSnowMode = false; // Toggle state
let currentFilter = 'all';
let crewMarkers = {}; // Store crew location markers
let jobMarkers = []; // Store job location markers

export async function initializeDispatchApp() {
    console.log("Initializing Dispatch App...");
    const { auth, onAuthStateChanged } = window.firebaseServices;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById('user-display-name').textContent = user.email;
            loadJobs();
            initializeCalendar();
            setupEventListeners();
            initializeCrewManager();

            // --- NEW: Voice Dispatch ---
            const voiceWidget = new VoiceCommandWidget('map-container');
            voiceWidget.render();
            startCrewTracking(); // <--- Start Live Tracking
            // ---------------------------
        } else {
            window.location.href = 'index.html';
        }
    });
}

function setupEventListeners() {
    // View Switcher
    document.getElementById('view-calendar').addEventListener('click', () => switchView('calendar'));
    document.getElementById('view-map').addEventListener('click', () => switchView('map'));

    // Crew Filter
    document.getElementById('crew-filter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        refetchEvents();
        updateMapMarkers();
    });

    // Search
    document.getElementById('job-search').addEventListener('input', (e) => {
        filterUnscheduledList(e.target.value);
    });

    // Close Details
    document.getElementById('close-details-btn').addEventListener('click', () => {
        document.getElementById('job-details-panel').classList.add('hidden');
    });

    // Snow Mode Toggle
    document.getElementById('snow-mode-btn').addEventListener('click', toggleSnowMode);

    // Storm Alert
    document.getElementById('storm-alert-btn').addEventListener('click', () => {
        if (confirm("ACTIVATE STORM ALERT?\n\nThis will notify ALL snow operators to report for duty immediately.")) {
            alert("STORM ALERT BROADCASTED!");
            // In real app, write to 'notifications' collection
        }
    });
}

async function toggleSnowMode() {
    isSnowMode = !isSnowMode;
    const btn = document.getElementById('snow-mode-btn');
    const stormBtn = document.getElementById('storm-alert-btn');

    if (isSnowMode) {
        btn.classList.add('bg-blue-600', 'text-white');
        btn.classList.remove('bg-white', 'text-blue-500');
        btn.textContent = "❄️ Mode: ON";
        stormBtn.classList.remove('hidden');
        document.body.classList.add('bg-slate-200'); // Darker bg for snow mode feeling
        await loadSnowRoutes();
    } else {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-white', 'text-blue-500');
        btn.textContent = "❄️ Snow Mode";
        stormBtn.classList.add('hidden');
        document.body.classList.remove('bg-slate-200');
        updateUI(); // Revert to standard jobs
    }
}

async function loadSnowRoutes() {
    console.log("Loading Snow Routes...");
    const { db, collection, getDocs } = window.firebaseServices;
    const snap = await getDocs(collection(db, "snow_routes"));
    snowRoutes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateUI();
}

import { GanttChart } from './gantt-chart.js';
import { LogicBridge } from './logic-bridge.js';
import { WeatherService } from './weather-service.js';
import { VoiceCommandWidget } from './voice-command-widget.js'; // <--- NEW IMPORT

let reactRoot = null;
let weatherData = null; // Store forecast

function switchView(viewName) {
    const calContainer = document.getElementById('calendar-container');
    const mapContainer = document.getElementById('map-container');
    const ganttContainer = document.getElementById('gantt-container');

    const calBtn = document.getElementById('view-calendar');
    const mapBtn = document.getElementById('view-map');
    const ganttBtn = document.getElementById('view-gantt');

    // Reset buttons
    [calBtn, mapBtn, ganttBtn].forEach(btn => {
        btn.classList.remove('bg-blue-100', 'text-blue-700');
        btn.classList.add('text-gray-600', 'hover:bg-gray-200');
    });

    // Hide all
    [calContainer, mapContainer, ganttContainer].forEach(el => el.classList.add('hidden'));

    if (viewName === 'calendar') {
        calContainer.classList.remove('hidden');
        calBtn.classList.add('bg-blue-100', 'text-blue-700');
        calBtn.classList.remove('text-gray-600', 'hover:bg-gray-200');
        calendar.render();
    } else if (viewName === 'map') {
        mapContainer.classList.remove('hidden');
        mapBtn.classList.add('bg-blue-100', 'text-blue-700');
        mapBtn.classList.remove('text-gray-600', 'hover:bg-gray-200');
        if (!map) initializeMap();
        else map.invalidateSize();
    } else if (viewName === 'gantt') {
        ganttContainer.classList.remove('hidden');
        ganttBtn.classList.add('bg-blue-100', 'text-blue-700');
        ganttBtn.classList.remove('text-gray-600', 'hover:bg-gray-200');
        renderGantt();
    }
}

function renderGantt() {
    const container = document.getElementById('react-gantt-root');
    if (!reactRoot) {
        reactRoot = ReactDOM.createRoot(container);
    }

    reactRoot.render(
        React.createElement(GanttChart, {
            jobs: allJobs,
            onJobUpdate: handleGanttUpdate
        })
    );
}

async function handleGanttUpdate(jobId, newCrew, newDate) {
    const { db, doc, updateDoc } = window.firebaseServices;

    // 1. Logic Bridge Check (Assets & HR)
    const job = allJobs.find(j => j.id === jobId);

    // A. Asset Check
    if (job && job.assignedAssets && job.assignedAssets.length > 0) {
        for (const assetId of job.assignedAssets) {
            const check = await LogicBridge.checkAssetAvailability(assetId, newDate);
            if (!check.available) {
                alert(`CONFLICT: Asset ${assetId} is unavailable. Reason: ${check.reason}`);
                return; // Abort update
            }
        }
    }

    // B. HR/Staff Check
    // We need to know who is in the assigned crew.
    // We'll fetch the daily roster for the TARGET date.
    const rosterRef = doc(db, "daily_roster", `roster_${newDate}`);
    const rosterSnap = await window.firebaseServices.getDoc(rosterRef);

    if (rosterSnap.exists()) {
        const roster = rosterSnap.data();
        // Determine which crew list to check based on newCrew assignment (A, B, or C)
        let crewMembers = [];
        if (newCrew === 'A') crewMembers = roster.crewA || [];
        if (newCrew === 'B') crewMembers = roster.crewB || [];
        if (newCrew === 'C') crewMembers = roster.crewC || [];

        for (const uid of crewMembers) {
            const check = await LogicBridge.checkStaffAvailability(uid, newDate);
            if (!check.available) {
                // Fetch user name for better error message? For now, just ID or generic.
                alert(`CONFLICT: Crew Member is unavailable. Reason: ${check.reason}`);
                return; // Abort
            }
        }
    }

    // 2. Domino Effect Check (Predictive Warning)
    // Assume duration is 1 day if not set, or fetch from job data
    const duration = parseInt(job.durationDays) || 1;
    const conflicts = await LogicBridge.checkDominoEffect(jobId, newDate, duration, newCrew);

    if (conflicts.length > 0) {
        const msg = `⚠️ DOMINO WARNING: Moving this job to ${newDate} conflicts with:\n\n- ${conflicts.join('\n- ')}\n\nThis will cause a double-booking for Crew ${newCrew}. Proceed anyway?`;
        if (!confirm(msg)) return;
    }

    // 3. Weather Check (Intelligence)
    if (weatherData && WeatherService.isRainy(newDate, weatherData)) {
        // Check if job type is sensitive (e.g., Paving)
        const isPaving = job.itemizedItems?.some(i => i.name.toLowerCase().includes('pave') || i.name.toLowerCase().includes('asphalt'));
        if (isPaving || true) { // Warn for all for now
            if (!confirm(`🌧️ WEATHER ALERT: Rain is expected on ${newDate}.\n\nDo you want to proceed with scheduling?`)) {
                return;
            }
        }
    }

    try {
        await updateDoc(doc(db, "estimates", jobId), {
            assignedCrew: newCrew,
            tentativeStartDate: newDate,
            status: 'Scheduled'
        });
        // React will re-render automatically via onSnapshot -> loadJobs -> updateUI -> renderGantt
    } catch (error) {
        console.error("Gantt update failed:", error);
        alert("Failed to update job.");
    }
}

// Hook into updateUI to re-render Gantt if visible
const originalUpdateUI = updateUI;
updateUI = function () {
    originalUpdateUI(); // Call original
    if (!document.getElementById('gantt-container').classList.contains('hidden')) {
        renderGantt();
    }
};

// Add listener for new button
document.getElementById('view-gantt').addEventListener('click', () => switchView('gantt'));

// --- MAP LOGIC ---
function initializeMap() {
    if (map) return;
    map = L.map('map').setView([44.9778, -93.2650], 10); // Default Minneapolis
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Add markers for jobs
    updateMapMarkers();
}

let mapMarkers = [];

function updateMapMarkers() {
    if (!map) return;

    // Clear existing
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    allJobs.forEach(job => {
        // Ideally, coords should be stored in the job. 
        // For this demo, we'll randomize slightly around Winnipeg if no coords, 
        // or use a real geocoder if available.

        // Let's assume job has coords or we skip. 
        // If you want to see markers, we can fake it for the demo.
        // const lat = 49.8951 + (Math.random() - 0.5) * 0.1;
        // const lng = -97.1384 + (Math.random() - 0.5) * 0.1;

        // Real implementation:
        // if (job.locationCoords) ...
    });
}

// --- LIVE CREW TRACKING (STATUS BOARD) ---
function startCrewTracking() {
    const { db, collection, query, where, orderBy, limit, onSnapshot } = window.firebaseServices;

    // Listen to recent logs to determine crew locations
    // In a real app, we'd have a dedicated 'user_locations' table updated by Cloud Functions.
    // For this prototype, we'll listen to 'daily_logs' for the last hour.

    // We can't easily query "latest per user" in Firestore without separate queries or client-side filtering.
    // We'll fetch recent logs and process client-side.
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const q = query(collection(db, "daily_logs"),
        where("timestamp", ">=", oneHourAgo),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => doc.data());
        updateCrewMarkers(logs);
    });
}

function updateCrewMarkers(logs) {
    if (!map) return;

    // Group by User to get latest status
    const crewStatus = {};
    logs.forEach(log => {
        if (!crewStatus[log.userId]) {
            crewStatus[log.userId] = log;
        }
    });

    // Clear old crew markers (stored in global crewMarkers obj)
    Object.values(crewMarkers).forEach(marker => map.removeLayer(marker));
    crewMarkers = {};

    Object.values(crewStatus).forEach(latest => {
        if (!latest.location || !latest.location.lat) return;

        // Determine Status Color
        const minutesAgo = (Date.now() - new Date(latest.timestamp).getTime()) / 60000;
        let statusColor = 'bg-green-500'; // Active (< 10 mins)
        let statusText = 'Active';

        if (minutesAgo > 30) {
            statusColor = 'bg-red-500';
            statusText = 'Offline / Stopped';
        } else if (minutesAgo > 10) {
            statusColor = 'bg-yellow-500';
            statusText = 'Idle';
        }

        // Custom Icon
        const icon = L.divIcon({
            className: 'custom-crew-icon',
            html: `
                <div class="relative">
                    <div class="w-4 h-4 rounded-full border-2 border-white shadow-md ${statusColor}"></div>
                    <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-[10px] px-1 rounded whitespace-nowrap">
                        ${latest.userName || 'Crew'}
                    </div>
                </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        const marker = L.marker([latest.location.lat, latest.location.lng], { icon: icon })
            .addTo(map)
            .bindPopup(`
                <b>${latest.userName}</b><br>
                Status: ${statusText}<br>
                Last Seen: ${Math.round(minutesAgo)}m ago<br>
                Action: ${latest.type || 'Unknown'}
            `);

        crewMarkers[latest.userId] = marker;
    });
}

// --- CREW MANAGEMENT ---
function initializeCrewManager() {
    const btn = document.getElementById('manage-crews-btn');
    const modal = document.getElementById('crew-modal');
    const closeBtn = document.getElementById('close-crew-modal');
    const saveBtn = document.getElementById('save-crews-btn');

    btn.addEventListener('click', async () => {
        modal.classList.remove('hidden');
        await loadCrewData();
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    saveBtn.addEventListener('click', async () => {
        await saveCrewAssignments();
        modal.classList.add('hidden');
    });

    // Drag and Drop Logic for Staff
    setupDragDrop();
}

async function loadCrewData() {
    const { db, getDocs, collection, doc, getDoc } = window.firebaseServices;

    // 1. Fetch All Users
    const usersSnap = await getDocs(collection(db, "users"));
    const users = [];
    usersSnap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));

    // 2. Fetch Today's Roster
    const today = new Date().toLocaleDateString('en-CA');
    const rosterRef = doc(db, "daily_roster", `roster_${today}`);
    const rosterSnap = await getDoc(rosterRef);
    const roster = rosterSnap.exists() ? rosterSnap.data() : { crewA: [], crewB: [], crewC: [] };

    // 3. Render Lists
    const pool = document.getElementById('staff-pool');
    const crewA = document.getElementById('crew-a-list');
    const crewB = document.getElementById('crew-b-list');
    const crewC = document.getElementById('crew-c-list');

    [pool, crewA, crewB, crewC].forEach(el => el.innerHTML = '');

    users.forEach(user => {
        const card = createStaffCard(user);

        if (roster.crewA?.includes(user.uid)) crewA.appendChild(card);
        else if (roster.crewB?.includes(user.uid)) crewB.appendChild(card);
        else if (roster.crewC?.includes(user.uid)) crewC.appendChild(card);
        else pool.appendChild(card);
    });
}

function createStaffCard(user) {
    const div = document.createElement('div');
    div.className = 'staff-card bg-white p-2 rounded shadow-sm border cursor-grab text-sm flex justify-between items-center';
    div.draggable = true;
    div.dataset.uid = user.uid;
    div.innerHTML = `<span>${user.displayName || user.email}</span> <span class="text-gray-400">::</span>`;

    div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', user.uid);
        e.target.classList.add('opacity-50');
    });

    div.addEventListener('dragend', (e) => {
        e.target.classList.remove('opacity-50');
    });

    return div;
}

function setupDragDrop() {
    const containers = [
        document.getElementById('staff-pool'),
        document.getElementById('crew-a-list'),
        document.getElementById('crew-b-list'),
        document.getElementById('crew-c-list')
    ];

    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            container.classList.add('bg-gray-100');
        });

        container.addEventListener('dragleave', e => {
            container.classList.remove('bg-gray-100');
        });

        container.addEventListener('drop', e => {
            e.preventDefault();
            container.classList.remove('bg-gray-100');
            const uid = e.dataTransfer.getData('text/plain');
            const card = document.querySelector(`.staff-card[data-uid="${uid}"]`);
            if (card) container.appendChild(card);
        });
    });
}

async function saveCrewAssignments() {
    const { db, doc, setDoc } = window.firebaseServices;
    const today = new Date().toLocaleDateString('en-CA');

    const getUids = (id) => Array.from(document.getElementById(id).children).map(el => el.dataset.uid);

    const data = {
        date: today,
        crewA: getUids('crew-a-list'),
        crewB: getUids('crew-b-list'),
        crewC: getUids('crew-c-list'),
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, "daily_roster", `roster_${today}`), data);
        alert("Crew assignments saved!");
    } catch (e) {
        console.error(e);
        alert("Failed to save assignments.");
    }
}

async function loadJobs() {
    const { db, collection, query, where, onSnapshot } = window.firebaseServices;

    // Listen for ALL relevant jobs (Approved or Scheduled)
    const q = query(collection(db, "estimates"), where("status", "in", ["Approved", "Scheduled", "In Progress"]));

    onSnapshot(q, (snapshot) => {
        allJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
}

function updateUI() {
    renderUnscheduledList();
    refetchEvents();
    updateMapMarkers(); // Update map when jobs change
}

function renderUnscheduledList() {
    const container = document.getElementById('unscheduled-list');
    container.innerHTML = '';

    let items = [];

    if (isSnowMode) {
        // For now, just show all snow routes
        items = snowRoutes;
        document.querySelector('#unscheduled-list').previousElementSibling.querySelector('h2').textContent = "Snow Routes";
    } else {
        items = allJobs.filter(job => !job.tentativeStartDate);
        document.querySelector('#unscheduled-list').previousElementSibling.querySelector('h2').textContent = "Unscheduled Jobs";
    }

    if (items.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 text-sm">No items found.</div>';
        return;
    }

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'draggable-job bg-white p-3 rounded-md shadow-sm border border-gray-200 hover:shadow-md';

        // Data Attributes
        el.dataset.id = item.id;
        el.dataset.title = isSnowMode ? item.name : (item.customerInfo?.name || 'Unknown Client');

        if (isSnowMode) {
            // Snow Route Card
            el.innerHTML = `
                <div class="flex justify-between items-start">
                    <h4 class="font-bold text-blue-900 text-sm">❄️ ${item.name}</h4>
                    <span class="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">${item.properties?.length || 0} Sites</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Operator: ${item.operatorId ? 'Assigned' : 'Unassigned'}</p>
            `;
        } else {
            // Standard Job Card
            el.innerHTML = `
                <div class="flex justify-between items-start">
                    <h4 class="font-medium text-gray-900 text-sm">${item.customerInfo?.name || 'Unknown'}</h4>
                    <span class="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">${item.id.substring(0, 6)}</span>
                </div>
                <p class="text-xs text-gray-500 mt-1 truncate">${item.customerInfo?.address || 'No address'}</p>
                <div class="mt-2 flex items-center gap-2">
                    <span class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border">Est: $${(item.grandTotal / 1000).toFixed(1)}k</span>
                    ${item.tags && item.tags.includes('Priority') ? '<span class="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded">Priority</span>' : ''}
                </div>
            `;
        }

        container.appendChild(el);
    });

    // Re-initialize Draggable
    new FullCalendar.Draggable(container, {
        itemSelector: '.draggable-job',
        eventData: function (eventEl) {
            return JSON.parse(eventEl.dataset.event);
        }
    });
}

function filterUnscheduledList(term) {
    const lowerTerm = term.toLowerCase();
    document.querySelectorAll('.draggable-job').forEach(el => {
        const title = el.dataset.title.toLowerCase();
        if (title.includes(lowerTerm)) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        editable: true,
        droppable: true, // this allows things to be dropped onto the calendar
        events: [], // We'll populate this via refetchEvents
        eventClick: function (info) {
            showJobDetails(info.event.id);
        },
        eventDrop: function (info) {
            handleEventDrop(info);
        },
        eventReceive: function (info) {
            handleEventReceive(info);
        }
    });
    calendar.render();
}

function refetchEvents() {
    if (!calendar) return;

    const events = allJobs
        .filter(job => job.tentativeStartDate) // Only scheduled jobs
        .map(job => {
            // Determine color based on crew or status
            let color = '#3B82F6'; // Default Blue
            if (job.assignedCrew === 'A') color = '#EF4444'; // Red
            if (job.assignedCrew === 'B') color = '#10B981'; // Green
            if (job.assignedCrew === 'C') color = '#6366F1'; // Indigo

            // Filter check
            if (currentFilter !== 'all' && job.assignedCrew !== currentFilter) return null;

            return {
                id: job.id,
                title: `${job.customerInfo?.name} (${job.customerInfo?.address?.split(',')[0] || ''})`,
                start: job.tentativeStartDate,
                // end: job.tentativeEndDate, // Optional
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    address: job.customerInfo?.address,
                    crew: job.assignedCrew
                }
            };
        })
        .filter(e => e !== null);

    calendar.removeAllEvents();
    calendar.addEventSource(events);
}

import { LogicBridge } from './logic-bridge.js';

async function handleEventDrop(info) {
    const { db, doc, updateDoc } = window.firebaseServices;
    const jobId = info.event.id;
    const newDate = info.event.start.toISOString().split('T')[0]; // YYYY-MM-DD

    // --- LOGIC BRIDGE CHECK ---
    // We need to know which assets are assigned to this job to check availability.
    // Since we don't have granular asset assignment in this simplified view (just Crew A/B/C),
    // we will assume for now we are checking the "Crew" availability or if we had assets.
    // For Phase 2 verification, let's check a hypothetical asset if one was assigned.
    // In a real scenario, we'd fetch the job, get assigned assets, and check each.

    // Fetch job to get details
    const job = allJobs.find(j => j.id === jobId);
    if (job && job.assignedAssets && job.assignedAssets.length > 0) {
        for (const assetId of job.assignedAssets) {
            const check = await LogicBridge.checkAssetAvailability(assetId, newDate);
            if (!check.available) {
                alert(`CONFLICT: Asset ${assetId} is unavailable. Reason: ${check.reason}`);
                info.revert();
                return;
            }
        }
    }

    // --- HR CHECK (Bridge B) ---
    // Check if the assigned crew has any members on vacation
    if (job && job.assignedCrew) {
        const rosterRef = doc(db, "daily_roster", `roster_${newDate}`);
        const rosterSnap = await window.firebaseServices.getDoc(rosterRef);

        if (rosterSnap.exists()) {
            const roster = rosterSnap.data();
            let crewMembers = [];
            if (job.assignedCrew === 'A') crewMembers = roster.crewA || [];
            if (job.assignedCrew === 'B') crewMembers = roster.crewB || [];
            if (job.assignedCrew === 'C') crewMembers = roster.crewC || [];

            for (const uid of crewMembers) {
                const check = await LogicBridge.checkStaffAvailability(uid, newDate);
                if (!check.available) {
                    alert(`CONFLICT: Crew Member is unavailable. Reason: ${check.reason}`);
                    info.revert();
                    return;
                }
            }
        }
    }
    // ---------------------------

    try {
        await updateDoc(doc(db, "estimates", jobId), {
            tentativeStartDate: newDate,
            status: 'Scheduled'
        });
        // UI updates automatically via onSnapshot
    } catch (error) {
        console.error("Error updating schedule:", error);
        info.revert();
    }
}

async function handleEventReceive(info) {
    const { db, doc, updateDoc } = window.firebaseServices;
    const jobId = info.event.id;
    const newDate = info.event.start.toISOString().split('T')[0];

    // --- LOGIC BRIDGE CHECK ---
    const job = allJobs.find(j => j.id === jobId);
    if (job && job.assignedAssets && job.assignedAssets.length > 0) {
        for (const assetId of job.assignedAssets) {
            const check = await LogicBridge.checkAssetAvailability(assetId, newDate);
            if (!check.available) {
                alert(`CONFLICT: Asset ${assetId} is unavailable. Reason: ${check.reason}`);
                info.revert();
                info.event.remove(); // Remove from calendar
                return;
            }
        }
    }
    // ---------------------------

    try {
        await updateDoc(doc(db, "estimates", jobId), {
            tentativeStartDate: newDate,
            status: 'Scheduled'
        });
        info.event.remove(); // Remove the temporary event, let onSnapshot handle the real one
    } catch (error) {
        console.error("Error scheduling job:", error);
        info.revert();
    }
}

function showJobDetails(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return;

    const panel = document.getElementById('job-details-panel');
    const content = document.getElementById('job-details-content');

    content.innerHTML = `
        <div class="space-y-4">
            <div>
                <label class="block text-xs font-medium text-gray-500 uppercase">Client</label>
                <p class="text-lg font-bold text-gray-900">${job.customerInfo?.name}</p>
                <p class="text-sm text-gray-600">${job.customerInfo?.address}</p>
                <a href="tel:${job.customerInfo?.phone}" class="text-sm text-blue-600 hover:underline">${job.customerInfo?.phone}</a>
            </div>

            <div>
                <label class="block text-xs font-medium text-gray-500 uppercase">Schedule</label>
                <input type="date" id="detail-date" value="${job.tentativeStartDate || ''}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm">
            </div>

            <div>
                <label class="block text-xs font-medium text-gray-500 uppercase">Assigned Crew</label>
                <select id="detail-crew" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm">
                    <option value="">Unassigned</option>
                    <option value="A" ${job.assignedCrew === 'A' ? 'selected' : ''}>Crew A (Paving)</option>
                    <option value="B" ${job.assignedCrew === 'B' ? 'selected' : ''}>Crew B (Prep)</option>
                    <option value="C" ${job.assignedCrew === 'C' ? 'selected' : ''}>Crew C (Seal)</option>
                </select>
            </div>

            <div>
                <label class="block text-xs font-medium text-gray-500 uppercase">Job Notes</label>
                <textarea id="detail-notes" rows="4" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm">${job.scopeOfWork?.manual?.replace(/<[^>]*>/g, '') || ''}</textarea>
            </div>
            
            <div class="pt-4 border-t">
                <a href="estimator.html?estimateId=${job.id}&view=editor" class="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1">
                    Open in Estimator &rarr;
                </a>
            </div>
        </div>
    `;

    // Save Button Logic
    const saveBtn = document.getElementById('save-job-changes-btn');
    saveBtn.onclick = async () => {
        const newDate = document.getElementById('detail-date').value;
        const newCrew = document.getElementById('detail-crew').value;

        saveBtn.textContent = "Saving...";
        try {
            const { db, doc, updateDoc } = window.firebaseServices;
            await updateDoc(doc(db, "estimates", jobId), {
                tentativeStartDate: newDate || null,
                assignedCrew: newCrew,
                // If date is removed, set status back to Approved? Maybe.
                status: newDate ? 'Scheduled' : 'Approved'
            });
            panel.classList.add('hidden');
        } catch (e) {
            console.error(e);
            alert("Failed to save");
        } finally {
            saveBtn.textContent = "Save Changes";
        }
    };

    panel.classList.remove('hidden');
}
