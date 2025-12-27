export class ImpactMonitor {
    constructor(options = {}) {
        this.onImpact = options.onImpact || (() => { });
        this.threshold = options.threshold || 25.0; // ~2.5G (High threshold for crash)
        this.isEnabled = false;
        this.lastImpact = 0;
        this.COOLDOWN = 5000; // 5s cooldown
        this.DEBOUNCE_WINDOW = 1000; // 1s window (ignore sub-shocks)
        this.incidentStart = 0;

        this.handleMotion = this.handleMotion.bind(this);
    }

    start() {
        if (this.isEnabled) return;
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', this.handleMotion);
            this.isEnabled = true;
            console.log("Impact Monitor Started");
        } else {
            console.warn("DeviceMotionEvent not supported");
        }
    }

    stop() {
        window.removeEventListener('devicemotion', this.handleMotion);
        this.isEnabled = false;
    }

    setSensitivity(level) {
        // 'bumpy' = higher threshold (less sensitive), 'smooth' = lower
        this.threshold = level === 'bumpy' ? 35.0 : 20.0;
        console.log(`Impact Sensitivity set to: ${level} (${this.threshold})`);
    }

    handleMotion(event) {
        if (!this.isEnabled) return;
        const now = Date.now();

        // Hard Cooldown (prevent spam logging)
        if (now - this.lastImpact < this.COOLDOWN) return;

        const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
        // Simple G-Force calc (Earth Gravity ~9.8m/s² = 1G)
        // We use raw acceleration values here. 
        // 25.0 threshold ≈ 2.5G. 
        const gForce = Math.sqrt(x * x + y * y + z * z);

        // Update Gauge UI if callback provided (Optional - for high frequency updates)
        if (this.onLiveReading) this.onLiveReading(gForce);

        if (gForce > this.threshold) {
            // Check debounce window
            if (now - this.incidentStart < this.DEBOUNCE_WINDOW) {
                // Ignore secondary shocks in same crash
                return;
            }

            console.warn(`IMPACT DETECTED: ${gForce.toFixed(2)} (Threshold: ${this.threshold})`);
            this.lastImpact = now;
            this.incidentStart = now;

            this.onImpact({
                gForce,
                timestamp: new Date().toISOString(),
                raw: { x, y, z }
            });
        }
    }

    /**
     * Dev Tool: Simulate an impact event.
     * @param {number} force - Mock G-Force value
     */
    simulate(force = 30.0) {
        console.warn("DEV: Simulating Impact Trigger");
        this.onImpact({
            gForce: force,
            timestamp: new Date().toISOString(),
            isSimulation: true
        });
    }
}
