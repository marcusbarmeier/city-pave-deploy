
// modules/excavation_calc/excavation-app.js

import { calculateExcavationMetrics } from './excavation-core.js';
import { renderExcavationCalculator, getInputValues, updateResults } from './excavation-ui.js';

let map, drawingManager, polygon;
let isInitialized = false;

export async function initializeExcavationModule(containerId, options = {}) {
    // 1. Render UI
    renderExcavationCalculator(containerId, options.initialData || {});

    // 2. Initialize Map (Google Maps must be loaded globally)
    // We wait a moment for the DOM to settle
    setTimeout(() => initMap(), 100);

    // 3. Setup Listeners
    setupEventListeners(options.onSave);

    // 4. Initial Calc
    handleCalculation();

    isInitialized = true;
}

function initMap() {
    const mapEl = document.getElementById("excavation-map");
    if (!mapEl || !window.google || !window.google.maps) {
        console.warn("Google Maps not available or map element missing.");
        return;
    }

    const initialPos = { lat: 49.8951, lng: -97.1384 }; // Winnipeg
    map = new google.maps.Map(mapEl, {
        center: initialPos,
        zoom: 17,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        zoomControl: true
    });

    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: {
            fillColor: '#ea580c', // Orange-600
            fillOpacity: 0.3,
            strokeWeight: 2,
            strokeColor: '#ea580c',
            clickable: false,
            editable: true,
            zIndex: 1
        }
    });
    drawingManager.setMap(map);

    google.maps.event.addListener(drawingManager, 'overlaycomplete', (event) => {
        if (event.type === 'polygon') {
            if (polygon) polygon.setMap(null); // Replace existng
            polygon = event.overlay;
            drawingManager.setDrawingMode(null);

            // Listen for shape edits
            google.maps.event.addListener(polygon.getPath(), 'set_at', handleCalculation);
            google.maps.event.addListener(polygon.getPath(), 'insert_at', handleCalculation);

            // Calculate Area immediately
            updateAreaFromPolygon();
            handleCalculation();
        }
    });
}

function updateAreaFromPolygon() {
    if (polygon && window.google && window.google.maps.geometry) {
        const areaSqM = google.maps.geometry.spherical.computeArea(polygon.getPath());
        const areaSqFt = areaSqM * 10.7639;

        // Update DOM
        const display = document.getElementById('exc-area-display');
        const hidden = document.getElementById('exc-area-hidden');
        if (display) display.textContent = `${Math.round(areaSqFt).toLocaleString()} sq ft`;
        if (hidden) hidden.value = areaSqFt;
    }
}

function setupEventListeners(onSaveCallback) {
    // Drawing Buttons
    document.getElementById('draw-poly-btn')?.addEventListener('click', () => {
        if (polygon) polygon.setMap(null);
        if (drawingManager) drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    });

    document.getElementById('clear-poly-btn')?.addEventListener('click', () => {
        if (polygon) {
            polygon.setMap(null);
            polygon = null;
            document.getElementById('exc-area-display').textContent = '0 sq ft';
            document.getElementById('exc-area-hidden').value = 0;
            handleCalculation();
        }
    });

    // Save Button
    document.getElementById('exc-save-btn')?.addEventListener('click', () => {
        const results = calculateExcavationMetrics(getInputValues());
        if (onSaveCallback) onSaveCallback(results);
    });

    // Inputs (Auto-Calc)
    const inputs = ['exc-depth', 'exc-soil-type', 'exc-bucket-size', 'exc-cycle-time', 'exc-efficiency', 'haul-capacity', 'haul-dist', 'haul-speed', 'haul-dump-time'];
    inputs.forEach(id => {
        document.getElementById(id)?.addEventListener('input', handleCalculation);
    });
}

function handleCalculation() {
    if (polygon) updateAreaFromPolygon();
    const inputs = getInputValues();
    const results = calculateExcavationMetrics(inputs);
    updateResults(results);
}
