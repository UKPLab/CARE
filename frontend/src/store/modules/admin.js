/**
 * Store for admin-related data
 *
 * Defines the store module responsible for storing all admin-related data.
 * Currently, this includes storage of review processes and reviews.
 *
 * @module store/admin
 * @author Dennis Zyska, Nils Dycke
 */

const getDefaultState = () => {
  return {
    docs: [],
    users: [],
    user_stats: {},
    user: {},
    // TODO: Check if it complies with naming convention to use snake case instead of camel case.
    user_right: {},
  };
};

export default {
  namespaced: true,
  strict: true,
  state: getDefaultState(),
  getters: {
    /**
     * Returns all users loaded in the store. May be empty or null. Requires a previous call to fetch
     * users from the server.
     *
     * @param state
     * @returns {[]}
     */
    getUsers: (state) => {
      return state["users"];
    },

    /**
     * Returns the stats for a given user (by id), if loaded from the server. Otherwise, null.
     *
     * @param state
     * @returns {(function(Number): (Object|null))}
     */
    getStatsByUser: (state) => (userId) => {
      if (userId in state["user_stats"]) {
        return state["user_stats"][userId];
      } else {
        return null;
      }
    },

    /**
     * Fetch users by their role from the server
     *
     * @param {*} state
     * @returns
     */
    getUsersByRole: (state) => {
      // TODO: Check if it is better to add another defaultState, e.g. userList,
      // because currently this returned data overwrites data returned from getUsers method
      return state["users"];
    },

    /**
     * Fetch specific user's details
     * @returns {Object}
     */
    getUserDetails: (state) => {
      return state["user"];
    },

    /**
     * Fetch specific user's right
     * @returns {Object}
     */
    getUserRight: (state) => {
      return state["user_right"];
    },
  },
  mutations: {
    /**
     * On "userData" updates the store to be set to the provided users. Replaces existing users.
     *
     * @param state
     * @param message
     */
    SOCKET_userData: (state, message) => {
      if (message.success) {
        state.users = message.users;
      }
    },

    /**
     * On "statsDataByUser", updates the user stats associated with a given user ID.
     *
     * @param state
     * @param message
     */
    SOCKET_statsDataByUser: (state, message) => {
      if (message.success) {
        state.user_stats[message.userId] = message.statistics;
      }
    },

    /**
     * On "respondUsersByRole", update the user list
     *
     * @param state
     * @param message
     */
    SOCKET_respondUsersByRole: (state, message) => {
      if (message.success) {
        state.users = message.users;
      }
    },

    /**
     * On "respondUserDetails", update the specific user' details
     * @param {*} state
     * @param {*} message
     */
    SOCKET_respondUserDetails: (state, message) => {
      if (message.success) {
        state.user = message.user;
      }
    },

    /**
     * On "respondUserRight", update the specific user_right object
     * @param {*} state
     * @param {*} message
     */
    SOCKET_respondUserRight: (state, message) => {
      if (message.success) {
        state.user_right = message.userRight;
      }
    },
  },
  actions: {},
};
