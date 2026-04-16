const Socket = require("../Socket.js");

/**
 * Recorder Socket
 *
 * Captures WebSocket events across ALL connected users for stress-test replay.
 * Recording is a server-wide toggle controlled by an admin — when active,
 * every connected user's socket has trace listeners attached automatically,
 * including users who connect mid-recording.
 */
class RecorderSocket extends Socket {

    constructor(server, io, socket) {
        super(server, io, socket);
        this.incomingHandler = null;
        this.outgoingHandler = null;
    }


    /**
     * Attach trace-writing listeners to THIS user's socket.
     * Handlers tag traces with this.userId so we know who emitted each event.
     */
    attachListeners() {
        if (this.incomingHandler || this.outgoingHandler) {
            return; // already attached, avoid doubling up
        }

        this.incomingHandler = async (eventName, ...args) => {
            const recordingId = this.server.activeRecordingId;
            if (!recordingId) return;
            try {
                await this.models["trace"].add({
                    recordingId,
                    userId: this.userId,
                    action: eventName,
                    payload: args[0] || null,
                    direction: true, // frontend -> backend
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
            try {
                await this.models["trace"].add({
                    recordingId,
                    userId: this.userId,
                    action: eventName,
                    payload: args[0] || null,
                    direction: false, // backend -> frontend
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

    /**
     * Detach this user's trace listeners by reference.
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
     * Start a server-wide recording. Admin-only.
     * Sets the server flag, then attaches listeners on every connected user's socket.
     */
    async startRecording(data, options) {
        if (this.server.activeRecordingId) {
            throw new Error("A recording is already in progress");
        }

        const recording = await this.models["recording"].add({
            name: data.name || "Recording " + new Date().toLocaleString(),
            status: "recording",
            startTime: new Date(),
            userId: this.userId, // admin who started it
        }, options);

        this.server.activeRecordingId = recording.id;

        // Iterate every connected socket and attach listeners via their RecorderSocket
        for (const socketId of Object.keys(this.server.availSockets)) {
            const recorder = this.server.availSockets[socketId]["RecorderSocket"];
            if (recorder) {
                recorder.attachListeners();
            }
        }
    }

    /**
     * Stop the current server-wide recording. Admin-only.
     * Detaches listeners on every connected socket, finalizes the recording row,
     * and returns the captured traces for the save modal.
     */
    async stopRecording(data, options) {
        const recordingId = this.server.activeRecordingId || (data && data.id);

        if (!recordingId) {
            throw new Error("No active recording");
        }

        // Detach listeners on every connected socket
        for (const socketId of Object.keys(this.server.availSockets)) {
            const recorder = this.server.availSockets[socketId]["RecorderSocket"];
            if (recorder) {
                recorder.detachListeners();
            }
        }

        await this.models["recording"].updateById(
            recordingId,
            {
                status: "finished",
                endTime: new Date(),
            },
            options
        );

        this.server.activeRecordingId = null;

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

    /**
     * Get non-deleted traces for a specific recording (used by edit modal).
     */
    async getTraces(data, options) {
        if (!data || !data.id) {
            throw new Error("Recording ID required");
        }

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
     * Called on connection. Registers socket events and,
     * if a recording is already in progress, attaches listeners immediately
     * so this user's events get captured too.
     */
    init() {
        this.createSocket("recorderStart", this.startRecording, {}, true);
        this.createSocket("recorderStop", this.stopRecording, {}, false);
        this.createSocket("recordingGetTraces", this.getTraces, {}, false);

        if (this.server.activeRecordingId) {
            this.attachListeners();
        }
    }
}

module.exports = RecorderSocket;