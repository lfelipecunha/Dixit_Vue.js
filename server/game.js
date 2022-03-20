var Room = require("./room.js")
var Player = require("./player.js")
var settings = require('./settings.js')

class Game {
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
        return player.register(playerName)
    }

    async joinRoom(name, room, old_room, old_socket_id, socket_id, rejoin) {
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
    }

    async getPlayersList(room, full_data) {
        var options = {sort: {_id: 1}}
        if (!full_data) {
            //options.projection = {_id:0, name: 1, room: 1, status: 1, game_status: 1, cards: 0, points: 1}
        }
        var players = this.database.collection("players").find({room: room}, options)
        return players.toArray()
    }

    async getPlayerBySocketId(socket_id) {
        console.log(socket_id);
    }

    async start() {
        if (!await this.room.startGame()) {
            return false
        }

        var players = await this.room.getPlayers()
        var totalOfCards = settings.game.MAXIMUM_CARDS - ( settings.game.MAXIMUM_CARDS % players.length )
        var cards = Array.from(Array(totalOfCards).keys())
        cards = this.shuffle(cards)
        await this.room.setCards(cards)
        await this.distributeCards(settings.game.HAND_SIZE)
        return true
    }

    async distributeCards(amount) {
        var room = await this.room.getData()
        var players = await this.room.getPlayers()
        for (var i=0; i < amount; i++) {
            for (var p in players) {
                var player = players[p]
                player.cards.push(room.cards.shift())
            }
        }
        var promises = []
        for (var p in players) {
            let playerObj = new Player(this.database, players[p].socket_id, this.room)
            promises.push(
                playerObj.setHand(players[p].cards)
            )
        }
        promises.push(this.room.setCards(room.cards))
        await Promise.allSettled(promises)
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

    async chosenCard(player, card) {
      if (! await this.room.canChooseACard(player)) {
        return false
      }
      if (! await player.chooseCard(card)) {
        return false
      }
      await this.room.setChosenCard(card)

      return true
    }

    async _canGuess(room, player_id, card) {
        for (var i in room.guessed_cards) {
            var guess = room.guessed_cards[i]
            if (guess.player.toString() == player_id.toString()) {
                return false
            }
        }
        for (var i in room.chosen_cards) {
            var choose = room.chosen_cards[i]
            if (choose.card == card && choose.player.toString() == player_id.toString()) {
                return false
            }
        }
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
        return this.shuffle(room.chosen_cards.map((value) => {return value.card}))
    }

    async guessedCard(roomCode, card, socket_id) {
        var room = await this.getRoom(roomCode)
        if (!room) {
            return false
        }
        if (room.status != STATUS_FIND_THE_CHOSEN_CARD) {
            return false
        }

        var player = await this.getPlayerBySocketId(socket_id)

        if (!player || room.current_player.toString() == player._id.toString()) {
            return false
        }

        if (!await this._canGuess(room, player._id, card)) {
            return false
        }

        room.guessed_cards.push({card: card, player: player._id})
        await this.updateRoom(roomCode, {guessed_cards: room.guessed_cards})
        await this.updatePlayer(player._id, {cards: player.cards, game_status: USER_GAME_STATUS_READY})
        return true
    }

    async endTurn(roomCode) {
        var room = await this.getRoom(roomCode)
        if (!room) {
            return false
        }

        if (room.status != STATUS_FIND_THE_CHOSEN_CARD) {
            return false
        }

        if (!await this.areAllPlayersReady(roomCode)) {
            return false
        }
        var players = await this.getPlayersList(roomCode, true)
        var wrong = []
        for (var i in room.guessed_cards) {
            var guess = room.guessed_cards[i]
            if (guess.card != room.correct_card) {
                wrong.push(guess)
            }
        }


        var promises = []
        for (var p in players) {
            var player = players[p]
            var points = player.points
            if (player._id.toString() == room.current_player.toString()) {
                if (wrong.length > 0 && wrong.length < players.length-1) { // someone got it right but not everybody
                    points+=3
                }
            } else {
                points += 2
                var gotItRight = true
                for (var w in wrong) {
                    var guess = wrong[w]
                    if (guess.player.toString() == player._id.toString()) { // this player got it wrong
                        gotItRight = false
                        if (wrong.length < players.length-1) { // someone got it right
                            points -=2
                        }
                    } else {

                        for (var cc in room.chosen_cards) {
                            var choose = room.chosen_cards[cc]
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
            var playerData = {game_status: USER_GAME_STATUS_WAITING}
            if (points > player.points) {
                playerData.points = points
            }
            promises.push(this.updatePlayer(player._id, playerData))
        }

        promises.push(this.updateRoom(roomCode, {chosen_cards: [], guessed_cards:[], correct_card: null, status: STATUS_STARTED}))

        await Promise.allSettled(promises)
        await this.distributeCards(roomCode, 1)
        return true

    }

    shuffle(array) {
        var currentIndex = array.length;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

          // Pick a remaining element...
          let randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;

          // And swap it with the current element.
          [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
        }

        return array;
      }


}

module.exports = Game
