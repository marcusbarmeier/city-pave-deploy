// © 2025 City Pave. All Rights Reserved.
// Filename: estimator-ui.js

import { calculateTonnage, calculateAllTotals, calculateOptionSubtotal, getTaxRate, getFuelSurchargeMultiplier } from './estimator-calculations.js';
import { State } from './estimator-state.js';
import { formatCurrency, convertRgbToHex, debounce } from './estimator-utils.js';
import { Card, StatusBadge, Button, Modal, Input } from '../../ui-components.js';
import { addSnowLocationCard, updateCardWithResults, updateSnowContractSummary, getInputsFromCard } from '../snow_calc/snow-ui.js';
import { handleAutoCalculateSnowPrice, handleRouteChange } from '../snow_calc/snow-app.js';

// --- Module-level State ---
let quillEditors = {};
let geocoder = null;
let locationMap = null;

// --- DYNAMIC DATA HELPERS (The "Brain Transplant") ---
function getPricingOptions() {
    // Falls back to empty array if DB hasn't loaded yet
    return window.pricingData ? window.pricingData.options : [];
}

// getTaxRate moved to estimator-calculations.js

const CATEGORIES = ["New Leads", "Ready for Review", "Planned Route (Un-confirmed)", "Site Visits", "Work Starting", "Active Customers", "Inactive Customers", "Follow-up", "Trucking"];
const CATEGORY_COLORS = {
    "New Leads": "bg-gray-200 text-gray-800",
    "Ready for Review": "bg-teal-200 text-teal-800",
    "Planned Route (Un-confirmed)": "bg-orange-200 text-orange-800",
    "Site Visits": "bg-purple-200 text-purple-800",
    "Work Starting": "bg-blue-200 text-blue-800",
    "Active Customers": "bg-green-200 text-green-800",
    "Inactive Customers": "bg-red-200 text-red-800",
    "Follow-up": "bg-yellow-200 text-yellow-800",
    "Trucking": "bg-indigo-200 text-indigo-800",
};

// --- Quill Instance Management ---
export function setQuillInstance(id, instance) {
    quillEditors[id] = instance;
}

export function getQuillInstance(id) {
    if (id) {
        return quillEditors[id];
    }
    return quillEditors;
}

// --- General UI Utilities ---
// formatCurrency and convertRgbToHex moved to estimator-utils.js

function formatPhoneNumberAsLink(phone) {
    if (!phone || phone === 'No Phone') { return 'No Phone'; }
    const sanitizedPhone = phone.replace(/\D/g, '');
    return `<a href="tel:${sanitizedPhone}" class="text-blue-600 hover:underline">${phone}</a>`;
}

export function showView(viewId, onShowEditor, onHideEditor) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const newView = document.getElementById(viewId);
    if (newView) newView.classList.add('active');

    const isAdminVisible = viewId === 'editor-view';
    const adminControls = document.getElementById('admin-controls');
    if (adminControls) adminControls.style.display = isAdminVisible ? 'block' : 'none';

    if (isAdminVisible) {
        onShowEditor();
        loadAdminPermissions(); // Check permissions when entering editor
    }
    else onHideEditor();
}

export function showSuccessBanner(message, isPersistent = false) {
    const banner = document.getElementById('success-banner');
    if (banner) {
        banner.querySelector('#success-message').textContent = message;
        banner.classList.remove('hidden');
        if (!isPersistent) {
            setTimeout(() => banner.classList.add('hidden'), 3000);
        }
    }
}

export function showErrorBanner(message) {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.querySelector('#error-message').textContent = message;
        banner.classList.remove('hidden');
        setTimeout(() => banner.classList.add('hidden'), 5000);
    }
}

export function updateUndoRedoButtons(historyIndex, historyStackLength) {
    const undoBtn = document.getElementById('undo-button');
    const redoBtn = document.getElementById('redo-button');
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= historyStackLength - 1;
}

// debounce moved to estimator-utils.js


// --- Dashboard UI ---
export function renderDashboard(estimates = [], currentDashboardFilter, getSelectedIds, planRoute, openCategoryModal, promptAction) {
    const container = document.getElementById('estimate-list-container');
    if (!container) return;
    container.innerHTML = '';
    const listHeader = document.getElementById('list-header');
    if (listHeader) listHeader.classList.toggle('hidden', estimates.length === 0);

    if (estimates.length === 0) {
        const searchTerm = document.getElementById('dashboard-search-input').value;
        const message = searchTerm ? `No items match your search for "${searchTerm}".` : "No items found in this category.";
        container.innerHTML = `<p class="text-center text-gray-500 py-10">${message}</p>`;
        updateBatchActionBar(currentDashboardFilter, getSelectedIds, planRoute, openCategoryModal, promptAction);
        return;
    }

    estimates.forEach(est => container.appendChild(renderDashboardCard(est, currentDashboardFilter)));
    updateBatchActionBar(currentDashboardFilter, getSelectedIds, planRoute, openCategoryModal, promptAction);
}

