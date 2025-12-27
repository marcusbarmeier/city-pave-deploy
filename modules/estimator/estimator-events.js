// estimator-events.js
// Handles all event listeners for the estimator module to decouple UI from logic.

export function setupEventListeners(context) {
    const {
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
        initializeDragAndDrop
    } = context;

    const addSafeListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.removeEventListener(event, handler);
            element.addEventListener(event, handler);
        }
    };

    // Standard Actions
    addSafeListener('create-new-estimate-button', 'click', handleCreateNewEstimate);
    addSafeListener('save-estimate-button', 'click', () => saveEstimate(getEstimateDataForSave, allEstimates, false));
    addSafeListener('back-to-dashboard-link', 'click', (e) => {
        e.preventDefault();
        ui.showView('dashboard-view', context.onShowEditor, context.onHideEditor);
        applyDashboardFilter();
    });
    addSafeListener('undo-button', 'click', undo);
    addSafeListener('redo-button', 'click', redo);
    addSafeListener('dashboard-filters', 'click', handleFilterClick);
    addSafeListener('dashboard-search-input', 'input', debounce(applyDashboardFilter, 300));

    // --- NEW: ROUTE PLANNER BUTTONS ---
    addSafeListener('launch-google-maps-btn', 'click', ui.generateGoogleMapsLink);
    addSafeListener('print-route-sheet-btn', 'click', ui.printRouteSheet);

    // Dashboard List Listeners
    const listContainer = document.getElementById('estimate-list-container');
    if (listContainer) {
        // Remove old listeners to prevent duplicates
        listContainer.removeEventListener('click', handleDashboardCardClick);
        listContainer.removeEventListener('change', handleDashboardCardChange);
        listContainer.removeEventListener('click', handleStarRatingClick);
        // Add new listeners
        listContainer.addEventListener('click', handleDashboardCardClick);
        listContainer.addEventListener('change', handleDashboardCardChange);
        listContainer.addEventListener('click', handleStarRatingClick);
    }

    // Batch Actions
    addSafeListener('select-all-checkbox', 'change', handleSelectAll);
    addSafeListener('print-dashboard-btn', 'click', ui.handlePrintDashboardList);

    // Quick Add
    addSafeListener('toggle-quick-add-form', 'click', ui.toggleQuickAddForm);
    addSafeListener('cancel-quick-add', 'click', ui.toggleQuickAddForm);
    addSafeListener('save-quick-add', 'click', () => saveQuickAdd(ui.toggleQuickAddForm));

    // Contact Search (Quick Add)
    addSafeListener('qa-search-contact', 'input', debounce(async (e) => {
        const term = e.target.value.toLowerCase();
        const resultsContainer = document.getElementById('qa-contact-results');

        if (!term || term.length < 2) {
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
            return;
        }

        const { db, collection, query, where, getDocs } = window.firebaseServices;

        try {
            // Simple search by name (client-side filtering for now as Firestore doesn't support native partial text search easily without external services)
            // For better performance in production, use Algolia or similar. 
            // Here we fetch all leads (cached if possible) or query by exact match if we had it.
            // Since we can't easily do partial match in Firestore, we'll fetch recent/all leads or use a "name_lower" field if it existed.
            // For this implementation, let's fetch all leads (assuming < 1000 active) or just rely on the user typing enough.
            // OPTIMIZATION: Just query leads collection.

            const q = query(collection(db, "leads"), where("tenantId", "==", "citypave"));
            const snapshot = await getDocs(q);

            const matches = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.name.toLowerCase().includes(term) ||
                    (data.contactInfo?.email && data.contactInfo.email.toLowerCase().includes(term)) ||
                    (data.contactInfo?.phone && data.contactInfo.phone.includes(term))) {
                    matches.push({ id: doc.id, ...data });
                }
            });

            resultsContainer.innerHTML = '';
            if (matches.length > 0) {
                matches.slice(0, 5).forEach(lead => {
                    const div = document.createElement('div');
                    div.className = "p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0";
                    div.innerHTML = `
                        <p class="font-bold text-sm">${lead.name}</p>
                        <p class="text-xs text-gray-500">${lead.contactInfo?.email || ''} ${lead.contactInfo?.phone ? ' • ' + lead.contactInfo.phone : ''}</p>
                    `;
                    div.addEventListener('click', () => {
                        document.getElementById('qa-customer-name').value = lead.name;
                        document.getElementById('qa-customer-email').value = lead.contactInfo?.email || '';
                        document.getElementById('qa-customer-phone').value = lead.contactInfo?.phone || '';
                        document.getElementById('qa-customer-address').value = lead.contactInfo?.address || '';
                        document.getElementById('qa-contact-notes').value = lead.notes || '';

                        // Clear search
                        e.target.value = '';
                        resultsContainer.classList.add('hidden');
                    });
                    resultsContainer.appendChild(div);
                });
                resultsContainer.classList.remove('hidden');
            } else {
                resultsContainer.classList.add('hidden');
            }
        } catch (err) {
            console.error("Error searching contacts:", err);
        }
    }, 300));

    // Sketches
    addSafeListener('new-sketch-dashboard-btn', 'click', () => ui.openNewSketchModal(window.allEstimates));
    addSafeListener('new-sketch-editor-btn', 'click', handleNewSketchFromEditor);
    addSafeListener('cancel-sketch-modal-btn', 'click', () => document.getElementById('new-sketch-modal').classList.add('hidden'));
    addSafeListener('sketch-for-new-estimate-btn', 'click', () => { window.location.href = 'sketch.html'; });
    addSafeListener('sketch-estimate-select', 'change', handleSketchForExisting);

    // Modals
    addSafeListener('confirm-delete-button', 'click', handleDeleteConfirmation);
    addSafeListener('cancel-delete-button', 'click', ui.hideDeleteModal);
    addSafeListener('cancel-site-visit-button', 'click', () => document.getElementById('site-visit-modal').classList.add('hidden'));
    addSafeListener('save-site-visit-button', 'click', () => saveSiteVisit(allEstimates));
    addSafeListener('cancel-tag-button', 'click', () => document.getElementById('tag-modal').classList.add('hidden'));
    addSafeListener('save-tag-button', 'click', saveTags);
    addSafeListener('manage-tags-btn', 'click', () => ui.openTagModal(document.getElementById('editing-estimate-id').value, allEstimates));
    addSafeListener('cancel-category-button', 'click', () => document.getElementById('category-modal').classList.add('hidden'));
    addSafeListener('save-category-button', 'click', batchUpdateCategory);

    // Snow & Editor Items
    addSafeListener('copy-sketch-to-option', 'click', () => ui.copySketchToFirstOption(saveState));
    addSafeListener('add-site-visit-button', 'click', () => ui.openSiteVisitModal(document.getElementById('editing-estimate-id').value, allEstimates));
    addSafeListener('add-work-stage-button', 'click', () => ui.addWorkStage(saveState));
    addSafeListener('add-work-photo-btn', 'click', () => document.getElementById('work-photo-input').click());
    addSafeListener('work-photo-input', 'change', handleWorkPhotoUpload);
    addSafeListener('before-after-photo-input', 'change', handleBeforeAfterUpload);
    addSafeListener('clear-signature-btn', 'click', () => signaturePad?.clear());
    addSafeListener('clear-witness-signature-btn-editor', 'click', () => witnessSignaturePad?.clear());
    addSafeListener('upload-signed-copy-btn', 'click', () => document.getElementById('signed-copy-input').click());
    addSafeListener('signed-copy-input', 'change', handleSignedCopyUpload);

    // Snow Route Specific
    addSafeListener('snow-is-routed-job', 'change', handleRouteChange);
    addSafeListener('add-snow-location-btn', 'click', () => {
        ui.addSnowLocationCard(null, saveState);
        if (document.getElementById('snow-is-routed-job')?.checked) handleRouteChange();
    });

    // Content Saving
    const estimateId = document.getElementById('editing-estimate-id').value;
    addSafeListener('save-appendix-for-estimate', 'click', () => saveContentToEstimate('appendix'));
    addSafeListener('save-appendix-as-default-new', 'click', () => saveContentAsDefault('appendix'));
    addSafeListener('save-appendix-to-all', 'click', () => ui.promptAction('saveAppendixToAll', estimateId, [], allEstimates));
    addSafeListener('save-terms-for-estimate', 'click', () => saveContentToEstimate('terms'));
    addSafeListener('save-terms-as-default-new', 'click', () => saveContentAsDefault('terms'));
    addSafeListener('save-terms-to-all', 'click', () => ui.promptAction('saveTermsToAll', estimateId, [], allEstimates));

    // Init Logic
    if (initializeDragAndDrop) initializeDragAndDrop();

    const editorView = document.getElementById('editor-view');
    if (editorView) {
        editorView.removeEventListener('input', debounce(saveState, 500));
        editorView.removeEventListener('click', handleEditorClicks);
        editorView.addEventListener('input', debounce(saveState, 500));
        editorView.addEventListener('click', handleEditorClicks);
    }
    window.addEventListener("resize", debounce(resizeAllPads, 250));
}
