const random_human_readable = require( "./random_human_readable")

const STATUS_CREATED = 0
const STATUS_STARTED = 1
const STATUS_CHOOSE_SIMILAR_CARD = 2
const STATUS_FIND_THE_CHOSEN_CARD = 3

const USER_STATUS_INACTIVE = 0
const USER_STATUS_ACTIVE = 1

const USER_GAME_STATUS_READY='ready'
const USER_GAME_STATUS_IDDLE='iddle'
const USER_GAME_STATUS_WAITING='waiting'


class Game {
    constructor(db) {
        this.database = db
    }

    async createRoom() {
        //@TODO generate a room code
        var codeLength = 9
        var code = ''
        var room = null
        do {
            code = random_human_readable(codeLength)
            room = await this.getRoom(code)
        } while(room)

        console.log("Creating Room", code)
        var roomData = { 
            code: code, 
            status: STATUS_CREATED, 
            cards: [], 
            current_player: null,
            chosen_cards: [],
            correct_card: null,
            guessed_cards: []
        }
        var result = await this.database.collection("rooms").insertOne(roomData)
        console.log("Created", result.result.ok)
        return code
    }

    async getRoom(code) {
        var _, room = await this.database.collection("rooms").findOne({ code: code })
        return room
    }

    async roomExists(room) {
        console.log("Verifying if Room exists", room)
        var room = await this.getRoom(room)
        console.log("Room", room)
        return room != null
    }

    async isStarded(room) {
        console.log("Verifying if Room is started")
        var room = await this.getRoom(room)
        return room && room.status >= STATUS_STARTED
    }

    async registerPlayer(name, room, socket_id) {
        var player = {
            socket_id: socket_id, 
            name: name, 
            room: room, 
            status: USER_STATUS_ACTIVE, 
            game_status: USER_GAME_STATUS_WAITING,
            cards: [],
            points: 0
        }
        console.log("Inserting player", player)
        if (await this.getPlayerBySocketId(socket_id)) { // deny socket_id duplicates
            return false
        }
        var result = await this.database.collection("players").insertOne(player)
        return result.result.ok == 1
    }

    async updatePlayer(id, player_data) {
        console.log("Updating player", player_data)
        var result = await this.database.collection("players").updateOne({_id: id}, {$set: player_data})
        return result.result.ok == 1
    }

    async updateRoom(code, room_data) {
        console.log("Updating room", room_data)
        var result = await this.database.collection("rooms").updateOne({code: code}, {$set: room_data})

        return result.result.ok == 1
    }

    async removePlayer(socket_id, room, hard) {
        var db_player = await this.getPlayerBySocketId(socket_id)
        if (!db_player) {
            return false
        }

        if (hard) {
            await this.database.collection("players").deleteOne({socket_id: socket_id})
        } else {
            await this.updatePlayer(db_player._id, {status: USER_STATUS_INACTIVE})
        }

        var players_in_room = await this.database.collection("players").countDocuments({room: room, status: USER_STATUS_ACTIVE})
        if (players_in_room <= 0) {
            await this.database.collection("rooms").deleteOne({code: room})
        }

        return true
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

        var gameStarted = await this.isStarded(room)
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
        var _, player = await this.database.collection("players").findOne({socket_id: socket_id})
        return player
    }

    async startGame(room) {
        if (!await this.roomExists(room)) {
            return false
        }

        if (await this.isStarded(room)) {
            return false
        }

        var players = await this.getPlayersList(room)
        if (players.length < 3) {
            return false
        }
        const MAXIMUM_CARDS = 52
        var totalOfCards = MAXIMUM_CARDS - ( MAXIMUM_CARDS % players.length )
        console.log("Total", totalOfCards)
        var cards = Array.from(Array(totalOfCards).keys())
        cards = this.shuffle(cards)
        await this.updateRoom(room, {status: STATUS_STARTED, cards: cards})
        await this.distributeCards(room, 6)
        return true
    }