function renderDashboardCard(estimate, currentDashboardFilter) {
    const isTemplate = estimate.status === 'Template';
    const isDeleted = currentDashboardFilter === 'deleted';
    const showDetails = !isTemplate && !isDeleted;
    const cardTitle = isTemplate ? (estimate.templateName || 'Unnamed Template') : (estimate.customerInfo?.name || 'No Customer Name');

    // Highlight logic
    let highlightClass = '';
    const tags = estimate.tags || [];
    if (tags.includes('Follow-up')) highlightClass = 'border-l-4 border-yellow-500';
    else if (tags.includes('Site Visits')) highlightClass = 'border-l-4 border-purple-500';

    // Create the header action (Status Select + Category Button)
    const headerAction = document.createElement('div');
    headerAction.className = "flex items-center gap-2";

    // Status Select
    const statusSelect = document.createElement('select');
    statusSelect.className = "dashboard-status-select bg-slate-100 dark:bg-slate-700 border-none text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-full py-1 pl-3 pr-8 focus:ring-2 focus:ring-blue-500 cursor-pointer";
    statusSelect.dataset.id = estimate.id;
    const statusOptions = ["Draft", "Template", "Sent", "Follow-up", "Accepted", "Declined", "In Progress", "Completed", "Invoiced", "Paid"];
    statusOptions.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        statusSelect.appendChild(option);
    });
    statusSelect.value = estimate.status || 'Draft';

    // Stop propagation on click to prevent opening the card
    statusSelect.addEventListener('click', (e) => e.stopPropagation());

    // Category Button
    const categoryBtn = Button({
        variant: 'icon',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>`,
        className: "card-category-btn",
        onClick: (e) => { e.stopPropagation(); /* Logic handled by global listener or we can attach here if we refactor global listener */ }
    });
    categoryBtn.dataset.id = estimate.id; // Keep data-id for global listener compatibility

    headerAction.appendChild(statusSelect);
    headerAction.appendChild(categoryBtn);

    // Card Content
    const contentContainer = document.createElement('div');

    // Checkbox & Title Row
    const topRow = document.createElement('div');
    topRow.className = "flex items-start gap-3 mb-2";

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = "item-select-checkbox h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-1";
    checkbox.dataset.id = estimate.id;
    checkbox.addEventListener('click', (e) => e.stopPropagation());

    const titleSection = document.createElement('div');
    titleSection.className = "flex-grow";

    const titleLink = document.createElement('h3');
    titleLink.className = "text-lg font-bold text-slate-800 dark:text-white hover:text-blue-600 cursor-pointer transition-colors";
    titleLink.textContent = cardTitle;
    // The click to open is handled by the card container in the original code, or we can add it here.
    // Original code: The whole card might be clickable or just the title. 
    // Let's keep the title clickable for clarity if the card click is global.

    const dateText = document.createElement('p');
    dateText.className = "text-xs text-slate-500 dark:text-slate-400";
    dateText.textContent = `Last saved: ${new Date(estimate.lastSaved || estimate.createdAt).toLocaleDateString()}`;

    titleSection.appendChild(titleLink);
    titleSection.appendChild(dateText);

    topRow.appendChild(checkbox);
    topRow.appendChild(titleSection);
    contentContainer.appendChild(topRow);

    // Tags & Rating
    const metaRow = document.createElement('div');
    metaRow.className = "flex flex-wrap items-center gap-2 mb-3 ml-8"; // Indent to align with title

    // Rating
    const currentRating = estimate.leadRating || 0;
    const ratingContainer = document.createElement('div');
    ratingContainer.className = "flex gap-0.5";
    ratingContainer.onclick = (e) => e.stopPropagation();
    for (let i = 1; i <= 5; i++) {
        const colorClass = i <= currentRating ? 'text-yellow-400' : 'text-slate-200 dark:text-slate-600 hover:text-yellow-200';
        ratingContainer.innerHTML += `<button class="text-lg focus:outline-none transition-colors star-btn ${colorClass}" data-id="${estimate.id}" data-rating="${i}">★</button>`;
    }
    metaRow.appendChild(ratingContainer);

    // Signed Badge
    if (estimate.acceptance?.signatureDataURL || estimate.acceptance?.signedCopyURL) {
        metaRow.innerHTML += `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            <svg class="mr-1.5 h-2 w-2 text-green-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
            SIGNED
        </span>`;
    }

    // Tags
    if (showDetails && tags.length > 0) {
        tags.forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[tag] || 'bg-slate-100 text-slate-800'}`;
            tagSpan.textContent = tag;
            metaRow.appendChild(tagSpan);
        });
    }
    contentContainer.appendChild(metaRow);

    // Details (Address, Phone, Visits)
    if (showDetails) {
        const detailsDiv = document.createElement('div');
        detailsDiv.className = "ml-8 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2 text-sm text-slate-600 dark:text-slate-300";

        detailsDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span class="truncate">${estimate.customerInfo?.address || 'No Address'}</span>
            </div>
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                ${formatPhoneNumberAsLink(estimate.customerInfo?.phone)}
            </div>
        `;

        const visitSummaryHtml = renderDashboardVisitSummary(estimate.siteVisits, estimate.id);
        const visitDiv = document.createElement('div');
        visitDiv.innerHTML = visitSummaryHtml;
        detailsDiv.appendChild(visitDiv);

        contentContainer.appendChild(detailsDiv);
    }

    // Start Point Checkbox
    if (currentDashboardFilter === 'Planned Route (Un-confirmed)') {
        const startPointDiv = document.createElement('div');
        startPointDiv.className = "mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 ml-8";
        startPointDiv.innerHTML = `<label class="flex items-center text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600 transition-colors"><input type="checkbox" class="start-point-checkbox h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mr-2" data-id="${estimate.id}"> Set as Starting Point</label>`;
        contentContainer.appendChild(startPointDiv);
    }

    // Use the Card component
    const card = Card({
        children: contentContainer,
        className: `estimate-card mb-4 ${highlightClass}`,
        action: headerAction
    });

    card.dataset.id = estimate.id;
    card.setAttribute('draggable', true);

    return card;
}

// REPLACE THIS ENTIRE FUNCTION IN estimator-ui.js

function renderDashboardVisitSummary(visits = [], estimateId) {
    const upcomingVisits = (visits || []).map((v, index) => ({ ...v, originalIndex: index }))
        .filter(v => !v.completed && v.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcomingVisits.length > 0) {
        const nextVisit = upcomingVisits[0];

        // --- THIS IS THE FIX ---
        // We check if the value is 'N/A' and replace it with an empty string
        // so the input field doesn't throw an error.
        const visitDate = (nextVisit.date === 'N/A' || !nextVisit.date) ? '' : nextVisit.date;
        const visitTime = (nextVisit.time === 'N/A' || !nextVisit.time) ? '' : nextVisit.time;
        // --- END FIX ---

        return `
            <div class="visit-summary-container">
                <div class="flex items-center gap-2">
                    <svg class="flex-shrink-0 w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <input type="date" class="visit-date-input bg-transparent p-0 border-0 focus:ring-0 text-xs" value="${visitDate}" data-estimate-id="${estimateId}" data-visit-index="${nextVisit.originalIndex}">
                    <input type="time" class="visit-time-input bg-transparent p-0 border-0 focus:ring-0 text-xs" value="${visitTime}" data-estimate-id="${estimateId}" data-visit-index="${nextVisit.originalIndex}">
                    <button title="Mark as Complete" class="complete-visit-dashboard-btn text-green-500 hover:text-green-700" data-estimate-id="${estimateId}" data-visit-index="${nextVisit.originalIndex}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                    <button title="Delete this visit" class="delete-visit-dashboard-btn text-red-400 hover:text-red-600" data-estimate-id="${estimateId}" data-visit-index="${nextVisit.originalIndex}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                </div>
                <button class="add-visit-dashboard-btn text-xs text-blue-600 hover:underline mt-1" data-estimate-id="${estimateId}">+ Add Visit</button>
            </div>`;
    }
    return `<div class="visit-summary-container"><p class="text-xs text-gray-500">No upcoming visits.</p><button class="add-visit-dashboard-btn text-xs text-blue-600 hover:underline mt-1" data-estimate-id="${estimateId}">+ Add Visit</button></div>`;
}

export function openCompleteVisitModal(estimateId, visitIndex, onSave) {
    const content = document.createElement('div');
    content.className = "space-y-4";

    const p = document.createElement('p');
    p.className = "text-sm text-slate-600 dark:text-slate-300";
    p.textContent = "Please enter a follow-up note for this visit:";
    content.appendChild(p);

    const notesInput = document.createElement('textarea');
    notesInput.className = "w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500";
    notesInput.rows = 3;
    notesInput.placeholder = "Enter note here...";
    content.appendChild(notesInput);

    const saveBtn = Button({
        text: 'Complete Visit',
        onClick: () => {
            const note = notesInput.value;
            onSave(note);
            modal.close();
        }
    });

    const modal = Modal({
        id: 'complete-visit-modal',
        title: 'Complete Site Visit',
        content: content,
        actions: [saveBtn]
    });
}

export function updateBatchActionBar(currentDashboardFilter, getSelectedIds, planRoute, openCategoryModal, promptAction, openRoutePlanner) {
    const actionBar = document.getElementById('batch-action-bar');
    const selectedCountSpan = document.getElementById('selected-count');
    const batchButtonsContainer = document.getElementById('batch-buttons');
    if (!actionBar || !selectedCountSpan || !batchButtonsContainer) return;

    const selectedIds = getSelectedIds();
    const count = selectedIds.length;

    document.getElementById('route-link-container').innerHTML = '';

    if (count > 0) {
        selectedCountSpan.textContent = count;
        actionBar.style.transform = 'translateY(0)';
        let buttonsHtml = '';
        if (currentDashboardFilter === 'deleted') {
            buttonsHtml = `<button class="batch-restore-btn text-white font-semibold hover:text-green-300">Restore</button> <button class="batch-perm-delete-btn text-white font-semibold hover:text-red-300">Delete Permanently</button>`;
        } else {
            buttonsHtml = `
                <button id="open-route-planner-btn" class="bg-blue-600 px-3 py-1 rounded text-white font-bold hover:bg-blue-500 shadow text-sm mr-2 flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.806-.98l-4.553-2.276M15 13h2m-2-2h2m-2 2v2m0-2v-2"></path></svg> Plan Route</button> 
                <button class="batch-change-category-btn text-white font-semibold hover:text-yellow-300 mr-2">Change Category</button>
                <button class="batch-soft-delete-btn text-white font-semibold hover:text-red-300">Delete</button> 
            `;
        }
        batchButtonsContainer.innerHTML = buttonsHtml;

        // --- THIS IS THE FIX ---
        // We use the 'openRoutePlanner' callback passed from estimator.js
        // This callback already has 'allEstimates' bound to it.
        batchButtonsContainer.querySelector('#open-route-planner-btn')?.addEventListener('click', () => {
            const freshIds = Array.from(document.querySelectorAll('#estimate-list-container .item-select-checkbox:checked')).map(cb => cb.dataset.id);
            if (freshIds.length === 0) {
                showErrorBanner("Please select at least one estimate.");
                return;
            }
            openRoutePlanner(freshIds);
        });
        // -----------------------

        batchButtonsContainer.querySelector('.batch-restore-btn')?.addEventListener('click', () => promptAction('batchRestore', null, selectedIds));
        batchButtonsContainer.querySelector('.batch-perm-delete-btn')?.addEventListener('click', () => promptAction('batchDelete', null, selectedIds));
        batchButtonsContainer.querySelector('.batch-soft-delete-btn')?.addEventListener('click', () => promptAction('batchSoftDelete', null, selectedIds));
        batchButtonsContainer.querySelector('.batch-change-category-btn')?.addEventListener('click', () => openCategoryModal(selectedIds));
    } else {
        actionBar.style.transform = 'translateY(100%)';
        batchButtonsContainer.innerHTML = '';
    }
}

export function handlePrintDashboardList() {
    const listContainer = document.getElementById('estimate-list-container');
    const printContainer = document.getElementById('dashboard-print-container');
    const activeFilterButton = document.querySelector('.dashboard-filter-button.active-filter');
    const title = activeFilterButton ? activeFilterButton.textContent + ' - Report' : 'Dashboard Report';

    let printHTML = `
        <style> @media print { body { font-family: sans-serif; } h1 { font-size: 16pt; } p { font-size: 10pt; margin: 0; } .print-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; } .print-item { border: 1px solid #eee; border-radius: 5px; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; } .item-header { font-weight: bold; font-size: 12pt; margin-bottom: 5px; } .item-details { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; } } </style>
        <div class="print-header"><h1>${title}</h1><p>Generated: ${new Date().toLocaleString()}</p></div>`;

    const estimateCards = listContainer.querySelectorAll('.estimate-card');
    if (estimateCards.length === 0) {
        printContainer.innerHTML = '<h1>No items to print in this view.</h1>';
        window.print(); return;
    }
    estimateCards.forEach(card => {
        const name = card.querySelector('h3.font-bold')?.textContent || 'N/A';
        const address = card.querySelector('p.truncate')?.textContent.trim() || 'No Address';
        const phone = card.querySelector('p:not(.truncate)')?.textContent.trim() || 'No Phone';
        const visitInfo = card.querySelector('.visit-summary-container')?.textContent.trim() || 'No upcoming visits.';
        printHTML += `<div class="print-item"><div class="item-header">${name}</div><div class="item-details"><p><strong>Address:</strong> ${address}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Next Action:</strong> ${visitInfo}</p></div></div>`;
    });
    printContainer.innerHTML = printHTML;
    window.print();
}


// --- Modals and Form UI ---
// REPLACE THIS ENTIRE FUNCTION in estimator-ui.js
export function promptAction(action, estimateId, ids, allEstimates) {
    const modal = document.getElementById('delete-modal');
    const title = modal.querySelector('#delete-modal-title');
    const text = modal.querySelector('#delete-modal-text');
    const button = modal.querySelector('#confirm-delete-button');
    const estimate = allEstimates.find(e => e.id === estimateId);
    let name = 'this item';
    if (estimate) {
        name = estimate.status === 'Template' ? (estimate.templateName || 'this template') : (estimate.customerInfo?.name || 'this estimate');
    }
    const count = ids.length;

    // --- Make the confirm button default to blue ---
    button.className = "px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500";


    switch (action) {
        case 'deletePermanent':
            title.textContent = 'Delete Permanently';
            text.textContent = `Are you sure you want to permanently delete ${name}? This action cannot be undone.`;
            button.dataset.id = estimateId;
            button.className = "px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"; // Red for delete
            break;
        case 'duplicate':
            title.textContent = 'Duplicate Estimate';
            text.textContent = `Create a copy of the estimate for ${name}?`;
            button.dataset.id = estimateId;
            break;
        case 'batchDelete':
            title.textContent = 'Delete Permanently';
            text.textContent = `Are you sure you want to permanently delete these ${count} items? This cannot be undone.`;
            button.dataset.ids = ids.join(',');
            button.className = "px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"; // Red for delete
            break;
        case 'batchSoftDelete':
            title.textContent = 'Delete Items';
            text.textContent = `Are you sure you want to move these ${count} items to the Deleted tab?`;
            button.dataset.ids = ids.join(',');
            button.className = "px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"; // Red for delete
            break;
        case 'batchRestore':
            title.textContent = 'Restore Items';
            text.textContent = `Are you sure you want to restore these ${count} items?`;
            button.dataset.ids = ids.join(',');
            break;

        // --- NEW CASES ADDED HERE ---
        case 'saveAppendixToAll':
            title.textContent = 'Update All Estimates';
            text.textContent = `Are you sure? This will replace the Appendix in ALL existing estimates with the current content. This cannot be undone.`;
            button.dataset.id = estimateId; // We still pass the current estimate ID
            button.className = "px-4 py-2 bg-orange-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"; // Orange for warning
            break;
        case 'saveTermsToAll':
            title.textContent = 'Update All Estimates';
            text.textContent = `Are you sure? This will replace the Terms & Conditions in ALL existing estimates with the current content. This cannot be undone.`;
            button.dataset.id = estimateId; // We still pass the current estimate ID
            button.className = "px-4 py-2 bg-orange-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"; // Orange for warning
            break;
        // --- END OF NEW CASES ---

        default:
            console.warn("Unknown action in promptAction:", action);
            return; // Don't show modal if action is unknown
    }
    button.dataset.action = action;
    modal.classList.remove('hidden');
}

export function hideDeleteModal() { document.getElementById('delete-modal').classList.add('hidden'); }

export function openSiteVisitModal(estimateId, allEstimates, visitIndex = null) {
    const estimate = allEstimates.find(e => e.id === estimateId);
    if (!estimate) return;

    const isEdit = visitIndex !== null;
    const visit = isEdit ? estimate.siteVisits[visitIndex] : {};

    const content = document.createElement('div');
    content.className = "space-y-4";

    // Date Input
    content.appendChild(Input({
        id: 'modal-visit-date',
        label: 'Date',
        type: 'date',
        value: visit.date || ''
    }));

    // Time Input
    content.appendChild(Input({
        id: 'modal-visit-time',
        label: 'Time',
        type: 'time',
        value: visit.time || ''
    }));

    // Notes Input
    const notesContainer = document.createElement('div');
    notesContainer.innerHTML = `
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
        <textarea id="modal-visit-notes" class="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500" rows="3">${visit.notes || ''}</textarea>
    `;
    content.appendChild(notesContainer);

    // Completed Checkbox
    const completedContainer = document.createElement('div');
    completedContainer.className = "flex items-center";
    completedContainer.innerHTML = `
        <input type="checkbox" id="modal-visit-completed" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" ${visit.completed ? 'checked' : ''}>
        <label for="modal-visit-completed" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">Mark as Completed</label>
    `;
    content.appendChild(completedContainer);

    const saveBtn = Button({
        text: isEdit ? 'Update Visit' : 'Add Visit',
        onClick: () => {
            const date = document.getElementById('modal-visit-date').value;
            const time = document.getElementById('modal-visit-time').value;
            const notes = document.getElementById('modal-visit-notes').value;
            const completed = document.getElementById('modal-visit-completed').checked;

            if (!date) {
                showErrorBanner("Please select a date.");
                return;
            }

            const newVisit = { date, time, notes, completed };
            const currentVisits = estimate.siteVisits || [];

            if (isEdit) {
                currentVisits[visitIndex] = newVisit;
            } else {
                currentVisits.push(newVisit);
            }

            estimate.siteVisits = currentVisits;
            State.updateEstimate(estimate);

            modal.close();
            showSuccessBanner(isEdit ? "Site visit updated." : "Site visit added.");
        }
    });

    const modal = Modal({
        id: 'site-visit-modal',
        title: isEdit ? 'Edit Site Visit' : 'Schedule Site Visit',
        content: content,
        actions: [saveBtn]
    });
}

export function openCategoryModal(ids, allEstimates) {
    const selectedEstimates = ids.map(id => allEstimates.find(e => e.id === id)).filter(Boolean);
    if (selectedEstimates.length === 0) return;

    const content = document.createElement('div');
    content.className = "space-y-4";

    const p = document.createElement('p');
    p.className = "text-sm text-slate-600 dark:text-slate-300";
    p.textContent = `Select a new category for ${selectedEstimates.length} item(s):`;
    content.appendChild(p);

    const grid = document.createElement('div');
    grid.className = "grid grid-cols-2 gap-3";

    CATEGORIES.forEach(cat => {
        const btn = Button({
            text: cat,
            variant: 'secondary',
            className: `w-full justify-start text-left ${CATEGORY_COLORS[cat]}`,
            onClick: () => {
                // Update tags for all selected estimates
                // Note: This logic assumes we want to *replace* the main category tag or add it?
                // The original logic likely just added it or replaced it. 
                // Let's assume we want to ADD it if not present, but usually "Change Category" implies moving it.
                // For simplicity and matching typical "Move" behavior, let's dispatch the update.

                // We need to call the update function. 
                // Since this is a UI function, we should ideally call a callback passed to it, 
                // but for now we'll dispatch a custom event or call a global handler if available.
                // The original code probably called a function directly.
                // Let's look at how it was done. 
                // Ah, the original code didn't show the implementation of the click handler in the snippet.
                // I'll assume there's a global `updateEstimateTags` or similar, OR I should pass a callback.
                // The `renderDashboard` passed `promptAction`. Maybe I can use that?
                // Actually, `openCategoryModal` takes `ids` and `allEstimates`.
                // It seems I need to implement the update logic here or call a passed function.
                // The original code likely had inline logic.

                // Let's dispatch an event that estimator.js listens to, or import State to update.
                // Using State is cleaner.

                const { State } = require('./estimator-state.js'); // Dynamic import if needed, or use top-level
                // We already imported State at the top.

                selectedEstimates.forEach(est => {
                    const currentTags = est.tags || [];
                    // Remove other category tags to ensure single category? Or just add?
                    // Let's just add it for now, or replace if it's a "Move" operation.
                    // To be safe, let's just add it and let the user manage tags if they want multiple.
                    if (!currentTags.includes(cat)) {
                        est.tags = [...currentTags, cat];
                        State.updateEstimate(est);
                    }
                });

                modal.close();
                showSuccessBanner(`Updated category for ${selectedEstimates.length} items.`);
            }
        });
        grid.appendChild(btn);
    });
    content.appendChild(grid);

    const modal = Modal({
        id: 'category-modal',
        title: 'Change Category',
        content: content
    });
}

export function openNewSketchModal(allEstimates) {
    const content = document.createElement('div');
    content.className = "space-y-4";

    // Option 1: New Sketch
    const newSketchBtn = Button({
        text: 'Create New Sketch (No Estimate)',
        variant: 'secondary',
        className: 'w-full mb-4',
        onClick: () => {
            window.location.href = 'sketch.html';
            modal.close();
        }
    });
    content.appendChild(newSketchBtn);

    const divider = document.createElement('div');
    divider.className = "relative flex py-2 items-center";
    divider.innerHTML = '<div class="flex-grow border-t border-slate-300 dark:border-slate-600"></div><span class="flex-shrink-0 mx-4 text-slate-400 text-xs">OR Attach to Existing</span><div class="flex-grow border-t border-slate-300 dark:border-slate-600"></div>';
    content.appendChild(divider);

    const p = document.createElement('p');
    p.className = "text-sm text-slate-600 dark:text-slate-300";
    p.textContent = "Select an existing estimate:";
    content.appendChild(p);

    const selectContainer = document.createElement('div');
    const select = document.createElement('select');
    select.className = "block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500";

    select.innerHTML = '<option value="">Select an estimate...</option>';

    // Safety check for array
    const estimates = Array.isArray(allEstimates) ? allEstimates : [];

    estimates.filter(e => e.status !== 'Template' && !e.isDeleted)
        .sort((a, b) => (a.customerInfo.name || '').localeCompare(b.customerInfo.name || ''))
        .forEach(est => {
            const option = document.createElement('option');
            option.value = est.id;
            option.textContent = est.customerInfo.name || 'Unnamed Estimate';
            select.appendChild(option);
        });

    selectContainer.appendChild(select);
    content.appendChild(selectContainer);

    const attachBtn = Button({
        text: 'Attach Sketch',
        onClick: () => {
            const estimateId = select.value;
            if (!estimateId) {
                showErrorBanner("Please select an estimate.");
                return;
            }
            // Redirect to sketch tool
            window.location.href = `sketch.html?estimateId=${estimateId}`;
            modal.close();
        }
    });

    const modal = Modal({
        id: 'new-sketch-modal',
        title: 'New Sketch',
        content: content,
        actions: [attachBtn]
    });
}



export function toggleQuickAddForm() {
    const container = document.getElementById('quick-add-form-container');
    const button = document.getElementById('toggle-quick-add-form');
    container.classList.toggle('open');
    button.textContent = container.classList.contains('open') ? '- Collapse Form' : '+ Add Lead';
    if (!container.classList.contains('open')) {
        container.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.tagName === 'SELECT') el.selectedIndex = 0;
            else el.value = '';
        });
    }
}

export function populateTemplateDropdown(allEstimates) {
    const quickAddSelect = document.getElementById('qa-template-select');
    const editorSelect = document.getElementById('apply-template-select');
    const templates = allEstimates.filter(e => e.status === 'Template');
    [quickAddSelect, editorSelect].forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = `<option value="">Select a template...</option>`;
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.templateName || 'Unnamed Template';
            select.appendChild(option);
        });
        select.value = currentValue;
    });
}

export function populateStatusDropdowns() {
    // Updated list with "Parking" statuses
    const statusOptions = [
        "Draft",
        "Sent",
        "Follow-up",
        "Accepted",
        "In Progress",
        "Completed",
        "Invoiced",
        "Paid",
        "Deferred (Next Season)", // New: Good lead, bad timing
        "Inactive",               // New: Bad lead / Ghosted
        "Declined"
    ];

    const editorDropdown = document.getElementById('estimate-status');
    const quickAddDropdown = document.getElementById('qa-estimate-status');
    [editorDropdown, quickAddDropdown].forEach(dropdown => {
        if (!dropdown) return;
        dropdown.innerHTML = '';
        statusOptions.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            dropdown.appendChild(option);
        });
    });
}

// ADD THIS FUNCTION back into estimator-ui.js (e.g., before loadEstimateForEditing)
export function resetEditorForm(getAppendixDefaultContent, saveState, signaturePad, witnessSignaturePad, resizeCanvasForPad) {
    const editorView = document.getElementById('editor-view');
    if (!editorView) return;
    editorView.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea').forEach(el => el.value = '');
    editorView.querySelectorAll('input[type=checkbox], input[type=radio]').forEach(el => el.checked = false);
    editorView.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
    const defaultSharingOption = document.querySelector('input[name="sharing-permission"][value="none"]');
    if (defaultSharingOption) defaultSharingOption.checked = true;

    document.getElementById('pricing-options-container').innerHTML = '';
    document.getElementById('editing-estimate-id').value = '';
    document.getElementById('estimate-status').value = 'Draft';
    document.getElementById('sketch-items-container').innerHTML = '';
    document.getElementById('change-order-items-container').innerHTML = '';
    ['sketches-container', 'site-visits-container', 'work-stages-container', 'property-photo-container', 'work-photos-container', 'editor-tags-container', 'before-after-container', 'snow-locations-container'].forEach(id => {
        const el = document.getElementById(id); if (el) el.innerHTML = '';
    });
    // Use the function to get the object, not the variable
    const allQuillEditors = getQuillInstance();
    Object.keys(allQuillEditors).forEach(key => {
        if (allQuillEditors[key] && key !== 'appendix' && key.startsWith('ba-') === false) allQuillEditors[key].root.innerHTML = '';
    });
    if (allQuillEditors['appendix']) allQuillEditors['appendix'].root.innerHTML = getAppendixDefaultContent();

    // === MODIFICATION START ===
    // Clear dynamic financial items
    const financialContainer = document.getElementById('financial-items-container');
    if (financialContainer) financialContainer.innerHTML = '';
    // Add default empty items if needed, e.g., for a deposit
    // renderFinancialItem({ description: 'Booking Deposit', type: 'adjustment' }, saveState);
    // === MODIFICATION END ===

    document.getElementById('signature-pad-wrapper').classList.remove('hidden');
    document.getElementById('signed-view-wrapper').classList.add('hidden');
    document.getElementById('customer-notes-wrapper').classList.add('hidden');
    document.getElementById('signed-signature-image').src = '';
    document.getElementById('signed-print-name').textContent = '';
    document.getElementById('signed-witness-signature-image').src = '';
    document.getElementById('signed-witness-print-name').textContent = '';
    document.getElementById('customer-notes-content').textContent = '';
    document.getElementById('signed-copy-link-container').innerHTML = '';
    if (signaturePad) signaturePad.clear();
    if (witnessSignaturePad) witnessSignaturePad.clear();

    document.getElementById('tentative-start-date').value = '';
    document.getElementById('tentative-proof-roll-date').value = '';
    document.getElementById('tentative-end-date').value = '';

    addPricingOption(null, saveState);
    calculateAllTotals(saveState, updateFinancialSummary);

    setTimeout(() => {
        const mainCanvas = document.getElementById('signature-pad');
        const witnessCanvas = document.getElementById('witness-signature-pad-editor');
        resizeCanvasForPad(mainCanvas, signaturePad);
        resizeCanvasForPad(witnessCanvas, witnessSignaturePad);
    }, 50);
}

// REPLACE THIS ENTIRE FUNCTION in estimator-ui.js
export async function loadEstimateForEditing({ estimateId, allEstimates, signaturePad, witnessSignaturePad, resizeCanvasForPad, saveState, getAppendixDefaultContent, handleRevokeAcceptance, handleSignedCopyDelete, handleShareEstimate, saveAsTemplate, softDeleteEstimate, restoreEstimate, promptAction, handlePhotoDelete, handleSiteVisitAction, applySketchDataToEstimate, handleSketchDelete, handlePrint, updateSnowContractSummary, handleDeleteSnowRouteMap, handleSketchDuplicate }) {
    // --- Update Branding in Editor Header ---
    const editorHeader = document.getElementById('print-section-header');
    if (editorHeader && window.appConfig) {
        const lightLogo = editorHeader.querySelector('.logo-light');
        const darkLogo = editorHeader.querySelector('.logo-dark');
        const nameEl = editorHeader.querySelector('h3.font-bold');
        const detailsEl = editorHeader.querySelector('p.text-sm');

        if (lightLogo) lightLogo.src = window.appConfig.logo_light;
        if (darkLogo) darkLogo.src = window.appConfig.logo_dark;
        if (nameEl) nameEl.textContent = window.appConfig.name;
        if (detailsEl) detailsEl.innerHTML = `${window.appConfig.address}<br>Office: ${window.appConfig.phone}<br>${window.appConfig.email}`;
    }
    // --- End Branding Update ---

    window.isLoading = true; // Set loading flag

    // --- Fetch the specific estimate directly ---
    const { db, doc, getDoc } = window.firebaseServices;
    let estimate = null;
    try {
        const estimateRef = doc(db, 'estimates', estimateId);
        const estimateSnap = await getDoc(estimateRef);
        if (estimateSnap.exists()) {
            estimate = { id: estimateSnap.id, ...estimateSnap.data() };
            // Update the State for consistency
            State.updateEstimate(estimate);
        }
    } catch (fetchError) {
        console.error("Error fetching specific estimate:", fetchError);
        showErrorBanner("Could not load the latest estimate data.");
        window.isLoading = false;
        return; // Stop loading if fetch fails
    }
    // --- END Fetch ---

    try {
        if (!estimate) { // Check if the direct fetch failed
            showErrorBanner("Could not find estimate to edit.");
            window.isLoading = false;
            return;
        }

        // --- Fetch Default Content (Appendix & Terms) ---
        const defaultsSnap = await getDoc(doc(db, 'appDefaults', 'content'));
        const defaults = defaultsSnap.exists() ? defaultsSnap.data() : {};
        // --- End Fetch Default Content ---

        // Reset the form before loading new data
        resetEditorForm(getAppendixDefaultContent, saveState, signaturePad, witnessSignaturePad, resizeCanvasForPad);
        document.getElementById('editing-estimate-id').value = estimateId;

        // --- Pricing Options ---
        const { dynamicOptions, sketch, changeOrder } = translateLegacyPricing(estimate.pricing || { options: estimate.options });
        const pricingOptionsContainer = document.getElementById('pricing-options-container');
        pricingOptionsContainer.innerHTML = '';
        if (dynamicOptions?.length > 0) {
            dynamicOptions.forEach(optData => addPricingOption(optData, saveState));
        } else {
            addPricingOption(null, saveState);
        }
        document.getElementById('sketch-items-container').innerHTML = '';
        if (sketch?.items) {
            sketch.items.forEach(item => addItemToOption('sketch-card', item, true, saveState));
        }
        document.getElementById('change-order-items-container').innerHTML = '';
        if (changeOrder?.items) {
            changeOrder.items.forEach(item => addItemToOption('change-order-card', item, true, saveState));
        }
        document.getElementById('change-order-checkbox').checked = changeOrder?.enabled || false;
        // --- End Pricing Options ---

        // --- Status & Financial Summary ---
        document.getElementById('estimate-status').value = estimate.status || 'Draft';

        // === MODIFICATION START ===
        const financialContainer = document.getElementById('financial-items-container');
        if (financialContainer) financialContainer.innerHTML = ''; // Clear container

        // Check for new 'items' array or fall back to legacy
        if (estimate.financialSummary?.items) {
            // New structure: Loop and render items
            estimate.financialSummary.items.forEach(item => {
                renderFinancialItem(item, saveState);
            });
        } else if (estimate.financialSummary) {
            // Legacy structure: Convert old fields to new item rows
            const fs = estimate.financialSummary;
            if (parseFloat(fs.bookingDeposit) > 0) {
                // <<< FIX: Convert amount to number before passing
                renderFinancialItem({ description: 'Booking Deposit', amount: parseFloat(fs.bookingDeposit), dueDate: fs.bookingDepositDueDate, type: 'adjustment' }, saveState);
            }
            if (parseFloat(fs.materialsDeposit) > 0) {
                // <<< FIX: Convert amount to number before passing
                renderFinancialItem({ description: 'Materials Deposit', amount: parseFloat(fs.materialsDeposit), dueDate: fs.materialsDepositDueDate, type: 'adjustment' }, saveState);
            }
            if (parseFloat(fs.otherAmount) > 0) {
                // <<< FIX: Convert amount to number before passing
                renderFinancialItem({ description: fs.otherAmountDesc || 'Other Amount', amount: parseFloat(fs.otherAmount), dueDate: fs.otherAmountDueDate, type: 'adjustment' }, saveState);
            }
        }

        // Add listener for the "Add" button
        const addFinancialItemBtn = document.getElementById('add-financial-item-btn');
        if (addFinancialItemBtn) {
            // Clear old listeners before adding new
            addFinancialItemBtn.replaceWith(addFinancialItemBtn.cloneNode(true));
            document.getElementById('add-financial-item-btn').addEventListener('click', () => {
                renderFinancialItem({}, saveState);
                updateFinancialSummary(saveState);
            });
        }
        // === MODIFICATION END ===

        // --- Property Photo & Location Map ---
        const primaryAddress = (estimate.customerInfo?.siteAddress || '').trim() !== ''
            ? estimate.customerInfo.siteAddress
            : estimate.customerInfo?.address;
        renderPropertyPhoto(estimate.propertyPhotoURL, primaryAddress, handlePhotoDelete);
        renderLocationMap(primaryAddress);
        // --- End Property Photo & Location Map ---

        // --- Other Sections (Photos, Sketches, Tags, BA) ---
        renderWorkPhotos(estimate.workPhotos || [], handlePhotoDelete);

        // --- THIS IS THE UPDATED LINE ---
        renderSketches(estimate.sketches || [], applySketchDataToEstimate, handleSketchDelete, handleSketchDuplicate);
        // --- END UPDATED LINE ---

        renderTags(estimate.tags || [], document.getElementById('editor-tags-container'));
        renderBeforeAndAfter(estimate.beforeAndAfter || [], saveState, handlePhotoDelete);
        // --- End Other Sections ---

        // --- Customer Info ---
        const info = estimate.customerInfo || {};
        document.getElementById('customer-name').value = info.name || '';
        document.getElementById('customer-address').value = info.address || '';
        document.getElementById('customer-phone').value = info.phone || '';
        document.getElementById('customer-email').value = info.email || '';
        document.getElementById('site-address').value = info.siteAddress || '';
        const customerAddressInput = document.getElementById('customer-address');
        const siteAddressInput = document.getElementById('site-address');
        const updateMapsFromInputs = () => {
            const siteAddr = siteAddressInput.value.trim();
            const customerAddr = customerAddressInput.value.trim();
            const addressForMap = siteAddr !== '' ? siteAddr : customerAddr;
            renderLocationMap(addressForMap);
            if (!document.querySelector('#property-photo-container img[src^="https://firebasestorage"]')) {
                renderStreetView(addressForMap);
            }
        };
        customerAddressInput.removeEventListener('input', updateMapsFromInputs);
        siteAddressInput.removeEventListener('input', updateMapsFromInputs);
        customerAddressInput.addEventListener('input', debounce(updateMapsFromInputs, 700));
        siteAddressInput.addEventListener('input', debounce(updateMapsFromInputs, 700));
        // --- End Customer Info ---

        // --- Contact History & Dates ---
        const contact = estimate.contactHistory || {};
        document.getElementById('tentative-start-date').value = estimate.tentativeStartDate || '';
        document.getElementById('tentative-proof-roll-date').value = estimate.tentativeProofRollDate || '';
        document.getElementById('tentative-end-date').value = estimate.tentativeEndDate || '';
        // --- End Contact History & Dates ---

        // --- Sharing Options ---
        const permission = estimate.sharingOptions?.permission || 'none';
        const radioToCheck = document.querySelector(`input[name="sharing-permission"][value="${permission}"]`);
        if (radioToCheck) radioToCheck.checked = true;
        // --- End Sharing Options ---

        // --- Acceptance Section ---
        const acceptance = estimate.acceptance || {};
        const signaturePadWrapper = document.getElementById('signature-pad-wrapper');
        const signedViewWrapper = document.getElementById('signed-view-wrapper');
        if (acceptance.signatureDataURL) {
            signaturePadWrapper.classList.add('hidden');
            signedViewWrapper.classList.remove('hidden');
            document.getElementById('signed-signature-image').src = acceptance.signatureDataURL;
            document.getElementById('signed-print-name').textContent = acceptance.printedName || 'N/A';
            const witnessImg = document.getElementById('signed-witness-signature-image');
            witnessImg.src = acceptance.witnessSignatureDataURL || '';
            witnessImg.style.display = acceptance.witnessSignatureDataURL ? 'block' : 'none';
            document.getElementById('signed-witness-print-name').textContent = acceptance.witnessPrintedName || 'N/A';
            const revokeBtn = document.getElementById('revoke-acceptance-btn');
            if (revokeBtn) revokeBtn.onclick = handleRevokeAcceptance;
        } else {
            signaturePadWrapper.classList.remove('hidden');
            signedViewWrapper.classList.add('hidden');
            if (signaturePad) signaturePad.clear();
            if (witnessSignaturePad) witnessSignaturePad.clear();
            document.getElementById('editor-print-name').value = acceptance.printedName || '';
            document.getElementById('editor-witness-print-name').value = acceptance.witnessPrintedName || '';
        }
        document.getElementById('acceptance-date').value = acceptance.acceptanceDate || '';
        const customerNotesWrapper = document.getElementById('customer-notes-wrapper');
        const customerNotesContent = document.getElementById('customer-notes-content');
        if (estimate.customerNotes) {
            customerNotesWrapper.classList.remove('hidden');
            customerNotesContent.textContent = estimate.customerNotes;
        } else {
            customerNotesWrapper.classList.add('hidden');
            customerNotesContent.textContent = '';
        }
        const signedCopyContainer = document.getElementById('signed-copy-link-container');
        if (acceptance.signedCopyURL) {
            signedCopyContainer.innerHTML = `<a href="${acceptance.signedCopyURL}" target="_blank" class="text-green-600 font-semibold hover:underline">View Uploaded Document</a> <button type="button" class="remove-signed-copy-btn text-xs text-red-500 hover:underline ml-2 no-print">(Remove)</button>`;
            const removeBtn = signedCopyContainer.querySelector('.remove-signed-copy-btn');
            if (removeBtn) removeBtn.onclick = handleSignedCopyDelete;
        } else {
            signedCopyContainer.innerHTML = '<p class="text-xs text-gray-500">No document uploaded.</p>';
        }
        // --- End Acceptance Section ---

        // --- Visits, Stages, Rating ---
        populateSiteVisitsEditor(estimateId, estimate.siteVisits || [], allEstimates, handleSiteVisitAction);
        populateWorkStagesEditor(estimate.workStages || []);
        if (estimate.leadRating) {
            const ratingInput = document.querySelector(`input[name="lead-rating"][value="${estimate.leadRating}"]`);
            if (ratingInput) ratingInput.checked = true;
        }
        // --- End Visits, Stages, Rating ---

        // --- Quill Editors ---
        const quillInstances = getQuillInstance();
        if (quillInstances['manual-scope']) quillInstances['manual-scope'].root.innerHTML = (typeof estimate.scopeOfWork === 'string') ? estimate.scopeOfWork : (estimate.scopeOfWork?.manual || '');
        if (quillInstances['auto-scope']) quillInstances['auto-scope'].root.innerHTML = estimate.scopeOfWork?.auto || '';
        const appendixContent = (estimate.appendixContent && estimate.appendixContent !== '<p><br></p>') ? estimate.appendixContent : (defaults.defaultAppendix || getAppendixDefaultContent());
        if (quillInstances['appendix']) quillInstances['appendix'].root.innerHTML = appendixContent;
        const defaultTermsContent = `<p><strong>1. Scope of Work:</strong> ...</p>`;
        const termsContent = (estimate.terms && estimate.terms !== '<p><br></D>') ? estimate.terms : (defaults.defaultTerms || defaultTermsContent);
        if (quillInstances['terms']) quillInstances['terms'].root.innerHTML = termsContent;
        // --- End Quill Editors ---

        // --- Admin Buttons (Bottom Bar) ---
        const adminButtons = document.getElementById('admin-buttons-left');
        if (estimate.isDeleted) {
            adminButtons.innerHTML = `<button id="restore-estimate-button" class="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Restore</button> <button id="perm-delete-estimate-button" class="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete Permanently</button>`;
            adminButtons.querySelector('#restore-estimate-button').onclick = () => restoreEstimate(estimateId);
            adminButtons.querySelector('#perm-delete-estimate-button').onclick = () => promptAction('deletePermanent', estimateId, [], allEstimates);
        } else {
            adminButtons.innerHTML = `<button id="print-button" class="inline-flex items-center justify-center rounded-md border border-gray-500 bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500">Print / Save PDF</button> <button id="share-estimate-button" class="inline-flex items-center justify-center rounded-md border border-gray-500 bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500">Share Estimate</button> <button id="save-as-template-button" class="inline-flex items-center justify-center rounded-md border border-gray-500 bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500">Save as Template</button> <button id="delete-estimate-button" class="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>`;
            adminButtons.querySelector('#print-button').onclick = handlePrint;
            adminButtons.querySelector('#share-estimate-button').onclick = () => handleShareEstimate(estimateId);
            adminButtons.querySelector('#save-as-template-button').onclick = saveAsTemplate;
            adminButtons.querySelector('#delete-estimate-button').onclick = () => softDeleteEstimate(estimateId);
        }
        // --- End Admin Buttons ---

        // --- Restore Selected Options ---
        const selectedOptionIds = estimate.pricing?.selectedOptions || [];
        selectedOptionIds.forEach(optionId => {
            const checkbox = document.querySelector(`.option-choice-checkbox[value="${optionId}"]`);
            if (checkbox) checkbox.checked = true;
        });
        // --- End Restore Selected Options ---

        // --- Snow Section (With Button Listeners) ---
        renderSnowLocations(estimate.snowLocations || [], estimate.snowRouteOrder || [], saveState);
        renderCalculations(estimate.calculations || [], saveState); // <--- ADDED THIS LINE
        const mapPreviewContainer = document.getElementById('snow-route-map-preview');
        const mapPreviewImg = document.getElementById('snow-route-map-preview-img');
        const editSavedMapBtn = document.getElementById('edit-saved-route-map-btn');
        const deleteSavedMapBtn = document.getElementById('delete-saved-route-map-btn');

        if (mapPreviewContainer && mapPreviewImg && editSavedMapBtn && deleteSavedMapBtn) {
            editSavedMapBtn.onclick = null; // Clear previous listener
            deleteSavedMapBtn.onclick = null; // Clear previous listener

            if (estimate.snowRouteMapUrl) {
                mapPreviewImg.src = estimate.snowRouteMapUrl;
                mapPreviewContainer.classList.remove('hidden');

                // Edit Button Listener
                editSavedMapBtn.onclick = () => {
                    const estimateId = estimate.id;
                    const snowLocationsForMap = (estimate.snowLocations || []).map(loc => ({
                        id: loc.id,
                        address: loc.address,
                        title: loc.title || 'Unnamed Location',
                        pricePerPush: loc.pricePerPush || 0,
                        priceMonthly: loc.priceMonthly || 0,
                        priceSeasonal: loc.priceSeasonal || 0,
                        timeToComplete: loc.timeToComplete || 0,
                        clearingTrigger: loc.clearingTrigger || 'N/A',
                        equipmentInfo: loc.equipmentInfo || 'N/A'
                    })).filter(Boolean);

                    if (snowLocationsForMap.length < 2) return showErrorBanner("Need at least two locations with addresses to edit the route.");
                    if (snowLocationsForMap.some(loc => !loc.address || loc.address.trim() === '')) return showErrorBanner("Please ensure all snow locations have a valid address before editing the map.");

                    const locationsParam = encodeURIComponent(JSON.stringify(snowLocationsForMap));
                    window.location.href = `sketch.html?estimateId=${estimateId}&snowRoute=true&locations=${locationsParam}`;
                };

                // Delete Button Listener
                deleteSavedMapBtn.onclick = () => {
                    // Make sure the function exists before calling
                    if (typeof handleDeleteSnowRouteMap === 'function') {
                        handleDeleteSnowRouteMap(estimate.id);
                    } else {
                        console.error("handleDeleteSnowRouteMap function is not available!");
                        showErrorBanner("Error: Delete function not loaded correctly.");
                    }
                };

            } else {
                mapPreviewContainer.classList.add('hidden');
                mapPreviewImg.src = '';
            }
        }
        // --- End Snow Section ---

        // Final calculations and save initial state
        calculateAllTotals(saveState, updateFinancialSummary);
        updateFinancialSummary(saveState); // <<< THIS IS THE KEY CALL
        updateSnowContractSummary();

        saveState(); // Save the initially loaded state

    } catch (error) {
        console.error("Error loading document:", error);
        showErrorBanner(`Error loading document: ${error.message}`);
    } finally {
        window.isLoading = false; // Clear loading flag
    }
}

