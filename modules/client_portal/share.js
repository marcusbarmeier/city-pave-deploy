// © 2025 City Pave. All Rights Reserved.
// Filename: share.js
import { generatePrintableEstimateHTML } from './outputGenerator.js';

let signaturePad = null;
let witnessSignaturePad = null;

// Debounce utility for resizing
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Function to resize a specific canvas correctly
function resizeSignatureCanvas(canvas, pad) {
    if (!canvas || !pad) return;
    // --- Check if canvas is actually visible before resizing ---
    if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = pad.toData(); // Save current signature data
    // --- Set physical canvas size based on CSS size ---
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    // --- Scale the drawing context ---
    canvas.getContext("2d").scale(ratio, ratio);
    // --- Clear and restore signature ---
    pad.clear();
    pad.fromData(data);
}


// REPLACE this function in share.js
// REPLACE this function in share.js
async function displayEstimate() {
    // --- ADDED GUARD CONDITION ---
    const container = document.getElementById('estimate-container');
    if (!container) {
        // If the main container for share.html doesn't exist, stop execution.
        // This prevents share.js from running unnecessarily on other pages like sketch.html
        console.warn("share.js executed on a page without '#estimate-container'. Aborting.");
        return;
    }
    // --- END GUARD CONDITION ---

    // Make sure addDoc is destructured here (assuming window.firebaseServices is set up correctly)
    const { db, collection, doc, getDoc, query, where, getDocs, updateDoc, addDoc } = window.firebaseServices || {};
    // Check if Firebase services loaded correctly
    if (!db || typeof addDoc !== 'function') {
        console.error("Firebase services (including addDoc) not available in share.js");
        container.innerHTML = `<p class="text-center text-red-600 font-semibold py-20">Error: Required services failed to load.</p>`;
        return; // Stop if services aren't ready
    }

    const acceptanceContainer = document.getElementById('acceptance-section-container');
    const acceptanceForm = document.getElementById('acceptance-form');
    const successDiv = document.getElementById('acceptance-success');

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
            throw new Error("This link is missing an access token.");
        }

        const linksCollection = collection(db, 'sharedLinks');
        const q = query(linksCollection, where("token", "==", token));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("This share link is invalid or has been removed.");
        }

        const linkDoc = querySnapshot.docs[0];
        const linkData = linkDoc.data();

        // --- Record Link View (Uses addDoc) ---
        try {
            const viewsCollection = collection(linkDoc.ref, 'linkViews');
            await addDoc(viewsCollection, {
                timestamp: new Date(),
                referrer: document.referrer || "Direct link or private",
                userAgent: navigator.userAgent
            });
        } catch (trackError) {
            console.error("Failed to record link view:", trackError);
        }
        // --- End Record Link View ---


        if (!linkData.isActive) {
            throw new Error("Access to this estimate has been revoked.");
        }

        const estimateId = linkData.estimateId;
        const estimateRef = doc(db, 'estimates', estimateId);
        const estimateSnap = await getDoc(estimateRef); // This might fail due to permissions if rules weren't deployed

        if (!estimateSnap.exists()) {
            throw new Error("The requested estimate could not be found.");
        }

        const estimateData = { id: estimateSnap.id, ...estimateSnap.data() };

        // Generate and display the main estimate content
        const estimateHTML = generatePrintableEstimateHTML(estimateData, { hideAcceptance: true });
        container.innerHTML = estimateHTML; // This line caused the error if container was null

        const isAccepted = estimateData.acceptance?.signatureDataURL || estimateData.acceptance?.signedCopyURL;
        const permission = estimateData.sharingOptions?.permission || 'none';
        let allowDownload = (permission === 'immediate') || (permission === 'afterSigning' && isAccepted);

        // Only show the separate interactive acceptance container if NOT already accepted
        if (!isAccepted) {
            acceptanceContainer.classList.remove('hidden');
            acceptanceForm.classList.remove('hidden');
            successDiv.classList.add('hidden');
            initializeAcceptanceForm(estimateId, estimateRef); // Initialize pads only if needed
        } else {
            acceptanceContainer.classList.add('hidden');
            acceptanceForm.classList.add('hidden');
            successDiv.classList.add('hidden');
        }

        // Setup Download/Print buttons
        const printContainer = document.getElementById('print-link-container');
        printContainer.innerHTML = '';

        if (allowDownload) {
            const printButton = document.createElement('button');
            printButton.textContent = 'Download / Print Proposal';
            printButton.className = 'px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700';
            printButton.onclick = () => {
                const printableHtml = generatePrintableEstimateHTML(estimateData);
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write('<!DOCTYPE html><html><head><title>Print Estimate</title></head><body>');
                    printWindow.document.write(printableHtml);
                    printWindow.document.write('</body></html>');
                    printWindow.document.close();
                    printWindow.onload = () => {
                        try { printWindow.print(); } catch (e) { console.error("Print failed:", e); printWindow.alert("Could not print automatically. Please use browser print function."); }
                    };
                } else { alert("Could not open print window. Check pop-up blocker."); }
            };
            printContainer.appendChild(printButton);

            if (isAccepted && estimateData.acceptance?.signedCopyURL) {
                const scanLink = document.createElement('a');
                scanLink.href = estimateData.acceptance.signedCopyURL;
                scanLink.target = '_blank';
                scanLink.textContent = 'Download Signed Contract';
                scanLink.className = 'ml-4 px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700';
                printContainer.appendChild(scanLink);
            }
            if (permission === 'immediate' && !isAccepted) {
                const notice = document.createElement('p');
                notice.className = 'text-xs text-gray-600 mt-3 text-center w-full';
                notice.innerHTML = '<b>Confidential:</b> This document is for internal review purposes only.';
                printContainer.appendChild(notice);
            }
        } else {
            if (!isAccepted && permission === 'afterSigning') {
                const notice = document.createElement('p');
                notice.className = 'text-xs text-gray-600 text-center w-full';
                notice.textContent = 'Download will be available after signing.';
                printContainer.appendChild(notice);
            }
        }

    } catch (error) {
        console.error("Error displaying estimate:", error); // Log the actual error
        // Display a user-friendly message, potentially differentiating permission errors
        if (error.code === 'permission-denied') {
            container.innerHTML = `<p class="text-center text-red-600 font-semibold py-20">Error: Could not load estimate details due to permission issues. Please ensure Firestore rules allow public read access for estimates.</p>`;
        } else {
            container.innerHTML = `<p class="text-center text-red-600 font-semibold py-20">Error loading estimate: ${error.message}</p>`;
        }
        if (acceptanceContainer) acceptanceContainer.classList.add('hidden'); // Also hide acceptance on error
    }
}


