
/**
 * AI Overlay Main Module
 * Orchestrates Context, Bridge, Admin, and UI.
 */

import { Context } from './context.js';
import { Bridge } from './bridge.js';
import { Admin } from './admin.js';
import { UI } from './ui.js';
import { FloatingDock } from './floating-dock.js';
import { VoiceManager } from './voice-manager.js'; // Import Voice Manager
import { globalPermissionGate, CAPABILITIES } from '../subscription/tiers.js';
import { SmartQueue } from './smart-queue.js'; // Import Queue
// --- NEW COMM MODULES ---
import { routingService } from '../communication/RoutingService.js';
import { emergencyController } from '../communication/EmergencyController.js';
import { contactDirectory } from '../communication/ContactDirectory.js';

export class AIOverlay {
    constructor() {
        this.isVisible = false;
        this.initialized = false;
        this.processingQueue = false;
        this.dismissals = []; // Track closure timestamps
        this.dndUntil = 0;    // Do Not Disturb active until this timestamp
    }

    async init() {
        if (this.initialized) return;

        // Init Admin Settings
        Admin.init();

        // Sync Global Permission Gate with current User
        if (window.currentUser) {
            globalPermissionGate.syncWithUser(window.currentUser);
        }

        // Check Admin/Permissions
        if (!Admin.shouldActivate(window.currentUser)) {
            console.log("[AI Overlay] Disabled by Admin or Permissions.");
            return;
        }

        // Init Components
        Context.init();

        // Init Voice
        const voiceEnabled = VoiceManager.init();

        // Add Trigger via Dock
        FloatingDock.addButton({
            id: 'ai-trigger-btn',
            label: 'AI Assistant',
            icon: '✨',
            color: 'linear-gradient(135deg, #4f46e5, #ec4899)',
            onClick: () => this.toggle()
        });

        if (voiceEnabled) {
            FloatingDock.addButton({
                id: 'ai-voice-btn',
                label: 'Tap to Talk',
                icon: '🎙️',
                color: '#f59e0b', // amber-500
                onClick: () => this.startVoiceInteraction()
            });

            // Listen for Voice Events to update UI
            window.addEventListener('voice-start', () => UI.showToast("Listening...", "👂"));
        }

        // --- NEW: Listen for System Triggers (Nervous System) ---
        // 1. Geofence Events
        window.addEventListener('geofence-enter', (e) => this.handleTrigger('geofence-enter', e.detail));
        window.addEventListener('geofence-exit', (e) => this.handleTrigger('geofence-exit', e.detail));

        // 2. Module Triggers (e.g. Estimator)
        window.addEventListener('ai-trigger', (e) => {
            if (e.detail && e.detail.type) {
                this.handleTrigger(e.detail.type, e.detail.data);
            }
        });
        // -------------------------------------------------------

        // Add "Red Phone" (Emergency) Button (Level 3 Only)
        // Check Capability
        if (globalPermissionGate.can(CAPABILITIES.RED_PHONE)) {
            FloatingDock.addButton({
                id: 'red-phone-btn',
                label: 'EMERGENCY',
                icon: '🚨',
                color: '#dc2626', // Red-600
                onClick: () => this.startEmergencyFlow()
            });
        }

        // Add Comms Placeholder (Wired later) -> REPLACED by Red Phone primarily, but maybe keep directory?
        // Let's keep a "Directory" button if user wants manual contact list
        FloatingDock.addButton({
            id: 'comm-dir-btn',
            label: 'Directory',
            icon: '📒',
            color: '#10b981',
            onClick: () => contactDirectory.toggle()
        });

        UI.init(
            () => this.toggle(),
            (text) => this.handleUserMessage(text)
        );

        this.initialized = true;
        console.log("[AI Overlay] Initialized.");

        // Start Queue Processor
        setInterval(() => this.processNextInQueue(), 2000);
    }

    toggle() {
        if (this.isVisible) {
            // User is closing the overlay -> Count as dismissal
            this.handleDismissal();
        }
        this.isVisible = !this.isVisible;
        UI.toggleWindow(this.isVisible);

        if (this.isVisible) {
            this.showContextTip();
        }
    }