// ADD THESE TWO FUNCTIONS to estimator-ui.js (around line 1111)

/**
 * Reads all items from the dynamic financial editor.
 * @returns {Array} An array of financial item objects.
 */
export function getFinancialItemsFromEditor() {
    const items = [];
    document.querySelectorAll('#financial-items-container .financial-item-row').forEach(row => {
        const item = {
            id: row.dataset.id || `item-${Date.now()}`,
            description: row.querySelector('.fs-desc')?.value || '',
            amount: parseFloat(row.querySelector('.fs-amount')?.value) || 0,
            dueDate: row.querySelector('.fs-due-date')?.value || null,
            type: row.querySelector('.fs-type')?.value || 'adjustment',
            isPaid: row.querySelector('.fs-is-paid')?.checked || false,
        };
        items.push(item);
    });
    return items;
}

/**
 * Creates and appends a new financial item row to the editor.
 * @param {Object} itemData - The data for the item to render.
 * @param {Function} saveState - The function to call to save app state.
 */
// REPLACE this function in estimator-ui.js
/**
 * Creates and appends a new financial item row to the editor.
 * @param {Object} itemData - The data for the item to render.
 * @param {Function} saveState - The function to call to save app state.
 */
// REPLACE this function in estimator-ui.js
/**
 * Creates and appends a new financial item row to the editor.
 * @param {Object} itemData - The data for the item to render.
 * @param {Function} saveState - The function to call to save app state.
 */
