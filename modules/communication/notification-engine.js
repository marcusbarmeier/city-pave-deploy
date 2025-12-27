export class NotificationEngine {
    constructor() {
        this.userState = 'idle'; // idle, driving, operating, busy
        this.permissions = {};
        this.logs = [];
    }

    /**
     * Set the current state of the user.
     * @param {string} state - 'idle', 'driving', 'operating', 'busy'
     */
    setUserState(state) {
        this.userState = state;
        console.log(`[NotificationEngine] User state updated to: ${state}`);
        // Dispatch event for UI to react (e.g., disable inputs, enlarge text)
        window.dispatchEvent(new CustomEvent('comm-state-change', { detail: { state } }));
    }

    /**
     * Check if a notification is allowed based on safety protocols.
     * @param {string} priority - 'critical', 'normal', 'low'
     * @returns {boolean}
     */
    isNotificationAllowed(priority) {
        if (priority === 'critical') return true; // Critical always prompts

        // Safety First: Block intrusive alerts when driving/operating
        if (this.userState === 'driving' || this.userState === 'operating') {
            console.warn('[NotificationEngine] Blocked notification due to safety state:', this.userState);
            return false;
        }

        return true;
    }

    /**
     * Log an event for compliance.
     * @param {string} type - 'message', 'alert', 'read_receipt'
     * @param {Object} data 
     */
    logEvent(type, data) {
        const entry = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type,
            data,
            userState: this.userState
        };
        this.logs.push(entry);
        // In a real app, sink this to Firestore immediately
        console.log('[NotificationEngine] Log entry:', entry);
    }

    /**
     * Mock Admin Permission Check
     * @param {string} permissionKey 
     * @returns {boolean}
     */
    hasPermission(permissionKey) {
        // Mock: All true for demo
        return true;
    }
}

export const notificationEngine = new NotificationEngine();
