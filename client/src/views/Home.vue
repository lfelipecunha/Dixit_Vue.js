<template>
  <b-container class="home">
    <img alt="Dixit" src="../assets/logo_dixit.png">
     <b-alert v-for="alert in alerts" :key="alert.msg" v-bind="{variant: alert.variant}" dismissible show>{{alert.msg}}</b-alert>
        <h3>Criar uma sala:</h3>
        <b-form @submit="onSubmit">
            <b-form-group id="input-group-3" label="Tipo:" label-for="input-2">
                <b-form-select
                id="input-2"
                v-model="form.type"
                :options="types"
                required
                ></b-form-select>
            </b-form-group>
            <b-form-group
                id="input-group-1"
                label="Nome:"
                label-for="input-1"
                description="Digite seu nome"
                v-if="form.type == 'player'"
            >
                <b-form-input
                id="input-1"
                v-model="form.name"
                type="text"
                placeholder="Digite seu nome"
                required
                ></b-form-input>
            </b-form-group>
            <b-form-group id="input-group-4" label="Entrar em uma sala existente?" label-for="input-4">
                <b-checkbox id="input-4" v-model="form.join_in_room"></b-checkbox>
            </b-form-group>
            <b-form-group id="input-group-3"  v-if="form.join_in_room" label="Sala" label-for="input-2">
                <b-form-input
                    v-model="form.room"
                    required
                >
                </b-form-input>
            </b-form-group>
            <b-button type="submit" variant="success">{{form.join_in_room ? 'Entrar na Sala' :'Criar Sala'}}</b-button>
        </b-form>
    </b-container>
</template>

<script>
export default {
  name: 'Home',
  data() { return {
      alerts: [],
      form: {
          name: '',
          type: "player",
      },
      types: [
          {text: "Tabuleiro", value: "board"},
          {text: "Jogador", value: "player"}
      ]
    }
  },
  sockets: {
      RoomCreated: function(room) {
          this.joinRoom(room)
      },
      NotJoined: function() {
          this.alerts = [
              {msg: "Não foi possível entrar na sala! Verifique os dados preenchidos!", variant: "danger"}
          ]
      },
      Joined: function(room) {
          this.$router.push({name: "Player", params: {id: room}})
      },
  },
  methods: {
    joinRoom: function(room) {
        this.$socket.emit("JoinRoom", {name: this.form.name, room: room})
    },
    onSubmit(event) {
        event.preventDefault()
        if (this.form.join_in_room) {
            this.joinRoom(this.form.room)
        } else {
            this.$socket.emit("CreateRoom")
        }
    },
  }
}
</script>

<style lang="scss" scoped>
img {
  padding: 30px 0;
  width: 100%
}
</style>