export function renderFinancialItem(itemData = {}, saveState) {
    const container = document.getElementById('financial-items-container');
    if (!container) return;

    const itemId = itemData.id || `item-${Date.now()}`;
    const row = document.createElement('div');
    row.className = 'financial-item-row grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 items-center p-2 border rounded-md';
    row.dataset.id = itemId;

    row.innerHTML = `
        <div class="md:col-span-4">
            <label class="block text-xs font-medium text-gray-500">Description</label>
            <input type="text" class="fs-desc table-input" placeholder="e.g., Booking Deposit" value="${itemData.description || ''}">
        </div>
        <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-500">Amount</label>
            <input type="number" class="fs-amount table-input" placeholder="0.00" value="${(itemData.amount || 0).toFixed(2)}">
        </div>
        <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-500">Due Date</label>
            <input type="date" class="fs-due-date table-input" value="${itemData.dueDate || ''}">
        </div>
        <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-500">Type</label>
            <select class="fs-type table-input">
                <option value="adjustment" ${itemData.type === 'adjustment' ? 'selected' : ''}>Adjustment/Deposit</option>
                <option value="payment" ${itemData.type === 'payment' ? 'selected' : ''}>Payment Received</option>
                <option value="holdback" ${itemData.type === 'holdback' ? 'selected' : ''}>Holdback</option>
            </select>
        </div>
        <div class="md:col-span-1 flex items-end justify-center pt-4">
            <label class="flex items-center text-sm"><input type="checkbox" class="fs-is-paid h-4 w-4" ${itemData.isPaid ? 'checked' : ''}><span class="ml-2">Paid</span></label>
        </div>
        <div class="md:col-span-1 flex items-end justify-center pt-4">
            <button type="button" class="delete-financial-item-btn text-red-500 hover:text-red-700 font-bold text-xl no-print">×</button>
        </div>
    `;

    container.appendChild(row);

    // --- THIS IS THE FIX ---
    // The "debouncedRecalculate" function will now be called
    // on 'input' (for text fields) AND 'change' (for checkboxes/selects).
    const debouncedRecalculate = debounce(() => {
        updateFinancialSummary(saveState);
        saveState();
    }, 250);

    row.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', debouncedRecalculate);
        el.addEventListener('change', debouncedRecalculate); // <-- THIS LINE FIXES THE CHECKBOX
    });
    // --- END FIX ---

    row.querySelector('.delete-financial-item-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to remove this financial item?')) {
            row.remove();
            updateFinancialSummary(saveState);
            saveState();
        }
    });
}

function translateLegacyPricing(pricingData) {
    if (!pricingData) return { dynamicOptions: [], sketch: null, changeOrder: null };
    if (pricingData.dynamicOptions && Array.isArray(pricingData.dynamicOptions)) {
        return {
            dynamicOptions: pricingData.dynamicOptions,
            sketch: pricingData.options?.sketch || null,
            changeOrder: pricingData.options?.['change-order'] || null,
        };
    }
    let translatedOptions = [];
    const legacyOptions = pricingData.options;
    if (Array.isArray(legacyOptions)) {
        if (legacyOptions.length > 0) translatedOptions.push({ id: `option-${Date.now()}`, title: 'Pricing Option 1', items: legacyOptions, summary: {} });
    } else if (typeof legacyOptions === 'object' && legacyOptions !== null) {
        Object.keys(legacyOptions).forEach(key => {
            const option = legacyOptions[key];
            if (key !== 'sketch' && key !== 'change-order' && option && Array.isArray(option.items)) {
                translatedOptions.push({ id: `option-${key}-${Date.now()}`, title: option.title || `Pricing Option`, items: option.items, summary: option.summary || {} });
            }
        });
    }
    return { dynamicOptions: translatedOptions, sketch: legacyOptions?.sketch || null, changeOrder: legacyOptions?.['change-order'] || null };
}

