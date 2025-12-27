/**
 * Admin & Control Module
 * Manages feature flags, subscription tiers, and tuning parameters.
 */

export const Admin = {
    settings: {
        enabled: true, // Master switch
        tuningParams: {
            temperature: 0.7,
            persona: 'helpful_assistant'
        },
        requiredTier: 'pro' // 'starter', 'pro', 'enterprise'
    },

    init: () => {
        const saved = localStorage.getItem('ai_overlay_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Admin.settings = { ...Admin.settings, ...parsed };
                console.log("[AI Admin] Settings loaded:", Admin.settings);
            } catch (e) {
                console.warn("[AI Admin] Failed to parse saved settings", e);
            }
        }
    },

    /**
     * Checks if the AI Overlay should be active for the current tenant/user.
     */
    shouldActivate: (user) => {
        if (!Admin.settings.enabled) return false;

        // Check if user has required tier (simulated)
        // In a real app, successful login + role check is enough for now.
        // We can add logic here to check 'user.subscriptionTier' if available.
        if (user && user.subscriptionTier) {
            // Example logical check
            // if (user.subscriptionTier === 'free') return false; 
        }

        return true;
    },

    /**
     * Update dynamic parameters from the Module Tuner.
     */
    updateTuning: (newParams) => {
        Admin.settings.tuningParams = { ...Admin.settings.tuningParams, ...newParams };
        Admin.save();
        console.log("[AI Admin] Tuning updated:", Admin.settings.tuningParams);
    },

    toggle: (state) => {
        Admin.settings.enabled = state;
        Admin.save();
        return Admin.settings.enabled;
    },

    save: () => {
        localStorage.setItem('ai_overlay_settings', JSON.stringify(Admin.settings));
    }
};

