// © 2025 City Pave. All Rights Reserved.
// Filename: forms.js

// --- FORM DEFINITIONS ---
const FORM_TEMPLATES = {
    'pre-trip': {
        title: "Pre-Trip Inspection",
        fields: [
            { id: "vehicle_id", type: "text", label: "Vehicle / Unit #" },
            { id: "mileage", type: "number", label: "Odometer Reading" },
            { id: "fluids", type: "checkbox", label: "Fluids (Oil, Coolant, Washer)" },
            { id: "tires", type: "checkbox", label: "Tires (Pressure & Tread)" },
            { id: "lights", type: "checkbox", label: "Lights & Signals" },
            { id: "brakes", type: "checkbox", label: "Brakes & Air Systems" },
            { id: "circle_check", type: "checkbox", label: "360 Circle Check Complete" },
            { id: "defects", type: "textarea", label: "Defects Found (if any)" },
            { id: "media", type: "media", label: "Photos / Videos of Defects" } // Changed to 'media'
        ]
    },
    'mid-trip': {
        title: "Mid-Trip / Load Check",
        fields: [
            { id: "vehicle_id", type: "text", label: "Vehicle / Unit #" },
            { id: "location", type: "text", label: "Inspection Location (Hwy/City)" },
            { id: "cargo", type: "checkbox", label: "Load/Cargo Securement Checked" },
            { id: "tires_hubs", type: "checkbox", label: "Tires & Hubs (Heat/Pressure)" },
            { id: "lights", type: "checkbox", label: "Lights Clean & Working" },
            { id: "connections", type: "checkbox", label: "Hitch/Coupling Secure" },
            { id: "defects", type: "textarea", label: "Issues Found (if any)" },
            { id: "media", type: "media", label: "Photo of Load / Issues" }
        ]
    },
    'post-trip': {
        title: "Post-Trip Inspection",
        fields: [
            { id: "vehicle_id", type: "text", label: "Vehicle / Unit #" },
            { id: "end_mileage", type: "number", label: "Ending Odometer" },
            { id: "brakes_park", type: "checkbox", label: "Parking Brake Applied" },
            { id: "lights_off", type: "checkbox", label: "Lights Turned Off" },
            { id: "clean_cab", type: "checkbox", label: "Cab Cleaned / Garbage Removed" },
            { id: "walkaround", type: "checkbox", label: "Final Walkaround Complete" },
            { id: "defects", type: "textarea", label: "New Defects (if any)" },
            { id: "media", type: "media", label: "Photos of Defects / Parked Position" }
        ]
    },
    'hazard': {
        title: "Field Level Hazard Assessment",
        fields: [
            { id: "site_address", type: "text", label: "Job Site Location" },
            { id: "overhead", type: "checkbox", label: "Overhead Powerlines Identified?" },
            { id: "ground", type: "checkbox", label: "Ground Conditions Stable?" },
            { id: "traffic", type: "checkbox", label: "Traffic Control Required?" },
            { id: "ppe", type: "checkbox", label: "All PPE Worn?" },
            { id: "hazards", type: "textarea", label: "List Specific Hazards & Controls" },
            { id: "media", type: "media", label: "Site Photos (Hazards/Controls)" }
        ]
    },
    'incident': {
        title: "Incident Report",
        fields: [
            { id: "date_time", type: "datetime-local", label: "Date & Time of Incident" },
            { id: "location", type: "text", label: "Location Description" },
            { id: "description", type: "textarea", label: "Describe what happened" },
            { id: "injury", type: "checkbox", label: "Was anyone injured?" },
            { id: "damage", type: "checkbox", label: "Was equipment damaged?" },
            { id: "media", type: "media", label: "Photos/Videos of Scene" }
        ]
    }
};

export function initializeFormsApp() {
    window.loadForm = loadForm;
    window.closeForm = closeForm;
    document.getElementById('submit-form-btn').addEventListener('click', submitForm);

    const urlParams = new URLSearchParams(window.location.search);
    const autoForm = urlParams.get('auto');
    if (autoForm && FORM_TEMPLATES[autoForm]) {
        loadForm(autoForm);
    }
}

let currentFormId = null;

