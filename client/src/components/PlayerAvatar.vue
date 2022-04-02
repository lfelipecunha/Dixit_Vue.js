<template>
  <va-badge :text="player.points" color="info" overlap :visible-empty="player.points===0" >
    <va-badge overlap bottom transparent :color="player.status==0 ? 'danger' : player.game_status=='ready' ? 'success' : player.game_status == 'iddle' ? 'success' : 'warning'" >
      <template #text>
        <va-icon v-if="player.game_status=='waiting' && player.status==1" name="hourglass_empty" size="small" spin="counter-clockwise" />
        <va-icon v-if="player.game_status=='ready' && player.status==1" name="done" size="small" />
        <va-icon v-if="player.status==1 && player.game_status == 'iddle'" name="pending" size="small" />
        <va-icon v-if="player.status==0" name="highlight_off" size="small" />
      </template>
      <va-avatar color="gray" text-color="dark">
        {{alias}} <span class="number">{{number}}</span>
      </va-avatar>
    </va-badge>
  </va-badge>
</template>

<script>
  export default {
    name: "PlayerAvatar",
    props: ['player', 'players', 'index'],
    data() {
      return {
        alias: '',
        number: null
      }
    },
    created() {
      let firstChar = this.player.name.charAt(0)
      let number = 1
      for (let i=0; i< this.index; i++) {
        let previousFirstChar = this.players[i].name.charAt(0)
        if (firstChar == previousFirstChar) {
          number++
        }
      }
      this.alias = firstChar
      if (number > 1 ) {
        this.number = number
      }
    },
    methods: {}
  }
</script>

<style type="sccs" scoped>
  .number {
    font-size: 10px;
    font-weight: bold;
  }
</style>
