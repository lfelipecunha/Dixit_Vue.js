
<template>
    <b-avatar :variant="player.status==0 ? 'light' : 'info'" class="players-icon" :text="alias">
        <template #badge v-if="player.game_status">
            <b-icon icon="hourglass-split" v-if="player.game_status=='waiting'"></b-icon>
            <b-icon icon="check2" v-if="player.game_status=='ready'"></b-icon>
        </template>
    </b-avatar>
</template>

<script>
export default {
    name: "Avatar",
    props: ['player', 'players', 'index'],
    data() {
        return {
            alias: ''
        }
    },
    created() {
        var firstChar = this.player.name.charAt(0)
        var number = 0
        for (var i=0; i< this.index; i++) {
            var previousFirstChar = this.players[i].name.charAt(0)
            if (firstChar == previousFirstChar) {
                number++
            }
        }
        this.alias = firstChar
        if (number > 0 ) {
            this.alias = this.alias + number
        }
    },
    methods: {
    }
}
</script>

<style lang="scss" scoped>
.players-icon {
    margin: 0 2px
}
</style>