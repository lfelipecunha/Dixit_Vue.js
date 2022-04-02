<template>
  <div class="home">
    <va-form @validation="validation = $event" ref="form" tag="form" @submit.prevent="registerUser">
      <va-input label="Name" v-model="name" :required-mark="true" :rules="[value => !!value || 'Please inform a name!', value => value.length >= 3 || 'Name must have at least 3 characters']" />

      <va-input v-if="!newRoom" label="Room" v-model="room" :returnRaw="false" :rules="[value => value.length == 9 || 'Invalid room name']" :mask="{blocks:[4,4], delimiter: '-'}" placeholder="####-####"/>
      <va-button type="submit" color="success" @click="$refs.form.validate()" :rounded="false" >{{newRoom ? 'Create' : 'Join'}}</va-button>
    </va-form>
    <va-button v-if="newRoom" type="button" flat @click="newRoom=false">Enter in an existent room</va-button>
    <va-button v-if="!newRoom" type="button" flat @click="newRoom=true">Create a room</va-button>
  </div>
</template>

<script>
export default {
  name: 'HomeView',
  data() {
    return {
      name: '',
      room: '',
      validation: null,
      newRoom: true,
    }
  },
  sockets: {
    NewRoom: function() {
      this.$socket.emit('Join', {name: this.name})
    },
    Joined: function() {
      this.$cookies.set('dixit_game_socket_id', this.$socket.id)
    },
    UpdatePlayer: function() {
      this.$router.push('/player-hand')
    },
    InvalidSocketId: function() {
      this.$cookies.remove('dixit_game_socket_id')
    },
  },
  methods: {
    registerUser: function() {
      if (!this.validation) {
        return
      }
      if (this.newRoom) {
        this.$socket.emit('CreateRoom')
      } else {
        this.$socket.emit('Join', {name: this.name, room: this.room})
      }
    }
  }
}
</script>
<style lang="scss" scoped>
  .top-player-avatar:not(:last-child) {
    margin-right: 12px;
  }
</style>
