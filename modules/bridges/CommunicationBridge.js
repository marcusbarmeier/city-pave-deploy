import { BaseBridge } from './BaseBridge.js';

export default class CommunicationBridge extends BaseBridge {
    constructor() {
        super('CommunicationBridge');
    }

    // --- Helper Methods ---

    validateInputs(inputs) {
        for (const [key, val] of Object.entries(inputs)) {
            if (!val || (Array.isArray(val) && val.length === 0)) {
                console.error(`[CommunicationBridge] Missing input: ${key}`);
                return false;
            }
        }
        return true;
    }

    success(data) { return { success: true, ...data }; }
    error(msg, err) {
        console.error(`[CommunicationBridge] ${msg}`, err);
        return { success: false, message: msg, error: err };
    }

    // --- Core Actions ---

    /**
     * Sends a formatted email notification via the 'mail' collection.
     * @param {string[]} recipients - Array of email addresses (fake or real).
     * @param {string} subject - Email subject line.
     * @param {string} htmlBody - HTML content of the email.
     * @returns {Promise<object>} - Result of the operation.
     */
    async sendEmail(recipients, subject, htmlBody) {
        if (!this.validateInputs({ recipients, subject, htmlBody })) return this.error("Invalid inputs");

        try {
            const { addDoc, collection, db } = window.firebaseServices;
            await addDoc(collection(db, "mail"), {
                to: recipients,
                message: {
                    subject: subject,
                    html: htmlBody
                },
                sentAt: new Date().toISOString(),
                sourceModule: "CommunicationBridge"
            });

            return this.success({ sent: true, recipientCount: recipients.length });
        } catch (error) {
            return this.error("Failed to send email", error);
        }
    }

    /**
     * Sends a Broadcast message to a specific channel/group.
     * @param {string} channel - The target channel (e.g., 'laborers').
     * @param {string} message - The message content.
     */
    async broadcastToChannel(channel, message) {
        // Placeholder for future persistent chat/notification system
        console.log(`[CommunicationBridge] Broadcasting to #${channel}: ${message}`);
        return this.success({ broadcast: true, channel });
    }
}
