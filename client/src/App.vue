<template>
  <GlobalAlerts />
  <router-view />
</template>
<script>
import GlobalAlerts from '@/components/GlobalAlerts.vue'
export default {
  components: {
    GlobalAlerts
  },
  sockets: {
    connect: function () {
      let socketId = this.$cookies.get('dixit_game_socket_id');
      if (socketId) {
        this.$store.dispatch('resetState')
        this.$socket.emit("OldSocketId", socketId)
        this.$cookies.set('dixit_game_socket_id', this.$socket.id);
      }
      console.log('Socket Connected')
    },
    InvalidSocketId: function() {
      this.$cookies.remove('dixit_game_socket_id');
      console.log('Invalid Socket Id')
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
