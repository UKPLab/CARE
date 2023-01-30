/* nlp.js - Store for NLP related interaction

Defines the store module responsible for storing all NLP-related data.
In the first place, this module is responsible for dealing with socket
messages.

Author: Nils Dycke (dycke@ukp...)
Co-Author: Dennis Zyska (zyska@ukp...)
Source: -
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
        get: (state) => (service, serviceType) => {
            return service in state.services && serviceType in state.services[service] ?
                state.services[service][serviceType] : null;
        },
        getNLPSkills: (state) => {
            return "NLPService" in state.services && 'skillUpdate' in state.services["NLPService"] ?
                state.services["NLPService"]['skillUpdate'].map(skill => skill.name) : [];
        },
        getNLPResults: (state) => {
            return "NLPService" in state.services && 'skillResults' in state.services["NLPService"] ?
                state.services["NLPService"]['skillResults'] : {};
        },
    },
    mutations: {
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

                    if(data.data.length > 0){
                        const skillNames = data.data.map(s => s.name);

                        let newSkills = state.services[service][serviceType].filter(s => !skillNames.includes(s.name));
                        newSkills = newSkills.concat(data.data);

                        state.services[service][serviceType] = newSkills;
                    }
                } else if (serviceType === "skillConfig") {
                    if (!(serviceType in state.services[service])) {
                        state.services[service][serviceType] = {};
                    }

                    if(data.data){
                        state.services[service][serviceType][data.data.name] = data.data;
                    }
                } else if (serviceType === "skillResults") {
                    if (!(serviceType in state.services[service])) {
                        state.services[service][serviceType] = {};
                    }
                    if(!data.data.error){
                        state.services[service][serviceType][data.data.id] = data.data.data;
                    }
                }
            }
        },
    },
    actions: {}
};