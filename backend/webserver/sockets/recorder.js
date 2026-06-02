const Socket = require("../Socket.js");

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
        const participants = this.server.activeParticipantSocketIds;
        if (!participants || participants.length === 0) {
            return false;
        }
        return participants.includes(socketId);
    }

    attachListeners() {
        if (this.incomingHandler || this.outgoingHandler) return;

        this.incomingHandler = async (eventName, ...args) => {
            const recordingId = this.server.activeRecordingId;
            if (!recordingId) return;
            const excludes = this.server.activeExcludeEvents;
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
            const recordingId = this.server.activeRecordingId;
            if (!recordingId) return;
            const excludes = this.server.activeExcludeEvents;
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
        if (this.server.activeRecordingId) {
            throw new Error("A recording is already in progress");
        }

        const participantSocketIds = Array.isArray(data?.participantSocketIds) && data.participantSocketIds.length > 0
            ? data.participantSocketIds
            : null;

        if (!participantSocketIds) {
            throw new Error("At least one session must be selected");
        }

        const excludeEvents = Array.isArray(data?.excludeEvents) && data.excludeEvents.length > 0
            ? data.excludeEvents
            : null;

        const recording = await this.models["recording"].add({
            name: data.name || "Recording " + new Date().toLocaleString(),
            status: "recording",
            startTime: new Date(),
            userId: this.userId,
            participantSocketIds,
            excludeEvents,
        }, options);

        this.server.activeRecordingId = recording.id;
        this.server.activeParticipantSocketIds = participantSocketIds;
        this.server.activeRecordingOwnerSocketId = this.socket.id;
        this.server.activeExcludeEvents = excludeEvents;


        for (const socketId of Object.keys(this.server.availSockets)) {
            const recorder = this.server.availSockets[socketId]["RecorderSocket"];
            const included = recorder ? recorder.isSessionIncluded(recorder.socket.id) : "no recorder";
            if (recorder && recorder.isSessionIncluded(recorder.socket.id)) {
                recorder.attachListeners();
            }
        }
    }

    async stopRecording(data, options) {
        const recordingId = this.server.activeRecordingId || (data && data.id);
        if (!recordingId) {
            throw new Error("No active recording");
        }

        for (const socketId of Object.keys(this.server.availSockets)) {
            const recorder = this.server.availSockets[socketId]["RecorderSocket"];
            if (recorder) recorder.detachListeners();
        }

        await this.models["recording"].updateById(
            recordingId,
            { status: "finished", endTime: new Date() },
            options
        );

        this.server.activeRecordingId = null;
        this.server.activeParticipantSocketIds = null;
        this.server.activeRecordingOwnerSocketId = null;
        this.server.activeExcludeEvents = null;

        const traces = await this.models["trace"].findAll({
            where: { recordingId },
            order: [["id", "ASC"]],
        });

        return {
            id: recordingId,
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
        };
    }

    async getTraces(data, options) {
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
        const userIds = new Set();
        const sessions = [];
        for (const socketId of Object.keys(this.server.availSockets)) {
            const bucket = this.server.availSockets[socketId];
            const userSocket = bucket["UserSocket"];
            if (userSocket && userSocket.userId) {
                userIds.add(userSocket.userId);
                const rawSocket = this.server.io.sockets.sockets.get(socketId);
                sessions.push({
                    socketId,
                    userId: userSocket.userId,
                    connectedAt: rawSocket?.connectedAt || null,
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

    init() {
        this.createSocket("recorderStart", this.startRecording, {}, true);
        this.createSocket("recorderStop", this.stopRecording, {}, false);
        this.createSocket("recordingGetTraces", this.getTraces, {}, false);
        this.createSocket("recordingGetOnlineSessions", this.getOnlineSessions, {}, false);

        if (this.server.activeRecordingId && this.isSessionIncluded(this.socket.id)) {
            this.attachListeners();
        }
    }
}

module.exports = RecorderSocket;