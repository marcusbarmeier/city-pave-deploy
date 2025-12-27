// © 2025 City Pave. All Rights Reserved.
// This code is the confidential and proprietary property of City Pave.
// Unauthorized copying, distribution, or use of this code is strictly prohibited.
// Filename: estimator.js

// --- UPDATED IMPORTS ---
import { getEstimateData, saveEstimate, saveQuickAdd, saveSiteVisit, getOptionData, fetchPricingLibrary } from './estimator-data.js';
import { generatePrintableEstimateHTML } from './outputGenerator.js';
import { handleAutoCalculateSnowPrice, handleRouteChange, applyAllSnowLocationsToOption } from '../snow_calc/snow-app.js';
import { updateSnowContractSummary } from '../snow_calc/snow-ui.js';
import * as ui from './estimator-ui.js';
import { setupEventListeners } from './estimator-events.js';
import { debounce, formatCurrency } from './estimator-utils.js';
// © 2025 City Pave. All Rights Reserved.
// Filename: estimator.js

import { State } from './estimator-state.js';
// We NO LONGER import pricingOptions from pricing.js


// --- CONSTANTS ---
// This must match the list in estimator-ui.js
const CATEGORIES = ["New Leads", "Ready for Review", "Planned Route (Un-confirmed)", "Site Visits", "Work Starting", "Active Customers", "Inactive Customers", "Follow-up", "Trucking"];

// --- APPLICATION STATE ---
// --- APPLICATION STATE ---
// Replaced by State module
// let allEstimates = []; -> State.getState().estimates
// let currentUserId = null; -> State.getState().currentUser
// let currentDashboardFilter = 'all'; -> State.getState().dashboardFilter
let signaturePad = null;
let witnessSignaturePad = null;
let autosaveInterval = null;
// historyStack, historyIndex, isApplyingHistory -> Moved to State
let addressAutocomplete = null;
let baUploadContext = null;
let deepLinkTarget = null;
// initialLoadComplete -> Moved to State
// lastSnowCalculationResult -> Moved to State
let currentUserId = null; // Declare currentUserId

// formatCurrency moved to estimator-utils.js

// --- INITIALIZATION ---
// REPLACE this function in estimator.js
// --- INITIALIZATION ---
export async function initializeEstimatorApp() {
    // 1. Brand Selector Logic
    const brandSelector = document.getElementById('brand-selector');
    if (brandSelector) {
        const currentMode = localStorage.getItem('app_brand_mode') || 'citypave';
        brandSelector.value = currentMode;
        brandSelector.addEventListener('change', (e) => {
            localStorage.setItem('app_brand_mode', e.target.value);
            location.reload();
        });
    }

    // 2. Load Pricing Library from Database (The Brain Transplant)
    // We store it globally so UI files can access it without importing
    // 3. Initialize Auth & Listeners
    const { auth, onAuthStateChanged, signInAnonymously, db, doc, getDoc } = window.firebaseServices;
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;

            // --- MOVED: Load Pricing Library (Requires Auth) ---
            try {
                const libraryData = await fetchPricingLibrary();
                if (libraryData) {
                    window.pricingData = libraryData; // Store globally
                    console.log("Pricing Library Loaded:", window.pricingData.options.length, "items");
                    if (window.pricingData.taxRate) window.GLOBAL_TAX_RATE = window.pricingData.taxRate;

                    // Refresh options UI since we loaded them late
                    const pricingContainer = document.getElementById('pricing-options-container');
                    if (pricingContainer && pricingContainer.children.length === 0) {
                        // Only add if empty, otherwise we might duplicate if re-auth happens
                        // Actually, loadEstimateForEditing handles this.
                        // But for a fresh "New Estimate", we might need to verify the dropdowns populate.
                        // We'll trust the flow for now.
                    }
                } else {
                    console.error("Failed to load pricing library.");
                    ui.showErrorBanner("Critical: Could not load pricing data.");
                }
            } catch (err) {
                console.error("Error during pricing init:", err);
            }
            // --------------------------------------------------

            // --- NEW: Load User & Tenant Data ---
            try {
                const userSnap = await getDoc(doc(db, "users", user.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    window.currentUser = userData; // Store globally

                    // Load Tenant Modules
                    if (userData.tenantId) {
                        const tenantSnap = await getDoc(doc(db, "tenants", userData.tenantId));
                        if (tenantSnap.exists()) {
                            window.currentUser.tenantModules = tenantSnap.data().modules || {};
                            console.log("Loaded Tenant Modules:", window.currentUser.tenantModules);
                        }
                    }
                }
            } catch (e) {
                console.error("Error loading user/tenant profile:", e);
            }
            // ------------------------------------

            listenForEstimates();
        } else {
            // Attempt Anonymous Sign-in
            console.log("No user found. Attempting anonymous sign-in...");
            await signInAnonymously(auth).catch(error => {
                console.error("Anonymous sign-in failed:", error);
                if (error.code === 'auth/admin-restricted-operation') {
                    ui.showErrorBanner("Guest access disabled.");

                    // --- MAGIC LOGIN BUTTON FOR MOBILE TESTING ---
                    const magicBtn = document.createElement('button');
                    magicBtn.innerText = "Tap to Login (Test User)";
                    magicBtn.style.position = 'fixed';
                    magicBtn.style.bottom = '20px';
                    magicBtn.style.left = '50%';
                    magicBtn.style.transform = 'translateX(-50%)';
                    magicBtn.style.zIndex = '9999';
                    magicBtn.style.padding = '15px 30px';
                    magicBtn.style.backgroundColor = '#2563EB'; // Blue-600
                    magicBtn.style.color = 'white';
                    magicBtn.style.fontWeight = 'bold';
                    magicBtn.style.borderRadius = '9999px';
                    magicBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    magicBtn.style.border = 'none';

                    magicBtn.onclick = async () => {
                        magicBtn.innerText = "Logging in...";
                        try {
                            const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js");
                            await signInWithEmailAndPassword(auth, "test@citypave.ca", "Password123!");
                            magicBtn.remove();
                            // Reload to pick up state clean
                            window.location.reload();
                        } catch (e) {
                            magicBtn.innerText = "Login Failed";
                            alert("Login Error: " + e.message);
                            console.error(e);
                        }
                    };

                    document.body.appendChild(magicBtn);
                    // ---------------------------------------------

                    // Optionally trigger sign-in modal if available
                    const signinBtn = document.querySelector('a[href*="signin"]');
                    if (signinBtn) signinBtn.click();
                } else {
                    ui.showErrorBanner("Authentication failed. Please reload.");
                }
            });
        }
    });

    // --- LOAD MORE LISTENER ---
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentLimit += 50;
            listenForEstimates();
        });
    }
    // --------------------------

    // 4. Setup UI Components
    initializeQuillEditors();
    initializeAddressAutocomplete();
    initializeEditorSignaturePads();
    ui.populateStatusDropdowns();
    setupEventListeners({
        ui,
        saveEstimate,
        allEstimates,
        undo,
        redo,
        applyDashboardFilter,
        handleCreateNewEstimate,
        handleFilterClick,
        handleDashboardCardClick,
        handleDashboardCardChange,
        handleStarRatingClick,
        handleSelectAll,
        saveQuickAdd,
        handleNewSketchFromEditor,
        handleSketchForExisting,
        handleDeleteConfirmation,
        saveSiteVisit,
        saveTags,
        batchUpdateCategory,
        handleWorkPhotoUpload,
        handleBeforeAfterUpload,
        handleSignedCopyUpload,
        handleRouteChange,
        saveContentToEstimate,
        saveContentAsDefault,
        handleEditorClicks,
        resizeAllPads,
        saveState,
        getEstimateDataForSave,
        getAppendixDefaultContent,
        signaturePad,
        witnessSignaturePad,
        debounce,
        onShowEditor,
        onHideEditor,
        initializeDragAndDrop
    });
    initializeTheme();
    ui.setupEditorTabs();

    // 5. Handle Deep Links (e.g. from Client Portal or Share Link)
    const urlParams = new URLSearchParams(window.location.search);
    const estimateIdFromUrl = urlParams.get('estimateId');
    const viewFromUrl = urlParams.get('view');
    const sectionFromUrl = urlParams.get('section');

    if (estimateIdFromUrl && viewFromUrl === 'editor') {
        deepLinkTarget = { id: estimateIdFromUrl, section: sectionFromUrl };
    } else {
        ui.showView('dashboard-view', onShowEditor, onHideEditor);
    }

    // 6. Update Header Logo
    const dashboardHeader = document.querySelector('#dashboard-view header');
    if (dashboardHeader && window.appConfig) {
        const lightLogo = dashboardHeader.querySelector('.logo-light');
        const darkLogo = dashboardHeader.querySelector('.logo-dark');
        if (lightLogo) lightLogo.src = window.appConfig.logo_light;
        if (darkLogo) darkLogo.src = window.appConfig.logo_dark;
    }
}

function initializeTheme() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if (toggle) toggle.checked = true;
    }
    if (toggle) toggle.addEventListener('change', (e) => {
        document.body.classList.toggle('dark-mode', e.target.checked);
        localStorage.setItem('theme', e.target.checked ? 'dark' : 'light');
    });
}

function initializeEditorSignaturePads() {
    const mainCanvas = document.getElementById('signature-pad');
    const witnessCanvas = document.getElementById('witness-signature-pad-editor');
    if (mainCanvas) signaturePad = new SignaturePad(mainCanvas, { backgroundColor: 'rgb(249, 250, 251)' });
    if (witnessCanvas) witnessSignaturePad = new SignaturePad(witnessCanvas, { backgroundColor: 'rgb(249, 250, 251)' });

    // --- FAT FINGER FIX: Zoom Mode ---
    const zoomBtn = document.getElementById('zoom-signature-btn');
    const zoomModal = document.getElementById('signature-zoom-modal');
    const zoomCanvas = document.getElementById('zoom-signature-pad');
    const closeZoomBtn = document.getElementById('close-zoom-signature-btn');
    const saveZoomBtn = document.getElementById('save-zoom-signature-btn');
    const clearZoomBtn = document.getElementById('clear-zoom-signature-btn');
    let zoomPad = null;

    if (zoomCanvas) {
        zoomPad = new SignaturePad(zoomCanvas, { backgroundColor: 'rgb(255, 255, 255)', minWidth: 2, maxWidth: 4 });

        // Resize observer to handle modal opening
        const resizeObserver = new ResizeObserver(() => {
            if (zoomCanvas.width !== zoomCanvas.offsetWidth || zoomCanvas.height !== zoomCanvas.offsetHeight) {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                zoomCanvas.width = zoomCanvas.offsetWidth * ratio;
                zoomCanvas.height = zoomCanvas.offsetHeight * ratio;
                zoomCanvas.getContext("2d").scale(ratio, ratio);
                if (zoomPad) zoomPad.clear(); // Unfortunately clears on resize, but better than distortion
            }
        });
        resizeObserver.observe(zoomCanvas.parentElement);
    }

    if (zoomBtn && zoomModal) {
        zoomBtn.addEventListener('click', () => {
            zoomModal.classList.remove('hidden');
            // Trigger resize manually once visible
            setTimeout(() => {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                zoomCanvas.width = zoomCanvas.offsetWidth * ratio;
                zoomCanvas.height = zoomCanvas.offsetHeight * ratio;
                zoomCanvas.getContext("2d").scale(ratio, ratio);
                zoomPad.clear();
                if (!signaturePad.isEmpty()) {
                    zoomPad.fromData(signaturePad.toData());
                }
            }, 100);
        });

        const closeZoom = () => zoomModal.classList.add('hidden');
        closeZoomBtn.addEventListener('click', closeZoom);

        clearZoomBtn.addEventListener('click', () => zoomPad.clear());

        saveZoomBtn.addEventListener('click', () => {
            if (zoomPad.isEmpty()) {
                signaturePad.clear();
            } else {
                signaturePad.fromData(zoomPad.toData());
            }
            closeZoom();
        });
    }
}

function initializeQuillEditors() {
    const editorsToInit = {
        'manual-scope-editor': [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }]],
        'auto-scope-editor': [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }]],
        'contact-description-editor': [['bold', 'underline'], [{ 'list': 'bullet' }]],
        'appendix-editor': [['bold', 'italic', 'underline'], [{ 'header': [1, 2, false] }], [{ 'list': 'ordered' }, { 'list': 'bullet' }]],
        'terms-editor': [['bold', 'italic', 'underline'], [{ 'header': [1, 2, false] }], [{ 'list': 'ordered' }, { 'list': 'bullet' }]]
    };
    for (const id in editorsToInit) {
        if (document.getElementById(id)) {
            const quill = new Quill(`#${id}`, { modules: { toolbar: editorsToInit[id] }, theme: 'snow' });
            ui.setQuillInstance(id.replace('-editor', ''), quill);
            quill.on('text-change', debounce(saveState, 500));
        }
    }
}

function initializeAddressAutocomplete() {
    const checkApi = setInterval(() => {
        if (window.google?.maps?.places) {
            clearInterval(checkApi);
            const addressInput = document.getElementById('customer-address');
            if (addressInput && !addressAutocomplete) {
                addressAutocomplete = new google.maps.places.Autocomplete(addressInput, { types: ['address'], componentRestrictions: { country: 'ca' } });
            }
        }
    }, 100);
}



function getGPSLocation(file) {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith('image/')) {
            resolve(null);
            return;
        }
        EXIF.getData(file, function () {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef");
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
            if (lat && lon && latRef && lonRef) {
                const toDecimal = (number) => number.length === 3 ? number[0].valueOf() + (number[1].valueOf() / 60) + (number[2].valueOf() / 3600) : 0;
                let latitude = toDecimal(lat);
                let longitude = toDecimal(lon);
                if (latRef === "S") latitude = -latitude;
                if (lonRef === "W") longitude = -longitude;
                resolve({ lat: latitude, lng: longitude });
            } else {
                resolve(null);
            }
        });
    });
}

