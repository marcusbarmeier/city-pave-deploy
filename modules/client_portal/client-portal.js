// © 2025 City Pave. All Rights Reserved.
// Filename: client-portal.js

import { config } from '../../config.js';

let map;

document.addEventListener('DOMContentLoaded', () => {
    const checkDb = setInterval(() => {
        if (window.firebaseServices && window.firebaseServices.db) {
            clearInterval(checkDb);
            initializePortal();
        }
    }, 100);
});

async function initializePortal() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        let estimate = null;

        if (token) {
            // --- TOKEN ACCESS FLOW WITH IDENTITY GATE ---
            const { db, collection, query, where, getDocs, doc, getDoc, addDoc, auth, GoogleAuthProvider, signInWithPopup } = window.firebaseServices;

            // 1. Validate Token First
            const linksCollection = collection(db, 'sharedLinks');
            const q = query(linksCollection, where("token", "==", token));
            const linkSnap = await getDocs(q);

            if (linkSnap.empty) throw new Error("Invalid or expired share link.");

            const linkDoc = linkSnap.docs[0];
            const linkData = linkDoc.data();

            if (!linkData.isActive) throw new Error("This link has been deactivated.");

            // 2. Identity Verification (Login Check)
            let user = auth.currentUser;

            if (!user) {
                // Show Modal and wait for login
                const modal = document.getElementById('identity-modal');
                const loginBtn = document.getElementById('google-signin-btn');

                modal.classList.remove('hidden');

                user = await new Promise((resolve, reject) => {
                    loginBtn.onclick = async () => {
                        try {
                            const provider = new GoogleAuthProvider();
                            const result = await signInWithPopup(auth, provider);
                            resolve(result.user);
                        } catch (error) {
                            console.error("Login failed:", error);
                            alert("Verification failed. Please try again.");
                        }
                    };

                    // Also listen for auth state change in case they login elsewhere/popup
                    const unsub = auth.onAuthStateChanged(u => {
                        if (u) {
                            unsub();
                            resolve(u);
                        }
                    });
                });

                modal.classList.add('hidden'); // Hide modal after success
            }

            // 3. Track View with Identity
            try {
                const viewsCollection = collection(linkDoc.ref, 'linkViews');
                await addDoc(viewsCollection, {
                    timestamp: new Date(),
                    referrer: document.referrer || "Direct link",
                    userAgent: navigator.userAgent,
                    viewerEmail: user.email,
                    viewerName: user.displayName,
                    viewerId: user.uid
                });
            } catch (e) { console.warn("Could not track view", e); }

            // 4. Fetch Estimate
            const estimateRef = doc(db, 'estimates', linkData.estimateId);
            const estimateSnap = await getDoc(estimateRef);

            if (!estimateSnap.exists()) throw new Error("Estimate not found.");
            estimate = { id: estimateSnap.id, ...estimateSnap.data() };

        } else if (window.firebaseServices.auth) {
            // --- AUTH ACCESS FLOW (Existing/Internal) ---
            const user = await new Promise(resolve => {
                const unsub = window.firebaseServices.auth.onAuthStateChanged(user => {
                    unsub();
                    resolve(user);
                });
            });
            if (!user) {
                throw new Error("Please log in to view this portal.");
            }
            console.warn("Logged in but no token provided. Portal expects a token for specific project view.");
        }

        if (!estimate) {
            throw new Error("No project data could be loaded.");
        }

        // --- SMART VIEW LOGIC ---
        // Check if this is a Trucking Job (based on tags or title)
        const isTrucking = (estimate.tags || []).some(t => t.toLowerCase().includes('trucking') || t.toLowerCase().includes('hauling')) ||
            (estimate.customerInfo?.name || '').toLowerCase().includes('trucking');

        renderHeader(estimate); // Render header first

        if (isTrucking) {
            document.getElementById('section-timeline').classList.add('hidden');
            document.getElementById('section-live-map').classList.remove('hidden');
            document.getElementById('section-tickets').classList.remove('hidden');
            renderTruckingMap(estimate.id);
            renderTickets(estimate.id);
        } else {
            renderTimeline(estimate);
        }
        // ------------------------

        renderGallery(estimate);
        renderFinancials(estimate);

        document.getElementById('portal-loading').classList.add('hidden');
        document.getElementById('portal-content').classList.remove('hidden');

    } catch (error) {
        console.error(error);
        showError("Access Error", error.message);
    }
}

function renderHeader(estimate) {
    document.getElementById('company-logo').src = config.logo_light;
    document.getElementById('project-title').textContent = estimate.customerInfo?.name || 'Project Dashboard';
    document.getElementById('project-id').textContent = `Ref: ${estimate.id.substring(0, 8).toUpperCase()}`;
}

