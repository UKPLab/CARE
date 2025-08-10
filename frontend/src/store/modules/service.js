
/**
 * Store for NLP related interaction
 *
 * Defines the store module responsible for storing all NLP-related data.
 * In the first place, this module is responsible for dealing with socket
 * messages.
 *
 * @module store/service
 * @author Nils Dycke, Dennis Zyska
 */

const getDefaultState = () => {
    return {
        services: {},
        serviceStatus: {}
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        /**
         * Returns the service data stored for the given service and service type.
         *
         * @param state
         * @returns {function(String, String): Object|null}
         */
        get: (state) => (service, serviceType) => {
            return service in state.services && serviceType in state.services[service] ?
                state.services[service][serviceType] : null;
        },

        /**
         * Returns the service data stored for the given service sent for any service message type.
         *
         * @param state
         * @returns {function(String): Object|null}
         */
        getAll: (state) => (service) => {
            return service in state.services ?  state.services[service] : [];
        },

        /**
         * Loads the service config (i.e. metadata) for the given service. If the service
         * has not connected yet, null will be returned. Likewise, if the server has
         * not provided any configuration.
         *
         * @param state
         * @returns {function(String): Object|null}
         */
        getConfig: (state) => (service) => {
            return service in state.serviceStatus ? state.serviceStatus[service] : null;
        },

        /**
         * Returns the command types provided by the service, if the service already connected.
         *
         * @param state
         * @returns {function(String): Object|null}
         */
        getCmdTypes: (state) => (service) => {
            return service in state.serviceStatus && state.serviceStatus[service].cmdTypes ? state.serviceStatus[service].cmdTypes : null;
        },

        /**
         * Returns the command types provided by the service, if the service already connected.
         *
         * @param state
         * @returns {function(String): Object|null}
         */
        getResponseTypes: (state) => (service) => {
            return service in state.serviceStatus && state.serviceStatus[service].resTypes ? state.serviceStatus[service].resTypes : null;
        },

        /**
         * Returns the services connected to the frontend by name.
         *
         * @param state
         * @returns {function(): string[]}
         */
        getServices: (state) => () => {
            return Object.keys(state.serviceStatus);
        },

        /**
         * Returns the last point in time, when a response was sent from the service. Returns null
         * if the service has not connected yet.
         *
         * @param state
         * @returns {function(String): Date|null}
         */
        getStatus: (state) => (service) => {
            if(service in state.serviceStatus && "lastUpdate" in state.serviceStatus[service]){
                return state.serviceStatus[service].lastUpdate;
            }
            return null;
        },

        /**
         * Returns the skills stored for the specified service. Equivalent to calling get("NLPService", "skillUpdate").
         *
         * @param state
         * @returns {Array|[]}
         */
        getSkills: (state) => (service) => {
            return service in state.services && 'skillUpdate' in state.services[service] ?
                Object.keys(state.services[service]['skillUpdate']) : [];
        },

        /**
         * Returns the results stored for the specified service. Equivalent to calling get("NLPService", "skillResults").
         *
         * @param state
         * @returns {Object|{}}
         */
        getResults: (state) => (service) => {
            return service in state.services && 'skillResults' in state.services[service] ?
                state.services[service]['skillResults'] : {};
        },

    },
    mutations: {
        /**
         * On "serviceRefresh", adds the message of the given data.service under the data.type. If the service has
         * not communicated with the frontend yet, it is added to the map of services. This method currently supports
         * the following services for synchronization (and needs extension when adding new services):
         *
         * * NLPService
         *
         * @param state
         * @param data
         */
        SOCKET_serviceRefresh: (state, data) => {
            const service = data.service;
            const serviceType = data.type;

            if (!(service in state.services)) {
                state.services[service] = {};
            }
            if(!(service in state.serviceStatus)){
                state.serviceStatus[service] = {};
            }
            state.serviceStatus[service].lastUpdate = Date.now();

            if (serviceType === "isAlive") {
                state.serviceStatus[service].cmdTypes = data.data.cmdTypes ? data.data.cmdTypes : [];
                state.serviceStatus[service].resTypes = data.data.resTypes ? data.data.resTypes : [];
                return;
            }

            // service dependent update logic
            if (service === "NLPService") {
                if (serviceType === "skillUpdate") {
                    if (!(serviceType in state.services[service])) {
                        state.services[service][serviceType] = [];
                    }

                    if (data.data.length > 0) {
                        const skillNames = data.data.map(s => s.name);

                        skillNames.forEach(n => {
                            if(state.services[service][serviceType][n]) {
                                delete state.services[service][serviceType][n]
                            }
                        });
                        state.services[service][serviceType] = {...state.services[service][serviceType],
                                                                ...Object.fromEntries(data.data.map(s => [s.name, s]))}
                    }
                } else if (serviceType === "skillResults") {
                    let cur;
                    if (!(serviceType in state.services[service])) {
                        cur = {};
                    } else {
                        cur = {...state.services[service][serviceType]};
                    }
                    if (!data.data.error) {
                        cur[data.data.id] = data.data.data;
                    }
                    state.services[service][serviceType] = cur;
                }
            }

            if (service === "BackgroundTaskService") {
                if (serviceType === "backgroundTaskUpdate") {
                    state.services[service][serviceType] = data.data;
                }
            }
        },

        /**
         * Removes an NLP result by the given requestID from the store.
         *
         * @param state
         * @param requestId
         */
        removeResults: (state, {service, requestId}) => {
            if (service in state.services && 'skillResults' in state.services[service]) {
                delete state.services[service]['skillResults'][requestId];
            }
        },
    },
    actions: {}
};