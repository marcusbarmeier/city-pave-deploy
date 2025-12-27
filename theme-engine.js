// Theme Engine
// Handles dynamic CSS variables, palette generation, and AI theming.

export const ThemeEngine = {
    // --- State ---
    currentTheme: {
        primary: '#2563eb', // blue-600
        secondary: '#475569', // slate-600
        bg: '#f8fafc', // slate-50
        surface: '#ffffff',
        text: '#0f172a', // slate-900
        radius: '0.5rem',
        font: 'Inter, sans-serif'
    },

    /**
     * Applies the given theme configuration to the root element.
     * @param {Object} theme - Partial theme object.
     */
    applyTheme: (theme = {}) => {
        const t = { ...ThemeEngine.currentTheme, ...theme };
        ThemeEngine.currentTheme = t;

        const root = document.documentElement;

        // Colors
        root.style.setProperty('--primary', t.primary);
        root.style.setProperty('--secondary', t.secondary);
        root.style.setProperty('--bg-color', t.bg);
        root.style.setProperty('--surface-color', t.surface);
        root.style.setProperty('--text-color', t.text);

        // UI Properties
        root.style.setProperty('--radius', t.radius);
        root.style.setProperty('--font-family', t.font);

        // Generate Palette (Mock Tailwind shades)
        ThemeEngine.generatePalette(t.primary, 'primary');

        console.log("Theme Applied:", t);
    },

    /**
     * Generates a palette of shades from a single color and sets CSS vars.
     * @param {string} hex - Base hex color.
     * @param {string} name - Variable prefix (e.g., 'primary').
     */
    generatePalette: (hex, name) => {
        // In a real app, use a library like chroma.js or tinycolor2
        // Here we mock a few shades for demonstration
        const root = document.documentElement;
        root.style.setProperty(`--${name}-50`, ThemeEngine.adjustBrightness(hex, 0.9));
        root.style.setProperty(`--${name}-100`, ThemeEngine.adjustBrightness(hex, 0.8));
        root.style.setProperty(`--${name}-500`, hex); // Base
        root.style.setProperty(`--${name}-600`, ThemeEngine.adjustBrightness(hex, -0.1));
        root.style.setProperty(`--${name}-900`, ThemeEngine.adjustBrightness(hex, -0.4));
    },

    /**
     * Helper to lighten/darken hex color.
     * @param {string} hex 
     * @param {number} percent (Positive for light, negative for dark)
     */
    adjustBrightness: (hex, percent) => {
        // Simple mock implementation
        // For production, use a proper color manipulation library
        return hex;
    },

    /**
     * Generates theme suggestions based on a seed color.
     * @param {string} seedColor 
     */
    suggestThemes: (seedColor) => {
        return [
            { name: 'Professional', primary: seedColor, bg: '#f8fafc', radius: '0.3rem' },
            { name: 'Modern', primary: seedColor, bg: '#ffffff', radius: '1rem' },
            { name: 'Dark Mode', primary: seedColor, bg: '#0f172a', surface: '#1e293b', text: '#f8fafc', radius: '0.5rem' }
        ];
    }
};

// Initialize with default
document.addEventListener('DOMContentLoaded', () => {
    ThemeEngine.applyTheme();
});
