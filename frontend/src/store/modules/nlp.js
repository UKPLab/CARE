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
        skills: [],
        configs: {},
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getAllSkills: (state) => () => {
            return state.skills;
        },
        getSkillConfig: (state) => (skill_name) => {
            if(skill_name in state.configs) {
                return state.configs[skill_name];
            } else {
                return null;
            }
        },
    },
    mutations: {
        SOCKET_nlp_skillUpdate: (state, data) => {
            state.skills = data;
        },
        SOCKET_nlp_skillConfig: (state, data) => {
            state.configs[data.name] = data;
        },
    },
    actions: {}
};