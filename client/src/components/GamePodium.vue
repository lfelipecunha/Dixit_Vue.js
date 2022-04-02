<template>
  <va-list>
    <va-list-label>
      Podium <va-button color="divider" size="small" icon="close" @click="$emit('Close')"/>
    </va-list-label>

    <va-list-item v-for="(player, index) in podium" :key="`podium-${index}`" >
      <va-list-item-section avatar>
        <va-avatar v-if="index==0" color="divider">
          <va-icon name="emoji_events" color="warning"/>
        </va-avatar>
      </va-list-item-section>

      <va-list-item-section>
        {{ player.name }}
      </va-list-item-section>

      <va-list-item-section avatar>
        <va-avatar color="info">{{player.points}}</va-avatar>
      </va-list-item-section>
    </va-list-item>
  </va-list>
  <ul>
  </ul>
</template>
<script>
export default {
  name: 'GamePodium',
  props: ['podium'],
  emits: ['close']
}
</script>