// FIND AND CUT THIS FUNCTION from estimator.js
async function handleSignedCopyUpload(e) {
    const file = e.target.files[0];
    if (!file) return; // Exit if no file was selected

    const estimateId = document.getElementById('editing-estimate-id').value;
    if (!estimateId) {
        ui.showErrorBanner("Please save the estimate before uploading a signed document.");
        e.target.value = ''; // Clear the input
        return;
    }

    const { storage, ref, uploadBytes, getDownloadURL, db, doc, updateDoc } = window.firebaseServices;

    ui.showSuccessBanner("Uploading document...", true); // Show persistent uploading message

    try {
        // 1. Create a unique file path in Firebase Storage
        const fileRef = ref(storage, `estimates/${estimateId}/signed_copies/signed_copy_${Date.now()}_${file.name}`);

        // 2. Upload the file
        const snapshot = await uploadBytes(fileRef, file);

        // 3. Get the download URL for the uploaded file
        const url = await getDownloadURL(snapshot.ref);

        // 4. Update the Firestore document with the URL
        await updateDoc(doc(db, 'estimates', estimateId), {
            'acceptance.signedCopyURL': url // Store the URL in the acceptance object
        });

        // 5. Update local state
        const estimate = allEstimates.find(est => est.id === estimateId);
        if (estimate) {
            if (!estimate.acceptance) estimate.acceptance = {}; // Ensure acceptance object exists
            estimate.acceptance.signedCopyURL = url;
        }

        // 6. Update the UI to show the link and remove button
        const signedCopyContainer = document.getElementById('signed-copy-link-container');
        if (signedCopyContainer) {
            signedCopyContainer.innerHTML = `
                <a href="${url}" target="_blank" class="text-green-600 font-semibold hover:underline">View Uploaded Document</a>
                <button type="button" class="remove-signed-copy-btn text-xs text-red-500 hover:underline ml-2 no-print">(Remove)</button>`;
            // Re-attach the event listener for the new remove button
            signedCopyContainer.querySelector('.remove-signed-copy-btn').onclick = () => handleSignedCopyDelete(); // Make sure handleSignedCopyDelete is defined before this runs
        }

        saveState(); // Save the state change for undo/redo
        ui.showSuccessBanner("Signed document uploaded successfully.");

    } catch (error) {
        console.error("Error uploading signed copy:", error);
        ui.showErrorBanner(`Upload failed: ${error.message}`);
    } finally {
        // Clear the file input regardless of success or failure
        e.target.value = '';
    }
}

// REPLACE this function in estimator.js
// REPLACE THIS ENTIRE FUNCTION in estimator.js
// REPLACE THIS ENTIRE FUNCTION in estimator.js
// --- CHUNK 1: LISTENERS ---
// setupEventListeners moved to estimator-events.js
async function handleWorkPhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const estimateId = document.getElementById('editing-estimate-id').value;
    if (!estimateId) {
        ui.showErrorBanner("Please save estimate before uploading photos.");
        return;
    }
    const { storage, ref, uploadBytes, getDownloadURL, db, doc, updateDoc, getDoc } = window.firebaseServices; // Added getDoc
    ui.showSuccessBanner("Uploading photo...", true);
    try {
        const fileRef = ref(storage, `estimates/${estimateId}/work-photos/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(snapshot.ref);

        const estimateRef = doc(db, 'estimates', estimateId);
        const estimateSnap = await getDoc(estimateRef); // Fetch current data
        const currentData = estimateSnap.exists() ? estimateSnap.data() : {};
        const currentPhotos = currentData.workPhotos || []; // Get current array or empty array

        await updateDoc(estimateRef, {
            workPhotos: [...currentPhotos, { url, description: '' }] // Use spread syntax
        });

        // --- Update local state if needed ---
        const localEstimate = allEstimates.find(est => est.id === estimateId);
        if (localEstimate) {
            localEstimate.workPhotos = [...(localEstimate.workPhotos || []), { url, description: '' }];
            // Ensure renderWorkPhotos exists and handlePhotoDelete is defined in this scope or passed correctly
            if (typeof ui.renderWorkPhotos === 'function' && typeof handlePhotoDelete === 'function') {
                ui.renderWorkPhotos(localEstimate.workPhotos, handlePhotoDelete); // Re-render UI
            } else {
                console.warn("renderWorkPhotos or handlePhotoDelete not available to update UI immediately.");
            }
        }

        ui.showSuccessBanner("Photo uploaded successfully.");
    } catch (error) {
        console.error("Error uploading work photo:", error);
        ui.showErrorBanner(`Upload failed: ${error.message}`);
    } finally {
        e.target.value = ''; // Clear the input
    }
}

// NEW MASTER FUNCTION TO CONTROL ROUTE VS INDIVIDUAL CALCULATIONS
// REPLACE this function in estimator.js
// REPLACE this function in estimator.js
// REPLACE this function in estimator.js
// REPLACE this function in estimator.js
// Snow Route & Calculation handlers moved to modules/snow_calc/snow-app.js
function handleCreateNewEstimate() {
    ui.resetEditorForm(getAppendixDefaultContent, saveState, signaturePad, witnessSignaturePad, resizeAllPads);
    State.setState({ historyStack: [], historyIndex: -1 });
    const { historyIndex, historyStack } = State.getState();
    ui.updateUndoRedoButtons(historyIndex, historyStack.length);
    saveState();
    ui.showView('editor-view', onShowEditor, onHideEditor);
}

function handleFilterClick(e) {
    if (e.target.matches('.dashboard-filter-button')) {
        if (e.target.matches('.dashboard-filter-button')) {
            const newFilter = e.target.dataset.filter;
            State.setDashboardFilter(newFilter);
            document.querySelectorAll('.dashboard-filter-button').forEach(btn => btn.classList.remove('active-filter'));
            e.target.classList.add('active-filter');
            applyDashboardFilter();
        }
    }
}

// REPLACE this function in estimator.js
// REPLACE this function in estimator.js
function handleDashboardCardClick(e) {
    const target = e.target;
    const card = target.closest('.estimate-card');
    if (!card) return;
    const estimateId = card.dataset.id;
    if (target.closest('.card-category-btn')) {
        ui.openTagModal([estimateId], allEstimates); // Pass ID in an array
    } else if (target.closest('.add-visit-dashboard-btn')) {
        ui.openSiteVisitModal(estimateId, allEstimates);
    } else if (target.closest('.delete-visit-dashboard-btn')) {
        handleSiteVisitAction(e, estimateId);
    } else if (target.closest('.complete-visit-dashboard-btn')) {
        handleCompleteVisit(e, estimateId);
    } else if (target.closest('h3.font-bold')) {
        // Prepare parameters needed by loadEstimateForEditing
        const params = {
            estimateId,
            allEstimates,
            signaturePad,
            witnessSignaturePad,
            resizeCanvasForPad: resizeAllPads,
            saveState,
            getAppendixDefaultContent,
            handleRevokeAcceptance,
            handleSignedCopyDelete,
            handleShareEstimate: openShareLinkModal,
            saveAsTemplate,
            softDeleteEstimate,
            restoreEstimate,
            handlePhotoDelete,
            handleSiteVisitAction,
            applySketchDataToEstimate,
            handleSketchDelete,
            handlePrint,
            promptAction: (action, id, ids) => ui.promptAction(action, id, ids, allEstimates),
            updateSnowContractSummary: updateSnowContractSummary,
            handleDeleteSnowRouteMap: handleDeleteSnowRouteMap,
            handleSketchDuplicate: handleSketchDuplicate // <-- THIS IS THE NEW LINE WE ARE ADDING
        };
        // Load the estimate and switch view
        ui.loadEstimateForEditing(params);
        ui.showView('editor-view', onShowEditor, onHideEditor);
    }
}

// REPLACE THIS ENTIRE FUNCTION in estimator.js
// REPLACE THIS ENTIRE FUNCTION in estimator.js
function handleEditorClicks(e) {
    const target = e.target;

    // --- THIS IS THE FIX ---
    // If the click is on a color picker or a checkbox,
    // let the browser do its default action (like opening the picker)
    // and STOP this function immediately.
    if (target.matches('input[type="color"]') || target.matches('input[type="checkbox"]')) {
        return;
    }
    // --- END OF FIX ---

    // Find all the custom buttons and links we DO care about
    const closestButton = target.closest('button');
    const closestLink = target.closest('a');
    const closestH3 = target.closest('h3.font-bold');
    const closestCategoryBtn = target.closest('.card-category-btn');
    const isSnowRouteButton = target.id === 'edit-snow-route-map-btn' || target.id === 'edit-saved-route-map-btn';
    const isOtherSnowButton = target.closest('.calculate-snow-price-btn, .apply-snow-summary-btn, .delete-snow-location-btn, .load-from-sketch-btn-single');

    // If the click was not on any of our known interactive elements, stop the function.
    if (!closestButton && !closestLink && !closestH3 && !closestCategoryBtn && !isSnowRouteButton && !isOtherSnowButton) {
        return;
    }

    // Handle Before & After "Edit on Map" button
    if (target.id === 'edit-ba-map-btn') {
        // ... (rest of the BA map logic remains the same)
        const estimateId = document.getElementById('editing-estimate-id').value;
        const estimate = allEstimates.find(est => est.id === estimateId);
        if (estimate) {
            const markers = [];
            (estimate.beforeAndAfter || []).forEach(pair => {
                (pair.beforePhotos || []).forEach((photo, index) => { if (photo.location) markers.push({ id: `${pair.id}_before_${index}`, lat: photo.location.lat, lng: photo.location.lng, title: `Before #${index + 1}` }); });
                (pair.afterPhotos || []).forEach((photo, index) => { if (photo.location) markers.push({ id: `${pair.id}_after_${index}`, lat: photo.location.lat, lng: photo.location.lng, title: `After #${index + 1}` }); });
            });
            if (markers.length > 0) {
                const markersJson = JSON.stringify(markers);
                const siteAddress = document.getElementById('site-address').value;
                const customerAddress = document.getElementById('customer-address').value;
                const addressForMap = siteAddress || customerAddress || estimate.customerInfo?.address;
                window.location.href = `sketch.html?estimateId=${estimateId}&baMap=true&markers=${encodeURIComponent(markersJson)}&address=${encodeURIComponent(addressForMap)}`;
            } else { ui.showErrorBanner("No photos with GPS locations were found to edit."); }
        }
        return;
    }

    // --- UPDATED SNOW ROUTE MAP BUTTON LOGIC ---
    if (isSnowRouteButton) {
        // ... (rest of the snow route logic remains the same)
        const estimateId = document.getElementById('editing-estimate-id').value;
        if (!estimateId) return ui.showErrorBanner("Please save the estimate before creating/editing a route.");
        ui.showSuccessBanner("Generating route data...", true);
        try {
            const locationsForMap = [];
            const allCards = document.querySelectorAll('.snow-location-card');
            allCards.forEach(card => {
                const getVal = (selector) => card.querySelector(selector)?.value || '';
                const getNum = (selector) => parseFloat(card.querySelector(selector)?.value) || 0;
                const address = getVal('.snow-location-address'); if (!address || address.trim() === '') return;
                const breakdownText = card.querySelector('.snow-calculation-details')?.textContent || '';
                const equipmentMatch = breakdownText.match(/Calculated Fleet:\s*(.*?)(?=\s*Volume\/Event:|\s*Cost \/ Push:|\s*$)/i);
                const timeMatch = breakdownText.match(/(?:On-Site Time|Billable Time):\s*([\d.]+)\s*hrs/i);
                locationsForMap.push({
                    id: card.dataset.locationId, address: address, title: getVal('.snow-location-title') || 'Unnamed Location',
                    pricePerPush: getNum('.snow-price-per-push'), priceMonthly: getNum('.snow-price-monthly'), priceSeasonal: getNum('.snow-price-seasonal'),
                    timeToComplete: timeMatch ? parseFloat(timeMatch[1]) : 0, clearingTrigger: getVal('.snow-clearing-trigger'), equipmentInfo: equipmentMatch ? equipmentMatch[1].trim() : 'N/A',
                    sourceSketchId: card.dataset.sourceSketchId || null
                });
            });
            if (locationsForMap.length < 2) return ui.showErrorBanner("Please add at least two snow locations with valid addresses to create/edit the route.");
            if (locationsForMap.some(loc => !loc.address || loc.address.trim() === '')) return ui.showErrorBanner("Please ensure all snow locations have a valid address before creating/editing the map.");
            const locationsParam = encodeURIComponent(JSON.stringify(locationsForMap));
            window.location.href = `sketch.html?estimateId=${estimateId}&snowRoute=true&locations=${locationsParam}`;
        } catch (error) { console.error("Error preparing snow route data:", error); ui.showErrorBanner(`Could not generate route data: ${error.message}`); }
        return;
    }
    // --- END UPDATED SNOW ROUTE MAP BUTTON LOGIC ---

    // --- OTHER SNOW BUTTONS LOGIC ---
    const calculatePriceBtn = target.closest('.calculate-snow-price-btn');
    if (calculatePriceBtn) {
        // ... (rest of calculate price logic)
        const card = calculatePriceBtn.closest('.snow-location-card');
        handleAutoCalculateSnowPrice(card, true);
        return;
    }

    const applySummaryBtn = target.closest('.apply-snow-summary-btn');
    if (applySummaryBtn) {
        // ... (rest of apply summary logic)
        const costType = applySummaryBtn.dataset.costType;
        applyAllSnowLocationsToOption(costType);
        return;
    }

    const deleteSnowLocationBtn = target.closest('.delete-snow-location-btn');
    if (deleteSnowLocationBtn) {
        // ... (rest of delete snow location logic)
        if (confirm('Are you sure you want to remove this snow location?')) {
            const card = deleteSnowLocationBtn.closest('.snow-location-card');
            if (card) { card.remove(); handleRouteChange(); }
        }
        return;
    }

    const loadFromSketchBtn = target.closest('.load-from-sketch-btn-single');
    if (loadFromSketchBtn) {
        // ... (rest of load from sketch logic)
        const card = loadFromSketchBtn.closest('.snow-location-card');
        const estimateId = document.getElementById('editing-estimate-id').value;
        const estimate = allEstimates.find(e => e.id === estimateId);
        if (estimate && estimate.sketches && estimate.sketches.length > 0) {
            ui.openSketchSelectionModal(estimate.sketches, (selectedSketch) => {
                if (selectedSketch && card) {
                    let totalLoaderArea = 0, totalSkidSteerArea = 0, totalShovelArea = 0;
                    (selectedSketch.measurements || []).forEach(m => { /* ... area calculation ... */
                        if (m.measurementType === 'area') {
                            if (m.service === 'snow-area-loader') totalLoaderArea += (m.measurement || 0);
                            else if (m.service === 'snow-area-skidsteer') totalSkidSteerArea += (m.measurement || 0);
                            else if (m.service === 'snow-area-shovel') totalShovelArea += (m.measurement || 0);
                        }
                    });
                    const loaderInput = card.querySelector('.snow-loader-area'); if (loaderInput) loaderInput.value = totalLoaderArea > 0 ? totalLoaderArea.toFixed(2) : '';
                    const skidSteerInput = card.querySelector('.snow-skidsteer-area'); if (skidSteerInput) skidSteerInput.value = totalSkidSteerArea > 0 ? totalSkidSteerArea.toFixed(2) : '';
                    const shovelInput = card.querySelector('.snow-shovel-area'); if (shovelInput) shovelInput.value = totalShovelArea > 0 ? totalShovelArea.toFixed(2) : '';
                    const addressInput = card.querySelector('.snow-location-address'); if (addressInput && selectedSketch.clientAddress) addressInput.value = selectedSketch.clientAddress;
                    card.dataset.sourceSketchId = selectedSketch.id;
                    ui.showSuccessBanner('Snow areas loaded from sketch.');
                    handleAutoCalculateSnowPrice(card, true);
                }
            });
        } else { ui.showErrorBanner('No sketches found for this estimate to load from.'); }
        return;
    }
    // --- END OTHER SNOW BUTTONS LOGIC ---

    // --- YOUR ORIGINAL LOGIC FOR OTHER EDITOR BUTTONS ---
    const addBtn = target.closest('.add-item-btn');
    const deleteItemBtn = target.closest('.delete-item-button');
    const deleteOptionBtn = target.closest('.delete-option-btn');
    const copyOptionBtn = target.closest('.copy-option-btn'); // <-- This is the button we're interested in

    if (target.id === 'add-pricing-option-btn') {
        ui.addPricingOption(null, saveState);
    } else if (target.id === 'add-before-after-btn') {
        ui.addBeforeAfterPair(null, saveState, handlePhotoDelete);
    } else if (target.id === 'populate-scope-btn') {
        ui.populateScopeOfWork(saveState);
    } else if (addBtn) {
        const optionId = addBtn.closest('.price-option-card')?.dataset.optionId;
        if (optionId) ui.addItemToOption(optionId, null, false, saveState);
    } else if (target.id === 'add-item-sketch') {
        ui.addItemToOption('sketch-card', null, false, saveState);
    } else if (target.id === 'add-item-change-order') {
        ui.addItemToOption('change-order-card', null, false, saveState);
    } else if (deleteItemBtn) {
        if (confirm('Are you sure you want to remove this line item?')) {
            deleteItemBtn.closest('.line-item-container').remove();
            ui.calculateAllTotals(saveState);
            saveState();
        }
    } else if (deleteOptionBtn) {
        if (confirm('Are you sure you want to remove this entire pricing option?')) {
            deleteOptionBtn.closest('.price-option-card').remove();
            ui.calculateAllTotals(saveState);
            saveState();
        }
    } else if (copyOptionBtn) {
        // --- ADD LOGGING ---
        console.log("Copy Option button clicked!");
        const currentCard = copyOptionBtn.closest('.price-option-card');
        if (currentCard) {
            console.log("Found current card with ID:", currentCard.id, "and dataset ID:", currentCard.dataset.optionId);
            copyDynamicOption(currentCard, saveState); // Call the copy function
        } else {
            console.error("Could not find parent .price-option-card for copy button.");
        }
        // --- END LOGGING ---
    } else if (target.classList.contains('add-ba-photo-btn')) {
        const pairId = target.dataset.pairId;
        const type = target.dataset.type;
        baUploadContext = { pairId, type };
        document.getElementById('before-after-photo-input').click();
    }
    // --- END YOUR ORIGINAL LOGIC ---
}