    async startVoiceInteraction() {
        if (!this.isVisible) this.toggle();
        this.processingQueue = true; // Block queue while talking

        try {
            VoiceManager.speak("I'm listening.");
            // Wait a moment for TTS to start/finish or just overlap
            const text = await VoiceManager.listenOnce();
            if (text) {
                // Determine source (simulated vs real input)
                this.handleUserMessage(text);
            }
        } catch (e) {
            console.warn("[AI Voice] Interaction failed/cancelled", e);
            UI.showToast("Voice check failed. Try again.", "❌");
        } finally {
            this.processingQueue = false; // Release lock
        }
    }

    showContextTip() {
        const snapshot = Context.getSnapshot();
        const msg = `Context: ${snapshot.userRole} @${snapshot.currentModule} `;
        UI.addContextTip(msg);
    }

    /**
     * Phase 2: Handle Triggers from "Nervous System"
     * Enqueues the trigger for safe processing.
     */
    async handleTrigger(eventType, data) {
        console.log(`[AI Brain] Trigger Enqueued: ${eventType} `, data);

        // Determine Priority based on event type
        let priority = SmartQueue.PRIORITY.NORMAL;
        if (eventType === 'geofence-enter' || eventType === 'dispatch-received') {
            priority = SmartQueue.PRIORITY.HIGH;
        }

        SmartQueue.enqueue({
            type: eventType,
            data: data,
            priority: priority,
            timestamp: Date.now()
        });

        // Return mostly for testing compatibility, logic moved to processor
        return { queued: true };
    }

    // --- EMERGENCY FLOW ---
    startEmergencyFlow() {
        // 1. Trigger Controller
        const snapshot = Context.getSnapshot();
        // Mock GPS if missing
        if (!snapshot.location) snapshot.location = { lat: 0, lng: 0 };
        snapshot.name = window.currentUser ? window.currentUser.name : 'Unknown';

        const incident = emergencyController.triggerEmergency(snapshot);

        // 2. Open UI Overlay
        if (!this.isVisible) this.toggle();

        // 3. Prompt User
        UI.addMessage(`🚨 EMERGENCY MODE ACTIVATED 🚨\nID: ${incident.id}`, 'ai');
        UI.addMessage("What is the nature of the emergency?", 'ai');
        VoiceManager.speak("Emergency mode activated. State the nature of the emergency.");

        // 4. Offer Buttons (Simulated via text for now)
        setTimeout(() => {
            UI.addMessage(`[Accident] [Injury] [Fire] [Security]`, 'system');
        }, 1000);

        // 5. Set Context so next response is routed correctly
        this.activeContext = { action: 'confirm-emergency-type', incidentId: incident.id };

        // 6. Start Listening
        this.startVoiceInteraction();
    }

    handleDismissal() {
        const now = Date.now();
        // 1. Clean up dismissals older than 5 minutes (300,000 ms)
        this.dismissals = this.dismissals.filter(t => now - t < 300000);

        // 2. Add current dismissal
        this.dismissals.push(now);

        // 3. Check threshold (2 dismissals in 5 mins)
        if (this.dismissals.length >= 2) {
            this.dndUntil = now + (60 * 60 * 1000); // 1 Hour DND
            UI.showToast("AI silenced for 1 hour (DND)", "🌙");
            console.log("[AI Overlay] Do Not Disturb Activated until", new Date(this.dndUntil).toLocaleTimeString());
            // Clear dismissals to reset logic after DND expries
            this.dismissals = [];
        }
    }

