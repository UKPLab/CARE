'use strict';

// How long the owning admin may be absent before their batch is stopped.
// A reload leaves no live socket for a moment, so an immediate stop would
// end recordings on every refresh. Long enough to cover a slow reconnect,
// short enough that a genuinely closed tab doesn't record indefinitely.
const OWNER_GRACE_MS = 30000;

// ownerUserId -> pending timeout handle, so a flapping connection doesn't
// stack up duplicate stop checks for the same admin.
const pendingOwnerStops = new Map();

/**
 * Check whether a user still holds a live socket other than the excluded one.
 * availSockets can retain ghosts after a disconnect, so the live socket is
 * checked too.
 * @param {Object} server - CARE server instance; uses availSockets and io
 * @param {number} userId - The user to look for
 * @param {string|null} excludeSocketId - Socket to ignore (the one disconnecting)
 * @returns {boolean} Whether another live socket exists for that user
 */
function hasLiveSocketForUser(server, userId, excludeSocketId) {
    return Object.entries(server.availSockets || {}).some(([sid, handlers]) =>
        sid !== excludeSocketId
        && handlers["RecorderSocket"]?.userId === userId
        && server.io.sockets.sockets.get(sid)
    );
}

/**
 * Stop and flag the recording belonging to a socket that dropped mid-capture.
 * Only that socket's recording is stopped — other active recordings, including
 * other admins' batches, keep running. A start-recording claim with no
 * recordingId yet has nothing to stop and expires on its own.
 * @param {Object} server - CARE server instance; uses activeRecordings, availSockets, db.models, io and logger
 * @param {Object} socket - The disconnecting Socket.IO socket
 * @returns {Promise<void>}
 */
async function flagDisconnectedRecording(server, socket) {
    try {
        const activeRecordings = server.activeRecordings || {};
        const entry = activeRecordings[socket.id];
        if (!entry || !entry.recordingId) {
            return;
        }

        const recorder = server.availSockets[socket.id]['RecorderSocket'];
        if (!recorder) {
            return;
        }

        await recorder.stopRecording(
            { socketId: socket.id, status: "disconnected" },
            { internal: true }
        );

        // The owning admin may have reloaded or opened a second tab since
        // starting, so the socket that started the recording can be gone.
        // Notify every socket that user currently holds instead.
        for (const [sid, handlers] of Object.entries(server.availSockets)) {
            if (handlers["RecorderSocket"]?.userId !== entry.ownerUserId) {
                continue;
            }
            server.io.sockets.sockets.get(sid)?.emit("toast", {
                title: "Recording stopped",
                message: "A recorded participant disconnected — recording flagged as disconnected.",
                variant: "warning",
            });
        }
    } catch (e) {
        server.logger.warn("Failed to flag disconnected recording: " + e);
    }
}

/**
 * Mark any recordings still in "recording" status as "interrupted". These are
 * recordings whose server died mid-capture — the in-memory activeRecordings map
 * is gone but the DB rows were never closed out. Runs once at server startup.
 * @param {Object} server - CARE server instance; uses db.models and logger
 * @returns {Promise<void>}
 */
async function recoverInterruptedRecordings(server) {
    try {
        const stale = await server.db.models["recording"].getAllByKey("status", "recording");
        for (const rec of stale) {
            await server.db.models["recording"].updateById(rec.id, {
                status: "interrupted",
                endTime: rec.endTime || new Date(),
            });
            server.logger.warn(
                `Marked recording ${rec.id} as interrupted (server was not running cleanly when stopped)`
            );
        }
        if (stale.length > 0) {
            server.logger.info(`Recovered ${stale.length} interrupted recording(s) on startup`);
        }
    } catch (e) {
        server.logger.error("Failed to recover interrupted recordings: " + e);
    }
}

/**
 * Stop every active recording owned by an admin who has no sockets left.
 * Re-checks liveness first: the admin may have reconnected during the grace
 * period, in which case their batch keeps running.
 * @param {Object} server - CARE server instance; uses activeRecordings, availSockets, io and logger
 * @param {number} ownerUserId - The owning admin
 * @returns {Promise<void>}
 */
async function stopAbandonedBatch(server, ownerUserId) {
    pendingOwnerStops.delete(ownerUserId);
    try {
        if (hasLiveSocketForUser(server, ownerUserId, null)) {
            return;
        }
        const owned = Object.entries(server.activeRecordings || {})
            .filter(([, entry]) => entry.recordingId && entry.ownerUserId === ownerUserId)
            .map(([sid]) => sid);

        for (const sid of owned) {
            const recorder = server.availSockets[sid]?.["RecorderSocket"];
            if (!recorder) {
                continue;
            }
            await recorder.stopRecording({ socketId: sid, status: "disconnected" }, { internal: true });
            server.logger.warn(
                `Stopped recording on socket ${sid}: owning admin ${ownerUserId} disconnected and did not return`
            );
        }
    } catch (e) {
        server.logger.warn("Failed to stop abandoned recordings: " + e);
    }
}

/**
 * Schedule a delayed stop of an admin's batch if the disconnecting socket was
 * the last one they held. Must be called before the socket is removed from
 * availSockets, since the owner's userId is read from it.
 * @param {Object} server - CARE server instance; uses activeRecordings, availSockets, io and logger
 * @param {Object} socket - The disconnecting Socket.IO socket
 * @returns {void}
 */
function scheduleOwnerAbandonCheck(server, socket) {
    try {
        const ownerUserId = server.availSockets[socket.id]?.["RecorderSocket"]?.userId;
        if (!ownerUserId || pendingOwnerStops.has(ownerUserId)) {
            return;
        }
        const ownsActive = Object.values(server.activeRecordings || {})
            .some(entry => entry.recordingId && entry.ownerUserId === ownerUserId);
        if (!ownsActive || hasLiveSocketForUser(server, ownerUserId, socket.id)) {
            return;
        }
        const handle = setTimeout(() => stopAbandonedBatch(server, ownerUserId), OWNER_GRACE_MS);
        // Don't hold the process open just for a pending grace check.
        if (typeof handle.unref === "function") {
            handle.unref();
        }
        pendingOwnerStops.set(ownerUserId, handle);
    } catch (e) {
        server.logger.warn("Failed to schedule owner abandon check: " + e);
    }
}

module.exports = { flagDisconnectedRecording, recoverInterruptedRecordings, scheduleOwnerAbandonCheck };
