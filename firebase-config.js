// © 2025 City Pave. All Rights Reserved.
// Filename: firebase-config.js

/**
 * PRODUCTION Configuration (Current Live App)
 */
const firebaseConfigProd = {
    apiKey: "AIzaSyADrnYgh1fSTo3IZD7HOEJMyjduzDYIYSs",
    authDomain: "city-pave-estimator.firebaseapp.com",
    projectId: "city-pave-estimator",
    storageBucket: "city-pave-estimator.firebasestorage.app", // Note: Found two different buckets in source, standardizing on this one or checking logic below.
    // In config.js: city-pave-estimator.firebasestorage.app
    // In index.html: city-pave-estimator.appspot.com
    // We will support overrides if strictly necessary, but usually they are aliases. 
    // Let's use the one from config.js as primary for now.
    storageBucket: "city-pave-estimator.firebasestorage.app",
    messagingSenderId: "111714884839",
    appId: "1:111714884839:web:2b782a1b7be5be8edc5642",
    measurementId: "G-F256W9036F" // Taken from index.html
};

/**
 * BETA Configuration (New Testing Environment)
 * TODO: User to replace these values with new project keys
 */
const firebaseConfigBeta = {
    apiKey: "AIzaSyBSbgNhSIpjd9-ielh1V0EivXZF90166Ow",
    authDomain: "city-pave-estimator-beta.firebaseapp.com",
    projectId: "city-pave-estimator-beta",
    storageBucket: "city-pave-estimator-beta.firebasestorage.app",
    messagingSenderId: "292246416016",
    appId: "1:292246416016:web:1bd52862a7e0560e7c8615"
};

/**
 * Determines which environment to use.
 * Priority:
 * 1. URL Parameter ?env=beta
 * 2. LocalStorage key 'app_env'
 * 3. Default to 'production'
 */
function getActiveConfig() {
    // Auto-fix malformed URLs (common when copying links)
    // We handle this in-memory to avoid infinite reload loops
    let search = window.location.search;
    if (search.includes('%3D') || search.includes('%3F')) {
        console.warn('Malformed URL detected. Fixing in-memory...');
        try {
            const decoded = decodeURIComponent(search);
            // Only update history if it looks like a valid query string now
            if (decoded.startsWith('?') || decoded.includes('=')) {
                search = decoded;
                const newUrl = window.location.pathname + search;
                window.history.replaceState(null, '', newUrl);
            }
        } catch (e) {
            console.warn("Failed to decode URL, proceeding with original:", e);
        }
    }

    const urlParams = new URLSearchParams(search);
    const envParam = urlParams.get('env');
    const storedEnv = localStorage.getItem('app_env');

    if (envParam === 'beta' || storedEnv === 'beta') {
        // Auto-persist if coming from URL so mobile users stay in Beta
        if (envParam === 'beta' && storedEnv !== 'beta') {
            localStorage.setItem('app_env', 'beta');
        }
        console.warn('⚠️ 🚧 RUNNING IN BETA FLIGHT MODE 🚧 ⚠️');
        return normalizeConfig(firebaseConfigBeta, 'beta');
    }

    return normalizeConfig(firebaseConfigProd, 'production');
}

function normalizeConfig(config, envName) {
    // Ensure all necessary keys exist or warn
    if (config.apiKey.includes('REPLACE')) {
        console.error(`❌ [${envName}] Firebase Config is missing! Please update firebase-config.js`);
    }
    return {
        ...config,
        _environment: envName
    };
}

export const activeConfig = getActiveConfig();

// Helper to switch modes from console
window.switchEnv = (env) => {
    if (env === 'reset') {
        localStorage.removeItem('app_env');
        console.log('Environment reset to Production. Reloading...');
    } else {
        localStorage.setItem('app_env', env);
        console.log(`Environment switched to ${env}. Reloading...`);
    }
    setTimeout(() => window.location.reload(), 1000);
};
