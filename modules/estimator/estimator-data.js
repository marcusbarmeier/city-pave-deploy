// © 2025 City Pave. All Rights Reserved.
// Filename: estimator-data.js
// Handles data retrieval, calculations, and Firebase interactions.

// NOTE: We NO LONGER import pricingOptions from pricing.js here.
// We will fetch it from the database instead.

import { showSuccessBanner, showErrorBanner, populateSiteVisitsEditor, getFinancialItemsFromEditor } from './estimator-ui.js';
import { calculateTonnage } from './estimator-calculations.js';
import { State } from './estimator-state.js';

const CATEGORIES = ["New Leads", "Ready for Review", "Planned Route (Un-confirmed)", "Site Visits", "Work Starting", "Active Customers", "Inactive Customers", "Follow-up", "Trucking"];

// --- NEW: FETCH PRICING FROM DB ---
export async function fetchPricingLibrary() {
    const { db, collection, getDocs, doc, getDoc, query } = window.firebaseServices;

    try {
        // 1. Fetch Global Settings (Tax, Fuel)
        const settingsSnap = await getDoc(doc(db, 'pricing_library', 'global_settings'));
        const settings = settingsSnap.exists() ? settingsSnap.data() : { taxRate: 0.05 };

        // 2. Fetch Pricing Items
        const q = query(collection(db, 'pricing_library'));
        const snapshot = await getDocs(q);

        const items = [];
        snapshot.forEach(doc => {
            if (doc.id !== 'global_settings' && !doc.id.startsWith('engine_')) {
                items.push({ id: doc.id, ...doc.data() });
            }
        });

        // 3. Sort items by name
        items.sort((a, b) => a.name.localeCompare(b.name));

        // 4. Add the "Select Service" placeholder
        const finalOptions = [
            { id: 'none', name: 'Select Service', type: 'none', defaultPrice: 0, description: 'Choose a service...' },
            ...items
        ];

        return {
            options: finalOptions,
            taxRate: settings.taxRate || 0.05,
            fuelSettings: settings.fuel || {}
        };

    } catch (error) {
        console.error("Error fetching pricing library:", error);
        return null;
    }
}
// ----------------------------------

export function getSnowLocationsData() {
    const locations = [];
    document.querySelectorAll('.snow-location-card').forEach(card => {
        const getVal = (selector) => card.querySelector(selector)?.value || '';
        const getNum = (selector) => parseFloat(card.querySelector(selector)?.value) || 0;
        const getChecked = (selector) => card.querySelector(selector)?.checked || false;
        const getHtml = (selector) => card.querySelector(selector)?.innerHTML || '';

        const breakdownText = card.querySelector('.snow-calculation-details')?.textContent || '';
        const timeMatch = breakdownText.match(/(?:On-Site Time|Billable Time):\s*([\d.]+) hrs/i);
        const equipmentMatch = breakdownText.match(/Calculated Fleet:\s*(.*?)(?=\s*Volume\/Event:|\s*Cost \/ Push:|\s*$)/i);

        locations.push({
            id: card.dataset.locationId,
            title: getVal('.snow-location-title'),
            address: getVal('.snow-location-address'),
            loaderArea: getNum('.snow-loader-area'),
            skidSteerArea: getNum('.snow-skidsteer-area'),
            shovelArea: getNum('.snow-shovel-area'),
            targetHours: getNum('.snow-target-hours'),
            services: {
                clearing: getChecked('.snow-service-clearing'),
                hauling: getChecked('.snow-service-hauling'),
                salting: getChecked('.snow-service-salting'),
            },
            haulingCrew: {
                loaders: getNum('.snow-num-loaders'),
                trucks: getNum('.snow-num-trucks'),
                loadTime: getNum('.snow-load-time'),
                unloadTime: getNum('.snow-unload-time')
            },
            clearingTrigger: getVal('.snow-clearing-trigger'),
            haulingInterval: getNum('.snow-hauling-interval'),
            pricePerPush: getNum('.snow-price-per-push'),
            priceMonthly: getNum('.snow-price-monthly'),
            priceSeasonal: getNum('.snow-price-seasonal'),
            timeToComplete: timeMatch ? parseFloat(timeMatch[1]) : 0,
            equipmentInfo: equipmentMatch ? equipmentMatch[1].trim() : 'N/A',
            sourceSketchId: card.dataset.sourceSketchId || null,
            breakdownHtml: getHtml('.snow-calculation-details')
        });
    });
    return locations;
}

