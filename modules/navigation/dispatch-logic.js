export class DispatchManager {
    constructor(app) {
        this.app = app;
        this.shopZoneId = 'shop-main';
        this.setupListeners();
    }

    setupListeners() {
        if (!this.app.geofence) return;

        // Listen for Geofence Entry
        this.app.geofence.on('enter', (zone) => {
            if (zone.type === 'shop') {
                this.handleShopEntry(zone);
            }
        });
    }

    handleShopEntry(zone) {
        console.log("Welcome back to the Yard.");

        this.app.ui.showPrompt(
            "Welcome Back",
            "You have returned to the yard. What would you like to do?",
            [
                {
                    label: "Done for the Day",
                    style: "bg-green-600",
                    onClick: () => this.startEndOfDayFlow()
                },
                {
                    label: "Maintenance Required",
                    style: "bg-amber-600",
                    onClick: () => this.startMaintenanceFlow()
                },
                {
                    label: "Just Fueling / Resupply",
                    style: "bg-blue-600",
                    onClick: () => this.logResupply()
                },
                {
                    label: "Cancel",
                    style: "bg-gray-700",
                    onClick: () => { }
                }
            ]
        );
    }

    startEndOfDayFlow() {
        // Mock Summary Data
        const summary = {
            hours: "8.5",
            miles: "142",
            loads: 4
        };

        this.app.ui.showPrompt(
            "End of Day Summary",
            `Hours: ${summary.hours} | Miles: ${summary.miles} | Loads: ${summary.loads}\n\nSubmit Daily Log and Logout?`,
            [
                {
                    label: "Submit & Logout",
                    style: "bg-red-600",
                    onClick: () => {
                        this.app.ui.showAiAlert("Daily Log Submitted. Logging out...", "success");
                        setTimeout(() => {
                            window.location.reload(); // Simulate Logout
                        }, 2000);
                    }
                },
                { label: "Back", style: "bg-gray-600", onClick: () => this.handleShopEntry({ type: 'shop' }) }
            ]
        );
    }

    startMaintenanceFlow() {
        // Placeholder for linking to Mechanic Ticket
        this.app.ui.showAiAlert("Opening Mechanic Ticket Form...", "info");
        // in real app: window.location.href = '/modules/fleet/mechanic.html';
    }

    logResupply() {
        this.app.ui.showAiAlert("Resupply Logged. You are still clocked in.", "success");
    }
}
