<template>
  <div class="player">
    <div class="room-name">{{room}}</div>
    <div id="avatars">
      <Avatar v-for="(player, index) in players" :key="`player-${index}`" v-bind="{player: player, index: index, players: players}" @first-letter="firstLetter(event)"/>
    </div>
    <div v-if="boardCards.length >0">
      <span id="clue">Dica:<strong>{{clue}}</strong></span>
      <span class="title">Escolha a carta mais parecida!</span>
      <Card v-for="card in boardCards" :key="'board'+card.id" v-bind="{card: card}" />
    </div>
    <div class="waiting-for-start">
      <b-button @click="startGame" variant="success">Iniciar o jogo</b-button>
    </div>
    <div class="player-hand" v-if="showHand && cards.length>0">
      <span class="title">Suas cartas</span>
      <Card class="hand-card" v-for="card in cards" :key="'hand'+card.id" v-bind="{card: card}" />
    </div>
  </div>
</template>

<script>
// @ is an alias to /src
import Avatar from '@/components/Avatar.vue'
import Card from '@/components/Card.vue'

export default {
  name: 'Player',
  data() { return {
      room: this.$route.params.id,
      players: [],
      cards: [],
      clue: "Logotipo",
      boardCards: [],
      showHand: true
    }
  },
  sockets: {
    PlayersList: function (players) {
        this.players = players
    },
    NotJoined: function() {
      this.$router.push({name: "Home"})
    },
    MyTurn: function() {
        console.log('My Turn')
    },
    GameStarted: function() {
      console.log("Game Started")
    }
  },
  beforeRouteEnter(to, from, next) {
      next((vm) => {
        if (from.name == null) {
          vm.$socket.emit("JoinRoom", {rejoin: true, room: to.params.id})
        }
      })
  },
  created() {
    //console.log(this.$route)
  },
  methods: {
    handleCardClick: function(card, event) {
      event.preventDefault()
      console.log(card.id)

    },
    startGame: function() {
      this.$socket.emit('StartGame')
    }
  },
  components: {
    Avatar, Card
  }
}
</script>

<style lang="scss" scoped>
  .room-name {
    background-color: #3f3843;
    color: #FFF;
    font-weight: bold;
    line-height: 2rem;
  }
  #clue {
    display: block;
    background: greenyellow;
    line-height: 40px;
  }
  .title {
    font-weight: bold;
    line-height: 30px;
  }
  #avatars {
    padding: 5px 0;
    height: 50px;
    background-color: #6a626f;
  }

  .hand-card {
    margin-bottom: 20px
  }

  .waiting-for-start {
    position: fixed;
    bottom: 0;
    width: 100%;

    button {
      width: 100%
    }
  }
</style>