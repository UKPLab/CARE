/**
 * Initializes the vuex store
 *
 * This script provides the vuex store for the app. By default,
 * the store includes multiple modules, one for each listed
 * in the ./modules sub-directory.
 *
 * @author: Dennis Zyska, Nils Dycke
 */
import {createStore} from 'vuex';
import AuthStore from './modules/auth.js';
import AnnotationStore from './modules/anno.js';
import AdminStore from './modules/admin.js';
import TagStore from './modules/tag.js';
import NavigationStore from "./modules/navigation.js";
import SettingsStore from "./modules/settings.js";
import CollaborationStore from "./modules/collab.js";
import CommentStore from "./modules/comment.js";
import ServiceStore from "./modules/service.js";
import DocumentStore from "./modules/document.js";
import StudyStore from "./modules/study.js";
import StudySessionStore from "./modules/study_session.js";
import createPersistedState from 'vuex-persistedstate';

export default createStore({
    modules: {
        auth: AuthStore,
        anno: AnnotationStore,
        document: DocumentStore,
        admin: AdminStore,
        tag: TagStore,
        navigation: NavigationStore,
        settings: SettingsStore,
        collab: CollaborationStore,
        comment: CommentStore,
        service: ServiceStore,
        study: StudyStore,
        study_session: StudySessionStore
    },
    plugins: [
        createPersistedState({
            paths: ['auth']
        })
    ]
});