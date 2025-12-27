import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// --- Config ---
const firebaseConfig = {
    apiKey: "AIzaSyADrnYgh1fSTo3IZD7HOEJMyjduzDYIYSs",
    authDomain: "city-pave-estimator.firebaseapp.com",
    projectId: "city-pave-estimator",
    storageBucket: "city-pave-estimator.firebasestorage.app",
    messagingSenderId: "111714884839",
    appId: "1:111714884839:web:2b782a1b7be5be8edc5642"
};

let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

const qaAuth = getAuth(app);

// --- Module Registry Loader ---
// We need to fetch modules.json since we can't require it in the browser
let MODULE_REGISTRY = null;
async function loadModuleRegistry() {
    if (MODULE_REGISTRY) return MODULE_REGISTRY;
    try {
        // Try to fetch from root or relative path
        const response = await fetch('/modules.json');
        if (!response.ok) throw new Error("Failed to load modules.json");
        MODULE_REGISTRY = await response.json();
        console.log("[QA Agent] Module Registry Loaded:", Object.keys(MODULE_REGISTRY));
        return MODULE_REGISTRY;
    } catch (e) {
        console.error("[QA Agent] Could not load module registry. Crawl will be limited.", e);
        return null;
    }
}

// --- Classes ---

class Logger {
    constructor() {
        this.log = [];
        this.maxLogSize = 1000;
    }

    save(entry, type = 'info') {
        const timestamp = new Date().toISOString();
        const path = window.location.pathname;
        const logEntry = `[${timestamp}] [${type.toUpperCase()}] [${path}] ${entry}`;

        this.log.push(logEntry);
        if (this.log.length > this.maxLogSize) this.log.shift();

        // Persist to Session Storage
        try {
            const existing = sessionStorage.getItem('qa_session_logs') || '';
            let newLog = existing + logEntry + '\n';
            if (newLog.length > 500000) {
                newLog = newLog.substring(newLog.length - 500000);
            }
            sessionStorage.setItem('qa_session_logs', newLog);
        } catch (e) {
            console.warn("[QA Logger] Storage full");
        }

        // Cloud Logging Integration
        import('./logging.js').then(({ logAction, logError }) => {
            if (type === 'error') {
                logError(new Error(entry), { path, timestamp });
            } else {
                logAction('qa_log', { message: entry, type, path });
            }
        }).catch(err => console.warn("Failed to load cloud logging", err));
    }

