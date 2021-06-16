
<template>
    <div>
        <b-avatar v-for="player in players" :key="player.id" v-bind="{text: player.name}">
            <template #badge><b-icon icon="star-fill"></b-icon></template>
        </b-avatar>
    </div>
</template>

<script>
export default {
    name: "Player",
    data() {
        return {
            players: [
                {id: 1, name: "Luiz"}
            ]
        }
    },
    sockets: {
        connect: function () {
        }
    }
}
</script>