function initializeAcceptanceForm(estimateId, estimateRef) {
    const mainCanvas = document.getElementById('signature-pad');
    const witnessCanvas = document.getElementById('witness-signature-pad');
    if (!mainCanvas || !witnessCanvas) {
        console.error("Signature canvases not found!");
        return;
    }

    // Initialize SignaturePads only if they haven't been already
    if (!signaturePad) {
        signaturePad = new SignaturePad(mainCanvas, { backgroundColor: 'rgb(249, 250, 251)' });
    } else {
        signaturePad.clear(); // Clear existing pad if re-initializing
    }
    if (!witnessSignaturePad) {
        witnessSignaturePad = new SignaturePad(witnessCanvas, { backgroundColor: 'rgb(249, 250, 251)' });
    } else {
        witnessSignaturePad.clear(); // Clear existing pad if re-initializing
    }

    // Debounced resize function
    const debouncedResize = debounce(() => {
        resizeSignatureCanvas(mainCanvas, signaturePad);
        resizeSignatureCanvas(witnessCanvas, witnessSignaturePad);
    }, 250);

    // Call resize initially after a short delay to ensure layout is stable
    setTimeout(() => debouncedResize(), 150);

    // Remove previous listener before adding a new one
    window.removeEventListener("resize", debouncedResize);
    window.addEventListener("resize", debouncedResize);

    // --- Ensure button listeners are only added once ---
    const clearSigBtn = document.getElementById('clear-signature-btn');
    const clearWitnessSigBtn = document.getElementById('clear-witness-signature-btn');
    const acceptBtn = document.getElementById('accept-proposal-btn');

    // Remove potential old listeners before adding new ones
    clearSigBtn.replaceWith(clearSigBtn.cloneNode(true));
    clearWitnessSigBtn.replaceWith(clearWitnessSigBtn.cloneNode(true));
    acceptBtn.replaceWith(acceptBtn.cloneNode(true));

    // Add new listeners
    document.getElementById('clear-signature-btn').addEventListener('click', () => {
        if (signaturePad) signaturePad.clear();
    });
    document.getElementById('clear-witness-signature-btn').addEventListener('click', () => {
        if (witnessSignaturePad) witnessSignaturePad.clear();
    });
    document.getElementById('accept-proposal-btn').addEventListener('click', async () => {
        // Ensure pads are still valid before proceeding
        if (!signaturePad || !witnessSignaturePad) {
            console.error("Signature pads not initialized correctly.");
            alert("Error: Signature component not ready. Please refresh.");
            return;
        }
        await handleAcceptance(estimateId, estimateRef);
    });
    // --- End ensure listeners added once ---


    // Set default date
    const dateInput = document.getElementById('acceptance-date');
    if (dateInput && !dateInput.value) { // Only set if not already filled
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
}


async function handleAcceptance(estimateId, estimateRef) {
    const { updateDoc } = window.firebaseServices;
    const acceptBtn = document.getElementById('accept-proposal-btn');

    // Add checks for pads existing before calling isEmpty
    if (!signaturePad || signaturePad.isEmpty()) {
        alert("Please provide your signature to accept the proposal.");
        return;
    }
    if (!witnessSignaturePad || witnessSignaturePad.isEmpty()) {
        alert("A witness signature is required.");
        return;
    }

    acceptBtn.disabled = true;
    acceptBtn.textContent = 'Submitting...';

    try {
        const signatureDataURL = signaturePad.toDataURL('image/png');
        const witnessSignatureDataURL = witnessSignaturePad.toDataURL('image/png');
        const acceptanceDate = document.getElementById('acceptance-date').value;
        const printedName = document.getElementById('print-name').value;
        const witnessPrintedName = document.getElementById('witness-print-name').value;
        const additionalInfo = document.getElementById('additional-information').value;

        // Prepare the update payload using dot notation for nested fields
        const updatePayload = {
            "acceptance.signatureDataURL": signatureDataURL,
            "acceptance.witnessSignatureDataURL": witnessSignatureDataURL,
            "acceptance.acceptanceDate": acceptanceDate,
            "acceptance.printedName": printedName,
            "acceptance.witnessPrintedName": witnessPrintedName,
            "customerNotes": additionalInfo || "", // Use empty string if no info
            "status": "Accepted",
            "lastSaved": new Date().toISOString()
        };

        await updateDoc(estimateRef, updatePayload);

        // --- Refresh the view AFTER successful update ---
        // This will now hide the acceptance form and show the static content + download links
        await displayEstimate();
        // --- End Refresh ---

        // Optional: Scroll to top or to the acceptance section in the main content
        // document.getElementById('estimate-container').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error("Error submitting acceptance:", error);
        alert(`An error occurred while submitting your acceptance. Please try again. Error: ${error.message}`);
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'Accept & Sign Proposal';
    }
}


// Initial call to load and display the estimate
window.displayEstimate = displayEstimate;