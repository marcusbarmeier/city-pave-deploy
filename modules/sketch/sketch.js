// © 2025 City Pave. All Rights Rights Reserved.
// This code is the confidential and proprietary property of City Pave.
// Unauthorized copying, distribution, or use of this code is strictly prohibited.
// Filename: sketch.js
import { pricingOptions, GST_RATE } from '../estimator/pricing.js';
import { generatePrintableEstimateHTML } from '../estimator/outputGenerator.js';
import { CalculatorManager } from './calculators.js'; // Import CalculatorManager
import { PricingBridge } from '../bridges/PricingBridge.js'; // Unified Data Bridge
// Import the pdf.js library
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;


// --- APPLICATION STATE ---
const appState = {
    map: null,
    canvas: null,
    ctx: null,
    isDrawing: false,
    currentTool: 'select',
    strokeColor: '#ff0000',
    strokeWidth: 5,
    opacity: 1,
    drawings: [],
    overlayImage: {
        img: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        scale: 1,
        rotation: 0,
        opacity: 0.7,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
    },
    selectedShapeIds: [], // Now an array to hold multiple IDs
    isDraggingHandle: false,
    draggedHandleInfo: null,
    isDraggingShape: false,
    dragStartPos: null,
    dragStartShapePath: null,
    historyStack: [],
    historyIndex: -1,
    isApplyingHistory: false,
    currentPath: [],
    startPos: null,
    mapProjectionOverlay: null,
    animationFrameId: null,
    estimateId: null,
    sketchId: null,
    userLocationMarker: null,
    locationWatchId: null,
    isBaMapMode: false,
    baMarkers: [],
    isSnowRouteMode: false,
    snowLocations: [],
    calculatorMode: null, // 'excavation' or 'snow'
    calculatorManager: null
};
const infoPopup = document.createElement('div');
infoPopup.id = 'selection-info-popup';
document.body.appendChild(infoPopup);


// --- CONSTANTS ---
const METER_TO_FEET = 3.28084;
const SQ_METER_TO_SQ_FEET = 10.7639;

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);
}

// --- UTILITY FUNCTIONS ---
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}
const debouncedSaveState = debounce(saveState, 300);


export function initializeSketchApp() {
    console.log("Sketch.js: initializeSketchApp() START"); // Log Start
    try {
        appState.canvas = document.getElementById('drawing-canvas');
        if (!appState.canvas) {
            console.error("Sketch.js: Canvas element not found!");
            return;
        }
        appState.ctx = appState.canvas.getContext('2d');
        const urlParams = new URLSearchParams(window.location.search);
        appState.estimateId = urlParams.get('estimateId');
        appState.sketchId = urlParams.get('sketchId');
        appState.isBaMapMode = urlParams.get('baMap') === 'true';
        appState.isSnowRouteMode = urlParams.get('snowRoute') === 'true';
        appState.calculatorMode = urlParams.get('mode'); // 'excavation' or 'snow'

        appState.initialAddress = urlParams.get('address') || '';
        console.log("Sketch.js: Mode params parsed:", { estimateId: appState.estimateId, sketchId: appState.sketchId, baMap: appState.isBaMapMode, snowRoute: appState.isSnowRouteMode, mode: appState.calculatorMode });

        // --- Mode-Specific Setup ---
        if (appState.isBaMapMode) {
            console.log("Sketch.js: Setting up BA Map Mode...");
            const markersParam = urlParams.get('markers');
            if (markersParam && appState.estimateId) {
                try {
                    const parsedMarkers = JSON.parse(decodeURIComponent(markersParam));
                    initializeBaMarkers(parsedMarkers);
                    updateMeasurementList();
                    loadEstimateData(appState.estimateId);
                    if (parsedMarkers.length > 0) {
                        const firstMarkerLocation = { lat: parsedMarkers[0].lat, lng: parsedMarkers[0].lng };
                        const centerMapOnMarker = () => {
                            if (appState.map) {
                                appState.map.setCenter(firstMarkerLocation);
                                appState.map.setZoom(20);
                                console.log("Sketch.js: BA Mode - Map centered on first marker.");
                            } else { setTimeout(centerMapOnMarker, 100); }
                        };
                        centerMapOnMarker();
                    }
                    document.getElementById('page-title').textContent = 'Edit Photo Locations';
                    document.getElementById('measurements-panel-wrapper').style.display = 'flex';
                    const totalsPanel = document.getElementById('totals-panel'); if (totalsPanel) totalsPanel.style.display = 'none';
                    document.getElementById('default-tools-panel').style.display = 'none';
                    console.log("Sketch.js: BA Mode UI adjusted.");
                } catch (e) { console.error("Sketch.js: Error parsing markers parameter:", e); showAlert('Error', 'Could not load photo locations.'); appState.isBaMapMode = false; }
            } else { console.error("Sketch.js: Missing params for BA Map Mode."); showAlert('Error', 'Missing required parameters for Before & After map editing.'); appState.isBaMapMode = false; }

        } else if (appState.isSnowRouteMode) {
            console.log("Sketch.js: Setting up Snow Route Mode...");
            const locationsParam = urlParams.get('locations');
            if (locationsParam && appState.estimateId) {
                try {
                    // **** PARSE and LOG snowLocations ****
                    appState.snowLocations = JSON.parse(decodeURIComponent(locationsParam));
                    console.log("Sketch.js: Parsed snowLocations:", JSON.stringify(appState.snowLocations, null, 2)); // <-- ADDED LOG
                    // **** END LOG ****

                    document.getElementById('page-title').textContent = 'Snow Route Plan';
                    document.getElementById('measurements-panel-wrapper').style.display = 'none';
                    document.getElementById('tools-panel').style.display = 'block';
                    document.getElementById('default-tools-panel').style.display = 'none';
                    document.getElementById('snow-route-panel').classList.remove('hidden');
                    document.getElementById('totals-panel').style.display = 'none';
                    document.getElementById('save-btn').textContent = 'Save Route Order';
                    loadEstimateData(appState.estimateId);
                    console.log("Sketch.js: Snow Route Mode UI adjusted.");
                } catch (e) { console.error("Sketch.js: Could not parse snow locations", e); showAlert('Error', 'Could not load snow location data.'); appState.isSnowRouteMode = false; }
            } else { console.error("Sketch.js: Missing params for Snow Route Mode."); showAlert('Error', 'Missing required parameters for Snow Route planning.'); appState.isSnowRouteMode = false; }

        } else if (appState.calculatorMode) {
            // --- CALCULATOR MODE ---
            console.log("Sketch.js: Setting up Calculator Mode:", appState.calculatorMode);

            // Hide default tools panel, show calculator panel
            document.getElementById('default-tools-panel').classList.add('hidden');
            const calcPanel = document.getElementById('calculator-panel');
            if (calcPanel) calcPanel.classList.remove('hidden');

            // Initialize Calculator Manager
            // We pass a proxy object to allow the calculator to access measurements
            const sketchAppProxy = {
                get measurements() { return appState.drawings; }
            };

            // Try to parse dynamic config if present
            const configParam = urlParams.get('config');
            let dynamicConfig = null;
            if (configParam) {
                try {
                    dynamicConfig = JSON.parse(decodeURIComponent(configParam));
                } catch (e) {
                    console.error("Failed to parse dynamic calculator config:", e);
                }
            }

            appState.calculatorManager = new CalculatorManager(sketchAppProxy, appState.calculatorMode, dynamicConfig);

            loadEstimateData(appState.estimateId);
            document.getElementById('save-btn').style.display = 'none'; // Hide default save button, calculator has its own

        } else if (appState.estimateId) {
            console.log("Sketch.js: Setting up Standard Sketch Mode (Existing Estimate)...");
            document.getElementById('save-btn').title = 'Save Sketch to Estimate';
            if (appState.sketchId) { console.log("Sketch.js: Loading existing sketch:", appState.sketchId); loadSketchForEditing(); }
            else { console.log("Sketch.js: Loading estimate data only:", appState.estimateId); loadEstimateData(appState.estimateId); }
            document.getElementById('image-controls-panel').classList.add('active'); // <<< FIX ADDED

        } else {
            console.log("Sketch.js: Setting up Standard Sketch Mode (New Estimate)...");
            document.getElementById('save-btn').title = 'Save New Sketch & Lead';
            if (appState.initialAddress) { document.getElementById('pac-input').value = appState.initialAddress; }
            document.getElementById('image-controls-panel').classList.add('active'); // <<< FIX ADDED
        }

        const backLink = document.querySelector('a[href^="estimator.html"]');
        if (backLink && appState.estimateId) {
            const section = appState.isBaMapMode ? 'before-after' : (appState.isSnowRouteMode ? 'snow' : 'sketches');
            backLink.href = `/modules/estimator/index.html?view=editor&estimateId=${appState.estimateId}&section=${section}`;
            console.log("Sketch.js: Back link updated to:", backLink.href);
        }

        console.log("Sketch.js: Initializing Map and Autocomplete...");
        initMapAndAutocomplete();
        console.log("Sketch.js: Map object after init:", appState.map);

        if (appState.isSnowRouteMode) {
            console.log("Sketch.js: Delaying Snow Route initialization...");
            setTimeout(() => {
                if (appState.map) {
                    console.log("Sketch.js: Calling initializeSnowRouteMode()...");
                    initializeSnowRouteMode();
                } else {
                    console.error("Sketch.js: Map not ready for snow route initialization.");
                    showAlert('Error', 'Map failed to load correctly for route planning.');
                }
            }, 500);
        }

        console.log("Sketch.js: Setting up Event Listeners...");
        setupEventListeners();

        // --- THIS TURNS ON THE KEYBOARD SHORTCUTS ---
        setupKeyboardShortcuts();
        // --------------------------------------------

        console.log("Sketch.js: Resizing Canvas...");
        resizeCanvas();
        console.log("Sketch.js: Starting Drawing Loop...");
        startDrawingLoop();
        console.log("Sketch.js: Updating Total Estimate...");
        updateTotalEstimate();

        if (appState.historyStack.length === 0) {
            console.log("Sketch.js: Saving initial state...");
            saveState();
        }

        console.log("Sketch.js: initializeSketchApp() FINISHED"); // Log End

    } catch (error) {
        console.error("Sketch.js: CRITICAL ERROR inside initializeSketchApp():", error); // Log Error
        alert(`Critical Error during initialization: ${error.message}. App may be broken.`);
    }
}

function initializeBaMarkers(markers) {
    appState.drawings = markers.map(marker => ({
        id: marker.id,
        type: 'gpsMarker',
        path: [{ lat: marker.lat, lng: marker.lng }],
        originalPath: [{ lat: marker.lat, lng: marker.lng }],
        title: marker.title,
        color: '#FFA500', // Orange color for BA markers
        width: 5,
        opacity: 1,
        scale: 1,
        rotation: 0,
        measurement: 0,
        measurementType: null,
        lineItemDescription: 'Photo Location'
    }));
    setTool('select');
    saveState();
}

function saveState() {
    if (appState.isApplyingHistory) return;
    if (appState.historyIndex < appState.historyStack.length - 1) {
        appState.historyStack = appState.historyStack.slice(0, appState.historyIndex + 1);
    }
    const currentState = JSON.stringify(appState.drawings);
    if (appState.historyStack[appState.historyIndex] === currentState) {
        return;
    }
    appState.historyStack.push(currentState);
    appState.historyIndex = appState.historyStack.length - 1;
}

function applyState(stateIndex) {
    if (stateIndex < 0 || stateIndex >= appState.historyStack.length) return;
    appState.isApplyingHistory = true;
    appState.drawings = JSON.parse(appState.historyStack[stateIndex]);
    updateMeasurementList();
    appState.isApplyingHistory = false;
}

async function loadEstimateData(estimateId) {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js");
    try {
        const docRef = doc(window.db, 'estimates', estimateId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('client-name').value = data.customerInfo?.name || '';
            document.getElementById('pac-input').value = data.customerInfo?.address || '';
            if (!appState.isBaMapMode) {
                document.getElementById('site-notes').value = data.contactHistory?.description?.replace(/<[^>]+>/g, '') || '';
            }
            document.getElementById('estimate-number').value = docSnap.id;
        }
    } catch (e) {
        console.error("Error loading estimate data:", e);
    }
}

// REPLACE THIS ENTIRE FUNCTION IN sketch.js

