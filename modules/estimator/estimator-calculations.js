// estimator-calculations.js
// Pricing and calculation logic for the City Pave Estimator.

import { formatCurrency } from './estimator-utils.js';
// updateFinancialSummary passed as callback to avoid circular dependency
// We might need to move updateFinancialSummary here or pass it as a callback.
// For now, let's try to keep updateFinancialSummary in UI and pass it to calculateAllTotals if needed, 
// OR move updateFinancialSummary here. 
// updateFinancialSummary accesses DOM, so it fits in UI.
// calculateAllTotals ALSO accesses DOM.
// Ideally, both should be in the same "View Controller" file, or split strictly by Logic vs DOM.
// Given the constraints, I will import updateFinancialSummary from UI. 
// If that causes a cycle (UI imports Calculations, Calculations imports UI), we have a problem.
// UI imports Calculations to call calculateAllTotals.
// Calculations imports UI to call updateFinancialSummary.
// CYCLE DETECTED.

// SOLUTION: Pass updateFinancialSummary as a callback to calculateAllTotals.

export function getTaxRate() {
    // Fetches live tax rate from DB, defaults to 5%
    return window.pricingData ? window.pricingData.taxRate : 0.05;
}

export function calculateTonnage(sqft, thickness) {
    if (!sqft || !thickness || thickness === 'none') return 0;
    const sqftNum = parseFloat(sqft) || 0;
    if (sqftNum === 0) return 0;
    switch (thickness) {
        case '3-inch': return sqftNum / 55;
        case '4-inch': return sqftNum / 40;
        case '6-inch': return sqftNum / 27.5;
        case '8-inch': return sqftNum / 20;
        default: return 0;
    }
}

export function getFuelSurchargeMultiplier() {
    const data = window.pricingData?.fuel;
    if (!data || !data.isActive) return 0;

    const base = data.baselinePrice || 0;
    const current = data.currentPrice || 0;
    const threshold = data.threshold || 0.05;
    const rate = data.surchargeRate || 0; // e.g. 1.5 (%)

    const diff = current - base;
    if (diff <= 0) return 0;

    const steps = Math.floor(diff / threshold);
    const surchargePercent = steps * rate;
    return surchargePercent / 100; // Return as decimal (e.g. 0.045)
}

export function calculateOptionSubtotal(optionId) {
    let subtotal = 0;
    const fuelMultiplier = getFuelSurchargeMultiplier();

    document.querySelectorAll(`#${optionId} .line-item-container`).forEach(row => {
        const units = parseFloat(row.querySelector('.units-input')?.value) || 0;
        const price = parseFloat(row.querySelector('.price-input')?.value) || 0;
        let lineTotal = units * price;

        // --- DYNAMIC FUEL ---
        if (row.dataset.consumesFuel === "true") {
            lineTotal += lineTotal * fuelMultiplier;
        }
        // --------------------

        subtotal += lineTotal;
    });
    return subtotal;
}