// Handles uploading media (photos/videos) for the Before & After section
async function handleBeforeAfterUpload(e) {
    // Check if the upload context (pair ID and type 'before'/'after') was set
    if (!baUploadContext) {
        console.warn("Before/After upload context is missing.");
        e.target.value = ''; // Clear input
        return;
    }

    const { type, pairId } = baUploadContext; // Destructure context
    const files = Array.from(e.target.files); // Get selected files as an array

    if (files.length === 0) {
        baUploadContext = null; // Clear context
        e.target.value = ''; // Clear input
        return; // Exit if no files selected
    }

    const estimateId = document.getElementById('editing-estimate-id').value;
    if (!estimateId) {
        ui.showErrorBanner("Please save the estimate before uploading media.");
        baUploadContext = null; // Clear context
        e.target.value = ''; // Clear input
        return;
    }

    // Get Firebase services
    const { storage, ref, uploadBytes, getDownloadURL, db, doc, updateDoc, getDoc } = window.firebaseServices;

    ui.showSuccessBanner(`Uploading ${files.length} file(s) for ${type}...`, true);

    try {
        // Create an array of promises for each file upload
        const uploadPromises = files.map(async (file) => {
            // Attempt to get GPS location (only relevant for images)
            const location = await getGPSLocation(file);
            // Create a unique storage reference
            const fileRef = ref(storage, `estimates/${estimateId}/before-after/${pairId}_${type}_${Date.now()}_${file.name}`);
            // Upload the file
            const snapshot = await uploadBytes(fileRef, file);
            // Get the download URL
            const url = await getDownloadURL(snapshot.ref);
            // Determine file type
            const fileType = file.type.startsWith('video/') ? 'video' : 'image';
            // Return the media object
            return { url, type: fileType, location };
        });

        // Wait for all uploads to complete
        const newMediaObjects = await Promise.all(uploadPromises);

        // Fetch the latest estimate data before updating
        const estimateRef = doc(db, 'estimates', estimateId);
        const estimateSnap = await getDoc(estimateRef);
        if (!estimateSnap.exists()) {
            throw new Error("Estimate document not found in Firestore.");
        }
        const estimateData = estimateSnap.data();

        // Find or create the target Before/After pair in the data
        let currentPairs = JSON.parse(JSON.stringify(estimateData.beforeAndAfter || [])); // Deep copy
        let pairToUpdate = currentPairs.find(p => p.id === pairId);

        // If the pair doesn't exist in the data (might happen if UI added it but wasn't saved yet)
        if (!pairToUpdate) {
            const pairDiv = document.querySelector(`.before-after-pair[data-pair-id="${pairId}"]`);
            if (pairDiv) {
                // Try to get info from the UI elements as a fallback
                const title = pairDiv.querySelector('.ba-title-input')?.value || 'New Showcase';
                const allQuillInstances = ui.getQuillInstance(); // Get all quill instances
                const description = allQuillInstances[pairId] ? allQuillInstances[pairId].root.innerHTML : '';
                const newPair = { id: pairId, title, description, beforePhotos: [], afterPhotos: [] };
                currentPairs.push(newPair);
                pairToUpdate = newPair;
            } else {
                // If we can't find it in UI either, we have to bail
                throw new Error(`Could not find Before & After pair with ID: ${pairId} in data or UI.`);
            }
        }

        // Add the newly uploaded media objects to the correct array (before or after)
        if (type === 'before') {
            pairToUpdate.beforePhotos = [...(pairToUpdate.beforePhotos || []), ...newMediaObjects];
        } else {
            pairToUpdate.afterPhotos = [...(pairToUpdate.afterPhotos || []), ...newMediaObjects];
        }

        // Update the 'beforeAndAfter' array in Firestore
        await updateDoc(estimateRef, { beforeAndAfter: currentPairs });

        // Update the local estimate object
        const localEstimate = allEstimates.find(est => est.id === estimateId);
        if (localEstimate) {
            localEstimate.beforeAndAfter = currentPairs;
        }

        // Re-render the Before & After section in the UI
        ui.renderBeforeAndAfter(currentPairs, saveState, handlePhotoDelete);

        saveState(); // Save the state change for undo/redo
        ui.showSuccessBanner("Upload complete!");

    } catch (error) {
        console.error("Error uploading Before & After media:", error);
        ui.showErrorBanner(`An error occurred during upload: ${error.message}`);
    } finally {
        // Clear context and file input regardless of outcome
        baUploadContext = null;
        e.target.value = '';
    }
}

function handleNewSketchFromEditor() {
    const estimateId = document.getElementById('editing-estimate-id').value;
    if (estimateId) {
        const siteAddress = document.getElementById('site-address').value;
        const customerAddress = document.getElementById('customer-address').value;
        const address = siteAddress || customerAddress;
        window.location.href = `sketch.html?estimateId=${estimateId}&address=${encodeURIComponent(address)}`;
    } else {
        ui.showErrorBanner("Please save this estimate before adding a sketch.");
    }
}

function handleSketchForExisting(e) {
    const selectedId = e.target.value;
    if (selectedId) {
        const estimate = allEstimates.find(est => est.id === selectedId);
        const siteAddress = estimate?.customerInfo?.siteAddress;
        const customerAddress = estimate?.customerInfo?.address;
        const address = siteAddress || customerAddress || '';
        window.location.href = `sketch.html?estimateId=${selectedId}&address=${encodeURIComponent(address)}`;
    }
}

// Captures the current state of the editor for undo/redo
function saveState() {
    const { isApplyingHistory, historyStack, historyIndex } = State.getState();
    // Prevent saving state while loading or applying history to avoid loops
    if (isApplyingHistory || window.isLoading) {
        return;
    }

    // Get the complete current data from the form
    let currentStateData;
    try {
        // We use getEstimateDataForSave as it's designed to capture everything
        currentStateData = getEstimateDataForSave();
    } catch (error) {
        console.error("Error getting data for saveState:", error);
        // Don't proceed if we can't even get the current state
        return;
    }

    // Convert the data object to a string for comparison and storage
    const currentStateString = JSON.stringify(currentStateData);

    // Don't save if the state hasn't actually changed since the last save
    if (historyStack.length > 0 && historyStack[historyStack.length - 1] === currentStateString) {
        return;
    }

    // Add the new state to the history via State manager
    State.pushHistory(currentStateString);

    // Update the enabled/disabled status of the Undo/Redo buttons
    const newState = State.getState();
    ui.updateUndoRedoButtons(newState.historyIndex, newState.historyStack.length);
}

function applyState(stateDataString) {
    // Set flag to prevent saveState from triggering during this update
    isApplyingHistory = true;

    try {
        // Parse the JSON string back into an estimate data object
        const data = JSON.parse(stateDataString);

        // Get the ID (either from the saved data or the current editor input)
        const estimateId = data.id || document.getElementById('editing-estimate-id').value;

        if (!estimateId) {
            console.error("Cannot apply state: Estimate ID is missing.");
            return;
        }

        // Create a temporary estimate object matching what loadEstimateForEditing expects
        const tempEstimate = { id: estimateId, ...data };

        // Update the estimate in the main 'allEstimates' array via State
        // Note: applyState logic in estimator.js was mutating allEstimates directly.
        // We should use State.updateEstimate or State.addEstimate.
        // However, applyState is about the *editor* state. The *saved* state in Firestore/allEstimates might be different.
        // But for the purpose of the app, we usually want the global state to reflect what's in the editor if we consider it "current".
        // Actually, undo/redo usually just updates the EDITOR form. It doesn't necessarily save to DB yet.
        // But the original code updated `allEstimates`. Let's stick to that pattern but use State.

        const currentEstimates = State.getState().estimates;
        const existingIndex = currentEstimates.findIndex(e => e.id === estimateId);
        if (existingIndex > -1) {
            State.updateEstimate(tempEstimate);
        } else {
            State.addEstimate(tempEstimate);
        }

        // Get updated estimates
        const allEstimates = State.getState().estimates;

        // Prepare the parameters needed by loadEstimateForEditing
        const params = {
            estimateId: estimateId,
            allEstimates: allEstimates, // Pass the updated array
            signaturePad: signaturePad,
            witnessSignaturePad: witnessSignaturePad,
            resizeCanvasForPad: resizeAllPads,
            saveState: saveState, // Pass the saveState function itself
            getAppendixDefaultContent: getAppendixDefaultContent,
            handleRevokeAcceptance: handleRevokeAcceptance,
            handleSignedCopyDelete: handleSignedCopyDelete,
            handleShareEstimate: openShareLinkModal,
            saveAsTemplate: saveAsTemplate,
            softDeleteEstimate: softDeleteEstimate,
            restoreEstimate: restoreEstimate,
            handlePhotoDelete: handlePhotoDelete,
            handleSiteVisitAction: handleSiteVisitAction,
            applySketchDataToEstimate: applySketchDataToEstimate,
            handleSketchDelete: handleSketchDelete,
            handlePrint: handlePrint,
            promptAction: (action, id, ids) => ui.promptAction(action, id, ids, allEstimates), // <<< Comma added here
            updateSnowContractSummary: updateSnowContractSummary // **** THIS LINE WAS ADDED ****
        };

        // Use the existing UI function to repopulate the entire form
        ui.loadEstimateForEditing(params);

        // Crucial: Recalculate totals after loading the state (Done inside loadEstimateForEditing now)
        // ui.calculateAllTotals(saveState);
        // updateSnowContractSummary(); // Call is inside loadEstimateForEditing

        // Optional: Log success
        // console.log("State applied successfully.");

    } catch (e) {
        console.error("Failed to parse or apply state:", e);
        ui.showErrorBanner("Error applying undo/redo state.");
    } finally {
        // Always clear the flag, even if there was an error
        isApplyingHistory = false;
    }
}

function undo() {
    const previousState = State.undo();
    if (previousState) {
        applyState(previousState);
        const { historyIndex, historyStack } = State.getState();
        ui.updateUndoRedoButtons(historyIndex, historyStack.length);
    }
}

function redo() {
    const nextState = State.redo();
    if (nextState) {
        applyState(nextState);
        const { historyIndex, historyStack } = State.getState();
        ui.updateUndoRedoButtons(historyIndex, historyStack.length);
    }
}

// REPLACE THIS ENTIRE FUNCTION in estimator.js
// REPLACE THIS ENTIRE FUNCTION in estimator.js
let estimatesUnsubscribe = null;
let currentLimit = 50;