export function getEstimateData(quillEditors, signaturePad, witnessSignaturePad) {
    const allEstimates = State.getState().estimates;
    const editingId = document.getElementById('editing-estimate-id').value;
    const existingEstimate = allEstimates.find(e => e.id === editingId);

    const dynamicOptions = [];
    document.querySelectorAll('#pricing-options-container .price-option-card').forEach(card => {
        const optionData = getOptionData(card, quillEditors);
        if (optionData) {
            dynamicOptions.push(optionData);
        }
    });

    const selectedOptions = Array.from(document.querySelectorAll('.option-choice-checkbox:checked')).map(cb => cb.value);

    const sketchData = getOptionData('sketch-card', quillEditors) || { title: 'Sketch Pricing', id: 'sketch', items: [] };
    const changeOrderData = getOptionData('change-order-card', quillEditors) || { title: 'Change Order', id: 'change-order', items: [], enabled: false };

    const pricing = {
        options: {
            sketch: sketchData,
            'change-order': changeOrderData
        },
        dynamicOptions: dynamicOptions,
        selectedOptions: selectedOptions,
        depositRate: parseFloat(document.getElementById('deposit-rate-input')?.value) || 40
    };

    const leadRatingInput = document.querySelector('input[name="lead-rating"]:checked');
    let acceptanceData = existingEstimate?.acceptance || {};
    const signaturePadIsVisible = !document.getElementById('signature-pad-wrapper').classList.contains('hidden');
    const signaturePadIsSigned = signaturePad && !signaturePad.isEmpty();
    if (signaturePadIsVisible && signaturePadIsSigned) {
        acceptanceData = {
            ...acceptanceData,
            signatureDataURL: signaturePad.toDataURL('image/png'),
            witnessSignatureDataURL: witnessSignaturePad && !witnessSignaturePad.isEmpty() ? witnessSignaturePad.toDataURL('image/png') : null,
            acceptanceDate: document.getElementById('acceptance-date').value,
            printedName: document.getElementById('editor-print-name')?.value || null,
            witnessPrintedName: document.getElementById('editor-witness-print-name')?.value || null,
        };
    } else if (acceptanceData.signatureDataURL) {
        acceptanceData.acceptanceDate = document.getElementById('acceptance-date').value;
    }
    const customerNotes = document.getElementById('customer-notes-content')?.textContent || null;

    const financialSummary = {
        items: getFinancialItemsFromEditor() || []
    };

    const sharingPermissionEl = document.querySelector('input[name="sharing-permission"]:checked');
    const sharingOptions = {
        permission: sharingPermissionEl ? sharingPermissionEl.value : 'none'
    };
    const snowLocations = getSnowLocationsData();

    const finalData = {
        id: editingId,
        createdAt: existingEstimate?.createdAt || null,
        tags: existingEstimate?.tags || ["New Leads"],
        customerInfo: {
            name: document.getElementById('customer-name')?.value || null,
            address: document.getElementById('customer-address')?.value || null,
            phone: document.getElementById('customer-phone')?.value || null,
            email: document.getElementById('customer-email')?.value || null,
            siteAddress: document.getElementById('site-address')?.value || null
        },
        visitDuration: parseInt(document.getElementById('visit-duration')?.value, 10) || 30,
        siteVisits: getSiteVisitsFromEditor() || [],
        // REMOVED: workStages
        sketches: existingEstimate?.sketches || [],
        propertyPhotoURL: existingEstimate?.propertyPhotoURL || null,
        beforeAndAfter: getBeforeAndAfterData(quillEditors) || [],
        // REMOVED: contactHistory
        leadRating: leadRatingInput ? parseInt(leadRatingInput.value, 10) : null,
        scopeOfWork: {
            manual: quillEditors['manual-scope']?.root.innerHTML || null,
            auto: quillEditors['auto-scope']?.root.innerHTML || null
        },
        appendixContent: quillEditors['appendix']?.root.innerHTML || null,
        pricing: pricing,
        financialSummary: financialSummary,
        terms: quillEditors['terms']?.root.innerHTML || null,
        acceptance: acceptanceData,
        customerNotes: customerNotes,
        status: document.getElementById('estimate-status')?.value || 'Draft',
        sharingOptions: sharingOptions,
        tentativeStartDate: document.getElementById('tentative-start-date')?.value || null,
        tentativeProofRollDate: document.getElementById('tentative-proof-roll-date')?.value || null,
        tentativeEndDate: document.getElementById('tentative-end-date')?.value || null,
        snowLocations: snowLocations || [],
        snowRouteMapUrl: existingEstimate?.snowRouteMapUrl || null,
        snowRouteOrder: existingEstimate?.snowRouteOrder || [],
        grandTotal: parseFloat(document.getElementById('summary-grand-total')?.textContent.replace(/[$,]/g, '')) || 0,
        lastSaved: new Date().toISOString()
    };

    return finalData;
}

