/* Store for navigation elements

Defines the store for navigation elements
Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return {
        groups: [
            {'id': 0, 'name': "Default", 'icon': 'IconFan',},
            {'id': 1, 'name': "Admin", "access": ['admin']}
        ],
        elements: [
            {'name': "Dashboard", 'group': 0, 'icon': 'IconFan', default:true, "order": 0, "path": "home", 'component': 'Home', "alias": ['/', "/index.html"]},
            {'name': "Documents", 'group': 0, 'icon': 'IconFan', "order": 10, "path": "documents", 'component': 'Home'},
            {'name': "Reviews", 'group': 0, "path": "reviews", 'component': 'Home'},
            {'name': "Meta Reviews", 'group': 0, "access": ["admin"], "path": "meta_reviews", 'component': 'Home'},
            {'name': "Tags", 'group': 0, 'icon': 'IconFan',"path": "tags", 'component': 'Home'},
            {'name': "Settings", 'group': 1, "path": "settings", 'component': 'Home'}
    ]
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getNavElements: state => {
            return state["elements"]
        }
    },
    mutations: {
    },
    actions: {}
};