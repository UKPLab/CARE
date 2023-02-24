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
        services: {}
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        /**
         * Returns the service information for the given service and service type.
         *
         * @param state
         * @returns {function(String, String): Object|null}
         */
        get: (state) => (service, serviceType) => {
            return service in state.services && serviceType in state.services[service] ?
                state.services[service][serviceType] : null;
        },

        /**
         * Returns the skills stored for the NLPService. Equivalent to calling get("NLPService", "skillUpdate").
         *
         * @param state
         * @returns {Array|[]}
         */
        getNLPSkills: (state) => {
            return "NLPService" in state.services && 'skillUpdate' in state.services["NLPService"] ?
                state.services["NLPService"]['skillUpdate'].map(skill => skill.name) : [];
        },

        /**
         * Returns the results stored for the NLPService. Equivalent to calling get("NLPService", "skillResults").
         *
         * @param state
         * @returns {Object|{}}
         */
        getNLPResults: (state) => {
            return "NLPService" in state.services && 'skillResults' in state.services["NLPService"] ?
                state.services["NLPService"]['skillResults'] : {};
        },

    },
    mutations: {
        /**
         * On "serviceRefresh", adds the message of the given data.service under the data.type. If the service has
         * not communicated with the frontend yet, it is added to the map of services. This method currently supports
         * the following services for syncrhonization (ands needs extension when adding new services):
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

            // service dependent update logic
            if (service === "NLPService") {
                if (serviceType === "skillUpdate") {
                    if (!(serviceType in state.services[service])) {
                        state.services[service][serviceType] = [];
                    }

                    if (data.data.length > 0) {
                        const skillNames = data.data.map(s => s.name);

                        let newSkills = state.services[service][serviceType].filter(s => !skillNames.includes(s.name));
                        newSkills = newSkills.concat(data.data);

                        state.services[service][serviceType] = newSkills;
                    }
                } else if (serviceType === "skillConfig") {
                    if (!(serviceType in state.services[service])) {
                        state.services[service][serviceType] = {};
                    }

                    if (data.data) {
                        state.services[service][serviceType][data.data.name] = data.data;
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
        },

        /**
         * Removes an NLP result by the given requestID from the store.
         *
         * @param state
         * @param requestId
         */
        removeNLPResults: (state, requestId) => {
            if ("NLPService" in state.services && 'skillResults' in state.services["NLPService"]) {
                delete state.services["NLPService"]['skillResults'][requestId];
            }
        },
    },
    actions: {}
};