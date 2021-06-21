<template>
    <b-card
        class="cards"
        overlay
        :img-src="getImgUrl(card.id)"
        img-top
        v-on:click="$parent.handleCardClick(card, $event)"
    >
        <div class="players">
            <Avatar v-for="player in card.players" :key="player.id" :player="player"/>
        </div>
    </b-card>
</template>

<script>
import Avatar from './Avatar.vue'
export default {
    components: { Avatar },
    name: 'Card',
    props: ['card'],
    methods: {
        getImgUrl: function(cardId) {
            var images = require.context('../assets/cards', false, /\.png$/)
            return images('./' + cardId + ".png")
        }
    }
}
</script>

<style lang="scss" scoped>
.players {
    position: absolute;
    bottom: 0;
    right: 0;
}

.cards {
    width: 95%;
    margin: 0 auto;
}
</style>