async function loadSketchForEditing() {
    if (!appState.sketchId || !appState.estimateId) return;
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js");
    try {
        const docRef = doc(window.db, 'estimates', appState.estimateId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const estimateData = docSnap.data();
            const sketchToLoad = (estimateData.sketches || []).find(s => s.id === appState.sketchId);
            if (sketchToLoad) {
                document.getElementById('client-name').value = sketchToLoad.clientName || '';
                document.getElementById('pac-input').value = sketchToLoad.clientAddress || '';
                document.getElementById('site-notes').value = sketchToLoad.siteNotes || '';
                document.getElementById('estimate-number').value = appState.estimateId;
                document.getElementById('sketch-title').value = sketchToLoad.title || sketchToLoad.clientAddress || '';

                appState.drawings = sketchToLoad.measurements.map(d => {
                    let path = [];
                    if (d.pathLats && d.pathLngs) {
                        path = d.pathLats.map((lat, i) => ({ lat: lat, lng: d.pathLngs[i] }));
                    }

                    const newDrawing = {
                        id: d.id,
                        type: d.type,
                        measurement: d.measurement || 0,
                        measurementType: d.measurementType,
                        service: d.service || 'none',
                        price: d.price || 0,
                        lineItemDescription: d.lineItemDescription || '',
                        path: path,
                        originalPath: JSON.parse(JSON.stringify(path)),
                        color: d.color || '#ff0000',
                        width: d.width || 5,
                        opacity: d.opacity || 1,
                        scale: d.scale || 1,
                        rotation: d.rotation || 0,
                        depth: d.depth,
                        text: d.text,
                        fontSize: d.fontSize || 16,
                        title: d.title
                    };
                    if (newDrawing.scale !== 1 || newDrawing.rotation !== 0) {
                        transformShape(newDrawing, false);
                    }
                    return newDrawing;
                });

                updateMeasurementList();
                updateTotalEstimate();

                // --- MODIFIED: Restore Overlay Image (THE FIX) ---
                if (sketchToLoad.overlayImage && sketchToLoad.overlayImage.src) {
                    const overlayData = sketchToLoad.overlayImage;
                    const image = new Image();

                    // --- THIS IS THE FIX ---
                    // We must set crossOrigin = 'Anonymous' to load images from Firebase Storage
                    if (overlayData.src.startsWith('http')) {
                        image.crossOrigin = 'Anonymous';
                    }
                    // --- END FIX ---

                    image.onload = () => {
                        setOverlayImage(image);

                        appState.overlayImage.x = overlayData.x || 0;
                        appState.overlayImage.y = overlayData.y || 0;
                        appState.overlayImage.scale = overlayData.scale || 1;
                        appState.overlayImage.rotation = overlayData.rotation || 0;
                        appState.overlayImage.opacity = overlayData.opacity || 0.7;

                        // --- ADDED FIX: Also set the appState.overlayImage.src ---
                        // We need this so if we re-save *without* changing the image,
                        // we know not to re-upload it.
                        appState.overlayImage.src = overlayData.src;
                        // --- END ADDED FIX ---

                        document.getElementById('image-opacity-slider').value = appState.overlayImage.opacity;
                        document.getElementById('image-opacity-value').textContent = Math.round(appState.overlayImage.opacity * 100);
                        document.getElementById('image-scale-slider').value = appState.overlayImage.scale;
                        document.getElementById('image-scale-value').textContent = Math.round(appState.overlayImage.scale * 100);
                        document.getElementById('image-rotation-slider').value = appState.overlayImage.rotation;
                        document.getElementById('image-rotation-value').textContent = appState.overlayImage.rotation;

                        const imageControls = document.getElementById('image-controls-panel');
                        imageControls.classList.add('active');
                        const header = imageControls.querySelector('.accordion-header');
                        if (header && !header.classList.contains('active')) {
                            header.click();
                        }
                    };

                    // Set the src to trigger the onload event
                    image.src = overlayData.src; // This is now a storage URL or dataURL
                }
                // --- END MODIFIED ---

                redrawCanvas();

                // --- NEW: Reload Calculator Config if present ---
                if (sketchToLoad.calculatorMode || sketchToLoad.calculatorConfig) {
                    console.log("Restoring saved calculator state:", sketchToLoad.calculatorMode);

                    // 1. Setup UI
                    document.getElementById('default-tools-panel').classList.add('hidden');
                    const calcPanel = document.getElementById('calculator-panel');
                    if (calcPanel) calcPanel.classList.remove('hidden');

                    // 2. Init Manager
                    // We pass a proxy object to allow the calculator to access measurements
                    const sketchAppProxy = {
                        get measurements() { return appState.drawings; }
                    };

                    // Ensure we import the Class if it wasn't already (it is imported at top of file, so we are good)
                    // But we need to make sure we don't overwrite if URL param took precedence (unlikely if we are loading sketchId)
                    if (!appState.calculatorManager) {
                        appState.calculatorManager = new CalculatorManager(sketchAppProxy, sketchToLoad.calculatorMode || 'custom', sketchToLoad.calculatorConfig);
                    }
                }
                // --- END NEW ---

                saveState();
            }
        }
    } catch (e) {
        console.error("Error loading sketch for editing:", e);
        showAlert('Error', 'Could not load the sketch for editing.');
    }
}

function initMapAndAutocomplete() {
    class ProjectionOverlay extends google.maps.OverlayView { constructor() { super(); } onAdd() { } onRemove() { } draw() { } }
    const initialPos = { lat: 49.8951, lng: -97.1384 };
    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: initialPos, zoom: 12, mapTypeId: 'satellite', disableDefaultUI: true,
        gestureHandling: 'cooperative', mapId: 'DA574CF574559857', tilt: 0
    });
    appState.mapProjectionOverlay = new ProjectionOverlay();
    appState.mapProjectionOverlay.setMap(appState.map);
    const input = document.getElementById("pac-input");
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo("bounds", appState.map);
    autocomplete.setFields(["formatted_address", "geometry"]);
    autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) return;
        appState.map.setCenter(place.geometry.location);
        appState.map.setZoom(20);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const addressFromUrl = urlParams.get('address');
    if (addressFromUrl && !appState.isBaMapMode && !appState.isSnowRouteMode) {
        input.value = addressFromUrl;
        const placesService = new google.maps.places.PlacesService(appState.map);
        placesService.findPlaceFromQuery({
            query: addressFromUrl,
            fields: ['formatted_address', 'geometry']
        }, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0] && results[0].geometry) {
                appState.map.setCenter(results[0].geometry.location);
                appState.map.setZoom(20);
                if (results[0].formatted_address) {
                    input.value = results[0].formatted_address;
                }
            } else {
                console.warn("Geocode was not successful for the following reason: " + status);
            }
        });
    }

    appState.map.addListener('idle', () => {
        requestAnimationFrame(redrawCanvas);
    });

    ['center_changed', 'zoom_changed', 'bounds_changed'].forEach(event => {
        appState.map.addListener(event, () => requestAnimationFrame(redrawCanvas));
    });
}

function setupEventListeners() {
    const canvas = appState.canvas;

    // Helper to safely add listener
    const addListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // Tools
    addListener('tool-select', 'click', () => setTool('select'));
    addListener('tool-pan', 'click', () => setTool('pan'));
    addListener('tool-freeDraw', 'click', () => setTool('freeDraw'));
    addListener('tool-line', 'click', () => setTool('line'));
    addListener('tool-circle', 'click', () => setTool('circle'));
    addListener('tool-polygon', 'click', () => setTool('polygon'));
    addListener('tool-depthPoint', 'click', () => setTool('depthPoint'));
    addListener('tool-text', 'click', () => setTool('text'));
    addListener('tool-gpsMarker', 'click', () => setTool('gpsMarker'));

    // Map Controls
    addListener('toggle-location-btn', 'click', toggleLiveLocation);
    addListener('zoom-in-btn', 'click', () => appState.map.setZoom(appState.map.getZoom() + 1));
    addListener('zoom-out-btn', 'click', () => appState.map.setZoom(appState.map.getZoom() - 1));

    // History & Actions
    addListener('undo-btn', 'click', undo);
    addListener('redo-btn', 'click', redo);
    addListener('clear-btn', 'click', clearAll);
    addListener('print-snow-route-btn', 'click', () => window.print());
    addListener('print-btn', 'click', downloadAsImage);

    // Save Button Logic (Preserved)
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        // Clone to clear old listeners if any
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        if (appState.isBaMapMode) {
            newSaveBtn.addEventListener('click', saveBaMarkerUpdates);
        } else if (appState.isSnowRouteMode) {
            newSaveBtn.addEventListener('click', saveSnowRouteOrder);
        } else {
            newSaveBtn.addEventListener('click', saveSketch);
        }
    }

    // Unified Properties Panel Inputs (Safe Checks)
    addListener('prop-color-picker', 'input', (e) => applyPropertyToSelectedShapes('color', e.target.value));

    addListener('prop-width-slider', 'input', (e) => {
        const width = parseInt(e.target.value, 10);
        const display = document.getElementById('prop-width-value');
        if (display) display.textContent = width;
        applyPropertyToSelectedShapes('width', width);
    });

    addListener('prop-fontsize-slider', 'input', (e) => {
        const size = parseInt(e.target.value, 10);
        const display = document.getElementById('prop-fontsize-value');
        if (display) display.textContent = size;
        applyPropertyToSelectedShapes('fontSize', size);
    });

    addListener('prop-opacity-slider', 'input', (e) => {
        const opacity = parseFloat(e.target.value);
        const display = document.getElementById('prop-opacity-value');
        if (display) display.textContent = Math.round(opacity * 100);
        applyPropertyToSelectedShapes('opacity', opacity);
    });

    addListener('prop-scale-slider', 'input', (e) => {
        const scale = parseFloat(e.target.value);
        const display = document.getElementById('prop-scale-value');
        if (display) display.textContent = Math.round(scale * 100);
        applyPropertyToSelectedShapes('scale', scale, true);
    });

    addListener('prop-rotation-slider', 'input', (e) => {
        const rotation = parseInt(e.target.value, 10);
        const display = document.getElementById('prop-rotation-value');
        if (display) display.textContent = rotation;
        applyPropertyToSelectedShapes('rotation', rotation, true);
    });

    // New Unified Panel Buttons
    addListener('delete-selected-btn', 'click', () => {
        if (confirm("Delete selected items?")) {
            appState.selectedShapeIds.forEach(id => {
                appState.drawings = appState.drawings.filter(d => d.id !== id);
            });
            appState.selectedShapeIds = [];
            updateMeasurementList();
            updatePropertiesPanel();
            saveState();
            redrawCanvas();
        }
    });

    addListener('duplicate-selected-btn', 'click', () => {
        appState.selectedShapeIds.forEach(id => duplicateDrawing(id));
    });

    // Default Tool Inputs (Sidebar)
    addListener('color-picker', 'input', (e) => { appState.strokeColor = e.target.value; });
    addListener('stroke-width', 'input', (e) => { appState.strokeWidth = parseInt(e.target.value, 10); });
    addListener('opacity', 'input', (e) => { appState.opacity = parseFloat(e.target.value); });

    // Image Overlay Inputs
    addListener('add-image-btn', 'click', () => { document.getElementById('image-upload-input')?.click(); });
    addListener('image-upload-input', 'change', handleImageUpload);
    addListener('remove-image-btn', 'click', () => {
        appState.overlayImage.img = null;
        appState.overlayImage.src = null;
        redrawCanvas();
        const imageControls = document.getElementById('image-controls-panel');
        const header = imageControls?.querySelector('.accordion-header');
        if (header && header.classList.contains('active')) header.click();
    });

    addListener('image-opacity-slider', 'input', (e) => {
        appState.overlayImage.opacity = parseFloat(e.target.value);
        const display = document.getElementById('image-opacity-value');
        if (display) display.textContent = Math.round(appState.overlayImage.opacity * 100);
        redrawCanvas();
    });

    addListener('image-scale-slider', 'input', (e) => {
        appState.overlayImage.scale = parseFloat(e.target.value);
        const display = document.getElementById('image-scale-value');
        if (display) display.textContent = Math.round(appState.overlayImage.scale * 100);
        redrawCanvas();
    });

    addListener('image-rotation-slider', 'input', (e) => {
        appState.overlayImage.rotation = parseInt(e.target.value, 10);
        const display = document.getElementById('image-rotation-value');
        if (display) display.textContent = appState.overlayImage.rotation;
        redrawCanvas();
    });

    // Canvas Interaction
    if (canvas) {
        const eventOptions = { passive: false };
        canvas.addEventListener('mousedown', handleMouseDown, eventOptions);
        canvas.addEventListener('mousemove', handleMouseMove, eventOptions);
        canvas.addEventListener('mouseup', handleMouseUp, eventOptions);
        canvas.addEventListener('mouseleave', () => {
            if (appState.isDrawing || appState.isDraggingHandle || appState.overlayImage.isDragging || appState.isDraggingShape) {
                handleMouseUp({});
            }
        });
        canvas.addEventListener('dblclick', handleDoubleClick, eventOptions);
        canvas.addEventListener('touchstart', handleMouseDown, eventOptions);
        canvas.addEventListener('touchmove', handleMouseMove, eventOptions);
        canvas.addEventListener('touchend', handleMouseUp, eventOptions);
    }
    window.addEventListener('resize', resizeCanvas);

    // Sidebar Accordions
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const isActive = header.classList.contains('active');

            document.querySelectorAll('.accordion-header').forEach(h => {
                h.classList.remove('active');
                h.nextElementSibling.style.maxHeight = null;
                h.nextElementSibling.classList.remove('open');
            });

            if (!isActive) {
                header.classList.add('active');
                content.classList.add('open');
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    });

    // Measurements Panel Toggle
    addListener('measurements-toggle-btn', 'click', () => {
        const list = document.getElementById('measurement-list');
        const icon = document.getElementById('measurements-toggle-icon');
        if (list) list.classList.toggle('hidden');
        if (icon) icon.classList.toggle('rotate-180');
    });
}

// REPLACE THIS ENTIRE FUNCTION IN sketch.js

function updatePropertiesPanel() {
    const editPanel = document.getElementById('unified-edit-panel');
    const selectionCount = appState.selectedShapeIds.length;

    if (selectionCount > 0) {
        editPanel.classList.remove('hidden');
        editPanel.classList.add('flex'); // Ensure flex display

        const selectedShapes = appState.selectedShapeIds.map(id => appState.drawings.find(d => d.id === id)).filter(Boolean);
        if (selectedShapes.length === 0) return;
        const firstShape = selectedShapes[0];

        // Sync Color
        const allHaveSameColor = selectedShapes.every(s => s.color === firstShape.color);
        document.getElementById('prop-color-picker').value = allHaveSameColor ? firstShape.color : '#cccccc';

        // Sync Opacity
        const allHaveSameOpacity = selectedShapes.every(s => s.opacity === firstShape.opacity);
        document.getElementById('prop-opacity-slider').value = allHaveSameOpacity ? firstShape.opacity : 1;
        document.getElementById('prop-opacity-value').textContent = allHaveSameOpacity ? Math.round(firstShape.opacity * 100) : '--';

        // Sync Width (if applicable)
        const shapesWithWidth = selectedShapes.filter(s => s.hasOwnProperty('width'));
        const widthSlider = document.getElementById('prop-width-slider');
        if (shapesWithWidth.length > 0) {
            widthSlider.disabled = false;
            const allHaveSameWidth = shapesWithWidth.every(s => s.width === shapesWithWidth[0].width);
            widthSlider.value = allHaveSameWidth ? shapesWithWidth[0].width : 5;
            document.getElementById('prop-width-value').textContent = allHaveSameWidth ? shapesWithWidth[0].width : '--';
        } else {
            widthSlider.disabled = true; // Disable for text/markers if no width property
        }

    } else {
        editPanel.classList.add('hidden');
        editPanel.classList.remove('flex');
    }
}

