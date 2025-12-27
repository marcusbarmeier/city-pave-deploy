// © 2025 City Pave. All Rights Reserved.
// Filename: saas-modules.js

/**
 * Defines the hierarchy of Modules, Features, and Enhancements.
 * Organized by Functional Area.
 */
export const ModuleHierarchy = {
    // --- 1. SALES & ESTIMATION ---
    sales_estimation: {
        id: 'sales_estimation',
        name: 'Sales & Estimation',
        type: 'module',
        features: {
            sketch_app: { id: 'sketch_app', name: 'Sketch App', type: 'feature', tier: 'growth', description: 'Digital canvas for site measurements.' },
            estimator_basic: { id: 'estimator_basic', name: 'Estimator (Basic)', type: 'feature', tier: 'growth', description: 'Standard pricing calculator.' },
            estimator_pro: { id: 'estimator_pro', name: 'Estimator (Pro)', type: 'enhancement', tier: 'titan', description: 'Auto-pricing, digital signatures, excavation bridge.' },
            crm_pipeline: { id: 'crm_pipeline', name: 'CRM Pipeline', type: 'feature', tier: 'growth', description: 'Lead tracking and status management.' }
        }
    },

    // --- 2. FIELD OPERATIONS ---
    field_operations: {
        id: 'field_operations',
        name: 'Field Operations',
        type: 'module',
        features: {
            time_kiosk: { id: 'time_kiosk', name: 'Time Kiosk', type: 'mini-app', tier: 'starter', description: 'Digital time clock and payroll tracking.' },
            dispatch_command: { id: 'dispatch_command', name: 'Dispatch Command', type: 'mini-app', tier: 'starter', description: 'Drag-and-drop scheduling and routing.' },
            snow_calculator: { id: 'snow_calculator', name: 'Snow Calculator', type: 'enhancement', tier: 'titan', description: 'Salt/Plow usage estimation.' },
            excavation_calc: { id: 'excavation_calc', name: 'Excavation Calculator', type: 'enhancement', tier: 'titan', description: 'Volume and truck load logic.' },
            safety_manual: { id: 'safety_manual', name: 'Safety Manual', type: 'feature', tier: 'starter', description: 'Digital safety docs (Read-Only).' },
            safety_manager: { id: 'safety_manager', name: 'Safety Manager', type: 'enhancement', tier: 'growth', description: 'Edit/Upload safety docs.' }
        }
    },

    // --- 3. FINANCE & ADMIN ---
    finance_admin: {
        id: 'finance_admin',
        name: 'Finance & Admin',
        type: 'module',
        features: {
            expense_reporting: { id: 'expense_reporting', name: 'Expense Reporting', type: 'feature', tier: 'growth', description: 'Employee receipt upload.' },
            invoice_scanner: { id: 'invoice_scanner', name: 'AI Invoice Scanner', type: 'enhancement', tier: 'titan', description: 'OCR for receipts and invoices.' },
            inventory_assets: { id: 'inventory_assets', name: 'Inventory & Assets', type: 'mini-app', tier: 'titan', description: 'Fleet management and parts inventory.' }
        }
    },

    // --- 4. CLIENT EXPERIENCE ---
    client_experience: {
        id: 'client_experience',
        name: 'Client Experience',
        type: 'module',
        features: {
            client_portal: { id: 'client_portal', name: 'Client Portal', type: 'feature', tier: 'growth', description: 'View job status and invoices.' },
            chatbot_ai: { id: 'chatbot_ai', name: 'Client AI Chatbot', type: 'enhancement', tier: 'titan', description: 'Auto-replies to client queries.' },
            feedback_loop: { id: 'feedback_loop', name: 'Feedback Loop', type: 'enhancement', tier: 'growth', description: 'Uber-style ratings.' }
        }
    },

    // --- 5. INTELLIGENCE & AUTOMATION ---
    intelligence: {
        id: 'intelligence',
        name: 'Intelligence & Automation',
        type: 'module',
        features: {
            weather_service: { id: 'weather_service', name: 'Weather Service', type: 'feature', tier: 'growth', description: 'Rain/Snow alerts.' },
            gantt_scheduling: { id: 'gantt_scheduling', name: 'Gantt Scheduling', type: 'enhancement', tier: 'titan', description: 'Visual timeline with dependencies.' },
            smart_routing: { id: 'smart_routing', name: 'Smart Routing', type: 'enhancement', tier: 'titan', description: 'Optimize truck routes.' },
            guardian_ai: { id: 'guardian_ai', name: 'Guardian AI', type: 'enhancement', tier: 'titan', description: 'Safety net for admin actions.' }
        }
    }
};

/**
 * SaaS Configuration for Tiers and Pricing.
 */
export const SaaSConfig = {
    tiers: {
        starter: {
            name: 'Starter',
            price: 199,
            description: 'Essential tools for small crews.',
            color: 'bg-gray-100 text-gray-800 border-gray-300'
        },
        growth: {
            name: 'Growth',
            price: 499,
            description: 'Scale your business with CRM and Estimating.',
            color: 'bg-blue-100 text-blue-800 border-blue-300'
        },
        titan: {
            name: 'Titan',
            price: 999,
            description: 'Enterprise-grade AI and Automation.',
            color: 'bg-purple-100 text-purple-800 border-purple-300'
        }
    },

    // Helper to check if a tier includes another
    includesTier: (currentTier, requiredTier) => {
        const levels = ['starter', 'growth', 'titan'];
        return levels.indexOf(currentTier) >= levels.indexOf(requiredTier);
    }
};
