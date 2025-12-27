
/**
 * Test Simulator for Dashcam Module
 * Injects into the dashcam page to run a "Day in the Life" scenario.
 */

import { initializeDashCam } from './dashcam.js';

export class DashcamSimulator {
    constructor() {
        this.log = [];
        this.stepDelay = 1000;
        this.mockStream = {
            getTracks: () => [{ stop: () => console.log("[Sim] Stream track stopped") }]
        };

        // Capture specific errors for debugging
        const origError = console.error;
        console.error = (...args) => {
            this.logToScreen(`[App Error] ${args.join(' ')}`, "red");
            origError.apply(console, args);
        };

        const origAlert = window.alert;
        window.alert = (msg) => {
            this.logToScreen(`[App Alert] ${msg}`, "orange");
            console.log(`[App Alert] ${msg}`);
        };
    }

    async run() {
        console.clear();
        console.log("%c🚗 Dashcam Simulation Initiated", "color: #00ff00; font-weight: bold; font-size: 14px;");
        this.setupMocks();

        try {
            await this.step(1, "Initialize Module", () => {
                // Assuming script is tailored for the existing HTML structure
                if (!document.getElementById('start-dashcam-btn')) throw new Error("UI not found");
            });

            await this.step(2, "Start Recording", async () => {
                const startBtn = document.getElementById('start-dashcam-btn');
                startBtn.click();

                // Wait for UI update (async operation)
                let attempts = 0;
                while (attempts < 10) {
                    const activeUi = document.getElementById('dashcam-ui-active');
                    if (!activeUi.classList.contains('hidden')) return; // Success
                    await new Promise(r => setTimeout(r, 200));
                    attempts++;
                }

                throw new Error("Active UI didn't appear after 2 seconds");
            });

            await this.step(3, "Fill Buffer (Stress Test)", async () => {
                this.logToScreen("[Sim] Fast-forwarding buffer filling...", "gray");
                // Wait 4000ms to ensure we exceed 24 chunks (at 100ms/chunk -> 40 chunks)
                await new Promise(r => setTimeout(r, 4000));
            });

            await this.step(4, "Trigger Incident", async () => {
                const triggerBtn = document.getElementById('trigger-incident-btn');
                triggerBtn.click();

                // Wait for mock upload (which validates size)
                // We need to wait enough time for the uploadBytes to potentially be called and return
                await new Promise(r => setTimeout(r, 1500));

                if (triggerBtn.disabled) throw new Error("Button stuck in disabled state");
            });

            await this.step(5, "Simulate Cleanup/Stop", async () => {
                const stopBtn = document.getElementById('stop-dashcam-btn');
                stopBtn.click();
                const startUi = document.getElementById('dashcam-ui-start');
                if (startUi.classList.contains('hidden')) throw new Error("Start UI didn't return");
            });

            this.logToScreen("✅ Simulation Completed Successfully", "green");
            console.log("%c✅ Simulation Completed Successfully", "color: #00ff00; font-weight: bold; font-size: 16px;");

        } catch (error) {
            this.logToScreen("❌ Simulation Failed: " + error.message, "red");
            console.error("%c❌ Simulation Failed: " + error.message, "color: red; font-weight: bold;");
        }
    }

    async step(num, name, action) {
        this.logToScreen(`Step ${num}: ${name}...`, "black");
        console.log(`%cStep ${num}: ${name}...`, "color: yellow;");
        await action();
        this.logToScreen(`Step ${num}: PASS`, "green");
        console.log(`%cStep ${num}: PASS`, "color: cyan;");
        await new Promise(r => setTimeout(r, this.stepDelay));
    }

    logToScreen(msg, color) {
        const output = document.getElementById('sim-output');
        if (output) {
            const line = document.createElement('div');
            line.textContent = msg;
            line.style.color = color;
            line.style.fontFamily = 'monospace';
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
        }
    }

    setupMocks() {
        const self = this; // Capture this for logging

        // Mock the video element to avoid srcObject TypeError on mock stream
        const realGetElementById = document.getElementById.bind(document);
        document.getElementById = (id) => {
            const el = realGetElementById(id);
            if (id === 'dashcam-preview' && el) {
                // Return a proxy that traps srcObject assignment
                return new Proxy(el, {
                    set(target, prop, value) {
                        if (prop === 'srcObject') {
                            console.log("[Sim] Trapped srcObject assignment to mock stream");
                            return true; // Swallow it to prevent TypeError
                        }
                        target[prop] = value;
                        return true;
                    }
                });
            }
            return el;
        };

        // Mock getUserMedia
        if (!navigator.mediaDevices) navigator.mediaDevices = {};
        navigator.mediaDevices.getUserMedia = async () => {
            console.log("[Sim] Mock getUserMedia called");
            return this.mockStream;
        };

        // Mock MediaRecorder
        window.MediaRecorder = class MockMediaRecorder {
            constructor(stream, options) {
                console.log("[Sim] Mock MediaRecorder created", options);
                this.state = 'inactive';
                this.ondataavailable = null;
                this.timer = null;
            }
            start(timeslice) {
                this.state = 'recording';
                console.log(`[Sim] Recorder started with ${timeslice}ms timeslice`);
                // Emit fast chunks for testing
                this.timer = setInterval(() => {
                    if (this.ondataavailable) {
                        // Create a dummy blob, size 15 bytes
                        const blob = new Blob(["test-video-data"], { type: "video/webm" });
                        this.ondataavailable({ data: blob });
                    }
                }, 100);
            }
            stop() {
                this.state = 'inactive';
                console.log("[Sim] Recorder stopped");
                clearInterval(this.timer);
            }
            static isTypeSupported() { return true; }
        };

        // Mock Firebase Services
        const originalServices = window.firebaseServices || {};
        window.firebaseServices = {
            ...originalServices,
            auth: { currentUser: { uid: 'sim_user', displayName: 'Sim Driver' } },
            uploadBytes: async (ref, blob) => {
                // Verify buffer size check logic implicitly here
                // 1 chunk = 15 bytes. 24 chunks = 360 bytes.
                // We ran for 4000ms @ 100ms/chunk = ~40 chunks generated.
                // If buffer works, we should only have ~24-25 chunks (360-375 bytes).
                // If buffer failed (memory leak), we would have ~600 bytes.

                const size = blob.size;
                const bufferWorking = size <= 380; // Allow slight margin

                if (bufferWorking) {
                    self.logToScreen(`[Sim] Buffer Check: OK (Size: ${size} bytes, capped at ~24 chunks)`, "green");
                } else {
                    self.logToScreen(`[Sim] Buffer Check: FAILED (Size: ${size} bytes). Old chunks not dropped!`, "red");
                    // We don't error out, just log, so we can see result
                }

                return { ref: ref };
            },
            getDownloadURL: async () => "http://mock-url.com/video.webm",
            addDoc: async (collection, data) => {
                console.log("[Sim] Mock addDoc called", data);
                return { id: "mock_doc_id" };
            },
            ref: () => ({}),
            collection: () => ({})
        };
    }
}

// Auto-run if embedded
// const sim = new DashcamSimulator();
// setTimeout(() => sim.run(), 1000);
