// estimator-state.js
// Centralized State Management for City Pave Estimator

class EstimatorState {
    constructor() {
        this.state = {
            estimates: [],
            currentEstimateId: null,
            currentUser: null,
            dashboardFilter: 'all',
            historyStack: [],
            historyIndex: -1,
            isApplyingHistory: false,
            initialLoadComplete: false,
            lastSnowCalculationResult: null,
            // UI State that needs to be shared
            isSidebarOpen: false
        };
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    setState(updates) {
        // Shallow merge updates
        this.state = { ...this.state, ...updates };
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // --- Specific Actions (Reducers style) ---

    setEstimates(estimates) {
        this.setState({ estimates });
    }

    updateEstimate(updatedEstimate) {
        const estimates = this.state.estimates.map(e =>
            e.id === updatedEstimate.id ? updatedEstimate : e
        );
        this.setState({ estimates });
    }

    addEstimate(newEstimate) {
        this.setState({ estimates: [...this.state.estimates, newEstimate] });
    }

    setCurrentEstimateId(id) {
        this.setState({ currentEstimateId: id });
    }

    setDashboardFilter(filter) {
        this.setState({ dashboardFilter: filter });
    }

    // History Management
    pushHistory(stateSnapshot) {
        // If we are in the middle of the stack, truncate the future
        const newHistory = this.state.historyStack.slice(0, this.state.historyIndex + 1);
        newHistory.push(stateSnapshot);

        // Limit stack size (e.g., 50)
        if (newHistory.length > 50) newHistory.shift();

        this.setState({
            historyStack: newHistory,
            historyIndex: newHistory.length - 1
        });
    }

    undo() {
        if (this.state.historyIndex > 0) {
            this.setState({ historyIndex: this.state.historyIndex - 1 });
            return this.state.historyStack[this.state.historyIndex - 1];
        }
        return null;
    }

    redo() {
        if (this.state.historyIndex < this.state.historyStack.length - 1) {
            this.setState({ historyIndex: this.state.historyIndex + 1 });
            return this.state.historyStack[this.state.historyIndex + 1];
        }
        return null;
    }
}

export const State = new EstimatorState();
