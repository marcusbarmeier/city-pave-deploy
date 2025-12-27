/**
 * Floating Dock Manager
 * Centralizes floating action buttons to avoid UI clutter.
 */

export const FloatingDock = {
    element: null,

    init: () => {
        if (document.getElementById('floating-dock')) return;

        // Create Container
        const dock = document.createElement('div');
        dock.id = 'floating-dock';
        // Styled via JS for now, or move to style.css
        Object.assign(dock.style, {
            position: 'fixed',
            bottom: '140px', // Sit above the 4-button Navigation Deck (h-24 + padding)
            right: '20px',
            display: 'flex',
            flexDirection: 'column-reverse', // Stack upwards
            gap: '15px',
            zIndex: '10000',
            pointerEvents: 'none' // Allow clicking through empty space
        });

        document.body.appendChild(dock);
        FloatingDock.element = dock;

        // Expose globally
        window.FloatingDock = FloatingDock;
    },

    /**
     * Adds a button to the dock.
     * @param {Object} config - { id, label, icon, onClick, color }
     */
    addButton: (config) => {
        if (!FloatingDock.element) FloatingDock.init();

        const btn = document.createElement('button');
        btn.id = config.id;
        btn.title = config.label || '';

        // Base Styles
        Object.assign(btn.style, {
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            color: 'white',
            background: config.color || '#4f46e5',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            pointerEvents: 'auto', // Re-enable clicks
            transition: 'transform 0.2s',
            zIndex: '10001'
        });

        btn.innerHTML = config.icon || '?';
        btn.onclick = config.onClick;

        btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1.0)';

        FloatingDock.element.appendChild(btn);
        return btn;
    }
};

// Auto Init
FloatingDock.init();
