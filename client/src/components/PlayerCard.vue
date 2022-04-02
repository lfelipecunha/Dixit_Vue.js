<template>
  <va-card
    class="player-card-card"
    img-top
    :color="!mine ? 'divider' : 'info'"
  >
    <div class="player-card-image-box">
      <div v-if="mine" class="player-card-my-card-blur"></div>
      <div v-if="mine" class="player-card-my-card-text">It's your card!</div>
      <va-image :src="getImgUrl(card)" :contain="true" />
    </div>
    <va-card-actions v-if="select && !mine">
      <va-button @click="$emit('selectedCard', card)" :rounded="false">Select</va-button>
    </va-card-actions>
    <div class="player-cards-card-players">
      <PlayerAvatar v-for="player in card.players" :key="player.id" :player="player"/>
    </div>
  </va-card>
</template>

<script>
  import PlayerAvatar from './PlayerAvatar.vue'
  export default {
    components: { PlayerAvatar },
    name: 'PlayerCard',
    emits: ['selectedCard'],
    props: [ 'card', 'select', 'mine' ],
    methods: {
      getImgUrl: function(cardId) {
        let images = require.context('../assets/cards', false, /\.png$/)
        return images('./' + cardId + ".png")
      }
    }
  }
</script>

<style lang="scss">

.player-card-card {
  width: 100%;
  margin: 0 auto;
  margin-bottom: 5px;
}
.player-card-image-box {
  position: relative;

  .player-card-my-card-blur {
    position: absolute;
    filter: blur(8px);
    -webkit-filter: blur(8px);
    height: 100%;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    top: 0;
    left: 0;
    z-index: 1;
    background-color: #CCCC;
    width: 100%;
  }
  .player-card-my-card-text {
    position: absolute;
    z-index: 2;
    top: 50%;
    width: 100%;
    background-color: #DDD;
    padding: 5px 0;
    margin: 0 5px;
  }
}
</style>
