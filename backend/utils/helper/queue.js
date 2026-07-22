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

// Export functions
exports.enqueueDocumentTask = enqueueDocumentTask;