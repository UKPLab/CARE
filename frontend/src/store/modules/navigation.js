/**
 * Store for navigation elements
 *
 * Defines the store for navigation elements
 *
 * @module store/navigation
 * @author Nils Dycke, Dennis Zyska
 *
 */

const getDefaultState = () => {
    return {
        groups: null,
        elements: null
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
            const groups = state["elements"].reduce((acc, cur) => {
                if (cur.groupId === 0 || cur.groupId === undefined) {
                    console.error("For navigation element " + cur.name + " the group id " + cur.group + " doesn't exists!");
                } else {
                    if (cur["groupId"] !== undefined) {
                        acc[cur["groupId"]] = acc[cur["groupId"]] || [];
                        acc[cur['groupId']].push(cur)
                    }
                }
                return acc
            }, [])
            return groups.map(e => e.sort(function (a, b) {
                return a["order"] - b["order"];
            }))
        },
        getSidebarGroups: state => {
            return state["groups"].sort(function (a, b) {
                return a["order"] - b["order"];
            });
        },

    },
    mutations: {
        SOCKET_settingNavigation: (state, message) => {
            state['groups'] = message.groups;
            state['elements'] = message.elements;
        },
    },
    actions: {}
};