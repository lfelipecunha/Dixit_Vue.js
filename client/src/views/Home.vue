<template>
  <div class="home">
    <img alt="Dixit" src="../assets/logo_dixit.jpg">
    <Setup/>
  </div>
</template>

<script>
// @ is an alias to /src
import Setup from '@/components/Setup.vue'

export default {
  name: 'Home',
  data() { return {
      alerts: []
    }
  },
  components: {
    Setup
  }
}
</script>

<style lang="scss" scoped>
img {
  padding: 30px 0
}
</style>
