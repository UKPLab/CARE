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
        /**
         * Returns the sidebar element objects of the store as a flat list. Null if there are none.
         *
         * @param state
         * @returns {Array|null}
         */
        getSidebarElementsFlat: state => {
            return state["elements"]
        },

        /**
         * Returns the sidebar elements of the store. The result is a list of lists, for each navigation element
         * the list of associated sidebar elements. Returns an empty list, if there are none.
         * @param state
         * @returns {Array}
         */
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

        /**
         *  Returns the groups of the navigation sidebar.
         *
         * @param state
         * @returns {Array}
         */
        getSidebarGroups: state => {
            return state["groups"].sort(function (a, b) {
                return a["order"] - b["order"];
            });
        },

    },
    mutations: {
        /**
         * On "settingNavigation", updates the navigation groups and elements of the store.
         *
         * @param state
         * @param message
         */
        SOCKET_settingNavigation: (state, message) => {
            state['groups'] = message.groups;
            state['elements'] = message.elements;
        },
    },
    actions: {}
};