// --- AND REPLACE THE updatePropertiesPanel FUNCTION WITH THIS ---

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const image = new Image();

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            image.onload = () => setOverlayImage(image);
            image.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
        try {
            const fileReader = new FileReader();
            fileReader.onload = async function () {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                const numPages = pdf.numPages;

                let pageNum = 1;
                if (numPages > 1) {
                    const userInput = prompt(`This PDF has ${numPages} pages. Please enter a page number to display (1-${numPages}):`, '1');
                    if (userInput === null) return;
                    pageNum = parseInt(userInput, 10);
                    if (isNaN(pageNum) || pageNum < 1 || pageNum > numPages) {
                        showAlert('Invalid Page', `Please enter a number between 1 and ${numPages}. Defaulting to page 1.`);
                        pageNum = 1;
                    }
                }

                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;

                await page.render({ canvasContext: tempCtx, viewport: viewport }).promise;

                image.onload = () => setOverlayImage(image);
                image.src = tempCanvas.toDataURL();
            };
            fileReader.readAsArrayBuffer(file);
        } catch (error) {
            console.error('Error rendering PDF:', error);
            showAlert('Error', 'Could not render the PDF file.');
        }
    } else {
        showAlert('Error', 'Unsupported file type. Please select a JPG, PNG, or PDF file.');
    }

    event.target.value = '';
}

// REPLACE this function in sketch.js

function setOverlayImage(img) {
    const { overlayImage, canvas } = appState;
    overlayImage.img = img;
    overlayImage.src = img.src; // <-- THIS IS THE NEW LINE

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;
    const scaleX = canvasWidth / img.width;
    const scaleY = canvasHeight / img.height;
    const initialScale = Math.min(scaleX, scaleY) * 0.8;

    overlayImage.width = img.width;
    overlayImage.height = img.height;
    overlayImage.scale = initialScale;

    overlayImage.x = (canvasWidth - (img.width * initialScale)) / 2;
    overlayImage.y = (canvasHeight - (img.height * initialScale)) / 2;

    overlayImage.rotation = 0;
    overlayImage.opacity = 0.7;

    const imageControls = document.getElementById('image-controls-panel');
    imageControls.classList.add('active');
    document.getElementById('image-opacity-slider').value = 0.7;
    document.getElementById('image-opacity-value').textContent = 70;
    document.getElementById('image-scale-slider').value = initialScale;
    document.getElementById('image-scale-value').textContent = Math.round(initialScale * 100);
    document.getElementById('image-rotation-slider').value = 0;
    document.getElementById('image-rotation-value').textContent = 0;

    // Open the accordion
    const header = imageControls.querySelector('.accordion-header');
    if (header && !header.classList.contains('active')) {
        header.click();
    }
}

// --- THIS IS THE NEW CODE TO PASTE ---