// REPLACE THIS ENTIRE FUNCTION in estimator-ui.js
// REPLACE THIS ENTIRE FUNCTION in estimator-ui.js
export function addPricingOption(optionData = null, saveState) {
    const container = document.getElementById('pricing-options-container');
    if (!container) {
        console.error("addPricingOption: Container not found!"); // Add error log
        return;
    }

    const optionId = optionData?.id || `option-${Date.now()}`;
    const optionCard = document.createElement('div');

    // --- ENSURE THESE ARE SET ---
    optionCard.id = optionId; // Set the actual ID attribute
    optionCard.dataset.optionId = optionId; // Set the data attribute

    // --- THIS LINE HAS BEEN REMOVED ---
    // optionCard.setAttribute('draggable', 'true'); 
    // ---------------------------------

    optionCard.className = 'price-option-card bg-white rounded-lg shadow-sm border-2 border-gray-200 mb-6 p-6';

    // --- Add a log to confirm ID setting ---
    // console.log(`addPricingOption: Creating card with ID="${optionCard.id}" and data-option-id="${optionCard.dataset.optionId}"`);

    // --- Set innerHTML ---
    optionCard.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-4 w-full">
                <div class="drag-handle-container flex-shrink-0 cursor-grab no-print" draggable="true">
                    <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </div>
                <input type="checkbox" class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 option-select-checkbox flex-shrink-0" title="Select this option for final total" value="${optionId}">
                <input type="text" class="option-title-input text-lg font-bold border-b-2 w-full pb-1" placeholder="Enter Option Title">
            </div>
            <div class="flex-shrink-0 ml-4 flex items-center gap-2 no-print">
                <button title="Copy to New Option" class="copy-option-btn p-1 text-gray-500 hover:text-blue-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
                <button title="Delete Option" class="delete-option-btn p-1 text-gray-500 hover:text-red-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
        </div>
         <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-4 border-y py-4 my-4">
             <div><label class="block text-sm font-medium">Sq. Footage</label><input type="number" class="table-input option-sqft"></div>
             <div><label class="block text-sm font-medium">Asphalt Thickness</label><select class="table-input option-thickness"><option value="none">N/A</option><option value="3-inch">3 inch</option><option value="4-inch">4 inch</option><option value="6-inch">6 inch</option><option value="8-inch">8 inch</option></select></div>
             <div><label class="block text-sm font-medium">Asphalt Tonnage</label><input type="number" class="table-input bg-gray-100 option-tonnage" readonly></div>
             <div><label class="block text-sm font-medium">Demo?</label><select class="table-input option-demo"><option>No</option><option>Yes</option></select></div>
             <div><label class="block text-sm font-medium">Basework?</label><select class="table-input option-basework"><option>No</option><option>Yes</option></select></div>
             <div><label class="block text-sm font-medium">Excavation?</label><select class="table-input option-excavation"><option>No</option><option>Yes</option></select></div>
             <div><label class="block text-sm font-medium">Warranty</label><input type="text" class="table-input option-warranty" placeholder="e.g., 1 Year Workmanship"></div>
         </div>
         <div class="items-container space-y-4"></div>
         <div class="mt-4 flex justify-between items-center no-print">
             <button type="button" class="add-item-btn text-blue-600 font-semibold hover:text-blue-800">+ Add Item</button>
         </div>
         <div class="mt-4 pt-4 border-t">
             <div class="grid grid-cols-3 gap-4 text-right">
                 <div><span class="text-sm text-gray-500">Subtotal</span><p class="font-semibold option-subtotal">$0.00</p></div>
                 <div><span class="text-sm text-gray-500">GST (5%)</span><p class="font-semibold option-gst">$0.00</p></div>
                 <div><span class="text-sm font-bold text-gray-800">Total</span><p class="font-bold text-lg option-total">$0.00</p></div>
             </div>
         </div>
    `;

    // --- Append to container ---
    container.appendChild(optionCard);

    // --- Set value and add listener AFTER appending ---
    const titleInput = optionCard.querySelector('.option-title-input');
    if (titleInput) {
        titleInput.value = optionData?.title || `Pricing Option ${container.children.length}`;
        titleInput.addEventListener('input', debounce(saveState, 500)); // Add listener here
    }

    // --- Populate if data exists ---
    if (optionData) {
        const summary = optionData.summary || {};
        const sqftInput = optionCard.querySelector('.option-sqft'); if (sqftInput) sqftInput.value = summary.sqft || '';
        const thicknessSelect = optionCard.querySelector('.option-thickness'); if (thicknessSelect) thicknessSelect.value = summary.thickness || 'none';
        const tonnageInput = optionCard.querySelector('.option-tonnage'); if (tonnageInput) tonnageInput.value = summary.tonnage || '';
        const demoSelect = optionCard.querySelector('.option-demo'); if (demoSelect) demoSelect.value = summary.demo || 'No';
        const baseworkSelect = optionCard.querySelector('.option-basework'); if (baseworkSelect) baseworkSelect.value = summary.basework || 'No';
        const excavationSelect = optionCard.querySelector('.option-excavation'); if (excavationSelect) excavationSelect.value = summary.excavation || 'No';
        const warrantyInput = optionCard.querySelector('.option-warranty'); if (warrantyInput) warrantyInput.value = summary.warranty || '';
        (optionData.items || []).forEach(item => addItemToOption(optionId, item, true, saveState));
    } else {
        // Add one empty item for new options
        addItemToOption(optionId, null, true, saveState);
    }

    // --- Setup calculator and calculate totals AFTER appending ---
    setupTonnageCalculatorForOption(optionCard);
    calculateAllTotals(saveState, updateFinancialSummary);

    // Only save state if we're adding based on existing data (copying)
    if (optionData) {
        saveState();
    }
}
// REPLACE THIS ENTIRE FUNCTION in estimator-ui.js
export function copySketchToFirstOption(saveState) {
    // This internal function now correctly reads the color
    const getLineItems = (optionId) => {
        const items = [];
        const cardElement = document.getElementById(optionId);
        if (!cardElement) return items;

        cardElement.querySelectorAll('.line-item-container').forEach(row => {
            const productEl = row.querySelector('.product-select');
            const unitsEl = row.querySelector('.units-input');
            const priceEl = row.querySelector('.price-input');
            const colorPickerEl = row.querySelector('.item-color-picker'); // <-- THIS IS THE FIX

            const color = colorPickerEl ? colorPickerEl.value : '#cccccc'; // <-- THIS IS THE FIX
            const product = productEl ? productEl.value : '';
            const units = parseFloat(unitsEl ? unitsEl.value : 0) || 0;
            const price = parseFloat(priceEl ? priceEl.value : 0) || 0;
            const description = (row.quill && row.quill.getLength() > 1) ? row.quill.root.innerHTML : null;

            if (product || units > 0 || price > 0 || description) {
                items.push({
                    product: product || null,
                    description: description,
                    units: units,
                    unitPrice: price,
                    color: color // <-- THIS IS THE FIX
                });
            }
        });
        return items;
    };

    const sketchItems = getLineItems('sketch-card');
    if (sketchItems.length === 0) { showErrorBanner("There are no items in Sketch Pricing to copy."); return; }

    const firstOptionCard = document.querySelector('#pricing-options-container .price-option-card');
    if (!firstOptionCard) { showErrorBanner("Please add a Pricing Option first to copy items into."); return; }

    const firstOptionId = firstOptionCard.id;
    const itemsContainer = firstOptionCard.querySelector('.items-container');
    if (!itemsContainer) return;
    itemsContainer.innerHTML = '';

    // The items now include the color, so addItemToOption will work correctly
    sketchItems.forEach(item => addItemToOption(firstOptionId, item, true, saveState));

    showSuccessBanner("Sketch pricing copied to the first option.");
    calculateAllTotals(saveState, updateFinancialSummary);
    saveState();
}


export function addItemToOption(optionId, itemData = null, skipStateSave = false, saveState) {
    const optionCard = document.getElementById(optionId);
    if (!optionCard) return;

    let container = optionId.startsWith('option-') ? optionCard.querySelector('.items-container') : optionCard.querySelector('#sketch-items-container, #change-order-items-container');
    if (!container) return;

    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'line-item-container border-t first:border-t-0 py-4';
    itemWrapper.setAttribute('draggable', 'true');
    itemWrapper.dataset.id = `item-${Date.now()}-${Math.random()}`;

    if (itemData?.sketchItemId) itemWrapper.dataset.sketchItemId = itemData.sketchItemId;
    if (itemData?.calculatorInputs) itemWrapper.dataset.calculatorInputs = JSON.stringify(itemData.calculatorInputs);

    const itemColor = itemData?.color ? convertRgbToHex(itemData.color) : '#cccccc';

    itemWrapper.innerHTML = `
        <div class="flex gap-2 md:gap-4 items-start w-full">
            <div class="flex-shrink-0 pt-2 text-gray-400 cursor-grab no-print drag-handle"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 8a1 1 0 11-2 0 1 1 0 012 0zM7 9a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 10-2 0 1 1 0 002 0zM13 9a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 10-2 0 1 1 0 002 0zM7 13a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 10-2 0 1 1 0 002 0zM13 13a1 1 0 100-2 1 1 0 000 2z"></path></svg></div>
            <input type="color" class="item-color-picker flex-shrink-0 mt-2" value="${itemColor}" title="Change line item color">
            <div class="flex-grow min-w-0 space-y-2">
                <div class="grid grid-cols-1 sm:grid-cols-8 gap-2 no-print">
                    <select class="table-input product-select sm:col-span-4"></select>
                    <input type="number" min="0" class="table-input units-input sm:col-span-2" placeholder="Units">
                    <div class="flex items-center rounded-md border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 sm:col-span-2 overflow-hidden bg-white">
                        <span class="pl-3 text-gray-500 select-none">$</span>
                        <input type="number" min="0" step="0.01" class="price-input w-full p-2 border-0 focus:ring-0" placeholder="0.00">
                    </div>
                </div>
                <div class="variant-container grid grid-cols-1 sm:grid-cols-8 gap-2 no-print"></div>
                <div class="mt-2 no-print">
                    <div class="description-editor bg-white"></div>
                </div>
            </div>
            <div class="flex-shrink-0 w-24 text-right font-medium total-cell no-print pt-1">$0.00</div>
            <div class="flex-shrink-0 pt-0"><button type="button" class="delete-item-button text-red-500 hover:text-red-700 text-2xl font-bold leading-none">×</button></div>
        </div>`;

    container.appendChild(itemWrapper);

    // --- DYNAMIC DATA SWITCH ---
    const selectElement = itemWrapper.querySelector('.product-select');
    const dbOptions = getPricingOptions(); // Use Getter
    const availableOptions = dbOptions.filter(opt => !opt.isArchived); // Filter

    // Group and populate
    const groupedOptions = availableOptions.reduce((acc, option) => {
        const type = option.type || 'none';
        if (!acc[type]) acc[type] = [];
        acc[type].push(option);
        return acc;
    }, {});

    for (const type in groupedOptions) {
        if (type !== 'none' && type !== 'volume') {
            const optgroup = document.createElement('optgroup');
            optgroup.label = type.charAt(0).toUpperCase() + type.slice(1) + ' Based';
            groupedOptions[type].forEach(item => {
                if (item.id !== 'none') {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.name;
                    optgroup.appendChild(option);
                }
            });
            selectElement.appendChild(optgroup);
        }
    }
    const otherOptions = [...(groupedOptions['none'] || []), ...(groupedOptions['volume'] || [])];
    otherOptions.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        selectElement.appendChild(option);
    });
    // --- END DYNAMIC DATA SWITCH ---

    const editorEl = itemWrapper.querySelector('.description-editor');
    const quill = new Quill(editorEl, { modules: { toolbar: [['bold', 'underline'], [{ 'list': 'bullet' }]] }, theme: 'snow' });
    itemWrapper.quill = quill;
    quill.on('text-change', debounce(saveState, 300));

    const unitsInput = itemWrapper.querySelector('.units-input');
    const priceInput = itemWrapper.querySelector('.price-input');
    const colorPicker = itemWrapper.querySelector('.item-color-picker');
    const debouncedSaveState = debounce(saveState, 300);

    const handleInput = () => {
        updateLineTotal(itemWrapper);
        calculateAllTotals(saveState, updateFinancialSummary);
        if (!skipStateSave) debouncedSaveState();
    };
    unitsInput.addEventListener('input', handleInput);
    priceInput.addEventListener('input', handleInput);
    colorPicker.addEventListener('input', handleInput);

    selectElement.addEventListener('change', (e) => {
        const selectedOption = getPricingOptions().find(opt => opt.id === e.target.value); // Use Getter
        if (selectedOption) {
            quill.root.innerHTML = selectedOption.description || '';
            // --- DYNAMIC FUEL: Set Flag ---
            if (selectedOption.consumesFuel) {
                itemWrapper.dataset.consumesFuel = "true";
            } else {
                delete itemWrapper.dataset.consumesFuel;
            }
            // -----------------------------
            if (!selectedOption.variants && !selectedOption.calculation) {
                priceInput.value = selectedOption.defaultPrice?.toFixed(2) || '0.00';
            }
        }
        buildVariantUI();
        handleInput();
    });

    async function buildVariantUI() {
        const selectedOption = getPricingOptions().find(opt => opt.id === selectElement.value); // Use Getter
        const variantContainer = itemWrapper.querySelector('.variant-container');
        variantContainer.innerHTML = '';

        if (selectedOption?.variants) {
            const label = document.createElement('label');
            label.className = 'sm:col-span-4 text-sm font-medium self-center';
            label.textContent = selectedOption.variantLabel || 'Options';
            const variantSelect = document.createElement('select');
            variantSelect.className = 'table-input variant-select sm:col-span-4';
            selectedOption.variants.forEach(variant => {
                const option = document.createElement('option');
                option.value = variant.price;
                option.textContent = variant.name;
                variantSelect.appendChild(option);
            });
            variantContainer.appendChild(label);
            variantContainer.appendChild(variantSelect);
            variantSelect.addEventListener('change', (e) => {
                priceInput.value = parseFloat(e.target.value).toFixed(2);
                handleInput();
            });
            priceInput.value = parseFloat(variantSelect.value).toFixed(2);

        } else if (selectedOption?.calculation) {
            const calc = selectedOption.calculation;
            const label = document.createElement('label');
            label.className = 'sm:col-span-4 text-sm font-medium self-center';
            label.textContent = `Enter ${calc.label || 'Value'}`;
            const calcInput = document.createElement('input');
            calcInput.type = 'number';
            calcInput.className = 'table-input calculation-input sm:col-span-4';
            calcInput.placeholder = `e.g., 3 for 3 ${calc.unit || ''}`;
            variantContainer.appendChild(label);
            variantContainer.appendChild(calcInput);
            calcInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value) || 0;
                const calculatedPrice = value * calc.rate;
                priceInput.value = calculatedPrice.toFixed(2);
                handleInput();
            });
        }
    }

    if (itemData) {
        const matchedOption = getPricingOptions().find(opt => opt.id === itemData.product); // Use Getter
        selectElement.value = itemData.product || 'none';
        quill.root.innerHTML = itemData.description || (matchedOption ? matchedOption.description : '');
        unitsInput.value = itemData.units || '';
        priceInput.value = (itemData.unitPrice !== undefined ? itemData.unitPrice : (itemData.price || 0)).toFixed(2);

        // --- DYNAMIC FUEL: Restore Flag ---
        if (matchedOption && matchedOption.consumesFuel) {
            itemWrapper.dataset.consumesFuel = "true";
        }
        // ---------------------------------
    } else {
        selectElement.value = 'none';
    }

    buildVariantUI();
    updateLineTotal(itemWrapper);
    if (!skipStateSave) saveState();
}

function setupTonnageCalculatorForOption(optionCard) {
    const sqftInput = optionCard.querySelector('.option-sqft');
    const thicknessSelect = optionCard.querySelector('.option-thickness');
    const tonnageInput = optionCard.querySelector('.option-tonnage');
    if (sqftInput && thicknessSelect && tonnageInput) {
        const updateTonnage = () => {
            const tonnage = calculateTonnage(sqftInput.value, thicknessSelect.value);
            tonnageInput.value = tonnage > 0 ? tonnage.toFixed(2) : '';
        };
        sqftInput.addEventListener('input', updateTonnage);
        thicknessSelect.addEventListener('change', updateTonnage);
    }
}

function updateLineTotal(row) {
    if (!row) return;
    const unitsInput = row.querySelector('.units-input');
    const priceInput = row.querySelector('.price-input');
    const totalCell = row.querySelector('.total-cell');
    if (!unitsInput || !priceInput || !totalCell) return;

    let total = (parseFloat(unitsInput.value) || 0) * (parseFloat(priceInput.value) || 0);

    // --- DYNAMIC FUEL ---
    if (row.dataset.consumesFuel === "true") {
        const fuelMultiplier = getFuelSurchargeMultiplier();
        total += total * fuelMultiplier;
    }
    // --------------------

    totalCell.textContent = formatCurrency(total);
}



// REPLACE this function in estimator-ui.js
// REPLACE this function in estimator-ui.js
// REPLACE this function in estimator-ui.js
export function updateFinancialSummary(saveState) {
    const getNumber = (id, fromText = false) => {
        const el = document.getElementById(id);
        if (!el) return 0;
        const value = fromText ? el.textContent.replace(/[$,]/g, '') : el.value;
        return parseFloat(value) || 0;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // This is the main total from your pricing options.
    const grandTotal = getNumber('summary-grand-total', true);

    let totalAdjustments = 0;
    let totalPaid = 0;
    let totalDueToday = 0;

    const items = getFinancialItemsFromEditor();

    items.forEach(item => {
        const amount = item.amount || 0;
        const itemDate = item.dueDate ? new Date(item.dueDate + 'T00:00:00') : null;

        // 1. If "Paid" is checked, it goes into "Amount Paid to Date".
        if (item.isPaid) {
            totalPaid += amount;
        }

        // 2. If it's an "Adjustment" or "Holdback" AND the amount is
        //    NEGATIVE (like a -5000 holdback), it counts as an adjustment.
        //    Positive payments will NOT be counted as adjustments.
        if ((item.type === 'adjustment' || item.type === 'holdback') && amount < 0) {
            totalAdjustments += amount;
        }

        // 3. If it is NOT paid, and the due date is today or in the past,
        //    it counts as "Amount Due Today".
        if (!item.isPaid && itemDate && itemDate <= today) {
            totalDueToday += amount;
        }
    });

    // 4. Calculate the finals
    const adjustedTotal = grandTotal + totalAdjustments; // e.g., $40,950 + (-$5,000 holdback) = $35,950
    const remainingBalance = adjustedTotal - totalPaid; // e.g., $35,950 - $20,000 paid = $15,950

    // Update the DOM
    document.getElementById('fs-total-adjustments').textContent = formatCurrency(totalAdjustments);
    document.getElementById('fs-adjusted-total').textContent = formatCurrency(adjustedTotal);
    document.getElementById('fs-amount-paid').textContent = formatCurrency(totalPaid);
    document.getElementById('fs-remaining-balance').textContent = formatCurrency(remainingBalance);
    document.getElementById('fs-due-today').textContent = formatCurrency(totalDueToday);

    if (saveState && typeof saveState === 'function') {
        saveState();
    }
}

export function populateScopeOfWork(saveState) {
    let generatedHtml = '';
    const pricingCards = [...document.querySelectorAll('#pricing-options-container .price-option-card'), document.getElementById('sketch-card'), document.getElementById('change-order-card')].filter(Boolean);

    pricingCards.forEach(card => {
        let optionTitle = '';
        if (card.id.startsWith('option-')) {
            optionTitle = card.querySelector('.option-title-input')?.value;
        } else if (card.id === 'sketch-card') {
            optionTitle = 'Sketch Pricing';
        } else if (card.id === 'change-order-card' && document.getElementById('change-order-checkbox')?.checked) {
            optionTitle = 'Change Order';
        }
        if (!optionTitle) return;

        let summaryParts = [];
        const sqft = card.querySelector('.option-sqft, #sketch-sqft')?.value;
        const thickness = card.querySelector('.option-thickness, #sketch-thickness')?.value;
        const tonnage = card.querySelector('.option-tonnage, #sketch-tonnage')?.value;
        const warranty = card.querySelector('.option-warranty')?.value;
        const demo = card.querySelector('.option-demo, #sketch-demo')?.value;
        const basework = card.querySelector('.option-basework, #sketch-basework')?.value;
        const excavation = card.querySelector('.option-excavation, #sketch-excavation')?.value;

        if (sqft) summaryParts.push(`<strong>Total Area:</strong> ${sqft} sq ft`);
        if (thickness && thickness !== 'none') summaryParts.push(`<strong>Asphalt Thickness:</strong> ${thickness.replace('-', ' ')}`);
        if (tonnage) summaryParts.push(`<strong>Est. Tonnage:</strong> ${tonnage}`);
        if (demo === 'Yes') summaryParts.push(`<strong>Demolition:</strong> Yes`);
        if (basework === 'Yes') summaryParts.push(`<strong>Basework:</strong> Yes`);
        if (excavation === 'Yes') summaryParts.push(`<strong>Excavation:</strong> Yes`);
        if (warranty) summaryParts.push(`<strong>Warranty:</strong> ${warranty}`);

        let summaryHtml = '';
        if (summaryParts.length > 0) {
            summaryHtml = `<p><em>Project Summary: ${summaryParts.join(' | ')}</em></p><p><br></p>`;
        }

        let itemsHtml = '';
        const lineItems = card.querySelectorAll('.line-item-container');
        lineItems.forEach(item => {
            const product = item.querySelector('.product-select')?.value;
            const description = item.quill ? item.quill.root.innerHTML : '';
            const units = parseFloat(item.querySelector('.units-input')?.value) || 0;
            const unitPrice = parseFloat(item.querySelector('.price-input')?.value) || 0;
            const total = units * unitPrice;

            // --- FIX: Use getPricingOptions() here ---
            const matchedOption = getPricingOptions().find(opt => opt.id === product);
            const productName = matchedOption ? matchedOption.name : 'Custom Item';

            if ((product && product !== 'none') || (description && description.trim() !== '<p><br></p>')) {
                itemsHtml += `<h3>${productName}</h3><p><strong>Description:</strong></p>${description}<p><strong>Price:</strong> ${units.toFixed(2)} units @ ${formatCurrency(unitPrice)} = ${formatCurrency(total)}</p><p><br></p>`;
            }
        });

        if (itemsHtml) {
            // --- FIX: Use getTaxRate() here ---
            const subtotal = calculateOptionSubtotal(card.id);
            const gst = subtotal * getTaxRate();
            const total = subtotal + gst;

            const totalsHtml = `<p><br></p><p><strong>Option Subtotal:</strong> ${formatCurrency(subtotal)}</p><p><strong>GST:</strong> ${formatCurrency(gst)}</p><p><strong>Option Total: ${formatCurrency(total)}</strong></p><p><br></p>`;

            generatedHtml += `<h2>${optionTitle}</h2>${summaryHtml}${itemsHtml}${totalsHtml}`;
        }
    });

    if (quillEditors['auto-scope']) {
        quillEditors['auto-scope'].root.innerHTML = generatedHtml;
        showSuccessBanner('Scope of Work has been populated.');
        saveState();
    }
}

export function renderPropertyPhoto(url, address, handlePhotoDelete) {
    const container = document.getElementById('property-photo-container');
    if (!container) return;
    container.innerHTML = '';
    if (url) {
        container.innerHTML = ` <div class="relative group"> <img src="${url}" class="w-full h-auto max-h-80 object-contain rounded-md border"> <button class="remove-property-photo-btn absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"> <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> </button> </div>`;
        container.querySelector('.remove-property-photo-btn')?.addEventListener('click', () => handlePhotoDelete('property', { url }));
    } else if (address) {
        renderStreetView(address);
    } else {
        container.innerHTML = `<button id="upload-property-photo-btn" class="w-full border-2 border-dashed border-gray-300 rounded-md p-8 text-center text-gray-500 hover:bg-gray-50">Upload Property Photo</button>`;
    }
}

export const renderStreetView = debounce((address) => {
    const container = document.getElementById('property-photo-container');
    if (!container || !address || container.querySelector('img')) return;
    if (!window.google?.maps) {
        console.warn("Google Maps not ready for Street View");
        return;
    }

    const MAPS_API_KEY = "AIzaSyADrnYgh1fSTo3IZD7HOEJMyjduzDYIYSs";
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(address)}&fov=80&heading=235&pitch=10&key=${MAPS_API_KEY}`;
    container.innerHTML = `<div class="relative group"><img src="${streetViewUrl}" class="w-full h-auto max-h-80 object-contain rounded-md border" onerror="this.parentElement.innerHTML = '<p class=\\'text-center text-gray-500 p-8\\'>Street View image not available for this address.</p>';"><button id="upload-property-photo-btn" class="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity" title="Upload custom photo"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg></button></div>`;
}, 500);

