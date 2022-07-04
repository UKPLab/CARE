
const getDefaultState = () => {
    return {
        pdf: undefined
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        // returns annotations from the store (local)
        getPDF: (state) => {
            return state.pdf;
        },
    },
    mutations: {
        set_PDF: (state, message) => {
            state.pdf = message;
        },
    }
}