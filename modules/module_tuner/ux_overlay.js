/**
 * UX Overlay
 * Manages the "Dreamer" Design aesthetics, animations, and visual feedbacks.
 */

export class UXOverlay {
    constructor() {
        this.activeEffects = [];
    }

    init() {
        console.log("[UX] Initializing visuals...");
        // Add global FX listeners if needed
    }

    playIntroAnimation() {
        // Simple CSS class toggle to trigger intro animations
        const main = document.querySelector('main');
        if (main) {
            main.style.opacity = '0';
            main.animate([
                { opacity: 0, transform: 'translateY(20px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], {
                duration: 800,
                easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                fill: 'forwards'
            });
        }
    }

    startScanningEffect() {
        const svg = document.querySelector('#synapse-canvas svg');
        if (svg) {
            svg.classList.add('scanning');
            // Add a style tag for the scanning animation if not present
            if (!document.getElementById('scan-anim-style')) {
                const style = document.createElement('style');
                style.id = 'scan-anim-style';
                style.textContent = `
                    .scanning { animation: spin 1s linear infinite; color: var(--neon-primary); }
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                `;
                document.head.appendChild(style);
            }
        }
    }

    stopScanningEffect() {
        const svg = document.querySelector('#synapse-canvas svg');
        if (svg) {
            svg.classList.remove('scanning');
        }
    }
}