function setTool(tool) {
    if (appState.isDrawing && appState.currentTool === 'polygon') {
        appState.currentPath = [];
        appState.isDrawing = false;
    }
    appState.currentTool = tool;
    // When changing tools, we should not clear the selection
    // appState.selectedShapeIds = []; 
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tool-${tool}`).classList.add('active');

    // ** THIS IS THE FIX **
    // Only change map/canvas options if they exist
    if (appState.canvas && appState.map) {
        if (tool === 'pan') {
            appState.canvas.style.cursor = 'grab';
            appState.canvas.style.pointerEvents = 'none';
            appState.map.setOptions({ draggableCursor: 'grab' });
        } else {
            appState.canvas.style.pointerEvents = 'auto';
            appState.map.setOptions({ draggableCursor: null });
            if (tool === 'select') {
                appState.canvas.style.cursor = 'default';
            } else {
                appState.canvas.style.cursor = 'crosshair';
            }
        }
    }
}

function isPointInImage(point) {
    const { overlayImage } = appState;
    if (!overlayImage.img) return false;

    const scaledWidth = overlayImage.width * overlayImage.scale;
    const scaledHeight = overlayImage.height * overlayImage.scale;
    const centerX = overlayImage.x + scaledWidth / 2;
    const centerY = overlayImage.y + scaledHeight / 2;
    const angleRad = -overlayImage.rotation * (Math.PI / 180);

    const translatedX = point.x - centerX;
    const translatedY = point.y - centerY;
    const unrotatedX = translatedX * Math.cos(angleRad) - translatedY * Math.sin(angleRad);
    const unrotatedY = translatedX * Math.sin(angleRad) + translatedY * Math.cos(angleRad);

    return (
        Math.abs(unrotatedX) <= scaledWidth / 2 &&
        Math.abs(unrotatedY) <= scaledHeight / 2
    );
}
// --- PASTE THIS ENTIRE NEW FUNCTION ---

// --- PASTE THIS ENTIRE NEW FUNCTION ---

function handleDoubleClick(e) {
    const pos = getCanvasXY(e);
    if (!pos) return;

    // Find the top-most shape that was double-clicked
    for (let i = appState.drawings.length - 1; i >= 0; i--) {
        const drawing = appState.drawings[i];
        if (isPointInDrawing(pos, drawing)) {
            // Check if the drawing type has editable text
            if (drawing.type === 'text') {
                const newText = prompt('Edit text label:', drawing.text);
                if (newText !== null) { // Handle the "Cancel" button in the prompt
                    drawing.text = newText;
                    saveState(); // Save the change to history
                    redrawCanvas(); // Update the view immediately
                }
                return; // Stop after editing the first shape found
            } else if (drawing.type === 'gpsMarker') {
                const newTitle = prompt('Edit marker title:', drawing.title);
                if (newTitle !== null) {
                    drawing.title = newTitle;
                    saveState();
                    redrawCanvas();
                }
                return;
            }
        }
    }
}

// REPLACE THIS ENTIRE FUNCTION IN sketch.js

function handleMouseDown(e) {
    const pos = getCanvasXY(e);
    if (!pos) return;

    // --- THIS IS THE FIX ---
    // We re-ordered this function to check for shapes FIRST,
    // and the overlay image LAST.

    if (appState.currentTool === 'select') {
        const isShiftClick = e.shiftKey;

        // 1. Check for Handle Drag (Highest Priority)
        // If one shape is already selected, check if we clicked a handle.
        if (appState.selectedShapeIds.length === 1) {
            const selectedShape = appState.drawings.find(d => d.id === appState.selectedShapeIds[0]);
            if (selectedShape && selectedShape.path) { // Added check for path
                const screenPath = selectedShape.path.map(p => fromLatLngToCanvas(p));
                for (let i = 0; i < screenPath.length; i++) {
                    const handlePos = screenPath[i];
                    if (handlePos && Math.sqrt((pos.x - handlePos.x) ** 2 + (pos.y - handlePos.y) ** 2) < 8) {
                        appState.isDraggingHandle = true;
                        appState.draggedHandleInfo = { shapeId: selectedShape.id, handleIndex: i };
                        return; // Handle drag started, stop here.
                    }
                }
            }
        }

        // 2. Check for Shape Click/Drag (Second Priority)
        let shapeClicked = false;
        for (let i = appState.drawings.length - 1; i >= 0; i--) {
            const currentDrawing = appState.drawings[i];
            if (isPointInDrawing(pos, currentDrawing)) {
                shapeClicked = true;

                if (isShiftClick) {
                    const indexInSelection = appState.selectedShapeIds.indexOf(currentDrawing.id);
                    if (indexInSelection > -1) {
                        appState.selectedShapeIds.splice(indexInSelection, 1);
                    } else {
                        appState.selectedShapeIds.push(currentDrawing.id);
                    }
                } else {
                    if (!appState.selectedShapeIds.includes(currentDrawing.id)) {
                        appState.selectedShapeIds = [currentDrawing.id];
                    }
                }

                appState.isDraggingShape = true;
                appState.dragStartPos = pos;
                appState.dragStartShapePaths = {};
                appState.selectedShapeIds.forEach(id => {
                    const shape = appState.drawings.find(d => d.id === id);
                    if (shape) {
                        appState.dragStartShapePaths[id] = JSON.parse(JSON.stringify(shape.path));
                    }
                });
                appState.canvas.style.cursor = 'grabbing';

                updatePropertiesPanel();
                updateMeasurementList();
                return; // Shape click processed, stop here.
            }
        }

        // 3. Check for Overlay Drag (Third Priority)
        // Only if we didn't click a handle or a shape, check if we clicked the overlay.
        if (appState.overlayImage.img && isPointInImage(pos)) {
            const { overlayImage } = appState;
            overlayImage.isDragging = true;
            overlayImage.dragStartX = pos.x - overlayImage.x;
            overlayImage.dragStartY = pos.y - overlayImage.y;
            appState.canvas.style.cursor = 'grabbing';
            return; // Overlay drag started, stop here.
        }

        // 4. Clicked on Empty Space (Lowest Priority)
        if (!shapeClicked && !isShiftClick) {
            appState.selectedShapeIds = [];
        }

        updatePropertiesPanel();
        updateMeasurementList();
        return;
    }
    // --- END OF FIX ---


    // This part is for all other tools (Draw, Line, Text, etc.)
    appState.selectedShapeIds = [];
    updatePropertiesPanel();

    if (appState.currentTool === 'gpsMarker') {
        if (appState.isBaMapMode) {
            showAlert('Info', 'In this mode, you can only move existing photo markers. Use the Select tool.');
            setTool('select');
            return;
        }
        const latLng = fromCanvasToLatLng(pos);
        if (latLng) {
            const title = prompt('Enter marker title:', 'Marker');
            if (title === null) return;
            const newDrawing = {
                id: `marker_${Date.now()}`, type: 'gpsMarker', path: [latLng], originalPath: [latLng],
                title: title || "Marker", color: appState.strokeColor, opacity: appState.opacity,
                width: 5, scale: 1, rotation: 0, measurement: 0,
                measurementType: null, lineItemDescription: ''
            };
            appState.drawings.push(newDrawing);
            updateMeasurementList();
            saveState();
        }
    } else if (appState.currentTool === 'depthPoint') {
        const depth = prompt('Enter depth in inches:', '4');
        if (depth === null || isNaN(parseFloat(depth))) return;
        const latLng = fromCanvasToLatLng(pos);
        if (latLng) {
            const newDrawing = { id: `d_${Date.now()}`, type: 'depthPoint', path: [latLng], depth: parseFloat(depth), color: appState.strokeColor, lineItemDescription: '' };
            appState.drawings.push(newDrawing);
            updateMeasurementList();
            saveState();
        }
    } else if (appState.currentTool === 'text') {
        const text = prompt('Enter text for the label:');
        if (text) {
            const latLng = fromCanvasToLatLng(pos);
            if (latLng) {
                const newDrawing = { id: `d_${Date.now()}`, type: 'text', path: [latLng], text: text, color: appState.strokeColor, fontSize: 16 };
                appState.drawings.push(newDrawing);
                updateMeasurementList();
                saveState();
            }
        }
    } else if (appState.currentTool === 'polygon') {
        if (!appState.isDrawing) {
            appState.isDrawing = true;
            appState.currentPath = [pos];
        } else {
            const firstPoint = appState.currentPath[0];
            const distance = Math.sqrt((pos.x - firstPoint.x) ** 2 + (pos.y - firstPoint.y) ** 2);
            if (distance < 10 && appState.currentPath.length > 2) {
                finishPolygon();
            } else {
                appState.currentPath.push(pos);
            }
        }
    } else {
        appState.isDrawing = true;
        appState.startPos = pos;
        appState.currentPath = [pos];
    }
}

// --- THIS IS THE NEW CODE TO PASTE ---

function handleMouseMove(e) {
    const pos = getCanvasXY(e);
    if (!pos) return;

    if (appState.isDraggingShape) {
        if (appState.dragStartPos && appState.dragStartShapePaths) {
            const deltaX = pos.x - appState.dragStartPos.x;
            const deltaY = pos.y - appState.dragStartPos.y;

            // Correctly loop through all selected shapes to drag them together
            appState.selectedShapeIds.forEach(shapeId => {
                const shape = appState.drawings.find(d => d.id === shapeId);
                const startPath = appState.dragStartShapePaths[shapeId];
                if (shape && startPath) {
                    shape.path = startPath.map(latLng => {
                        const canvasPoint = fromLatLngToCanvas(latLng);
                        if (!canvasPoint) return latLng;
                        const newCanvasPoint = { x: canvasPoint.x + deltaX, y: canvasPoint.y + deltaY };
                        return fromCanvasToLatLng(newCanvasPoint) || latLng;
                    });
                }
            });
        }
        return;
    }

    if (appState.overlayImage.isDragging) {
        appState.overlayImage.x = pos.x - appState.overlayImage.dragStartX;
        appState.overlayImage.y = pos.y - appState.overlayImage.dragStartY;
        return;
    }

    if (appState.isDraggingHandle && appState.draggedHandleInfo) {
        const { shapeId, handleIndex } = appState.draggedHandleInfo;
        const shape = appState.drawings.find(d => d.id === shapeId);
        if (shape) {
            const newLatLng = fromCanvasToLatLng(pos);
            if (newLatLng) {
                shape.path[handleIndex] = newLatLng;
                if (shape.type === 'polygon' && handleIndex === 0) {
                    shape.path[shape.path.length - 1] = newLatLng;
                }
            }
        }
    } else if (appState.isDrawing && appState.currentTool !== 'polygon') {
        appState.currentPath.push(pos);
    }
}

function handleMouseUp(e) {
    if (appState.isDraggingShape) {
        appState.isDraggingShape = false;
        appState.dragStartPos = null;
        appState.dragStartShapePaths = null; // Changed from dragStartShapePath
        appState.canvas.style.cursor = 'default';

        // Finalize positions for ALL selected shapes
        appState.selectedShapeIds.forEach(id => {
            const shape = appState.drawings.find(d => d.id === id);
            if (shape) {
                shape.originalPath = JSON.parse(JSON.stringify(shape.path));
                shape.scale = 1;
                shape.rotation = 0;
                recalculateMeasurements(shape);
            }
        });
        updateMeasurementList();
        saveState();
    }

    if (appState.overlayImage.isDragging) {
        appState.overlayImage.isDragging = false;
        appState.canvas.style.cursor = 'default';
    }

    if (appState.isDraggingHandle) {
        const { shapeId } = appState.draggedHandleInfo;
        const shape = appState.drawings.find(d => d.id === shapeId);
        if (shape) {
            shape.originalPath = JSON.parse(JSON.stringify(shape.path));
            shape.scale = 1;
            shape.rotation = 0;
            recalculateMeasurements(shape);
            updateMeasurementList();
            saveState();
        }
        appState.isDraggingHandle = false;
        appState.draggedHandleInfo = null;
    }

    if (!appState.isDrawing || appState.currentTool === 'polygon' || appState.currentTool === 'text' || appState.currentTool === 'select') return;
    appState.isDrawing = false;

    const startLatLng = fromCanvasToLatLng(appState.startPos);
    const endLatLng = fromCanvasToLatLng(getCanvasXY(e));
    if (!startLatLng || !endLatLng) { appState.currentPath = []; return; }
    let drawingData = {
        id: `d_${Date.now()}`, type: appState.currentTool, color: appState.strokeColor,
        width: appState.strokeWidth, opacity: appState.opacity, scale: 1, rotation: 0,
        path: [], originalPath: [], measurement: 0, measurementType: 'length',
        service: 'none', price: 0, lineItemDescription: ''
    };
    const canvasPathForSaving = appState.currentPath.map(p => fromCanvasToLatLng(p)).filter(p => p !== null);
    switch (appState.currentTool) {
        case 'line':
            drawingData.path = [startLatLng, endLatLng];
            drawingData.measurement = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(startLatLng), new google.maps.LatLng(endLatLng)) * METER_TO_FEET;
            break;
        case 'freeDraw':
            drawingData.path = canvasPathForSaving;
            drawingData.measurement = google.maps.geometry.spherical.computeLength(drawingData.path.map(p => new google.maps.LatLng(p.lat, p.lng))) * METER_TO_FEET;
            break;
        case 'circle':
            const radiusInMeters = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(startLatLng), new google.maps.LatLng(endLatLng));
            drawingData.path = [startLatLng, endLatLng];
            drawingData.measurement = Math.PI * Math.pow(radiusInMeters, 2) * SQ_METER_TO_SQ_FEET;
            drawingData.measurementType = 'area';
            break;
    }
    if (drawingData.measurement > 0) {
        drawingData.originalPath = JSON.parse(JSON.stringify(drawingData.path));
        appState.drawings.push(drawingData);
        updateMeasurementList();
        saveState();
    }
    appState.currentPath = [];
}

function recalculateMeasurements(shape) {
    if (!shape || !shape.path) return;
    const googlePath = shape.path.map(p => new google.maps.LatLng(p.lat, p.lng));
    if (shape.measurementType === 'area') {
        if (shape.type === 'polygon') {
            shape.measurement = google.maps.geometry.spherical.computeArea(googlePath) * SQ_METER_TO_SQ_FEET;
        } else if (shape.type === 'circle') {
            const radiusInMeters = google.maps.geometry.spherical.computeDistanceBetween(googlePath[0], googlePath[1]);
            shape.measurement = Math.PI * radiusInMeters ** 2 * SQ_METER_TO_SQ_FEET;
        }
    } else if (shape.measurementType === 'length') {
        shape.measurement = google.maps.geometry.spherical.computeLength(googlePath) * METER_TO_FEET;
    }
}

function finishPolygon() {
    appState.currentPath.push(appState.currentPath[0]);
    const latLngPath = appState.currentPath.map(p => fromCanvasToLatLng(p)).filter(p => p !== null);
    if (latLngPath.length < 3) { appState.currentPath = []; appState.isDrawing = false; return; }
    let drawingData = {
        id: `d_${Date.now()}`,
        type: 'polygon',
        color: appState.strokeColor,
        width: appState.strokeWidth,
        opacity: appState.opacity,
        scale: 1,
        rotation: 0,
        path: latLngPath,
        originalPath: JSON.parse(JSON.stringify(latLngPath)),
        measurement: (google.maps.geometry.spherical.computeArea(latLngPath.map(p => new google.maps.LatLng(p.lat, p.lng))) || 0) * SQ_METER_TO_SQ_FEET,
        measurementType: 'area',
        service: 'none',
        price: 0,
        lineItemDescription: ''
    };
    appState.drawings.push(drawingData);
    updateMeasurementList();
    saveState();
    appState.isDrawing = false;
    appState.currentPath = [];
}

function transformShape(shape, shouldRecalculate = true) {
    if (!shape.originalPath) {
        shape.originalPath = JSON.parse(JSON.stringify(shape.path));
    }

    const scale = shape.scale || 1;
    const rotation = shape.rotation || 0;

    if (scale === 1 && rotation === 0) {
        shape.path = JSON.parse(JSON.stringify(shape.originalPath));
        if (shouldRecalculate) recalculateMeasurements(shape);
        return;
    }

    const bounds = new google.maps.LatLngBounds();
    shape.originalPath.forEach(p => bounds.extend(p));
    const centerLatLng = bounds.getCenter();
    const centerCanvas = fromLatLngToCanvas({ lat: centerLatLng.lat(), lng: centerLatLng.lng() });

    if (!centerCanvas) return;

    const angleRad = rotation * (Math.PI / 180);
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    shape.path = shape.originalPath.map(p_latlng => {
        const p_canvas = fromLatLngToCanvas(p_latlng);
        const translatedX = p_canvas.x - centerCanvas.x;
        const translatedY = p_canvas.y - centerCanvas.y;
        const scaledX = translatedX * scale;
        const scaledY = translatedY * scale;
        const rotatedX = scaledX * cosAngle - scaledY * sinAngle;
        const rotatedY = scaledX * sinAngle + scaledY * cosAngle;
        const finalX = rotatedX + centerCanvas.x;
        const finalY = rotatedY + centerCanvas.y;
        return fromCanvasToLatLng({ x: finalX, y: finalY });
    });

    if (shouldRecalculate) recalculateMeasurements(shape);
}


// --- REPLACE the old drawCentralLabel function WITH THIS ---

function drawDynamicCentralLabel(ctx, drawing) {
    if (!drawing.measurementType || drawing.path.length < 1 || !drawing.measurement) return;

    const bounds = new google.maps.LatLngBounds();
    drawing.path.forEach(p => bounds.extend(p));
    const centerLatLng = bounds.getCenter();
    const centerPoint = fromLatLngToCanvas({ lat: centerLatLng.lat(), lng: centerLatLng.lng() });

    if (!centerPoint) return;

    // Make font size dynamic based on map zoom
    const fontSize = Math.max(12, Math.min(32, 2 * (appState.map.getZoom() - 16)));
    const unit = drawing.measurementType === 'area' ? 'sq ft' : 'ft';
    const text = `${drawing.measurement.toFixed(1)} ${unit}`;

    ctx.save();
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(centerPoint.x - (textWidth / 2) - 8, centerPoint.y - (textHeight * 0.7), textWidth + 16, textHeight * 1.4);

    ctx.fillStyle = '#ffffff'; // White text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, centerPoint.x, centerPoint.y);
    ctx.restore();
}

// --- THIS IS THE NEW CODE TO PASTE ---

// --- THIS IS THE NEW CODE TO PASTE ---

// --- REPLACE THE ENTIRE redrawCanvas FUNCTION WITH THIS ---

function redrawCanvas() {
    if (!appState.mapProjectionOverlay || !appState.map.getBounds()) return;
    const ctx = appState.ctx;
    ctx.clearRect(0, 0, appState.canvas.width, appState.canvas.height);

    const { overlayImage } = appState;
    if (overlayImage.img) {
        ctx.save();
        ctx.globalAlpha = overlayImage.opacity;

        const scaledWidth = overlayImage.width * overlayImage.scale;
        const scaledHeight = overlayImage.height * overlayImage.scale;
        const centerX = overlayImage.x + scaledWidth / 2;
        const centerY = overlayImage.y + scaledHeight / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate(overlayImage.rotation * Math.PI / 180);
        ctx.translate(-centerX, -centerY);

        ctx.drawImage(
            overlayImage.img,
            overlayImage.x,
            overlayImage.y,
            scaledWidth,
            scaledHeight
        );
        ctx.restore();
    }

    appState.drawings.forEach(drawing => {
        // This check prevents errors if a drawing has a bad path
        if (!drawing.path || drawing.path.some(p => p === null || p === undefined)) {
            return;
        }

        const screenPath = drawing.path.map(latLng => fromLatLngToCanvas(latLng));
        if (screenPath.some(p => p === null)) return; // Don't draw if any point is off-screen

        const isSelected = appState.selectedShapeIds.includes(drawing.id);

        if (drawing.type === 'gpsMarker' && screenPath.length > 0 && screenPath[0]) {
            const point = screenPath[0];
            ctx.save();
            ctx.fillStyle = drawing.color;
            ctx.globalAlpha = drawing.opacity;

            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.arc(point.x, point.y - 15, 10, Math.PI * 0.75, Math.PI * 0.25, true);
            ctx.closePath();
            ctx.fill();

            if (isSelected) {
                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            if (drawing.title) {
                // Dynamic font size for marker title
                const fontSize = Math.max(12, Math.min(24, 1.2 * (appState.map.getZoom() - 15)));
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 3;
                ctx.textAlign = 'center';
                const titleYOffset = 15 + fontSize * 0.8;
                ctx.strokeText(drawing.title, point.x, point.y + titleYOffset);
                ctx.fillText(drawing.title, point.x, point.y + titleYOffset);
            }

            ctx.restore();
        } else if (drawing.type === 'text' && screenPath.length > 0 && screenPath[0]) {
            const point = screenPath[0];
            ctx.save();
            ctx.font = `bold ${drawing.fontSize || 16}px sans-serif`;
            const textMetrics = ctx.measureText(drawing.text);
            const textWidth = textMetrics.width;
            const textHeight = drawing.fontSize || 16;

            ctx.fillStyle = isSelected ? 'rgba(0, 100, 255, 0.75)' : 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(point.x - (textWidth / 2) - 8, point.y - (textHeight * 0.7), textWidth + 16, textHeight * 1.4);

            ctx.fillStyle = drawing.color || '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(drawing.text, point.x, point.y);
            ctx.restore();

        } else if (drawing.type === 'depthPoint' && screenPath.length > 0 && screenPath[0]) {
            const point = screenPath[0];
            const text = `${drawing.depth}"`;
            ctx.save();
            ctx.fillStyle = drawing.color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
            ctx.fill();
            if (isSelected) {
                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = 4;
                ctx.stroke();
            }
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            const fontSize = Math.max(10, Math.min(18, 1 * (appState.map.getZoom() - 16)));
            ctx.font = `bold ${fontSize}px sans-serif`;
            const textMetrics = ctx.measureText(text);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(point.x + 15, point.y - 15 - (fontSize / 2), textMetrics.width + 8, fontSize + 8);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, point.x + 19, point.y - 11);
            ctx.restore();

        } else if (drawing.type) { // Covers polygon, line, circle, freeDraw
            ctx.strokeStyle = drawing.color;
            ctx.lineWidth = drawing.width;
            ctx.globalAlpha = drawing.opacity;
            ctx.beginPath();

            if (drawing.type === 'circle') {
                const center = screenPath[0];
                const edge = screenPath[1];
                const radius = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2));
                ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
            } else {
                ctx.moveTo(screenPath[0].x, screenPath[0].y);
                for (let i = 1; i < screenPath.length; i++) {
                    ctx.lineTo(screenPath[i].x, screenPath[i].y);
                }
            }
            ctx.stroke();

            if (isSelected) {
                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = drawing.width + 4;
                ctx.setLineDash([10, 10]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (drawing.type === 'polygon' || drawing.type === 'circle') {
                ctx.fillStyle = drawing.color;
                ctx.globalAlpha = drawing.opacity * 0.3;
                ctx.fill();
            }

            if (isSelected && appState.selectedShapeIds.length === 1) {
                ctx.save();
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                screenPath.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                });
                ctx.restore();
            }

            // Call the new, improved central label function
            drawDynamicCentralLabel(ctx, drawing);
        }
    });

    // ... (rest of the function remains the same, drawing the current path)
    if (appState.isDrawing && appState.currentPath.length > 0) {
        ctx.strokeStyle = appState.strokeColor;
        ctx.lineWidth = appState.strokeWidth;
        ctx.globalAlpha = appState.opacity;
        ctx.beginPath();
        ctx.moveTo(appState.currentPath[0].x, appState.currentPath[0].y);
        for (let i = 1; i < appState.currentPath.length; i++) {
            if (appState.currentPath[i]) ctx.lineTo(appState.currentPath[i].x, appState.currentPath[i].y);
        }
        if (appState.currentTool === 'polygon') {
            const mousePos = getCanvasXY(lastMouseMoveEvent);
            if (mousePos) ctx.lineTo(mousePos.x, mousePos.y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
}

let lastMouseMoveEvent = { clientX: 0, clientY: 0 };
document.addEventListener('mousemove', e => lastMouseMoveEvent = e, { passive: true });
document.addEventListener('touchmove', e => { if (e.touches[0]) lastMouseMoveEvent = e.touches[0]; }, { passive: true });

function undo() {
    if (appState.historyIndex > 0) {
        appState.historyIndex--;
        applyState(appState.historyIndex);
    }
}

function redo() {
    if (appState.historyIndex < appState.historyStack.length - 1) {
        appState.historyIndex++;
        applyState(appState.historyIndex);
    }
}

function clearAll() {
    showConfirmation('Clear Canvas', 'Are you sure you want to clear all drawings and measurements? This cannot be undone.', () => {
        appState.drawings = [];
        updateMeasurementList();
        saveState();
    });
}
// --- PASTE THIS ENTIRE NEW FUNCTION ---

function applyPropertyToSelectedShapes(property, value, requiresTransform = false) {
    if (appState.selectedShapeIds.length > 0) {
        appState.selectedShapeIds.forEach(shapeId => {
            const shape = appState.drawings.find(d => d.id === shapeId);
            if (shape) {
                if (property === 'fontSize' && shape.type !== 'text') return;
                if (property === 'width' && (shape.type === 'text' || shape.type === 'gpsMarker' || shape.type === 'depthPoint')) return;
                if ((property === 'scale' || property === 'rotation') && !shape.hasOwnProperty('scale')) return;

                shape[property] = value;

                // **THIS IS THE FIX**: Redraw shapes that were scaled or rotated
                if (requiresTransform) {
                    transformShape(shape);
                }
            }
        });
        saveState();
        updateMeasurementList();
        redrawCanvas();
    }
}

async function saveBaMarkerUpdates() {
    if (!appState.isBaMapMode || !appState.estimateId) return;

    const saveButton = document.getElementById('save-btn');
    saveButton.disabled = true;
    saveButton.innerHTML = 'Updating Locations...';

    const { doc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js");

    try {
        if (!window.db) throw new Error("Firebase database not initialized.");

        const estimateRef = doc(window.db, 'estimates', appState.estimateId);
        const docSnap = await getDoc(estimateRef);

        if (!docSnap.exists()) {
            throw new Error("Estimate not found.");
        }

        const estimateData = docSnap.data();
        const updatedBeforeAndAfter = (estimateData.beforeAndAfter || []).map(pair => {

            const updatePhotos = (photos, type) => {
                return (photos || []).map((photo, index) => {
                    const markerId = `${pair.id}_${type}_${index}`;
                    const drawing = appState.drawings.find(d => d.id === markerId);

                    if (drawing && drawing.path && drawing.path.length > 0) {
                        photo.location = {
                            lat: drawing.path[0].lat,
                            lng: drawing.path[0].lng
                        };
                    }
                    return photo;
                });
            };

            pair.beforePhotos = updatePhotos(pair.beforePhotos, 'before');
            pair.afterPhotos = updatePhotos(pair.afterPhotos, 'after');
            return pair;
        });

        await updateDoc(estimateRef, {
            beforeAndAfter: updatedBeforeAndAfter,
            lastSaved: new Date().toISOString()
        });

        showAlert('Success', 'Photo locations updated successfully!', () => {
            window.location.href = `estimator.html`;
        });

    } catch (error) {
        console.error("Error updating BA marker locations:", error);
        showAlert('Error', `Failed to update locations: ${error.message}`);
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = 'Save Location Updates';
    }
}

// REPLACE THIS ENTIRE FUNCTION IN sketch.js

async function saveSketch() {
    const { doc, collection, setDoc, updateDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js");
    const { ref, uploadString, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js");

    const saveButton = document.getElementById('save-btn');
    saveButton.disabled = true;
    saveButton.innerHTML = 'Saving...';
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.visibility = 'hidden';

    const addressInputValue = document.getElementById('pac-input').value;
    const finalAddress = addressInputValue.trim() !== '' ? addressInputValue : appState.initialAddress;

    if (!appState.estimateId) {
        const newEstimateRef = doc(collection(window.db, 'estimates'));
        appState.estimateId = newEstimateRef.id;
        await setDoc(newEstimateRef, {
            customerInfo: { name: document.getElementById('client-name').value || 'New Sketch Lead', address: finalAddress || '' },
            status: 'Draft',
            tags: ["New Leads"],
            createdAt: new Date().toISOString(),
            lastSaved: new Date().toISOString()
        });
    }

    try {
        const dpr = window.devicePixelRatio || 1;
        appState.map.setTilt(0);
        await new Promise(resolve => setTimeout(resolve, 300));

        const mapCanvas = await html2canvas(document.getElementById('map-wrapper'), { useCORS: true, scale: dpr });
        const screenshotDataUrl = mapCanvas.toDataURL('image/jpeg', 0.9);

        const sketchId = appState.sketchId || `sketch_${Date.now()}`;

        const screenshotRef = ref(window.storage, `estimates/${appState.estimateId}/screenshot_${sketchId}.jpg`);
        await uploadString(screenshotRef, screenshotDataUrl, 'data_url');
        const screenshotDownloadUrl = await getDownloadURL(screenshotRef);

        // --- NEW: Handle Overlay Image Upload (THE FIX) ---
        let overlayImageUrl = null;
        if (appState.overlayImage.src) {
            if (appState.overlayImage.src.startsWith('data:image')) {
                // This is a new or changed image (dataURL), upload it
                try {
                    const overlayRef = ref(window.storage, `estimates/${appState.estimateId}/overlay_${sketchId}.png`);
                    const uploadTask = await uploadString(overlayRef, appState.overlayImage.src, 'data_url');
                    overlayImageUrl = await getDownloadURL(uploadTask.ref);
                } catch (uploadError) {
                    console.error("Error uploading overlay image:", uploadError);
                    overlayImageUrl = null; // Fail gracefully
                }
            } else if (appState.overlayImage.src.startsWith('http')) {
                // This is an existing image from storage, just re-save its URL
                overlayImageUrl = appState.overlayImage.src;
            }
        }
        // --- END NEW OVERLAY LOGIC ---

        // --- NEW SKETCH DATA CLEANING (V9) ---

        // Capture Active Calculator State
        let activeCalcMode = null;
        let activeCalcConfig = null;
        if (appState.calculatorManager) {
            activeCalcMode = appState.calculatorManager.mode;
            if (activeCalcMode === 'custom') {
                activeCalcConfig = appState.calculatorManager.config;
            }
        }

        const sketchData = {
            id: sketchId,
            calculatorMode: activeCalcMode,
            calculatorConfig: activeCalcConfig,
            title: document.getElementById('sketch-title').value.trim() || finalAddress,
            screenshotUrl: screenshotDownloadUrl,
            clientName: document.getElementById('client-name').value,
            clientAddress: finalAddress,
            siteNotes: document.getElementById('site-notes').value,

            overlayImage: {
                src: overlayImageUrl, // <-- Save the Storage URL, not the dataURL
                x: isFinite(appState.overlayImage.x) ? (appState.overlayImage.x || 0) : 0,
                y: isFinite(appState.overlayImage.y) ? (appState.overlayImage.y || 0) : 0,
                scale: isFinite(appState.overlayImage.scale) ? (appState.overlayImage.scale || 1) : 1,
                rotation: isFinite(appState.overlayImage.rotation) ? (appState.overlayImage.rotation || 0) : 0,
                opacity: isFinite(appState.overlayImage.opacity) ? (appState.overlayImage.opacity || 0.7) : 0.7,
                width: isFinite(appState.overlayImage.width) ? (appState.overlayImage.width || 0) : 0,
                height: isFinite(appState.overlayImage.height) ? (appState.overlayImage.height || 0) : 0
            },

            measurements: appState.drawings.filter(Boolean).map(d => {
                const isVolumeItem = pricingOptions.find(opt => opt.id === d.service)?.type === 'volume';
                let finalMeasurement = isVolumeItem ? d.volume : d.measurement;

                let validPathLats = [];
                let validPathLngs = [];
                if (Array.isArray(d.path)) {
                    d.path.forEach(p => {
                        if (p && p.lat != null && isFinite(p.lat) && p.lng != null && isFinite(p.lng)) {
                            validPathLats.push(p.lat);
                            validPathLngs.push(p.lng);
                        }
                    });
                }

                return {
                    id: d.id || `d_${Date.now()}`,
                    type: d.type || 'line',
                    measurement: isFinite(finalMeasurement) ? (finalMeasurement || 0) : 0,
                    measurementType: isVolumeItem ? 'volume' : (d.measurementType || null),
                    service: d.service || 'none',
                    price: isFinite(d.price) ? (d.price || 0) : 0,
                    lineItemDescription: d.lineItemDescription || '',
                    pathLats: validPathLats,
                    pathLngs: validPathLngs,
                    color: d.color || '#ff0000',
                    width: isFinite(d.width) ? (d.width || 5) : 5,
                    opacity: isFinite(d.opacity) ? (d.opacity || 1) : 1,
                    scale: isFinite(d.scale) ? (d.scale || 1) : 1,
                    rotation: isFinite(d.rotation) ? (d.rotation || 0) : 0,
                    depth: isFinite(d.depth) ? (d.depth || null) : null,
                    volume: isFinite(d.volume) ? (d.volume || null) : null,
                    text: d.text || null,
                    fontSize: isFinite(d.fontSize) ? (d.fontSize || 16) : 16,
                    title: d.title || null
                };
            }),

            subtotal: 0,
            gst: 0,
            totalEstimate: 0,
            createdAt: new Date().toISOString()
        };

        const parsedSubtotal = parseFloat(document.getElementById('total-subtotal').textContent.replace(/[$,]/g, ''));
        const parsedGst = parseFloat(document.getElementById('total-gst').textContent.replace(/[$,]/g, ''));
        const parsedTotal = parseFloat(document.getElementById('total-estimate').textContent.replace(/[$,]/g, ''));

        sketchData.subtotal = isFinite(parsedSubtotal) ? parsedSubtotal : 0;
        sketchData.gst = isFinite(parsedGst) ? parsedGst : 0;
        sketchData.totalEstimate = isFinite(parsedTotal) ? parsedTotal : 0;
        // --- END NEW SKETCH DATA CLEANING (V9) ---


        const estimateRef = doc(db, 'estimates', appState.estimateId);
        const docSnap = await getDoc(estimateRef);
        let existingSketches = [];

        if (docSnap.exists() && docSnap.data().sketches) {
            // --- CLEANING LOGIC FOR OLD SKETCHES (V9) ---
            const cleanSketches = [];
            const sketchesFromDB = docSnap.data().sketches;

            for (const oldSketch of sketchesFromDB) {
                if (!oldSketch || !oldSketch.id) {
                    continue;
                }

                const cleanMeasurements = [];
                if (oldSketch.measurements && Array.isArray(oldSketch.measurements)) {
                    oldSketch.measurements.filter(Boolean).forEach(d => {
                        if (!d) return;

                        let validPathLats = [];
                        let validPathLngs = [];
                        if (Array.isArray(d.pathLats) && Array.isArray(d.pathLngs) && d.pathLats.length === d.pathLngs.length) {
                            for (let i = 0; i < d.pathLats.length; i++) {
                                const lat = d.pathLats[i];
                                const lng = d.pathLngs[i];
                                if (lat != null && isFinite(lat) && lng != null && isFinite(lng)) {
                                    validPathLats.push(lat);
                                    validPathLngs.push(lng);
                                }
                            }
                        }

                        cleanMeasurements.push({
                            id: d.id || `d_${Date.now()}`,
                            type: d.type || 'line',
                            measurement: isFinite(d.measurement) ? (d.measurement || 0) : 0,
                            measurementType: d.measurementType || null,
                            service: d.service || 'none',
                            price: isFinite(d.price) ? (d.price || 0) : 0,
                            lineItemDescription: d.lineItemDescription || '',
                            pathLats: validPathLats,
                            pathLngs: validPathLngs,
                            color: d.color || '#ff0000',
                            width: isFinite(d.width) ? (d.width || 5) : 5,
                            opacity: isFinite(d.opacity) ? (d.opacity || 1) : 1,
                            scale: isFinite(d.scale) ? (d.scale || 1) : 1,
                            rotation: isFinite(d.rotation) ? (d.rotation || 0) : 0,
                            depth: isFinite(d.depth) ? (d.depth || null) : null,
                            volume: isFinite(d.volume) ? (d.volume || null) : null,
                            text: d.text || null,
                            fontSize: isFinite(d.fontSize) ? (d.fontSize || 16) : 16,
                            title: d.title || null
                        });
                    });
                }

                const oldOverlay = oldSketch.overlayImage || {};
                const cleanOverlay = {
                    src: oldOverlay.src || null, // Pass along existing URLs
                    x: isFinite(oldOverlay.x) ? (oldOverlay.x || 0) : 0,
                    y: isFinite(oldOverlay.y) ? (oldOverlay.y || 0) : 0,
                    scale: isFinite(oldOverlay.scale) ? (oldOverlay.scale || 1) : 1,
                    rotation: isFinite(oldOverlay.rotation) ? (oldOverlay.rotation || 0) : 0,
                    opacity: isFinite(oldOverlay.opacity) ? (oldOverlay.opacity || 0.7) : 0.7,
                    width: isFinite(oldOverlay.width) ? (oldOverlay.width || 0) : 0,
                    height: isFinite(oldOverlay.height) ? (oldOverlay.height || 0) : 0
                };

                const cleanSketch = {
                    id: oldSketch.id,
                    title: oldSketch.title || '',
                    screenshotUrl: oldSketch.screenshotUrl || null,
                    clientName: oldSketch.clientName || '',
                    clientAddress: oldSketch.clientAddress || '',
                    siteNotes: oldSketch.siteNotes || '',
                    overlayImage: cleanOverlay,
                    measurements: cleanMeasurements,
                    subtotal: isFinite(oldSketch.subtotal) ? (oldSketch.subtotal || 0) : 0,
                    gst: isFinite(oldSketch.gst) ? (oldSketch.gst || 0) : 0,
                    totalEstimate: isFinite(oldSketch.totalEstimate) ? (oldSketch.totalEstimate || 0) : 0,
                    createdAt: oldSketch.createdAt || new Date().toISOString()
                };

                cleanSketches.push(cleanSketch);
            }

            existingSketches = cleanSketches;
            // --- END CLEANING LOGIC (V9) ---
        }

        const sketchIndex = existingSketches.findIndex(s => s.id === sketchId);

        if (sketchIndex > -1) {
            existingSketches[sketchIndex] = sketchData;
        } else {
            existingSketches.push(sketchData);
        }

        await updateDoc(estimateRef, {
            sketches: existingSketches,
            'customerInfo.name': sketchData.clientName,
            'customerInfo.address': sketchData.clientAddress,
            lastSaved: new Date().toISOString()
        });

        // --- NEW: UNIFIED DATA BRIDGE EXECUTION ---
        try {
            console.log("Triggering Pricing Bridge...");
            // Shim the firebase services for the bridge
            window.firebaseServices = {
                updateDoc: updateDoc
            };

            const bridge = new PricingBridge();
            await bridge.execute(appState, estimateRef);
            console.log("Pricing Bridge synchronization complete.");
        } catch (bridgeError) {
            console.warn("Pricing Bridge encountered a non-fatal error:", bridgeError);
        }
        // ------------------------------------------

        showAlert('Success', 'Sketch saved successfully!', () => {
            window.location.href = `estimator.html?view=editor&estimateId=${appState.estimateId}&section=sketches`;
        });

    } catch (error) {
        console.error("Error saving sketch: ", error);
        showAlert('Error', `Failed to save sketch: ${error.message}`);
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = 'Save';
        if (topBar) topBar.style.visibility = 'visible';
    }
}

async function downloadAsImage() {
    const downloadBtn = document.getElementById('print-btn');
    const originalContent = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = 'Generating...';

    try {
        const dpr = window.devicePixelRatio || 1;
        appState.map.setTilt(0);
        await new Promise(resolve => setTimeout(resolve, 250));
        const mapCanvas = await html2canvas(document.getElementById('map-wrapper'), { useCORS: true, allowTaint: true, scale: dpr });
        const mapImageDataUrl = mapCanvas.toDataURL('image/png');

        // --- THIS OBJECT IS NOW CORRECTED ---
        const tempEstimateData = {
            id: appState.estimateId || 'NEW',
            lastSaved: new Date().toISOString(),
            customerInfo: {
                name: document.getElementById('client-name').value,
                address: document.getElementById('pac-input').value,
            },
            sketches: [{
                screenshotUrl: mapImageDataUrl,
            }],
            // Correctly formatted scopeOfWork object
            scopeOfWork: {
                manual: document.getElementById('site-notes').value,
                auto: ''
            },
            // Added missing properties so they don't cause errors or omissions
            pricing: { dynamicOptions: [], selectedOptions: [] },
            acceptance: {},
            terms: 'Default terms and conditions can be added here if needed for sketch downloads.',
            appendixContent: '',
            tentativeStartDate: '',
            tentativeEndDate: '',
            contactHistory: {},
            financialSummary: {},
        };

        const printableHtml = generatePrintableEstimateHTML(tempEstimateData);

        const tempPrintLayout = document.createElement('div');
        tempPrintLayout.id = 'temp-print-layout';
        tempPrintLayout.className = 'p-8 max-w-4xl bg-white';
        tempPrintLayout.style.cssText = 'position: absolute; left: -9999px; width: 1024px;';
        tempPrintLayout.innerHTML = printableHtml;
        document.body.appendChild(tempPrintLayout);

        const finalCanvas = await html2canvas(tempPrintLayout, { useCORS: true, scale: dpr });
        const link = document.createElement('a');
        link.href = finalCanvas.toDataURL('image/png');
        link.download = `city-pave-estimate-${Date.now()}.png`;
        link.click();

        document.body.removeChild(tempPrintLayout);

    } catch (error) {
        console.error("Error generating image for download:", error);
        showAlert('Download Error', 'Could not generate the image.');
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalContent;
    }
}


// --- PASTE THIS ENTIRE BLOCK (TWO FUNCTIONS) ---

function updateMeasurementList() {
    // REMOVED the check that blocked this from running in BA Map Mode
    const listContainer = document.getElementById('measurement-list');
    const oldScrollTop = listContainer.scrollTop;
    listContainer.innerHTML = '';
    if (appState.drawings.length === 0) {
        listContainer.innerHTML = `<p class="text-gray-500 text-sm p-2">Draw on the map to add measurements.</p>`;
    } else {
        appState.drawings.forEach(drawing => addMeasurementToList(drawing));
    }
    listContainer.scrollTop = oldScrollTop;
    updateTotalEstimate();
}

// --- THIS IS THE NEW, COMPLETE CODE TO PASTE ---

// --- THIS IS THE NEW, COMPLETE CODE TO PASTE ---

// --- THIS IS THE NEW, COMPLETE CODE TO PASTE ---

// --- THIS IS THE NEW, COMPLETE CODE TO PASTE ---

// --- THIS IS THE NEW, COMPLETE CODE TO PASTE ---

// This is the new, complete addMeasurementToList function
function addMeasurementToList(drawing) {
    const listContainer = document.getElementById('measurement-list');
    const isSelected = appState.selectedShapeIds.includes(drawing.id);

    const item = document.createElement('div');
    // Added border-l-4 and dynamic border color style
    item.className = `measurement-item p-2 border-b border-l-4 bg-white hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`;
    item.style.borderLeftColor = drawing.color || '#ccc';
    item.dataset.id = drawing.id;
    item.setAttribute('draggable', 'true');

    if (appState.isBaMapMode) {
        if (drawing.type === 'gpsMarker') {
            item.innerHTML = `
                <div class="grid grid-cols-12 gap-2 items-center">
                    <div class="col-span-1 text-orange-500">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 21l-4.95-6.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path></svg>
                    </div>
                    <div class="col-span-11">
                        <span class="font-semibold text-sm">${drawing.title || 'Marker'}</span>
                        <p class="text-xs text-gray-500">Lat: ${drawing.path[0].lat.toFixed(4)}, Lng: ${drawing.path[0].lng.toFixed(4)}</p>
                    </div>
                </div>`;
            listContainer.appendChild(item);
        }
        return;
    }

    // Unified Buttons HTML (Pencil now triggers selection)
    const buttonsHtml = `
        <div class="flex-shrink-0 pt-2 text-gray-400 cursor-grab drag-handle"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 8a1 1 0 11-2 0 1 1 0 012 0zM7 9a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 10-2 0 1 1 0 002 0zM13 9a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 10-2 0 1 1 0 002 0zM7 13a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 10-2 0 1 1 0 002 0zM13 13a1 1 0 100-2 1 1 0 000 2z"></path></svg></div>
        <button title="Duplicate" class="duplicate-btn p-1 text-gray-500 hover:text-blue-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
        <button title="Edit Style" class="edit-style-btn p-1 text-gray-500 hover:text-indigo-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg></button>
        <button title="Delete" class="delete-btn p-1 text-red-500 hover:text-red-700 text-xl font-bold leading-none">×</button>
    `;

    let contentHtml = '';

    if (drawing.type === 'depthPoint') {
        contentHtml = `<div class="flex items-start justify-between w-full"><div class="flex items-center gap-2">${buttonsHtml}<span class="font-semibold text-sm">Depth: ${drawing.depth}"</span></div><textarea class="line-item-description table-input text-xs w-1/2" rows="1" placeholder="Add a note...">${drawing.lineItemDescription || ''}</textarea></div>`;
    } else if (drawing.type === 'text' || drawing.type === 'gpsMarker') {
        const label = drawing.type === 'text' ? 'Text' : 'Marker';
        const value = drawing.type === 'text' ? drawing.text : drawing.title;
        contentHtml = `<div class="flex items-start justify-between w-full"><div class="flex items-center gap-2">${buttonsHtml}<span class="font-semibold text-sm truncate">${label}: "${value}"</span></div></div>`;
    } else {
        const unit = drawing.measurementType === 'area' ? 'sq ft' : 'ft';
        contentHtml = `<div class="grid grid-cols-12 gap-2 w-full"><div class="col-span-12 flex justify-between items-start"><div class="flex items-center gap-1">${buttonsHtml}<input type="number" step="0.01" value="${(drawing.measurement || 0).toFixed(2)}" class="measurement-input table-input text-sm w-20 font-semibold"><span class="unit-label text-sm">${unit}</span></div><div class="text-right font-bold text-lg total-display">$0.00</div></div><div class="col-span-12 service-selection-container grid grid-cols-7 gap-2"></div><div class="col-span-12"><textarea class="line-item-description table-input text-xs" rows="2" placeholder="Add a service description or note...">${drawing.lineItemDescription || ''}</textarea></div><div class="col-span-12 text-xs text-gray-500 service-description"></div></div>`;
    }

    item.innerHTML = contentHtml; // Removed styleEditorHtml injection
    listContainer.appendChild(item);

    // Drag Events
    item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', drawing.id); e.currentTarget.classList.add('opacity-50'); });
    item.addEventListener('dragend', (e) => { e.currentTarget.classList.remove('opacity-50'); });
    item.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('border-t-2', 'border-blue-500'); });
    item.addEventListener('dragleave', (e) => { e.currentTarget.classList.remove('border-t-2', 'border-blue-500'); });
    item.addEventListener('drop', (e) => {
        e.preventDefault(); e.currentTarget.classList.remove('border-t-2', 'border-blue-500');
        const droppedId = e.dataTransfer.getData('text/plain');
        const draggedIndex = appState.drawings.findIndex(d => d.id === droppedId);
        const targetIndex = appState.drawings.findIndex(d => d.id === drawing.id);
        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [draggedItem] = appState.drawings.splice(draggedIndex, 1);
            appState.drawings.splice(targetIndex, 0, draggedItem);
            saveState(); updateMeasurementList();
        }
    });

    const drawingData = appState.drawings.find(d => d.id === drawing.id);
    if (!drawingData) return;

    // Button Listeners
    item.querySelector('.delete-btn').addEventListener('click', () => {
        appState.selectedShapeIds = appState.selectedShapeIds.filter(id => id !== drawing.id);
        appState.drawings = appState.drawings.filter(d => d.id !== drawing.id);
        updateMeasurementList();
        saveState();
    });

    item.querySelector('.duplicate-btn').addEventListener('click', () => duplicateDrawing(drawing.id));

    // *** THIS IS THE FIX FOR THE PENCIL BUTTON ***
    item.querySelector('.edit-style-btn').addEventListener('click', (e) => {
        // Select the shape
        appState.selectedShapeIds = [drawing.id];
        // Update UI to show selection and OPEN FLOATING PANEL
        updateMeasurementList();
        updatePropertiesPanel();
        redrawCanvas();
    });

    // Service Selection Logic (Pricing)
    if (item.querySelector('.service-selection-container')) {
        const serviceContainer = item.querySelector('.service-selection-container');
        serviceContainer.innerHTML = `<select class="service-select table-input text-xs col-span-4"></select><input type="number" step="0.01" class="price-input table-input text-xs col-span-3" value="0.00">`;
        const select = item.querySelector('.service-select');
        const priceInput = item.querySelector('.price-input');

        pricingOptions.filter(opt => !opt.isArchived).forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.id;
            option.textContent = opt.name;
            if (opt.type !== 'none' && opt.type !== drawing.measurementType && opt.type !== 'volume') {
                option.disabled = true;
            }
            select.appendChild(option);
        });

        select.value = drawingData.service || 'none';
        priceInput.value = (drawingData.price || 0).toFixed(2);
        item.querySelector('.line-item-description').addEventListener('input', (e) => { drawingData.lineItemDescription = e.target.value; debouncedSaveState(); });

        const updateItem = () => {
            // ... (Same variant logic as before, keeping it concise here)
            const selectedOption = pricingOptions.find(opt => opt.id === select.value);
            item.querySelector('.service-description').textContent = selectedOption ? selectedOption.description : '';
            updateLineItemTotal(item, drawingData);
            updateTotalEstimate();
        };

        select.addEventListener('change', e => {
            const selectedOption = pricingOptions.find(opt => opt.id === e.target.value);
            if (selectedOption && !selectedOption.variants && !selectedOption.calculation) {
                priceInput.value = selectedOption.defaultPrice.toFixed(2);
            }
            drawingData.service = e.target.value;
            drawingData.price = parseFloat(priceInput.value);
            updateItem();
            saveState();
        });

        priceInput.addEventListener('input', e => {
            drawingData.price = parseFloat(e.target.value) || 0;
            updateItem();
            debouncedSaveState();
        });

        updateItem();
    }
}



