'use strict';

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

        const stoppedId = entry.recordingId;
        await recorder.stopRecording(
            { socketId: socket.id, status: "disconnected" },
            { internal: true }
        );

        // The disconnect-triggered stop runs outside the normal socket
        // transaction flow, so the automatic table broadcast doesn't fire. Push
        // the updated recording row to subscribed clients manually so their
        // tables reflect the new status.
        try {
            const updatedRow = await server.db.models["recording"].getById(stoppedId);
            if (updatedRow) {
                await recorder.broadcastTable("recording", [updatedRow]);
            }
        } catch (e) {
            server.logger.warn("Failed to broadcast disconnected recording: " + e);
        }

        const ownerSocket = server.io.sockets.sockets.get(entry.ownerSocketId);
        if (ownerSocket) {
            ownerSocket.emit("toast", {
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

module.exports = { flagDisconnectedRecording, recoverInterruptedRecordings };
