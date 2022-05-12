import { createStore } from 'vuex';
import AuthStore from './modules/auth.js';
import WebsocketStore from './modules/websocket.js';
import UserStore from './modules/user.js';

export default createStore({
    modules: {
        auth: AuthStore,
        websocket: WebsocketStore,
        user: UserStore
    }
});