function renderTimeline(estimate) {
    const container = document.getElementById('timeline-container');
    container.innerHTML = '';
    const stages = [
        { label: "Proposal Accepted", status: "complete" },
        { label: "Work Scheduled", status: estimate.tentativeStartDate ? "complete" : "pending" },
        { label: "Work In Progress", status: estimate.status === 'In Progress' ? "active" : (estimate.status === 'Completed' || estimate.status === 'Paid' ? "complete" : "pending") },
        { label: "Project Complete", status: estimate.status === 'Completed' || estimate.status === 'Paid' ? "complete" : "pending" }
    ];

    stages.forEach((stage) => {
        let icon = stage.status === 'complete' ? `<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>` : (stage.status === 'active' ? `<div class="h-2.5 w-2.5 bg-blue-600 rounded-full animate-pulse"></div>` : `<div class="h-2.5 w-2.5 bg-slate-300 rounded-full"></div>`);
        let colorClass = stage.status === 'complete' ? 'bg-green-100 border-green-500' : (stage.status === 'active' ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-300');

        container.innerHTML += `
            <div class="timeline-item relative pl-8 pb-8">
                <div class="timeline-connector"></div>
                <div class="absolute left-0 top-0 h-8 w-8 rounded-full border-2 ${colorClass} flex items-center justify-center z-10 bg-white">${icon}</div>
                <div><h3 class="font-bold text-sm text-slate-800">${stage.label}</h3><p class="text-xs text-slate-500">${stage.status === 'active' ? 'Current Status' : ''}</p></div>
            </div>`;
    });
}

async function renderTruckingMap(estimateId) {
    if (!window.google) return;

    map = new google.maps.Map(document.getElementById("haul-map"), {
        center: { lat: 49.8951, lng: -97.1384 }, // Default Winnipeg
        zoom: 11,
        disableDefaultUI: true,
    });

    const { db, collection, query, where, getDocs } = window.firebaseServices;

    // Fetch Route Logs for this Job
    const q = query(collection(db, "route_logs"), where("jobId", "==", estimateId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    // Just draw the destinations for now to keep it simple
    const bounds = new google.maps.LatLngBounds();
    snapshot.forEach(doc => {
        const log = doc.data();
        // We would need to geocode the 'destination' address to plot it
        // For V1, we can just mark the user's location if we had live tracking
        // This is a placeholder for the full live map implementation
    });
}

async function renderTickets(estimateId) {
    const { db, collection, query, where, getDocs, orderBy } = window.firebaseServices;
    const tbody = document.getElementById('ticket-list-body');

    // --- NEW LOGIC: Fetch Daily Reports (Approved) ---
    const qReports = query(collection(db, "daily_job_reports"), where("jobId", "==", estimateId), orderBy("date", "desc"));
    const snapReports = await getDocs(qReports);

    if (snapReports.empty) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">No daily summaries available yet.</td></tr>';
        document.getElementById('total-load-qty').textContent = "0.00 Tonnes";
        return;
    }

    tbody.innerHTML = '';
    let grandTotalQty = 0;

    // Iterate through approved reports
    for (const doc of snapReports.docs) {
        const report = doc.data();
        const date = new Date(report.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

        // Header Row for the Day
        tbody.innerHTML += `
            <tr class="bg-slate-100 border-b border-slate-200">
                <td colspan="5" class="px-4 py-2 font-bold text-slate-700">
                    ${date} 
                    <span class="text-xs font-normal text-slate-500 ml-2">(${report.ticketIds.length} tickets)</span>
                    ${report.clientNote ? `<div class="text-xs text-blue-600 font-normal mt-1">Note: ${report.clientNote}</div>` : ''}
                </td>
            </tr>
        `;

        grandTotalQty += parseFloat(report.totalQuantity) || 0;

        // Now fetch the actual tickets for this report (or we could store ticket details in the report to save reads)
        // For now, let's query the tickets by ID if list is small, or just query by date/jobId again to be safe
        const qTickets = query(collection(db, "time_tickets"), where("jobId", "==", estimateId), where("date", "==", report.date));
        const snapTickets = await getDocs(qTickets);

        snapTickets.forEach(tDoc => {
            const t = tDoc.data();
            const qty = parseFloat(t.quantity) || 0;

            let imageLink = '-';
            if (t.paperTicketUrl) imageLink = `<a href="${t.paperTicketUrl}" target="_blank" class="text-blue-600 hover:underline">View</a>`;
            else if (t.scaleTicketUrls && t.scaleTicketUrls.length > 0) imageLink = `<a href="${t.scaleTicketUrls[0]}" target="_blank" class="text-blue-600 hover:underline">View (${t.scaleTicketUrls.length})</a>`;

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="px-4 py-3 text-slate-600 pl-8 text-sm">${t.date}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-700 text-sm">${t.description.match(/Ticket #(\d+)/)?.[1] || 'N/A'}</td>
                    <td class="px-4 py-3 text-slate-600 text-sm">${t.unit}</td>
                    <td class="px-4 py-3 text-right font-bold text-slate-800 text-sm">${qty} ${t.unitType}</td>
                    <td class="px-4 py-3 text-right text-xs">${imageLink}</td>
                </tr>
            `;
        });
    }

    document.getElementById('total-load-qty').textContent = `${grandTotalQty.toFixed(2)} Tonnes`;
}

function renderGallery(estimate) {
    const grid = document.getElementById('gallery-grid');
    const photos = [...(estimate.workPhotos || [])];
    if (photos.length === 0) return;

    grid.innerHTML = '';
    photos.forEach(photo => {
        const div = document.createElement('div');
        div.className = "relative group aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer";
        div.onclick = () => window.open(photo.url, '_blank');
        div.innerHTML = `<img src="${photo.url}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">`;
        grid.appendChild(div);
    });
}

function renderFinancials(estimate) {
    let total = estimate.grandTotal || 0;
    document.getElementById('finance-total').textContent = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(total);
    const urlParams = new URLSearchParams(window.location.search);
    document.getElementById('view-invoice-btn').onclick = () => window.location.href = `share.html?token=${urlParams.get('token')}`;
}

function showError(title, msg) {
    document.getElementById('portal-loading').innerHTML = `<div class="text-center p-8"><h2 class="text-xl font-bold text-red-600 mb-2">${title}</h2><p class="text-slate-600">${msg}</p></div>`;
}