function listenForEstimates() {
    const { db, collection, onSnapshot, query, orderBy, limit } = window.firebaseServices;

    if (estimatesUnsubscribe) {
        estimatesUnsubscribe();
    }

    // Listen for real-time updates with pagination
    // We order by 'lastSaved' descending to show newest first
    const q = query(collection(db, "estimates"), orderBy("lastSaved", "desc"), limit(currentLimit));

    estimatesUnsubscribe = onSnapshot(q,
        (snapshot) => {
            // Map the documents from the snapshot to an array of estimate objects
            const estimates = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            State.setEstimates(estimates);

            // Manage Load More Button
            const loadMoreContainer = document.getElementById('load-more-container');
            if (loadMoreContainer) {
                if (snapshot.docs.length < currentLimit) {
                    loadMoreContainer.classList.add('hidden'); // End of list
                } else {
                    loadMoreContainer.classList.remove('hidden');
                }
            }

            // Get latest state
            const { initialLoadComplete, estimates: allEstimates } = State.getState();

            let openedDeepLink = false;

            // Handle deep linking on the *first* load
            if (!initialLoadComplete && deepLinkTarget) {
                const estimateToLoad = allEstimates.find(e => e.id === deepLinkTarget.id);
                if (estimateToLoad) {
                    // Prepare parameters needed by loadEstimateForEditing
                    const params = {
                        estimateId: deepLinkTarget.id,
                        allEstimates,
                        signaturePad,
                        witnessSignaturePad,
                        resizeCanvasForPad: resizeAllPads,
                        saveState,
                        getAppendixDefaultContent,
                        handleRevokeAcceptance,
                        handleSignedCopyDelete,
                        handleShareEstimate: openShareLinkModal,
                        saveAsTemplate,
                        softDeleteEstimate,
                        restoreEstimate,
                        handlePhotoDelete,
                        handleSiteVisitAction,
                        applySketchDataToEstimate,
                        handleSketchDelete,
                        handlePrint,
                        promptAction: (action, id, ids) => ui.promptAction(action, id, ids, allEstimates),
                        updateSnowContractSummary: updateSnowContractSummary,
                        handleDeleteSnowRouteMap: handleDeleteSnowRouteMap,
                        handleSketchDuplicate: handleSketchDuplicate
                    };

                    // Load the specific estimate into the editor
                    ui.loadEstimateForEditing(params);
                    // Switch the view to the editor
                    ui.showView('editor-view', onShowEditor, onHideEditor);
                    openedDeepLink = true;

                    // Try to scroll to the specified section after a short delay
                    setTimeout(() => {
                        if (deepLinkTarget && deepLinkTarget.section) {
                            let elementId;
                            if (deepLinkTarget.section === 'before-after') {
                                elementId = 'print-section-before-after';
                            } else if (deepLinkTarget.section === 'sketches') {
                                elementId = 'print-section-sketches';
                            } else if (deepLinkTarget.section === 'snow-routes' || deepLinkTarget.section === 'snow') {
                                elementId = 'multi-site-snow-section';
                            }

                            const element = document.getElementById(elementId);
                            if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                        deepLinkTarget = null; // Clear deep link target after attempting scroll
                    }, 500);

                } else {
                    ui.showErrorBanner(`Deep link error: Could not find estimate with ID: ${deepLinkTarget.id}`);
                    deepLinkTarget = null; // Clear invalid target
                    // Show dashboard as fallback if deep link failed
                    if (document.getElementById('dashboard-view').classList.contains('active')) {
                        applyDashboardFilter();
                    }
                }
            }

            // If we didn't open a deep link, and the dashboard is the active view, refresh the dashboard list
            if (!openedDeepLink && document.getElementById('dashboard-view').classList.contains('active')) {
                applyDashboardFilter();
            }

            // Update template dropdowns whenever estimates change
            ui.populateTemplateDropdown(allEstimates);

            // Mark initial load as complete
            State.setState({ initialLoadComplete: true });

            // Clear deep link target if it wasn't used or already handled
            if (deepLinkTarget && !openedDeepLink) {
                deepLinkTarget = null;
            }

        },
        (error) => {
            // Handle errors during listening
            console.error("Error listening for estimates:", error);
            ui.showErrorBanner("Could not fetch estimates. Check connection and Firestore rules.");
        }
    );
}

// Filters the allEstimates array and updates the dashboard UI
// --- CHUNK 2: DASHBOARD & ROUTE LOGIC ---

function applyDashboardFilter() {
    const { estimates: allEstimates, dashboardFilter: currentDashboardFilter } = State.getState();
    let list = [];

    // Define what counts as "Parked"
    const isParked = (e) => ['Deferred (Next Season)', 'Inactive', 'Declined'].includes(e.status);

    if (currentDashboardFilter === 'templates') {
        list = allEstimates.filter(e => e.status === 'Template');
    }
    else if (currentDashboardFilter === 'deleted') {
        list = allEstimates.filter(e => e.isDeleted === true);
    }
    else if (currentDashboardFilter === 'parked') {
        // NEW VIEW: Only show the hidden/parked items
        list = allEstimates.filter(e => !e.isDeleted && isParked(e));
    }
    else if (currentDashboardFilter === 'all') {
        // CLEANER ALL VIEW: Hide parked items from "All" to reduce clutter
        // (Unless you want "All" to literally mean everything, remove the !isParked check)
        list = allEstimates.filter(e => e.status !== 'Template' && !e.isDeleted && !isParked(e));
    }
    else {
        // STANDARD COLUMNS: Only match tags AND ensure they aren't parked
        list = allEstimates.filter(e =>
            e.status !== 'Template' &&
            !e.isDeleted &&
            !isParked(e) && // Crucial: Don't show parked items in "New Leads" etc.
            e.tags?.includes(currentDashboardFilter)
        );
    }

    const term = document.getElementById('dashboard-search-input').value.toLowerCase();
    if (term) {
        // If searching, search EVERYTHING (including parked) so you can find them
        list = allEstimates.filter(e =>
            e.status !== 'Template' &&
            !e.isDeleted &&
            JSON.stringify(e).toLowerCase().includes(term)
        );
    }

    list.sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));

    ui.renderDashboard(
        list,
        currentDashboardFilter,
        getSelectedIds,
        planRoute,
        (ids) => ui.openCategoryModal(ids, allEstimates),
        (action, id, ids) => ui.promptAction(action, id, ids, allEstimates)
    );

    ui.renderSalesSchedule(allEstimates);
}

function handleSelectAll(e) {
    document.querySelectorAll('.item-select-checkbox').forEach(cb => cb.checked = e.target.checked);
    const { estimates: allEstimates, dashboardFilter: currentDashboardFilter } = State.getState();
    // Pass allEstimates explicitly to the UI function
    ui.updateBatchActionBar(
        currentDashboardFilter,
        getSelectedIds,
        planRoute,
        (ids) => ui.openCategoryModal(ids, allEstimates),
        (action, id, ids) => ui.promptAction(action, id, ids, allEstimates),
        (ids) => ui.openRoutePlannerModal(ids, allEstimates)
    );
}

function handleDashboardCardChange(e) {
    if (e.target.classList.contains('item-select-checkbox')) {
        const { estimates: allEstimates, dashboardFilter: currentDashboardFilter } = State.getState();
        // Pass allEstimates explicitly
        ui.updateBatchActionBar(
            currentDashboardFilter,
            getSelectedIds,
            planRoute,
            (ids) => ui.openCategoryModal(ids, allEstimates),
            (action, id, ids) => ui.promptAction(action, id, ids, allEstimates),
            (ids) => ui.openRoutePlannerModal(ids, allEstimates)
        );
    } else if (e.target.classList.contains('dashboard-status-select')) {
        handleDashboardStatusChange(e.target.dataset.id, e.target.value);
    } else if (e.target.classList.contains('visit-date-input') || e.target.classList.contains('visit-time-input')) {
        handleDashboardVisitChange(e);
    }
}

function onShowEditor() {
    if (!autosaveInterval) {
        autosaveInterval = setInterval(() => saveEstimate(getEstimateDataForSave, true), 30000);
    }
    resizeAllPads();
}

function onHideEditor() {
    if (autosaveInterval) {
        clearInterval(autosaveInterval);
        autosaveInterval = null;
    }
}

// Gathers all current editor data for saving or state management.
// It relies on the main getEstimateData function.
function getEstimateDataForSave() {
    // Call the main data gathering function, passing the necessary dependencies
    return getEstimateData(ui.getQuillInstance(), signaturePad, witnessSignaturePad);
}

// Provides the default HTML content for the Appendix section
function getAppendixDefaultContent() {
    // You can customize this HTML string with your standard process overview
    return `<h3>Our Project Process: A Simple Overview</h3>
            <p><strong>1. Preparation & Excavation:</strong> Site is prepared, and existing materials may be removed. Excavation to the required depth occurs if necessary.</p>
            <p><strong>2. Base Installation:</strong> Geotextile fabric may be laid, followed by the placement and compaction of granular base material to ensure a stable foundation.</p>
            <p><strong>3. Paving/Installation:</strong> Asphalt or concrete is placed, graded, and finished according to the specifications.</p>
            <p><strong>4. Cleanup:</strong> The work area is cleaned of debris upon completion.</p>
            <p><em>(Note: Specific steps may vary based on the project scope.)</em></p>`;
}

function resizeAllPads() {
    const resizeCanvasForPad = (canvas, pad) => {
        if (!canvas || !pad || canvas.offsetWidth === 0) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const data = pad.toData();
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        pad.clear();
        pad.fromData(data);
    };
    resizeCanvasForPad(document.getElementById('signature-pad'), signaturePad);
    resizeCanvasForPad(document.getElementById('witness-signature-pad-editor'), witnessSignaturePad);
}

// Handles the 'Confirm' button click in the generic confirmation modal
// REPLACE THIS ENTIRE FUNCTION in estimator.js
function handleDeleteConfirmation(e) {
    const button = e.target; // The confirm button itself
    const { action, id, ids } = button.dataset; // Get action and IDs stored on the button

    // Determine the list of IDs to process
    // If 'ids' dataset exists (comma-separated), split it; otherwise, use the single 'id' if it exists
    const idList = ids ? ids.split(',') : (id ? [id] : []);

    // Perform the action based on the 'data-action' attribute
    switch (action) {
        case 'deletePermanent':
            // Call permanent delete for a single ID
            if (id) deleteFirestoreDoc(id);
            break;
        case 'duplicate':
            // Call duplicate for a single ID
            if (id) duplicateEstimate(id);
            break;
        case 'batchDelete':
            // Call permanent delete for each ID in the list
            idList.forEach(deleteFirestoreDoc);
            break;
        case 'batchSoftDelete':
            // Call soft delete for each ID in the list
            idList.forEach(softDeleteEstimate);
            break;
        case 'batchRestore':
            // Call restore for each ID in the list
            idList.forEach(restoreEstimate);
            break;

        // --- NEW CASES ADDED HERE ---
        case 'saveAppendixToAll':
            // Call the new function to update all estimates' appendix
            updateAllEstimatesContent('appendix');
            break;
        case 'saveTermsToAll':
            // Call the new function to update all estimates' terms
            updateAllEstimatesContent('terms');
            break;
        // --- END OF NEW CASES ---

        default:
            console.warn("Unknown action in handleDeleteConfirmation:", action);
            break;
    }

    // Hide the modal after processing the action
    ui.hideDeleteModal();
}

// Permanently deletes an estimate document from Firestore
async function deleteFirestoreDoc(estimateId) {
    if (!estimateId) {
        console.warn("Attempted to delete without an estimate ID.");
        return; // Don't proceed without an ID
    }

    const { db, doc, deleteDoc } = window.firebaseServices;

    try {
        ui.showSuccessBanner(`Permanently deleting item ${estimateId}...`, true);

        // Delete the document from the 'estimates' collection
        await deleteDoc(doc(db, "estimates", estimateId));

        // --- Remove from local state ---
        // --- Remove from local state ---
        const allEstimates = State.getState().estimates;
        const index = allEstimates.findIndex(e => e.id === estimateId);
        if (index > -1) {
            const newEstimates = [...allEstimates];
            newEstimates.splice(index, 1);
            State.setEstimates(newEstimates);
        }
        // -----------------------------
        // -----------------------------

        // Refresh the dashboard filter (likely the 'Deleted' view)
        if (document.getElementById('dashboard-view').classList.contains('active')) {
            applyDashboardFilter();
        }

        ui.showSuccessBanner(`Item ${estimateId} permanently deleted.`);

    } catch (error) {
        console.error(`Error permanently deleting estimate ${estimateId}:`, error);
        ui.showErrorBanner(`Could not permanently delete item: ${error.message}`);
    }
}

// Creates a copy of an existing estimate document in Firestore
async function duplicateEstimate(estimateId) {
    if (!estimateId) {
        console.warn("Attempted to duplicate without an estimate ID.");
        return; // Don't proceed without an ID
    }

    const { db, collection, addDoc } = window.firebaseServices;

    // 1. Find the original estimate data in the local array
    const originalEstimate = State.getState().estimates.find(e => e.id === estimateId);
    if (!originalEstimate) {
        ui.showErrorBanner("Could not find the original estimate data to duplicate.");
        return;
    }

    try {
        ui.showSuccessBanner("Duplicating estimate...", true);

        // 2. Create a deep copy to avoid modifying the original
        let duplicatedData = JSON.parse(JSON.stringify(originalEstimate));

        // 3. Modify key fields for the new copy
        delete duplicatedData.id; // Remove original ID, Firestore will generate a new one
        duplicatedData.customerInfo = duplicatedData.customerInfo || {}; // Ensure customerInfo exists
        duplicatedData.customerInfo.name = `${originalEstimate.customerInfo?.name || 'Estimate'} (Copy)`; // Append (Copy) to name
        duplicatedData.createdAt = new Date().toISOString(); // Set new creation date
        duplicatedData.lastSaved = new Date().toISOString(); // Set new last saved date
        duplicatedData.status = 'Draft'; // Reset status to Draft
        duplicatedData.isDeleted = false; // Ensure it's not marked as deleted

        // Clear fields that shouldn't carry over to a fresh copy
        delete duplicatedData.acceptance;
        delete duplicatedData.customerNotes;
        delete duplicatedData.siteVisits; // Or maybe keep them? Decide based on workflow.
        delete duplicatedData.workStages;  // Or maybe keep them? Decide based on workflow.
        // Keep sketches, BA, work photos? Assume yes for now unless specified otherwise.

        // 4. Save the modified data as a new document
        await addDoc(collection(db, 'estimates'), duplicatedData);

        // Note: The new estimate will appear on the dashboard automatically 
        // when the Firestore listener updates 'allEstimates'.

        ui.showSuccessBanner("Estimate duplicated successfully.");

    } catch (error) {
        console.error(`Error duplicating estimate ${estimateId}:`, error);
        ui.showErrorBanner(`Could not duplicate estimate: ${error.message}`);
    }
}

// Updates the status and potentially tags when a status dropdown is changed on the dashboard
async function handleDashboardStatusChange(estimateId, newStatus) {
    if (!estimateId || !newStatus) {
        console.warn("Missing estimateId or newStatus for status change.");
        return;
    }

    const { db, doc, updateDoc } = window.firebaseServices;

    try {
        // Find the estimate in local data to get its current state
        const estimateData = allEstimates.find(e => e.id === estimateId);
        if (!estimateData) {
            ui.showErrorBanner("Could not find estimate data to update status.");
            return;
        }

        // Determine the new tags based on the status change
        // Pass a copy of the estimate data with the new status applied
        const updatedDataWithTags = updateTagsBasedOnData({ ...estimateData, status: newStatus });
        const newTags = updatedDataWithTags.tags; // Get the recalculated tags

        // Prepare the update payload for Firestore
        const updatePayload = {
            status: newStatus,
            tags: newTags, // Update tags along with status
            lastSaved: new Date().toISOString() // Update lastSaved timestamp
        };

        // Update the document in Firestore
        const estimateRef = doc(db, 'estimates', estimateId);
        await updateDoc(estimateRef, updatePayload);

        // Update the local estimate object to match
        if (estimateData) {
            estimateData.status = newStatus;
            estimateData.tags = newTags;
            estimateData.lastSaved = updatePayload.lastSaved;
        }

        // Refresh the dashboard filter to potentially move the card
        if (document.getElementById('dashboard-view').classList.contains('active')) {
            applyDashboardFilter();
        }

        ui.showSuccessBanner('Status updated successfully.');

    } catch (e) {
        console.error("Error updating estimate status from dashboard:", e);
        ui.showErrorBanner(`Could not update status: ${e.message}`);
        // Optional: Revert dropdown change on error? Or rely on next Firestore sync.
    }
}