function resizeShapeToMeasurement(shape, newMeasurement) {
    const originalMeasurement = shape.measurement;
    if (originalMeasurement <= 0 || newMeasurement <= 0) return;

    if (shape.measurementType === 'length') {
        const p1 = shape.path[0];
        const p2 = shape.path[1];
        const bearing = google.maps.geometry.spherical.computeHeading(new google.maps.LatLng(p1), new google.maps.LatLng(p2));
        const newP2 = google.maps.geometry.spherical.computeOffset(new google.maps.LatLng(p1), newMeasurement / METER_TO_FEET, bearing);
        shape.path[1] = { lat: newP2.lat(), lng: newP2.lng() };
    } else if (shape.measurementType === 'area') {
        const scaleFactor = Math.sqrt(newMeasurement / originalMeasurement);
        const bounds = new google.maps.LatLngBounds();
        shape.path.forEach(p => bounds.extend(p));
        const center = bounds.getCenter();

        const newPath = shape.path.map(p => {
            const heading = google.maps.geometry.spherical.computeHeading(center, new google.maps.LatLng(p));
            const distance = google.maps.geometry.spherical.computeDistanceBetween(center, new google.maps.LatLng(p));
            const newPoint = google.maps.geometry.spherical.computeOffset(center, distance * scaleFactor, heading);
            return { lat: newPoint.lat(), lng: newPoint.lng() };
        });
        shape.path = newPath;
    }

    shape.originalPath = JSON.parse(JSON.stringify(shape.path));
    shape.scale = 1;
    shape.rotation = 0;

    recalculateMeasurements(shape);
    updateMeasurementList();
    saveState();
}


