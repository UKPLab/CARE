const Socket = require("../Socket.js");

/**
 * Recorder Socket
 *
 * Captures WebSocket events across connected users for stress-test replay.
 * Recording is a server-wide toggle — admin chooses which users to include,
 * or leaves the list empty to record everyone.
 */
class RecorderSocket extends Socket {

    constructor(server, io, socket) {
        super(server, io, socket);
        this.incomingHandler = null;
        this.outgoingHandler = null;
    }

    /**
     * Returns true if this user should be recorded under the current configuration.
     */
    isUserIncluded(userId) {
        const participants = this.server.activeParticipantUserIds;
        if (!participants || participants.length === 0) {
            return true; // empty / null = record everyone
        }
        return participants.includes(userId);
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

        const participantUserIds = Array.isArray(data?.participantUserIds) && data.participantUserIds.length > 0
            ? data.participantUserIds
            : null;
        const excludeEvents = Array.isArray(data?.excludeEvents) && data.excludeEvents.length > 0
            ? data.excludeEvents
            : null;

        const recording = await this.models["recording"].add({
            name: data.name || "Recording " + new Date().toLocaleString(),
            status: "recording",
            startTime: new Date(),
            userId: this.userId,
            participantUserIds,
            excludeEvents,
        }, options);

        this.server.activeRecordingId = recording.id;
        this.server.activeParticipantUserIds = participantUserIds;
        this.server.activeExcludeEvents = Array.isArray(data?.excludeEvents) && data.excludeEvents.length > 0
            ? data.excludeEvents
            : null;

        // Attach listeners on included users' sockets
        for (const socketId of Object.keys(this.server.availSockets)) {
            const recorder = this.server.availSockets[socketId]["RecorderSocket"];
            if (recorder && recorder.isUserIncluded(recorder.userId)) {
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
        this.server.activeParticipantUserIds = null;
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
            action: t.action,
            direction: t.direction,
            startTime: t.startTime,
            endTime: t.endTime,
        }));
    }

    /**
     * Returns userIds of all currently connected sockets, deduplicated.
     * Used by the Start Recording modal to show who's online right now.
     */
    async getOnlineUsers(data, options) {
        const sessionCountByUser = {};
        for (const socketId of Object.keys(this.server.availSockets)) {
            const bucket = this.server.availSockets[socketId];
            const anySocket = Object.values(bucket)[0];
            if (anySocket && anySocket.userId) {
                sessionCountByUser[anySocket.userId] = (sessionCountByUser[anySocket.userId] || 0) + 1;
            }
        }
        return Object.entries(sessionCountByUser).map(([userId, sessionCount]) => ({
            userId: parseInt(userId, 10),
            sessionCount,
        }));
    }

    init() {
        this.createSocket("recorderStart", this.startRecording, {}, true);
        this.createSocket("recorderStop", this.stopRecording, {}, false);
        this.createSocket("recordingGetTraces", this.getTraces, {}, false);
        this.createSocket("recordingGetOnlineUsers", this.getOnlineUsers, {}, false);

        if (this.server.activeRecordingId && this.isUserIncluded(this.userId)) {
            this.attachListeners();
        }
    }
}

module.exports = RecorderSocket;