// © 2025 City Pave. All Rights Reserved.
// Filename: user-manager.js

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyADrnYgh1fSTo3IZD7HOEJMyjduzDYIYSs",
    authDomain: "city-pave-estimator.firebaseapp.com",
    projectId: "city-pave-estimator",
    storageBucket: "city-pave-estimator.firebasestorage.app",
    messagingSenderId: "111714884839",
    appId: "1:111714884839:web:2b782a1b7be5be8edc5642"
};

let allUsersCache = [];
let homeMap = null;
let streetView = null;
let geocoder = null;
let userHoursCache = {}; // Store calculated hours for the week

export function initializeUserManager() {
    const tabUsers = document.getElementById('tab-users');
    const viewUsers = document.getElementById('view-users');
    const createBtn = document.getElementById('create-user-btn');
    const saveEditBtn = document.getElementById('save-edit-user-btn');
    const resetPassBtn = document.getElementById('reset-password-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-user-btn');
    const searchInput = document.getElementById('team-search-input');
    const photoInput = document.getElementById('edit-user-photo-input');

    if (tabUsers && viewUsers) {
        tabUsers.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
            tabUsers.classList.add('active');
            viewUsers.classList.remove('hidden');
            loadUsers();
        });
    }

    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.profile-tab-btn').forEach(b => {
                b.classList.remove('active', 'text-blue-600', 'border-blue-600');
                b.classList.add('text-gray-500', 'border-transparent');
            });
            document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.add('hidden'));
            e.target.classList.add('active', 'text-blue-600', 'border-blue-600');
            e.target.classList.remove('text-gray-500', 'border-transparent');
            document.getElementById(e.target.dataset.target).classList.remove('hidden');

            if (e.target.dataset.target === 'tab-profile-info' && homeMap) {
                google.maps.event.trigger(homeMap, 'resize');
            }
        });
    });

    if (createBtn) createBtn.addEventListener('click', createNewUser);
    if (saveEditBtn) saveEditBtn.addEventListener('click', saveUserChanges);
    if (resetPassBtn) resetPassBtn.addEventListener('click', sendUserPasswordReset);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
    if (searchInput) searchInput.addEventListener('input', (e) => filterUsers(e.target.value));
    if (photoInput) photoInput.addEventListener('change', handlePhotoUpload);

    // --- PRIVACY PATROL (Create Form) ---
    // Wait for auth to settle or check immediately if available
    const checkPrivacy = () => {
        const currentUser = window.currentUser;
        const newWageInput = document.getElementById('new-user-wage');
        if (newWageInput && currentUser && currentUser.role !== 'admin') {
            newWageInput.parentElement.classList.add('hidden');
            newWageInput.value = "0"; // Default to 0 if they can't see it
        }
    };
    // Check now and also set a small timeout in case auth is racing
    checkPrivacy();
    setTimeout(checkPrivacy, 1000);
}

