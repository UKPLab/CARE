const Socket = require("../Socket.js");
const { snapshot } = require("../../db/stats.js");

// The recorder's own control events. These are recording machinery, not user
// activity, so they're never captured — otherwise a recording would include
// its own recorderStop, and replaying it fails with "No active recording".
const RECORDER_CONTROL_EVENTS = [
    "recorderStart",
    "recorderStop",
    "recordingGetTraces",
    "recordingGetOnlineSessions",
    "recordingGetPerfHealth",
    "recordingGetPerfStats"
];

/**
 * Recorder Socket
 *
 * Captures WebSocket events across connected sockets for stress-test replay.
 * Recording is a server-wide toggle — admin chooses which active sessions
 * (sockets) to include. Pure session-based selection: only the listed
 * socketIds are recorded. New connections during a recording are NOT
 * automatically captured (a warning toast goes to the recording owner).
 */
class RecorderSocket extends Socket {

    constructor(server, io, socket) {
        super(server, io, socket);
        this.incomingHandler = null;
        this.outgoingHandler = null;
    }

    /**
     * Returns true if this socket should be recorded under the current configuration.
     */
    isSessionIncluded(socketId) {
        return Boolean(this.server.activeRecordings && this.server.activeRecordings[socketId]);
    }

    attachListeners() {
        if (this.incomingHandler || this.outgoingHandler) return;

        this.incomingHandler = async (eventName, ...args) => {
            const entry = this.server.activeRecordings && this.server.activeRecordings[this.socket.id];
            if (!entry) return;
            const recordingId = entry.recordingId;
            const excludes = entry.excludeEvents;
            if (RECORDER_CONTROL_EVENTS.includes(eventName)) return;
            if (excludes && excludes.includes(eventName)) return;
            try {
                await this.models["trace"].add({
                    recordingId,
                    userId: this.userId,
                    socketId: this.socket.id,
                    action: eventName,
                    payload: args[0] || null,
                    direction: true,
                    startTime: new Date(),
                    endTime: new Date(),
                });
            } catch (err) {
                this.logger.error("Failed to save trace: " + err.message);
            }
        };

        this.outgoingHandler = async (eventName, ...args) => {
            const entry = this.server.activeRecordings && this.server.activeRecordings[this.socket.id];
            if (!entry) return;
            const recordingId = entry.recordingId;
            const excludes = entry.excludeEvents;
            if (RECORDER_CONTROL_EVENTS.includes(eventName)) return;
            if (excludes && excludes.includes(eventName)) return;
            try {
                await this.models["trace"].add({
                    recordingId,
                    userId: this.userId,
                    socketId: this.socket.id,
                    action: eventName,
                    payload: args[0] || null,
                    direction: false,
                    startTime: new Date(),
                    endTime: new Date(),
                });
            } catch (err) {
                this.logger.error("Failed to save trace: " + err.message);
            }
        };

        this.socket.onAny(this.incomingHandler);
        this.socket.onAnyOutgoing(this.outgoingHandler);
    }

    detachListeners() {
        if (this.incomingHandler) {
            this.socket.offAny(this.incomingHandler);
            this.incomingHandler = null;
        }
        if (this.outgoingHandler) {
            this.socket.offAnyOutgoing(this.outgoingHandler);
            this.outgoingHandler = null;
        }
    }

    async startRecording(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("Admin access required");
        }
        if (!this.server.activeRecordings) {
            this.server.activeRecordings = {};
        }

        const participantSocketIds = Array.isArray(data?.participantSocketIds) && data.participantSocketIds.length > 0
            ? data.participantSocketIds
            : null;

        if (!participantSocketIds) {
            throw new Error("At least one session must be selected");
        }

        const alreadyRecording = participantSocketIds.filter(id => this.server.activeRecordings[id]);
        if (alreadyRecording.length > 0) {
            throw new Error("One or more selected sessions are already being recorded");
        }

        const excludeEvents = Array.isArray(data?.excludeEvents) && data.excludeEvents.length > 0
            ? data.excludeEvents
            : null;

