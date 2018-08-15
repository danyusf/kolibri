function defaultState() {
  return {
    channelTitle: '',
    contentNode: {},
    resourceKind: '',
    resourceTitle: '',
    userData: [],
  };
}

export default {
  namespaced: true,
  state: defaultState(),
  mutations: {
    SET_STATE(state, payload) {
      Object.assign(state, payload);
    },
    RESET_STATE(state) {
      Object.assign(state, defaultState());
    },
  },
};