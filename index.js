// © 2025 City Pave. All Rights Reserved.
// This code is the confidential and proprietary property of City Pave.
// Unauthorized copying, distribution, or use of this code is strictly prohibited.
// Filename: index.js

import { collection, getDocs, where, query } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { config } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    // This interval checks until the Firebase database object (window.db) is ready.
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            initializeApp();
        }
    }, 100);
});

async function initializeApp() {
    const db = window.db;

    // --- Update Branding ---
    const header = document.querySelector('header');
    if (header) {
        const lightLogo = header.querySelector('.logo-light');
        const darkLogo = header.querySelector('.logo-dark');
        const title = header.querySelector('h1');
        if (lightLogo) lightLogo.src = config.logo_light;
        if (darkLogo) darkLogo.src = config.logo_dark;
        if (title) title.textContent = `Welcome to ${config.name} Tools`;
    }
    // --- End Branding Update ---

    let allEstimates = [];

    const openModalBtn = document.getElementById('open-sketch-modal-btn');
    const modal = document.getElementById('new-sketch-modal');
    const cancelModalBtn = document.getElementById('cancel-sketch-modal-btn');
    const newLeadBtn = document.getElementById('sketch-for-new-estimate-btn');
    const selectEstimate = document.getElementById('sketch-estimate-select');

    openModalBtn.addEventListener('click', async () => {
        console.log("Opening Sketch Modal...");
        try {
            const q = query(collection(db, "estimates"), where("status", "!=", "Template"));
            const snapshot = await getDocs(q);
            allEstimates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Loaded estimates:", allEstimates.length);
        } catch (e) {
            console.error("Error loading estimates:", e);
            alert("Error loading estimates. See console.");
        }

        selectEstimate.innerHTML = '<option value="">Select an existing estimate...</option>';
        allEstimates.sort((a, b) => (a.customerInfo.name || '').localeCompare(b.customerInfo.name || '')).forEach(est => {
            const option = document.createElement('option');
            option.value = est.id;
            option.textContent = est.customerInfo.name || 'Unnamed Estimate';
            selectEstimate.appendChild(option);
        });

        modal.classList.remove('hidden');
    });

    cancelModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    const sketchPage = 'modules/sketch/index.html';

    newLeadBtn.addEventListener('click', () => {
        window.location.href = sketchPage;
    });

    selectEstimate.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (selectedId) {
            const estimate = allEstimates.find(est => est.id === selectedId);
            const siteAddress = estimate?.customerInfo?.siteAddress;
            const customerAddress = estimate?.customerInfo?.address;
            const address = siteAddress || customerAddress || '';
            const encodedAddress = encodeURIComponent(address);
            window.location.href = `${sketchPage}?estimateId=${selectedId}&address=${encodedAddress}`;
        }
    });
}