export function getOptionData(optionIdentifier, quillEditors) {
    let card = null;
    if (typeof optionIdentifier === 'string') {
        card = document.getElementById(optionIdentifier);
    } else if (optionIdentifier instanceof HTMLElement) {
        card = optionIdentifier;
    }

    if (!card) {
        return null;
    }

    const optionId = card.id;

    if (optionId === 'change-order-card') {
        const changeOrderCheckbox = document.getElementById('change-order-checkbox');
        return {
            title: 'Change Order',
            id: 'change-order',
            items: getLineItems(card, quillEditors),
            enabled: changeOrderCheckbox ? changeOrderCheckbox.checked : false
        };
    }
    if (optionId === 'sketch-card') {
        return {
            title: 'Sketch Pricing',
            id: 'sketch',
            items: getLineItems(card, quillEditors)
        };
    }

    const summary = {
        sqft: card.querySelector('.option-sqft')?.value || null,
        tonnage: card.querySelector('.option-tonnage')?.value || null,
        demo: card.querySelector('.option-demo')?.value || 'No',
        basework: card.querySelector('.option-basework')?.value || 'No',
        excavation: card.querySelector('.option-excavation')?.value || 'No',
        thickness: card.querySelector('.option-thickness')?.value || 'none',
        warranty: card.querySelector('.option-warranty')?.value || null,
    };

    return {
        id: optionId,
        title: card.querySelector('.option-title-input')?.value || '',
        items: getLineItems(card, quillEditors),
        summary: summary
    };
}

function getLineItems(cardElement, quillEditors) {
    const items = [];
    if (!cardElement) return items;
    let itemSelector = '.line-item-container';

    cardElement.querySelectorAll(itemSelector).forEach(row => {
        const productEl = row.querySelector('.product-select');
        const unitsEl = row.querySelector('.units-input');
        const priceEl = row.querySelector('.price-input');
        const colorPickerEl = row.querySelector('.item-color-picker');

        const color = colorPickerEl ? colorPickerEl.value : '#cccccc';
        const quill = row.quill;

        const product = productEl ? productEl.value : '';
        const units = parseFloat(unitsEl ? unitsEl.value : 0) || 0;
        const price = parseFloat(priceEl ? priceEl.value : 0) || 0;
        const description = (quill && quill.getLength() > 1) ? quill.root.innerHTML : null;

        if (product || units > 0 || price > 0 || description) {
            items.push({
                product: product || null,
                description: description,
                units: units,
                unitPrice: price,
                color: color
            });
        }
    });
    return items;
}

function getSiteVisitsFromEditor() {
    const visits = [];
    document.querySelectorAll('#site-visits-container .site-visit-item').forEach(item => {
        const dateEl = item.querySelectorAll('.bg-gray-100')[0];
        const timeEl = item.querySelectorAll('.bg-gray-100')[1];
        const descEl = item.querySelectorAll('.bg-gray-100')[2];
        const completedEl = item.querySelector('.visit-completed-checkbox');
        visits.push({
            date: dateEl ? dateEl.textContent : '',
            time: timeEl ? timeEl.textContent : '',
            description: descEl ? descEl.textContent : '',
            completed: completedEl ? completedEl.checked : false
        });
    });
    return visits;
}

function getWorkStagesFromEditor() {
    const stages = [];
    document.querySelectorAll('.work-stage-item').forEach(item => {
        stages.push({
            startDate: item.querySelector('.stage-start-date').value,
            completedDate: item.querySelector('.stage-completed-date').value,
            description: item.querySelector('.stage-description').value
        });
    });
    return stages;
}