export function calculateAllTotals(saveState, updateFinancialSummaryCallback) {
    const table = document.getElementById('comparison-table');
    if (!table) return;

    const activeOptions = [];

    document.querySelectorAll('#pricing-options-container .price-option-card').forEach(card => {
        const optionSubtotal = calculateOptionSubtotal(card.dataset.optionId);
        const firstColorPicker = card.querySelector('.item-color-picker');
        const color = firstColorPicker ? firstColorPicker.value : '#cccccc';

        activeOptions.push({
            id: card.dataset.optionId,
            title: card.querySelector('.option-title-input').value,
            subtotal: optionSubtotal,
            color: color
        });

        const currentTaxRate = getTaxRate();
        const optionGst = optionSubtotal * currentTaxRate;
        const optionTotal = optionSubtotal + optionGst;

        const subtotalEl = card.querySelector('.option-subtotal');
        const gstEl = card.querySelector('.option-gst');
        const totalEl = card.querySelector('.option-total');

        if (subtotalEl) subtotalEl.textContent = formatCurrency(optionSubtotal);
        if (gstEl) gstEl.textContent = formatCurrency(optionGst);
        if (totalEl) totalEl.textContent = formatCurrency(optionTotal);
    });

    const sketchSubtotal = calculateOptionSubtotal('sketch-card');
    if (sketchSubtotal > 0) {
        const firstSketchColor = document.querySelector('#sketch-card .item-color-picker');
        const sketchColor = firstSketchColor ? firstSketchColor.value : '#cccccc';
        activeOptions.push({ id: 'sketch', title: 'Sketch Pricing', subtotal: sketchSubtotal, color: sketchColor });
    }

    const changeOrderSubtotal = calculateOptionSubtotal('change-order-card');
    const changeOrderEnabled = document.getElementById('change-order-checkbox')?.checked;
    if (changeOrderSubtotal > 0 && changeOrderEnabled) {
        const firstChangeOrderColor = document.querySelector('#change-order-card .item-color-picker');
        const changeOrderColor = firstChangeOrderColor ? firstChangeOrderColor.value : '#cccccc';
        activeOptions.push({ id: 'change-order', title: 'Change Order', subtotal: changeOrderSubtotal, color: changeOrderColor });
    }

    const depositRate = (parseFloat(document.getElementById('deposit-rate-input')?.value) || 40) / 100;
    const currentTaxRate = getTaxRate();

    if (table.querySelector('thead')) {
        table.querySelector('thead').innerHTML = `<tr><th class="p-2 font-semibold">Description</th>${activeOptions.map(opt => `
        <th class="p-2 font-semibold text-right align-bottom">
            <div style="width: 100%; height: 10px; background-color: ${opt.color || '#ccc'}; border-radius: 3px; border: 1px solid rgba(0,0,0,0.1); margin-bottom: 4px;"></div>
            ${opt.title}
        </th>
      `).join('')}</tr>`;
    }

    let subtotalRowHtml = `<tr><td class="p-2 font-medium">Subtotal</td>`;
    let taxRowHtml = `<tr><td class="p-2 font-medium">GST (${(currentTaxRate * 100).toFixed(0)}%)</td>`;
    let totalRowHtml = `<tr><td class="p-2 font-bold text-lg">Total</td>`;
    let depositRowHtml = `<tr><td class="p-2 font-medium">Deposit Due (${(depositRate * 100)}%)</td>`;

    activeOptions.forEach(opt => {
        const tax = opt.subtotal * currentTaxRate;
        const total = opt.subtotal + tax;
        const deposit = total * depositRate;
        subtotalRowHtml += `<td class="p-2 text-right">${formatCurrency(opt.subtotal)}</td>`;
        taxRowHtml += `<td class="p-2 text-right">${formatCurrency(tax)}</td>`;
        totalRowHtml += `<td class="p-2 text-right font-bold text-lg">${formatCurrency(total)}</td>`;
        depositRowHtml += `<td class="p-2 text-right">${formatCurrency(deposit)}</td>`;
    });

    const selectedOptionIds = Array.from(document.querySelectorAll('.option-choice-checkbox:checked')).map(cb => cb.value);
    let acceptanceRowHtml = `<tr class="no-print"><td class="p-2 font-medium">Select to Accept</td>`;
    activeOptions.forEach(opt => {
        acceptanceRowHtml += `<td class="p-2 text-right"><input type="checkbox" name="option-choice" value="${opt.id}" class="h-5 w-5 option-choice-checkbox" ${selectedOptionIds.includes(opt.id) ? 'checked' : ''}></td>`;
    });

    if (table.querySelector('tbody')) {
        table.querySelector('tbody').innerHTML = `${subtotalRowHtml}</tr>${taxRowHtml}</tr>${totalRowHtml}</tr>${depositRowHtml}</tr>${acceptanceRowHtml}</tr>`;
    }

    let selectedSubtotal = 0;
    selectedOptionIds.forEach(optionId => {
        const foundOption = activeOptions.find(opt => opt.id === optionId);
        if (foundOption) selectedSubtotal += foundOption.subtotal;
    });

    const selectedTotal = selectedSubtotal * (1 + currentTaxRate);
    document.getElementById('summary-grand-total').textContent = formatCurrency(selectedTotal);

    // --- STRATEGIST: Humble Brag Trigger ---
    if (selectedTotal > 15000 && !window.hasShownHumbleBrag) {
        window.hasShownHumbleBrag = true;
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-purple-600 text-white p-4 rounded-lg shadow-xl z-50 flex items-center gap-4 animate-bounce';
        toast.innerHTML = `
            <div>
                <h4 class="font-bold text-sm">🚀 High Value Job! ($${(selectedTotal / 1000).toFixed(1)}k+)</h4>
                <p class="text-xs">Great work! You should draft a social post for this one.</p>
            </div>
            <button class="text-white hover:text-gray-200 font-bold text-xl">&times;</button>
        `;
        toast.querySelector('button').onclick = () => toast.remove();
        document.body.appendChild(toast);
        // Auto remove after 10s
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, 10000);
    }
    // ---------------------------------------

    if (updateFinancialSummaryCallback) {
        updateFinancialSummaryCallback(saveState);
    }

    // Re-attach listeners to the new checkboxes
    document.querySelectorAll('.option-choice-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            calculateAllTotals(saveState, updateFinancialSummaryCallback);
            if (saveState) saveState();
        });
    });
}
