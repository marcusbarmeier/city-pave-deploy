
// modules/expense_manager/expense-ui.js

import { Modal, Button, Input, StatusBadge } from '../../ui-components.js';

const ALL_PAYMENT_METHODS = [
    { value: 'Payroll', label: 'Payroll Addition', icon: '🏦' },
    { value: 'Direct Deposit', label: 'Direct Deposit', icon: '💸' },
    { value: 'e-Transfer', label: 'Interac e-Transfer', icon: '📧' },
    { value: 'Cheque', label: 'Physical Cheque', icon: '📝' },
    { value: 'Cash', label: 'Petty Cash', icon: '💵' }
];

let allowedMethods = ['Payroll']; // Default fallback

async function loadAllowedPaymentMethods() {
    if (!window.firebaseServices) return;
    const { db, doc, getDoc } = window.firebaseServices;
    try {
        const docRef = doc(db, "settings", "finance");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            allowedMethods = snap.data().allowedRepaymentMethods || ['Payroll'];
        }
    } catch (e) { console.warn("Using default payment methods", e); }
}

export async function renderExpenseFormUI(container, currentType, onTypeChange, onSubmit) {
    if (!container) return;

    // Fetch settings first (if not cached or force refresh?)
    // For specific requirement, we fetch every time or rely on global? 
    // Let's fetch once per render to be safe.
    await loadAllowedPaymentMethods();

    container.innerHTML = '';

    // 1. Type Toggle
    const toggleContainer = document.createElement('div');
    toggleContainer.className = "flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-6";

    const createBtn = (text, type) => {
        const btn = document.createElement('button');
        btn.className = `flex-1 py-2 text-sm font-medium rounded-md transition-all ${currentType === type ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`;
        btn.textContent = text;
        btn.onclick = () => onTypeChange(type);
        return btn;
    };

    toggleContainer.appendChild(createBtn('Receipt', 'receipt'));
    toggleContainer.appendChild(createBtn('Mileage', 'mileage'));
    container.appendChild(toggleContainer);

    // 2. Form Content
    const formContainer = document.createElement('div');
    formContainer.id = 'expense-form-content';

    if (currentType === 'receipt') {
        formContainer.appendChild(createReceiptForm(onSubmit));
    } else {
        formContainer.appendChild(createMileageForm(onSubmit));
    }

    container.appendChild(formContainer);
}

function createReceiptForm(onSubmit) {
    const form = document.createElement('form');
    form.className = 'space-y-5';
    form.onsubmit = (e) => onSubmit(e, 'receipt');

    // Job Selector
    const jobContainer = document.createElement('div');
    jobContainer.innerHTML = `
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link to Job (Optional)</label>
        <select id="exp-job-select" class="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5">
            <option value="">-- General Expense --</option>
            <option disabled>Loading jobs...</option>
        </select>
    `;
    form.appendChild(jobContainer);

    form.appendChild(Input({ label: 'Description', id: 'exp-desc', placeholder: 'e.g. Gas for Unit 101', required: true }));
    form.appendChild(Input({ label: 'Amount ($)', id: 'exp-amount', type: 'number', placeholder: '0.00', required: true, step: '0.01' }));
    form.appendChild(createPaymentMethodSelect());

    // Photo
    const photoContainer = document.createElement('div');
    photoContainer.innerHTML = `
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Photo of Receipt</label>
        <input type="file" id="exp-photo" accept="image/*" required class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
    `;
    form.appendChild(photoContainer);

    form.appendChild(Button({ text: 'Submit Receipt', type: 'submit', variant: 'primary', className: 'w-full justify-center mt-4' }));

    return form;
}

function createMileageForm(onSubmit) {
    const form = document.createElement('form');
    form.className = 'space-y-5';
    form.onsubmit = (e) => onSubmit(e, 'mileage');

    form.appendChild(Input({ label: 'Vehicle', id: 'mil-vehicle', placeholder: 'e.g. Personal Truck', required: true }));

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-4';

    // We create inputs manually to attach events easily if needed, or stick to Input helper
    const startInput = Input({ label: 'Start Odometer', id: 'mil-start', type: 'number', required: true });
    const endInput = Input({ label: 'End Odometer', id: 'mil-end', type: 'number', required: true });

    // Auto-calc logic attached in App or here? 
    // UI logic is better handled here if strictly DOM manipulation
    const calc = () => {
        const s = parseFloat(document.getElementById('mil-start').value) || 0;
        const e = parseFloat(document.getElementById('mil-end').value) || 0;
        const total = Math.max(0, e - s);
        document.getElementById('mil-total-display').textContent = `Total Distance: ${total.toFixed(1)} km`;
    };

    // We accept that Input helper returns a div wrapping the input, so we use event delegation or attach after connection?
    // Adaptation: simple inline handler for now
    startInput.addEventListener('input', calc);
    endInput.addEventListener('input', calc);

    grid.appendChild(startInput);
    grid.appendChild(endInput);
    form.appendChild(grid);

    const totalDisplay = document.createElement('p');
    totalDisplay.id = 'mil-total-display';
    totalDisplay.className = 'text-center font-bold text-lg text-slate-700 dark:text-slate-300';
    totalDisplay.textContent = 'Total Distance: 0.0 km';
    form.appendChild(totalDisplay);

    form.appendChild(createPaymentMethodSelect());
    form.appendChild(Button({ text: 'Submit Mileage', type: 'submit', variant: 'primary', className: 'w-full justify-center mt-4' }));

    return form;
}

function createPaymentMethodSelect() {
    const methodsToShow = ALL_PAYMENT_METHODS.filter(m => allowedMethods.includes(m.value));

    // If config mismatch, show at least one default
    if (methodsToShow.length === 0) methodsToShow.push(ALL_PAYMENT_METHODS[0]);

    const container = document.createElement('div');
    container.innerHTML = `
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Reimbursement Method</label>
        <select id="exp-payment-method" class="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5">
            ${methodsToShow.map(m => `<option value="${m.value}">${m.icon} ${m.label}</option>`).join('')}
        </select>
    `;
    return container;
}

export function populateJobSelect(jobs) {
    const select = document.getElementById('exp-job-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- General Expense --</option>';
    jobs.forEach(job => {
        const opt = document.createElement('option');
        opt.value = job.id;
        opt.textContent = job.name || "Unnamed Job";
        select.appendChild(opt);
    });
}