// Updates a site visit's date or time directly from the dashboard card
async function handleDashboardVisitChange(e) {
    const { db, doc, updateDoc } = window.firebaseServices;

    // Get estimateId and visitIndex from the input that changed
    const { estimateId, visitIndex } = e.target.dataset;
    const index = parseInt(visitIndex, 10); // Ensure index is a number

    // Basic validation
    if (!estimateId || isNaN(index)) {
        console.warn("Missing estimateId or visitIndex for dashboard visit change.");
        return;
    }

    // Find the estimate in local data
    const estimate = allEstimates.find(est => est.id === estimateId);
    if (!estimate || !estimate.siteVisits || index < 0 || index >= estimate.siteVisits.length) {
        ui.showErrorBanner("Could not find the visit data to update.");
        return;
    }

    // Create a copy of the visits array to modify
    let updatedVisits = JSON.parse(JSON.stringify(estimate.siteVisits)); // Deep copy is safest

    // Update the specific visit's date or time based on which input changed
    if (e.target.classList.contains('visit-date-input')) {
        updatedVisits[index].date = e.target.value;
    } else if (e.target.classList.contains('visit-time-input')) {
        updatedVisits[index].time = e.target.value;
    } else {
        return; // Exit if the event wasn't from a recognized input
    }

    try {
        // Update the document in Firestore
        await updateDoc(doc(db, 'estimates', estimateId), {
            siteVisits: updatedVisits,
            lastSaved: new Date().toISOString() // Update lastSaved timestamp
        });

        // Update the local estimate object
        estimate.siteVisits = updatedVisits;
        estimate.lastSaved = new Date().toISOString();

        ui.showSuccessBanner('Visit details updated.');
        // No need to refresh the whole dashboard, the change is already reflected in the input

    } catch (error) {
        console.error("Error updating visit from dashboard:", error);
        ui.showErrorBanner(`Could not update visit: ${error.message}`);
        // Optional: Revert the input field value on error?
        // e.target.value = estimate.siteVisits[index][e.target.classList.contains('visit-date-input') ? 'date' : 'time']; 
    }
}

// Revokes the digital acceptance signatures for the current estimate
async function handleRevokeAcceptance() {
    const estimateId = document.getElementById('editing-estimate-id').value;

    // Confirm the action with the user
    if (!estimateId || !confirm("Are you sure you want to revoke this acceptance? This will clear the signatures and acceptance date.")) {
        return; // Exit if no ID or user cancels
    }

    const { db, doc, updateDoc } = window.firebaseServices;

    try {
        ui.showSuccessBanner("Revoking acceptance...", true);

        // Prepare the update payload to clear acceptance fields
        const updatePayload = {
            acceptance: {
                // Keep potentially uploaded signed copy URL, but clear digital signatures
                signedCopyURL: allEstimates.find(e => e.id === estimateId)?.acceptance?.signedCopyURL || null,
                signatureDataURL: null,
                witnessSignatureDataURL: null,
                acceptanceDate: '', // Clear the date
                printedName: '',    // Clear names
                witnessPrintedName: ''
            },
            status: 'Sent' // Revert status to 'Sent' (or 'Draft' if preferred)
        };

        // Update the document in Firestore
        await updateDoc(doc(db, 'estimates', estimateId), updatePayload);

        // --- Update local state ---
        const estimate = allEstimates.find(e => e.id === estimateId);
        if (estimate) {
            estimate.acceptance = updatePayload.acceptance;
            estimate.status = updatePayload.status;
        }
        // ------------------------

        // --- Update UI ---
        // Hide the signed view and show the signature pads
        document.getElementById('signature-pad-wrapper').classList.remove('hidden');
        document.getElementById('signed-view-wrapper').classList.add('hidden');

        // Clear the actual signature pads
        if (signaturePad) signaturePad.clear();
        if (witnessSignaturePad) witnessSignaturePad.clear();

        // Clear related input fields in the UI
        const printNameInput = document.getElementById('editor-print-name');
        const witnessPrintNameInput = document.getElementById('editor-witness-print-name');
        const acceptanceDateInput = document.getElementById('acceptance-date');
        if (printNameInput) printNameInput.value = '';
        if (witnessPrintNameInput) witnessPrintNameInput.value = '';
        if (acceptanceDateInput) acceptanceDateInput.value = '';

        // Update the status dropdown in the editor UI
        const statusDropdown = document.getElementById('estimate-status');
        if (statusDropdown) statusDropdown.value = 'Sent';
        // -----------------

        saveState(); // Save the change for undo/redo
        ui.showSuccessBanner('Acceptance has been revoked.');

    } catch (error) {
        console.error("Error revoking acceptance:", error);
        ui.showErrorBanner(`Could not revoke acceptance: ${error.message}`);
    }
}

// Deletes the uploaded signed copy file and clears the link in Firestore
async function handleSignedCopyDelete() {
    const estimateId = document.getElementById('editing-estimate-id').value;

    // Confirm the action
    if (!estimateId || !confirm("Are you sure you want to permanently delete the uploaded signed document? This cannot be undone.")) {
        return;
    }

    const { storage, ref, deleteObject, db, doc, updateDoc } = window.firebaseServices;

    // Find the estimate in local data
    const estimate = allEstimates.find(e => e.id === estimateId);
    const signedCopyURL = estimate?.acceptance?.signedCopyURL;

    // Check if there's actually a URL to delete
    if (!signedCopyURL) {
        ui.showErrorBanner("No uploaded signed document found to delete.");
        return;
    }

    try {
        ui.showSuccessBanner("Deleting document...", true);

        // 1. Delete the file from Firebase Storage using its URL
        const fileRef = ref(storage, signedCopyURL);
        await deleteObject(fileRef);

        // 2. Update the Firestore document to remove the URL reference
        await updateDoc(doc(db, 'estimates', estimateId), {
            'acceptance.signedCopyURL': null // Set the field to null
        });

        // 3. Update the local estimate object
        if (estimate && estimate.acceptance) {
            estimate.acceptance.signedCopyURL = null;
        }

        // 4. Update the UI to show no document is uploaded
        const signedCopyContainer = document.getElementById('signed-copy-link-container');
        if (signedCopyContainer) {
            signedCopyContainer.innerHTML = '<p class="text-xs text-gray-500">No document uploaded.</p>';
        }

        saveState(); // Save the change for undo/redo
        ui.showSuccessBanner('Uploaded signed document deleted successfully.');

    } catch (error) {
        console.error("Error deleting signed copy:", error);
        // Handle case where file is already gone from storage
        if (error.code === 'storage/object-not-found') {
            ui.showErrorBanner("File already deleted from storage. Updating estimate record...");
            try {
                // Still update Firestore to remove the broken link
                await updateDoc(doc(db, 'estimates', estimateId), {
                    'acceptance.signedCopyURL': null
                });
                // Update local state and UI
                if (estimate && estimate.acceptance) estimate.acceptance.signedCopyURL = null;
                const signedCopyContainer = document.getElementById('signed-copy-link-container');
                if (signedCopyContainer) signedCopyContainer.innerHTML = '<p class="text-xs text-gray-500">No document uploaded.</p>';
                saveState(); // Save state even if storage deletion failed initially
            } catch (dbError) {
                ui.showErrorBanner("Could not update the estimate record after storage error.");
            }
        } else {
            // Handle other errors
            ui.showErrorBanner(`Could not delete the document: ${error.message}`);
        }
    }
}

