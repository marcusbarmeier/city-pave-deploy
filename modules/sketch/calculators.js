/**
 * calculators.js
 * Handles the logic and UI for Excavation and Snow calculators within the Sketch App.
 */

import { DynamicCalculator } from './dynamic-calculator.js';
import { calculateExcavationMetrics } from '../excavation_calc/excavation-core.js';

export class CalculatorManager {
    constructor(sketchApp, mode, config = null) {
        this.sketchApp = sketchApp;
        this.mode = mode; // 'excavation', 'snow', or 'custom'
        this.config = config; // JSON config for custom calculators
        this.container = document.getElementById('calculator-panel');
        this.data = {};
        this.dynamicCalc = null;
        this.init();
    }

    init() {
        if (!this.container) {
            console.error("Calculator panel container not found.");
            return;
        }
        this.renderUI();
        this.bindEvents();
        this.startAutoCalculate();
    }

    renderUI() {
        this.container.innerHTML = '';
        if (this.mode === 'excavation') {
            this.renderExcavationUI();
        } else if (this.mode === 'snow') {
            this.renderSnowUI();
        } else if (this.mode === 'custom' && this.config) {
            this.dynamicCalc = new DynamicCalculator(this, this.config);
            this.dynamicCalc.render();
        } else {
            this.container.innerHTML = '<div class="p-4 text-gray-500">Select a calculator or import a custom one.</div>';
        }

        this.renderImportControl();
    }

    renderImportControl() {
        const div = document.createElement('div');
        div.className = 'mt-4 p-4 border-t border-gray-200';
        div.innerHTML = `
            <button id="btn-import-calc" class="w-full py-2 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300 text-sm flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Load Custom Calculator
            </button>
            <input type="file" id="inp-import-calc" accept=".json" class="hidden">
        `;
        this.container.appendChild(div);

        // Bind events for this control locally
        const btn = div.querySelector('#btn-import-calc');
        const inp = div.querySelector('#inp-import-calc');

        btn.addEventListener('click', () => inp.click());
        inp.addEventListener('change', (e) => this.handleFileImport(e));
    }

    handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target.result);
                if (config.name && config.inputs && config.calculations) {
                    this.mode = 'custom';
                    this.config = config;
                    this.renderUI();
                    // Provide feedback
                    alert(`Loaded: ${config.name}`);
                } else {
                    alert('Invalid calculator configuration file.');
                }
            } catch (err) {
                console.error("Error parsing calculator file:", err);
                alert('Failed to load calculator file.');
            }
        };
        reader.readAsText(file);
    }

    renderExcavationUI() {
        this.container.innerHTML = `
            <div class="p-4 bg-orange-50 border-b border-orange-200">
                <h3 class="font-bold text-orange-900 flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    Excavation Calculator
                </h3>
            </div>
            <div class="p-4 space-y-4 overflow-y-auto flex-grow">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Total Area (sq ft)</label>
                    <input type="number" id="calc-area" class="w-full p-2 border rounded bg-gray-100" readonly>
                    <p class="text-xs text-gray-400 mt-1">Draw polygons to update area.</p>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Depth (ft)</label>
                        <input type="number" id="calc-depth" class="w-full p-2 border rounded" value="1.0" step="0.1">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Swell Factor</label>
                        <input type="number" id="calc-swell" class="w-full p-2 border rounded" value="1.3" step="0.1">
                    </div>
                </div>
                <div class="bg-white p-3 rounded border border-gray-200">
                    <div class="flex justify-between mb-1">
                        <span class="text-sm text-gray-600">Volume (Bank):</span>
                        <span id="res-vol-bank" class="font-bold">0 cy</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-600">Volume (Loose):</span>
                        <span id="res-vol-loose" class="font-bold text-orange-600">0 cy</span>
                    </div>
                </div>

                <hr class="border-gray-200">

                <h4 class="font-bold text-sm text-gray-700">Trucking & Cycle</h4>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Truck Cap (cy)</label>
                        <input type="number" id="calc-truck-cap" class="w-full p-2 border rounded" value="18">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Load Time (min)</label>
                        <input type="number" id="calc-load-time" class="w-full p-2 border rounded" value="5">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cycle Time (min)</label>
                        <input type="number" id="calc-cycle-time" class="w-full p-2 border rounded" value="45">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Trucks</label>
                        <input type="number" id="calc-trucks" class="w-full p-2 border rounded" value="3">
                    </div>
                </div>

                 <div class="bg-orange-100 p-3 rounded border border-orange-200">
                    <div class="flex justify-between mb-1">
                        <span class="text-sm text-gray-700">Total Loads:</span>
                        <span id="res-loads" class="font-bold">0</span>
                    </div>
                    <div class="flex justify-between mb-1">
                        <span class="text-sm text-gray-700">Total Time:</span>
                        <span id="res-time" class="font-bold">0 hrs</span>
                    </div>
                     <div class="flex justify-between pt-2 border-t border-orange-200 mt-2">
                        <span class="text-sm font-bold text-gray-800">Est. Cost:</span>
                        <span id="res-cost" class="font-bold text-lg text-orange-700">$0.00</span>
                    </div>
                </div>
            </div>
            <div class="p-4 border-t border-gray-200 bg-gray-50">
                <button id="calc-save-btn" class="w-full py-2 bg-orange-600 text-white font-bold rounded hover:bg-orange-700 shadow-sm">Save & Return to Estimator</button>
            </div>
        `;
    }

    renderSnowUI() {
        this.container.innerHTML = `
            <div class="p-4 bg-blue-50 border-b border-blue-200">
                <h3 class="font-bold text-blue-900 flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                    Snow Calculator
                </h3>
            </div>
            <div class="p-4 space-y-4 overflow-y-auto flex-grow">
                 <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Total Area (sq ft)</label>
                    <input type="number" id="calc-area" class="w-full p-2 border rounded bg-gray-100" readonly>
                    <p class="text-xs text-gray-400 mt-1">Draw polygons to update area.</p>
                </div>
                
                <h4 class="font-bold text-sm text-gray-700">Service Details</h4>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Trigger Depth</label>
                    <select id="calc-trigger" class="w-full p-2 border rounded">
                        <option value="1 inch">1 Inch</option>
                        <option value="2 inch">2 Inch</option>
                        <option value="Trace">Trace</option>
                    </select>
                </div>
                
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Plow Efficiency</label>
                        <input type="number" id="calc-efficiency" class="w-full p-2 border rounded" value="25000" title="Sq Ft per Hour">
                    </div>
                     <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Salt Rate</label>
                        <input type="number" id="calc-salt-rate" class="w-full p-2 border rounded" value="0.5" title="Lbs per 1000 sq ft">
                    </div>
                </div>

                 <div class="bg-blue-100 p-3 rounded border border-blue-200">
                    <div class="flex justify-between mb-1">
                        <span class="text-sm text-gray-700">Est. Time:</span>
                        <span id="res-time" class="font-bold">0 hrs</span>
                    </div>
                    <div class="flex justify-between mb-1">
                        <span class="text-sm text-gray-700">Salt Needed:</span>
                        <span id="res-salt" class="font-bold">0 lbs</span>
                    </div>
                     <div class="flex justify-between pt-2 border-t border-blue-200 mt-2">
                        <span class="text-sm font-bold text-gray-800">Est. Event Cost:</span>
                        <span id="res-cost" class="font-bold text-lg text-blue-700">$0.00</span>
                    </div>
                </div>
            </div>
            <div class="p-4 border-t border-gray-200 bg-gray-50">
                <button id="calc-save-btn" class="w-full py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-sm">Save & Return to Estimator</button>
            </div>
        `;
    }

    bindEvents() {
        // Listen for input changes to recalculate
        this.container.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                this.calculate();
            }
        });

        // Save button
        const saveBtn = document.getElementById('calc-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveAndReturn());
        }
    }

    startAutoCalculate() {
        // Poll for area changes from the main sketch app
        // In a real event-driven system, we'd subscribe to an event.
        // For now, we'll check every 500ms if the area has changed.
        setInterval(() => {
            const currentArea = this.getSketchArea();
            const areaInput = document.getElementById('calc-area');

            // Standard Calculators
            if (areaInput && parseFloat(areaInput.value || 0) !== currentArea) {
                areaInput.value = currentArea.toFixed(2);
                this.calculate();
            }

            // Dynamic Calculator
            if (this.dynamicCalc) {
                this.dynamicCalc.updateSystemValues(currentArea);
            }
        }, 500);
    }

    getSketchArea() {
        // Access the global sketch app instance or DOM to get total area
        // Assuming sketch.js exposes a way to get measurements or we calculate from overlays
        // For this implementation, we'll try to read from the existing 'total-sqft' element if present,
        // or calculate from the sketchApp instance if passed.

        // Fallback: Try to find the total area element from the standard UI
        // Note: The standard UI might be hidden, so we might need to rely on the sketchApp object.
        if (this.sketchApp && this.sketchApp.measurements) {
            return this.sketchApp.measurements.reduce((sum, m) => {
                return m.type === 'polygon' ? sum + (m.area || 0) : sum;
            }, 0);
        }
        return 0;
    }

    calculate() {
        if (this.mode === 'excavation') this.calculateExcavation();
        else if (this.mode === 'snow') this.calculateSnow();
    }

    calculateExcavation() {
        const areaSqFt = parseFloat(document.getElementById('calc-area').value) || 0;
        const depthFt = parseFloat(document.getElementById('calc-depth').value) || 0;
        const swellFactor = parseFloat(document.getElementById('calc-swell').value) || 1;
        const truckCapacityLooseYd = parseFloat(document.getElementById('calc-truck-cap').value) || 1;
        // We might need to add inputs for these if they don't exist in the simple view, or default them:
        const loadTime = parseFloat(document.getElementById('calc-load-time')?.value) || 0;
        const cycleTime = parseFloat(document.getElementById('calc-cycle-time')?.value) || 0;
        const trucks = parseFloat(document.getElementById('calc-trucks')?.value) || 1;

        // Map UI inputs to Core Inputs
        const inputs = {
            areaSqFt,
            depthFt,
            swellFactor,
            truckCapacityLooseYd,
            bucketSizeYd: 1.5, // Default for simple view
            excCycleSec: cycleTime || 25,
            efficiencyPercent: 85,
            haulDistKm: 1, // Default
            haulSpeedKmh: 40, // Default
            dumpWaitMin: 10 // Default
        };

        // If simple view has limited inputs, we trust the core to handle defaults, 
        // but we might need to interpret 'cycleTime' from the UI if it represented something else previously.
        // In the legacy code:
        // const loadsPerHour = trucks * (60 / cycleTime);
        // This implies 'cycleTime' was "Minutes per Load" or similar? 
        // Let's re-read the legacy code: 
        // const cycleTime = parseFloat(document.getElementById('calc-cycle-time').value) || 0;
        // const loadsPerHour = trucks * (60 / cycleTime); 
        // Yes, cycleTime here seems to be "Truck Cycle Time in Minutes".

        // However, the new Core expects `excCycleSec` (Excavator Cycle) and calculates Truck Cycle itself.
        // To maintain "Simple Mode" behavior where user manually enters simplified fleet info:
        // The legacy calculator was very manual.

        // STRATEGY: 
        // Use the Core for Volumes and Loads (which are standard).
        // For Time/Cost, if the UI provided specific "Cycle Time" inputs that don't match the granular Core inputs,
        // we might keep the simple logic OR map it best effort.

        // Let's perform the Core Calculation for Volumes/Loads:
        const results = calculateExcavationMetrics(inputs);

        // UI Updates for Standard outputs
        document.getElementById('res-vol-bank').textContent = `${results.volumes.bankCuYd.toFixed(1)} cy`;
        document.getElementById('res-vol-loose').textContent = `${results.volumes.looseCuYd.toFixed(1)} cy`;
        document.getElementById('res-loads').textContent = results.loads;

        // For Time/Cost in this specific "Simple Calculator" view:
        // The legacy view calculated: const loadsPerHour = trucks * (60 / cycleTime);
        // where cycleTime was likely "Minutes per Round Trip".

        // Let's use the UI's manual inputs for the time estimation to avoid breaking the "Simple" user experience,
        // unless we want to fully upgrade this UI to the "Advanced" view (which is what we moved to the module).

        // Hybrid Approach: Use Core for Vol/Loads, Keep Manual Time logic if inputs are manual
        // OR substitute with Core Duration if we map defaults.

        // Let's keep the manual time logic for now to ensure we don't break the specific UI fields,
        // BUT use the accurate Load count from Core.

        const legacyCycleTime = parseFloat(document.getElementById('calc-cycle-time').value) || 0;
        const loadsPerHour = trucks * (60 / legacyCycleTime);
        const totalHours = loadsPerHour > 0 ? results.loads / loadsPerHour : 0;

        // Mock Rates
        const hourlyRate = 150 + (trucks * 120);
        const totalCost = totalHours * hourlyRate;

        document.getElementById('res-time').textContent = `${totalHours.toFixed(1)} hrs`;
        document.getElementById('res-cost').textContent = `$${totalCost.toFixed(2)}`;

        this.data = {
            area: areaSqFt,
            depth: depthFt,
            swell: swellFactor,
            volBankCy: results.volumes.bankCuYd,
            volLooseCy: results.volumes.looseCuYd,
            loads: results.loads,
            totalHours,
            totalCost
        };
    }

    calculateSnow() {
        const area = parseFloat(document.getElementById('calc-area').value) || 0;
        const efficiency = parseFloat(document.getElementById('calc-efficiency').value) || 1;
        const saltRate = parseFloat(document.getElementById('calc-salt-rate').value) || 0;

        const hours = area / efficiency;
        const saltLbs = (area / 1000) * saltRate;

        // Mock Cost
        const hourlyRate = 150; // Plow truck
        const saltCostPerLb = 0.15;
        const totalCost = (hours * hourlyRate) + (saltLbs * saltCostPerLb);

        document.getElementById('res-time').textContent = `${hours.toFixed(2)} hrs`;
        document.getElementById('res-salt').textContent = `${saltLbs.toFixed(0)} lbs`;
        document.getElementById('res-cost').textContent = `$${totalCost.toFixed(2)}`;

        this.data = { area, hours, saltLbs, totalCost };
    }

    async saveAndReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const estimateId = urlParams.get('estimateId');

        if (!estimateId) {
            alert("No estimate ID found. Cannot save.");
            return;
        }

        if (window.firebaseServices) {
            try {
                const { db, doc, updateDoc, arrayUnion } = window.firebaseServices;
                const estimateRef = doc(db, 'estimates', estimateId);

                // Save as a special line item or calculation record
                let summary = '';
                if (this.mode === 'excavation') {
                    summary = `Excavation: ${(this.data.volBankCy || 0).toFixed(1)} cy, ${(this.data.totalHours || 0).toFixed(1)} hrs`;
                } else if (this.mode === 'snow') {
                    summary = `Snow: ${(this.data.area || 0).toFixed(0)} sqft, ${(this.data.hours || 0).toFixed(2)} hrs`;
                } else if (this.mode === 'custom' && this.config) {
                    // Try to make a smart summary for custom calc
                    summary = `${this.config.name}: See details`;
                    // If we have a cost, show it
                    const costKey = Object.keys(this.data).find(k => k.toLowerCase().includes('cost'));
                    if (costKey) summary += ` ($${(this.data[costKey] || 0).toFixed(2)})`;
                }

                const calculationRecord = {
                    type: this.mode,
                    configId: this.config ? this.config.id : null,
                    date: new Date().toISOString(),
                    data: this.data,
                    summary: summary
                };

                // We might want to save this to a specific field or just update the sketch
                // For now, let's append to a 'calculations' array in the estimate
                await updateDoc(estimateRef, {
                    calculations: arrayUnion(calculationRecord)
                });

                // Redirect back
                window.location.href = `estimator.html?estimateId=${estimateId}&view=editor&section=services`;

            } catch (error) {
                console.error("Error saving calculation:", error);
                alert("Failed to save calculation.");
            }
        }
    }
}
