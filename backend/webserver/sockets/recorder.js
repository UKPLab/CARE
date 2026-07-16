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
 * Captures WebSocket events for stress-test replay. An admin selects which
 * connected sessions (sockets) to record; each selected socket gets its own
 * recording, so one capture per participant. Selection is fixed at start —
 * sessions connecting later are not added to a running recording.
 *
 * @type {RecorderSocket}
 * @class RecorderSocket
 */
class RecorderSocket extends Socket {

    constructor(server, io, socket) {
        super(server, io, socket);
        this.incomingHandler = null;
        this.outgoingHandler = null;
    }

    /**
     * Build a trace-capturing listener for one direction.
     * @param {boolean} direction - true for client->server, false for server->client
     * @returns {Function} An onAny/onAnyOutgoing listener
     */
    makeTraceHandler(direction) {
        return async (eventName, ...args) => {
            const entry = this.server.activeRecordings && this.server.activeRecordings[this.socket.id];
            if (!entry) return;
            if (RECORDER_CONTROL_EVENTS.includes(eventName)) return;
            if (entry.excludeEvents && entry.excludeEvents.includes(eventName)) return;
            // An ack callback isn't data and can't be stored or replayed.
            const payload = typeof args[0] === "function" || args[0] === undefined ? null : args[0];
            try {
                await this.models["trace"].add({
                    recordingId: entry.recordingId,
                    userId: this.userId,
                    socketId: this.socket.id,
                    action: eventName,
                    payload,
                    direction,
                    startTime: new Date(),
                    endTime: new Date(),
                });
            } catch (err) {
                this.logger.error("Failed to save trace: " + err.message);
            }
        };
    }

    /**
     * Attach the capture listeners to this socket, once.
     * @returns {void}
     */
    attachListeners() {
        if (this.incomingHandler || this.outgoingHandler) return;
        this.incomingHandler = this.makeTraceHandler(true);
        this.outgoingHandler = this.makeTraceHandler(false);
        this.socket.onAny(this.incomingHandler);
        this.socket.onAnyOutgoing(this.outgoingHandler);
    }

    /**
     * Remove this socket's capture listeners, if attached.
     * @returns {void}
     */
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

    /**
     * Start recording the selected sessions. Each selected socket gets its own
     * recording row, so one capture per participant.
     * @param {Object} data - {participantSocketIds: string[], name?: string, excludeEvents?: string[]}
     * @param {Object} options - Handler options; carries the transaction
     * @returns {Promise<void>}
     * @throws {Error} If the caller is not an admin, no sessions are selected,
     *                 a session is already recording, or a session is offline
     */
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

       // TODO: two admins starting on the same socket concurrently can both
        // pass this check before either activates, orphaning one recording.
        // Needs a reservation that survives rollback; Sequelize exposes no
        // afterRollback hook, so this is deferred pending a design decision.
        const alreadyRecording = participantSocketIds.filter(id => this.server.activeRecordings[id]);
        if (alreadyRecording.length > 0) {
            throw new Error("One or more selected sessions are already being recorded");
        }

        // A socketId from a stale session list has no live socket to attach to,
        // so it would produce a recording that stays open and captures nothing.
        // availSockets can retain ghosts after a disconnect, so check the live
        // socket too — the same test getOnlineSessions uses to build the list.
        const offline = participantSocketIds.filter(id => !(
            this.server.availSockets[id]
            && this.server.availSockets[id]["RecorderSocket"]
            && this.server.io.sockets.sockets.get(id)
        ));
        if (offline.length > 0) {
            throw new Error("One or more selected sessions are no longer connected");
        }

        const excludeEvents = Array.isArray(data?.excludeEvents) && data.excludeEvents.length > 0
            ? data.excludeEvents
            : null;

        const baseName = data.name || "Recording " + new Date().toLocaleString();
        const started = [];

        for (const socketId of participantSocketIds) {
            const recorder = this.server.availSockets[socketId]["RecorderSocket"];

            const recording = await this.models["recording"].add({
                // One recording per participant, so the name has to say which.
                name: participantSocketIds.length > 1 ? `${baseName} — ${socketId}` : baseName,
                status: "recording",
                startTime: new Date(),
                userId: recorder.userId,
                participantSocketIds: [socketId],
                excludeEvents,
            }, options);

            started.push({ socketId, recorder, recordingId: recording.id });
        }

        // Only start capturing once the rows are committed: a rollback would
        // otherwise leave listeners writing traces against recordings that
        // don't exist, and activeRecordings entries that can never be stopped.
        const activate = () => {
            for (const s of started) {
                this.server.activeRecordings[s.socketId] = {
                    recordingId: s.recordingId,
                    ownerSocketId: this.socket.id,
                    excludeEvents,
                };
                s.recorder.attachListeners();
            }
        };

        if (options && options.transaction) {
            options.transaction.afterCommit(activate);
        } else {
            activate();
        }
    }

/**
     * Stop one or more active recordings and return each one's captured traces.
     * @param {Object} data - {socketId?: string, status?: string}; socketId stops
     *                        just that session, otherwise the caller's whole batch
     * @param {Object} options - Handler options; options.internal bypasses the admin check
     * @returns {Promise<{stopped: Array<Object>}>} Each stopped recording with its traces
     * @throws {Error} If the caller is not an admin (unless internal) or nothing is recording
     */
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

            const traces = (await this.models["trace"].getAllByKey("recordingId", recordingId, options))
                .sort((a, b) => a.id - b.id);

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

    /**
     * Return every trace of one recording, oldest first. Feeds the results
     * table and the export payload.
     * @param {Object} data - {id: number} recording id
     * @param {Object} options - Handler options
     * @returns {Promise<Array<Object>>} The recording's traces
     * @throws {Error} If the caller is not an admin or no id is given
     */
    async getTraces(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("Admin access required");
        }
        if (!data || !data.id) throw new Error("Recording ID required");
        const traces = (await this.models["trace"].getAllByKey("recordingId", data.id, options))
            .sort((a, b) => a.id - b.id);
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
     * Return one entry per live socket connection (= session), for the Start
     * Recording modal's session list. Offline users have no sessions and are
     * not returned.
     * @param {Object} data
     * @param {Object} options - Handler options
     * @returns {Promise<Array<Object>>} Sessions with socketId, userId, userName, connectedAt
     * @throws {Error} If the caller is not an admin
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
            const users = await this.models["user"].getAllByKeyValues("id", Array.from(userIds), options);
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

    /**
     * Register this socket's event handlers.
     * @returns {void}
     */
    init() {
        this.createSocket("recorderStart", this.startRecording, {}, true);
        this.createSocket("recorderStop", this.stopRecording, {}, false);
        this.createSocket("recordingGetTraces", this.getTraces, {}, false);
        this.createSocket("recordingGetOnlineSessions", this.getOnlineSessions, {}, false);
        this.createSocket("recordingGetPerfHealth", this.getPerfHealth, {}, false);
        this.createSocket("recordingGetPerfStats", this.getPerfStats, {}, false);
    }
}

module.exports = RecorderSocket;