    async processNextInQueue() {
        if (this.processingQueue || SmartQueue.isEmpty()) return;

        // Check DND Status
        if (Date.now() < this.dndUntil) {
            // Determine if we should purge queue or just wait?
            // For now, let's just ignore/wait. Queue might build up, but SmartQueue handles priority drop logic if needed.
            // Or we could silently discard low priority items?
            return;
        }

        if (VoiceManager.state.isSpeaking || VoiceManager.state.isListening) return; // Don't interrupt flow

        const item = SmartQueue.getNext();
        if (!item) return;

        console.log("[AI Brain] Processing Item:", item);
        this.processingQueue = true;

        try {
            const { type, data } = item;
            let prompt = "";
            let contextData = null;

            // 1. Determine Prompt based on Event
            switch (type) {
                case 'geofence-enter':
                    // Check for End of Day Trigger (Home/Yard + > 4PM)
                    const isEndOfDay = new Date().getHours() >= 16; // 4 PM or later
                    const isYard = /Home|Yard/i.test(data.name);

                    if (isYard && isEndOfDay) {
                        prompt = "Back at the Yard. Complete Daily Ops Log?";
                        contextData = { action: 'open-daily-log' };
                    } else {
                        prompt = `You just arrived at ${data.name}. Clock in and start a hazard assessment?`;
                        contextData = { action: 'clock-in', site: data };
                    }
                    break;
                case 'geofence-exit':
                    prompt = `Leaving ${data.name}. Clock out ? `;
                    contextData = { action: 'clock-out', site: data };
                    break;
                case 'dispatch-received':
                    prompt = `New Job detected: ${data.clientName}. Accept and start route ? `;
                    contextData = { action: 'accept-job', job: data };
                    break;
                case 'estimate-ready':
                    prompt = `Estimate for ${data.clientName} is ready ($${data.amount}). Send to Client Portal?`;
                    contextData = { action: 'send-estimate', estimate: data };
                    break;
                default:
                    console.log("[AI Brain] Unknown trigger ignored.");
                    this.processingQueue = false;
                    return;
            }

            // Store active context for follow-up
            this.activeContext = contextData;

            // 2. Wake up UI
            if (!this.isVisible) this.toggle();

            // 3. Output Prompt (Text + Audio)
            UI.addMessage(prompt, 'ai');
            VoiceManager.speak(prompt);

            // 4. Start Listening (Context Aware)
            setTimeout(() => {
                this.startVoiceInteraction().then(() => {
                    this.processingQueue = false; // Release after interaction
                    // Note: resetting activeContext happens after processing response or timeout? 
                    // ideally we keep it for a bit.
                }).catch(err => {
                    console.log("Auto-listen blocked/failed:", err);
                    this.processingQueue = false;
                });
            }, 3000);

        } catch (e) {
            console.error("Error processing queue item:", e);
            this.processingQueue = false;
        }
    }

