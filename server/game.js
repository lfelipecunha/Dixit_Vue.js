import mongo from "mongodb"
//const { MongoClient } = require("mongodb");

const STATUS_CREATED = 0
const STATUS_STARTED = 1

const USER_STATUS_INACTIVE = 0
const USER_STATUS_ACTIVE = 1

const USER_GAME_STATUS_READY='ready'
const USER_GAME_STATUS_WAITING='waiting'


var dbClient = new mongo.MongoClient("mongodb://database:27017")
await dbClient.connect()
var dataBase = dbClient.db("dixit_game")

function shuffle(array) {
    var currentIndex = array.length;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        console.log("AQUI", currentIndex)
  
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
  }


class Game {
    constructor(io) {
        this.io = io
    }

    async createRoom() {
        //@TODO generate a room code
        var code = "abc-123"
        console.log("Creating Room", code)
        var result = await dataBase.collection("rooms").insertOne({ code: code, status: STATUS_CREATED})
        console.log("Created", result.result.ok)
        return code
    }

    async getRoom(code) {
        var _, room = await dataBase.collection("rooms").findOne({ code: code })
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
        var player = {socket_id: socket_id, name: name, room: room, status: USER_STATUS_ACTIVE, game_status: USER_GAME_STATUS_WAITING}
        console.log("Inserting player", player)
        var result = await dataBase.collection("players").insertOne(player)
        return result.result.ok == 1
    }

    async updatePlayer(socket_id, player_data) {
        console.log("Updating player", player_data)
        var result = await dataBase.collection("players").updateOne({socket_id: socket_id}, {$set: player_data})
        return result.ok == 1
    }

    async removePlayer(socket_id, room, hard) {
        if (hard) {
            await dataBase.collection("players").deleteOne({socket_id: socket_id})
        } else {
            await dataBase.collection("players").updateOne({socket_id: socket_id}, {$set: {status: USER_STATUS_INACTIVE}})
        }

        var cursor = dataBase.collection("players").find({room: room, status: USER_STATUS_ACTIVE})
        var players_in_room = await cursor.count()
        if (players_in_room <= 0) {
            await dataBase.collection("rooms").deleteOne({room: room})
        }
    }

    async joinRoom(name, room, session_room, session_socket_id, socket_id, rejoin) {
        console.log("Joining to room", room, "player", name, "Socket", socket_id, "Session Socket:", session_socket_id)
        var roomExists = await this.roomExists(room)
        if (!roomExists) {
            console.warn("Room doesn't exists", room, name)
            return false
        }

        var gameStarted = await this.isStarded(room)
        var numOfPlayers = (await this.getPlayersList(room)).length

        if (numOfPlayers < 8 && (room == session_room || session_room == null)) {
            var db_player = await this.getPlayerBySocketId(session_socket_id)
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
                    return await this.updatePlayer(session_socket_id, db_player)
                }
                return true 
            }
            return await this.registerPlayer(name, room, socket_id)
        } 

        console.error("An error has occured")
        return false
    }
    
    async getPlayersList(room) {
        var players = dataBase.collection("players").find({room: room},{sort: {_id: 1}})
        return players.toArray()
    }

    async getPlayerBySocketId(socket_id) {
        var _, player = await dataBase.collection("players").findOne({socket_id: socket_id})
        return player
    }

    async startGame(room) {
        if (!await this.roomExists(room)) {
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
        cards = shuffle(cards)
        await dataBase.collection('rooms').updateOne({code: room}, {$set: {status: STATUS_STARTED, cards: cards}})
        await this.distributeCards(room, 6)
        return true
    }

    async distributeCards(roomCode, amount) {
        var room = await this.getRoom(roomCode)
        var players = await this.getPlayersList(roomCode)
        for (var i=0; i < amount; i++) {
            for (var p in players) {
                var player = players[p]
                if (!player.cards) {
                    player.cards = []
                }
                player.cards.push(room.cards.shift())
            }
        }
        console.log(players)
        var promises = []
        for (var p in players) {
            promises.push(
                dataBase.collection('players').updateOne({_id: players[p]._id}, {$set: {cards: players[p].cards}})
            )
        }
        promises.push(dataBase.collection('rooms').updateOne({code: roomCode}, {$set:{cards: room.cards}}))
        await Promise.allSettled(promises)
        return true
    }

    async nextPlayer(roomCode) {
        var players = await this.getPlayersList(roomCode)
        var room = await this.getRoom(roomCode)
        var currentPlayer = players[0]
        if (room.current_player) {
            for(var p in players) {
                let player = players[p]
                if (player._id == room.currentPlayer) {
                    let next = p+1
                    if (next > players.length-1) {
                        next = 0
                    }
                    currentPlayer = players[p]
                    break
                }
            }
        }

        await dataBase.collection('rooms').updateOne({code: roomCode}, {$set: {current_player: currentPlayer._id}})

        return currentPlayer
    }
}

export default Game