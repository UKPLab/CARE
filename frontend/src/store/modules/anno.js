/* anno.js - Store for annotation-related data

Defines the store module responsible for storing annotations.

Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: -
*/

import {Annotation, createAnnotation} from '../../data/annotation.js';
import {Comment} from '../../data/comment.js';

const getDefaultState = () => {
    return {
        annotations: [
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
        getAnnotation: (state) => (annotation_id) => {
            return state.annotations.find(x => x.id === annotation_id);
        },
        getAnchors: (state) => (document_id) => {
            return state.annotations
                .filter(annotation => annotation.document_id === document_id)
                .filter(annotation => annotation.orphaned === false)
                .filter(annotation => annotation.anchors !== null)
                .map(annotation => annotation.anchors)
                .filter(anchors => anchors !== undefined)
        },
        getAnchorsFlat: (state) => (document_id) => {
            return state.annotations
                .filter(annotation => annotation.document_id === document_id)
                .filter(annotation => annotation.orphaned === false)
                .filter(annotation => annotation.anchors !== null)
                .flatMap(annotation => annotation.anchors)
                .filter(anchors => anchors !== undefined)
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
        SOCKET_loadAnnotations: (state, message) => {
            const comments = message.comments;

            const mapped = message.annotations.map(o => {
                const anno =  new Annotation(
                    o.annotation_id,
                    o.document_id,
                    o.text,
                    null, //todo need to create anchor
                    o.annotation,
                    o.user
                );
                anno.state = "SUBMITTED";
                anno.tags = o.tags;

                //console.log(o.annotation_id in comments);
                //console.log(comments);

                if(o.annotation_id in comments){
                    //for now always just 1 comment
                    const c = comments[o.annotation_id][0];
                    const cMapped = new Comment(
                        c.comment_id,
                        c.text,
                        c.reference_annotation,
                        null,
                        c.user
                    );
                    anno.comment = cMapped;
                }

                return anno;
            });
            state.annotations = mapped;
        },
        SOCKET_newAnnotation: (state, message) => {
            let anno = null;
            if(message.annotation_id == null){
                anno = createAnnotation(
                    message.document_id,
                    message.annotation.target[0].selector[1].exact,
                    message.annotation.target[0].selector[1].exact,
                    message.annotation,
                    message.user);
            } else {
                anno = new Annotation(
                    message.annotation_id,
                    message.document_id,
                    message.annotation.target[0].selector[1].exact,
                    message.annotation.target[0].selector[1].exact,
                    message.annotation,
                    message.user
                );
            }

            // TODO replace with comment logic later on
            if(message.comment != null){
                let comm;
                if(message.comment.id ==  null){
                    comm = createComment(message.comment.text, anno.id, null, anno.user);
                } else {
                    comm = new Comment(message.comment.id, message.comment.text, anno.id, null, anno.user);
                }
                anno.comment = comm;
            }
            state.annotations.push(anno);
            // scrolling
        },
        // adds an annotation to the local storage
        ADD_ANNOTATION: (state, annotation) => {
            state.annotations.push(annotation);
        },
        // deletes specific annotation from store
        DELETE_ANNOTATION: (state, annotation) => {
            const to_delete = state.annotations.findIndex(x => x.id === annotation.id);
            state.annotations.splice(to_delete, 1);
        },
        // resets the local annotation store to the default state
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        TOGGLE_SIDEBAR: state => {
            state.sidebar_showing = !state.sidebar_showing;
        },
        HOVER: (state, id) => {
            let annotation = state.annotations.find(x => x.id === id);
            annotation.hover = true;
            if ("anchors" in annotation) {
                annotation.anchors
                    .filter(anchor => "highlights" in anchor)
                    .forEach(anchor => anchor.highlights.map((highlight) => {
                        if ("svgHighlight" in highlight)
                            highlight.svgHighlight.classList.add("is-focused");
                        highlight.classList.add("highlight-focus");
                    }))
            }
        },
        UNHOVER: (state, id) => {
            let annotation = state.annotations.find(x => x.id === id);
            annotation.hover = false;
            if ("anchors" in annotation) {
                annotation.anchors
                    .filter(anchor => "highlights" in anchor)
                    .forEach(anchor => anchor.highlights.map((highlight) => {
                        if ("svgHighlight" in highlight)
                            highlight.svgHighlight.classList.remove("is-focused");
                        highlight.classList.remove("highlight-focus");
                    }))
            }
        }
    },
    actions: {
        // loads the annotations for the given page
        async load({commit}) {
            commit('SET_ANNOTATIONS', []);
        },
        addAnnotation({commit}, annotation) {
            commit("ADD_ANNOTATION", annotation);
        },
        deleteAnnotation({commit}, annotation) {
            commit("DELETE_ANNOTATION", annotation);
        }
    }
};