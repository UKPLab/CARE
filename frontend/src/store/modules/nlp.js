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
        report: null
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getReport: state => {
            return state["report"]
        }
    },
    mutations: {
        SOCKET_nlp_report_res: (state, message) => {
            if (message.success) {
                state.report = message.report;
            }
        },
    },
    actions: {}
};