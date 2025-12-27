const fs = require('fs');
const path = require('path');

// Configuration: Modules and their files
// Loaded from shared modules.json
const MODULES = require('./modules.json');

// Shared files that should stay in root (or move to core, but we leave in root for now)
// qa-agent.js seems shared.
// navigation.js, style.css, config.js, firebase.json, index.html (login)

const SHARED_FILES = ['navigation.js', 'style.css', 'config.js', 'qa-agent.js', 'theme-engine.js', 'storage-gatekeeper.js'];

function processModule(moduleName, config) {
    console.log(`\nProcessing Module: ${moduleName}...`);
    const moduleDir = path.join(__dirname, 'modules', moduleName);

    // 1. Create Directory
    if (!fs.existsSync(moduleDir)) {
        fs.mkdirSync(moduleDir, { recursive: true });
        console.log(`  Created directory: ${moduleDir} `);
    }

    // 2. Move Files
    config.files.forEach(file => {
        const srcPath = path.join(__dirname, file);
        let destFilename = file;

        // Rename main HTML to index.html
        if (file === config.mainHtml) {
            destFilename = 'index.html';
        }

        const destPath = path.join(moduleDir, destFilename);

        if (fs.existsSync(srcPath)) {
            // Read content to update paths BEFORE moving (easier to debug if needed)
            let content = fs.readFileSync(srcPath, 'utf8');

            // 3. Refactor Paths
            content = updatePaths(content, file);

            // Write to new location
            fs.writeFileSync(destPath, content);

            // Delete old file
            fs.unlinkSync(srcPath);
            console.log(`  Moved & Updated: ${file} -> ${moduleName}/${destFilename}`);
        } else {
            console.warn(`  WARNING: File not found: ${file}`);
        }
    });
}

function updatePaths(content, filename) {
    // Simple regex replacements for common shared resources
    // We assume the module is 2 levels deep: modules/moduleName/
    // So we need to go up 2 levels: ../../

    const isHtml = filename.endsWith('.html');
    const isJs = filename.endsWith('.js');

    if (isHtml) {
        // CSS
        content = content.replace(/href="style.css"/g, 'href="../../style.css"');
        // Navigation
        content = content.replace(/src="navigation.js"/g, 'src="../../navigation.js"');
        // QA Agent
        content = content.replace(/src="qa-agent.js"/g, 'src="../../qa-agent.js"');
        // Config (if script tag)
        content = content.replace(/src="config.js"/g, 'src="../../config.js"');
    }

    if (isJs || isHtml) {
        // JS Imports
        // import ... from './config.js' -> '../../config.js'
        content = content.replace(/from ['"]\.\/config\.js['"]/g, "from '../../config.js'");
        content = content.replace(/from ['"]\.\/navigation\.js['"]/g, "from '../../navigation.js'");
        content = content.replace(/from ['"]\.\/theme-engine\.js['"]/g, "from '../../theme-engine.js'");
        content = content.replace(/from ['"]\.\/storage-gatekeeper\.js['"]/g, "from '../../storage-gatekeeper.js'");

        // Fix imports for other shared files if needed
    }

    return content;
}

// Run
Object.keys(MODULES).forEach(name => {
    // Skip admin for now to be safe? Or just go for it? 
    // User said "unleash".
    // We skip 'qa-agent.js' in admin module definition above to keep it shared.
    if (name === 'admin') {
        // Remove qa-agent from admin files list dynamically to be safe
        MODULES.admin.files = MODULES.admin.files.filter(f => f !== 'qa-agent.js');
    }
    processModule(name, MODULES[name]);
});

console.log("\nDone! Please update navigation.js manually to point to the new locations.");