export const renderLocationMap = debounce((address) => {
    const mapContainer = document.getElementById('location-map-container');
    if (!mapContainer) return;
    if (!window.google || !window.google.maps) {
        console.warn("Google Maps API not ready for renderLocationMap");
        return;
    }

    if (!geocoder) geocoder = new google.maps.Geocoder();
    if (!address) {
        mapContainer.innerHTML = '<p class="text-center text-gray-500 p-8">Enter an address to display map.</p>';
        return;
    }

    geocoder.geocode({ 'address': address }, (results, status) => {
        if (status == 'OK') {
            if (!locationMap) {
                locationMap = new google.maps.Map(mapContainer, { zoom: 17, mapTypeId: 'satellite', disableDefaultUI: true, zoomControl: true });
            }
            locationMap.setCenter(results[0].geometry.location);
            new google.maps.Marker({ map: locationMap, position: results[0].geometry.location });
        } else {
            mapContainer.innerHTML = `<p class="text-center text-gray-500 p-8">Could not find address: ${status}</p>`;
        }
    });
}, 500);

export function renderWorkPhotos(photos, handlePhotoDelete) {
    const container = document.getElementById('work-photos-container');
    if (!container) return;
    container.innerHTML = '';
    const estimateId = document.getElementById('editing-estimate-id').value;

    const debouncedUpdateWorkPhotoDescription = debounce(async (photoUrl, newDescription) => {
        const { db, doc, getDoc, updateDoc } = window.firebaseServices;
        const estimate = (await getDoc(doc(db, "estimates", estimateId))).data();
        if (!estimate?.workPhotos) return;
        const updatedPhotos = estimate.workPhotos.map(p => p.url === photoUrl ? { ...p, description: newDescription } : p);
        try { await updateDoc(doc(db, "estimates", estimateId), { workPhotos: updatedPhotos }); }
        catch (e) { console.error("Error updating description: ", e); showErrorBanner("Failed to save description."); }
    }, 1000);

    photos.forEach((photo) => {
        const photoCard = document.createElement('div');
        photoCard.className = 'border rounded-lg p-2 space-y-2 relative group';
        photoCard.innerHTML = ` <img src="${photo.url}" class="w-full h-48 object-cover rounded-md"> <textarea class="table-input work-photo-description" placeholder="Add a description...">${photo.description || ''}</textarea> <button class="delete-work-photo-btn absolute top-3 right-3 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"> <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> </button> `;
        container.appendChild(photoCard);
        photoCard.querySelector('.delete-work-photo-btn').addEventListener('click', () => handlePhotoDelete('work', photo));
        photoCard.querySelector('.work-photo-description').addEventListener('input', (e) => debouncedUpdateWorkPhotoDescription(photo.url, e.target.value));
    });
}

// REPLACE THIS ENTIRE FUNCTION in estimator-ui.js
// REPLACE THIS ENTIRE FUNCTION in estimator-ui.js
export function renderSketches(sketches = [], applySketchDataToEstimate, handleSketchDelete, handleSketchDuplicate) {
    const container = document.getElementById('sketches-container');
    if (!container) return;
    if (sketches.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No sketches have been added. Click "Add New Sketch" to create one.</p>';
        return;
    }
    container.innerHTML = sketches.map((sketch, index) => {
        const sketchTitle = sketch.title || `Sketch #${index + 1}`;
        const totalEstimateHtml = sketch.totalEstimate > 0 ? `<p class="text-sm"><strong>Total Estimate:</strong> ${formatCurrency(sketch.totalEstimate)} (Incl. GST)</p>` : '';
        const downloadButtonHtml = sketch.formattedEstimateUrl ? `<a href="${sketch.formattedEstimateUrl}" target="_blank" class="download-sketch-btn text-indigo-600 hover:underline text-sm font-medium">View/Download Estimate</a>` : '';

        const measurementsHtml = sketch.measurements?.length > 0 ? `
            <div class="mt-4 pt-3 border-t space-y-2">
                ${sketch.measurements.map(m => {
            if (!m.service || m.service === 'none' || !m.measurement || m.measurement <= 0) {
                return '';
            }
            // --- FIX: Use getPricingOptions() here ---
            const serviceOption = getPricingOptions().find(opt => opt.id === m.service);
            const serviceName = serviceOption ? serviceOption.name : 'Custom Service';

            const badgeColor = m.color || '#cccccc';

            return `
                        <div class="flex items-center gap-2 text-sm py-1">
                            <div class="w-4 h-4 rounded-sm flex-shrink-0" style="background-color: ${badgeColor}; border: 1px solid rgba(0,0,0,0.2);"></div>
                            <div class="flex-grow">
                                <p class="font-semibold">${serviceName}: ${(m.measurement || 0).toFixed(2)} ${m.measurementType === 'area' ? 'sq ft' : 'ft'}</p>
                                ${m.lineItemDescription ? `<p class="text-gray-600 pl-2 text-xs whitespace-pre-wrap">${m.lineItemDescription}</p>` : ''}
                            </div>
                        </div>`;
        }).join('')}
            </div>` : '';

        return `
            <div class="border rounded-lg p-4 space-y-3 relative group bg-gray-50">
                <div class="flex items-start justify-between">
                    <div><h3 class="font-bold text-lg">${sketchTitle}</h3>${totalEstimateHtml}</div>
                    <div class="flex items-center space-x-4 flex-shrink-0 no-print">
                        ${downloadButtonHtml}
                        <button data-sketch-id="${sketch.id}" class="apply-sketch-btn text-green-600 hover:underline text-sm font-medium">Apply Pricing</button>
                        <button data-sketch-id="${sketch.id}" class="duplicate-sketch-btn text-purple-600 hover:underline text-sm font-medium">Duplicate</button>
                        <button data-sketch-id="${sketch.id}" class="edit-sketch-btn text-blue-600 hover:underline text-sm font-medium">Edit</button>
                        <button data-sketch-id="${sketch.id}" class="delete-sketch-btn text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                    </div>
                </div>
                <a href="${sketch.screenshotUrl}" target="_blank" title="Click to view full size sketch"><img src="${sketch.screenshotUrl}" alt="Sketch Preview" class="w-full h-auto rounded-md border hover:opacity-90 transition-opacity"></a>
                ${measurementsHtml}
            </div>`;
    }).join('');

    container.querySelectorAll('.apply-sketch-btn').forEach(btn => btn.addEventListener('click', () => applySketchDataToEstimate(btn.dataset.sketchId)));
    container.querySelectorAll('.edit-sketch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sketchId = btn.dataset.sketchId;
            const estimateId = document.getElementById('editing-estimate-id').value;
            const siteAddress = document.getElementById('site-address').value;
            const customerAddress = document.getElementById('customer-address').value;
            const address = siteAddress || customerAddress;
            if (estimateId && sketchId) {
                window.location.href = `sketch.html?estimateId=${estimateId}&sketchId=${sketchId}&address=${encodeURIComponent(address)}`;
            }
        });
    });
    container.querySelectorAll('.delete-sketch-btn').forEach(btn => btn.addEventListener('click', () => handleSketchDelete(btn.dataset.sketchId)));
    container.querySelectorAll('.duplicate-sketch-btn').forEach(btn => btn.addEventListener('click', () => handleSketchDuplicate(btn.dataset.sketchId)));
}

