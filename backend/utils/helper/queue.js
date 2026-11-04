/**
 * Document queue management utilities for preventing race conditions
 * 
 * This module provides queue management functions to ensure sequential processing
 * of document operations within the same context (document + user + session).
 * 
 * @author Karim ouf
 */

/**
 * Enqueue a task for a specific document context to prevent race conditions
 * 
 * This function ensures that tasks for the same document context are executed
 * sequentially by chaining them onto a promise queue. Each unique context
 * gets its own queue to allow parallel processing of different contexts.
 * 
 * @param {Map} queue - The Map containing document queues
 * @param {string} key - The unique key identifying the document context
 * @param {Function} task - The async task to execute
 * @returns {Promise} - Promise that resolves when the task completes
 */
function enqueueDocumentTask(queue, key, task) {
    if (!queue.has(key)) {
        // Initialize promise chain for new context
        queue.set(key, Promise.resolve());
    }

    // Chain the new task onto the previous one for this context
    const newQueue = queue.get(key).then(async () => {
        return task();
    });

    // Update the promise in the queue and prevent breaking chain on errors
    queue.set(key, newQueue.catch(() => {}));

    return newQueue;
}

/**
 * Get the creation time for the next message of a document context
 *
 * Edits are reconstructed by sorting on createdAt and then on the order inside of their message. Messages that are
 * saved one after the other can still get the same millisecond, which would interleave their operations, so the
 * time is strictly increasing for each context. The caller has to seed a context it has not seen in this process with
 * its persisted time, as that can be ahead of the clock.
 *
 * @param {Map} timestamps - The Map containing the last timestamp of each context
 * @param {string} key - The unique key identifying the document context
 * @returns {Date} - The creation time for the next message of this context
 */
function nextDocumentTimestamp(timestamps, key) {
    const next = Math.max(Date.now(), (timestamps.get(key) || 0) + 1);
    timestamps.set(key, next);
    return new Date(next);
}

// Export functions
exports.enqueueDocumentTask = enqueueDocumentTask;
exports.nextDocumentTimestamp = nextDocumentTimestamp;