function updateLineItemTotal(itemElement, drawingData) {
    if (!drawingData) return;
    const priceInput = itemElement.querySelector('.price-input');
    if (!priceInput) return;
    const price = parseFloat(priceInput.value) || 0;
    const units = drawingData.unitsForTotal || drawingData.measurement || 0;
    const total = units * price;
    itemElement.querySelector('.total-display').textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function updateTotalEstimate() {
    let subtotal = 0;
    appState.drawings.forEach(drawing => {
        if (drawing.type !== 'depthPoint' && drawing.type !== 'text' && drawing.type !== 'gpsMarker') {
            const units = drawing.unitsForTotal || drawing.measurement || 0;
            subtotal += units * (drawing.price || 0);
        }
    });

    const gstAmount = subtotal * GST_RATE;
    const total = subtotal + gstAmount;
    document.getElementById('total-subtotal').textContent = `$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-gst').textContent = `$${gstAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-estimate').textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function duplicateDrawing(drawingId) {
    const original = appState.drawings.find(d => d.id === drawingId);
    if (!original) return;

    const newDrawing = JSON.parse(JSON.stringify(original));

    newDrawing.id = `d_${Date.now()}`;
    newDrawing.color = '#0000ff';

    const originalIndex = appState.drawings.findIndex(d => d.id === drawingId);
    appState.drawings.splice(originalIndex + 1, 0, newDrawing);

    updateMeasurementList();
    saveState();
}

function showModal(title, text, buttons) {
    const modal = document.getElementById('sketch-modal');
    document.getElementById('sketch-modal-title').textContent = title;
    document.getElementById('sketch-modal-text').textContent = text;
    const buttonsContainer = document.getElementById('sketch-modal-buttons');
    buttonsContainer.innerHTML = '';
    buttons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.textContent = btnInfo.text;
        button.className = `px-4 py-2 rounded-md font-semibold text-white ${btnInfo.class}`;
        button.onclick = () => { hideModal(); if (btnInfo.callback) btnInfo.callback(); };
        buttonsContainer.appendChild(button);
    });
    modal.classList.remove('hidden');
}