async function loadUsers() {
    const { db } = window.firebaseServices;
    const tbody = document.getElementById('users-table-body');
    const countBadge = document.getElementById('user-count');
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center">Loading...</td></tr>';

    try {
        // 1. Get Users
        const userSnap = await getDocs(collection(db, "users"));
        allUsersCache = [];
        userSnap.forEach(doc => allUsersCache.push({ id: doc.id, ...doc.data() }));

        // 2. Get Time Logs for CURRENT WEEK (Monday to Now)
        const now = new Date();
        const day = now.getDay(); // 0 (Sun) - 6 (Sat)
        // Calculate previous Monday (if today is Sunday (0), go back 6 days, else go back day-1)
        const diff = now.getDate() - day + (day == 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        const weekStartISO = monday.toISOString();

        // Query all logs from this week
        const logSnap = await getDocs(query(collection(db, "time_logs"), where("startTime", ">=", weekStartISO)));

        // 3. Aggregate Hours per User
        userHoursCache = {};
        logSnap.forEach(doc => {
            const log = doc.data();
            const uid = log.userId;
            if (!userHoursCache[uid]) userHoursCache[uid] = 0;

            if (log.endTime) {
                // Completed Shift
                const duration = (new Date(log.endTime) - new Date(log.startTime)) / 3600000;
                userHoursCache[uid] += duration;
            } else {
                // Active Shift (Add current live time)
                const currentDuration = (new Date() - new Date(log.startTime)) / 3600000;
                userHoursCache[uid] += currentDuration;
            }
        });

        renderUserTable(allUsersCache);
        if (countBadge) countBadge.textContent = allUsersCache.length;

    } catch (error) {
        console.error("Error loading users:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
}

function renderUserTable(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500">No matching team members found.</td></tr>';
        return;
    }

    users.forEach(user => {
        const statusColors = { 'Active': 'text-green-600', 'Laid Off': 'text-yellow-600', 'Terminated': 'text-red-600' };
        const status = user.status || 'Active';

        const photoHtml = user.photoUrl
            ? `<img src="${user.photoUrl}" class="w-10 h-10 rounded-full object-cover border">`
            : `<div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">${(user.name || 'U').charAt(0)}</div>`;

        // --- HOURS CALCULATION ---
        const hours = userHoursCache[user.uid] || 0; // Match logs by uid
        const limit = 50;
        // Cap percentage at 100 for the bar width
        const percentage = Math.min((hours / limit) * 100, 100);

        let barColor = 'bg-green-500';
        let textColor = 'text-green-700';

        if (hours >= 50) {
            barColor = 'bg-red-600';
            textColor = 'text-red-700 font-bold';
        } else if (hours >= 40) {
            barColor = 'bg-orange-500';
            textColor = 'text-orange-700 font-bold';
        }

        const hoursHtml = `
            <div class="w-full pr-4">
                <div class="flex justify-between text-xs mb-1">
                    <span class="${textColor}">${hours.toFixed(1)} hrs</span>
                    <span class="text-gray-400">/ 50</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="${barColor} h-2 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
        // -------------------------

        const row = `
            <tr class="bg-white border-b hover:bg-gray-50 transition-colors cursor-pointer" onclick="openEditUserModal('${user.id}')">
                <td class="px-6 py-3">
                    <div class="flex items-center gap-3">
                        ${photoHtml}
                        <div>
                            <div class="font-bold text-gray-900">${user.name || 'Unknown'}</div>
                            <div class="text-xs font-bold uppercase text-gray-500">${user.role || 'Crew'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-3 text-xs text-gray-600">
                    <div class="font-bold ${statusColors[status]}">${status}</div>
                    <div>${user.empType || 'Full Time'}</div>
                </td>
                <td class="px-6 py-3">
                    ${hoursHtml}
                </td>
                <td class="px-6 py-3 text-xs">
                    <div class="font-bold text-gray-800">${user.jobTitle || 'N/A'}</div>
                    <div class="text-gray-500">${user.phone || 'No Phone'}</div>
                </td>
                <td class="px-6 py-3 text-right">
                    <button class="text-blue-600 hover:underline text-xs font-bold">View Profile</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function filterUsers(searchTerm) {
    if (!searchTerm) { renderUserTable(allUsersCache); return; }
    const term = searchTerm.toLowerCase();
    const filtered = allUsersCache.filter(user =>
        (user.name || '').toLowerCase().includes(term) ||
        (user.email || '').toLowerCase().includes(term) ||
        (user.jobTitle || '').toLowerCase().includes(term) ||
        (user.training || '').toLowerCase().includes(term)
    );
    renderUserTable(filtered);
}

async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('edit-user-photo-preview');
        const placeholder = document.getElementById('edit-user-photo-placeholder');
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

window.openEditUserModal = async function (userId) {
    document.querySelector('.profile-tab-btn[data-target="tab-profile-info"]').click();

    const user = allUsersCache.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-user-name').value = user.name || '';
    document.getElementById('edit-user-email').value = user.email || '';
    document.getElementById('edit-user-phone').value = user.phone || '';
    document.getElementById('edit-user-address').value = user.address || '';
    document.getElementById('edit-user-job').value = user.jobTitle || '';
    document.getElementById('edit-user-wage').value = user.wage || '';
    document.getElementById('edit-user-role').value = user.role || 'laborer';
    document.getElementById('edit-user-status').value = user.status || 'Active';
    document.getElementById('edit-user-emp-type').value = user.empType || 'Full Time';
    document.getElementById('edit-user-training').value = user.training || '';
    document.getElementById('edit-user-infractions').value = user.infractions || '';
    document.getElementById('edit-user-notes').value = user.notes || '';

    const preview = document.getElementById('edit-user-photo-preview');
    const placeholder = document.getElementById('edit-user-photo-placeholder');
    if (user.photoUrl) {
        preview.src = user.photoUrl;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        preview.src = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    document.getElementById('edit-user-modal').classList.remove('hidden');
    renderUserMaps(user.address);
    loadWorkHistory(userId, user.wage);

    // --- PRIVACY PATROL ---
    const currentUser = window.currentUser; // Assumes currentUser is globally available from operations.html
    const wageInput = document.getElementById('edit-user-wage');
    const wageLabel = wageInput.previousElementSibling; // The label

    if (currentUser && currentUser.role === 'admin') {
        // Admin: Show and Enable
        wageInput.type = 'number';
        wageInput.parentElement.classList.remove('hidden');

        // --- GHOST MODE BUTTON ---
        let ghostBtn = document.getElementById('ghost-mode-btn');
        if (!ghostBtn) {
            ghostBtn = document.createElement('button');
            ghostBtn.id = 'ghost-mode-btn';
            ghostBtn.className = "mt-4 w-full bg-purple-600 text-white font-bold py-2 rounded hover:bg-purple-700";
            ghostBtn.textContent = "👻 Impersonate User (Ghost Mode)";
            document.getElementById('edit-user-modal').querySelector('.p-4.space-y-4').appendChild(ghostBtn);
        }
        // Remove old listeners (clone node trick or just overwrite onclick)
        ghostBtn.onclick = () => {
            if (confirm(`View the app as ${user.name}?`)) {
                sessionStorage.setItem('ghostModeUserId', userId);
                window.location.href = 'index.html';
            }
        };
        ghostBtn.classList.remove('hidden');

    } else {
        // Non-Admin: Hide completely
        wageInput.type = 'hidden';
        wageInput.parentElement.classList.add('hidden');
        const ghostBtn = document.getElementById('ghost-mode-btn');
        if (ghostBtn) ghostBtn.classList.add('hidden');
    }
};

function closeEditModal() {
    document.getElementById('edit-user-modal').classList.add('hidden');
}

function renderUserMaps(address) {
    if (!window.google || !window.google.maps || !address) {
        document.getElementById('employee-home-map').innerHTML = '<p class="text-xs text-center pt-10 text-gray-400">Map unavailable</p>';
        document.getElementById('employee-street-view').innerHTML = '';
        return;
    }

    if (!geocoder) geocoder = new google.maps.Geocoder();

    geocoder.geocode({ 'address': address }, (results, status) => {
        if (status == 'OK') {
            const location = results[0].geometry.location;

            if (!homeMap) {
                homeMap = new google.maps.Map(document.getElementById('employee-home-map'), {
                    zoom: 15, center: location, disableDefaultUI: true
                });
            } else {
                homeMap.setCenter(location);
                google.maps.event.trigger(homeMap, 'resize');
            }
            new google.maps.Marker({ map: homeMap, position: location });

            if (!streetView) {
                streetView = new google.maps.StreetViewPanorama(document.getElementById('employee-street-view'), {
                    position: location, pov: { heading: 34, pitch: 10 }, disableDefaultUI: true
                });
            } else {
                streetView.setPosition(location);
            }
        }
    });
}

async function loadWorkHistory(userId, wageInput) {
    const tbody = document.getElementById('user-work-history-body');
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Loading pay logs...</td></tr>';

    const wage = parseFloat(wageInput) || 0;
    const { db } = window.firebaseServices;

    try {
        const q = query(
            collection(db, "time_logs"),
            where("userId", "==", userId),
            orderBy("startTime", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No time logs found for this user.</td></tr>';
            return;
        }

        const weeklyData = {};
        snapshot.forEach(doc => {
            const log = doc.data();
            if (!log.startTime) return;

            const start = new Date(log.startTime);
            const day = start.getDay();
            const diff = start.getDate() - day + (day == 0 ? -6 : 1);
            const monday = new Date(start.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            const weekKey = monday.toLocaleDateString();

            if (!weeklyData[weekKey]) weeklyData[weekKey] = { logs: [], totalHours: 0 };

            let duration = 0;
            if (log.endTime) {
                duration = (new Date(log.endTime) - new Date(log.startTime)) / 3600000;
            } else {
                duration = (new Date() - new Date(log.startTime)) / 3600000; // Count live hours
            }

            weeklyData[weekKey].logs.push({ ...log, duration });
            weeklyData[weekKey].totalHours += duration;
        });

        let html = '';
        Object.keys(weeklyData).sort((a, b) => new Date(b) - new Date(a)).forEach(week => {
            const weekData = weeklyData[week];
            const grossPay = weekData.totalHours * wage;

            html += `
                <tr class="border-b bg-gray-50 font-semibold text-gray-700">
                    <td class="px-4 py-3">Week of ${week}</td>
                    <td class="px-4 py-3 text-center">${weekData.logs.length} Shifts</td>
                    <td class="px-4 py-3 text-right">${weekData.totalHours.toFixed(2)} hrs</td>
                    <td class="px-4 py-3 text-right text-green-600">$${grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="px-4 py-3 text-right">
                        <button class="text-xs text-blue-500 hover:underline" onclick="this.parentElement.parentElement.nextElementSibling.classList.toggle('hidden')">Details</button>
                    </td>
                </tr>
            `;

            let detailsHtml = '';
            weekData.logs.forEach(log => {
                const dateStr = new Date(log.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                const timeStr = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const endStr = log.endTime ? new Date(log.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active';

                detailsHtml += `
                    <tr class="bg-white border-b text-xs text-gray-600">
                        <td class="px-4 py-2 pl-8">${dateStr}</td>
                        <td colspan="2" class="px-4 py-2">${log.jobName || 'General'} (${timeStr} - ${endStr})</td>
                        <td class="px-4 py-2 text-right">${log.duration > 0 ? log.duration.toFixed(2) + ' hrs' : 'Live'}</td>
                        <td></td>
                    </tr>
                `;
            });

            html += `<tr class="hidden bg-gray-50"><td colspan="5"><table class="w-full">${detailsHtml}</table></td></tr>`;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error("Error loading payroll history:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
}

async function saveUserChanges() {
    const { db, storage } = window.firebaseServices;
    const userId = document.getElementById('edit-user-id').value;
    const btn = document.getElementById('save-edit-user-btn');
    const fileInput = document.getElementById('edit-user-photo-input');

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        let photoUrl = null;
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const storageRef = ref(storage, `user_photos/${userId}_${Date.now()}.jpg`);
            const snapshot = await uploadBytes(storageRef, file);
            photoUrl = await getDownloadURL(snapshot.ref);
        }

        const updates = {
            name: document.getElementById('edit-user-name').value,
            phone: document.getElementById('edit-user-phone').value,
            address: document.getElementById('edit-user-address').value,
            jobTitle: document.getElementById('edit-user-job').value,
            role: document.getElementById('edit-user-role').value,
            wage: document.getElementById('edit-user-wage').value,
            status: document.getElementById('edit-user-status').value,
            empType: document.getElementById('edit-user-emp-type').value,
            training: document.getElementById('edit-user-training').value,
            infractions: document.getElementById('edit-user-infractions').value,
            notes: document.getElementById('edit-user-notes').value
        };

        if (photoUrl) updates.photoUrl = photoUrl;

        await updateDoc(doc(db, "users", userId), updates);
        closeEditModal();
        loadUsers();
        alert("Profile saved!");

    } catch (error) {
        alert("Failed to save: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Changes";
    }
}

async function sendUserPasswordReset() {
    const email = document.getElementById('edit-user-email').value;
    const btn = document.getElementById('reset-password-btn');
    const { auth } = window.firebaseServices;
    if (!confirm(`Send a password reset email to ${email}?`)) return;
    try {
        await sendPasswordResetEmail(auth, email);
        alert(`Reset email sent.`);
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function createNewUser() {
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const confirmPass = document.getElementById('new-user-password-confirm').value;
    const btn = document.getElementById('create-user-btn');

    if (!name || !email || !password) return alert("Fill required fields.");
    if (password !== confirmPass) return alert("Passwords match error.");

    btn.disabled = true;
    btn.textContent = "Creating...";

    const secondaryApp = initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = getAuth(secondaryApp);
    const { db } = window.firebaseServices;

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
            uid: userCredential.user.uid,
            name, email,
            role: document.getElementById('new-user-role').value,
            wage: document.getElementById('new-user-wage').value,
            status: document.getElementById('new-user-status').value,
            empType: document.getElementById('new-user-emp-type').value,
            tenantId: 'citypave', // <--- ADD THIS LINE
            createdAt: new Date().toISOString()
        });
        alert("User created!");
        document.querySelectorAll('#view-users input').forEach(i => i.value = '');
        loadUsers();
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        await deleteApp(secondaryApp);
        btn.disabled = false;
        btn.textContent = "Create Profile";
    }
}

window.deleteUser = async function (userId) {
    if (!confirm("Delete this profile?")) return;
    const { db } = window.firebaseServices;
    try { await deleteDoc(doc(db, "users", userId)); loadUsers(); } catch (e) { alert(e.message); }
};