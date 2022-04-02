import { createStore } from 'vuex'

const getDefaultState = () => {
  return {
    alerts:  [],
    player:  {},
    players: [],
    room:    {},
  };
};

const state = getDefaultState();

export default createStore({
  state: state,
  getters: {
    alerts: (state) => state.alerts,
    player: (state) => state.player,
    players: (state) => state.players,
    room: (state) => state.room,
  },
  mutations: {
    addAlert: (state, data) => {
      state.alerts.push({type: data.type || 'info', message: data.message});
    },
    removeAlert: (state, index) => {
      state.alerts.splice(index, 1);
    },
    setChosenCards: (state, cards) => {
      state.room.chosenCards = cards
    },
    setGameStatus: (state, status) => {
      state.room.status = status
    },
    setIsMyTurn: (state, flag) => {
      state.player.isMyTurn = flag
    },
    setPlayer: (state, data) => {
      console.log('Player', data)
      data.isMyTurn = data.isMyTurn != undefined ? data.isMyTurn : state.player.isMyTurn
      state.player = data;
    },
    setPlayers: (state, data) => {
      state.players = data;
    },
    setPodium: (state, data) => {
      state.room.podium = data
    },
    setRoom: (state, room) => {
      state.room = room;
    },
    setTip: (state, tip) => {
      state.room.tip = tip
    },
  },
  actions: {
    socketUpdatePlayer: ({commit}, data) => {
      commit('setPlayer', data);
    },
    socketPlayersList: ({commit}, data) => {
      commit('setPlayers', data);
    },
    socketJoined: ({commit}, room) => {
      let data = {
        ...room,
        status: 'created',
      }
      commit('setRoom', data)
    },
    socketGameStarted: ({commit}) => {
      commit('setGameStatus', 'started')
    },
    socketMyTurn: ({commit}) => {
      commit('setIsMyTurn', true)
    },
    socketChooseSimilarCard: ({commit}, data) => {
      commit('setGameStatus', 'choose_similar_card');
      commit('setTip', data.tip);
    },
    socketFindTheChosenCard: ({commit}, data) => {
      commit('setGameStatus', 'find_the_chosen_card')
      commit('setChosenCards', data.cards)
      commit('setTip', data.tip);
    },
    socketEndOfTurn: ({commit}) => {
      commit('setGameStatus', 'started')
      commit('setTip', null)
      commit('setIsMyTurn', false)
    },
    socketEndGame: ({commit}, data) => {
      commit('setGameStatus', 'created')
      commit('setPodium', data.podium)
    },
    socketError: ({commit}, error) => {
      commit('addAlert', {type: 'danger', message: error});
    },
    // LOCAL
    resetState: () => {
      Object.assign(state, getDefaultState())
    },
    removeAlert: ({commit}, index) => {
      commit('removeAlert', index)
    },
  },
  modules: {
  }
})
