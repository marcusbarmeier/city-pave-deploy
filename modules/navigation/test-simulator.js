
/**
 * test-simulator.js
 * Runs a scripted "Day in the Life" scenario for the Navigation Module.
 * Mocks GPS and Dispatch events to verify UI/Logic without moving a physical truck.
 */

export class TestSimulator {
    constructor(app) {
        this.app = app;
        this.originalWatchPosition = navigator.geolocation.watchPosition;
        this.mockWatchId = null;
        this.interval = null;
        this.step = 0;
    }

    start() {
        console.log("Starting Simulation...");
        window.SIM_MODE = true; // Enable fast logs & short timers
        alert("Simulation Started. Sit back and watch the scenario unfold.");

        // 1. Mock Geolocation
        this.mockGeolocation();

        // 1b. Mock Dashcam (Camera)
        this.mockDashcam();

        // 2. Mock Dispatch Injection
        setTimeout(() => this.triggerDispatch(), 1000);

        // 3. Start GPS Sequence
        this.runScenario();
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        if (this.mockWatchId && navigator.geolocation.clearWatch) {
            navigator.geolocation.clearWatch(this.mockWatchId);
        }
        window.SIM_MODE = false;
        // Restore? Maybe reload page is better.
        // window.location.reload(); 
    }

    mockGeolocation() {
        // Override navigator.geolocation.watchPosition to accept our manual updates
        window._mockPosCallback = null;

        navigator.geolocation.watchPosition = (success, error, options) => {
            window._mockPosCallback = success;
            return 999; // Mock ID
        };

        // Re-trigger the app's watcher to hook into our mock
        this.app.startLocationWatch();
    }

    updateLocation(lat, lng, speed = 45) {
        if (window._mockPosCallback) {
            window._mockPosCallback({
                coords: {
                    latitude: lat,
                    longitude: lng,
                    accuracy: 10,
                    speed: speed / 2.23694, // mph to m/s
                    heading: 0
                },
                timestamp: Date.now()
            });
        }
    }

    mockDashcam() {
        console.log("Sim: Mocking Camera & Mic...");
        // 1. Create a canvas to generate a fake video stream
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');

        // Animation loop for the canvas
        const draw = () => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = '#fff';
            ctx.font = '30px Arial';
            ctx.fillText('SIMULATION CAM', 200, 200);
            ctx.fillText(new Date().toLocaleTimeString(), 200, 250);
            requestAnimationFrame(draw);
        };
        draw();

        // 2. Override getUserMedia
        const stream = canvas.captureStream(30);
        // Add a fake audio track
        const audioCtx = new AudioContext();
        const osc = audioCtx.createOscillator();
        const dst = audioCtx.createMediaStreamDestination();
        osc.connect(dst);
        // osc.start(); // Don't actually play sound
        const audioTrack = dst.stream.getAudioTracks()[0];
        stream.addTrack(audioTrack);

