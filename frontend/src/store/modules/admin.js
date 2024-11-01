/**
 * Store for admin-related data
 *
 * Defines the store module responsible for storing all admin-related data.
 * Currently, this includes storage of review processes and reviews.
 *
 * @module store/admin
 * @author Dennis Zyska, Nils Dycke
 */

import { get } from "lodash";

const getDefaultState = () => {
  return {
    docs: [],
    users: [],
    // userRecords contains a list of more detailed user data than the users array right above.
    userRecords: [],
    userStats: {},
    user: {},
    userRight: {},
    assignmentUserInfos: [],
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
      if (userId in state["userStats"]) {
        return state["userStats"][userId];
      } else {
        return null;
      }
    },

    /**
     * Fetches users by their role from the server
     * @returns {Array} The users by role
     */
    getUsersByRole: (state) => {
      return state["userRecords"];
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
      return state["userRight"];
    },

    /**
     * Fetch all user's with their assignment information and roles
     * @param {Object} state 
     * @returns {Array}
     */
    getAssignmentUserInfos: (state) => {
      return state["assignmentUserInfos"];
    }
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
        state.userStats[message.userId] = message.statistics;
      }
    },

    /**
     * On "userByRole", update the user list
     *
     * @param state
     * @param message
     */
    SOCKET_userByRole: (state, message) => {
      if (message.success) {
        state.userRecords = message.users;
      }
    },

    /**
     * On "assignmentUserInfos", update the list of userInfos
     *
     * @param state
     * @param message
     */
    SOCKET_assignmentUserInfos: (state, message) => {
      if (message.success) {
        console.log(message, "HELLLOOO")
        state.assignmentUserInfos = message.userInfos;
      }
    },

    /**
     * On "userDetails", update the specific user' details
     * @param {*} state
     * @param {*} message
     */
    SOCKET_userDetails: (state, message) => {
      if (message.success) {
        state.user = message.user;
      }
    },

    /**
     * On "UserRight", update the specific userRight object
     * @param {*} state
     * @param {*} message
     */
    SOCKET_userRight: (state, message) => {
      if (message.success) {
        state.userRight = message.userRight;
      }
    },
  },
  actions: {},
};