// Opens the modal to manage the shareable link for an estimate
async function openShareLinkModal(estimateId) {
    // Get necessary Firebase services
    const { db, collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc, onSnapshot } = window.firebaseServices;

    // Get references to modal elements
    const modal = document.getElementById('share-link-modal');
    const content = document.getElementById('share-modal-content');
    const loader = document.getElementById('share-modal-loader');
    const statusEl = document.getElementById('share-link-status');
    const linkInput = document.getElementById('share-link-input');
    const toggleBtn = document.getElementById('toggle-link-active-btn');
    const copyBtn = document.getElementById('copy-share-link-btn');
    const closeBtn = document.getElementById('close-share-modal-btn');
    const historyContainer = document.getElementById('view-history-container');
    let unsubscribeHistory = null; // To store the history listener

    // Show modal and loader, hide content initially
    modal.classList.remove('hidden');
    content.classList.add('hidden');
    loader.classList.remove('hidden');
    loader.innerHTML = '<p>Loading link information...</p>'; // Reset loader text
    historyContainer.innerHTML = '<p class="text-gray-500">Loading view history...</p>'; // Initial history message

    // Clean up previous listeners if the modal is reused
    toggleBtn.onclick = null;
    copyBtn.onclick = null;
    closeBtn.onclick = null;

    try {
        // Query Firestore for an existing link with this estimateId
        const linksCollection = collection(db, 'sharedLinks');
        const q = query(linksCollection, where("estimateId", "==", estimateId));
        const linkSnap = await getDocs(q);
        let linkDocRef;
        let token;
        let linkData;

        // If no link exists, create a new one
        if (linkSnap.empty) {
            token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            linkData = {
                estimateId,
                token,
                isActive: true, // Default to active
                createdAt: new Date()
            };
            // Add the new link document to Firestore
            const newLinkDoc = await addDoc(linksCollection, linkData);
            linkDocRef = newLinkDoc; // Get the reference to the new document
            console.log("Created new share link.");
        } else {
            // If a link exists, use its data and reference
            linkDocRef = linkSnap.docs[0].ref;
            linkData = linkSnap.docs[0].data();
            token = linkData.token;
            console.log("Found existing share link.");
        }

        // Construct the full shareable URL
        const fullLink = `${window.location.origin}/client-portal.html?token=${token}`;
        linkInput.value = fullLink;

        // --- Helper function to update the UI based on link status ---
        const updateUI = (currentLinkData) => {
            if (!currentLinkData) return; // Add safety check
            if (currentLinkData.isActive) {
                statusEl.textContent = 'Active';
                statusEl.className = 'text-xs font-bold py-1 px-3 rounded-full bg-green-100 text-green-800';
                toggleBtn.textContent = 'Deactivate Link';
                toggleBtn.className = 'rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700';
            } else {
                statusEl.textContent = 'Inactive';
                statusEl.className = 'text-xs font-bold py-1 px-3 rounded-full bg-gray-200 text-gray-800';
                toggleBtn.textContent = 'Activate Link';
                toggleBtn.className = 'rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700';
            }
        };

        // --- Helper function to render view history ---
        const renderViewHistory = (views) => {
            historyContainer.innerHTML = ''; // Clear previous content
            if (!views || views.length === 0) {
                historyContainer.innerHTML = '<p class="text-gray-500">No views recorded yet.</p>';
                return;
            }
            // Sort views by timestamp, newest first
            views.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
            views.forEach(view => {
                const viewEl = document.createElement('div');
                viewEl.className = 'p-2 bg-gray-50 rounded-md border text-xs mb-2';
                const date = new Date(view.timestamp.seconds * 1000).toLocaleString();

                // Identity Info
                let identityHtml = '';
                if (view.viewerEmail) {
                    identityHtml = `<p class="font-bold text-blue-600">${view.viewerName || 'Unknown Name'} (${view.viewerEmail})</p>`;
                } else {
                    identityHtml = `<p class="font-semibold text-gray-600">Anonymous / Unverified</p>`;
                }

                // Basic referrer parsing
                let referrerInfo = 'Accessed directly or via private channel';
                if (view.referrer && !view.referrer.startsWith(window.location.origin) && view.referrer !== "Direct link") {
                    try {
                        const url = new URL(view.referrer);
                        referrerInfo = `Referred from ${url.hostname}`;
                    } catch {
                        referrerInfo = `Referred from ${view.referrer}`;
                    }
                }
                viewEl.innerHTML = `${identityHtml}<p class="text-gray-500">${date}</p><p class="text-gray-400 italic">${referrerInfo}</p>`;
                historyContainer.appendChild(viewEl);
            });
        };

        // --- Set up real-time listener for view history ---
        const viewsCollection = collection(linkDocRef, 'linkViews');
        // Make sure to unsubscribe from any previous listener if modal is reused
        if (unsubscribeHistory) unsubscribeHistory();
        unsubscribeHistory = onSnapshot(viewsCollection, (snapshot) => {
            const views = snapshot.docs.map(doc => doc.data());
            renderViewHistory(views);
        }, (error) => {
            console.error("Error listening to view history:", error);
            historyContainer.innerHTML = '<p class="text-red-500 text-xs">Could not load view history.</p>';
        });

        // --- Set up button actions ---
        toggleBtn.onclick = async () => {
            toggleBtn.disabled = true; // Prevent double-clicks
            try {
                // Fetch the latest state before toggling
                const currentDoc = await getDoc(linkDocRef);
                const currentState = currentDoc.data().isActive;
                await updateDoc(linkDocRef, { isActive: !currentState });
                updateUI({ isActive: !currentState }); // Update UI immediately
            } catch (error) {
                console.error("Error toggling link status:", error);
                ui.showErrorBanner("Could not update link status.");
            } finally {
                toggleBtn.disabled = false;
            }
        };

        copyBtn.onclick = () => {
            navigator.clipboard.writeText(fullLink).then(() => {
                ui.showSuccessBanner("Link copied to clipboard!");
            }, (err) => {
                console.error('Failed to copy link: ', err);
                ui.showErrorBanner("Could not copy link. Check browser permissions.");
            });
        };

        closeBtn.onclick = () => {
            modal.classList.add('hidden');
            // Unsubscribe from history listener when closing modal
            if (unsubscribeHistory) {
                unsubscribeHistory();
                unsubscribeHistory = null;
            }
        };

        // Update UI with initial state and show content
        updateUI(linkData);
        loader.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (error) {
        console.error("Error opening share link modal:", error);
        loader.innerHTML = `<p class="text-red-600 font-semibold">Error loading link: ${error.message}</p>`;
        // Add a close button even on error
        const errorCloseBtn = document.createElement('button');
        errorCloseBtn.textContent = 'Close';
        errorCloseBtn.className = 'mt-4 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300';
        errorCloseBtn.onclick = () => {
            modal.classList.add('hidden');
            // Ensure listener is cleaned up on error close too
            if (unsubscribeHistory) {
                unsubscribeHistory();
                unsubscribeHistory = null;
            }
        };
        loader.appendChild(errorCloseBtn);
    }
}

// Saves the current estimate's structure as a new template
async function saveAsTemplate() {
    // 1. Prompt user for a name for the template
    const templateName = prompt("Enter a name for this template:");
    if (!templateName || templateName.trim() === "") {
        // User cancelled or entered an empty name
        return;
    }

    const { db, collection, addDoc } = window.firebaseServices;

    try {
        ui.showSuccessBanner("Saving as template...", true);

        // 2. Get the current estimate data
        let templateData = getEstimateDataForSave();

        // 3. Create a clean copy to modify
        let newTemplate = JSON.parse(JSON.stringify(templateData));

        // 4. Modify the data to make it a template
        delete newTemplate.id; // Remove original ID, Firestore will generate a new one
        delete newTemplate.customerInfo; // Remove specific customer details
        delete newTemplate.acceptance; // Clear any acceptance signatures/dates
        delete newTemplate.customerNotes; // Clear customer notes
        delete newTemplate.siteVisits; // Clear specific site visits
        delete newTemplate.workStages; // Clear specific work stages
        delete newTemplate.sketches; // Clear specific sketches
        delete newTemplate.beforeAndAfter; // Clear specific BA pairs
        delete newTemplate.workPhotos; // Clear specific work photos
        delete newTemplate.propertyPhotoURL; // Clear property photo
        delete newTemplate.contactHistory; // Clear specific contact history
        delete newTemplate.leadRating; // Clear lead rating
        delete newTemplate.sharingOptions; // Clear specific sharing options
        delete newTemplate.snowLocations; // Clear specific snow locations
        delete newTemplate.snowRouteOrder; // Clear specific snow route order
        delete newTemplate.createdAt; // Remove original creation date
        delete newTemplate.lastSaved; // Remove last saved date
        delete newTemplate.isDeleted; // Ensure template isn't marked as deleted

        // Clear financial summary fields that are customer-specific
        if (newTemplate.financialSummary) {
            const fieldsToKeep = ['interestRate']; // Keep defaults like interest rate
            for (const key in newTemplate.financialSummary) {
                if (!fieldsToKeep.includes(key)) {
                    newTemplate.financialSummary[key] = ''; // Clear other values
                }
            }
        }

        // Set the status and template name
        newTemplate.status = 'Template';
        newTemplate.templateName = templateName.trim();
        newTemplate.tags = []; // Templates generally don't need pipeline tags

        // 5. Save the modified data as a new document
        await addDoc(collection(db, 'estimates'), newTemplate);

        ui.showSuccessBanner(`Template "${templateName.trim()}" saved successfully.`);
        // Note: No saveState() call here, as saving a template doesn't change the current estimate

    } catch (error) {
        console.error("Error saving template:", error);
        ui.showErrorBanner(`Could not save the template: ${error.message}`);
    }
}

// Marks an estimate as deleted (soft delete)
async function softDeleteEstimate(estimateId) {
    // Confirm with the user
    if (!estimateId || !confirm("Are you sure you want to move this estimate to the Deleted tab?")) {
        return; // Exit if no ID or user cancels
    }

    const { db, doc, updateDoc } = window.firebaseServices;

    try {
        ui.showSuccessBanner("Moving estimate to Deleted...", true);

        // Update the document in Firestore, setting the isDeleted flag to true
        await updateDoc(doc(db, 'estimates', estimateId), {
            isDeleted: true,
            lastSaved: new Date().toISOString() // Update lastSaved timestamp
        });

        // --- Update local state ---
        const estimate = State.getState().estimates.find(e => e.id === estimateId);
        if (estimate) {
            estimate.isDeleted = true;
            estimate.lastSaved = new Date().toISOString();
            State.updateEstimate(estimate);
        }
        // ------------------------

        // If the deleted estimate was open in the editor, switch back to the dashboard
        if (document.getElementById('editor-view').classList.contains('active') && document.getElementById('editing-estimate-id').value === estimateId) {
            ui.showView('dashboard-view', onShowEditor, onHideEditor); // Go back to dashboard
        } else if (document.getElementById('dashboard-view').classList.contains('active')) {
            // Otherwise, just refresh the dashboard filter to remove the item from the current view (unless viewing 'Deleted')
            applyDashboardFilter();
        }

        ui.showSuccessBanner("Estimate moved to Deleted successfully.");
        // No saveState() needed as this action primarily happens on the dashboard

    } catch (error) {
        console.error("Error soft deleting estimate:", error);
        ui.showErrorBanner(`Could not move estimate to Deleted: ${error.message}`);
    }
}

// Restores a soft-deleted estimate by removing the isDeleted flag
async function restoreEstimate(estimateId) {
    if (!estimateId) {
        ui.showErrorBanner("Cannot restore: Estimate ID is missing.");
        return;
    }

    const { db, doc, updateDoc } = window.firebaseServices;

    try {
        ui.showSuccessBanner("Restoring estimate...", true);

        // Update the document in Firestore, setting the isDeleted flag to false (or removing it)
        await updateDoc(doc(db, 'estimates', estimateId), {
            isDeleted: false, // Explicitly set to false
            lastSaved: new Date().toISOString() // Update lastSaved timestamp
        });

        // --- Update local state ---
        const estimate = State.getState().estimates.find(e => e.id === estimateId);
        if (estimate) {
            estimate.isDeleted = false;
            estimate.lastSaved = new Date().toISOString();
            State.updateEstimate(estimate);
        }
        // ------------------------

        // Refresh the dashboard filter (likely the 'Deleted' view) to remove the restored item
        if (document.getElementById('dashboard-view').classList.contains('active')) {
            applyDashboardFilter();
        }

        ui.showSuccessBanner("Estimate restored successfully.");
        // No saveState() needed as this action happens on the dashboard

    } catch (error) {
        console.error("Error restoring estimate:", error);
        ui.showErrorBanner(`Could not restore estimate: ${error.message}`);
    }
}

// Handles the deletion of various photo types from Firebase and the UI
async function handlePhotoDelete(type, data) {
    const estimateId = document.getElementById('editing-estimate-id').value;
    if (!estimateId) {
        ui.showErrorBanner("Cannot delete media from an unsaved estimate.");
        return;
    }

    if (!confirm("Are you sure you want to permanently delete this media?")) {
        return;
    }

    const { storage, ref, deleteObject, db, doc, updateDoc } = window.firebaseServices;

    // Find the current estimate from our local state
    const estimate = allEstimates.find(e => e.id === estimateId);
    if (!estimate) {
        ui.showErrorBanner("Could not find the current estimate data.");
        return;
    }

    let updatePayload = {}; // This object will hold the changes for Firestore
    let shouldRerenderBA = false; // Flag to know if we need to redraw the Before/After section

    try {
        ui.showSuccessBanner("Deleting media...", true);

        if (type === 'property') {
            if (!estimate.propertyPhotoURL) return; // Nothing to delete
            // Create a reference to the file in Firebase Storage and delete it
            await deleteObject(ref(storage, estimate.propertyPhotoURL));
            updatePayload.propertyPhotoURL = null; // Prepare to set the URL to null in Firestore

        } else if (type === 'work') {
            if (!estimate.workPhotos || !data.url) return;
            await deleteObject(ref(storage, data.url));
            // Prepare an updated array of work photos, excluding the deleted one
            updatePayload.workPhotos = estimate.workPhotos.filter(p => p.url !== data.url);

        } else if (type === 'before-after' || type === 'before-after-pair') {
            shouldRerenderBA = true; // We'll need to redraw this whole section
            const currentPairs = JSON.parse(JSON.stringify(estimate.beforeAndAfter || []));
            let pairsToUpdate = [];

            if (type === 'before-after') { // Deleting a single photo from a pair
                await deleteObject(ref(storage, data.url));
                pairsToUpdate = currentPairs.map(pair => {
                    if (pair.id === data.pairId) {
                        // Filter out the deleted media from the correct array (before or after)
                        if (data.type === 'before') {
                            pair.beforePhotos = (pair.beforePhotos || []).filter(media => media.url !== data.url);
                        } else {
                            pair.afterPhotos = (pair.afterPhotos || []).filter(media => media.url !== data.url);
                        }
                    }
                    return pair;
                });
            } else { // Deleting an entire Before/After pair
                const pairToDelete = currentPairs.find(p => p.id === data.pairData.id);
                if (pairToDelete) {
                    // Create a list of all media URLs to delete from storage
                    const mediaToDelete = [...(pairToDelete.beforePhotos || []), ...(pairToDelete.afterPhotos || [])];
                    // Create a promise for each deletion
                    const deletePromises = mediaToDelete.map(media => {
                        if (media.url) return deleteObject(ref(storage, media.url));
                        return Promise.resolve(); // Return a resolved promise for items without a URL
                    });
                    await Promise.all(deletePromises); // Delete all files in parallel
                }
                // Prepare the updated array of pairs, excluding the deleted one
                pairsToUpdate = currentPairs.filter(p => p.id !== data.pairData.id);
            }
            updatePayload.beforeAndAfter = pairsToUpdate;
        }

        // Send the update to Firestore
        await updateDoc(doc(db, 'estimates', estimateId), updatePayload);

        // --- Manually update the local state to match ---
        // This prevents needing to wait for a full Firestore refresh
        if (updatePayload.beforeAndAfter !== undefined) estimate.beforeAndAfter = updatePayload.beforeAndAfter;
        if (updatePayload.propertyPhotoURL !== undefined) estimate.propertyPhotoURL = updatePayload.propertyPhotoURL;
        if (updatePayload.workPhotos) estimate.workPhotos = updatePayload.workPhotos;

        // --- Re-render the relevant UI sections ---
        if (type === 'property') ui.renderPropertyPhoto(null, estimate.customerInfo?.address, handlePhotoDelete);
        if (type === 'work') ui.renderWorkPhotos(estimate.workPhotos, handlePhotoDelete);
        if (shouldRerenderBA) ui.renderBeforeAndAfter(estimate.beforeAndAfter, saveState, handlePhotoDelete);

        saveState(); // Save the new state for undo/redo
        ui.showSuccessBanner("Media deleted successfully.");

    } catch (error) {
        console.error("Error deleting photo:", error);
        // Special case: If the file is already gone from storage, just update the database record.
        if (error.code === 'storage/object-not-found') {
            ui.showErrorBanner("File was already deleted from storage. Updating record...");
            try {
                await updateDoc(doc(db, 'estimates', estimateId), updatePayload);
                // Re-render UI even if storage deletion failed
                if (shouldRerenderBA) ui.renderBeforeAndAfter(updatePayload.beforeAndAfter, saveState, handlePhotoDelete);
            } catch (dbError) {
                ui.showErrorBanner("Could not update the estimate record.");
            }
        } else {
            ui.showErrorBanner("Could not delete media. Please check console for details.");
        }
    }
}

// ADD THIS FUNCTION to estimator.js
async function handleDeleteSnowRouteMap(estimateId) {
    if (!estimateId || !confirm("Are you sure you want to delete the saved snow route map and order? This cannot be undone.")) {
        return;
    }

    const { db, doc, updateDoc } = window.firebaseServices;

    try {
        ui.showSuccessBanner("Deleting snow route map...", true);

        // Update Firestore: Set map URL to null and clear the route order array
        await updateDoc(doc(db, 'estimates', estimateId), {
            snowRouteMapUrl: null,
            snowRouteOrder: [], // Clear the saved order as well
            lastSaved: new Date().toISOString()
        });

        // --- Update local state ---
        const estimate = allEstimates.find(e => e.id === estimateId);
        if (estimate) {
            estimate.snowRouteMapUrl = null;
            estimate.snowRouteOrder = [];
            estimate.lastSaved = new Date().toISOString();
        }
        // ------------------------

        // --- Update UI ---
        // Call a UI function to hide the preview section
        ui.hideSnowRoutePreview();
        // -----------------

        saveState(); // Save the change for undo/redo
        ui.showSuccessBanner("Snow route map deleted successfully.");

    } catch (error) {
        console.error("Error deleting snow route map:", error);
        ui.showErrorBanner(`Could not delete snow route map: ${error.message}`);
    }
}

// Handles actions (delete/edit) for site visits from editor or dashboard
// Handles actions (delete/edit) for site visits from editor or dashboard
async function handleSiteVisitAction(e, estimateIdFromCard = null) {
    const { db, doc, updateDoc } = window.firebaseServices;

    // Determine the estimate ID (could be from editor or dashboard card click)
    const estimateId = document.getElementById('editing-estimate-id').value || estimateIdFromCard;
    if (!estimateId) {
        ui.showErrorBanner("Could not identify the estimate for this action.");
        return;
    }

    // Find the button that was clicked and get the visit index
    // Find the button that was clicked and get the visit index
    const targetButton = e.target.closest('.remove-visit-button, .reschedule-btn, .delete-visit-dashboard-btn');

    // FIX: Support both data-index and data-visit-index
    const rawIndex = targetButton ? (targetButton.dataset.index || targetButton.dataset.visitIndex) : null;

    if (!targetButton || rawIndex === undefined || rawIndex === null) {
        console.warn("Could not find visit index from clicked element:", e.target);
        return;
    }
    const visitIndex = parseInt(rawIndex, 10);

    // Find the estimate in our local data
    const estimate = allEstimates.find(est => est.id === estimateId);
    if (!estimate || !estimate.siteVisits || visitIndex < 0 || visitIndex >= estimate.siteVisits.length) {
        ui.showErrorBanner("Could not find the visit data to modify.");
        return;
    }

    // Determine the action based on the button clicked
    if (targetButton.classList.contains('remove-visit-button') || targetButton.classList.contains('delete-visit-dashboard-btn')) {
        // --- Remove Visit ---
        if (!confirm('Are you sure you want to remove this site visit?')) {
            return; // User cancelled
        }

        // Create a new array without the visit at the specified index
        let updatedVisits = [...estimate.siteVisits];
        updatedVisits.splice(visitIndex, 1);

        try {
            ui.showSuccessBanner("Removing visit...", true);
            // Update the document in Firestore
            await updateDoc(doc(db, 'estimates', estimateId), { siteVisits: updatedVisits });

            // Update local state (important if user doesn't reload)
            estimate.siteVisits = updatedVisits;

            // Re-render the visits list in the editor if it's the current estimate
            if (document.getElementById('editor-view').classList.contains('active') && document.getElementById('editing-estimate-id').value === estimateId) {
                ui.populateSiteVisitsEditor(estimateId, updatedVisits, allEstimates, handleSiteVisitAction);
            }

            // Refresh dashboard if that's the active view
            if (document.getElementById('dashboard-view').classList.contains('active')) {
                applyDashboardFilter(); // Re-render dashboard to update card
            }

            ui.showSuccessBanner('Site visit removed.');
            saveState(); // Update undo/redo history

        } catch (err) {
            console.error("Error removing site visit:", err);
            ui.showErrorBanner('Could not remove the site visit.');
        }

    } else if (targetButton.classList.contains('reschedule-btn')) {
        // --- Edit/Reschedule Visit ---
        // Open the modal, pre-filled with the data for this visit index
        ui.openSiteVisitModal(estimateId, allEstimates, visitIndex);
    }
}

async function handleCompleteVisit(e, estimateId) {
    const targetButton = e.target.closest('.complete-visit-dashboard-btn');
    if (!targetButton || !targetButton.dataset.visitIndex) return;
    const visitIndex = parseInt(targetButton.dataset.visitIndex, 10);

    const estimate = allEstimates.find(est => est.id === estimateId);
    if (!estimate || !estimate.siteVisits || !estimate.siteVisits[visitIndex]) return;

    ui.openCompleteVisitModal(estimateId, visitIndex, async (note) => {
        const { db, doc, updateDoc } = window.firebaseServices;
        const visit = estimate.siteVisits[visitIndex];

        // Update visit
        visit.completed = true;
        visit.notes = note;

        // Update tags
        let tags = estimate.tags || [];
        tags = tags.filter(t => t !== 'Site Visits'); // Remove Site Visits
        if (!tags.includes('Follow-up')) tags.push('Follow-up'); // Add Follow-up

        try {
            ui.showSuccessBanner("Completing visit...", true);
            await updateDoc(doc(db, 'estimates', estimateId), {
                siteVisits: estimate.siteVisits,
                tags: tags
            });

            // Update local state
            estimate.tags = tags;

            // Refresh dashboard
            applyDashboardFilter();
            ui.showSuccessBanner("Visit completed.");

        } catch (err) {
            console.error("Error completing visit:", err);
            ui.showErrorBanner("Failed to complete visit.");
        }
    });
}

// Applies pricing line items from a specific sketch to the 'Sketch Pricing' section
// REPLACE THIS ENTIRE FUNCTION in estimator.js
// REPLACE THIS ENTIRE FUNCTION in estimator.js
function applySketchDataToEstimate(sketchId) {
    const estimateId = document.getElementById('editing-estimate-id').value;
    if (!estimateId) {
        ui.showErrorBanner("Cannot apply sketch data: Current estimate ID not found.");
        return;
    }

    // Find the current estimate in local state
    const estimate = State.getState().estimates.find(e => e.id === estimateId);
    if (!estimate || !estimate.sketches) {
        ui.showErrorBanner("Could not find estimate or sketch data.");
        return;
    }

    // Find the specific sketch data
    const sketch = estimate.sketches.find(s => s.id === sketchId);
    if (!sketch || !sketch.measurements || sketch.measurements.length === 0) {
        ui.showErrorBanner("Selected sketch has no measurement data to apply.");
        return;
    }

    // Target the 'Sketch Pricing' card and its item container in the UI
    const sketchCard = document.getElementById('sketch-card');
    if (!sketchCard) {
        console.error("Could not find sketch pricing card ('#sketch-card') in the DOM.");
        ui.showErrorBanner("UI Error: Cannot find sketch pricing section.");
        return;
    }
    const container = sketchCard.querySelector('#sketch-items-container');
    if (!container) {
        console.error("Could not find sketch items container ('#sketch-items-container') in the DOM.");
        ui.showErrorBanner("UI Error: Cannot find sketch items section.");
        return;
    }

    // Clear any existing items in the sketch pricing section
    container.innerHTML = '';

    // Loop through the measurements from the sketch and add them as line items
    sketch.measurements.forEach(item => {
        // Skip items with no service selected or zero measurement
        if (!item.service || item.service === 'none' || !item.measurement || item.measurement <= 0) {
            return;
        }

        // --- MODIFIED: PASS THE SKETCH ITEM ID ---
        const itemData = {
            product: item.service,
            description: item.lineItemDescription || '',
            units: item.measurement,
            unitPrice: item.price || 0,
            color: item.color || '#ccc',
            sketchItemId: item.id // <--- CRITICAL NEW LINE: Keep the link to the original shape
        };
        // --- END MODIFICATION ---

        // Add the item to the UI, skip immediate state saving within the loop
        ui.addItemToOption('sketch-card', itemData, true, saveState);
    });

    ui.showSuccessBanner('Pricing from sketch has been applied to the Sketch Pricing section.');

    // Recalculate all totals now that items have been added
    ui.calculateAllTotals(saveState);

    // Save the overall state change
    saveState();
}

// REPLACE THIS ENTIRE FUNCTION in estimator.js
async function handleSketchDelete(sketchId) {
    if (!confirm("Are you sure you want to permanently delete this sketch? This action cannot be undone.")) {
        return; // User cancelled
    }

    const estimateId = document.getElementById('editing-estimate-id').value;
    if (!estimateId) {
        ui.showErrorBanner("Cannot delete sketch: Estimate ID not found.");
        return;
    }

    const { storage, ref, deleteObject, db, doc, updateDoc } = window.firebaseServices;

    // Find the current estimate in local state
    const estimate = State.getState().estimates.find(e => e.id === estimateId);
    if (!estimate || !estimate.sketches) {
        ui.showErrorBanner("Could not find estimate or sketch data.");
        return;
    }

    // Find the specific sketch to delete
    const sketchToDelete = estimate.sketches.find(s => s.id === sketchId);
    if (!sketchToDelete) {
        ui.showErrorBanner("Sketch not found within the estimate data.");
        return;
    }

    try {
        ui.showSuccessBanner("Deleting sketch...", true);

        // 1. Delete the screenshot file from Firebase Storage (if URL exists)
        if (sketchToDelete.screenshotUrl) {
            try {
                await deleteObject(ref(storage, sketchToDelete.screenshotUrl));
            } catch (storageError) {
                // Log storage error but continue if it's just 'object-not-found'
                if (storageError.code !== 'storage/object-not-found') {
                    throw storageError; // Re-throw other storage errors
                }
                console.warn("Sketch screenshot already deleted or not found in storage:", sketchToDelete.screenshotUrl);
            }
        }

        // 2. Prepare the updated sketches array (excluding        // Update local state
        estimate.sketches = estimate.sketches.filter(s => s.id !== sketchId);
        State.updateEstimate(estimate);

        // Re-render the sketches list
        ui.renderSketchesList(estimate.sketches, handleSketchDelete, applySketchDataToEstimate, handleSketchDuplicate);

        saveState(); // Save the state change for undo/redo
        ui.showSuccessBanner("Sketch deleted successfully.");

    } catch (error) {
        console.error("Error deleting sketch:", error);
        ui.showErrorBanner(`Could not delete sketch: ${error.message}`);
    }
}

// ADD THIS NEW FUNCTION to estimator.js (around line 1495)
async function handleSketchDuplicate(sketchId) {
    const estimateId = document.getElementById('editing-estimate-id').value;
    const estimate = allEstimates.find(e => e.id === estimateId);
    if (!estimate) {
        ui.showErrorBanner("Could not find estimate data to duplicate sketch.");
        return;
    }
    const sketchToCopy = (estimate.sketches || []).find(s => s.id === sketchId);
    if (!sketchToCopy) {
        ui.showErrorBanner("Could not find the original sketch data to copy.");
        return;
    }

    const { db, doc, updateDoc } = window.firebaseServices;
    ui.showSuccessBanner("Duplicating sketch...", true);

    try {
        // Create a deep copy
        const newSketch = JSON.parse(JSON.stringify(sketchToCopy));

        // Modify the copy
        newSketch.id = `sketch_${Date.now()}`;
        newSketch.title = `${newSketch.title || 'Sketch'} (Copy)`;
        delete newSketch.formattedEstimateUrl; // A copy shouldn't have the old PDF link
        newSketch.createdAt = new Date().toISOString();

        // Add the new sketch to the array
        const updatedSketches = [...(estimate.sketches || []), newSketch];

        // Save the entire updated sketches array to Firestore
        await updateDoc(doc(db, 'estimates', estimateId), {
            sketches: updatedSketches,
            lastSaved: new Date().toISOString()
        });

        // Update the local estimate object
        estimate.sketches = updatedSketches;
        estimate.lastSaved = new Date().toISOString();

        // Re-render the UI, passing all the necessary handlers again
        ui.renderSketches(updatedSketches, applySketchDataToEstimate, handleSketchDelete, handleSketchDuplicate);

        saveState(); // Save this change to the undo/redo history
        ui.showSuccessBanner("Sketch duplicated successfully.");

    } catch (error) {
        console.error("Error duplicating sketch:", error);
        ui.showErrorBanner(`Could not duplicate sketch: ${error.message}`);
    }
}

/// REPLACE THIS ENTIRE FUNCTION IN estimator.js

// REPLACE THIS ENTIRE FUNCTION IN estimator.js
async function handlePrint() {
    // We are now using the browser's native print, not html2canvas/jspdf
    const saveButton = document.getElementById('save-estimate-button');
    let originalButtonText = '';
    if (saveButton) {
        originalButtonText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Generating...';
    }

    // 1. Get the most up-to-date data
    const estimateData = getEstimateDataForSave();

    // 2. Generate the full HTML (which now includes our print styles)
    const printableHtml = generatePrintableEstimateHTML(estimateData);

    // 3. Open a new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        // 4. Write the HTML into the new window
        printWindow.document.write('<!DOCTYPE html><html><head><title>Print Estimate</title></head><body>');
        printWindow.document.write(printableHtml);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        // 5. Call the browser's print dialog
        printWindow.onload = () => {
            try {
                printWindow.print(); // Trigger the browser's print dialog
            } catch (e) {
                console.error("Print failed:", e);
                // Fallback for some browsers
                printWindow.alert("Could not print automatically. Please use your browser's print function (Ctrl+P or Cmd+P).");
            } finally {
                // Reset the save button regardless of print success
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = originalButtonText;
                }
            }
        };
    } else {
        // Handle pop-up blocker
        ui.showErrorBanner("Could not open print window. Please check your pop-up blocker.");
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = originalButtonText;
        }
    }
}
// Saves the selected categories/tags from the tag modal to Firestore
async function saveTags() {
    const { db, doc, updateDoc } = window.firebaseServices;

    // Get the modal and the estimate ID it's associated with
    const modal = document.getElementById('tag-modal');
    if (!modal) return; // Should not happen
    const estimateId = modal.querySelector('#tag-modal-estimate-id').value;

    if (!estimateId) {
        ui.showErrorBanner("Could not determine which estimate to update.");
        return;
    }

    // Get all the currently checked category checkboxes
    const selectedTags = Array.from(modal.querySelectorAll('#tag-modal-checkboxes input:checked')).map(cb => cb.value);

    // Find the estimate in our local data
    const estimate = allEstimates.find(e => e.id === estimateId);
    if (!estimate) {
        ui.showErrorBanner("Could not find estimate data to update.");
        return;
    }

    // Preserve any existing tags that are NOT standard categories
    const nonCategoryTags = (estimate.tags || []).filter(tag => !CATEGORIES.includes(tag)); // Assuming CATEGORIES is globally accessible or defined

    // Combine the non-category tags with the newly selected categories
    const newTags = [...nonCategoryTags, ...selectedTags];

    try {
        ui.showSuccessBanner("Saving categories...", true);
        // Update the 'tags' field in the Firestore document
        await updateDoc(doc(db, 'estimates', estimateId), { tags: newTags });

        // Update the local estimate object
        estimate.tags = newTags;

        // Re-render the tags displayed in the editor view if it's the current estimate
        if (document.getElementById('editor-view').classList.contains('active') && document.getElementById('editing-estimate-id').value === estimateId) {
            const tagsContainer = document.getElementById('editor-tags-container');
            if (tagsContainer) {
                ui.renderTags(newTags, tagsContainer); // Assuming ui.renderTags exists
            }
        }

        // Refresh dashboard if active to reflect tag changes potentially affecting filters
        if (document.getElementById('dashboard-view').classList.contains('active')) {
            applyDashboardFilter();
        }

        saveState(); // Update undo/redo history
        ui.showSuccessBanner("Categories updated successfully.");
        modal.classList.add('hidden'); // Close the modal

    } catch (error) {
        console.error("Error saving tags:", error);
        ui.showErrorBanner("Could not update categories.");
    }
}

