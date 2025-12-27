
/**
 * calc-runner.js
 * Orchestrates the UI and Core logic.
 */
import { renderCalculator, getInputsFromUI, updateResultsUI } from './calc-ui.js';
import { runCalculations } from './calc-core.js';

export class CalculatorRunner {
    constructor(container, config) {
        this.container = container;
        this.config = config;
        this.data = {};
        this.onUpdate = null; // Callback
    }

    init() {
        renderCalculator(this.container, this.config);
        this.bindEvents();
        this.calculate();
    }

    bindEvents() {
        this.container.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                this.calculate();
            }
        });
    }

    calculate() {
        const inputs = getInputsFromUI(this.config);
        const results = runCalculations(this.config, inputs);

        updateResultsUI(results, this.config);

        this.data = { ...inputs, ...results };

        if (this.onUpdate) this.onUpdate(this.data);
    }

    // specific method for external system updates (like Maps Area)
    updateSystemInput(id, value) {
        const el = document.getElementById(`cc-inp-${id}`);
        if (el && parseFloat(el.value) !== value) {
            el.value = typeof value === 'number' ? value.toFixed(2) : value;
            this.calculate();
        }
    }
}
