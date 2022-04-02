<template>
  <PlayerHandHeader v-if="!room.podium || hidePodium" :room="room" :players="players" :player="player" @exitGame="exitGame"/>
  <GamePodium v-if="room.podium?.length > 0 && !hidePodium" :podium="room.podium" @close="closePodium"/>
  <div id="player-hand-content">
    <PlayerTip v-if="chooseATip" @tip="submitTip" />
    <StartGame v-if="room.status=='created'" :currentPlayers="players.length" :minimalPlayers="room.minimalPlayers" @startGame="startGame"/>
    <template
      v-if="room.status == 'started' ||
        (
          room.status == 'choose_similar_card' &&
          !player.isMyTurn &&
          player.game_status != 'ready'
        )"
    >
      <PlayerCard
        v-for="card in player.cards"
        :key="card"
        :card="card"
        :select="(player.isMyTurn && room.status == 'started') || (room.status == 'choose_similar_card' && player.geme_status != 'ready')"
        @selectedCard="selectedCard" />
    </template>
    <template v-if="room.status == 'find_the_chosen_card' && player.game_status == 'waiting'">
      <PlayerCard v-for="card in room.chosenCards" :key="card" :card="card" :select="player.game_status == 'waiting'" :mine="player.chosen_card == card"  @selectedCard="selectedCard"/>
    </template>
  </div>
</template>
<script>
import PlayerHandHeader from '@/components/PlayerHandHeader.vue'
import PlayerTip from '@/components/PlayerTip.vue'
import PlayerCard from '@/components/PlayerCard.vue'
import StartGame from '@/components/StartGame.vue'
import GamePodium from '@/components/GamePodium.vue'
import { mapState } from 'vuex'
export default {
  name: 'PlayerHand',
  components: {
    PlayerHandHeader, PlayerCard, StartGame, PlayerTip, GamePodium
  },
  data() {
    return {
      chooseATip: false,
      myCard: null,
      hidePodium: false,
    }
  },
  computed: mapState(['player', 'players', 'tip', 'room', 'minimalPlayers']),
  sockets: {
    GameStarted: function() {
      this.hidePodium = true
    },
    EndGame: function() {
      this.hidePodium = false
    }
  },
  methods: {
    closePodium: function() {
      this.hidePodium = true
    },
    startGame: function() {
      this.$socket.emit('StartGame')
    },
    selectedCard: function(card) {
      const status = this.$store.getters.room.status
      if (status == 'started') {
        this.myCard = card;
        this.chooseATip = true
      } else if (status == 'choose_similar_card') {
        this.$socket.emit('SimilarCardChosen', {card: card})
      } else if (status == 'find_the_chosen_card') {
        this.$socket.emit('GuessedCard', {card: card})
      }
    },
    submitTip: function(tip) {
      this.$socket.emit('ChosenCard', {card: this.myCard, tip: tip});
      this.chooseATip = false
      this.myCard = null
    },
    exitGame: function() {
      console.log('=================EXIT================')
      this.$cookies.remove('dixit_game_socket_id')
      console.log(this.$socket.io)
      this.$socket.io.disconnect();
      this.$socket.io.connect();
      this.$router.push('/')

    }
  }
}
</script>