        navigator.mediaDevices.getUserMedia = async (constraints) => {
            console.log("Sim: getUserMedia called with", constraints);
            return stream;
        };
    }

    triggerDispatch() {
        console.log("Simulating New Dispatch...");
        const mockJob = {
            id: 'sim-job-1',
            clientName: "Simulation Estates",
            siteAddress: "123 Job Site Rd", // We'll geocode this or mock the geocode result
            dumpAddress: "999 Dump Lane",
            date: new Date().toISOString().split('T')[0],
            crew: [{ userId: this.app.currentUser?.uid || 'test-user' }]
        };

        // Bypass Firestore and inject directly into App Logic
        // We'll create fake geofences manually since geocoding "123 Job Site Rd" might fail or go anywhere

        // Mock Job Zone (Minneapolis Area)
        const jobLat = 44.9800;
        const jobLng = -93.2700;
        this.injectZone('job', 'Simulation Estates', jobLat, jobLng);

        // Mock Dump Zone
        const dumpLat = 44.9600;
        const dumpLng = -93.2500;
        this.injectZone('dump', 'City Dump', dumpLat, dumpLng);

        // Mock Shop Stop (Unexpected)
        // MOVED locations to be distinctly OUTSIDE the 'Main Shop' zone (which is ~44.97)
        // Shop Zone is 44.94 to 44.99. We need to go further South or East.
        // Let's go to 44.92 (South).
        const shopLat = 44.9200;
        const shopLng = -93.2600;

        // Manually trigger the "New Assignment" UI
        this.app.handleNewAssignment(mockJob);

        // Auto-Accept for Simulation Visualization
        setTimeout(() => {
            console.log("Sim: Auto-Accepting Route...");
            // Pass OBJECT coords ({lat, lng}) instead of address string
            const destCoords = { lat: mockJob.siteAddress ? 44.9800 : 0, lng: -93.2700 }; // Fallback or use variables
            // Better: use the waypoints we defined
            this.app.startRouteTo({ lat: jobLat, lng: jobLng }, 'job', mockJob.clientName);
        }, 5000);

        // Store coordinates for the run
        this.waypoints = { jobLat, jobLng, dumpLat, dumpLng, shopLat, shopLng };
    }

    injectZone(type, name, lat, lng) {
        // Create a small polygon around the point
        const paths = [
            { lat: lat + 0.002, lng: lng + 0.002 },
            { lat: lat - 0.002, lng: lng + 0.002 },
            { lat: lat - 0.002, lng: lng - 0.002 },
            { lat: lat + 0.002, lng: lng - 0.002 }
        ];

        this.app.geofence.addZone({
            id: `sim-${type}`,
            name: name,
            type: type,
            paths: paths
        });
    }

    runScenario() {
        let seconds = 0;

        this.interval = setInterval(() => {
            seconds++;
            const wp = this.waypoints;
            if (!wp) return;

            // Scenario Timing

            // 0-5s: Start at "Shop" (Home Base) -> Taxiing out
            if (seconds < 5) {
                this.updateLocation(44.9778, -93.2650, 15); // Moving slowly (Taxiing)
            }

            // 7s: Enable Dashcam (Drive Mode)
            else if (seconds === 7) {
                console.log("Sim: Engaging Drive Mode (Dashcam ON)");
                const dashBtn = document.getElementById('nav-dashcam-btn');
                if (dashBtn) dashBtn.click();
            }

            // 5-10s: Drive to Job
            else if (seconds < 10) {
                // Interpolate or just jump
                this.updateLocation(44.9790, -93.2680, 45);
            }

            // 11s: Arrive at Job
            else if (seconds === 11) {
                this.updateLocation(wp.jobLat, wp.jobLng, 5); // Slow down
            }
            else if (seconds < 15) {
                this.updateLocation(wp.jobLat, wp.jobLng, 0); // Stopped at Job -> Should trigger Arrival Prompt
            }

            // 15-20s: Drive to Dump
            else if (seconds < 20) {
                this.updateLocation(44.9700, -93.2600, 50); // Driving
            }

            // 20s: Trigger Incident (Hard Brake / Manual Trigger)
            else if (seconds === 20) {
                console.log("Sim: Triggering Dashcam Incident!");
                // Updated for Dashcam Widget (ID: containerId + '-btn-incident')
                const incidentBtn = document.getElementById('nav-dashcam-bay-btn-incident');
                if (incidentBtn) {
                    incidentBtn.click();
                } else {
                    console.warn("Sim: Could not find incident button!");
                }
            }

            // 21s: Arrive at Dump
            else if (seconds === 21) {
                this.updateLocation(wp.dumpLat, wp.dumpLng, 5);
            }
            else if (seconds < 30) {
                // Stay at Dump for > 8 seconds (Simulate Load Drop)
                // Note: The app logic requires > 2 mins usually. 
                // We might need to "Force" the time or update the app logic to be faster for sim?
                // Hack: We will update the internal timestamp in the app if accessible, OR just wait.
                // Since 2 mins is long for a demo, let's just emit the "Exit" event with a fake duration manually if needed,
                // OR relies on the user modifying the code. 
                // *Self-correction*: For this Sim, I'll update the logic in nav-app.js to check for a global 'SIM_MODE' flag to shorten timers.
                this.updateLocation(wp.dumpLat, wp.dumpLng, 0);
            }

            // 31s: Leave Dump (Trigger Load Count Prompt)
            else if (seconds === 31) {
                this.updateLocation(44.9650, -93.2550, 45); // Limit break!
            }

            // 35s: Go Off Course (Shop/Parts Store)
            else if (seconds === 35) {
                this.updateLocation(wp.shopLat, wp.shopLng, 5);
            }

            // 36s+: Stop at Unknown Location (Trigger Exception)
            else if (seconds > 36 && seconds < 55) {
                this.updateLocation(wp.shopLat, wp.shopLng, 0);
                // Should trigger exception after 3 seconds now
            }

            else if (seconds === 60) {
                console.log("Scenario & Loop Complete.");
                // alert("Scenario Complete");
                clearInterval(this.interval);
            }

        }, 1000);
    }
}