    async processQuery(input, context, data = null) {
        const lowerInput = input.toLowerCase();

        // 0. CHECK ACTIVE CONTEXT (Data Bridging)
        // If we recently asked a question (stored in this.activeContext from queue), check if this is a confirmation
        if (this.activeContext && (lowerInput.includes('yes') || lowerInput.includes('sure') || lowerInput.includes('confirm'))) {
            // ... (Existing yes handlers) ...
            const action = this.activeContext.action;
            const site = this.activeContext.site;

            if (action === 'clock-in') {
                console.log("[AI Bridge] Clocking In User...");
                UI.addMessage(`✅ Clocking you in at ${site.name}...`, 'ai');

                // [REAL BRIDGE CALLS]
                // Mock user if necessary for simulation
                const user = window.currentUser || { uid: 'sim-user', email: 'driver@citypave.com', displayName: 'Sim Driver' };

                const clockResult = await Bridge.clockIn(user, site);
                if (clockResult) {
                    UI.addMessage("🕒 Time Record Created", 'system');
                    await Bridge.createHazardForm(user, site);
                    UI.addMessage("📋 Hazard Assessment Opened (Draft)", 'system');

                    VoiceManager.speak("Clocked in. Safety form is ready.");
                } else {
                    UI.addMessage("❌ Error writing to database.", 'error');
                }

                this.activeContext = null;
                return "You are clocked in. Drive safe!";
            } else if (action === 'open-daily-log') {
                // Future implementation
            } else if (action === 'send-estimate') {
                // Future implementation
            }
        }

        // 0.B CHECK EMERGENCY CONFIRMATION
        if (this.activeContext && this.activeContext.action === 'confirm-emergency-type') {
            let typeId = null;
            if (lowerInput.includes('accident') || lowerInput.includes('crash')) typeId = 'accident';
            else if (lowerInput.includes('injury') || lowerInput.includes('hurt')) typeId = 'injury';
            else if (lowerInput.includes('fire') || lowerInput.includes('smoke')) typeId = 'fire';
            else if (lowerInput.includes('security') || lowerInput.includes('theft')) typeId = 'security';

            if (typeId) {
                const result = await emergencyController.confirmEmergencyType(typeId);
                if (result) {
                    UI.addMessage(`📣 **ALERT BROADCASTED** to Crisis Team.`, 'warning');

                    // Check Capability for Magic Link
                    if (globalPermissionGate.can(CAPABILITIES.MAGIC_LINKS)) {
                        UI.addMessage(`🔗 **Magic Link Created**: [Secure View](${result.magicLink})`, 'system');
                        VoiceManager.speak("Alert broadcasted. Secure link created.");
                    } else {
                        UI.addMessage(`(Magic Link generation requires Pro Tier)`, 'system-subtle');
                        VoiceManager.speak("Alert broadcasted.");
                    }

                    this.activeContext = null;
                    return `Stay safe. Help is on the way.`;
                }
            }
        }

        // 1. Safety / FinOps Check
        if (this.isExpensiveRequest(lowerInput)) {
            return "⚠️ To conserve system resources, I cannot generate media files (images, videos, etc.) at this time. However, I can help you with text descriptions, estimates, and data analysis!";
        }

        // 2. Intent Detection & Data Fetching
        // Check Permissions for Global Data
        if (!globalPermissionGate.can(CAPABILITIES.AI_OVERLAY_GLOBAL)) {
            // Limited AI (Page Only) logic could go here
            if (lowerInput.includes('bridge') || lowerInput.includes('global')) {
                return "🔒 Upgrade to Level 3 for Global AI & Full Data Bridging.";
            }
        }

        // Check for Asset Availability
        if (lowerInput.includes('available') && (lowerInput.includes('asset') || lowerInput.match(/[A-Z]-\d+/))) {
            const availability = await Bridge.fetchData('asset_availability', input);
            if (availability.error) return availability.error;

            return availability.available
                ? `✅ Yes, that asset is operational and available for assignment.`
                : `❌ Asset Unavailable.Reason: ${availability.reason} `;
        }

        // Check for Repair History
        if (lowerInput.includes('repair') || lowerInput.includes('history')) {
            // Mock bridge call for repair history (as defined in Bridge)
            const history = await Bridge.fetchData('repair_history', input);
            if (history && history.length > 0) {
                return `found ${history.length} records.Most recent: ${history[0].repair} on ${history[0].date} costing $${history[0].cost}.`;
            }
            return "No repair history found.";
        }

        // 3. Contextual Retrieval (if data passed in)
        if (data) {
            return `I found related data: ${JSON.stringify(data)} `;
        }

        // 4. Contextual Status
        if (lowerInput.includes('status') || lowerInput.includes('where am i')) {
            return `System is fully operational.You are currently in the ** ${context.currentModule}** module(${context.page}).\nRole: ${context.userRole} `;
        }

        // 5. Global Knowledge / General Help (Simulated)
        if (lowerInput.includes('weather')) {
            if (!globalPermissionGate.can(CAPABILITIES.AI_OVERLAY_GLOBAL)) return "🔒 Weather data requires Level 3 Global AI.";
            return "It looks like rain is expected tomorrow, so check the Schedule module to adjust your paving plans!";
        }
        if (lowerInput.includes('safety')) return "Checking safety protocols... Always ensure you are wearing high-visibility gear on site. For specific hazards, check the Safety module.";
        if (lowerInput.includes('estimate') || lowerInput.includes('calculate')) return "I can help with estimates. Please provide the square footage and material type, and I'll run the numbers.";

        // Default "Global" Response
        return `I can help with "${input}".As your AI assistant, I have access to the Logic Bridge for real - time asset checks and data.\n\nTry asking: "Is asset A-101 available?"`;
    }

