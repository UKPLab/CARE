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
        this.emitUpdate = debounce(target => {
            this.sendAll("backgroundTaskUpdate", target);
            return true;
        }, 100);

        function makeReactive(obj, callback) {
            function createProxy(target) {
                return new Proxy(target, {
                    get(target, key, receiver) {
                        const value = Reflect.get(target, key, receiver);
                        if (typeof value === 'object' && value !== null) {
                            return createProxy(value);
                        }
                        return value;
                    },
                    set(target, key, value, receiver) {
                        const result = Reflect.set(target, key, value, receiver);
                        callback(target);
                        return result;
                    },
                    deleteProperty(target, key) {
                        const result = Reflect.deleteProperty(target, key);
                        callback(target);
                        return result;
                    }
                });
            }
            return createProxy(obj);
        }

        this.makeReactive = makeReactive;
        this.setPreprocess = (newObj) => {
            if (!newObj || !newObj.__isReactiveProxy) {
                const proxy = this.makeReactive(newObj || {}, this.emitUpdate);
                Object.defineProperty(proxy, '__isReactiveProxy', { value: true, enumerable: false });
                server.preprocess = proxy;
                this.emitUpdate(server.preprocess);
            } else {
                server.preprocess = newObj;
                this.emitUpdate(server.preprocess);
            }
        };
        this.setPreprocess(server.preprocess || {});
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
            } else {
                this.logger.error(`CancelPreprocessing failed: missing DocumentSocket, admin rights, or preprocess object.`);
            }
        } else {
            await super.command(client, command, data);
        }
    }

}