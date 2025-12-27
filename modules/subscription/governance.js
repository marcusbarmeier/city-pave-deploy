/**
 * Governance Logic
 * Calculates effective permissions by comparing Subscription Ceiling vs User Role Limit.
 */

// Decoupled from tiers.js to avoid circular dependency
// We map the string literals directly.
const TIER_RANK = {
    'LEVEL_1': 1,
    'LEVEL_2': 2,
    'LEVEL_3': 3
};

export const Governance = {
    /**
     * Calculate the effective tier for a user.
     * Logic: Effective = MIN(SubscriptionTier, UserRoleLimit)
     * 
     * @param {string} subscriptionTier - The organization's plan (Ceiling)
     * @param {string} userRoleLimit - The user's assigned limit (Role)
     * @returns {string} The effective tier (LEVEL_1, LEVEL_2, or LEVEL_3)
     */
    getEffectiveTier(subscriptionTier, userRoleLimit) {
        // Validation: If inputs are invalid, fallback to lowest safe tier
        if (!TIER_RANK[subscriptionTier]) subscriptionTier = 'LEVEL_1';
        if (!TIER_RANK[userRoleLimit]) userRoleLimit = 'LEVEL_1'; // Default to Level 1 if undefined

        const subRank = TIER_RANK[subscriptionTier];
        const userRank = TIER_RANK[userRoleLimit];

        // Return the tier with the lower rank
        return subRank < userRank ? subscriptionTier : userRoleLimit;
    },

    /**
     * Check if a specific tier satisfies a requirement.
     * @param {string} currentTier 
     * @param {string} requiredTier 
     */
    isTierAtLeast(currentTier, requiredTier) {
        const cur = TIER_RANK[currentTier] || 0;
        const req = TIER_RANK[requiredTier] || 0;
        return cur >= req;
    }
};
