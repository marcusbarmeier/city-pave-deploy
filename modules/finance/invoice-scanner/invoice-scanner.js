
import { Modal, Button, Input, StatusBadge } from '/ui-components.js';

// --- Constants ---
// Regex patterns for extracting data
const DATE_REGEX = /(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/g;
const AMOUNT_REGEX = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
// Fallback amount regex (looks for numbers with 2 decimals at end of lines)
const AMOUNT_FALLBACK_REGEX = /(\d+\.\d{2})\b/g;

export function renderInvoiceScanner(containerId, onScanComplete) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col items-center justify-center space-y-6 p-4";

    // Icon
    const icon = document.createElement('div');
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;
    wrapper.appendChild(icon);

    // Instructions
    const text = document.createElement('p');
    text.className = "text-center text-gray-600 dark:text-gray-300";
    text.textContent = "Take a clear photo of your invoice or receipt. We'll try to read the date and amount automatically.";
    wrapper.appendChild(text);

    // File Input (Hidden)
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'hidden';
    fileInput.onchange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            await processImage(e.target.files[0], container, onScanComplete);
        }
    };
    wrapper.appendChild(fileInput);

    // Scan Button
    wrapper.appendChild(Button({
        text: 'Select Photo / Camera',
        variant: 'primary',
        className: 'w-full max-w-xs py-3 text-lg',
        onClick: () => fileInput.click()
    }));

    container.appendChild(wrapper);
}

async function processImage(file, container, callback) {
    // Show Loading State
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 space-y-4">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p class="text-blue-600 font-bold animate-pulse">Scanning Invoice...</p>
            <p class="text-xs text-gray-400">This happens locally on your device.</p>
        </div>
    `;

    try {
        // Check if Tesseract is loaded
        if (typeof Tesseract === 'undefined') {
            throw new Error("OCR Library not loaded. Please refresh and try again.");
        }

        // Run OCR
        const { data: { text } } = await Tesseract.recognize(
            file,
            'eng',
            { logger: m => console.log(m) } // Optional: log progress
        );

        console.log("OCR Result:", text);

        // Parse Data
        const extractedData = parseInvoiceData(text);

        // Return data + file to callback
        if (callback) callback({ ...extractedData, file, rawText: text });

    } catch (error) {
        console.error("OCR Error:", error);
        container.innerHTML = `
            <div class="text-center p-4">
                <p class="text-red-500 font-bold mb-2">Scan Failed</p>
                <p class="text-sm text-gray-600 mb-4">${error.message}</p>
                <button class="text-blue-600 underline" onclick="renderInvoiceScanner('${container.id}', ${callback})">Try Again</button>
            </div>
        `;
    }
}

const LINE_ITEM_REGEX = /^\s*(\d+)[xX\s]\s+(.+?)\s+\$?(\d+\.\d{2})/gm;

function parseInvoiceData(text) {
    let date = null;
    let totalAmount = null;
    let items = [];

    // 1. GLOBAL DATE & TOTAL
    const dateMatch = text.match(DATE_REGEX);
    if (dateMatch) date = dateMatch[0];

    // Find Amount - simplified global check
    const allAmounts = text.match(AMOUNT_FALLBACK_REGEX);
    if (allAmounts) {
        // Assume largest is total
        totalAmount = Math.max(...allAmounts.map(n => parseFloat(n)));
    }

    // 2. LINE ITEM PARSING (Smart OCR)
    // Looking for patterns like: "3x Oil Filter 15.00" or "2 Brake Pads 45.50"
    let match;
    while ((match = LINE_ITEM_REGEX.exec(text)) !== null) {
        const qty = parseInt(match[1]);
        const description = match[2].trim();
        const price = parseFloat(match[3]);

        // Filter out obvious noise (too short)
        if (description.length > 2) {
            items.push({
                name: description,
                qty: qty,
                unitPrice: price,
                total: qty * price
            });
        }
    }

    // Fallback if no items found but we have text lines
    if (items.length === 0) {
        // Naive fallback: split by newline, look for prices at end
        const lines = text.split('\n');
        lines.forEach(line => {
            const priceMatch = line.match(/(\d+\.\d{2})$/);
            if (priceMatch) {
                const price = parseFloat(priceMatch[1]);
                const name = line.replace(priceMatch[0], '').replace('$', '').trim();
                if (name.length > 3) {
                    items.push({ name: name, qty: 1, unitPrice: price, total: price });
                }
            }
        });
    }

    // Sanity check total
    const calcTotal = items.reduce((sum, i) => sum + i.total, 0);
    if (!totalAmount || calcTotal > totalAmount) {
        totalAmount = calcTotal;
    }

    return {
        date: date || new Date().toLocaleDateString(),
        amount: totalAmount || 0,
        description: `Invoice with ${items.length} items`,
        items: items // [NEW] Structured items
    };
}
