const Service = require("../Service.js");
const {io: io_client} = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const yaml = require('js-yaml')

/**
 * BackgroundTaskService - manages background tasks and status
 * @class
 * @author Manu Sundar Raj Nandyal
 * @classdesc A service to handle background tasks such as preprocessing documents.
 * @extends Service
 */
module.exports = class BackgroundTaskService extends Service {
    constructor(server) {
        super(server, {
            cmdTypes: [
                "getBackgroundTask",
                "startPreprocessing",
                "cancelPreprocessing"
            ],
            resTypes: [
                "backgroundTaskUpdate"
            ]
        });

        this.tasks = server.preprocess;
        function debounce(fn, delay) {
            let timer = null;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        }

        this.emitData = () => {
            this.sendAll("backgroundTaskUpdate", server.preprocess);
            return true;
        };
        this.emitUpdate = debounce(this.emitData, 100);

        this.setPreprocess = (newObj) => {
            server.preprocess = newObj || {};
            this.emitData();
            this.emitUpdate();
        };

        this.setPreprocess(server.preprocess || {});
        setInterval(() => {
            this.emitUpdate();
        }, 100);
    }

     /**
     * Overwrite method to handle incoming commands
     * @param client
     * @param {string} command
     * @param {object} data
     */
    async command(client, command, data) {
        if (command === "startPreprocessing") {
            // Here the preprocessing logic should be moved from documentSocket to this service
            /** 
            if (this.server.services['NLPService']) {
                this.server.services['NLPService'].backgroundRequest(client, data);
            }
            */
        } else if (command === "cancelPreprocessing") {
            // TODO: Needs logic check
            const documentSocket = this.server.availSockets[client.socket.id]?.DocumentSocket;
            if (documentSocket && await documentSocket.isAdmin() && this.server.preprocess) {
                this.server.preprocess.cancelled = true;
                this.server.preprocess.requests = {};
                this.server.preprocess.currentSubmissionsCount = 0;
                this.emitData();
            } else {
                this.logger.error(`CancelPreprocessing failed: missing DocumentSocket, admin rights, or preprocess object.`);
            }
        } else {
            await super.command(client, command, data);
        }
    }

}