        for (const socketId of participantSocketIds) {
            const recorder = this.server.availSockets[socketId] && this.server.availSockets[socketId]["RecorderSocket"];
            const recordedUserId = recorder ? recorder.userId : null;

            const recording = await this.models["recording"].add({
                name: data.name || "Recording " + new Date().toLocaleString(),
                status: "recording",
                startTime: new Date(),
                userId: recordedUserId,
                participantSocketIds: [socketId],
                excludeEvents,
            }, options);

            this.server.activeRecordings[socketId] = {
                recordingId: recording.id,
                ownerSocketId: this.socket.id,
                excludeEvents,
            };

            if (recorder) {
                recorder.attachListeners();
            }
        }
    }

    async stopRecording(data, options) {
        // Internal callers (e.g. disconnect cleanup in Server.js) pass
        // options.internal to bypass the admin check, since the triggering
        // socket isn't an admin. User-initiated stops via recorderStop are
        // not internal and must be admin-gated.
        if (!(options && options.internal) && !(await this.isAdmin())) {
            throw new Error("Admin access required");
        }

        if (!this.server.activeRecordings) {
            this.server.activeRecordings = {};
        }

        // Allow callers to override the terminal status (e.g. "disconnected"
        // when a participant's socket drops). Normal user-initiated stops use
        // "finished".
        const finalStatus = (data && data.status) || "finished";

        // Determine which sockets to stop:
        // - data.socketId given (e.g. disconnect path): stop only that socket.
        // - otherwise: stop every recording started by this caller (their batch),
        //   so one admin stopping doesn't end another admin's recordings.
        let socketIdsToStop;
        if (data && data.socketId) {
            socketIdsToStop = this.server.activeRecordings[data.socketId] ? [data.socketId] : [];
        } else {
            socketIdsToStop = Object.keys(this.server.activeRecordings)
                .filter(sid => this.server.activeRecordings[sid].ownerSocketId === this.socket.id);
        }

        if (socketIdsToStop.length === 0) {
            throw new Error("No active recording");
        }

        const stopped = [];

        for (const socketId of socketIdsToStop) {
            const entry = this.server.activeRecordings[socketId];
            const recordingId = entry.recordingId;

            const recorder = this.server.availSockets[socketId] && this.server.availSockets[socketId]["RecorderSocket"];
            if (recorder) recorder.detachListeners();

            await this.models["recording"].updateById(
                recordingId,
                { status: finalStatus, endTime: new Date() },
                options
            );

            // Push the updated row to subscribers so their tables reflect the
            // new status (recorderStop runs without a transaction, so the
            // automatic table broadcast doesn't fire on its own).
            try {
                const updatedRow = await this.models["recording"].getById(recordingId);
                if (updatedRow) {
                    await this.broadcastTable("recording", [updatedRow]);
                }
            } catch (e) {
                this.logger.warn("Failed to broadcast stopped recording: " + e);
            }

            delete this.server.activeRecordings[socketId];

            const traces = await this.models["trace"].findAll({
                where: { recordingId },
                order: [["id", "ASC"]],
            });

            stopped.push({
                id: recordingId,
                socketId,
                traces: traces.map(t => ({
                    id: t.id,
                    recordingId: t.recordingId,
                    userId: t.userId,
                    socketId: t.socketId,
                    action: t.action,
                    direction: t.direction,
                    startTime: t.startTime,
                    endTime: t.endTime,
                })),
            });
        }

        return { stopped };
    }

    async getTraces(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("Admin access required");
        }
        if (!data || !data.id) throw new Error("Recording ID required");
        const traces = await this.models["trace"].findAll({
            where: { recordingId: data.id, deleted: false },
            order: [["id", "ASC"]],
        });
        return traces.map(t => ({
            id: t.id,
            recordingId: t.recordingId,
            userId: t.userId,
            socketId: t.socketId,
            action: t.action,
            payload: t.payload,
            direction: t.direction,
            startTime: t.startTime,
            endTime: t.endTime,
        }));
    }

    /**
     * Returns one entry per active socket connection (= session).
     * Used by the Start Recording modal to populate the session selection table.
     * Offline users have no sessions and are not returned.
     */
    async getOnlineSessions(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("Admin access required");
        }
        const userIds = new Set();
        const sessions = [];
        for (const socketId of Object.keys(this.server.availSockets)) {
            const bucket = this.server.availSockets[socketId];
            const userSocket = bucket["UserSocket"];
            const rawSocket = this.server.io.sockets.sockets.get(socketId);
            // Skip ghost entries: a socket may linger in availSockets after
            // disconnecting if its cleanup didn't fully run. socket.io removes
            // disconnected sockets from io.sockets.sockets immediately, so a
            // missing rawSocket means this session is stale and shouldn't be
            // listed as online.
            if (rawSocket && userSocket && userSocket.userId) {
                userIds.add(userSocket.userId);
                sessions.push({
                    socketId,
                    userId: userSocket.userId,
                    connectedAt: rawSocket.connectedAt || null,
                });
            }
        }

        // Resolve userNames in one query
        const userMap = {};
        if (userIds.size > 0) {
            const users = await this.models["user"].findAll({
                where: { id: Array.from(userIds) },
            });
            for (const u of users) {
                userMap[u.id] = u.userName;
            }
        }

        return sessions.map(s => ({
            ...s,
            userName: userMap[s.userId] || "Unknown",
        }));

    }

    /**
     * Return a snapshot of backend process vitals for perf metric sampling.
     * Admin-only. Used by the perf tool to detect memory/connection leaks and
     * event-loop pressure during load tests.
     * @param {Object} data
     * @param {Object} options
     * @returns {Promise<Object>} process vitals (memory, socket/recording counts, uptime)
     * @throws {Error} if the caller is not an admin
     */
    async getPerfHealth(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("Admin access required");
        }
        const mem = process.memoryUsage();
        return {
            rss: mem.rss,
            heapUsed: mem.heapUsed,
            heapTotal: mem.heapTotal,
            socketCount: Object.keys(this.server.availSockets || {}).length,
            activeRecordings: Object.keys(this.server.activeRecordings || {}).length,
            uptime: process.uptime(),
        };
    }

    /**
     * Return a snapshot of PostgreSQL runtime stats (connection counts, Sequelize
     * pool usage incl. waiting, DB counters, locks) for perf metric sampling.
     * Admin-only. Delegates to the shared db/stats.js snapshot().
     * @param {Object} data
     * @param {Object} options
     * @returns {Promise<Object>} pg_stat snapshot
     * @throws {Error} if the caller is not an admin
     */
    async getPerfStats(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("Admin access required");
        }
        return await snapshot(this.server.db.sequelize, this.logger);
    }

    init() {
        this.createSocket("recorderStart", this.startRecording, {}, true);
        this.createSocket("recorderStop", this.stopRecording, {}, false);
        this.createSocket("recordingGetTraces", this.getTraces, {}, false);
        this.createSocket("recordingGetOnlineSessions", this.getOnlineSessions, {}, false);
        this.createSocket("recordingGetPerfHealth", this.getPerfHealth, {}, false);
        this.createSocket("recordingGetPerfStats", this.getPerfStats, {}, false);

        if (this.isSessionIncluded(this.socket.id)) {
            this.attachListeners();
        }
    }
}

module.exports = RecorderSocket;