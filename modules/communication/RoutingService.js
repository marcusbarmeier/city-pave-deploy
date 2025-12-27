/**
 * RoutingService.js
 * The "Smart Switchboard" for the Communications Module.
 * Analyzes input context and routes to the correct recipient/module.
 */

export class RoutingService {
    constructor() {
        this.routingTable = [
            {
                type: 'MATERIAL',
                keywords: /(material|concrete|asphalt|supply|order|gravel|sand)/i,
                contextRequired: null,
                primary: 'Dispatch',
                secondary: 'ProjectManager',
                action: 'create-supply-request'
            },
            {
                type: 'MECHANICAL',
                keywords: /(broken|leak|tire|smoke|engine|start|battery|flat|brakes)/i,
                contextRequired: 'vehicleId',
                primary: 'FleetManager',
                secondary: 'Mechanic',
                action: 'create-repair-ticket'
            },
            {
                type: 'SAFETY',
                keywords: /(unsafe|hazard|injury|accident|hurt|crash|fire|spill)/i,
                contextRequired: 'gps',
                primary: 'SafetyOfficer',
                secondary: 'Owner',
                action: 'trigger-red-phone'
            },
            {
                type: 'ACCESS',
                keywords: /(gate|code|lock|access|key|entry)/i,
                contextRequired: 'siteId',
                primary: 'Foreman',
                secondary: 'Dispatch',
                action: 'ai-intercept-access'
            },
            {
                type: 'GENERAL',
                keywords: /(address|time|schedule|weather|when|where)/i,
                contextRequired: null,
                primary: 'AI_INTERCEPT',
                secondary: 'Dispatch',
                action: 'ai-answer-question'
            }
        ];
    }

    /**
     * Analyzes text input and returns the routing decision.
     * @param {string} text - The user's input.
     * @param {Object} context - Current state (user role, location, active job).
     * @returns {Object} { recipient, action, confidence }
     */
    analyze(text, context) {
        // 1. Check for Emergency Keywords First
        const safetyRoute = this.routingTable.find(r => r.type === 'SAFETY');
        if (safetyRoute.keywords.test(text)) {
            return {
                recipient: safetyRoute.primary,
                action: safetyRoute.action,
                confidence: 1.0,
                type: 'SAFETY'
            };
        }

        // 2. Iterate through table
        for (const route of this.routingTable) {
            if (route.keywords.test(text)) {
                // Check Context if required
                if (route.contextRequired && !context[route.contextRequired]) {
                    console.warn(`[RoutingService] Missing context ${route.contextRequired} for ${route.type}`);
                    // Fallback to Dispatch if context missing
                    return {
                        recipient: 'Dispatch',
                        action: 'clarify-request',
                        confidence: 0.5,
                        originalType: route.type
                    };
                }

                return {
                    recipient: route.primary,
                    action: route.action,
                    confidence: 0.9,
                    type: route.type
                };
            }
        }

        // 3. Default / Fallback
        return {
            recipient: 'GeneralChannel',
            action: 'broadcast-message',
            confidence: 0.1,
            type: 'UNKNOWN'
        };
    }
}

export const routingService = new RoutingService();
