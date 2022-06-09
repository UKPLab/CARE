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
import { createStore } from 'vuex';
import AuthStore from './modules/auth.js';
import WebsocketStore from './modules/websocket.js';
import UserStore from './modules/user.js';
import createPersistedState from 'vuex-persistedstate';


export default createStore({
    modules: {
        auth: AuthStore,
        websocket: WebsocketStore,
        user: UserStore
    },
    plugins: [
        createPersistedState( {
            paths: ['auth']
        })
    ]
});