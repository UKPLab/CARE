const Socket = require("../Socket.js");

/**
 * Recorder Socket
 *
 * Handles recording and replaying of WebSocket events
 * for stress testing the CARE platform.
 */
class RecorderSocket extends Socket {

    constructor(server, io, socket) {
        super(server, io, socket);
        this.isRecording = false;
        this.currentRecordingId = null;
        this.incomingHandler = null;
        this.outgoingHandler = null;
    }

    /**
     * Start recording all socket events
     * @param {Object} data The input data from the frontend
     * @param {string} data.name The name of the recording
     * @param {Object} options Sequelize transaction options
     */
    async startRecording(data, options) {
        if (this.isRecording) {
            throw new Error("Already recording");
        }

        // Create a new recording entry in the DB
        const recording = await this.models["recording"].add({
            name: data.name || "Recording " + new Date().toLocaleString(),
            status: "recording",
            startTime: new Date(),
            userId: this.userId,
        }, options);

        this.isRecording = true;
        this.currentRecordingId = recording.id;

        // Store handlers as instance properties so we can detach
        // exactly these listeners later (instead of nuking all catch-alls)
        this.incomingHandler = async (eventName, ...args) => {
            if (!this.isRecording) return;
            try {
                await this.models["trace"].add({
                    recordingId: this.currentRecordingId,
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
            if (!this.isRecording) return;
            try {
                await this.models["trace"].add({
                    recordingId: this.currentRecordingId,
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
     * Get all non-deleted traces for a recording
     * @param {Object} data The input data from the frontend
     * @param {number} data.id The recording ID
     * @param {Object} options Sequelize transaction options
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
            action: t.action,
            direction: t.direction,
            startTime: t.startTime,
            endTime: t.endTime,
        }));
    }

    /**
     * Stop the current recording and return its traces
     * @param {Object} data The input data from the frontend
     * @param {number} data.id Optional recording ID (fallback if in-memory state is lost)
     * @param {Object} options Sequelize transaction options
     */
    async stopRecording(data, options) {
        // Fall back to the ID sent by the frontend if our in-memory state was lost
        // (e.g., the user refreshed the page mid-recording and got a new socket)
        const recordingId = this.currentRecordingId || (data && data.id);

        if (!recordingId) {
            throw new Error("No active recording");
        }

        // Remove only OUR catch-all listeners, by reference,
        // so we don't stomp on any catch-alls registered elsewhere
        if (this.incomingHandler) {
            this.socket.offAny(this.incomingHandler);
            this.incomingHandler = null;
        }
        if (this.outgoingHandler) {
            this.socket.offAnyOutgoing(this.outgoingHandler);
            this.outgoingHandler = null;
        }

        // Update recording status and end time
        await this.models["recording"].updateById(
            recordingId,
            {
                status: "finished",
                endTime: new Date(),
            },
            options
        );

        this.isRecording = false;
        this.currentRecordingId = null;

        // Fetch all traces for this recording so the frontend can show them
        // in the save modal without having to wait for Vuex to sync
        const traces = await this.models["trace"].findAll({
            where: { recordingId },
            order: [["id", "ASC"]],
        });

        return {
            id: recordingId,
            traces: traces.map(t => ({
                id: t.id,
                recordingId: t.recordingId,
                action: t.action,
                direction: t.direction,
                startTime: t.startTime,
                endTime: t.endTime,
            })),
        };
    }

    init() {
        this.createSocket("recorderStart", this.startRecording, {}, true);
        this.createSocket("recorderStop", this.stopRecording, {}, false);
        this.createSocket("recordingGetTraces", this.getTraces, {}, false);
    }
}

module.exports = RecorderSocket;