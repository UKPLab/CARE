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
            {'name': "Dashboard", 'group': 0, 'icon': 'IconFan', "order": 0, "path": "", 'component': 'Test', "alias": ['/', "/index.html"]},
            {'name': "Documents", 'group': 0, 'icon': 'IconFan', "order": 10, "path": "documents", 'component': 'Test'},
            {'name': "Reviews", 'group': 0, "path": "reviews", 'component': 'Test'},
            {'name': "Meta Reviews", 'group': 0, "access": ["admin"], "path": "meta_reviews", 'component': 'Test'},
            {'name': "Tags", 'group': 0, 'icon': 'IconFan',"path": "tags", 'component': 'Test'},
            {'name': "Settings", 'group': 1, "path": "settings", 'component': 'Test'}
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