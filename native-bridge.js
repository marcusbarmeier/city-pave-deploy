// Native Bridge
// Handles communication between the web app and the Capacitor native wrapper.

export const NativeBridge = {
    /**
     * Checks if the app is running in a native environment (iOS/Android).
     * @returns {boolean}
     */
    isNative: () => {
        return window.Capacitor && window.Capacitor.isNativePlatform();
    },

    /**
     * Returns the current platform.
     * @returns {'web' | 'ios' | 'android'}
     */
    getPlatform: () => {
        if (!window.Capacitor) return 'web';
        return window.Capacitor.getPlatform();
    },

    /**
     * Request a native permission.
     * @param {'camera' | 'geolocation'} type 
     */
    requestPermission: async (type) => {
        if (!NativeBridge.isNative()) {
            console.log(`[Web] Requesting permission for ${type} (Simulated)`);
            return 'granted';
        }
        // Real Capacitor logic would go here
        // const { Camera } = Plugins;
        // return await Camera.requestPermissions();
        return 'granted'; // Mock for now
    }
};

// Auto-inject platform class to body for CSS styling
document.addEventListener('DOMContentLoaded', () => {
    const platform = NativeBridge.getPlatform();
    document.body.classList.add(`platform-${platform}`);
    if (NativeBridge.isNative()) {
        document.body.classList.add('is-native');
    }
});
