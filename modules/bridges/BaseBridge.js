/**
 * BaseBridge.js
 * The abstract base class for all Data Bridges in the City Pave ecosystem.
 * Enforces the Extract-Transform-Load (ETL) pattern for consistent data flow.
 */

export class BaseBridge {
    constructor(sourceModule, targetModule) {
        this.source = sourceModule;
        this.target = targetModule;
    }

    /**
     * EXTRACT
     * Pulls raw data from the source.
     * @param {Object} context - The context required to access data (e.g., appState, global objects).
     */
    extract(context) {
        throw new Error("Method 'extract()' must be implemented.");
    }

    /**
     * TRANSFORM
     * Applies business logic, calculations, or formatting.
     * @param {Object} rawData - The data returned from extract().
     */
    transform(rawData) {
        throw new Error("Method 'transform()' must be implemented.");
    }

    /**
     * LOAD
     * Pushes the processed data to the destination.
     * @param {Object} processedData - The data returned from transform().
     * @param {Object} destinationRef - Database reference or target object.
     */
    async load(processedData, destinationRef) {
        throw new Error("Method 'load()' must be implemented.");
    }

    /**
     * EXECUTE
     * Runs the full pipeline.
     */
    async execute(context, destinationRef) {
        console.log(`[Bridge] Executing ${this.constructor.name}...`);
        try {
            const raw = await this.extract(context);
            const processed = this.transform(raw);
            const result = await this.load(processed, destinationRef);
            console.log(`[Bridge] ${this.constructor.name} completed successfully.`);
            return result;
        } catch (error) {
            console.error(`[Bridge] Error in ${this.constructor.name}:`, error);
            throw error;
        }
    }
}