    async distributeCards(roomCode, amount) {
        var room = await this.getRoom(roomCode)
        var players = await this.getPlayersList(roomCode, true)
        for (var i=0; i < amount; i++) {
            for (var p in players) {
                var player = players[p]
                player.cards.push(room.cards.shift())
            }
        }
        var promises = []
        for (var p in players) {
            promises.push(
                this.updatePlayer(players[p]._id, {cards: players[p].cards})
            )
        }
        promises.push(this.updateRoom(roomCode, {cards: room.cards}))
        await Promise.allSettled(promises)
    }

    async nextPlayer(roomCode) {
        console.log("Calculating next player", roomCode)
        var players = await this.getPlayersList(roomCode, true)
        var room = await this.getRoom(roomCode)
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
        promises.push(this.updateRoom(roomCode, {current_player: currentPlayer._id}))
        for (var i in players) {
            var player = players[i]
            var game_status = USER_GAME_STATUS_IDDLE

            if (player._id.toString() == currentPlayer._id.toString()) {
                game_status = USER_GAME_STATUS_WAITING
            }
            promises.push(this.updatePlayer(player._id, {game_status: game_status}))

        }
        await Promise.allSettled(promises)
        return currentPlayer
    }

    async chosenCard(roomCode, card, socket_id) {
        var room = await this.getRoom(roomCode)
        if (!room) {
            return false
        }

        var player = await this.getPlayerBySocketId(socket_id)

        if (!player || room.current_player.toString() != player._id.toString()) {
            return false
        }

        if (! await this._canChoose(room, player._id)) {
            return false
        }

        var index = player.cards.indexOf(card)
        if (index == -1) {
            return false
        }
        
        player.cards.splice(index, 1)

        await this.updateRoom(roomCode, {chosen_cards: [{card: card, player: player._id}], correct_card: card, status: STATUS_CHOOSE_SIMILAR_CARD})
        await this.updatePlayer(player._id, {cards: player.cards, game_status: USER_GAME_STATUS_READY})
        return true

    }

    async _canChoose(room, player_id) {
        var can = true
        for (var i in room.chosen_cards) {
            var choose = room.chosen_cards[i]
            if (choose.player.toString() == player_id.toString()) {
                can = false
                break
            }
        }
        return can
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

    async similarCardChosen(roomCode, card, socket_id) {
        var room = await this.getRoom(roomCode)
        if (!room) {
            return false
        }

        if (room.status != STATUS_CHOOSE_SIMILAR_CARD) {
            return false
        }

        var player = await this.getPlayerBySocketId(socket_id)

        if (!player) {
            return false
        }

        if (! await this._canChoose(room, player._id)) {
            return false
        }

        var index = player.cards.indexOf(card)
        if (index == -1) {
            return false
        }

        player.cards.splice(index, 1)

        room.chosen_cards.push({card: card, player: player._id})
        await this.updateRoom(roomCode, {chosen_cards: room.chosen_cards})
        await this.updatePlayer(player._id, {cards: player.cards, game_status: USER_GAME_STATUS_READY})
        return true
    }

    async areAllPlayersReady(room) {
        if (! await this.roomExists(room)) {
            return false
        }

        var total_ready = await this.database.collection("players").countDocuments({room: room, game_status: USER_GAME_STATUS_READY})
        var total = await this.database.collection("players").countDocuments({room: room})
        return (total-total_ready) === 0
        
    }
    async endChooseAndGetCards(roomCode) {
        var room = await this.getRoom(roomCode)
        if (!room) {
            return false
        }

        if (room.status != STATUS_CHOOSE_SIMILAR_CARD) {
            return false
        }

        if (!await this.areAllPlayersReady(roomCode)) {
            return false
        }

        var promises = []
        promises.push(this.updateRoom(roomCode, {status: STATUS_FIND_THE_CHOSEN_CARD}))
        var players = await this.getPlayersList(roomCode, true)
        for (var i in players) {
            var player = players[i]
            if (player._id.toString() != room.current_player.toString()) {
                promises.push(this.updatePlayer(player._id, {game_status: USER_GAME_STATUS_WAITING}))
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