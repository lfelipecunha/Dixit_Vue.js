const random_human_readable = require( "./random_human_readable")
var settings = require('./settings.js')


class Room {
    constructor(db, code) {
        this.database = db
        this.collection = db.collection(settings.database.collections.ROOMS)
        this.playersCollection = db.collection(settings.database.collections.PLAYERS)
        this.code = code
    }

    async init() {
        if (this.code) {
            if (! await this._exists(this.code)) {
                throw new Error("Invalid room code: " & this.code)
            }
        } else {
            this.code = await this._create()
        }
    }

    getCode() {
        return this.code
    }

    async getData() {
        return await this._getRoomByCode(this.code)
    }

    async setStatus(status) {
        if (!Object.values(settings.room.status).includes(status)) {
            throw 'Invalid room status ' & status
        }
        return this._update({status: status})
    }

    async getPlayers() {
        var options = {sort: {_id: 1}}
        var players = this.playersCollection.find({room:this.code}, options)
        return players.toArray()
    }

    async startGame() {
        if (await this.isStarted() || (await this._getNumberOfPlayers()) < settings.room.MIN_PLAYERS) {
            return false
        }

        return this._update({status: settings.room.status.STARTED})
    }

    async setCards(cards) {
        return this._update({cards: cards})
    }

    async setCurrentPlayer(player_id) {
        return this._update({current_player: player_id})
    }

    async getCurrentPlayerId() {
      return (await this.getData()).current_player
    }

    async isStarted() {
        var data = await this.getData()
        return data.status >= settings.room.status.STARTED
    }

    async canJoinNewPlayer() {
        return (await this._getNumberOfPlayers()) < settings.room.MAX_PLAYERS && !(await this.isStarted())
    }

    async canChooseACard(player) {
      let data = await this.getData()
      if (!player || data.status < settings.room.status.STARTED || data.status > settings.room.status.CHOOSE_SIMILAR_CARD) {
        return false
      }

      let playerId = (await player.getData())._id.toString()
      if (data.status == settings.room.status.STARTED && data.current_player.toString() != playerId) {
        return false
      }

      let can = true
      for (let i in data.chosen_cards) {
        let choose = data.chosen_cards[i]
        if (choose.player.toString() == playerId) {
          can = false
          break
        }
      }
      return can
    }

    async setChosenCard(card) {
      let updatedData = {
        chosen_cards: [
          { card: card, player: await this.getCurrentPlayerId() }
        ],
        status: settings.room.status.CHOOSE_SIMILAR_CARD,
        correct_card: card
      }
      return this._update(updatedData)
    }

    async addChosenCard(player, card) {
      let data = await this.getData()
      data.chosen_cards.push({player: (await player.getData())._id, card: card})
      let updatedData = {
        chosen_cards: data.chosen_cards
      }

      return this._update(updatedData)
    }

    async areAllPlayersReady() {
      var total_ready = await this.playersCollection.countDocuments({room: this.code, game_status: settings.player.game_status.READY})
      var total = await this.playersCollection.countDocuments({room: this.code})
      return (total-total_ready) === 0
    }

    async canGuess(player, card) {
      const room = await this.getData()
      const playerData = await player.getData()

      if (room.status != settings.room.status.FIND_THE_CHOSEN_CARD) {
        return false
      }

      if (room.current_player.toString() == playerData._id.toString()) {
        return false
      }

      for (var i in room.guessed_cards) {
        var guess = room.guessed_cards[i]
        if (guess.player.toString() == playerData._id.toString()) {
          return false
        }
      }

      for (var i in room.chosen_cards) {
        var choose = room.chosen_cards[i]
        if (choose.card == card && choose.player.toString() == playerData._id.toString()) {
          return false
        }
      }

      return true
    }

    async addGuessedCard(player, card) {
      let data = await this.getData()
      data.guessed_cards.push({player: (await player.getData())._id, card: card})
      return this._update({guessed_cards: data.guessed_cards})
    }

    // PRIVATE METHODS
    async _update(room_data) {
        var result = await this.collection.updateOne({code: this.code}, {$set: room_data})

        return result.result.ok == 1
    }

    async _getNumberOfPlayers() {
        return this.playersCollection.countDocuments({room:this.code})
    }

    async _create() {
        var code = ''
        var room = null
        do {
            code = random_human_readable(settings.room.CODE_SIZE)
        } while(await this._exists(code))

        var roomData = {
            code: code,
            status: settings.room.status.CREATED,
            cards: [],
            current_player: null,
            chosen_cards: [],
            correct_card: null,
            guessed_cards: []
        }
        var result = await this.collection.insertOne(roomData)
        return code
    }

    async _getRoomByCode(code) {
        var _, room = await this.collection.findOne({ code: code })
        return room
    }

    async _exists(code) {
        var room = await this._getRoomByCode(code)
        return room != null
    }

}
module.exports = Room
