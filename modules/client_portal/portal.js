
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { config } from '../../config.js';

// --- Firebase Init ---
const firebaseConfig = {
    apiKey: "AIzaSyADrnYgh1fSTo3IZD7HOEJMyjduzDYIYSs",
    authDomain: "city-pave-estimator.firebaseapp.com",
    projectId: "city-pave-estimator",
    storageBucket: "city-pave-estimator.firebasestorage.app",
    messagingSenderId: "111714884839",
    appId: "1:111714884839:web:2b782a1b7be5be8edc5642"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- State ---
let currentUserEmail = null;
let currentEstimates = [];
let map = null;
let crewMarker = null;
let activeJobListener = null;

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const estimatesList = document.getElementById('estimates-list');
const estimateModal = document.getElementById('estimate-modal');
const estimateDetailContent = document.getElementById('estimate-detail-content');

// --- Event Listeners ---
loginForm.addEventListener('submit', handleLogin);
document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('close-estimate-btn').addEventListener('click', () => {
    estimateModal.classList.add('hidden');
});

// Tab Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Reset all
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.remove('text-blue-600', 'active');
            b.classList.add('text-slate-400');
        });
        // Set active
        const target = e.currentTarget;
        target.classList.add('text-blue-600', 'active');
        target.classList.remove('text-slate-400');

        const tab = target.dataset.tab;
        handleTabChange(tab);
    });
});

function handleTabChange(tab) {
    const estimatesSection = document.querySelector('section:nth-of-type(1)'); // Active Estimates
    const jobsSection = document.getElementById('jobs-section');
    const mapSection = document.getElementById('map-section');

    if (tab === 'home') {
        estimatesSection.classList.remove('hidden');
        jobsSection.classList.remove('hidden');
        mapSection.classList.add('hidden');
    } else if (tab === 'map') {
        estimatesSection.classList.add('hidden');
        jobsSection.classList.add('hidden');
        mapSection.classList.remove('hidden');
        initMap(); // Ensure map renders
    } else if (tab === 'profile') {
        alert("Profile coming soon!");
    }
}

// --- Auth Functions ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    if (!email) return;

    const btn = document.getElementById('login-btn');
    const originalText = btn.textContent;
    btn.textContent = "Sending Link...";
    btn.disabled = true;

    // Simulate Magic Link Delay
    await new Promise(r => setTimeout(r, 1500));

    // For MVP, we just "log in" if the email format is valid.
    // In production, this would send an email link via Firebase Auth.
    currentUserEmail = email;
    localStorage.setItem('portal_email', email);

    btn.textContent = "Link Sent!";

    setTimeout(() => {
        loginScreen.classList.add('opacity-0', 'pointer-events-none');
        appContainer.classList.remove('hidden');
        loadDashboard();
    }, 500);
}

function handleLogout() {
    localStorage.removeItem('portal_email');
    window.location.reload();
}

// --- Dashboard Functions ---
async function loadDashboard() {
    // Check for saved session
    if (!currentUserEmail) {
        const saved = localStorage.getItem('portal_email');
        if (saved) currentUserEmail = saved;
        else return; // Stay on login
    }

    // Hide login if needed (for refresh case)
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');

    document.getElementById('customer-name').textContent = currentUserEmail.split('@')[0]; // Simple name extraction

    await fetchEstimates();
}

async function fetchEstimates() {
    estimatesList.innerHTML = '<div class="animate-pulse flex space-x-4"><div class="flex-1 space-y-4 py-1"><div class="h-24 bg-slate-200 rounded-xl"></div></div></div>';

    try {
        // Query estimates by email
        // Note: This requires an index on 'customerInfo.email'
        const q = query(collection(db, "estimates"), where("customerInfo.email", "==", currentUserEmail));
        const querySnapshot = await getDocs(q);

        currentEstimates = [];
        querySnapshot.forEach((doc) => {
            currentEstimates.push({ id: doc.id, ...doc.data() });
        });

        renderEstimates();

    } catch (error) {
        console.error("Error fetching estimates:", error);
        estimatesList.innerHTML = `<div class="text-center text-red-500 p-4">Error loading estimates.<br><span class="text-xs text-gray-400">${error.message}</span></div>`;
    }
}

