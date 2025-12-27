/**
 * dynamic-calculator.js
 * Handles the logic and UI for Custom/Dynamic calculators defined by JSON configuration.
 */

import { CalculatorRunner } from '../custom_calc/calc-runner.js';

export class DynamicCalculator {
    constructor(manager, config) {
        this.manager = manager; // Reference to CalculatorManager
        this.config = config;
        this.container = manager.container;
        this.runner = null;
    }

    render() {
        // Initialize Runner
        // The runner handles UI rendering and calculations
        this.runner = new CalculatorRunner(this.container, this.config);

        // Hook into updates to sync data back to Manager
        this.runner.onUpdate = (data) => {
            this.manager.data = data;
        };

        this.runner.init();

        // Re-inject "Save" button into the footer created by the runner, 
        // or ensure the runner supports a specific 'Sketch Mode'.
        // The current Runner creates a footer container but we might want to override the button behavior.
        // Actually, the Runner UI creates no buttons by default? 
        // Let's check calc-ui.js... it DOES NOT create a save button. 
        // Wait, looking at dynamic-calculator.js original code, it DID create a save button.
        // The new `calc-ui.js` does NOT create a save button (I should check that).

        // Let's modify the UI module or inject it here.
        this.injectSaveButton();
    }

    injectSaveButton() {
        const resultsContainer = document.getElementById('cc-results-container');
        if (resultsContainer && !document.getElementById('calc-save-btn')) {
            const footer = document.createElement('div');
            footer.className = "p-4 border-t border-gray-200 bg-gray-50 mt-4";
            footer.innerHTML = `
                <button id="calc-save-btn" class="w-full py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-sm">Save & Return to Estimator</button>
             `;
            this.container.appendChild(footer); // Append to main container

            document.getElementById('calc-save-btn').addEventListener('click', () => this.manager.saveAndReturn());
        }
    }

    updateSystemValues(sketchArea) {
        // Proxy to runner
        if (this.runner) {
            this.runner.updateSystemInput('area', sketchArea);
        }
    }
}
