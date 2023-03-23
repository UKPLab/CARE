/**
 * Store for studies
 *
 * Defines the store for studies
 *
 * @module store/study
 * @author Dennis Zyska, Nils Dycke
 */
import refreshState from "../utils";

const coordinatorFields =
    [
        {
            name: "name",
            label: "Name of the study:",
            placeholder: "My user study",
            type: "text",
            required: true,
        },
        {
            name: "documentId",
            label: "Selected document for the study:",
            type: "select",
            options: {
                table: "document", name: "name", value: "id"
            },
            icon: "file-earmark",
            required: true,
        },
        {
            name: "description",
            label: "Description of the study:",
            help: "This text will be displayed at the beginning of the user study!",
            type: "editor",
        },
        {
            name: "timeLimit",
            type: "slider",
            label: "How much time does a participant have for the study?",
            help: "0 = disable time limitation",
            size: 12,
            unit: "min",
            min: 0,
            max: 180,
            step: 1,
            required: false,
        },
        {
            name: "collab",
            label: "Should the study be collaborative?",
            type: "switch",
            required: true,
        },
        {
            name: "resumable",
            label: "Should the study be resumable?",
            type: "switch",
            required: true,
        },
        {
            name: "start",
            label: "Study sessions can't start before",
            type: "datetime",
            size: 6,
            required: true,
        },
        {
            name: "end",
            label: "Study sessions can't start after:",
            type: "datetime",
            size: 6,
            required: true,
        },
    ];


export default {
    namespaced: true,
    strict: true,
    state: () => {
        return [];
    },
    getters: {
        /**
         * Returns a study object by a given id.
         *
         * @param state
         * @return {function(Number): Object}
         */
        get: state => id => {
            return state.find(study => study.id === id);
        },

        /**
         * Returns the coordinator fields to edit and create studies
         */
        getFields: () => {
            return coordinatorFields;
        },

        /**
         * Returns the studies currently kept in store.
         *
         * @param state
         * @returns {function(): Array}
         */
        getStudies: state => {
            return state;
        },


        /**
         * Returns a study object by a given id.
         *
         * @param state
         * @returns {function(Number): Object}
         */
        getStudyById: state => studyId => {
            return state.find(study => study.id === studyId);
        },

        /**
         * Returns all studies for a given document (by ID).
         *
         * @param state
         * @returns {function(Number): Array}
         */
        getStudiesByDocument: state => documentId => {
            return state.filter(study => study.documentId === documentId);
        },

        /**
         * Returns a study object by a given study hash.
         *
         * @param state
         * @returns {function(String): Object}
         */
        getStudyByHash: state => studyHash => {
            return state.find(study => study.hash === studyHash);
        }
    },
    mutations: {
        /**
         * On studyRefresh, overrides the studies of the store.
         *
         * @param state
         * @param data
         */
        SOCKET_studyRefresh: (state, data) => {
            refreshState(state, data);
        },
    },
    actions: {}
};