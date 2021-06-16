<template>
    <b-container>
        <b-alert v-for="alert in alerts" :key="alert.msg" v-bind="{variant: alert.variant}" dismissible show>{{alert.msg}}</b-alert>
        <h3>Criar uma sala:</h3>
        <b-form @submit="onSubmit">
            <b-form-group
                id="input-group-1"
                label="Nome:"
                label-for="input-1"
                description="Digite seu nome"
            >
                <b-form-input
                id="input-1"
                v-model="form.name"
                type="text"
                placeholder="Digite seu nome"
                required
                ></b-form-input>
            </b-form-group>
            <b-form-group id="input-group-3" label="Tipo:" label-for="input-2">
                <b-form-select
                id="input-2"
                v-model="form.type"
                :options="types"
                required
                ></b-form-select>
            </b-form-group>
            <b-button type="submit" variant="success">Criar Sala</b-button>
        </b-form>
    </b-container>
</template>

<script>

export default {
    name: "Setup",
    data() {
        return {
            form: {
                name: '',
                type: "player"
            },
            types: [
                {text: "Tabuleiro", value: "board"},
                {text: "Jogador", value: "player"}
            ],
            alerts: []
        }

    },
    methods: {
        onSubmit(event) {
            event.preventDefault()
            fetch("http://localhost:8081/create_room", {
                method: "post",
                mode: 'cors',
                body: JSON.stringify(this.form)
            }).then( () => {
                this.$router.push("player")

            }).catch((reason => {
                this.alerts = []
                this.alerts.push({variant: "danger", msg: reason.toString()})
                console.log(reason)
            }))
        },
    }
}
</script>

<style lang="scss" scoped>

</style>