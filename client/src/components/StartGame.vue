<template>
  <div :class="{invisible: currentPlayers >= minimalPlayers}">
    <va-alert  color="gray" border="top" border-color="danger" class="mb-4">
      At least {{minimalPlayers}} players to start game!
    </va-alert>
  </div>
  <va-button :disabled="currentPlayers < minimalPlayers" @click="$emit('startGame')">Start Game</va-button>
</template>
<script>

export default {
  name: 'StartGame',
  props: ['minimalPlayers', 'currentPlayers'],
  emits: ['startGame'],
}
</script>
<style scoped>
  .invisible {
    display: none;
  }
</style>