function hideModal() { document.getElementById('sketch-modal').classList.add('hidden'); }
function showAlert(title, text, callback) { showModal(title, text, [{ text: 'OK', class: 'bg-blue-600 hover:bg-blue-700', callback }]); }
function showConfirmation(title, text, onConfirm) { showModal(title, text, [{ text: 'Cancel', class: 'bg-gray-500 hover:bg-gray-600' }, { text: 'Confirm', class: 'bg-red-600 hover:bg-red-700', callback: onConfirm }]); }

function fromCanvasToLatLng(point) {
    const overlayProjection = appState.mapProjectionOverlay.getProjection();
    if (!overlayProjection || !point) return null;
    try {
        const pointAsGooglePoint = new google.maps.Point(point.x, point.y);
        const latLng = overlayProjection.fromContainerPixelToLatLng(pointAsGooglePoint);
        if (!latLng) return null;
        return { lat: latLng.lat(), lng: latLng.lng() };
    } catch (e) { return null; }
}

function fromLatLngToCanvas(latLng) {
    const overlayProjection = appState.mapProjectionOverlay.getProjection();
    if (!overlayProjection || !latLng) return null;
    const googleLatLng = new google.maps.LatLng(latLng.lat, latLng.lng);
    const worldPoint = overlayProjection.fromLatLngToContainerPixel(googleLatLng);
    return { x: worldPoint.x, y: worldPoint.y };
}

function resizeCanvas() {
    const mapWrapper = document.getElementById('map-wrapper');
    const rect = mapWrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    appState.canvas.style.width = `${rect.width}px`;
    appState.canvas.style.height = `${rect.height}px`;
    appState.canvas.width = rect.width * dpr;
    appState.canvas.height = rect.height * dpr;
    appState.ctx.scale(dpr, dpr);
    redrawCanvas();
}

function getCanvasXY(event) {
    if (event.type.startsWith('touch')) event.preventDefault();
    const rect = appState.canvas.getBoundingClientRect();
    const touch = event.changedTouches ? event.changedTouches[0] : (event.touches ? event.touches[0] : null);
    let clientX, clientY;
    if (touch) { clientX = touch.clientX; clientY = touch.clientY; }
    else if (event.clientX !== undefined) { clientX = event.clientX; clientY = event.clientY; }
    else { return null; }
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDrawingLoop() {
    function loop() {
        redrawCanvas();
        appState.animationFrameId = requestAnimationFrame(loop);
    }
    loop()
}

function toggleLiveLocation() {
    const locationBtn = document.getElementById('toggle-location-btn');
    if (appState.locationWatchId !== null) {
        navigator.geolocation.clearWatch(appState.locationWatchId);
        appState.locationWatchId = null;
        if (appState.userLocationMarker) {
            appState.userLocationMarker.setMap(null);
            appState.userLocationMarker = null;
        }
        locationBtn.classList.remove('bg-blue-600', 'text-white');
        showAlert('Info', 'Live location tracking stopped.');
    } else {
        if (!navigator.geolocation) {
            showAlert('Error', 'Geolocation is not supported by your browser.');
            return;
        }
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };
        appState.locationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
                if (!appState.userLocationMarker) {
                    appState.userLocationMarker = new google.maps.Marker({
                        position: pos,
                        map: appState.map,
                        title: 'Your Location',
                        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#4285F4', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 }
                    });
                    locationBtn.classList.add('bg-blue-600', 'text-white');
                    showAlert('Info', 'Live location tracking started.');
                } else {
                    appState.userLocationMarker.setPosition(pos);
                }
                appState.map.panTo(pos);
            },
            () => {
                showAlert('Error', 'Unable to retrieve your location. Please ensure location services are enabled.');
                toggleLiveLocation();
            },
            options
        );
    }
}

function isPointInDrawing(point, drawing) {
    const screenPath = drawing.path.map(p => fromLatLngToCanvas(p));
    if (screenPath.some(p => p === null)) return false;

    const margin = 10;
    if (drawing.type === 'gpsMarker') {
        const markerPos = screenPath[0];
        return Math.sqrt((point.x - markerPos.x) ** 2 + (point.y - (markerPos.y - 15)) ** 2) < 15;
    } else if (drawing.type === 'line' || drawing.type === 'freeDraw') {
        for (let i = 0; i < screenPath.length - 1; i++) {
            if (distanceToSegment(point, screenPath[i], screenPath[i + 1]) < margin) return true;
        }
        return false;
    } else if (drawing.type === 'polygon') {
        let inside = false;
        for (let i = 0, j = screenPath.length - 1; i < screenPath.length; j = i++) {
            const xi = screenPath[i].x, yi = screenPath[i].y;
            const xj = screenPath[j].x, yj = screenPath[j].y;
            if (((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    } else if (drawing.type === 'circle') {
        const center = screenPath[0];
        const radius = Math.sqrt((screenPath[1].x - center.x) ** 2 + (screenPath[1].y - center.y) ** 2);
        return Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2) <= radius;
    } else if (drawing.type === 'depthPoint' || drawing.type === 'text') {
        const p = screenPath[0];
        return Math.sqrt((point.x - p.x) ** 2 + (point.y - p.y) ** 2) < margin;
    }
    return false;
}

function distanceToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

// ADD THESE TWO FUNCTIONS to the end of sketch.js

// REPLACE this function in sketch.js
// REPLACE this function in sketch.js
// REPLACE this function in sketch.js
function initializeSnowRouteMode() {
    if (!appState.isSnowRouteMode || !appState.snowLocations || appState.snowLocations.length === 0) {
        console.warn("Attempted to initialize snow route mode without valid data.");
        return; // Exit if not in snow route mode or no locations
    }

    // --- Prepare UI ---
    document.getElementById('page-title').textContent = 'Snow Route Plan';
    document.getElementById('measurements-panel-wrapper').style.display = 'none'; // Hide measurements
    document.getElementById('tools-panel').style.display = 'block'; // Show tools panel
    document.getElementById('default-tools-panel').style.display = 'none'; // Hide default drawing tools
    document.getElementById('snow-route-panel').classList.remove('hidden'); // Show snow route panel
    document.getElementById('totals-panel').style.display = 'none'; // Hide totals
    document.getElementById('save-btn').textContent = 'Save Route Order'; // Update save button text

    const waypointsContainer = document.getElementById('snow-route-waypoints');
    const summaryContainer = document.getElementById('snow-route-summary');
    waypointsContainer.innerHTML = '<p class="text-gray-500 text-sm p-2">Calculating optimal route...</p>'; // Loading message

    // Ensure Google Maps services are ready
    if (!window.google || !window.google.maps || !window.google.maps.DirectionsService || !window.google.maps.DirectionsRenderer || !window.google.maps.InfoWindow || !window.google.maps.Marker) {
        console.error("Google Maps API components not fully loaded.");
        showAlert('Error', 'Google Maps components failed to load. Cannot calculate route.');
        return;
    }

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: true, // Allow manual reordering on map
        map: appState.map,
        suppressMarkers: true // We create custom markers
    });

    // Extract addresses for the request
    const origin = appState.snowLocations[0]?.address;
    const destination = appState.snowLocations[appState.snowLocations.length - 1]?.address;
    const waypoints = appState.snowLocations.length > 2
        ? appState.snowLocations.slice(1, -1).map(loc => ({ location: loc.address, stopover: true }))
        : [];

    if (!origin || !destination) {
        waypointsContainer.innerHTML = '<p class="text-red-500 text-sm p-2">Error: Origin or destination address is missing.</p>';
        console.error("Missing origin or destination for route calculation.");
        return;
    }

    const request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true, // Let Google find the best order
        travelMode: google.maps.TravelMode.DRIVING,
    };

    directionsService.route(request, (result, status) => {
        if (status == 'OK') {
            directionsRenderer.setDirections(result); // Draw the route line on the map
            const route = result.routes[0];
            let totalDistance = 0, totalDuration = 0;

            // Re-order our ORIGINAL snowLocations array based on Google's optimized order
            const orderedIndices = route.waypoint_order || [];
            let orderedLocations = [appState.snowLocations[0]]; // Start with origin
            orderedIndices.forEach(index => {
                // Waypoint indices refer to the *original* waypoints array
                // which starts at index 1 of the full locations array
                orderedLocations.push(appState.snowLocations[index + 1]);
            });
            if (appState.snowLocations.length > 1) { // Add destination if it wasn't the origin
                orderedLocations.push(appState.snowLocations[appState.snowLocations.length - 1]);
            }
            // Update appState.snowLocations to reflect the new order for saving
            appState.snowLocations = orderedLocations;

            waypointsContainer.innerHTML = ''; // Clear loading message

            // --- Build the Detailed Route List & Markers ---
            route.legs.forEach((leg, i) => {
                totalDistance += leg.distance?.value || 0; // Add safety checks
                totalDuration += leg.duration?.value || 0;

                const locationData = orderedLocations[i]; // Get data for the start of this leg
                if (!locationData) return; // Skip if data is missing for some reason

                // ---- ADDED SKETCH LINK ----
                const sketchLinkHtml = locationData.sourceSketchId
                    ? `<a href="sketch.html?estimateId=${appState.estimateId}&sketchId=${locationData.sourceSketchId}&address=${encodeURIComponent(locationData.address || '')}" target="_blank" class="text-blue-600 hover:underline text-xs ml-2">(View Sketch)</a>`
                    : '<span class="text-gray-400 text-xs ml-2">(No Sketch Linked)</span>';
                // ---------------------------

                // Create custom marker with InfoWindow including all details
                const infoWindowContent = `
                    <div style="font-family: sans-serif; font-size: 13px; color: #333; max-width: 280px; line-height: 1.4;">
                        <h4 style="font-weight: bold; margin: 0 0 5px;">${i + 1}. ${locationData.title || 'Unnamed Location'}</h4>
                        <p style="margin: 0 0 3px;">${locationData.address || 'No Address'}</p>
                        <p style="margin: 3px 0;"><strong>Client:</strong> ${document.getElementById('client-name')?.value || 'N/A'}</p>
                        <p style="margin: 3px 0;"><strong>Time On Site:</strong> ${locationData.timeToComplete?.toFixed(1) || 'N/A'} hrs</p>
                        <p style="margin: 3px 0;"><strong>Equipment:</strong> ${locationData.equipmentInfo || 'N/A'}</p>
                        <p style="margin: 3px 0;"><strong>Trigger:</strong> ${locationData.clearingTrigger || 'N/A'}</p>
                        <p style="margin: 3px 0;"><strong>Per Push:</strong> ${formatCurrency(locationData.pricePerPush)}</p>
                        <p style="margin: 3px 0;"><strong>Monthly:</strong> ${formatCurrency(locationData.priceMonthly)}</p>
                        <p style="margin: 0;"><strong>Seasonal:</strong> ${formatCurrency(locationData.priceSeasonal)}</p>
                    </div>`;
                const infoWindow = new google.maps.InfoWindow({ content: infoWindowContent });
                const marker = new google.maps.Marker({
                    position: leg.start_location,
                    map: appState.map,
                    label: { text: `${i + 1}`, color: 'white', fontWeight: 'bold' } // Numbered marker
                });
                marker.addListener('click', () => infoWindow.open(appState.map, marker));

                // Add detailed info to the side panel list
                const legElement = document.createElement('div');
                legElement.className = 'p-3 border rounded-md bg-white mb-2 snow-route-waypoint-item'; // Add class for drag/drop
                legElement.dataset.locationId = locationData.id; // Store ID for reordering
                // Updated innerHTML to include Equipment and use locationData fields
                legElement.innerHTML = `
                    <p class="font-bold text-lg mb-1 flex items-center">
                        <span class="inline-block bg-blue-600 text-white rounded-full w-6 h-6 text-center leading-6 mr-2">${i + 1}</span>
                        ${locationData.title || 'Unnamed Location'}
                        ${sketchLinkHtml} {/* <-- ADDED LINK HERE */}
                        <span class="text-gray-400 cursor-grab drag-handle ml-auto">&#x2630;</span> </p>
                    <p class="text-sm text-gray-600 mb-1">${locationData.address || 'No Address'}</p>
                    <div class="text-xs space-y-1 mt-2 pt-2 border-t">
                        <p><strong>Client:</strong> ${document.getElementById('client-name')?.value || 'N/A'}</p>
                        <p><strong>Trigger:</strong> ${locationData.clearingTrigger || 'N/A'}</p>
                        <p><strong>Time On Site:</strong> ${locationData.timeToComplete?.toFixed(1) || 'N/A'} hrs</p>
                        <p><strong>Equipment:</strong> ${locationData.equipmentInfo || 'N/A'}</p>
                        <p><strong>Per Push:</strong> ${formatCurrency(locationData.pricePerPush)} | <strong>Monthly:</strong> ${formatCurrency(locationData.priceMonthly)} | <strong>Seasonal:</strong> ${formatCurrency(locationData.priceSeasonal)}</p>
                    </div>
                    ${leg.distance && leg.duration ? `<p class="text-xs text-gray-500 mt-2"><em>Driving to next: ${leg.distance.text}, ${leg.duration.text}</em></p>` : ''}
                `;
                waypointsContainer.appendChild(legElement);
            });

            // Add marker and info for the final destination
            const lastLeg = route.legs[route.legs.length - 1];
            const lastLocationData = orderedLocations[orderedLocations.length - 1];
            if (lastLocationData && lastLeg) { // Added check for lastLeg

                // ---- ADDED SKETCH LINK ----
                const lastSketchLinkHtml = lastLocationData.sourceSketchId
                    ? `<a href="sketch.html?estimateId=${appState.estimateId}&sketchId=${lastLocationData.sourceSketchId}&address=${encodeURIComponent(lastLocationData.address || '')}" target="_blank" class="text-blue-600 hover:underline text-xs ml-2">(View Sketch)</a>`
                    : '<span class="text-gray-400 text-xs ml-2">(No Sketch Linked)</span>';
                // ---------------------------

                const lastInfoWindowContent = `
                    <div style="font-family: sans-serif; font-size: 13px; color: #333; max-width: 280px; line-height: 1.4;">
                        <h4 style="font-weight: bold; margin: 0 0 5px;">${route.legs.length + 1}. ${lastLocationData.title || 'Unnamed Location'}</h4>
                        <p style="margin: 0 0 3px;">${lastLocationData.address || 'No Address'}</p>
                        <p style="margin: 3px 0;"><strong>Client:</strong> ${document.getElementById('client-name')?.value || 'N/A'}</p>
                        <p style="margin: 3px 0;"><strong>Time On Site:</strong> ${lastLocationData.timeToComplete?.toFixed(1) || 'N/A'} hrs</p>
                        <p style="margin: 3px 0;"><strong>Equipment:</strong> ${lastLocationData.equipmentInfo || 'N/A'}</p>
                        <p style="margin: 3px 0;"><strong>Trigger:</strong> ${lastLocationData.clearingTrigger || 'N/A'}</p>
                        <p style="margin: 3px 0;"><strong>Per Push:</strong> ${formatCurrency(lastLocationData.pricePerPush)}</p>
                        <p style="margin: 3px 0;"><strong>Monthly:</strong> ${formatCurrency(lastLocationData.priceMonthly)}</p>
                        <p style="margin: 0;"><strong>Seasonal:</strong> ${formatCurrency(lastLocationData.priceSeasonal)}</p>
                    </div>`;
                const lastInfoWindow = new google.maps.InfoWindow({ content: lastInfoWindowContent });
                const lastMarker = new google.maps.Marker({
                    position: lastLeg.end_location,
                    map: appState.map,
                    label: { text: `${route.legs.length + 1}`, color: 'white', fontWeight: 'bold' }
                });
                lastMarker.addListener('click', () => lastInfoWindow.open(appState.map, lastMarker));

                // Add final location details to the side panel
                const lastLegElement = document.createElement('div');
                lastLegElement.className = 'p-3 border rounded-md bg-white mb-2 snow-route-waypoint-item'; // Add class
                lastLegElement.dataset.locationId = lastLocationData.id; // Store ID
                lastLegElement.innerHTML = `
                    <p class="font-bold text-lg mb-1 flex items-center">
                        <span class="inline-block bg-blue-600 text-white rounded-full w-6 h-6 text-center leading-6 mr-2">${route.legs.length + 1}</span>
                        ${lastLocationData.title || 'Unnamed Location'}
                        ${lastSketchLinkHtml} {/* <-- ADDED LINK HERE */}
                        <span class="text-gray-400 cursor-grab drag-handle ml-auto">&#x2630;</span> </p>
                    <p class="text-sm text-gray-600 mb-1">${lastLocationData.address || 'No Address'}</p>
                    <div class="text-xs space-y-1 mt-2 pt-2 border-t">
                        <p><strong>Client:</strong> ${document.getElementById('client-name')?.value || 'N/A'}</p>
                        <p><strong>Trigger:</strong> ${lastLocationData.clearingTrigger || 'N/A'}</p>
                        <p><strong>Time On Site:</strong> ${lastLocationData.timeToComplete?.toFixed(1) || 'N/A'} hrs</p>
                        <p><strong>Equipment:</strong> ${lastLocationData.equipmentInfo || 'N/A'}</p>
                        <p><strong>Per Push:</strong> ${formatCurrency(lastLocationData.pricePerPush)} | <strong>Monthly:</strong> ${formatCurrency(lastLocationData.priceMonthly)} | <strong>Seasonal:</strong> ${formatCurrency(lastLocationData.priceSeasonal)}</p>
                    </div>`;
                waypointsContainer.appendChild(lastLegElement);
            }

            // Update summary totals in the side panel
            document.getElementById('route-total-distance').textContent = `${(totalDistance / 1000).toFixed(1)} km`;
            document.getElementById('route-total-time').textContent = `${Math.round(totalDuration / 60)} minutes`;

            // --- Enable drag-and-drop reordering for the list ---
            setupDragAndDropReorder(waypointsContainer);

        } else {
            waypointsContainer.innerHTML = `<p class="text-red-500 text-sm p-2">Routing Error: Could not calculate the route. Please check if all addresses are valid. Status: ${status}</p>`;
            console.error("Directions request failed due to " + status);
        }
    });

    // Make map bounds fit the route
    directionsRenderer.addListener('directions_changed', () => {
        const directions = directionsRenderer.getDirections();
        if (directions && directions.routes && directions.routes[0] && directions.routes[0].bounds) { // Added bounds check
            appState.map.fitBounds(directions.routes[0].bounds);
        }
        // Update the appState order if the user dragged the route on the map
        if (directions && directions.routes && directions.routes[0]) {
            const newWaypointOrder = directions.routes[0].waypoint_order || [];
            let newlyOrderedLocations = [appState.snowLocations[0]]; // Start with original origin
            newWaypointOrder.forEach(index => {
                // Find the location corresponding to the original waypoint index
                const originalWaypointIndex = index + 1; // +1 because waypoints skipped the origin
                newlyOrderedLocations.push(appState.snowLocations[originalWaypointIndex]);
            });
            if (appState.snowLocations.length > 1) { // Add original destination
                newlyOrderedLocations.push(appState.snowLocations[appState.snowLocations.length - 1]);
            }
            appState.snowLocations = newlyOrderedLocations;
            // Re-render the side panel list to reflect the new map order
            renderOrderedWaypointsList(waypointsContainer);
        }
    });
}

