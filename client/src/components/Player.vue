<template>
    <div>
        <PlayersHeader />
    </div>
</template>

<script>
import PlayersHeader from "@/components/PlayersHeader"
export default {
    name: "Player",
    data() {
        return {}
    },
    sockets: {
        connect: function () {
            console.log('socket connected')
            this.$socket.emit("start")
        },
        gameStarted: function (data) {
            console.log('Game Started', data)
        },
        yourTurn: function() {
            console.log('My Turn')
        }
    },
    components: {
        PlayersHeader
    }
}
</script>
