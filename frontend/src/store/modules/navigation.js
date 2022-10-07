/* Store for navigation elements

Defines the store for navigation elements
Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return {
        groups: [
            {'id': 1, 'name': "Default", 'icon': 'IconFan',},
            {'id': 2, 'name': "Admin", "access": ['admin']}
        ],
        elements: [
            {'name': "Dashboard", 'icon': 'IconFan', default:true, "order": 0, "path": "home", 'component': 'Home', "alias": ['/', "/index.html"]},
            {'name': "Documents", 'group': 1, 'icon': 'IconFan', "order": 10, "path": "documents", 'component': 'Home'},
            {'name': "Reviews", 'group': 1, "path": "reviews", 'component': 'Home'},
            {'name': "Meta Reviews", 'group': 2, "access": ["admin"], "path": "meta_reviews", 'component': 'Home'},
            {'name': "Tags", 'group': 1, 'icon': 'IconFan',"path": "tags", 'component': 'Home'},
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
        },
        getSidebarElements: state => {
            //Group by group value
            return state["elements"].reduce((acc, cur) => {
                if (cur["group"] !== undefined) {
                    acc[cur["group"]] = acc[cur["group"]] || [];
                    acc[cur['group']].push(cur)
                } else {
                    acc[0] = acc[0] || [];
                    acc[0].push(cur)
                }
                return acc
            }, [])
            //TODO sorting by order inside groups
        },
        getSidebarGroups: state => {
            // Order by order value
            return state["groups"].sort(function(a, b) {
                return a["order"] - b["order"];
            });
        },

    },
    mutations: {
    },
    actions: {}
};