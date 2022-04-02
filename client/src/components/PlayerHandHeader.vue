<template>
  <va-affix :offset-top="0">
    <div id="header">
      <va-card color="background" stripe stripe-color="primary">
        <va-card-title>{{player.name}} - {{player.points}} </va-card-title>
        <va-card-content>
          <a href="#" id="exit-game" @click="$emit('exitGame')">ExitGame</a>
          <PlayerAvatar class="top-player-avatar" v-for="(player, index) in players" :key="`player-${index}`" v-bind="{player: player, index: index, players: players} "/>
          <div id="room-code">
            <strong>Room:</strong> <i>{{room.room}}</i>
          </div>
        </va-card-content>
      </va-card>
      <va-alert v-if="player.game_status == 'ready' || (player.game_status=='iddle' && room.status != 'created' && !player.isMyTurn)" color="danger" border="top" border-color="danger" >Waiting for other players</va-alert>
      <va-alert v-if="player.isMyTurn && room.status== 'started'" border-color="info" border="top">It's your turn!</va-alert>
      <template v-if="room.tip && !player.isMyTurn && player.game_status != 'ready'">
        <va-alert border-color="info" border="top">{{room.status == 'choose_similar_card' ? 'Select a similar Card!' : 'Find the chosen card!'}}</va-alert>
        <va-alert color="secondary">Tip: {{room.tip}}</va-alert>
      </template>
    </div>
  </va-affix>
</template>
<script>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
export default {
  name: 'PlayerHandHeader',
  components: {
    PlayerAvatar
  },
  props: ['room', 'players', 'player'],
  emit: ['exitGame']
}
</script>
<style>
#header {
  background-color: #CCC;
}
#exit-game {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 12px;
}

#room-code {
  margin-top: 10px
}
</style>