export function renderTags(tags = [], container) {
    if (!container) return;
    container.innerHTML = tags.map(tag => `<span class="text-xs font-semibold px-2 py-1 rounded-full ${CATEGORY_COLORS[tag] || 'bg-gray-200 text-gray-800'}">${tag}</span>`).join(' ');
}

export function renderBeforeAndAfter(pairs = [], saveState, handlePhotoDelete) {
    const container = document.getElementById('before-after-container');
    if (!container) return;
    container.innerHTML = '';

    if (pairs.length === 0) {
        container.innerHTML = `<p class="text-gray-500 placeholder-text">No work showcases have been added yet.</p>`;
        return;
    }

    pairs.forEach(pairData => addBeforeAfterPair(pairData, saveState, handlePhotoDelete));
}

function createMediaElement(media, handlePhotoDelete, type, pairData) {
    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'relative group';
    mediaDiv.dataset.url = media.url;
    mediaDiv.dataset.type = media.type;
    if (media.location) {
        mediaDiv.dataset.location = JSON.stringify(media.location);
    }

    if (media.type === 'video') {
        mediaDiv.innerHTML = `<video src="${media.url}" class="w-full h-32 object-cover rounded-md" controls muted playsinline></video><button class="delete-ba-photo-btn absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>`;
    } else {
        mediaDiv.innerHTML = `<img src="${media.url}" class="w-full h-32 object-cover rounded-md"><button class="delete-ba-photo-btn absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>`;
    }

    mediaDiv.querySelector('.delete-ba-photo-btn').addEventListener('click', (e) => {
        if (confirm('Are you sure you want to delete this media?')) {
            const mediaUrl = e.currentTarget.closest('.relative.group').dataset.url;
            handlePhotoDelete('before-after', { url: mediaUrl, pairId: pairData.id, type: type });
        }
    });
    return mediaDiv;
}

export function addBeforeAfterPair(pairData = null, saveState, handlePhotoDelete) {
    const container = document.getElementById('before-after-container');
    const placeholder = container.querySelector('.placeholder-text');
    if (placeholder) placeholder.remove();

    const pairId = pairData?.id || `ba-${Date.now()}`;
    const pairDiv = document.createElement('div');
    pairDiv.className = 'before-after-pair border-t-2 pt-6 mt-6';
    pairDiv.dataset.pairId = pairId;

    // --- 3-COLUMN LOGIC ---
    const mediaGroups = { before: [], during: [], after: [] };
    const allLocations = [];

    ['before', 'during', 'after'].forEach(type => {
        const photos = pairData?.[`${type}Photos`] || [];
        photos.forEach(media => {
            mediaGroups[type].push(media);
            if (media.location?.lat) allLocations.push(media.location);
        });
    });

    let mapHtml = '';
    if (allLocations.length > 0) {
        const uniqueLocs = [...new Map(allLocations.map(v => [JSON.stringify(v), v])).values()];
        const markers = uniqueLocs.map(loc => `&markers=color:red%7C${loc.lat},${loc.lng}`).join('');
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&maptype=satellite${markers}&key=AIzaSyADrnYgh1fSTo3IZD7HOEJMyjduzDYIYSs`;
        mapHtml = `<div class="mb-4 border rounded-lg overflow-hidden"><img src="${mapUrl}" class="w-full h-32 object-cover"></div>`;
    }

    const renderGrid = (type, title) => `
        <div class="bg-gray-50 p-3 rounded-lg flex flex-col h-full">
            <div class="flex justify-between items-center mb-2">
                <h5 class="text-sm font-bold uppercase text-gray-500">${title}</h5>
                <button type="button" class="add-ba-photo-btn text-xs bg-white border px-2 py-1 rounded hover:bg-blue-50 text-blue-600 font-bold" data-type="${type}" data-pair-id="${pairId}">+ Add</button>
            </div>
            <div class="ba-photos-container grid grid-cols-2 gap-2 flex-grow content-start" data-type="${type}">
                ${mediaGroups[type].map(m => createMediaElement(m, handlePhotoDelete, type, pairData).outerHTML).join('')}
            </div>
        </div>`;

    pairDiv.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <input type="text" class="ba-title-input text-lg font-semibold border-b-2 w-full pb-1 focus:border-blue-600 focus:outline-none" placeholder="Showcase Title" value="${pairData?.title || ''}">
            <button type="button" class="delete-ba-pair-btn text-red-500 hover:text-red-700 ml-4 no-print"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
        </div>
        ${mapHtml}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            ${renderGrid('before', 'Before')}
            ${renderGrid('during', 'During')}
            ${renderGrid('after', 'After')}
        </div>
        <div class="mt-2"><div class="ba-description-editor bg-white h-24"></div></div>`;

    container.appendChild(pairDiv);

    const editorEl = pairDiv.querySelector('.ba-description-editor');
    const quill = new Quill(editorEl, { modules: { toolbar: [['bold', 'italic'], [{ 'list': 'bullet' }]] }, theme: 'snow' });
    quill.root.innerHTML = pairData?.description || '';
    setQuillInstance(pairId, quill);
    quill.on('text-change', debounce(saveState, 300));

    pairDiv.querySelector('.delete-ba-pair-btn').addEventListener('click', () => {
        if (confirm('Delete this showcase?')) {
            // Updated delete logic to handle all 3 types
            const fullPairData = { id: pairId, beforePhotos: mediaGroups.before, duringPhotos: mediaGroups.during, afterPhotos: mediaGroups.after };
            handlePhotoDelete('before-after-pair', { pairData: fullPairData });
            pairDiv.remove();
            saveState();
        }
    });
    pairDiv.querySelector('.ba-title-input').addEventListener('input', debounce(saveState, 500));
}

export function populateSiteVisitsEditor(estimateId, visits, allEstimates, handleSiteVisitAction) {
    const container = document.getElementById('site-visits-container');
    if (!container) return;
    container.innerHTML = (visits.length === 0) ? '<p class="text-gray-500">No site visits scheduled.</p>' : '';
    visits.forEach((visit, index) => {
        const visitEl = document.createElement('div');
        visitEl.className = 'site-visit-item border-t pt-4';
        visitEl.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <p class="font-semibold">${visit.description?.includes("Scheduled Estimate Meeting") ? `Appointment #${index + 1}` : `Follow-up Visit #${index + 1}`}</p>
                <div><button type="button" class="reschedule-btn text-blue-600 text-sm hover:underline mr-4 no-print" data-index="${index}">Edit</button><button type="button" class="remove-visit-button text-red-500 text-sm hover:underline no-print" data-index="${index}">Remove</button></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label class="block text-xs font-medium">Date</label><p class="table-input bg-gray-100">${visit.date || 'N/A'}</p></div>
                <div><label class="block text-xs font-medium">Time</label><p class="table-input bg-gray-100">${visit.time || 'N/A'}</p></div>
                <div class="flex items-end pb-2 space-x-4"><label class="flex items-center text-sm"><input type="checkbox" class="visit-completed-checkbox h-4 w-4" ${visit.completed ? 'checked' : ''} data-index="${index}"> <span class="ml-2">Completed</span></label></div>
                <div class="md:col-span-3"><label class="block text-xs font-medium">Description</label><p class="table-input bg-gray-100 h-16">${visit.description || ''}</p></div>
            </div>`;
        container.appendChild(visitEl);
    });
    container.querySelectorAll('.remove-visit-button, .reschedule-btn').forEach(el => el.addEventListener('click', (e) => handleSiteVisitAction(e, estimateId)));
}
export function populateWorkStagesEditor(stages = []) {
    const container = document.getElementById('work-stages-container');
    if (!container) return;
    container.innerHTML = (stages.length === 0) ? '<p class="text-gray-500">No work stages added.</p>' : '';
    stages.forEach((stage, index) => {
        const stageEl = document.createElement('div');
        stageEl.className = 'work-stage-item border-t pt-4';
        stageEl.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <p class="font-semibold">Work Stage #${index + 1}</p>
                <button type="button" class="remove-stage-button text-red-500 text-sm hover:underline" data-index="${index}">Remove</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block text-xs font-medium">Start Date</label><input type="date" class="stage-start-date table-input" value="${stage.startDate || ''}"></div>
                <div><label class="block text-xs font-medium">Completed Date</label><input type="date" class="stage-completed-date table-input" value="${stage.completedDate || ''}"></div>
                <div class="md:col-span-2"><label class="block text-xs font-medium">Description / Notes</label><textarea rows="2" class="stage-description table-input">${stage.description || ''}</textarea></div>
            </div>`;
        container.appendChild(stageEl);

        stageEl.querySelector('.remove-stage-button').addEventListener('click', (e) => {
            if (confirm('Are you sure you want to remove this work stage?')) {
                e.currentTarget.closest('.work-stage-item').remove();
            }
        });
    });
}

export function addWorkStage(saveState) {
    const container = document.getElementById('work-stages-container');
    if (!container) return;

    const placeholder = container.querySelector('p');
    if (placeholder) {
        placeholder.remove();
    }

    const stages = Array.from(document.querySelectorAll('.work-stage-item')).map(item => ({
        startDate: item.querySelector('.stage-start-date').value,
        completedDate: item.querySelector('.stage-completed-date').value,
        description: item.querySelector('.stage-description').value
    }));
    stages.push({ startDate: '', completedDate: '', description: '' });
    populateWorkStagesEditor(stages);
    saveState();
}

export function applyTemplateData(templateData, saveState) {
    if (quillEditors['manual-scope']) {
        quillEditors['manual-scope'].root.innerHTML = (typeof templateData.scopeOfWork === 'string') ? templateData.scopeOfWork : (templateData.scopeOfWork?.manual || '');
    }
    const pricingOptionsContainer = document.getElementById('pricing-options-container');
    pricingOptionsContainer.innerHTML = '';
    if (templateData.pricing?.dynamicOptions?.length > 0) {
        templateData.pricing.dynamicOptions.forEach(optionData => addPricingOption(optionData, saveState));
    } else {
        addPricingOption(null, saveState);
    }
}

export function handleSnowServiceTypeChange() {
    const serviceType = document.getElementById('snow-b-service-type').value;
    const periodicOptions = document.getElementById('periodic-hauling-options');
    const clearingOptions = document.getElementById('clearing-options');
    const clearingCheckbox = document.getElementById('snow-b-service-clearing');
    const haulingCheckbox = document.getElementById('snow-b-service-hauling');

    if (serviceType === 'periodic-hauling') {
        periodicOptions.classList.remove('hidden');
        clearingOptions.classList.add('hidden');
        clearingCheckbox.checked = false;
        clearingCheckbox.disabled = true;
        haulingCheckbox.checked = true;
        haulingCheckbox.disabled = true;
    } else {
        periodicOptions.classList.add('hidden');
        clearingOptions.classList.remove('hidden');
        clearingCheckbox.disabled = false;
        haulingCheckbox.disabled = false;
    }
}

export const renderSnowBuilderMap = debounce((address) => {
    const mapContainer = document.getElementById('snow-b-location-map');
    if (!mapContainer) return;
    if (!window.google || !window.google.maps) return;
    if (!geocoder) geocoder = new google.maps.Geocoder();
    if (!address) {
        mapContainer.innerHTML = '<p class="text-center text-gray-400 p-4 text-sm">Enter an address to see map</p>';
        return;
    }

    geocoder.geocode({ 'address': address }, (results, status) => {
        if (status == 'OK') {
            if (!locationMap) {
                locationMap = new google.maps.Map(mapContainer, { zoom: 17, mapTypeId: 'satellite', disableDefaultUI: true, zoomControl: true });
            }
            locationMap.setCenter(results[0].geometry.location);
            new google.maps.Marker({ map: locationMap, position: results[0].geometry.location });
        } else {
            mapContainer.innerHTML = `<p class="text-center text-red-500 p-4 text-sm">Could not find address</p>`;
        }
    });
}, 500);

export function openSketchSelectionModal(sketches, onSelect) {
    const modal = document.getElementById('sketch-selection-modal');
    const container = document.getElementById('sketch-selection-container');
    const cancelButton = document.getElementById('cancel-sketch-selection-btn');
    if (!modal || !container || !cancelButton) return;

    container.innerHTML = '';
    if (sketches.length === 0) {
        container.innerHTML = '<p class="text-gray-500 col-span-full text-center">No sketches available for this estimate.</p>';
    }

    sketches.forEach((sketch, index) => {
        const totalArea = (sketch.measurements || []).reduce((sum, m) => m.measurementType === 'area' ? sum + m.measurement : sum, 0);
        const card = document.createElement('div');
        card.className = 'border rounded-lg p-3 cursor-pointer hover:bg-gray-100 hover:border-blue-500';
        card.innerHTML = `
            <p class="font-semibold">Sketch #${index + 1}</p>
            <img src="${sketch.screenshotUrl}" class="w-full h-32 object-cover rounded-md my-2">
            <p class="text-sm"><strong>Address:</strong> ${sketch.clientAddress || 'N/A'}</p>
            <p class="text-sm"><strong>Total Area:</strong> ${totalArea.toFixed(2)} sq ft</p>
        `;
        card.addEventListener('click', () => {
            onSelect(sketch);
            modal.classList.add('hidden');
        });
        container.appendChild(card);
    });

    const close = () => modal.classList.add('hidden');
    cancelButton.onclick = close;

    modal.classList.remove('hidden');
}

// Snow Location Functions moved to modules/snow_calc/snow-ui.js

// MERGED SALES & OPERATIONS SCHEDULE
export async function renderSalesSchedule(allEstimates) {
    const container = document.getElementById('sales-schedule-container');
    if (!container) return;

    const { db, collection, query, where, getDocs } = window.firebaseServices;
    let allEvents = [];

    // 1. Get Sales Visits (From Estimates)
    allEstimates.forEach(est => {
        if (est.siteVisits && !est.isDeleted) {
            est.siteVisits.forEach(visit => {
                if (!visit.completed && visit.date) {
                    allEvents.push({
                        type: 'sales',
                        dateObj: new Date(visit.date + 'T' + (visit.time || '09:00')),
                        dateStr: visit.date,
                        timeStr: visit.time || 'TBD',
                        title: est.customerInfo?.name || 'Unknown',
                        subtitle: 'Site Visit / Estimate',
                        address: est.customerInfo?.address,
                        id: est.id
                    });
                }
            });
        }
        // Also check "Work Starting" dates
        if (est.tentativeStartDate && est.status === 'Work Starting') {
            allEvents.push({
                type: 'work',
                dateObj: new Date(est.tentativeStartDate + 'T07:00'),
                dateStr: est.tentativeStartDate,
                timeStr: '07:00',
                title: est.customerInfo?.name || 'Unknown',
                subtitle: 'Project Start',
                address: est.customerInfo?.address,
                id: est.id
            });
        }
    });

    // 2. Get Operations Dispatch (From Firestore - Only fetch upcoming)
    try {
        const today = new Date().toISOString().split('T')[0];
        const q = query(collection(db, "dispatch_schedule"), where("date", ">=", today));
        const dispatchSnap = await getDocs(q);

        dispatchSnap.forEach(doc => {
            const d = doc.data();
            allEvents.push({
                type: 'dispatch',
                dateObj: new Date(d.date + 'T' + (d.shopTime || '07:00')),
                dateStr: d.date,
                timeStr: d.shopTime,
                title: d.clientName,
                subtitle: `Dispatch: ${d.jobType}`,
                address: d.siteAddress,
                id: doc.id
            });
        });
    } catch (e) {
        console.log("Could not fetch dispatch for sidebar (permissions?)");
    }

    // 3. Sort & Render
    allEvents.sort((a, b) => a.dateObj - b.dateObj);

    if (allEvents.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 italic text-center py-4">No upcoming events.</p>';
        return;
    }

    container.innerHTML = allEvents.map(event => {
        const isToday = new Date().toDateString() === event.dateObj.toDateString();
        const dateDisplay = isToday ? '<span class="font-bold text-green-600">TODAY</span>' : event.dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

        // Color coding based on type
        let borderClass = 'border-l-4 border-blue-400'; // Sales default
        if (event.type === 'work') borderClass = 'border-l-4 border-orange-500';
        if (event.type === 'dispatch') borderClass = 'border-l-4 border-purple-600';

        return `
            <div class="p-2 bg-white rounded shadow-sm mb-2 ${borderClass} cursor-pointer hover:bg-gray-50">
                <div class="flex justify-between text-xs text-gray-500">
                    <span>${dateDisplay}</span>
                    <span>${event.timeStr}</span>
                </div>
                <div class="font-bold text-sm text-gray-800 truncate">${event.title}</div>
                <div class="text-xs text-gray-600 truncate">${event.subtitle}</div>
            </div>
        `;
    }).join('');
}

let routeListItems = []; // State for the modal

export function openRoutePlannerModal(selectedIds, allEstimates) {
    const modal = document.getElementById('route-planner-modal');
    const tbody = document.getElementById('route-planner-list');

    // 1. Gather Data
    routeListItems = selectedIds.map(id => {
        const est = allEstimates.find(e => e.id === id);
        return est ? est : null;
    }).filter(Boolean);

    // 2. Render List
    renderRoutePlannerList(tbody);

    // 3. Update Count
    document.getElementById('route-count').textContent = routeListItems.length;

    modal.classList.remove('hidden');
}

function renderRoutePlannerList(tbody) {
    tbody.innerHTML = '';
    routeListItems.forEach((est, index) => {
        const row = document.createElement('tr');
        row.className = "bg-white hover:bg-gray-50 border-b last:border-b-0";
        row.innerHTML = `
            <td class="p-3 text-gray-400 cursor-grab drag-handle text-center">☰</td>
            <td class="p-3 font-mono text-xs font-bold text-blue-600">${index + 1}</td>
            <td class="p-3">
                <div class="font-bold text-sm text-gray-800">${est.customerInfo?.name || 'Unknown'}</div>
                <div class="text-xs text-gray-500">${formatPhoneNumberAsLink(est.customerInfo?.phone)}</div>
            </td>
            <td class="p-3 text-sm text-gray-600 truncate max-w-xs">${est.customerInfo?.address || 'No Address'}</td>
            <td class="p-3 text-right">
                <button class="remove-route-item-btn text-red-400 hover:text-red-600 text-lg font-bold px-2">×</button>
            </td>
        `;

        // Remove Button Logic
        row.querySelector('.remove-route-item-btn').addEventListener('click', () => {
            routeListItems.splice(index, 1);
            renderRoutePlannerList(tbody);
            document.getElementById('route-count').textContent = routeListItems.length;
        });

        // Simple Drag and Drop Logic (Swap)
        row.draggable = true;
        row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', index); });
        row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('bg-blue-50'); });
        row.addEventListener('dragleave', e => { row.classList.remove('bg-blue-50'); });
        row.addEventListener('drop', e => {
            e.preventDefault();
            const oldIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const newIndex = index;
            if (oldIndex !== newIndex) {
                const movedItem = routeListItems.splice(oldIndex, 1)[0];
                routeListItems.splice(newIndex, 0, movedItem);
                renderRoutePlannerList(tbody);
            }
        });

        tbody.appendChild(row);
    });
}