async function saveSnowRouteOrder() {
    if (!appState.isSnowRouteMode || !appState.estimateId) return;
    const saveButton = document.getElementById('save-btn');
    saveButton.disabled = true;
    saveButton.innerHTML = 'Saving...';

    // Import necessary Firebase functions
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js");
    const { ref, uploadString, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js");

    try {
        // --- CAPTURE MAP IMAGE ---
        let mapImageUrl = null;
        try {
            const mapWrapper = document.getElementById('map-wrapper');
            // Temporarily hide markers/info windows if needed for cleaner map image
            // (This requires access to marker/infowindow objects - more complex)
            const dpr = window.devicePixelRatio || 1;
            appState.map.setTilt(0); // Ensure map is flat
            await new Promise(resolve => setTimeout(resolve, 300)); // Allow map to redraw

            const mapCanvas = await html2canvas(mapWrapper, { useCORS: true, scale: dpr });
            const mapImageDataUrl = mapCanvas.toDataURL('image/jpeg', 0.85); // Use JPEG for smaller size

            // Upload image to storage
            const mapImageRef = ref(window.storage, `estimates/${appState.estimateId}/snow_route_map_${Date.now()}.jpg`);
            await uploadString(mapImageRef, mapImageDataUrl, 'data_url');
            mapImageUrl = await getDownloadURL(mapImageRef);
            console.log("Snow route map image saved:", mapImageUrl);

        } catch (imgError) {
            console.error("Error capturing or uploading map image:", imgError);
            // Continue saving the order even if image fails
        }
        // --- END CAPTURE MAP IMAGE ---

        // Get the final order of location IDs from the current state
        const routeOrderIds = appState.snowLocations.map(loc => loc.id);

        const estimateRef = doc(window.db, 'estimates', appState.estimateId);
        await updateDoc(estimateRef, {
            snowRouteOrder: routeOrderIds,
            snowRouteMapUrl: mapImageUrl, // Save the map image URL
            lastSaved: new Date().toISOString()
        });

        showAlert('Success', 'Snow route order and map saved!', () => {
            // Redirect back to the estimator, snow section
            window.location.href = `estimator.html?view=editor&estimateId=${appState.estimateId}&section=snow`;
        });

    } catch (error) {
        console.error("Error saving snow route order:", error);
        showAlert('Error', `Failed to save route: ${error.message}`);
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = 'Save Route Order';
    }
}

// ADD THESE TWO FUNCTIONS TO THE END of sketch.js

// Renders the ordered list of waypoints in the side panel
// REPLACE this function in sketch.js
// Renders the ordered list of waypoints in the side panel
function renderOrderedWaypointsList(container) {
    if (!container) return;
    container.innerHTML = ''; // Clear previous list

    appState.snowLocations.forEach((locationData, i) => {
        if (!locationData) return; // Skip if data is invalid

        // ---- ADDED SKETCH LINK ----
        const sketchLinkHtml = locationData.sourceSketchId
            ? `<a href="sketch.html?estimateId=${appState.estimateId}&sketchId=${locationData.sourceSketchId}&address=${encodeURIComponent(locationData.address || '')}" target="_blank" class="text-blue-600 hover:underline text-xs ml-2">(View Sketch)</a>`
            : '<span class="text-gray-400 text-xs ml-2">(No Sketch Linked)</span>';
        // ---------------------------

        const legElement = document.createElement('div');
        legElement.className = 'p-3 border rounded-md bg-white mb-2 snow-route-waypoint-item'; // Class for styling and drag/drop
        legElement.dataset.locationId = locationData.id; // Store ID for reordering
        legElement.setAttribute('draggable', 'true'); // Make draggable

        // Display details using the enriched locationData
        legElement.innerHTML = `
            <p class="font-bold text-lg mb-1 flex items-center">
                <span class="inline-block bg-blue-600 text-white rounded-full w-6 h-6 text-center leading-6 mr-2">${i + 1}</span>
                ${locationData.title || 'Unnamed Location'}
                ${sketchLinkHtml} {/* <-- ADDED LINK HERE */}
                <span class="text-gray-400 cursor-grab drag-handle ml-auto">&#x2630;</span> </p>
            <p class="text-sm text-gray-600 mb-1">${locationData.address || 'No Address'}</p>
            <div class="text-xs space-y-1 mt-2 pt-2 border-t">
                <p><strong>Client:</strong> ${document.getElementById('client-name')?.value || 'N/A'}</p>
                <p><strong>Trigger:</strong> ${locationData.clearingTrigger || 'N/A'}</p>
                <p><strong>Time On Site:</strong> ${locationData.timeToComplete?.toFixed(1) || 'N/A'} hrs</p>
                <p><strong>Equipment:</strong> ${locationData.equipmentInfo || 'N/A'}</p>
                <p><strong>Per Push:</strong> ${formatCurrency(locationData.pricePerPush)} | <strong>Monthly:</strong> ${formatCurrency(locationData.priceMonthly)} | <strong>Seasonal:</strong> ${formatCurrency(locationData.priceSeasonal)}</p>
            </div>
            `;
        container.appendChild(legElement);
    });
}

// Sets up drag and drop reordering for the waypoint list
function setupDragAndDropReorder(container) {
    let draggedItemId = null;

    container.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('snow-route-waypoint-item')) {
            draggedItemId = e.target.dataset.locationId;
            e.target.classList.add('opacity-50');
            // Required for Firefox
            e.dataTransfer.setData('text/plain', draggedItemId);
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    container.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('snow-route-waypoint-item')) {
            e.target.classList.remove('opacity-50');
            draggedItemId = null;
            // Clear drop indicators
            container.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        }
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow drop
        const targetItem = e.target.closest('.snow-route-waypoint-item');
        if (targetItem && targetItem.dataset.locationId !== draggedItemId) {
            e.dataTransfer.dropEffect = 'move';
            // Remove previous indicators
            container.querySelectorAll('.drop-indicator').forEach(el => el.remove());
            // Add indicator line
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator h-1 bg-blue-500 my-1'; // Style as needed
            targetItem.parentNode.insertBefore(indicator, targetItem);
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    });

    container.addEventListener('dragleave', (e) => {
        // Simple cleanup on leave - might need more robust logic
        const relatedTarget = e.relatedTarget;
        const currentTarget = e.currentTarget;
        // Check if the mouse is leaving the container itself or moving between items
        if (relatedTarget && !currentTarget.contains(relatedTarget)) {
            container.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        container.querySelectorAll('.drop-indicator').forEach(el => el.remove()); // Clean up indicator
        const targetItem = e.target.closest('.snow-route-waypoint-item');

        if (targetItem && draggedItemId && targetItem.dataset.locationId !== draggedItemId) {
            const draggedIndex = appState.snowLocations.findIndex(loc => loc.id === draggedItemId);
            let targetIndex = appState.snowLocations.findIndex(loc => loc.id === targetItem.dataset.locationId);

            if (draggedIndex !== -1 && targetIndex !== -1) {
                // Adjust index if dragging down
                if (draggedIndex < targetIndex) {
                    // targetIndex--; // No adjustment needed when inserting before
                }

                // Move item in the appState array
                const [draggedLocation] = appState.snowLocations.splice(draggedIndex, 1);
                appState.snowLocations.splice(targetIndex, 0, draggedLocation);

                // Re-render the list based on the new order in appState.snowLocations
                renderOrderedWaypointsList(container);

                // --- TODO: Recalculate and redraw route on map ---
                // This would require calling directionsService.route again with the new order
                console.log("New order:", appState.snowLocations.map(l => l.id));
                // redrawRouteOnMap(); // Need to implement this function
                // --------------------------------------------------
            }
        }
        draggedItemId = null; // Reset dragged item
    });
}

// --- NEW: KEYBOARD SHORTCUTS ---
// --- NEW: KEYBOARD SHORTCUTS ---
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 1. Ignore shortcuts if the user is typing in a text box
        if (e.target.matches('input, textarea')) return;

        const key = e.key.toLowerCase();

        // 2. Tool Shortcuts
        switch (key) {
            case 's':
            case 'v': // Common 'Select' key
                setTool('select');
                break;
            case 'h':
            case ' ': // Spacebar for Pan
                setTool('pan');
                break;
            case 'p':
                setTool('polygon');
                break;
            case 'l':
                setTool('line');
                break;
            case 'c':
                setTool('circle');
                break;
            case 'f':
                setTool('freeDraw');
                break;
            case 't':
                setTool('text');
                break;
        }

        // 3. Action Shortcuts
        if (key === 'delete' || key === 'backspace') {
            if (appState.selectedShapeIds.length > 0) {
                const deleteBtn = document.getElementById('delete-selected-btn');
                if (deleteBtn) deleteBtn.click();
            }
        }

        if (key === 'z' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        }

        if (key === 'y' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            redo();
        }

        // 4. Smart Escape
        if (key === 'escape') {
            if (appState.isDrawing) {
                appState.isDrawing = false;
                appState.currentPath = [];
                redrawCanvas();
            } else if (appState.selectedShapeIds.length > 0) {
                appState.selectedShapeIds = [];
                updatePropertiesPanel();
                updateMeasurementList();
                redrawCanvas();
            } else {
                setTool('select');
            }
        }
    });
}