function renderEstimates() {
    estimatesList.innerHTML = '';

    if (currentEstimates.length === 0) {
        estimatesList.innerHTML = `
            <div class="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center">
                <div class="w-12 h-12 bg-slate-100 rounded-full mx-auto flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 class="font-bold text-slate-800">No Estimates Found</h3>
                <p class="text-sm text-slate-500 mt-1">We couldn't find any estimates linked to <br><b>${currentUserEmail}</b></p>
            </div>
        `;
        return;
    }

    currentEstimates.forEach(est => {
        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm active:scale-[0.98] transition-transform cursor-pointer";
        card.onclick = () => openEstimateDetail(est);

        const date = new Date(est.date).toLocaleDateString();
        const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(est.totalPrice || 0);

        let statusColor = 'bg-slate-100 text-slate-600';
        if (est.status === 'Approved') statusColor = 'bg-green-100 text-green-700';
        if (est.status === 'Pending') statusColor = 'bg-yellow-100 text-yellow-700';

        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-bold text-slate-800 text-lg">Estimate #${est.id.slice(0, 6)}</h4>
                    <p class="text-xs text-slate-500">${date}</p>
                </div>
                <span class="px-2 py-1 rounded-md text-xs font-bold ${statusColor}">${est.status}</span>
            </div>
            <div class="flex justify-between items-end">
                <p class="text-sm text-slate-600 line-clamp-1">${est.projectDescription || 'No description'}</p>
                <p class="font-bold text-slate-900 text-lg">${amount}</p>
            </div>
        `;
        estimatesList.appendChild(card);
    });
}

function openEstimateDetail(est) {
    const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(est.totalPrice || 0);

    estimateDetailContent.innerHTML = `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <p class="text-sm text-slate-500 uppercase font-bold mb-1">Total Estimate</p>
                <h1 class="text-4xl font-bold text-slate-900">${amount}</h1>
                <p class="text-sm text-slate-500 mt-2">Status: <span class="font-bold text-slate-800">${est.status}</span></p>
            </div>

            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 class="font-bold text-slate-800 mb-4 border-b pb-2">Project Details</h3>
                <p class="text-slate-600 leading-relaxed">${est.projectDescription || 'No description provided.'}</p>
            </div>

            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 class="font-bold text-slate-800 mb-4 border-b pb-2">Line Items</h3>
                <div class="space-y-3">
                    ${(est.lineItems || []).map(item => `
                        <div class="flex justify-between text-sm">
                            <span class="text-slate-600">${item.description}</span>
                            <span class="font-medium text-slate-900">$${item.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    const approveBtn = document.getElementById('approve-estimate-btn');
    if (est.status === 'Approved') {
        approveBtn.textContent = "Estimate Approved";
        approveBtn.disabled = true;
        approveBtn.classList.add('bg-gray-400', 'shadow-none');
        approveBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'shadow-green-200');
    } else {
        approveBtn.textContent = "Approve Estimate";
        approveBtn.disabled = false;
        approveBtn.classList.remove('bg-gray-400', 'shadow-none');
        approveBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'shadow-green-200');
        approveBtn.onclick = () => approveEstimate(est.id);
    }

    estimateModal.classList.remove('hidden');
}

async function approveEstimate(id) {
    const btn = document.getElementById('approve-estimate-btn');
    btn.textContent = "Approving...";
    btn.disabled = true;

    try {
        const estRef = doc(db, "estimates", id);
        await updateDoc(estRef, {
            status: "Approved",
            approvedAt: new Date().toISOString()
        });

        alert("Thank you! The estimate has been approved.");
        estimateModal.classList.add('hidden');
        fetchEstimates(); // Refresh list

    } catch (error) {
        console.error("Error approving:", error);
        alert("Error approving estimate. Please try again.");
        btn.textContent = "Approve Estimate";
        btn.disabled = false;
    }
}



// --- Map Functions ---
window.initMap = function () {
    if (map) return; // Already initialized
    const mapEl = document.getElementById('crew-map');
    if (!mapEl) return;

    // Default to City Pave Shop (approx) or generic city center
    const defaultCenter = { lat: 49.2827, lng: -123.1207 }; // Vancouver

    map = new google.maps.Map(mapEl, {
        zoom: 12,
        center: defaultCenter,
        disableDefaultUI: true,
        styles: [
            { "featureType": "poi", "stylers": [{ "visibility": "off" }] }
        ]
    });

    // Start listening for crew location if we have an active job
    startCrewTracking();
};

function startCrewTracking() {
    // Find the first active job for this user
    // In a real app, we might let them select which job to track if multiple
    const activeJob = currentEstimates.find(e => ['Accepted', 'In Progress', 'Work Starting'].includes(e.status));

    if (!activeJob) {
        document.getElementById('crew-status-text').textContent = "No Active Job";
        document.getElementById('crew-last-update').textContent = "Crew is not currently assigned.";
        return;
    }

    document.getElementById('crew-status-text').textContent = "Connecting...";

    // Listen to the specific job document
    if (activeJobListener) activeJobListener(); // Unsubscribe old

    activeJobListener = onSnapshot(doc(db, "estimates", activeJob.id), (doc) => {
        const data = doc.data();
        if (data && data.crewLocation) {
            updateCrewMarker(data.crewLocation);
        } else {
            document.getElementById('crew-status-text').textContent = "Waiting for Crew...";
        }
    });
}

function updateCrewMarker(loc) {
    const pos = { lat: loc.lat, lng: loc.lng };

    if (!crewMarker) {
        crewMarker = new google.maps.Marker({
            position: pos,
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#2563EB",
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2,
            },
            title: "Crew Location"
        });
    } else {
        crewMarker.setPosition(pos);
    }

    map.panTo(pos);

    // Update status text
    document.getElementById('crew-status-text').textContent = "Live Tracking";
    const time = new Date(loc.timestamp).toLocaleTimeString();
    document.getElementById('crew-last-update').textContent = `Last update: ${time}`;
}

// Auto-load if session exists
if (localStorage.getItem('portal_email')) {
    loadDashboard();
}
