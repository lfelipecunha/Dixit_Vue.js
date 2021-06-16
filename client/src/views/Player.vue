<template>
  <div class="about">
    <Player/>
  </div>
</template>

<script>
// @ is an alias to /src
import Player from '@/components/Player.vue'

export default {
  name: 'Home',
  data() { return {
    }
  },
  components: {
    Player
  }
}
</script>