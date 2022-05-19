import {createStore} from 'vuex';

export default createStore({
  state: {
    isConnected: false,
    socketMessage: ''
  },
  namespaced: false,
  actions: {
    "SOCKET_connect"(context, data) {
      context.commit("connect", data);
      console.log("test");
    }
  },
  mutations:{
    connect(data) {
      state.isConnected = true;
    },
    SOCKET_connect(state) {
      state.isConnected = true;
      alert(state.isConnected);
    },
    SOCKET_CONNECT(state) {
      state.isConnected = true;
      alert(state.isConnected);
    },
    SOCKET_DISCONNECT(state) {
      state.isConnected = false;
    },

    SOCKET_MESSAGECHANNEL(state, message) {
      state.socketMessage = message
    }
  }
})
