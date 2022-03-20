var settings = require('./settings.js')

class Player {
    constructor(db, socket_id, room) {
        if (!socket_id) {
            throw new Error("It's required to pass a socket ID")
        }
        this.database = db
        this.collection = db.collection(settings.database.collections.PLAYERS)
        this.socket_id = socket_id
        this.room = room
    }

    async getData() {
      return this._getPlayerBySocketId(this.socket_id)
    }

    async register(name) {
        if (
            !name ||
            await this._getPlayerBySocketId(this.socket_id)
        ) { // deny socket_id duplicates
            return false
        }

        var data = {
            socket_id: this.socket_id,
            name: name,
            room: this.room.getCode(),
            status: settings.player.status.ACTIVE,
            game_status: settings.player.game_status.WAITING,
            cards: [],
            points: 0
        }

        var result = await this.collection.insertOne(data)
        return result.result.ok == 1
    }

    async setHand(cards) {
        return this._update({cards: cards})
    }

    async setGameStatus(game_status) {
        return this._update({game_status: game_status})
    }

    async chooseCard(card) {
      let data = await this.getData()
      let index = data.cards.indexOf(card)
      if (index == -1) {
        return false
      }

      data.cards.splice(index, 1)
      await this.setHand(data.cards)
      await this.setGameStatus(settings.player.game_status.READY)

      return true
    }

    // PRIVATE METHODS
    async _update(data) {
        var result = await this.collection.updateOne({socket_id: this.socket_id}, {$set: data})

        return result.result.ok == 1
    }


    async _getPlayerBySocketId(socket_id) {
        var _, player = await this.collection.findOne({socket_id: socket_id})
        return player
    }

}

module.exports = Player
