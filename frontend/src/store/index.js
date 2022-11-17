/* index.js - initializes the vuex store

This script provides the vuex store for the app. By default,
the store includes multiple modules, one for each listed
in the ./modules sub-directory.

Currently:
    * AuthStore
    * WebsocketStore
    * UserStore

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import {createStore} from 'vuex';
import AuthStore from './modules/auth.js';
import UserStore from './modules/user.js';
import AnnotationStore from './modules/anno.js';
import AdminStore from './modules/admin.js';
import TagStore from './modules/tag.js';
import NavigationStore from "./modules/navigation.js";
import SettingsStore from "./modules/settings.js";
import CollaborationStore from "./modules/collab.js";
import createPersistedState from 'vuex-persistedstate';


export default createStore({
    modules: {
        auth: AuthStore,
        user: UserStore,
        anno: AnnotationStore,
        admin: AdminStore,
        tag: TagStore,
        navigation: NavigationStore,
        settings: SettingsStore,
        collab: CollaborationStore
    },
    plugins: [
        createPersistedState({
            paths: ['auth']
        })
    ]
});