// Applies selected categories to multiple estimates using a batch write
// Applies selected categories to multiple estimates using a batch write
async function batchUpdateCategory() {
    const { db, writeBatch, doc } = window.firebaseServices;

    // Get the modal and the data it holds
    const modal = document.getElementById('category-modal');
    if (!modal) return; // Should not happen

    const idsString = modal.querySelector('#category-modal-ids').value;
    const ids = idsString ? idsString.split(',') : [];

    if (ids.length === 0) {
        ui.showErrorBanner("No estimates were selected for category update.");
        return;
    }

    // Get the categories selected in the modal
    const selectedCategories = Array.from(modal.querySelectorAll('#category-modal-options input:checked')).map(cb => cb.value);

    // Start a Firestore batch write
    const batch = writeBatch(db);

    // Prepare updates for each selected estimate ID
    ids.forEach(id => {
        // Find the estimate in our local data
        const estimate = allEstimates.find(e => e.id === id);
        if (estimate) {
            // Preserve any existing tags that are NOT standard categories
            const nonCategoryTags = (estimate.tags || []).filter(tag => !CATEGORIES.includes(tag)); // Assuming CATEGORIES is accessible

            // Combine the non-category tags with the newly selected categories
            const newTags = [...nonCategoryTags, ...selectedCategories];

            // Add an update operation to the batch for this estimate
            const estimateRef = doc(db, 'estimates', id);
            batch.update(estimateRef, { tags: newTags });
        } else {
            console.warn(`Could not find estimate data for ID: ${id} during batch update.`);
        }
    });

    try {
        ui.showSuccessBanner(`Updating categories for ${ids.length} items...`, true);

        // Commit all updates in the batch atomically
        await batch.commit();

        // --- Manually update local state after successful commit ---
        // This ensures the UI reflects changes immediately without waiting for the listener
        ids.forEach(id => {
            const estimate = allEstimates.find(e => e.id === id);
            if (estimate) {
                const nonCategoryTags = (estimate.tags || []).filter(tag => !CATEGORIES.includes(tag));
                estimate.tags = [...nonCategoryTags, ...selectedCategories];
            }
        });
        // --------------------------------------------------------

        // Refresh the dashboard to show updated tags/categories
        if (document.getElementById('dashboard-view').classList.contains('active')) {
            applyDashboardFilter();
        }

        ui.showSuccessBanner(`${ids.length} items updated successfully.`);
        modal.classList.add('hidden'); // Close the modal

    } catch (error) {
        console.error("Error performing batch category update:", error);
        ui.showErrorBanner(`Failed to update categories: ${error.message}`);
    }
}

