/**
 * City Pave Subscription & Tier Framework
 */

// --- 1. Tier Definitions ---

export const TIER_LEVELS = {
    LEVEL_1: 'LEVEL_1', // Basic
    LEVEL_2: 'LEVEL_2', // Mid
    LEVEL_3: 'LEVEL_3'  // Top
};

export const CAPABILITIES = {
    // AI Capabilities
    AI_OVERLAY_GLOBAL: 'ai_overlay_global',
    AI_OVERLAY_PAGE: 'ai_overlay_page',

    // Data / Connectivity
    FULL_DATA_BRIDGING: 'full_data_bridging',
    BUNDLE_ONLY_BRIDGING: 'bundle_only_bridging',
    MANUAL_DATA_TRANSFER: 'manual_data_transfer',

    // Features
    // Communication Gates (Phase 4)
    SMART_ROUTING: 'smart_routing', // AI Switchboard
    MAGIC_LINKS: 'magic_links',     // Secure External Views
    RED_PHONE: 'red_phone'          // Emergency Protocol
};

import { Governance } from './governance.js';

const TIER_CONFIG = {
    [TIER_LEVELS.LEVEL_3]: [
        CAPABILITIES.FULL_DATA_BRIDGING,
        CAPABILITIES.AI_OVERLAY_GLOBAL,
        CAPABILITIES.GEO_FENCING,
        CAPABILITIES.BASIC_MANUAL_COMM,
        CAPABILITIES.AI_OVERLAY_PAGE,
        // Pro Comms
        CAPABILITIES.SMART_ROUTING,
        CAPABILITIES.MAGIC_LINKS,
        CAPABILITIES.RED_PHONE
    ],
    [TIER_LEVELS.LEVEL_2]: [
        CAPABILITIES.FULL_DATA_BRIDGING,
        CAPABILITIES.MANUAL_DATA_TRANSFER,
        CAPABILITIES.AI_OVERLAY_PAGE,
        CAPABILITIES.BASIC_MANUAL_COMM
        // No Smart Routing, No Red Phone
    ],
    [TIER_LEVELS.LEVEL_1]: [
        CAPABILITIES.BUNDLE_ONLY_BRIDGING,
        CAPABILITIES.MANUAL_DATA_TRANSFER
        // No AI, No Geo-Fencing
    ]
};

// --- 2. PermissionGate Class ---

export class PermissionGate {
    constructor() {
        // Load initial tier from storage or default to LEVEL_1
        let storedTier = null;
        if (typeof localStorage !== 'undefined') {
            storedTier = localStorage.getItem('city_pave_tier');
        }

        this.currentTier = storedTier && Object.values(TIER_LEVELS).includes(storedTier)
            ? storedTier
            : TIER_LEVELS.LEVEL_1; // Default to basic if nothing stored

        // Listen for storage events (cross-tab sync)
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key === 'city_pave_tier' && e.newValue) {
                    console.log(`[PermissionGate] Storage update: ${e.newValue}`);
                    this.currentTier = e.newValue;
                }
            });
        }
    }

    /**
     * Set the current tier for this gate instance and persist it.
     * @param {string} tier - One of TIER_LEVELS
     */
    setTier(tier) {
        if (!Object.values(TIER_LEVELS).includes(tier)) {
            console.warn(`Invalid tier: ${tier}. Defaulting to LEVEL_1`);
            tier = TIER_LEVELS.LEVEL_1;
        }
        this.currentTier = tier;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('city_pave_tier', tier);
        }
        console.log(`[PermissionGate] Tier set to ${tier}`);
    }

    /**
     * Sync permissions with a user object from Firestore.
     * @param {Object} user - The user object containing role and tier.
     */
    syncWithUser(user) {
        if (!user) {
            this.setTier(TIER_LEVELS.LEVEL_1);
            return;
        }

        // 1. Admin Override
        if (user.role === 'admin' || user.role === 'super_admin') {
            console.log("[PermissionGate] Admin detected. Granting LEVEL_3.");
            this.setTier(TIER_LEVELS.LEVEL_3);
            return;
        }

        // 2. Read Tier from Profile
        if (user.tier && Object.values(TIER_LEVELS).includes(user.tier)) {
            this.setTier(user.tier);
        } else {
            // Default check: simple logic if tier is missing
            this.setTier(TIER_LEVELS.LEVEL_1);
        }
    }

    /**
     * Check if the current tier has a specific capability.
     * @param {string} capability - One of CAPABILITIES
     * @returns {boolean}
     */
    can(capability) {
        const tierCaps = TIER_CONFIG[this.currentTier] || [];
        return tierCaps.includes(capability);
    }

    /**
     * Check if a specific effective tier (Sub Limit vs User Role) has a capability.
     * This is the "Dual-Layer" check.
     * @param {string} capability - The capability to check
     * @param {string} userRoleTier - The user's specific role limit (e.g. LEVEL_1)
     * @returns {boolean}
     */
    check(capability, userRoleTier) {
        const effectiveTier = Governance.getEffectiveTier(this.currentTier, userRoleTier);
        const caps = TIER_CONFIG[effectiveTier] || [];
        return caps.includes(capability);
    }

    /**
     * Get list of all capabilities for current tier
     */
    getCapabilities() {
        return TIER_CONFIG[this.currentTier] || [];
    }
}

// Global instance for simple usage if needed, though instantiation is preferred for user context
export const globalPermissionGate = new PermissionGate();


// --- 3. Bundles Data Structure ---

export const BUNDLES = {
    ESTIMATOR_SUITE: {
        id: 'bundle_estimator_suite',
        name: 'Estimator Suite',
        modules: ['estimator', 'sketch'],
        description: 'The core value prop: Professional Estimates + Sketch Tool.'
    },
    FIELD_OPS: {
        id: 'bundle_field_ops',
        name: 'Field Ops Pack',
        modules: ['dispatch', 'safety', 'fleet'],
        description: 'Manage crews, safety compliance, and fleet maintenance.'
    },
    GROWTH_ENGINE: {
        id: 'bundle_growth_engine',
        name: 'Growth Engine',
        modules: ['growth', 'client_portal'],
        description: 'Marketing tools, Chatbot, and Client Portal.'
    },
    ENTERPRISE: {
        id: 'bundle_enterprise',
        name: 'Full Enterprise',
        modules: ['estimator', 'sketch', 'dispatch', 'safety', 'fleet', 'growth', 'client_portal', 'operations', 'employee', 'admin'],
        description: 'All modules included. The complete operating system.'
    }
};