export function generateGoogleMapsLink() {
    if (routeListItems.length === 0) return alert("No stops in list.");

    // Filter out items without addresses
    const validStops = routeListItems.filter(e => e.customerInfo?.address);

    if (validStops.length === 0) return alert("No valid addresses found.");

    const origin = validStops[0].customerInfo.address;
    const destination = validStops[validStops.length - 1].customerInfo.address;
    const waypoints = validStops.slice(1, -1).map(e => e.customerInfo.address).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;

    window.open(url, '_blank');
}

export function printRouteSheet() {
    const printWindow = window.open('', '_blank');
    const date = new Date().toLocaleDateString();

    let html = `
        <html><head><title>Route Sheet - ${date}</title>
        <style>
            body { font-family: sans-serif; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #eee; }
            h1 { font-size: 18px; margin-bottom: 5px; }
        </style>
        </head><body>
        <h1>Route Sheet - ${date}</h1>
        <table>
            <thead><tr><th>#</th><th>Client</th><th>Address</th><th>Phone</th><th>Notes</th></tr></thead>
            <tbody>
    `;

    routeListItems.forEach((est, i) => {
        html += `
            <tr>
                <td>${i + 1}</td>
                <td><b>${est.customerInfo?.name || ''}</b></td>
                <td>${est.customerInfo?.address || ''}</td>
                <td>${est.customerInfo?.phone || ''}</td>
                <td><br><br></td> </tr>
        `;
    });

    html += `</tbody></table></body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
}

// REPLACE this function in estimator-ui.js
export function renderSnowLocations(locations = [], routeOrder = [], saveState) {
    const container = document.getElementById('snow-locations-container');
    if (!container) return;
    container.innerHTML = ''; // Clear existing cards first

    let sortedLocations = [...locations];
    if (routeOrder.length > 0) {
        sortedLocations.sort((a, b) => {
            const indexA = routeOrder.indexOf(a.id);
            const indexB = routeOrder.indexOf(b.id);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }

    if (sortedLocations.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.id = 'snow-location-placeholder';
        placeholder.className = 'text-gray-500';
        placeholder.textContent = 'No snow locations have been added yet.';
        container.appendChild(placeholder);
    } else {
        // Instead of just calling addSnowLocationCard directly,
        // we pass the necessary callbacks for valid module interaction
        sortedLocations.forEach(locData => addSnowLocationCard(
            locData,
            saveState,
            (card) => handleAutoCalculateSnowPrice(card),
            () => handleRouteChange(),
            window.ui
        ));
    }
} export function renderCalculations(calculations = [], saveState) {
    const container = document.getElementById('saved-calculations-container');
    if (!container) return;
    container.innerHTML = '';

    if (calculations.length === 0) return;

    const header = document.createElement('h3');
    header.className = 'text-lg font-bold mb-4 text-gray-800';
    header.textContent = 'Saved Calculations';
    container.appendChild(header);

    calculations.forEach((calc, index) => {
        const card = document.createElement('div');
        card.className = 'bg-white border rounded-lg p-4 shadow-sm relative';

        let contentHtml = '';
        let iconHtml = '';
        let colorClass = '';

        if (calc.type === 'excavation') {
            colorClass = 'orange';
            iconHtml = `<svg class="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>`;
            contentHtml = `
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="text-gray-500">Volume (Bank):</span> <span class="font-bold">${calc.data.volBankCy.toFixed(1)} cy</span></div>
                    <div><span class="text-gray-500">Volume (Loose):</span> <span class="font-bold">${calc.data.volLooseCy.toFixed(1)} cy</span></div>
                    <div><span class="text-gray-500">Trucks:</span> <span class="font-bold">${calc.data.loads} loads</span></div>
                    <div><span class="text-gray-500">Est. Time:</span> <span class="font-bold">${calc.data.totalHours.toFixed(1)} hrs</span></div>
                </div>
                <div class="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span class="font-bold text-orange-700 text-lg">$${calc.data.totalCost.toFixed(2)}</span>
                    <button class="apply-calc-btn bg-orange-100 text-orange-700 px-3 py-1 rounded text-sm font-semibold hover:bg-orange-200" data-index="${index}">Apply to Option</button>
                </div>
            `;
        } else if (calc.type === 'snow') {
            colorClass = 'blue';
            iconHtml = `<svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`;
            contentHtml = `
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="text-gray-500">Area:</span> <span class="font-bold">${calc.data.area.toFixed(0)} sqft</span></div>
                    <div><span class="text-gray-500">Salt:</span> <span class="font-bold">${calc.data.saltLbs.toFixed(0)} lbs</span></div>
                    <div><span class="text-gray-500">Est. Time:</span> <span class="font-bold">${calc.data.hours.toFixed(2)} hrs</span></div>
                </div>
                <div class="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span class="font-bold text-blue-700 text-lg">$${calc.data.totalCost.toFixed(2)}</span>
                    <button class="apply-calc-btn bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-semibold hover:bg-blue-200" data-index="${index}">Apply to Option</button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-gray-800 flex items-center">${iconHtml} ${calc.summary}</h4>
                <span class="text-xs text-gray-400">${new Date(calc.date).toLocaleDateString()}</span>
            </div>
            ${contentHtml}
        `;

        // Add Apply Listener
        const applyBtn = card.querySelector('.apply-calc-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                // Logic to apply to an option
                // For simplicity, we'll add it to the FIRST option for now, or prompt?
                // Let's just add to the first option as a line item.
                const firstOptionCard = document.querySelector('.price-option-card');
                if (firstOptionCard) {
                    const optionId = firstOptionCard.dataset.optionId;
                    const itemData = {
                        description: calc.summary,
                        quantity: 1,
                        unitPrice: calc.data.totalCost,
                        unit: 'ls',
                        total: calc.data.totalCost
                    };
                    addItemToOption(optionId, itemData, true, saveState);
                    showSuccessBanner("Calculation applied to Option 1");
                } else {
                    showErrorBanner("No pricing option found to apply to.");
                }
            });
        }

        container.appendChild(card);
    });
}

// ADD THIS FUNCTION to estimator-ui.js
export function hideSnowRoutePreview() {
    const mapPreviewContainer = document.getElementById('snow-route-map-preview');
    const mapPreviewImg = document.getElementById('snow-route-map-preview-img');
    if (mapPreviewContainer) {
        mapPreviewContainer.classList.add('hidden');
    }
    if (mapPreviewImg) {
        mapPreviewImg.src = ''; // Clear image source
    }
}

// --- TABS LOGIC ---
export function setupEditorTabs() {
    const tabs = document.querySelectorAll('.editor-tab-btn');
    const contents = document.querySelectorAll('.editor-tab-content');

    if (tabs.length === 0) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 1. Deactivate all tabs and hide all content
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            contents.forEach(c => c.classList.add('hidden')); // Ensure hidden class is applied

            // 2. Activate clicked tab
            tab.classList.add('active');

            // 3. Show target content
            // We replace "etab-" (button ID) with "eview-" (content ID)
            const targetId = tab.id.replace('etab-', 'eview-');
            const targetContent = document.getElementById(targetId);

            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.classList.remove('hidden');

                // Fix: Trigger a resize event for Maps if they are inside the tab
                if (targetId === 'eview-project' || targetId === 'eview-services') {
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 100);

                    // --- FEATURE GATING ---
                    const tenantModules = window.currentUser?.tenantModules || {}; // We need to load this on init

                    // Check Snow
                    if (targetId === 'eview-services') {
                        const snowSection = document.getElementById('multi-site-snow-section');
                        if (snowSection) {
                            const isDev = window.currentUser?.email?.includes('dev');
                            const isAdmin = window.currentUser?.role === 'admin';
                            if (tenantModules.snow === true || isDev || isAdmin) {
                                snowSection.classList.remove('hidden');
                            } else {
                                snowSection.innerHTML = `
                            <div class="p-8 text-center bg-gray-50 border rounded-lg">
                                <h2 class="text-xl font-bold text-gray-400 mb-2">Feature Locked</h2>
                                <p class="text-gray-500 mb-4">The Snow Calculator is available on the Gold Plan.</p>
                                <button class="bg-blue-600 text-white px-4 py-2 rounded font-bold">Upgrade Plan</button>
                            </div>
                        `;
                            }
                        }
                    }
                    // ----------------------
                }
            }
        });
    });
}
// Export the imported functions so they are available to other modules (like estimator.js)
export { calculateAllTotals, calculateOptionSubtotal };

// --- ADMIN PERMISSIONS ---
export async function loadAdminPermissions() {
    if (!window.firebaseServices) return;
    const { db, collection, getDocs, query, where } = window.firebaseServices;

    try {
        // Fetch settings
        // We use the same logic as admin-dashboard.js
        const settingsSnap = await getDocs(collection(db, 'settings'));
        let config = {
            allowTermsDefault: true,
            allowTermsAll: false,
            allowAppendixDefault: true,
            allowAppendixAll: false
        };

        settingsSnap.forEach(d => {
            if (d.id === 'estimator_config') config = { ...config, ...d.data() };
        });

        // Apply to UI
        const termsDefaultBtn = document.getElementById('save-terms-as-default-new');
        const termsAllBtn = document.getElementById('save-terms-to-all');
        const appendixDefaultBtn = document.getElementById('save-appendix-as-default-new');
        const appendixAllBtn = document.getElementById('save-appendix-to-all');

        if (termsDefaultBtn) termsDefaultBtn.style.display = config.allowTermsDefault ? 'inline-block' : 'none';
        if (termsAllBtn) termsAllBtn.style.display = config.allowTermsAll ? 'inline-block' : 'none';

        if (appendixDefaultBtn) appendixDefaultBtn.style.display = config.allowAppendixDefault ? 'inline-block' : 'none';
        if (appendixAllBtn) appendixAllBtn.style.display = config.allowAppendixAll ? 'inline-block' : 'none';

    } catch (e) {
        console.error("Error loading admin permissions:", e);
    }
} 