function loadForm(formId) {
    const template = FORM_TEMPLATES[formId];
    if (!template) return;

    currentFormId = formId;
    document.getElementById('form-menu').classList.add('hidden');
    document.getElementById('form-container').classList.remove('hidden');
    document.getElementById('form-title').textContent = template.title;

    const form = document.getElementById('dynamic-form');
    form.innerHTML = '';

    template.fields.forEach(field => {
        const wrapper = document.createElement('div');
        const label = document.createElement('label');
        label.className = "block text-sm font-bold text-gray-700 mb-1";
        label.textContent = field.label;
        wrapper.appendChild(label);

        let input;

        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.className = "w-full p-3 border rounded-lg bg-white text-sm";
            input.rows = 3;
            input.id = field.id;
            wrapper.appendChild(input);
        } else if (field.type === 'checkbox') {
            label.className = "inline-flex items-center";
            label.innerHTML = `<input type="checkbox" id="${field.id}" class="form-checkbox h-5 w-5 text-blue-600"><span class="ml-2 text-gray-700">${field.label}</span>`;
            wrapper.innerHTML = '';
            wrapper.appendChild(label);
        } else if (field.type === 'media') { // NEW: Multi-file input
            input = document.createElement('input');
            input.type = 'file';
            input.id = field.id;
            input.multiple = true; // Allow multiple
            input.accept = 'image/*,video/*'; // Allow videos
            input.className = "block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100";

            const previewContainer = document.createElement('div');
            previewContainer.id = `${field.id}-preview`;
            previewContainer.className = "mt-2 grid grid-cols-3 gap-2";

            input.addEventListener('change', (e) => showPreview(e, previewContainer));

            wrapper.appendChild(input);
            wrapper.appendChild(previewContainer);
        } else {
            input = document.createElement('input');
            input.type = field.type;
            input.className = "w-full p-3 border rounded-lg bg-white text-sm";
            input.id = field.id;
            wrapper.appendChild(input);
        }

        form.appendChild(wrapper);
    });
}

function showPreview(event, container) {
    container.innerHTML = '';
    Array.from(event.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            let el;
            if (file.type.startsWith('video')) {
                el = document.createElement('video');
                el.src = e.target.result;
                el.className = "h-20 w-full object-cover rounded border";
            } else {
                el = document.createElement('img');
                el.src = e.target.result;
                el.className = "h-20 w-full object-cover rounded border";
            }
            container.appendChild(el);
        };
        reader.readAsDataURL(file);
    });
}

function closeForm() {
    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('form-menu').classList.remove('hidden');
    document.getElementById('dynamic-form').innerHTML = '';
    currentFormId = null;
}

// --- GPS HELPER ---
function getCurrentPosition() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) resolve(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => { console.warn("GPS Error:", err); resolve(null); },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
}

async function submitForm(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-form-btn');
    btn.disabled = true;
    btn.textContent = "Acquiring GPS & Uploading...";

    const { db, collection, addDoc, storage, ref, uploadBytes, getDownloadURL, auth } = window.firebaseServices;
    const user = auth.currentUser;

    if (!user) {
        alert("Error: Not logged in.");
        btn.disabled = false;
        return;
    }

    try {
        // 1. Get Location ONCE for the whole submission
        const location = await getCurrentPosition();

        const template = FORM_TEMPLATES[currentFormId];
        let formData = {
            formType: currentFormId,
            formTitle: template.title,
            userId: user.uid,
            userName: user.displayName || "Crew Member",
            submittedAt: new Date().toISOString(),
            location: location, // Save Global Form Location
            data: {}
        };

        let defectsFound = false;
        let defectDescription = "";
        let mediaItems = [];

        for (const field of template.fields) {
            const el = document.getElementById(field.id);
            if (!el) continue;

            if (field.type === 'checkbox') {
                formData.data[field.id] = el.checked;
            } else if (field.type === 'media') {
                if (el.files.length > 0) {
                    // Upload all files
                    for (let i = 0; i < el.files.length; i++) {
                        const file = el.files[i];
                        const storageRef = ref(storage, `forms/${currentFormId}/${Date.now()}_${i}_${file.name}`);
                        const snapshot = await uploadBytes(storageRef, file);
                        const url = await getDownloadURL(snapshot.ref);

                        mediaItems.push({
                            url: url,
                            type: file.type.startsWith('video') ? 'video' : 'image',
                            name: file.name
                        });
                    }
                    formData.data[field.id] = mediaItems; // Save array of media objects
                }
            } else {
                formData.data[field.id] = el.value;
                if (field.id === 'defects' && el.value.trim() !== "") {
                    defectsFound = true;
                    defectDescription = el.value;
                }
            }
        }

        // Save Form
        const formRef = await addDoc(collection(db, "form_submissions"), formData);

        // Create Repair Ticket if Defects + Media
        if (defectsFound) {
            await addDoc(collection(db, "repair_tickets"), {
                sourceFormId: formRef.id,
                reportedAt: new Date().toISOString(),
                reportedBy: user.displayName || "Crew Member",
                vehicleId: formData.data.vehicle_id || "Unknown Asset",
                issue: defectDescription,
                media: mediaItems, // Pass all photos/videos
                location: location, // Pass GPS
                status: "Open",
                priority: "Normal"
            });
            alert("Form Submitted. A Repair Ticket has been opened.");
        } else {
            alert("Form submitted successfully!");
        }

        closeForm();

    } catch (error) {
        console.error("Error submitting form:", error);
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Submit Form";
    }
}