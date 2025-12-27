/**
 * CockpitDashboard (Pilot Mode)
 * Defines the high-contrast, large-touch-target UI for drivers.
 */
export class CockpitDashboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.state = {
            isDriving: false,
            currentJob: null,
            alerts: []
        };
    }

    init(user) {
        this.render();
        this.attachListeners();
        this.showWelcome(user);
    }

    render() {
        if (!this.container) return;

        // Industrial SaaS 2.0 HUD Grid
        this.container.innerHTML = `
            <!-- Top Bar: Status & Time -->
            <div class="absolute top-0 left-0 right-0 h-16 bg-slate-950/95 backdrop-blur-md flex items-center justify-between px-6 border-b border-slate-800 z-50 pointer-events-auto shadow-sm" style="pointer-events: auto;">
                <div class="flex items-center space-x-4">
                    <!-- Exit Button (Top Left - Back Arrow Pattern) -->
                    <button id="btn-exit-nav" class="flex items-center gap-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-200 px-4 py-2 rounded-lg border border-red-900/30 transition-all group">
                        <svg class="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        <span class="font-bold tracking-wide text-sm">EXIT</span>
                    </button>
                    
                    <span class="text-slate-200 text-lg font-mono tracking-wider font-semibold border-l border-slate-700 pl-4 ml-2" id="clock-display">--:--</span>
                    <!-- ETA Display (added for nav-app.js) -->
                    <span id="nav-eta" class="hidden ml-4 text-blue-400 text-sm font-mono font-bold bg-blue-500/10 px-2 py-1 rounded border border-blue-500/30"></span>
                </div>

                <div class="flex items-center space-x-4">
                    <!-- Online Status (Moved to Right) -->
                    <div class="hidden md:flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700">
                        <div id="connection-status" class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                        <span class="text-[10px] font-bold text-green-500 tracking-wider">ONLINE</span>
                    </div>

                    <!-- Dash Cam Status & Control (Moved here) -->
                    <div id="btn-dashcam-status" class="flex items-center gap-3 bg-slate-900/30 px-3 py-1 rounded-lg border border-slate-800/50 cursor-pointer">
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">DASH CAM</span>
                             <div class="flex items-center gap-2">
                                <span id="rec-dot-top" class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                <span class="text-xs font-mono text-red-500 font-bold">REC</span>
                            </div>
                        </div>
                            </div>
                        </div>
                        <div id="cam-controls" class="flex gap-1">
                             <button id="btn-cam-switch" class="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/50 p-2 rounded-md transition-colors" title="Switch Camera (Front/Rear)">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            </button>
                            <button id="btn-record-clip" class="bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/50 p-2 rounded-md transition-colors" title="Save Incident Clip">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                        </div>
                    </div>

                    <!-- G-Force Meter (Compact) -->
                    <div id="g-force-meter" class="hidden md:flex flex-col items-end opacity-80">
                        <div class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">G-FORCE</div>
                        <div class="flex gap-1 h-3 mt-0.5">
                             <div class="w-1 bg-green-500 rounded-sm opacity-20" id="gf-1"></div>
                             <div class="w-1 bg-green-500 rounded-sm opacity-20" id="gf-2"></div>
                             <div class="w-1 bg-yellow-500 rounded-sm opacity-20" id="gf-3"></div>
                             <div class="w-1 bg-red-500 rounded-sm opacity-20" id="gf-4"></div>
                        </div>
                    </div>

                    <!-- System Status -->
                     <div class="flex items-center gap-2 group cursor-pointer" id="btn-sys-status">
                        <div class="flex gap-1">
                            <div class="w-1.5 h-4 bg-blue-500/80 rounded-sm"></div>
                            <div class="w-1.5 h-4 bg-blue-500/60 rounded-sm"></div>
                            <div class="w-1.5 h-4 bg-blue-500/40 rounded-sm"></div>
                        </div>
                    </div>


                </div>
            </div>

            <!-- Bottom Control Deck (Restored 4-Button Grid) -->
            <div class="absolute bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 p-4 pb-8 z-50 pointer-events-auto shadow-[0_-4px_20px_rgba(0,0,0,0.4)]" style="pointer-events: auto;">
                <div class="grid grid-cols-4 gap-3 max-w-7xl mx-auto h-24">
                    
                    <!-- 1. Load Wizard (Large) -->
                    <button id="btn-load-wizard" class="col-span-1 md:col-span-1 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg shadow-lg flex flex-col items-center justify-center p-3 active:scale-[0.98] transition-all border border-blue-500/50 group relative overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                        <svg class="w-8 h-8 mb-1 text-blue-100 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        <span class="text-xs md:text-sm font-bold tracking-wide font-sans">LOAD WIZARD</span>
                    </button>

                    <!-- 2. Route -->
                    <button id="btn-route" class="bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg shadow-md flex flex-col items-center justify-center p-3 active:scale-[0.98] transition-all border border-slate-700 group">
                        <svg class="w-6 h-6 mb-1 text-indigo-400 group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 7"></path></svg>
                        <span class="text-xs md:text-sm font-semibold tracking-wide text-slate-200">ROUTE</span>
                    </button>

                    <!-- 3. Incident -->
                    <button id="btn-incident" class="bg-gradient-to-b from-red-900/40 to-slate-900 hover:from-red-900/60 hover:to-slate-800 text-white rounded-lg shadow-md flex flex-col items-center justify-center p-3 active:scale-[0.98] transition-all border border-red-900/50 group">
                        <svg class="w-6 h-6 mb-1 text-red-500 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        <span class="text-xs md:text-sm font-semibold tracking-wide text-red-100">INCIDENT</span>
                    </button>

                    <!-- 4. Menu (Restored to main grid) -->
                    <button id="btn-menu" class="bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg shadow-md flex flex-col items-center justify-center p-3 active:scale-[0.98] transition-all border border-slate-700 group">
                        <svg class="w-6 h-6 mb-1 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        <span class="text-xs md:text-sm font-semibold tracking-wide text-slate-200">MENU</span>
                    </button>
                </div>
            </div>

            <!-- AI Overlay Container (Centered Warnings) -->
            <div id="ai-overlay-container" class="absolute top-24 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-40 pointer-events-none">
                <!-- Alerts injected here -->
            </div>
        `;

        this.startClock();
    }

    startClock() {
        // ... existing startClock ...
        const update = () => {
            const now = new Date();
            const el = document.getElementById('clock-display');
            if (el) el.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        update();
        setInterval(update, 1000);
    }

    showWelcome(user) {
        // ... existing showWelcome ...
        const name = user.displayName || 'Driver';
        this.showAiAlert(`Welcome back, ${name}. Systems online.`, 'info');
    }

    showAiAlert(message, type = 'info') {
        // ... existing showAiAlert ...
        const container = document.getElementById('ai-overlay-container');
        if (!container) return;

        const alertEl = document.createElement('div');
        const colors = type === 'warning' ? 'bg-red-500/90 border-red-400' : 'bg-blue-600/90 border-blue-400';

        alertEl.className = `mx-4 my-2 p-4 rounded-lg shadow-2xl border ${colors} backdrop-blur text-white flex items-center justify-between animate-bounce-in pointer-events-auto`;
        alertEl.innerHTML = `
            <div class="flex items-center">
                <span class="text-3xl mr-4">${type === 'warning' ? '⚠️' : '🤖'}</span>
                <span class="text-xl font-medium">${message}</span>
            </div>
            <button class="ml-4 bg-white/20 hover:bg-white/30 rounded-full p-2" onclick="this.parentElement.remove()">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;

        container.appendChild(alertEl);

        if (type === 'info') {
            setTimeout(() => {
                if (alertEl.parentElement) alertEl.remove();
            }, 5000);
        }
    }

    attachListeners() {
        this.container.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.id === 'btn-load-wizard' || target.closest('#btn-load-wizard')) {
                this.renderLoadWizard((data) => {
                    console.log("Load Wizard Complete:", data);
                    if (this.onLoadComplete) this.onLoadComplete(data);
                });
            }
            else if (target.id === 'btn-route' || target.closest('#btn-route')) {
                this.renderRoutePlanner((routeData) => {
                    console.log("Route Planned:", routeData); // NavApp will handle this via callback binding if we verify it later, or we can emit event
                    // For now, let's assume NavApp passed a callback or listens 
                    if (this.onRouteRequested) this.onRouteRequested(routeData);
                });
            }
            else if (target.id === 'btn-incident' || target.closest('#btn-incident')) {
                this.renderIncidentModal((data) => {
                    console.log("Incident Logged:", data);
                    if (this.onExceptionLogged) this.onExceptionLogged(data);
                });
            }
            else if (target.id === 'btn-dashcam' || target.closest('#btn-dashcam')) {
                if (this.onDashCamToggle) this.onDashCamToggle();
            }
            else if (target.id === 'btn-snapshot' || target.closest('#btn-snapshot')) {
                if (this.onSnapshot) this.onSnapshot();
            }
            else if (target.id === 'btn-record-clip' || target.closest('#btn-record-clip')) {
                if (this.onRecordClip) this.onRecordClip();
            }
            else if (target.id === 'btn-menu' || target.closest('#btn-menu')) {
                // Launch Job Selector (Mission Control)
                this.renderJobSelector((selected) => {
                    console.log("Mission Selected:", selected);
                    if (this.onMissionChanged) this.onMissionChanged(selected);
                });
            }
        });

        // Toggle Dash Cam Preview
        const camBtn = this.container.querySelector('#btn-dashcam-status');
        if (camBtn) {
            camBtn.addEventListener('click', () => {
                console.log("[Cockpit] Dash Cam Toggle Clicked");
                const videoContainer = document.getElementById('dashcam-display');
                if (videoContainer) {
                    const video = videoContainer.querySelector('video');
                    if (video) {
                        const isHidden = video.classList.toggle('hidden');
                        console.log("[Cockpit] Video Visibility Toggled. Hidden?", isHidden);
                        // Visual feedback on button
                        camBtn.classList.toggle('bg-slate-800');
                    } else {
                        console.warn("[Cockpit] No video element found in dashcam-display");
                    }
                }
            });
            // Add cursor pointer to indicate interactivity
            camBtn.classList.add('cursor-pointer', 'hover:bg-slate-800', 'transition-colors');
        }

        // Listeners for new Top Bar buttons
        // Duplicate btn-record-clip listener removed (handled by delegation above)

        const switchBtn = this.container.querySelector('#btn-cam-switch');
        if (switchBtn) {
            switchBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent toggling hide/show parent
                if (this.onCamSwitch) this.onCamSwitch();
            });
        }

        // System Status Click (Hidden Dev Menu)
        const sysBtn = this.container.querySelector('#btn-sys-status');
        if (sysBtn) {
            sysBtn.addEventListener('click', () => {
                this.showPrompt("System Diagnostics", "Select a diagnostic tool:", [
                    {
                        label: "⚠️ Simulate Impact (Test)",
                        style: "bg-red-900 border border-red-500 hover:bg-red-800",
                        onClick: () => this.onDevSimulateImpact && this.onDevSimulateImpact()
                    },
                    { label: "Close", style: "bg-gray-600", onClick: () => { } }
                ]);
            });
        }

        // Exit Button Listener
        const exitBtn = this.container.querySelector('#btn-exit-nav');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                // Determine restart URL (preserve env)
                const isBeta = window.location.search.includes('env=beta') || localStorage.getItem('app_env') === 'beta';
                const dest = isBeta ? '/index.html?env=beta' : '/index.html';
                window.location.href = dest;
            });
        }
    }

    renderIncidentModal(onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto';

        let currentState = 'reason'; // reason | details
        let selectedReason = null;

        const updateContent = () => {
            if (currentState === 'reason') {
                modal.innerHTML = `
                    <div class="bg-gray-900 w-full max-w-3xl rounded-2xl border border-red-500/50 shadow-2xl overflow-hidden animate-slide-up">
                        <div class="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <h2 class="text-2xl font-bold text-white tracking-wide">REPORT STOP / INCIDENT</h2>
                            <button id="btn-close-inc" class="text-gray-400 hover:text-white"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                        </div>
                            <button class="reason-btn col-span-2 bg-red-600 p-6 rounded-xl border border-red-500 hover:bg-red-500 transition-all flex flex-col items-center animate-pulse" data-reason="Accident">
                                <span class="text-4xl mb-2">💥</span>
                                <span class="text-2xl font-black text-white uppercase">ACCIDENT / CRASH</span>
                                <span class="text-sm text-red-100 mt-1 font-bold">Report & Save Video</span>
                            </button>
                            <button class="reason-btn bg-gray-700 p-6 rounded-xl border border-gray-600 hover:bg-red-900/50 hover:border-red-500 transition-all flex flex-col items-center" data-reason="Breakdown">
                                <span class="text-4xl mb-2">🔧</span>
                                <span class="text-xl font-bold text-white">Breakdown</span>
                                <span class="text-sm text-gray-400 mt-1">Equipment Failure</span>
                            </button>
                            <button class="reason-btn bg-gray-700 p-6 rounded-xl border border-gray-600 hover:bg-yellow-900/50 hover:border-yellow-500 transition-all flex flex-col items-center" data-reason="Traffic">
                                <span class="text-4xl mb-2">🚧</span>
                                <span class="text-xl font-bold text-white">Traffic / Blocked</span>
                                <span class="text-sm text-gray-400 mt-1">Road Issue</span>
                            </button>
                            <button class="reason-btn bg-gray-700 p-6 rounded-xl border border-gray-600 hover:bg-purple-900/50 hover:border-purple-500 transition-all flex flex-col items-center" data-reason="Supply">
                                <span class="text-4xl mb-2">🛒</span>
                                <span class="text-xl font-bold text-white">Supply Run</span>
                                <span class="text-sm text-gray-400 mt-1">Parts / Materials</span>
                            </button>
                            <button class="reason-btn bg-gray-700 p-6 rounded-xl border border-gray-600 hover:bg-blue-900/50 hover:border-blue-500 transition-all flex flex-col items-center" data-reason="Personal">
                                <span class="text-4xl mb-2">☕</span>
                                <span class="text-xl font-bold text-white">Personal / Other</span>
                                <span class="text-sm text-gray-400 mt-1">Break / Admin</span>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                modal.innerHTML = `
                    <div class="bg-gray-900 w-full max-w-2xl rounded-2xl border border-red-500/50 shadow-2xl overflow-hidden animate-slide-up">
                        <div class="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <h2 class="text-2xl font-bold text-white tracking-wide">${selectedReason.toUpperCase()} DETAILS</h2>
                            <button id="btn-back-inc" class="text-gray-400 hover:text-white text-sm font-bold">BACK</button>
                        </div>
                        <div class="p-6 space-y-4">
                            <div>
                                <label class="block text-gray-400 text-sm font-bold mb-2">Description / Situation</label>
                                <textarea id="inc-desc" class="w-full bg-gray-800 text-white rounded-xl p-4 border border-gray-600 focus:border-red-500 outline-none h-32" placeholder="Describe the issue..."></textarea>
                            </div>
                            
                            <div>
                                <label class="block text-gray-400 text-sm font-bold mb-2">Attachments (Photo/Video)</label>
                                <div class="flex space-x-4">
                                    <button class="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center border border-gray-500 dashed">
                                        <span class="mr-2">📷</span> Take Photo
                                    </button>
                                    <button class="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center border border-gray-500 dashed">
                                        <span class="mr-2">🎥</span> Record Video
                                    </button>
                                </div>
                                <div class="text-xs text-gray-500 mt-2">* Uploads will link to Job Ticket and Daily Record</div>
                            </div>

                            <button id="btn-submit-inc" class="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white rounded-xl font-bold text-xl shadow-lg mt-4">
                                SUBMIT REPORT
                            </button>
                        </div>
                    </div>
                `;
            }

            // Re-attach listeners after HTML update
            const closeBtn = modal.querySelector('#btn-close-inc');
            if (closeBtn) closeBtn.onclick = () => modal.remove();

            const backBtn = modal.querySelector('#btn-back-inc');
            if (backBtn) backBtn.onclick = () => { currentState = 'reason'; updateContent(); };

            const reasonBtns = modal.querySelectorAll('.reason-btn');
            reasonBtns.forEach(btn => {
                btn.onclick = () => {
                    selectedReason = btn.dataset.reason;
                    currentState = 'details';
                    updateContent();
                };
            });

            const submitBtn = modal.querySelector('#btn-submit-inc');
            if (submitBtn) submitBtn.onclick = () => {
                const desc = modal.querySelector('#inc-desc').value;
                onConfirm({
                    type: selectedReason,
                    description: desc,
                    timestamp: Date.now(),
                    attachments: [] // Mock
                });
                modal.remove();

                // Show floating "RESUME" banner
                // this.showResumeBanner(); // Future implementation
            };
        };

        updateContent();
        this.container.appendChild(modal);
    }



    renderRoutePlanner(onConfirm) {
        // Create Modal
        const modal = document.createElement('div');
        modal.className = 'absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto';
        modal.innerHTML = `
             <div class="bg-gray-900 w-full max-w-2xl rounded-2xl border border-indigo-500/50 shadow-2xl flex flex-col overflow-hidden animate-slide-up">
                <div class="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                    <h2 class="text-2xl font-bold text-white tracking-wide">ROUTE PLANNER</h2>
                    <button id="btn-close-route" class="text-gray-400 hover:text-white transition-colors">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                <div class="p-8 space-y-6">
                    <!-- Start -->
                    <div class="relative">
                        <label class="block text-gray-400 text-xs font-bold uppercase mb-1">Start Location</label>
                        <div class="flex items-center bg-gray-700 rounded-xl p-2 border border-blue-500/30">
                            <span class="text-blue-400 mr-3 text-xl">◎</span>
                            <input type="text" id="route-start" value="Current Location" class="bg-transparent text-white w-full outline-none font-medium" placeholder="Current Location">
                        </div>
                    </div>

                    <!-- Destination -->
                    <div class="relative">
                        <label class="block text-gray-400 text-xs font-bold uppercase mb-1">Destination</label>
                        <div class="flex items-center bg-gray-700 rounded-xl p-2 border border-indigo-500/50">
                            <span class="text-red-400 mr-3 text-xl">📍</span>
                            <input type="text" id="route-dest" class="bg-transparent text-white w-full outline-none font-medium" placeholder="Search Address or Place..." autofocus>
                        </div>
                    </div>

                    <!-- Quick suggestions -->
                    <div class="flex space-x-2 overflow-x-auto pb-2">
                        <button class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-xs text-gray-300 whitespace-nowrap" onclick="document.getElementById('route-dest').value='Shop (HQ)'">🏠 Shop</button>
                        <button class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-xs text-gray-300 whitespace-nowrap" onclick="document.getElementById('route-dest').value='Fuel Station'">⛽ Fuel</button>
                        <button class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-xs text-gray-300 whitespace-nowrap" onclick="document.getElementById('route-dest').value='Site A'">🏗️ Site A</button>
                    </div>
                
                    <button id="btn-go-route" class="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-xl shadow-lg transform transition active:scale-95 flex items-center justify-center">
                        <span>START NAVIGATION</span>
                        <svg class="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>
        `;

        this.container.appendChild(modal);

        // Focus
        const destInput = modal.querySelector('#route-dest');
        setTimeout(() => destInput.focus(), 100);

        // Attach Google Places Autocomplete
        if (window.google && google.maps && google.maps.places) {
            const autocomplete = new google.maps.places.Autocomplete(destInput);
            autocomplete.bindTo('bounds', window.navApp ? window.navApp.map : null);
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.formatted_address) {
                    destInput.value = place.formatted_address;
                }
            });
        } else {
            console.warn("Google Maps Places API not loaded");
        }

        // Handlers
        modal.querySelector('#btn-close-route').onclick = () => modal.remove();

        modal.querySelector('#btn-go-route').onclick = () => {
            const start = modal.querySelector('#route-start').value;
            const dest = modal.querySelector('#route-dest').value;
            if (!dest) return;

            onConfirm({ start, dest });
            modal.remove();
        };
    }

    // ...

    updateConnectionStatus(status) {
        const el = document.getElementById('connection-status');
        if (!el) return;

        // Reset base classes (keep shape)
        el.className = 'w-4 h-4 rounded-full transition-all duration-500';

        switch (status) {
            case 'online':
                el.classList.add('bg-green-500', 'shadow-[0_0_10px_rgba(34,197,94,0.8)]');
                break;
            case 'connecting':
                el.classList.add('bg-yellow-400', 'animate-pulse', 'shadow-[0_0_10px_rgba(250,204,21,0.5)]');
                break;
            case 'offline':
                el.classList.add('bg-red-500', 'shadow-none');
                break;
            default:
                el.classList.add('bg-gray-500');
        }
    }

    renderJobSelector(callback) {
        import('./job-selector.js').then(module => {
            const selector = new module.JobSelector('nav-ui', {
                onJobSelected: (selection) => {
                    this.showAiAlert(`Mission Set: ${selection.data.client || selection.data.label}`, "info");
                    callback(selection);
                },
                onCancel: () => console.log("Job Selection Cancelled")
            });
            selector.render();
        }).catch(err => console.error("Failed to load Job Selector", err));
    }

    // --- Interface Methods required by NavigationApp ---

    updateSpeed(mph) {
        // ... existing ...
    }

    updateGForce(force) {
        const el1 = document.getElementById('gf-1');
        const el2 = document.getElementById('gf-2');
        const el3 = document.getElementById('gf-3');
        const el4 = document.getElementById('gf-4');
        if (!el1) return;

        // Reset
        [el1, el2, el3, el4].forEach(e => e.classList.remove('opacity-100'));
        [el1, el2, el3, el4].forEach(e => e.classList.add('opacity-20'));

        // Thresholds: 1.0 (Bumps), 2.0 (Hard Turn), 3.0 (Warn), 5.0 (Crash)
        // Scaled roughly for visualization of "Activity"
        // Raw Force ~9.8 is base. We subtract 9.8 or use deviation.
        // Actually, pure force is ~9.8 at rest.
        // Let's assume we map 10-40 range.

        if (force > 12) el1.classList.add('opacity-100', 'bg-green-500'); // > ~1.2G
        if (force > 15) el2.classList.add('opacity-100', 'bg-green-400'); // > ~1.5G
        if (force > 20) el3.classList.add('opacity-100', 'bg-yellow-500'); // > ~2G
        if (force > 30) el4.classList.add('opacity-100', 'bg-red-500');    // > ~3G (Crash Threshold)
    }

    updateInstruction(text, distance) {
        // Create or update the instruction banner
        let banner = document.getElementById('nav-instruction-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'nav-instruction-banner';
            banner.className = 'absolute top-24 left-4 right-4 bg-black/80 text-white p-4 rounded-xl border border-blue-500/50 backdrop-blur pointer-events-none z-30 flex justify-between items-center transition-all';
            this.container.appendChild(banner);
        }
        banner.innerHTML = `
            <span class="text-2xl font-bold text-yellow-400">${distance}</span>
            <span class="text-xl font-medium truncate ml-4">${text}</span>
        `;
    }

    updateJobTitle(title, jobData = null) {
        // Store data immediately so click handler has access to latest
        if (jobData) this.currentJobData = jobData;

        // We'll use a fixed top-center banner for this now, replacing the simple text
        // Ensure container exists
        let banner = document.getElementById('active-job-banner');

        // Remove simple text element if it existed from old version to avoid clutter
        const oldSimple = document.getElementById('job-title-display');
        if (oldSimple) oldSimple.remove();

        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'active-job-banner';
            // Industrial Style: Slate-950, sharper corners (rounded-b-lg), subtle border
            banner.className = 'absolute top-16 left-1/2 transform -translate-x-1/2 bg-slate-950/95 border-x border-b border-slate-700 rounded-b-lg px-6 py-2 backdrop-blur-md shadow-lg z-50 flex items-center space-x-6 transition-all cursor-pointer hover:bg-slate-900 pointer-events-auto min-w-[300px] justify-center';

            this.container.appendChild(banner);
        }

        // Always update click handler to be safe
        banner.onclick = (e) => {
            if (this.currentJobData) {
                console.log("Opening Job Details for:", this.currentJobData);
                this.renderJobDetailsModal(this.currentJobData);
            } else {
                console.warn("No Job Data available to show details");
            }
        };

        // If no title/job, hide
        if (!title || title === "Manual Location") {
            banner.style.display = 'none';
            return;
        }

        banner.style.display = 'flex';
        banner.innerHTML = `
            <div class="flex flex-col items-center pointer-events-none">
                <span class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mb-0.5">CURRENT MISSION</span>
                <span class="text-lg font-mono font-bold text-white tracking-wide">${title}</span>
            </div>
            ${this.currentJobData ? `
                <div class="h-8 w-px bg-slate-800 mx-4 pointer-events-none"></div>
                <button id="btn-job-details" class="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 p-1.5 rounded transition-colors pointer-events-none" title="View Details">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </button>
            ` : ''}
        `;
    }

    renderJobDetailsModal(job) {
        const modal = document.createElement('div');
        modal.className = 'absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto';
        modal.innerHTML = `
             <div class="bg-slate-950 w-full max-w-4xl h-[85vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-slide-up">
                <!-- Header -->
                <div class="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h2 class="text-3xl font-bold text-white tracking-wide font-sans">${job.client}</h2>
                        <span class="text-slate-400 flex items-center mt-1 text-sm font-mono">
                            <span class="mr-2 text-blue-500">📍</span> ${job.address}
                        </span>
                    </div>
                    <button id="btn-close-details" class="text-slate-500 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg hover:bg-slate-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div class="flex-1 grid grid-cols-3 divide-x divide-slate-800 overflow-hidden">
                    
                    <!-- Col 1: Work Order -->
                    <div class="col-span-2 p-8 overflow-y-auto bg-slate-950">
                        <section class="mb-8">
                            <h3 class="text-blue-500 font-bold uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 text-xs">Work Order Details</h3>
                            <p class="text-lg text-slate-300 leading-relaxed font-light">${job.workOrderDetails || 'No specific instructions provided.'}</p>
                        </section>

                        <section>
                            <h3 class="text-purple-400 font-bold uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 text-xs">Today's Performance</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                    <span class="block text-slate-500 text-xs uppercase font-bold mb-1">Loads Completed</span>
                                    <span class="block text-3xl font-mono font-bold text-white">${job.stats ? job.stats.loadCount : 0}</span>
                                </div>
                                <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                    <span class="block text-slate-500 text-xs uppercase font-bold mb-1">Total Volume</span>
                                    <span class="block text-3xl font-mono font-bold text-white">${job.stats ? job.stats.volume : '0'}</span>
                                </div>
                            </div>
                        </section>
                    </div>

                    <!-- Col 2: Contacts & Actions -->
                    <div class="col-span-1 bg-slate-900/30 p-6 flex flex-col border-l border-slate-800">
                        <h3 class="text-green-500 font-bold uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 text-xs">Site Contacts</h3>
                        <div class="flex-1 space-y-3 overflow-y-auto mb-4">
                            ${job.contacts ? job.contacts.map(c => `
                                <div class="bg-slate-800 p-3 rounded-lg flex justify-between items-center group hover:bg-slate-750 transition-colors border border-slate-700">
                                    <div>
                                        <div class="font-bold text-slate-200 text-sm">${c.name}</div>
                                        <div class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">${c.role}</div>
                                    </div>
                                    <button class="bg-slate-900 hover:bg-green-600 text-green-500 hover:text-white p-2 rounded shadow transition-all border border-slate-700 hover:border-green-500" title="Call">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                    </button>
                                </div>
                            `).join('') : '<div class="text-slate-600 text-sm italic">No contacts listed.</div>'}
                        </div>

                        <div class="space-y-3 mt-auto">
                            <button class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold flex items-center justify-center border border-slate-600 text-sm">
                                <span class="mr-2">📄</span> View Ticket
                            </button>
                            <button class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center shadow-lg text-sm transition-all active:scale-[0.98]">
                                <span class="mr-2">📞</span> Call Dispatch
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(modal);
        modal.querySelector('#btn-close-details').onclick = () => modal.remove();
    }

    updateZone(text, type) {
        // E.g. "Entering Shop"
        this.showAiAlert(text, 'info');
    }

    show(isVisible) {
        if (this.container) this.container.style.display = isVisible ? 'block' : 'none';
    }

    showPrompt(title, message, actions = []) {
        // Reuse AI Overlay for prompts? Or a modal?
        // Let's make an interactive AI Overlay
        const container = document.getElementById('ai-overlay-container');
        if (!container) return;

        const promptEl = document.createElement('div');
        promptEl.className = `mx-4 my-2 p-6 rounded-xl shadow-2xl border bg-gray-900/95 border-blue-500 backdrop-blur text-white flex flex-col items-center animate-bounce-in pointer-events-auto max-w-lg mx-auto`;

        const actionButtons = actions.map(a => `
            <button class="mt-4 w-full py-3 px-6 rounded-lg font-bold text-white transition-colors ${a.style || 'bg-blue-600 hover:bg-blue-500'}" data-label="${a.label}">
                ${a.label}
            </button>
        `).join('');

        promptEl.innerHTML = `
            <h3 class="text-2xl font-bold mb-2 text-blue-300">${title}</h3>
            <p class="text-lg text-center mb-4 text-gray-300">${message}</p>
            <div class="w-full space-y-2">
                ${actionButtons}
            </div>
        `;

        // Attach listeners
        const buttons = promptEl.querySelectorAll('button');
        buttons.forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                if (actions[idx].onClick && typeof actions[idx].onClick === 'function') {
                    actions[idx].onClick();
                }
                promptEl.remove();
            });
        });

        container.appendChild(promptEl);
    }

    renderRouteOptions(currentOptions, onSave) {
        const container = document.getElementById('ai-overlay-container');
        if (!container) return;

        const modal = document.createElement('div');
        modal.className = 'mx-4 my-2 p-6 rounded-xl shadow-2xl border bg-gray-900/95 border-blue-500 backdrop-blur text-white flex flex-col items-center animate-bounce-in pointer-events-auto max-w-lg mx-auto';

        const toggles = [
            { id: 'opt-weigh', label: 'Avoid Weigh Stations', key: 'avoidWeighStations' },
            { id: 'opt-truck', label: 'Truck Route Only (Load Restricted)', key: 'truckRoute' },
            { id: 'opt-efficient', label: 'Most Efficient Path', key: 'efficient' }
        ];

        const toggleHtml = toggles.map(t => {
            const checked = currentOptions[t.key] ? 'checked' : '';
            return `
                <label class="flex items-center justify-between w-full p-3 bg-gray-800 rounded-lg mb-2">
                    <span class="text-lg">${t.label}</span>
                    <input type="checkbox" data-key="${t.key}" ${checked} class="w-6 h-6 rounded border-gray-600 text-blue-600 focus:ring-blue-500">
                </label>
            `;
        }).join('');

        modal.innerHTML = `
            <h3 class="text-2xl font-bold mb-4 text-blue-300">Route Settings</h3>
            <div class="w-full mb-6 space-y-2">
                ${toggleHtml}
            </div>
            <div class="flex space-x-4 w-full">
                <button id="btn-cancel-opts" class="flex-1 py-3 px-6 rounded-lg font-bold bg-gray-600 hover:bg-gray-500">Cancel</button>
                <button id="btn-save-opts" class="flex-1 py-3 px-6 rounded-lg font-bold bg-blue-600 hover:bg-blue-500">Update Route</button>
            </div>
        `;

        modal.querySelector('#btn-cancel-opts').onclick = () => modal.remove();
        modal.querySelector('#btn-save-opts').onclick = () => {
            const newOpts = { ...currentOptions };
            modal.querySelectorAll('input[type="checkbox"]').forEach(input => {
                newOpts[input.dataset.key] = input.checked;
            });
            onSave(newOpts);
            modal.remove();
        };

        container.appendChild(modal);
    }

    renderDirectionsList(routePoints, onStart) {
        // routePoints is array of steps or similar
        const container = document.getElementById('ai-overlay-container');
        if (!container) return;

        // Strip HTML from instructions for cleaner list
        const stripHtml = (html) => {
            let tmp = document.createElement("DIV");
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || "";
        }

        const listItems = routePoints.map((step, idx) => `
            <div class="flex items-start space-x-4 p-4 mb-2 bg-gray-800 rounded-lg border-l-4 border-blue-500">
                <div class="flex-shrink-0 bg-blue-900/50 w-8 h-8 rounded-full flex items-center justify-center font-bold text-blue-300">${idx + 1}</div>
                <div class="flex-1">
                    <p class="text-white font-medium text-lg leading-snug">${step.instructions}</p>
                    <p class="text-gray-400 text-sm mt-1 font-mono">${step.distance.text}</p>
                </div>
            </div>
        `).join('');

        const modal = document.createElement('div');
        modal.className = 'w-full max-w-2xl mx-auto my-4 bg-gray-900/95 border border-blue-500 rounded-xl shadow-2xl backdrop-blur flex flex-col max-h-[80vh] pointer-events-auto animate-slide-up';

        modal.innerHTML = `
            <div class="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 rounded-t-xl">
                <div>
                   <h3 class="text-2xl font-bold text-white">Route Preview</h3>
                   <p class="text-blue-400 text-sm">Turn-by-urn Directions via Truck Route</p>
                </div>
                <button id="btn-close-list" class="text-gray-400 hover:text-white transition-colors">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            
            <div class="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                ${listItems}
            </div>

            <div class="p-6 border-t border-gray-700 bg-gray-800/50 rounded-b-xl">
                <button id="btn-start-drive" class="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold text-xl rounded-xl shadow-lg transform active:scale-95 transition-all">
                    Start Navigation
                </button>
            </div>
        `;

        modal.querySelector('#btn-close-list').onclick = () => modal.remove();
        modal.querySelector('#btn-start-drive').onclick = () => {
            if (onStart) onStart();
            modal.remove();
        };

        container.appendChild(modal);
    }

    // --- Stubs for Future Phases ---
    renderLoadWizard(callback, options = {}) {
        import('../load_wizard/index.js').then(module => {
            const wizard = new module.LoadWizard('ai-overlay-container', {
                ...options, // Pass autoFill and other options
                onComplete: (data) => {
                    this.showAiAlert("Load Data Captured", "info");
                    callback(data);
                },
                onCancel: () => {
                    this.showAiAlert("Load Wizard Cancelled", "warning");
                }
            });
            wizard.render();
        }).catch(err => {
            console.error("Failed to load Text Wizard", err);
            this.showAiAlert("Error loading Load Wizard", "warning");
        });
    }

    renderMenu(options) { console.log("Menu requested", options); }
    renderJobDetailsModal(assignment) { console.log("Details requested", assignment); }
    renderExceptionModal(callback) { console.log("Exception Modal requested"); }
    renderStandbyModal(callback) { console.log("Standby Modal requested"); }
    renderManualSearchModal(onConfirm, onCancel) {
        // Reuse route planner UI style but simpler
        const modal = document.createElement('div');
        modal.className = 'absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto';
        modal.innerHTML = `
             <div class="bg-gray-900 w-full max-w-lg rounded-2xl border border-amber-500/50 shadow-2xl flex flex-col overflow-hidden animate-slide-up">
                <div class="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                    <h2 class="text-xl font-bold text-white tracking-wide">MANUAL LOCATION ENTRY</h2>
                    <button id="btn-close-manual" class="text-gray-400 hover:text-white transition-colors">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="relative">
                        <label class="block text-gray-400 text-xs font-bold uppercase mb-1">Enter Address or Place</label>
                        <div class="flex items-center bg-gray-700 rounded-xl p-3 border border-amber-500/30">
                            <span class="text-amber-400 mr-3 text-xl">🔍</span>
                            <input type="text" id="manual-search-input" class="bg-transparent text-white w-full outline-none font-medium" placeholder="Start typing address..." autofocus>
                        </div>
                    </div>

                    <button id="btn-confirm-manual" class="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center">
                        CONFIRM LOCATION
                    </button>
                </div>
            </div>
        `;

        this.container.appendChild(modal);

        const input = modal.querySelector('#manual-search-input');
        setTimeout(() => input.focus(), 100);

        // Attach Google Places Autocomplete
        if (window.google && google.maps && google.maps.places) {
            const autocomplete = new google.maps.places.Autocomplete(input);
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.formatted_address) {
                    input.value = place.formatted_address;
                }
            });
        }

        modal.querySelector('#btn-close-manual').onclick = () => {
            modal.remove();
            if (onCancel) onCancel();
        };

        modal.querySelector('#btn-confirm-manual').onclick = () => {
            const val = input.value;
            if (val) {
                onConfirm(val);
                modal.remove();
            }
        };
    }
}