export function getBeforeAndAfterData(quillEditors) {
    const pairs = [];
    document.querySelectorAll('#before-after-container .before-after-pair').forEach(pairDiv => {
        const pairId = pairDiv.dataset.pairId;

        const getMedia = (type) => {
            const media = [];
            pairDiv.querySelectorAll(`.ba-photos-container[data-type="${type}"] .relative.group`).forEach(el => {
                let location = null;
                try { if (el.dataset.location) location = JSON.parse(el.dataset.location); } catch (e) { }
                media.push({ url: el.dataset.url, type: el.dataset.type, location });
            });
            return media;
        };

        pairs.push({
            id: pairId,
            title: pairDiv.querySelector('.ba-title-input').value,
            description: quillEditors[pairId] ? quillEditors[pairId].root.innerHTML : '',
            beforePhotos: getMedia('before'),
            duringPhotos: getMedia('during'), // <--- ADDED
            afterPhotos: getMedia('after'),
        });
    });
    return pairs;
}

// calculateTonnage moved to estimator-calculations.js

// --- MISSING SAVE FUNCTIONS ---

export async function saveEstimate(getDataFunc, isAutosave = false) {
    const allEstimates = State.getState().estimates;
    const { db, doc, updateDoc, addDoc, collection } = window.firebaseServices;

    if (!isAutosave) showSuccessBanner("Saving...", true);

    try {
        // Execute the callback to get the latest data from the UI
        const data = getDataFunc();

        // Basic validation
        if (!data.customerInfo.name) {
            if (!isAutosave) showErrorBanner("Customer Name is required.");
            return;
        }

        // Deep copy to ensure no UI references linger
        const cleanData = JSON.parse(JSON.stringify(data));

        if (data.id) {
            // UPDATE EXISTING ESTIMATE
            const estimateRef = doc(db, "estimates", data.id);
            delete cleanData.id; // Don't save the ID inside the document itself if it's the key

            await updateDoc(estimateRef, cleanData);

            // Update local state array so UI reflects changes immediately
            const index = allEstimates.findIndex(e => e.id === data.id);
            if (index !== -1) {
                // Update local state via State manager
                const updatedEstimate = { id: data.id, ...cleanData };
                State.updateEstimate(updatedEstimate);
            }

            if (!isAutosave) showSuccessBanner("Estimate saved successfully.");

            // AI TRIGGER: Estimate Ready
            if (cleanData.status === 'Sent' || cleanData.status === 'Ready for Review') {
                console.log("[Estimator] Dispatching AI Trigger: estimate-ready");
                window.dispatchEvent(new CustomEvent('ai-trigger', {
                    detail: {
                        type: 'estimate-ready',
                        data: {
                            id: data.id,
                            clientName: cleanData.customerInfo.name,
                            amount: cleanData.grandTotal || 0,
                            status: cleanData.status,
                            // --- EXPANDED CONTEXT FOR AI AGENTS ---
                            tags: cleanData.tags || [],
                            visitDuration: cleanData.visitDuration || 30,
                            siteVisits: cleanData.siteVisits || [],
                            propertyPhotoURL: cleanData.propertyPhotoURL || null
                            // --------------------------------------
                        }
                    }
                }));
            }
        } else {
            // CREATE NEW ESTIMATE (Backup method, usually handled by Dashboard)
            const newRef = await addDoc(collection(db, "estimates"), cleanData);
            document.getElementById('editing-estimate-id').value = newRef.id;

            // Add to local state via State manager
            State.addEstimate({ id: newRef.id, ...cleanData });

            if (!isAutosave) showSuccessBanner("New estimate created.");
        }
    } catch (error) {
        console.error("Save error:", error);
        if (!isAutosave) showErrorBanner("Failed to save: " + error.message);
    }
}

