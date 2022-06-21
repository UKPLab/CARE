/* anno.js - Store for annotation-related data

Defines the store module responsible for storing annotations.

Author: Nils Dycke (dycke@ukp...)
Source: -
*/

import {Annotation} from '../../data/annotation.js';

const getDefaultState = () => {
    return {
        annotations: [
            new Annotation("1", "This is a default annotation 1", "This is a default anchor?! 1"),
            new Annotation("2", "This is a default annotation 2", "This is a default anchor?! 2"),
            new Annotation("3", "This is a default annotation 3", "This is a default anchor?! 3")
        ],
        sidebar_showing: true
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        // returns annotations from the store (local)
        getAnnotations: (state) => (document_id) => {
            return state.annotations.filter(annotation => annotation.document_id === document_id);
        },
        getAnchors: (state) => (document_id) => {
            return state.annotations.filter(annotation => annotation.document_id === document_id && annotation.orphaned === false && annotation.anchors !== null).map(annotation => annotation.anchors)
        },
        isSidebarShowing: state => {
            return state["sidebar_showing"]
        }
    },
    mutations: {
        // updates the local store to the given annotatations
        SET_ANNOTATIONS: (state, annotations) => {
            state.annotations = annotations;
        },
        // adds an annotation to the local storage
        ADD_ANNOTATION: (state, annotation) => {
            state.annotations.push(annotation);
        },
        // resets the local annotation store to the default state
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        TOGGLE_SIDEBAR: state => {
            state.sidebar_showing = !state.sidebar_showing;
        }
    },
    actions: {
        // loads the annotations for the given page
        async load({commit}) {
            // todo
            commit('SET_ANNOTATIONS', []);
        }
    }
};