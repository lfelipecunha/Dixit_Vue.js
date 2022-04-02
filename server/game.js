var Room = require("./room.js")
var Player = require("./player.js")
var settings = require('./settings.js')

class Game {
  static async createPlayerBySocketId(database, oldSocketId, newSocketId) {
    let collection = database.collection(settings.database.collections.PLAYERS)
    let _, player = await collection.findOne({socket_id: oldSocketId})
    if (!!player) {
      await collection.updateOne({_id: player._id}, {$set: {socket_id: newSocketId}})
      return new Player(database, newSocketId, new Room(database, player.room))
    }
  }
  constructor(db, roomCode) {
    this.database = db
    this.room = new Room(db, roomCode)
  }

  async init() {
    await this.room.init()
  }

  async removePlayer(socket_id, hard) {
    var db_player = await this.getPlayerBySocketId(socket_id)
    if (!db_player) {
      return false
    }

    if (hard) {
      await this.database.collection("players").deleteOne({socket_id: socket_id})
    } else {
      await this.updatePlayer(db_player._id, {status: USER_STATUS_INACTIVE})
    }

    var room = this.room.getCode()

    var players_in_room = await this.database.collection("players").countDocuments({room: room, status: USER_STATUS_ACTIVE})
    if (players_in_room <= 0) {
      await this.database.collection("rooms").deleteOne({code: room})
    }

    return true
  }

  async join(playerName, socketId) {
    if (! await this.room.canJoinNewPlayer()) {
      return false
    }
    var player = new Player(this.database, socketId, this.room)
    if (! await player.register(playerName)) {
      return false
    }

    return player
  }

  /*async joinRoom(name, room, old_room, old_socket_id, socket_id, rejoin) {
    console.log("Joining to room", room, "player", name, "Socket", socket_id, "Session Socket:", old_socket_id)
    if ((!name && !rejoin) || !socket_id) {
    return false
    }
    var roomExists = await this.roomExists(room)
    if (!roomExists) {
    console.warn("Room doesn't exists", room, name)
    return false
    }

    var gameStarted = await this.room.isStarded()
    var numOfPlayers = (await this.getPlayersList(room)).length

    if (numOfPlayers < 8 && (room == old_room || old_room == null)) {
    var db_player = await this.getPlayerBySocketId(old_socket_id)
    if (gameStarted && !db_player) {
    console.warn("The player was trying to enter in an already started game!", room, name)
    return false
    }

    if (rejoin && !db_player) {
    console.warn("The player was trying rejoin but not exists in db!", room, name)
    return false
    }

    if (db_player) {
    if (db_player.socket_id != socket_id) {
    db_player.socket_id = socket_id
    db_player.status = USER_STATUS_ACTIVE
    return await this.updatePlayer(db_player._id, db_player)
    }
    return true
    }
    return await this.registerPlayer(name, room, socket_id)
    }

    console.error("An error has occured")
    return false
    }*/

  async start() {
    if (!await this.room.startGame()) {
      return false
    }

    var players = await this.room.getPlayers()
    var totalOfCards = settings.game.MAXIMUM_CARDS - ( settings.game.MAXIMUM_CARDS % players.length )
    var cards = Array.from(Array(totalOfCards).keys())
    cards = this._shuffle(cards)
    await this.room.setCards(cards)
    await this._distributeCards(settings.game.HAND_SIZE)
    return true
  }


  async nextPlayer() {
    var players = await this.room.getPlayers()
    var room = await this.room.getData()
    var currentPlayer = players[0]
    if (room.current_player) {
      for(var p in players) {
        let player = players[p]
        if (player._id.toString() === room.current_player.toString()) {
          let next = parseInt(p)+1
          if (next > players.length-1) {
            next = 0
          }
          currentPlayer = players[next]
          break
        }
      }
    }
    var promises = []
    promises.push(this.room.setCurrentPlayer(currentPlayer._id))
    for (var i in players) {
      var player = players[i]
      var game_status = settings.player.game_status.IDDLE

      if (player._id.toString() == currentPlayer._id.toString()) {
        game_status = settings.player.game_status.WAITING
      }

      var playerObj = new Player(this.database, player.socket_id, this.room)
      promises.push(playerObj.setGameStatus(game_status))

    }
    await Promise.allSettled(promises)
    return new Player(this.database, currentPlayer.socket_id, this.room)
  }

