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
import AdminStore from './modules/admin.js';
import SettingsStore from "./modules/settings.js";
import ServiceStore from "./modules/service.js";

export default createStore({
    modules: {
        auth: AuthStore,
        admin: AdminStore,
        settings: SettingsStore,
        service: ServiceStore,
    },
});