    async export() {
        const logs = sessionStorage.getItem('qa_session_logs') || "No logs found.";
        console.log(`[QA Export] Logs (${logs.length} bytes):\n`, logs);

        // 1. Try Clipboard
        try {
            await navigator.clipboard.writeText(logs);
            alert("✅ Logs copied to Clipboard!\n(Paste them into a text file)\n\nAttempting file download...");
        } catch (e) {
            console.warn("Clipboard failed:", e);
            alert("⬇️ Starting download...");
        }

        // 2. File Download (Blob with long timeout)
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `chaos_monkey_logs_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();

        // Keep alive for 60 seconds to ensure download finishes
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 60000);
    }
}

class PermissionGuard {
    constructor() {
        this.currentUserRole = 'guest';
    }


    setRole(role) {
        this.currentUserRole = role;
    }

    canInteract(element) {
        // 1. Check data-roles attribute
        const rolesAttr = element.getAttribute('data-roles');
        if (rolesAttr) {
            const allowedRoles = rolesAttr.split(',');
            if (!allowedRoles.includes('all') && !allowedRoles.includes(this.currentUserRole)) {
                return false;
            }
        }

        // 2. Check if element is hidden
        if (element.offsetParent === null) return false;
        if (window.getComputedStyle(element).visibility === 'hidden') return false;
        if (element.disabled) return false;

        // 3. Exclusions
        if (element.id === 'logout-btn') return false;
        if (element.textContent && element.textContent.toLowerCase().includes('log out')) return false;
        if (element.closest('#qa-modal')) return false;
        if (element.id === 'qa-agent-btn') return false;

        return true;
    }

    validatePageAccess() {
        // Check if current page is allowed for the role
        // This requires mapping pages to roles, which might be in modules.json or inferred
        // For now, we'll rely on the app's internal checks, but we can log suspicious access
        const restrictedPages = {
            'admin': ['/admin-dashboard.html', '/developer-console.html'],
            'operations': ['/modules/operations/'],
            'finance': ['/modules/finance/']
        };

        // Simple check: if I'm a laborer, I shouldn't be in admin
        if (this.currentUserRole === 'laborer' || this.currentUserRole === 'crew') {
            if (window.location.pathname.includes('admin')) {
                return `[Security Alert] Role '${this.currentUserRole}' is on restricted page: ${window.location.pathname}`;
            }
        }
        return null;
    }
}

class ChaosEngine {
    constructor(logger, guard) {
        this.logger = logger;
        this.guard = guard;
        this.intervalId = null;
        this.isRunning = false;
        this.isPaused = false;

        // Monkey Patches
        this.originalAlert = null;
        this.originalConfirm = null;
        this.originalPrompt = null;
    }

    start(intervalMs = 800) {
        if (this.isRunning && !this.isPaused) return;

        this.isRunning = true;
        this.isPaused = false;
        sessionStorage.setItem('qa_chaos_active', 'true');

        this.overrideDialogs();
        this.logger.save("Chaos Monkey Started");
        console.log("🐒 Chaos Monkey Started");

        this.intervalId = setInterval(() => {
            this.performAction();
        }, intervalMs);
    }

    stop(silent = false) {
        clearInterval(this.intervalId);
        this.isRunning = false;
        this.isPaused = false;
        sessionStorage.removeItem('qa_chaos_active');
        this.restoreDialogs();

        if (!silent) {
            this.logger.save("Chaos Monkey Stopped");
            console.log("🐒 Chaos Monkey Stopped");
            alert("🐒 Chaos Monkey Stopped");
        }
    }

    pause() {
        if (this.isRunning) {
            clearInterval(this.intervalId);
            this.isPaused = true;
            console.log("[Chaos] Paused");
        }
    }

    resume() {
        if (this.isRunning && this.isPaused) {
            this.start(); // Re-starts interval
        }
    }

    performAction() {
        // 1. Random Navigation Back (Low chance)
        // Disable during crawl to avoid breaking the queue
        const isCrawl = sessionStorage.getItem('qa_crawl_active') === 'true';
        if (!isCrawl && Math.random() < 0.02) {
            this.logger.save("Action: History Back");
            history.back();
            return;
        }

        // 2. Find Clickables
        const candidates = document.querySelectorAll('button, a, input[type="checkbox"], input[type="radio"], select');
        const validCandidates = Array.from(candidates).filter(el => this.guard.canInteract(el));

        if (validCandidates.length === 0) return;

        // 3. Pick One
        const target = validCandidates[Math.floor(Math.random() * validCandidates.length)];

        // 4. Highlight & Click
        const originalBorder = target.style.outline;
        target.style.outline = "3px solid red";
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
            try {
                this.logger.save(`Clicking: <${target.tagName}> ${target.id || target.className || target.textContent.substring(0, 20)}`);
                target.click();
            } catch (e) {
                this.logger.save(`Error clicking: ${e.message}`, 'error');
            } finally {
                if (target) target.style.outline = originalBorder;
            }
        }, 100);
    }

    overrideDialogs() {
        if (this.originalAlert) return;
        this.originalAlert = window.alert;
        this.originalConfirm = window.confirm;
        this.originalPrompt = window.prompt;

        window.alert = (msg) => {
            this.logger.save(`[Alert Suppressed] ${msg}`);
            console.log(`[Chaos] Alert: ${msg}`);
            return true;
        };
        window.confirm = (msg) => {
            this.logger.save(`[Confirm Suppressed] ${msg} -> true`);
            console.log(`[Chaos] Confirm: ${msg}`);
            return true;
        };
        window.prompt = (msg) => {
            this.logger.save(`[Prompt Suppressed] ${msg} -> 'ChaosInput'`);
            console.log(`[Chaos] Prompt: ${msg}`);
            return "ChaosInput";
        };
    }

    restoreDialogs() {
        if (this.originalAlert) {
            window.alert = this.originalAlert;
            this.originalAlert = null;
        }
        if (this.originalConfirm) {
            window.confirm = this.originalConfirm;
            this.originalConfirm = null;
        }
        if (this.originalPrompt) {
            window.prompt = this.originalPrompt;
            this.originalPrompt = null;
        }
    }
}

class Navigator {
    constructor(logger) {
        this.logger = logger;
    }

    async startCrawl(chaosEngine) {
        if (!confirm("Start Exhaustive Crawl? This will visit all known modules.")) return;

        const registry = await loadModuleRegistry();
        if (!registry) {
            alert("Cannot load module registry. Crawl aborted.");
            return;
        }

        // Build Queue
        const queue = [];
        Object.values(registry).forEach(module => {
            if (module.mainHtml) {
                // Construct absolute path assuming standard structure
                // modules.json keys are like 'estimator', 'operations'
                // We need to map them to URL paths.
                // Assuming /modules/{name}/{mainHtml} or root for some?
                // Let's look at the file paths in registry.
                // The registry has 'files'. We can try to find the html files.

                // Heuristic: If mainHtml is 'estimator.html', path is likely /modules/estimator/estimator.html
                // UNLESS it's in the root.
                // We can check if the file path in 'files' array suggests a folder? 
                // Actually modulizer moves them to /modules/{name}/.
                // So we can construct paths: /modules/{moduleName}/{mainHtml}

                // Exception: 'admin' has 'admin-dashboard.html'.
                // Exception: 'estimator' has 'estimator.html'.

                // Let's just grab all .html files from the registry for maximum coverage
                module.files.forEach(f => {
                    if (f.endsWith('.html')) {
                        // Construct path
                        // We need to know the module key (e.g. 'estimator')
                        // We are iterating values, let's iterate entries
                    }
                });
            }
        });

        // Re-iterate with keys
        Object.entries(registry).forEach(([name, config]) => {
            config.files.forEach(file => {
                if (file.endsWith('.html')) {
                    // Modulizer moves files to /modules/{name}/{file}
                    // EXCEPT if they are in the root originally? 
                    // Modulizer SAYS: "Moved & Updated: {file} -> {moduleName}/{destFilename}"
                    // And "Rename main HTML to index.html"

                    let targetPath = `/modules/${name}/${file}`;
                    if (file === config.mainHtml) {
                        targetPath = `/modules/${name}/index.html`;
                    }
                    queue.push(targetPath);
                }
            });
        });

        // Add root pages manually if needed, or rely on them being in a 'root' module if we had one.
        // Current modules.json doesn't have root files like 'index.html' (login).
        // We'll add index.html manually.
        queue.unshift('/index.html');

        sessionStorage.setItem('qa_crawl_queue', JSON.stringify(queue));
        sessionStorage.setItem('qa_crawl_visited', JSON.stringify([]));
        sessionStorage.setItem('qa_crawl_active', 'true');

        this.logger.save(`Starting Crawl with ${queue.length} pages.`);
        chaosEngine.stop(true); // Stop any existing chaos

        this.processStep(chaosEngine);
    }

    processStep(chaosEngine) {
        if (sessionStorage.getItem('qa_crawl_active') !== 'true') return;

        const queue = JSON.parse(sessionStorage.getItem('qa_crawl_queue') || '[]');
        const visited = JSON.parse(sessionStorage.getItem('qa_crawl_visited') || '[]');
        const currentPath = window.location.pathname;

        // Mark current as visited
        if (!visited.includes(currentPath)) {
            visited.push(currentPath);
            sessionStorage.setItem('qa_crawl_visited', JSON.stringify(visited));
        }

        // Audit Page
        this.logger.save(`[Crawl] Auditing ${currentPath}`);

        // Visual Banner
        const banner = document.createElement('div');
        banner.className = "fixed top-0 left-0 w-full bg-yellow-400 text-black text-center font-bold z-[10000] py-1";
        banner.textContent = `🕵️ QA CRAWL: Auditing ${currentPath} (${queue.length} remaining)`;
        document.body.appendChild(banner);

        // Run Chaos for a bit
        chaosEngine.start(300); // Fast mode

        setTimeout(() => {
            chaosEngine.stop(true);
            if (document.body.contains(banner)) document.body.removeChild(banner);

            // Next
            const nextUrl = queue.shift();
            sessionStorage.setItem('qa_crawl_queue', JSON.stringify(queue));

            if (nextUrl) {
                this.logger.save(`[Crawl] Navigating to ${nextUrl}`);
                window.location.href = nextUrl;
            } else {
                alert("Crawl Complete!");
                sessionStorage.removeItem('qa_crawl_active');
            }
        }, 4000); // 4 seconds per page
    }
}

class SafetyAssistant {
    constructor(logger) {
        this.logger = logger;
        this.checkInterval = null;
    }

    startMonitoring() {
        if (this.checkInterval) return;

        // Initial Check
        setTimeout(() => this.runSafetyCheck(), 5000);

        // check every 5 minutes
        this.checkInterval = setInterval(() => {
            this.runSafetyCheck();
        }, 5 * 60 * 1000);

        console.log("[Safety Assistant] Monitoring Started.");
    }

    async runSafetyCheck() {
        if (!window.firebaseServices || !window.firebaseServices.auth.currentUser) return;

        const { db, collection, query, where, getDocs, auth } = window.firebaseServices;
        const user = auth.currentUser;
        const todayStr = new Date().toISOString().split('T')[0];

        try {
            // 1. Am I clocked in?
            const qActive = query(
                collection(db, "time_logs"),
                where("userId", "==", user.uid),
                where("status", "==", "active")
            );
            const activeSnap = await getDocs(qActive);

            if (activeSnap.empty) return; // Not working, no safety risk.

            // 2. Did I do a Pre-Trip today?
            // Need to query start of day
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const qPreTrip = query(
                collection(db, "form_submissions"),
                where("userId", "==", user.uid),
                where("formType", "==", "pre-trip"),
                where("submittedAt", ">=", todayStart.toISOString())
            );
            const formSnap = await getDocs(qPreTrip);

            if (formSnap.empty) {
                this.showWarning("⚠️ Safety Alert: You are working but haven't submitted a Pre-Trip Inspection today!");
                this.logger.save("Safety Assistant: Missing Pre-Trip Warning shown.");
            }

            // 3. Shift Duration Check
            const shiftData = activeSnap.docs[0].data();
            const startTime = new Date(shiftData.startTime);
            const hours = (new Date() - startTime) / 3600000;

            if (hours > 12) {
                this.showWarning("🛑 Fatigue Risk: You have been clocked in for over 12 hours. Please take a break or clock out.");
                this.logger.save("Safety Assistant: Fatigue Warning shown.");
            }

        } catch (e) {
            console.error("Safety Check Failed:", e);
        }
    }

    showWarning(msg) {
        // Reuse or create a non-intrusive toast
        let toast = document.getElementById('safety-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'safety-toast';
            toast.className = 'fixed top-20 right-4 bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 rounded shadow-lg z-[9998] max-w-sm flex items-start hidden';
            toast.innerHTML = `
                <div class="flex-1 mr-2">
                    <p class="font-bold text-sm">Safety Assistant</p>
                    <p class="text-xs mt-1" id="safety-msg"></p>
                </div>
                <button onclick="document.getElementById('safety-toast').classList.add('hidden')" class="text-orange-400 hover:text-orange-600">&times;</button>
            `;
            document.body.appendChild(toast);
        }

        document.getElementById('safety-msg').textContent = msg;
        toast.classList.remove('hidden');

        // Auto-hide after 15s
        setTimeout(() => toast.classList.add('hidden'), 15000);
    }
}

// --- Main Agent Object ---
export const QAAgent = {
    logger: new Logger(),
    guard: new PermissionGuard(),
    chaos: null, // Init in setup
    navigator: null, // Init in setup
    safety: null, // Init in setup

    init: () => {
        QAAgent.chaos = new ChaosEngine(QAAgent.logger, QAAgent.guard);
        QAAgent.navigator = new Navigator(QAAgent.logger);
        QAAgent.safety = new SafetyAssistant(QAAgent.logger);

        // Start Safety Monitor (Passive)
        QAAgent.safety.startMonitoring();

        // Global Error Traps
        window.onerror = (msg, url, line, col, error) => {
            QAAgent.logger.save(`[Global Error] ${msg} at ${url}:${line}`, 'error');
        };
        window.addEventListener('unhandledrejection', (e) => {
            QAAgent.logger.save(`[Unhandled Rejection] ${e.reason}`, 'error');
        });

        console.log("[QA Agent] Initialized.");
    },

    // UI Actions
    toggleMenu: () => {
        QAAgent.chaos.pause();
        // ... (UI Modal Logic - kept similar to before but cleaner)
        // For brevity, reusing the existing UI injection logic but calling new methods
        renderQAModal();
    }
};

// --- UI Rendering ---
function renderQAModal() {
    let modal = document.getElementById('qa-modal');
    if (modal) {
        modal.classList.remove('hidden');
        return;
    }

    modal = document.createElement('div');
    modal.id = 'qa-modal';
    modal.className = 'fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center backdrop-blur-sm';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 shadow-2xl w-80 border border-gray-200">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-lg text-gray-800">🐞 QA Tools</h3>
                <button id="close-qa-x" class="text-gray-400 hover:text-red-500 text-2xl">&times;</button>
            </div>
            <div class="space-y-2">
                <button id="btn-chaos-start" class="qa-btn bg-gray-50 hover:bg-blue-50 text-blue-700">🐒 Start Chaos Monkey</button>
                <button id="btn-chaos-stop" class="qa-btn bg-gray-50 hover:bg-green-50 text-green-700">✋ Stop Chaos Monkey</button>
                <button id="btn-crawl" class="qa-btn bg-gray-50 hover:bg-indigo-50 text-indigo-700">🕵️ Start Exhaustive Crawl</button>
                <button id="btn-export" class="qa-btn bg-gray-50 hover:bg-teal-50 text-teal-700">💾 Export Logs</button>
                <button id="btn-report" class="qa-btn bg-gray-50 hover:bg-orange-50 text-orange-700">📝 Report Issue</button>
            </div>
            <div class="mt-4 text-center">
                <p class="text-[10px] text-gray-400">Shift + Esc to Stop</p>
            </div>
        </div>
        <style>
            .qa-btn { width: 100%; text-align: left; padding: 12px; border-radius: 8px; font-weight: 500; transition: all 0.2s; border: 1px solid #f3f4f6; }
        </style>
    `;
    document.body.appendChild(modal);

    // Bind Events
    document.getElementById('close-qa-x').onclick = () => {
        modal.classList.add('hidden');
        QAAgent.chaos.resume();
    };

    document.getElementById('btn-chaos-start').onclick = () => {
        modal.classList.add('hidden');
        QAAgent.chaos.start();
    };
    document.getElementById('btn-chaos-stop').onclick = () => {
        modal.classList.add('hidden');
        QAAgent.chaos.stop();
    };
    document.getElementById('btn-crawl').onclick = () => {
        modal.classList.add('hidden');
        QAAgent.navigator.startCrawl(QAAgent.chaos);
    };
    document.getElementById('btn-export').onclick = () => {
        QAAgent.logger.export();
    };
    document.getElementById('btn-report').onclick = () => {
        const note = prompt("Issue Description:");
        if (note) {
            QAAgent.logger.save(`[User Report] ${note}`, 'report');
            console.log("Issue logged. Downloading report now...");
            QAAgent.logger.export();
        }
    };
}

// --- Bootstrapper ---
document.addEventListener('DOMContentLoaded', () => {
    QAAgent.init();

    // Auth Check
    const checkUser = (user) => {
        if (user) {
            // Fetch role if possible, for now default to 'staff'
            // In a real app we'd get the claim or firestore doc
            QAAgent.guard.setRole('staff'); // Placeholder

            // Inject Button with Retry for FloatingDock
            const injectBtn = (attempts = 0) => {
                if (window.FloatingDock) {
                    window.FloatingDock.addButton({
                        id: 'qa-agent-btn',
                        label: 'QA Tools',
                        icon: '🐞',
                        color: '#dc2626', // red-600
                        onClick: QAAgent.toggleMenu
                    });
                } else if (attempts < 10) {
                    // Wait and retry (FloatingDock might load slightly later)
                    setTimeout(() => injectBtn(attempts + 1), 200);
                } else {
                    // Fallback to legacy button if Dock never appears
                    if (!document.getElementById('qa-agent-btn')) {
                        const btn = document.createElement('button');
                        btn.id = 'qa-agent-btn';
                        btn.textContent = "🐞";
                        btn.className = "fixed bottom-4 left-4 bg-red-600 text-white rounded-full w-12 h-12 shadow-lg z-50 font-bold hover:bg-red-700 flex items-center justify-center text-2xl";
                        btn.onclick = QAAgent.toggleMenu;
                        document.body.appendChild(btn);
                    }
                }
            };
            injectBtn();

            // Auto-Resume
            if (sessionStorage.getItem('qa_chaos_active') === 'true') {
                QAAgent.chaos.start();
            }
            if (sessionStorage.getItem('qa_crawl_active') === 'true') {
                setTimeout(() => QAAgent.navigator.processStep(QAAgent.chaos), 1000);
            }
        }
    };

    if (window.firebaseServices && window.firebaseServices.auth) {
        onAuthStateChanged(window.firebaseServices.auth, checkUser);
    } else {
        onAuthStateChanged(qaAuth, checkUser);
    }

    // Shortcut
    document.addEventListener('keydown', (e) => {
        if (e.shiftKey && e.key === 'Escape') {
            QAAgent.chaos.stop();
        }
    });
});