  async chosenCard(player, card, tip) {
    if (! await this.room.canChooseACard(player)) {
      return false
    }
    if (! await player.chooseCard(card)) {
      return false
    }
    await this.room.setChosenCard(card, tip)

    return true
  }

  async similarCardChosen(player, card) {
    if (! await this.room.canChooseACard(player)) {
      return false
    }

    if (! await player.chooseCard(card)) {
      return false
    }
    await this.room.addChosenCard(player, card)

    return true
  }

  async endChooseAndGetCards() {
    let room = await this.room.getData()

    if (room.status != settings.room.status.CHOOSE_SIMILAR_CARD) {
      return false
    }

    if (!await this.room.areAllPlayersReady()) {
      return false
    }

    var promises = []
    promises.push(this.room.setStatus(settings.room.status.FIND_THE_CHOSEN_CARD))
    var players = await this.room.getPlayers()
    for (var i in players) {
      var player = players[i]
      if (player._id.toString() != room.current_player.toString()) {
        let playerObj = new Player(this.database, player.socket_id, this.room)
        promises.push(playerObj.setGameStatus(settings.player.game_status.WAITING))
      }
    }
    await Promise.allSettled(promises)
    const shuffledCards = this._shuffle(room.chosen_cards.map((value) => {return value.card}))
    this.room.setShuffledCards(shuffledCards)
    return shuffledCards

  }

  async guessedCard(player, card) {
    if (! await this.room.canGuess(player, card)) {
      return false
    }
    await this.room.addGuessedCard(player, card)
    await player.setGameStatus(settings.player.game_status.READY)
    return true
  }

  async endTurn() {
    if (! await this.room.canEndTurn()) {
      return false
    }

    let players = await this.room.getPlayers()
    let room = await this.room.getData()
    let wrong = []
    for (let i in room.guessed_cards) {
      let guess = room.guessed_cards[i]
      if (guess.card != room.correct_card) {
        wrong.push(guess)
      }
    }

    let promises = []
    for (let p in players) {
      let player = players[p]
      let points = player.points
      if (player._id.toString() == room.current_player.toString()) {
        if (wrong.length > 0 && wrong.length < players.length-1) { // someone got it right but not everybody
          points+=3
        }
      } else {
        points += 2
        let gotItRight = true
        for (let w in wrong) {
          let guess = wrong[w]
          if (guess.player.toString() == player._id.toString()) { // this player got it wrong
            gotItRight = false
            if (wrong.length < players.length-1) { // someone got it right
              points -=2
            }
          } else {
            for (let cc in room.chosen_cards) {
              let choose = room.chosen_cards[cc]
              if (choose.card == guess.card && choose.player.toString() == player._id.toString()) { // someone choose this player card
                points+=1
              }
            }
          }
        }

        if (gotItRight && wrong.length > 0 && wrong.length < players.length-1) { // this player got it right and at least one, but not all, player got it wrong
          points += 1 // just one more 'cause it was initialized with 2 points
        }
      }
      if (points < player.points) {
        points = player.points
      }
      let playerObj = new Player(this.database, player.socket_id, this.room)
      promises.push(playerObj.endTurn(points))
    }

    promises.push(this.room.endTurn())

    await Promise.allSettled(promises)
    await this._distributeCards(1)
    return true
  }

  async end() {
    let players = await this.room.getPlayers(true)
    players.sort((a, b) => {
      return b.points - a.points
    })
    await this.room.resetAll()
    return players
  }

  async isEndOfGame() {
    return ! await this.room.hasEnoughCards() && await this.room.areUsersHandsEmpty()
  }

  // PRIVATE METHODS
  _shuffle(array) {
    var currentIndex = array.length;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
  }

  async _distributeCards(amount) {
    var room = await this.room.getData()
    var players = await this.room.getPlayers()

    if (room.cards.length < players.length) { // do not distribute when there are no cards
      return
    }

    for (var i=0; i < amount; i++) {
      for (var p in players) {
        var player = players[p]
          player.cards.push(room.cards.shift())
      }
    }
    var promises = []
    for (var p in players) {
      let playerObj = new Player(this.database, players[p].socket_id, this.room)
      promises.push(playerObj.setHand(players[p].cards))
    }
    promises.push(this.room.setCards(room.cards))
    await Promise.allSettled(promises)
  }
}

module.exports = Game