    // Updated handleUserMessage to be async properly (and use RoutingService)
    async handleUserMessage(text) {
        // simulated delay
        UI.addMessage("Thinking...", 'ai-temp');

        // 1. Get Context
        const context = Context.getSnapshot();

        // 2. Generate Response
        // We now await the processQuery result because it might fetch data
        try {
            // Check Page Level Permission
            if (!globalPermissionGate.can(CAPABILITIES.AI_OVERLAY_PAGE)) {
                throw new Error("AI Overlay not available in this Tier.");
            }

            // --- ROUTING SERVICE INTEGRATION (New) ---
            // Analyze Intent
            const route = routingService.analyze(text, context);
            console.log("[AI Router] Decision:", route);

            let response = "";

            if (route.type === 'SAFETY') {
                // Auto-trigger Red Phone if they say "Help" or "Accident"
                this.startEmergencyFlow();
                const temp = UI.elements.messages.querySelector('.ai-msg.ai-temp');
                if (temp) temp.remove();
                return; // Exit, flow handled there
            } else if (route.recipient === 'AI_INTERCEPT') {
                // Handle General Questions (Address, Time, etc)
                // Start with simple regex or mock dispatch lookup
                if (text.match(/address|location|where/i)) {
                    // Check if we have an active job in context
                    if (context.activeJob) {
                        response = `📍 ${context.activeJob.name}: ${context.activeJob.address || '123 Main St, Springfield'}`;
                    } else {
                        response = "I don't see an active job for you right now. Please check Dispatch.";
                    }
                } else if (text.match(/weather/i)) {
                    response = "partly cloudy, 72°F. No rain expected today.";
                } else {
                    response = await this.processQuery(text, context);
                }
            } else if (route.type === 'ACCESS') {
                // AI INTERCEPT: Gate Codes
                // Simulate lookup for current site
                const siteId = context.site ? context.site.id : 'Unknown';
                console.log(`[AI Logic] Fetching Gate Code for Site ${siteId}...`);

                // Mock Database Lookup
                const mockCodes = { 'S-101': '4499#', 'S-102': '1234' };
                const code = mockCodes[siteId] || '0000#';

                response = `🔐 Access Code for this site is: **${code}**`;
            } else {
                // It's a routed message (Material, Mechanical, Access)
                // CHECK CAPABILITY: Smart Routing (Level 3+)
                // Exception: General Questions (Weather, Address) allowed on L2 (AI_OVERLAY_PAGE) but Routed via AI_INTERCEPT above.
                // But complex routing (Mechanical, Material) is L3.

                if (!globalPermissionGate.can(CAPABILITIES.SMART_ROUTING)) {
                    response = "🔒 **Smart Routing** (Auto-Ticketing & Switchboard) is a Pro feature.\nI can answer general questions, but I cannot route requests to other departments yet.";
                } else {
                    response = `🔄 Routing to **${route.recipient}** (${route.action})...\nConfidence: ${(route.confidence * 100).toFixed(0)}%`;

                    if (route.type === 'MECHANICAL') {
                        response += `\n🛠️ Ticket created for Fleet Manager.`;
                    }
                }
            }

            // Remove temp message
            const temp = UI.elements.messages.querySelector('.ai-msg.ai-temp');
            if (temp) temp.remove();

            UI.addMessage(response, 'ai');
            if (response.length < 150) VoiceManager.speak(response);

        } catch (e) {
            console.error(e);
            const temp = UI.elements.messages.querySelector('.ai-msg.ai-temp');
            if (temp) temp.remove();

            if (e.message.includes("not available")) {
                UI.addMessage("🔒 AI Assistant is not available in your current Subscription Tier.", 'ai');
            } else {
                UI.addMessage("Sorry, I encountered an error connecting to the Logic Bridge.", 'ai');
            }
        }
    }

    isExpensiveRequest(input) {
        const expensiveTerms = ['image', 'picture', 'photo', 'video', 'movie', 'generate a', 'draw', 'paint'];
        // Simple check: if "generate" AND "image" etc are present
        if (input.includes('generate') || input.includes('create')) {
            return expensiveTerms.some(term => input.includes(term));
        }
        return false;
    }

    generateSimulatedResponse(input) {
        // Fallback for demo
        const responses = [
            "That's an interesting question! I can certainly help you think through that.",
            "I'm here to help with anything you need, whether it's related to paving or just general information.",
            "Could you tell me more about what you're looking for?",
            "I've noted that. Is there anything specific in the system you'd like me to cross-reference?"
        ];

        // Return a direct echo + helpful generic text to show it "understood"
        return `I understand you're asking about "${input}". While I don't have real - time internet access in this demo, I'm designed to process this kind of request!`;
    }
}

// Singleton instance
const aiOverlay = new AIOverlay();
export default aiOverlay;
