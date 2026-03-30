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

        // Catch all incoming events (frontend -> backend)
        this.socket.onAny(async (eventName, ...args) => {
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
        });

        // Catch all outgoing events (backend -> frontend)
        this.socket.onAnyOutgoing(async (eventName, ...args) => {
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
        });

        this.sendToast("Recording started", "Socket Profiler", "success");
        return recording.id;
    }

    /**
     * Stop the current recording
     * @param {Object} data The input data from the frontend
     * @param {Object} options Sequelize transaction options
     */
    async stopRecording(data, options) {
        if (!this.isRecording) {
            throw new Error("No active recording");
        }

        // Update recording status and end time
        await this.models["recording"].updateById(
            this.currentRecordingId,
            {
                status: "finished",
                endTime: new Date(),
            },
            options
        );

        this.isRecording = false;
        this.currentRecordingId = null;

        // Remove catch-all listeners
        this.socket.offAny();
        this.socket.offAnyOutgoing();

        this.sendToast("Recording stopped", "Socket Profiler", "success");
    }

    init() {
        this.createSocket("recorderStart", this.startRecording, {}, true);
        this.createSocket("recorderStop", this.stopRecording, {}, true);
    }
}

module.exports = RecorderSocket;