// Generates a Google Maps route link based on selected estimates on the dashboard
async function planRoute() {
    const selectedIds = getSelectedIds();
    const routeLinkContainer = document.getElementById('route-link-container');
    if (routeLinkContainer) routeLinkContainer.innerHTML = ''; // Clear previous link

    if (selectedIds.length < 2) {
        ui.showErrorBanner("Please select at least two estimates with addresses to plan a route.");
        return;
    }

    let startPointId = null;
    // Check if a specific starting point was selected
    const startPointCheckbox = document.querySelector('.start-point-checkbox:checked');
    if (startPointCheckbox) {
        startPointId = startPointCheckbox.dataset.id;
    }

    // Map selected IDs to location objects containing id and address
    const locations = selectedIds.map(id => {
        const est = allEstimates.find(e => e.id === id);
        const address = est?.customerInfo?.siteAddress || est?.customerInfo?.address;
        return address ? { id: id, address: address } : null;
    }).filter(Boolean); // Filter out any estimates without an address

    if (locations.length < 2) {
        ui.showErrorBanner("Fewer than two selected estimates have a valid address.");
        return;
    }

    // Determine the origin
    let originLocation;
    let remainingLocations = [...locations];

    if (startPointId) {
        const startIndex = remainingLocations.findIndex(loc => loc.id === startPointId);
        if (startIndex > -1) {
            originLocation = remainingLocations.splice(startIndex, 1)[0]; // Remove start point from remaining
        }
    }

    // If no specific start point or it wasn't found, use the first selected item
    if (!originLocation) {
        originLocation = remainingLocations.shift(); // Use and remove the first item
    }

    // The last remaining location will be the destination
    const destinationLocation = remainingLocations.pop() || originLocation; // If only one item left (or only origin existed), destination is the origin

    // All others are waypoints
    const waypoints = remainingLocations.map(loc => loc.address).join('|');

    // Construct the Google Maps URL
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originLocation.address)}&destination=${encodeURIComponent(destinationLocation.address)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;

    // Display the link in the batch action bar
    if (routeLinkContainer) {
        routeLinkContainer.innerHTML = `<a href="${mapsUrl}" target="_blank" class="text-blue-300 hover:underline text-sm font-medium">Open Planned Route in Google Maps</a>`;
        ui.showSuccessBanner("Route link generated below.");
    } else {
        // Fallback: Open in new tab if container not found (less likely)
        window.open(mapsUrl, '_blank');
    }
}

// Gets an array of estimate IDs currently selected via checkboxes on the dashboard
// Gets an array of estimate IDs currently selected via checkboxes on the dashboard
function getSelectedIds() {
    // Find all checkboxes within the list container that are currently checked
    const checkedBoxes = document.querySelectorAll('#estimate-list-container .item-select-checkbox:checked');

    // Extract the 'data-id' attribute from each checked checkbox
    const ids = Array.from(checkedBoxes).map(checkbox => checkbox.dataset.id);

    return ids;
}

// Creates a duplicate of an existing dynamic pricing option card
// Creates a duplicate of an existing dynamic pricing option card
// REPLACE this function in estimator.js
function copyDynamicOption(currentCard, saveState) {
    console.log("copyDynamicOption function called for card:", currentCard);

    if (!currentCard) {
        ui.showErrorBanner("Could not identify the option card to copy.");
        console.error("copyDynamicOption failed: currentCard is null or undefined.");
        return;
    }

    // --- PASS THE ELEMENT ITSELF ---
    console.log(`Attempting to get data directly from card element with ID: ${currentCard.id}`);
    const optionData = getOptionData(currentCard, ui.getQuillInstance());
    // ----------------------------

    if (!optionData) {
        ui.showErrorBanner("Could not retrieve data for the option to copy.");
        console.error(`copyDynamicOption failed: getOptionData returned null for card element ID: ${currentCard.id}`);
        return;
    }

    console.log("Original option data retrieved:", JSON.stringify(optionData));

    try {
        const newOptionData = JSON.parse(JSON.stringify(optionData));
        newOptionData.id = `option-${Date.now()}`;
        console.log("Generated new option ID:", newOptionData.id);
        newOptionData.title = `${newOptionData.title || 'Option'} (Copy)`;

        console.log("Calling ui.addPricingOption with new data:", JSON.stringify(newOptionData));
        ui.addPricingOption(newOptionData, saveState);

        ui.showSuccessBanner("Option copied successfully.");
        console.log("Option copy process seems successful. Saving state.");
        saveState();

    } catch (error) {
        console.error("Error during copyDynamicOption execution:", error);
        ui.showErrorBanner(`Error copying option: ${error.message}`);
    }
}


// REPLACE this function in estimator.js
// Snow Calculation functions moved to modules/snow_calc/snow-app.js
async function saveContentToEstimate(contentType) {
    const estimateId = document.getElementById('editing-estimate-id').value;
    if (!estimateId) {
        ui.showErrorBanner("Please save the estimate before saving content.");
        return;
    }

    const { db, doc, updateDoc } = window.firebaseServices;
    let editorKey, fieldName;

    if (contentType === 'appendix') {
        editorKey = 'appendix';
        fieldName = 'appendixContent';
    } else if (contentType === 'terms') {
        editorKey = 'terms';
        fieldName = 'terms';
    } else {
        return;
    }

    const quill = ui.getQuillInstance(editorKey);
    if (!quill) return;

    const content = quill.root.innerHTML;

    try {
        ui.showSuccessBanner("Saving content...", true);
        await updateDoc(doc(db, 'estimates', estimateId), {
            [fieldName]: content,
            lastSaved: new Date().toISOString()
        });

        const estimate = State.getState().estimates.find(e => e.id === estimateId);
        if (estimate) {
            estimate[fieldName] = content;
            estimate.lastSaved = new Date().toISOString();
            State.updateEstimate(estimate);
        }
        ui.showSuccessBanner("Content saved to this estimate.");
    } catch (error) {
        console.error("Error saving content:", error);
        ui.showErrorBanner("Failed to save content.");
    }
}

async function saveContentAsDefault(contentType) {
    const { db, doc, setDoc, getDoc } = window.firebaseServices;
    let editorKey, docId;

    if (contentType === 'appendix') {
        editorKey = 'appendix';
        docId = 'default_appendix';
    } else if (contentType === 'terms') {
        editorKey = 'terms';
        docId = 'default_terms';
    } else {
        return;
    }

    const quill = ui.getQuillInstance(editorKey);
    if (!quill) return;

    const content = quill.root.innerHTML;

    try {
        ui.showSuccessBanner("Saving as default...", true);
        await setDoc(doc(db, 'settings', docId), {
            content: content,
            updatedAt: new Date().toISOString()
        });
        ui.showSuccessBanner("Content saved as new default.");
    } catch (error) {
        console.error("Error saving default content:", error);
        ui.showErrorBanner("Failed to save default content.");
    }
}

// ADD THIS NEW FUNCTION to the end of estimator.js
// REPLACE THIS ENTIRE FUNCTION in estimator.js
async function updateAllEstimatesContent(contentType) { // contentType will be 'appendix' or 'terms'
    // We get updateDoc, not writeBatch, because we're doing this one-by-one
    const { db, collection, getDocs, updateDoc, doc } = window.firebaseServices;

    let editorKey, contentName;
    if (contentType === 'appendix') {
        editorKey = 'appendix';
        contentName = 'Appendix';
    } else if (contentType === 'terms') {
        editorKey = 'terms';
        contentName = 'Terms & Conditions';
    } else {
        return; // Invalid type
    }

    // 1. Get the new content from the current editor
    const quill = ui.getQuillInstance(editorKey);
    if (!quill) {
        return ui.showErrorBanner(`Could not find the ${contentName} editor.`);
    }
    const newContent = quill.root.innerHTML;

    if (!newContent || newContent === '<p><br></p>') {
        return ui.showErrorBanner(`${contentName} editor is empty. Cannot update all estimates with blank content.`);
    }

    ui.showSuccessBanner(`Updating ${contentName} for all estimates... This may take a moment.`, true);

    try {
        // 2. Get all estimate documents (excluding templates and deleted)
        const querySnapshot = await getDocs(collection(db, "estimates"));
        const estimatesToUpdate = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'Template' && !data.isDeleted) {
                estimatesToUpdate.push(doc.ref); // Get the document reference
            }
        });

        if (estimatesToUpdate.length === 0) {
            return ui.showSuccessBanner("No active estimates found to update.");
        }

        // 3. --- THIS IS THE NEW LOGIC ---
        // We can't use a single batch. We must update one by one
        // to catch and skip any "document too large" errors.
        let successCount = 0;
        let errorCount = 0;
        const fieldToUpdate = (contentType === 'appendix') ? 'appendixContent' : 'terms';

        for (const docRef of estimatesToUpdate) {
            try {
                // Try to update the document
                await updateDoc(docRef, {
                    [fieldToUpdate]: newContent,
                    lastSaved: new Date().toISOString()
                });
                successCount++;

                // Also update local 'allEstimates' array
                const est = State.getState().estimates.find(e => e.id === docRef.id);
                if (est) {
                    if (contentType === 'appendix') est.appendixContent = newContent;
                    else if (contentType === 'terms') est.terms = newContent;
                    est.lastSaved = new Date().toISOString();
                    State.updateEstimate(est);
                }

            } catch (updateError) {
                // This is the error code for "Document is too large"
                if (updateError.code === 'invalid-argument' || updateError.code === 'resource-exhausted') {
                    console.warn(`SKIPPED: Estimate ${docRef.id} is too large to update.`, updateError.message);
                    errorCount++;
                } else {
                    // A different, unexpected error
                    throw updateError; // Stop the process
                }
            }
        }
        // --- END NEW LOGIC ---

        // 4. Also save this new content as the default for NEW estimates
        await saveContentAsDefault(contentType); // This also shows a success banner, which is fine

        // 5. Report results
        if (errorCount > 0) {
            ui.showErrorBanner(`Updated ${successCount} estimates. ${errorCount} estimate(s) were skipped because they are too large.`);
        } else {
            ui.showSuccessBanner(`Successfully updated ${contentName} for ${successCount} estimates.`);
        }

    } catch (error) {
        console.error(`Error updating all ${contentName}:`, error);
        ui.showErrorBanner(`Failed to update estimates: ${error.message}`);
    }
}
// ADD THIS ENTIRE BLOCK to the end of estimator.js

/**
 * Sets up drag-and-drop listeners for reordering pricing options.
 */
function initializeDragAndDrop() {
    const container = document.getElementById('pricing-options-container');
    if (!container) return;

    let draggingElement = null;

    // Listen for when a drag starts
    container.addEventListener('dragstart', (e) => {
        // The event target *is* the handle (or something inside it)
        // because it's the only draggable element.
        draggingElement = e.target.closest('.price-option-card');

        if (draggingElement) {
            // Use a timeout to allow the browser to paint the drag image
            // before we alter the element's appearance
            setTimeout(() => {
                draggingElement.classList.add('dragging');
            }, 0);
        } else {
            // Should not happen if event setup is correct, but good to prevent
            e.preventDefault();
        }
    });

    // Listen for when a drag ends (dropped, cancelled, etc.)
    container.addEventListener('dragend', () => {
        if (draggingElement) {
            draggingElement.classList.remove('dragging');
            draggingElement = null;
        }
    });

    // Listen for when an item is dragged over the container
    container.addEventListener('dragover', (e) => {
        e.preventDefault(); // This is necessary to allow a drop
        if (!draggingElement) return;

        // Find the element we're dragging over
        const afterElement = getDragAfterElement(container, e.clientY);

        // Remove any previous "drag-over" indicators
        const currentIndicator = container.querySelector('.drag-over');
        if (currentIndicator) {
            currentIndicator.classList.remove('drag-over');
        }

        if (afterElement == null) {
            // We're dragging over the end, add to container
            container.classList.add('drag-over');
        } else {
            // We're dragging over another card, add indicator to it
            afterElement.classList.add('drag-over');
        }
    });

    // Clean up indicator when leaving the container
    container.addEventListener('dragleave', (e) => {
        if (e.target === container) {
            container.classList.remove('drag-over');
        }
    });

    // Listen for the actual drop event
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggingElement) return;

        // Remove all drag-over indicators
        container.classList.remove('drag-over');
        container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

        // Find where we dropped it
        const afterElement = getDragAfterElement(container, e.clientY);

        if (afterElement == null) {
            container.appendChild(draggingElement); // Append to the end
        } else {
            container.insertBefore(draggingElement, afterElement); // Insert before the next element
        }

        // --- CRITICAL: Update table and save state ---
        ui.calculateAllTotals(saveState);
        saveState();
        // ------------------------------------------
    });
}

/**
 * Helper function to determine which element the dragged item
 * should be inserted *before*.
 */
function getDragAfterElement(container, y) {
    // Get all draggable cards *except* the one we are currently dragging
    const draggableElements = [...container.querySelectorAll('.price-option-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // Get the midpoint of the card
        const offset = y - box.top - (box.height / 2);

        // If we are above the midpoint, this is our new "closest" element
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element; // Start with negative infinity
}

async function handleStarRatingClick(e) {
    const btn = e.target.closest('.star-btn');
    if (!btn) return;

    const estimateId = btn.dataset.id;
    const rating = parseInt(btn.dataset.rating);
    const { db, doc, updateDoc } = window.firebaseServices;

    // Optimistic UI Update (Update local state instantly)
    const estimate = allEstimates.find(e => e.id === estimateId);
    if (estimate) {
        estimate.leadRating = rating;
        applyDashboardFilter(); // Re-render dashboard
    }

    try {
        await updateDoc(doc(db, 'estimates', estimateId), {
            leadRating: rating,
            lastSaved: new Date().toISOString()
        });
    } catch (err) {
        console.error("Failed to save rating:", err);
        // Revert on failure (reload from DB would handle this on refresh)
    }
}


// Make functions globally accessible for UI event listeners
window.handleAutoCalculateSnowPrice = handleAutoCalculateSnowPrice;
window.handleRouteChange = handleRouteChange;
window.updateSnowContractSummary = updateSnowContractSummary;
Object.defineProperty(window, 'allEstimates', {
    get: () => State.getState().estimates
});
window.ui = ui; // Make ui functions available for Load from Sketch