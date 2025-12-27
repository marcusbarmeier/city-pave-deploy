/**
 * smart-queue.js
 * Manages incoming AI triggers to prevent user overload.
 * Prioritizes "Safety" and "Dispatch" over generic info.
 */

export const SmartQueue = {
    queue: [],
    isProcessing: false,

    // Priority Levels
    PRIORITY: {
        CRITICAL: 10,   // Safety, Collision Warnings
        HIGH: 5,        // Direct Dispatch, Clock In/Out prompts
        NORMAL: 1,      // Weather, General Info
        LOW: 0          // Background Sync
    },

    enqueue: (item) => {
        // item = { type, data, priority, timestamp }
        SmartQueue.queue.push(item);

        // Sort by Priority (Desc) then Time (Asc)
        SmartQueue.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

        console.log(`[SmartQueue] Added item. Size: ${SmartQueue.queue.length}`);
    },

    /**
     * Get the next item if we are ready to process.
     * @param {boolean} userAvailable - is the user free to interact?
     */
    getNext: (userAvailable = true) => {
        if (!userAvailable || SmartQueue.queue.length === 0) return null;

        return SmartQueue.queue.shift();
    },

    peek: () => {
        return SmartQueue.queue.length > 0 ? SmartQueue.queue[0] : null;
    },

    isEmpty: () => SmartQueue.queue.length === 0
};
