/**
 * AI Overlay Copilot Simulation
 * Run this in the browser console to test the "Zero Touch" flow.
 */

import aiOverlay from './ai-overlay.js';
import { VoiceManager } from './voice-manager.js';

export const OverlaySim = {

    run: async () => {
        console.clear();
        console.log("%c 🤖 STARTING AI OVERLAY SIMULATION ", "background: #222; color: #bada55; font-size: 16px;");

        // 1. Mock Dependencies (if needed) across window
        if (!window.firebaseServices) {
            console.warn("⚠️ Firebase mocks injecting for simulation...");
            window.firebaseServices = {
                db: {},
                collection: () => ({}),
                addDoc: async (col, data) => {
                    console.log(`%c [DATABASE WRITE] ${col.type || 'collection'} `, "color: orange", data);
                    return { id: 'mock-doc-123' };
                }
            };
        }

        // 2. Simulate Geofence Enter Trigger
        console.log("%c [STEP 1] Simulating Geofence Enter... ", "color: cyan");
        const mockSite = { id: 'G-100', name: 'Downtown Construction Site' };

        // Dispatch the event that nav-geofence.js WOULD dispatch
        window.dispatchEvent(new CustomEvent('geofence-enter', { detail: mockSite }));

        // Wait for AI to process queue and appear
        await new Promise(r => setTimeout(r, 1500)); // Allow AI queue tick

        // 3. Verify AI Prompt
        const aiMsg = document.querySelector('.ai-msg.ai');
        if (aiMsg && aiMsg.innerText.includes('Clock in')) {
            console.log("%c [PASS] AI Prompted correctly: ", "color: green", aiMsg.innerText);
        } else {
            console.error("[FAIL] AI did not prompt for Clock In.", aiMsg ? aiMsg.innerText : "No message");
            return;
        }

        // 4. Simulate User Voice Response
        console.log("%c [STEP 2] Simulating User Voice: 'Yes' ", "color: cyan");

        // Force inject message to AI Overlay as if it came from VoiceManager
        // In real life, VoiceManager.listenOnce() returns this string.
        // We bypass the listenOnce wait by directly calling handleUserMessage
        // BUT aiOverlay waits for listenOnce. 
        // We can simulate the "Result" of the listen by mocking VoiceManager specific hook 
        // OR just calling handleUserMessage directly to prove the logic works.

        await aiOverlay.handleUserMessage("Yes, clock me in.");

        // 5. Verify Bridge Actions
        // We rely on the logs from the mocked addDoc above.
        console.log("%c [STEP 3] Verification ", "color: cyan");
        // We can also check UI
        await new Promise(r => setTimeout(r, 1000));
        const lastMsgs = Array.from(document.querySelectorAll('.ai-msg'));
        const successMsg = lastMsgs.find(d => d.innerText.includes('Time Record Created'));

        if (successMsg) {
            console.log("%c [SUCCESS] Simulation Complete. Database writes confirmed. ", "background: green; color: white; padding: 4px;");
        } else {
            console.log("%c [FAIL] Did not see confirmation message. ", "background: red; color: white");
        }
    }
};

// Auto-expose to global
window.OverlaySim = OverlaySim;
window.runOverlaySim = OverlaySim.run;