export async function saveQuickAdd(toggleFormCallback) {
    const { db, collection, addDoc } = window.firebaseServices;

    const name = document.getElementById('qa-customer-name').value;
    if (!name) return showErrorBanner("Name is required.");

    showSuccessBanner("Creating lead...", true);

    try {
        const newEstimate = {
            customerInfo: {
                name: name,
                address: document.getElementById('qa-customer-address').value,
                phone: document.getElementById('qa-customer-phone').value,
                email: document.getElementById('qa-customer-email').value
            },
            contactHistory: {
                initialContactDate: document.getElementById('qa-initial-contact-date').value,
                source: document.getElementById('qa-contact-source').value,
                description: document.getElementById('qa-contact-notes').value
            },
            scopeOfWork: {
                manual: document.getElementById('qa-scope-notes').value,
                auto: ''
            },
            status: document.getElementById('qa-estimate-status').value || 'Draft',
            createdAt: new Date().toISOString(),
            lastSaved: new Date().toISOString(),
            tags: ["New Leads"],
            // Initialize empty structures to prevent null errors later
            pricing: { options: {}, dynamicOptions: [], selectedOptions: [] },
            siteVisits: [],
            sketches: [],
            workPhotos: [],
            beforeAndAfter: []
        };

        // Note: Template application logic is omitted for simplicity in Quick Add
        // to prevent dependency loops.

        await addDoc(collection(db, "estimates"), newEstimate);

        // --- CRM SYNC (Data Bridge) ---
        try {
            const { query, where, getDocs, updateDoc, doc } = window.firebaseServices;
            const leadsRef = collection(db, "leads");

            // Check for existing lead by Email or Phone
            let existingLeadId = null;

            if (newEstimate.customerInfo.email) {
                const qEmail = query(leadsRef, where("contactInfo.email", "==", newEstimate.customerInfo.email));
                const snapEmail = await getDocs(qEmail);
                if (!snapEmail.empty) existingLeadId = snapEmail.docs[0].id;
            }

            if (!existingLeadId && newEstimate.customerInfo.phone) {
                const qPhone = query(leadsRef, where("contactInfo.phone", "==", newEstimate.customerInfo.phone));
                const snapPhone = await getDocs(qPhone);
                if (!snapPhone.empty) existingLeadId = snapPhone.docs[0].id;
            }

            if (existingLeadId) {
                // Update existing lead interaction
                await updateDoc(doc(db, "leads", existingLeadId), {
                    lastInteraction: new Date().toISOString(),
                    // Optional: Update notes if provided
                });
            } else {
                // Create NEW Lead
                await addDoc(leadsRef, {
                    tenantId: 'citypave',
                    ownerId: 'system',
                    name: newEstimate.customerInfo.name,
                    rank: 5, // Default
                    status: 'New',
                    notes: newEstimate.contactHistory.description || '',
                    contactInfo: {
                        phone: newEstimate.customerInfo.phone || '',
                        email: newEstimate.customerInfo.email || '',
                        address: newEstimate.customerInfo.address || ''
                    },
                    createdAt: new Date().toISOString(),
                    lastInteraction: new Date().toISOString(),
                    referralSource: newEstimate.contactHistory.source || 'Estimator Quick Add'
                });
            }
        } catch (crmError) {
            console.warn("CRM Sync Warning:", crmError);
            // We don't fail the whole operation if CRM sync fails, just log it.
        }
        // -----------------------------

        showSuccessBanner("Lead added successfully.");
        if (typeof toggleFormCallback === 'function') toggleFormCallback();

    } catch (error) {
        console.error("Quick Add Error:", error);
        showErrorBanner("Failed to create lead: " + error.message);
    }
}

export async function saveSiteVisit() {
    const allEstimates = State.getState().estimates;
    const { db, doc, updateDoc } = window.firebaseServices;
    const modal = document.getElementById('site-visit-modal');
    const estimateId = document.getElementById('site-visit-estimate-id').value;
    const visitIndex = document.getElementById('site-visit-index').value;

    if (!estimateId) return;

    const visitData = {
        date: document.getElementById('site-visit-date').value,
        time: document.getElementById('site-visit-time').value,
        description: document.getElementById('site-visit-description').value,
        completed: document.getElementById('site-visit-completed').checked
    };

    const estimate = allEstimates.find(e => e.id === estimateId);
    if (!estimate) return;

    // Create copy of visits array
    let visits = estimate.siteVisits ? [...estimate.siteVisits] : [];

    if (visitIndex !== "" && visitIndex !== null) {
        visits[parseInt(visitIndex)] = visitData; // Update existing
    } else {
        visits.push(visitData); // Add new
    }

    try {
        await updateDoc(doc(db, "estimates", estimateId), {
            siteVisits: visits,
            lastSaved: new Date().toISOString()
        });

        // Update local state
        estimate.siteVisits = visits;
        estimate.lastSaved = new Date().toISOString();
        State.updateEstimate(estimate);

        // Refresh editor UI if currently editing this estimate
        if (document.getElementById('editing-estimate-id').value === estimateId) {
            // We imported this function at the top of the file
            populateSiteVisitsEditor(estimateId, visits, State.getState().estimates, window.handleSiteVisitAction || null);
        }

        modal.classList.add('hidden');
        showSuccessBanner("Site visit saved.");
    } catch (error) {
        console.error(error);
        showErrorBanner("Failed to save visit.");
    }
}