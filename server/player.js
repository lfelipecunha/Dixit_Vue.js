const settings = require('./settings.js')

const initialData = {
  game_status: settings.player.game_status.WAITING,
  cards: [],
  points: 0
}

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
    if ( !name || await this._getPlayerBySocketId(this.socket_id)) { // deny socket_id duplicates
      return false
    }

    var data = {
      ... initialData,
      status: settings.player.status.ACTIVE,
      socket_id: this.socket_id,
      name: name,
      room: this.room.getCode(),
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

  async endTurn(points) {
    return this._update({points: points, game_status: settings.player.game_status.WAITING})
  }

  async reset() {
    return this._update(initialData)
  }

  async remove() {
    let isStarted = await this.room.isStarted()
    if (isStarted) {
      return this._update({status: settings.player.status.INACTIVE})
    }

    return await this.collection.deleteOne({socket_id: this.socket_id})
  }

  async restoreStatus() {
    const roomData = await this.room.getData()
    const data = await this.getData()
    const id = data._id.toString()
    let status = {
      chooseCard: false,
      chooseSimiliarCard: false,
      guessCard: false
    }
    if (roomData.current_player.toString() == id) {
      status.chooseCard = true
    } else if (roomData.status == settings.room.status.CHOOSE_SIMILAR_CARD) {
      status.chooseSimiliarCard = true
      for (let i in roomData.chosen_cards) {
        if (roomData.chosen_cards[i].player.id.toString() == id) {
          status.chooseSimiliarCard = false
          break
        }
      }
    } else if (roomData.status == settings.room.status.FIND_THE_CHOSEN_CARD) {
      status.guessCard = true
      for (let i in roomData.guessed_cards) {
        if (roomData.guessed_cards[i].player.id.toString() == id) {
          status.guessCard = false
          break
        }
      }
    }
    return status
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
