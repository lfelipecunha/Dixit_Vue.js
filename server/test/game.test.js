var mongo = require('mongodb')
var Game = require("../game.js")

var dbClient = new mongo.MongoClient("mongodb://database:27017")
var database = null
beforeAll(async () => {
    await dbClient.connect()
    database = dbClient.db("dixit_game_test")
})

beforeEach(async () => {    
    await database.dropDatabase()
})

test('Create Room',async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(roomCode).not.toBeNull()
    expect(roomCode).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)

    var room = await game.getRoom(roomCode)

    expect(room).not.toBeNull()
    expect(room).not.toBeUndefined()

    expect(room.code).toBe(roomCode)
    expect(room.status).toBe(0)
    
    expect(room.current_player).toBeNull()
    expect(room.correct_card).toBeNull()
    
    expect(room.cards).toBeInstanceOf(Array)
    expect(room.cards.length).toBe(0)
    expect(room.chosen_cards).toBeInstanceOf(Array)
    expect(room.chosen_cards.length).toBe(0)
    expect(room.guessed_cards).toBeInstanceOf(Array)
    expect(room.guessed_cards.length).toBe(0)
})

test("Create 2 rooms - Garantee the code generation", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    var roomCode2 = await game.createRoom()
    expect(roomCode2).not.toBe(roomCode)
})

test("Join Room", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    var socketId = "123455"

    var joined = await game.joinRoom("Player", roomCode, null, null, socketId, false)
    expect(joined).toBeTruthy()
    var players = await game.getPlayersList(roomCode, true)
    expect(players).toBeInstanceOf(Array)
    expect(players.length).toBe(1)
    
    var player = await game.getPlayerBySocketId(socketId)
    expect(player.socket_id).toBe(socketId)
    expect(player.name).toBe("Player")
    expect(player.room).toBe(roomCode)
    expect(player.status).toBe(1) // Active
    expect(player.game_status).toBe("waiting") // Waiting
    expect(player.cards).toBeInstanceOf(Array)
    expect(player.cards.length).toBe(0)
    expect(player.points).toBe(0)

    expect(player.socket_id).toBe(players[0].socket_id)
})

test("Join Room limit exceed", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    
    for (var i=0; i<8; i++) {
        expect(await game.joinRoom("Player "+i, roomCode, null, null, "socket"+i, false)).toBeTruthy()
    }
    expect(await game.joinRoom("Player 9", roomCode, null, null, "socket9", false)).toBeFalsy()
})

test("Join to an invalid Room", async () => {
    var game = new Game(database)
    var joined = await game.joinRoom("Player", "invalid-room", null, null, "123456", false)
    expect(joined).toBeFalsy()
})


test("Join to without a name", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    var joined = await game.joinRoom(null, roomCode, null, null, "123456", false)
    expect(joined).toBeFalsy()
})

test("Join to without a socket ID", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    var joined = await game.joinRoom("Player", roomCode, null, null, null, false)
    expect(joined).toBeFalsy()
})

test("Join with duplicated socket ID", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player", roomCode, null, null, "123", false)).toBeTruthy()
    expect(await game.joinRoom("Player 2", roomCode, null, null, "123", false)).toBeFalsy()
})

test("Join with duplicated Name", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player", roomCode, null, null, "123", false)).toBeTruthy()
    expect(await game.joinRoom("Player", roomCode, null, null, "1234", false)).toBeTruthy()
    expect((await game.getPlayersList(roomCode)).length).toBe(2)
})

test("Join a started game", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
    expect(await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)).toBeTruthy()
    expect(await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)).toBeTruthy()
    expect(await game.startGame(roomCode)).toBeTruthy()
    expect(await game.joinRoom("Player 4", roomCode, null, null, "socket4", false)).toBeFalsy()
})

test("Rejoin", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player", roomCode, null, null, "oldsocket", false)).toBeTruthy()
    var updatedPlayer = await game.getPlayerBySocketId("oldsocket")
    expect(await game.removePlayer("old_socket", roomCode, false))
    expect(await game.joinRoom(null, roomCode, roomCode, "oldsocket", "newsocket", true)).toBeTruthy()
    var updatedPlayer = await game.getPlayerBySocketId("newsocket")
    expect(updatedPlayer._id).toEqual(updatedPlayer._id)
    expect(updatedPlayer.status).toBe(1) // active
})


test("Rejoin a started game", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player 1", roomCode, null, null, "oldsocket", false)).toBeTruthy()
    expect(await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)).toBeTruthy()
    expect(await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)).toBeTruthy()
    expect(await game.startGame(roomCode)).toBeTruthy()

    expect(await game.removePlayer("old_socket", roomCode, false))
    expect(await game.joinRoom(null, roomCode, roomCode, "oldsocket", "newsocket", true)).toBeTruthy()
})

test("Rejoin with invalid socket", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom(null, roomCode, roomCode, "oldsocket", "newsocket", true)).toBeFalsy()
})

test("Starting Game", async() => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    var socket1 = "socket-1"
    var socket2 = "socket-2"
    var socket3 = "socket-3"
    var joined = await game.joinRoom("Player 1", roomCode, null, null, socket1, false)
    expect(joined).toBeTruthy()
    joined = await game.joinRoom("Player 2", roomCode, null, null, socket2, false)
    expect(joined).toBeTruthy()
    joined = await game.joinRoom("Player 3", roomCode, null, null, socket3, false)
    expect(joined).toBeTruthy()
    expect((await game.getPlayersList(roomCode)).length).toBe(3)

    var started = await game.startGame(roomCode)
    expect(started).toBeTruthy()
    var room = await game.getRoom(roomCode)
    expect(room.cards).toBeInstanceOf(Array)
    expect(room.cards.length).toBeGreaterThan(0)
    expect(room.status).toBe(1)

    expect(await game.isStarded(roomCode)).toBeTruthy()

    var players = await game.getPlayersList(roomCode, true)
    await players.forEach(player => {
        expect(player.cards).toBeInstanceOf(Array)
        expect(player.cards.length).toBe(6)
    });
})

test("Start Game Without the minimal players", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
    expect(await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)).toBeTruthy()
    expect((await game.getPlayersList(roomCode)).length).toBe(2)
    expect(await game.startGame(roomCode)).toBeFalsy()
})

test("Start Game with an invalid room", async () => {
    var game = new Game(database)
    expect(await game.startGame("unexistent-room")).toBeFalsy()
})

test("Start Game twice", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)
    expect(await game.startGame(roomCode)).toBeTruthy()
    expect(await game.startGame(roomCode)).toBeFalsy()
})

test("Cards distribution", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    var socket1 = "socket-1"
    var socket2 = "socket-2"
    var socket3 = "socket-3"
    await game.joinRoom("Player 1", roomCode, null, null, socket1, false)
    await game.joinRoom("Player 2", roomCode, null, null, socket2, false)
    await game.joinRoom("Player 3", roomCode, null, null, socket3, false)

    await game.startGame(roomCode)
    var room = await game.getRoom(roomCode)
    var players = await game.getPlayersList(roomCode, true)

    await game.distributeCards(roomCode, 1)

    var updatedRoom = await game.getRoom(roomCode)
    var updatedPlayers = await game.getPlayersList(roomCode, true)

    var allCards = [...updatedRoom.cards]
    players.forEach((player) => {
        updatedPlayers.every((updatedPlayer) => {
            if (updatedPlayer._id.toString() == player._id.toString()) {
                expect(updatedPlayer.cards.length).toBe(player.cards.length+1) // verify if the player's hand was incremented with a new card
                allCards.push.apply(allCards, updatedPlayer.cards)
                return false
            }
            return true
        })
    })
    expect(updatedRoom.cards.length).toBe(room.cards.length-3) // verifify if room's cards were removed

    expect(allCards.length).toBe(([...new Set(allCards)]).length) // verify if there is no duplicates
    
})

test("Start game without the minimal players", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    var socket1 = "socket-1"
    var socket2 = "socket-2"

    expect(await game.joinRoom("Player 1", roomCode, null, null, socket1, false)).toBeTruthy()
    expect((await game.getPlayersList(roomCode)).length).toBe(1)
    expect(await game.startGame(roomCode)).toBeFalsy()

    expect(await game.joinRoom("Player 2", roomCode, null, null, socket2, false)).toBeTruthy()
    expect((await game.getPlayersList(roomCode)).length).toBe(2)
    expect(await game.startGame(roomCode)).toBeFalsy()
})


test("Calculating Next Player", async() => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    var socket1 = "socket-1"
    var socket2 = "socket-2"
    var socket3 = "socket-3"
    await game.joinRoom("Player 1", roomCode, null, null, socket1, false)
    await game.joinRoom("Player 2", roomCode, null, null, socket2, false)
    await game.joinRoom("Player 3", roomCode, null, null, socket3, false)

    await game.startGame(roomCode)
    for(var i=0; i<4; i++) {
        var index = i % 3
        var currentPlayer = await game.nextPlayer(roomCode)
        var status = ["iddle", "iddle", "iddle"]
        status[index] = "waiting"
        expect(currentPlayer).not.toBeNull()
        
        var room = await game.getRoom(roomCode)
        var players = await game.getPlayersList(roomCode, true)

        expect(room.current_player).not.toBeNull()
        expect(room.current_player).toEqual(currentPlayer._id)
        expect(players[index]._id).toEqual(currentPlayer._id)
        
        expect(players[0].game_status).toEqual(status[0])
        expect(players[1].game_status).toEqual(status[1])
        expect(players[2].game_status).toEqual(status[2])
    }
})

test("Choose a card", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var player = await game.nextPlayer(roomCode)

    var card = player.cards[0]

    expect(await game.chosenCard(roomCode, card, player.socket_id)).toBeTruthy()
    var room = await game.getRoom(roomCode)
    expect(room.chosen_cards).toBeInstanceOf(Array)
    expect(room.chosen_cards.length).toBe(1)
    expect(room.chosen_cards[0].card).toBe(card)

    player = await game.getPlayerBySocketId(player.socket_id)
    expect(player.cards).toBeInstanceOf(Array)
    expect(player.cards).toEqual(expect.not.arrayContaining([card]))
    expect(room.correct_card).toBe(card)
    expect(room.status).toBe(2)
})

test("Choose a card that is not mine", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var player = await game.nextPlayer(roomCode)

    var card = (await game.getRoom(roomCode)).cards[0]

    expect(await game.chosenCard(roomCode, card, player.socket_id)).toBeFalsy()
})

test("Choose a card when it's no my time", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    var players = await game.getPlayersList(roomCode, true)
    expect.assertions(2)
    for (var i=0; i < players.length; i++) {
        var player = players[i]
        if (player._id.toString() != currentPlayer._id.toString()) {
            expect(await game.chosenCard(roomCode, player.cards[0], player.socket_id)).toBeFalsy()
        }
    }
})

test("Choose a card twice", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var player = await game.nextPlayer(roomCode)
    expect(await game.chosenCard(roomCode, player.cards[0], player.socket_id)).toBeTruthy()
    expect(await game.chosenCard(roomCode, player.cards[1], player.socket_id)).toBeFalsy()
})

test("Choose a card with incorrect room", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var player = await game.nextPlayer(roomCode)
    expect(await game.chosenCard(roomCode+"abc", player.cards[1], player.socket_id)).toBeFalsy()
})

test("Choose similar cards", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode)
    var quantity = 1
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            expect(await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)).toBeTruthy()
            var updatedPlayer = await game.getPlayerBySocketId(player.socket_id)
            expect(updatedPlayer.cards).toEqual(expect.not.arrayContaining([player.cards[0]]))
            expect(updatedPlayer.game_status).toBe("ready")
            var room = await game.getRoom(roomCode)
            quantity++
            expect(room.chosen_cards.length).toBe(quantity)
            expect(room.chosen_cards).toEqual(expect.arrayContaining([{card: player.cards[0], player: player._id}]))
        }
    }
})

test("The current player choose a similar card", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    expect(await game.similarCardChosen(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)).toBeFalsy()
})


test("Choose a similar card when it's not possible", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    var players = await game.getPlayersList(roomCode, true)
    for (var i=0; i< players.length; i++) {
        var player = players[i]
        if (player._id.toString() != currentPlayer._id.toString()) {
            expect(await game.similarCardChosen(roomCode, player.cards[0],player.socket_id)).toBeFalsy()
        }
    }
    expect(await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)).toBeTruthy()
    for (var i=0; i< players.length; i++) {
        var player = players[i]
        if (player._id.toString() != currentPlayer._id.toString()) {
            expect(await game.similarCardChosen(roomCode, player.cards[0],player.socket_id)).toBeTruthy()
        }
    }
    expect(await game.areAllPlayersReady(roomCode)).toBeTruthy()
    for (var i=0; i< players.length; i++) {
        var player = players[i]
        if (player._id.toString() != currentPlayer._id.toString()) {
            expect(await game.similarCardChosen(roomCode, player.cards[0],player.socket_id)).toBeFalsy()
        }
    }
})

test("Choose a similar card twice", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode)

    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            expect(await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)).toBeTruthy()
            expect(await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)).toBeFalsy()
        }
    }
})

test("Choose similar cards that is not mine", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode)
    
    expect.assertions(2)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            expect(await game.similarCardChosen(roomCode, currentPlayer.cards[0], player.socket_id)).toBeFalsy()
        }
    }
})

test("End Choose", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    var cards = [currentPlayer.cards[0]]
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode, true)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            cards.push(player.cards[0])
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    expect(await game.areAllPlayersReady(roomCode)).toBeTruthy()
    var turnCards = await game.endChooseAndGetCards(roomCode)
    expect(turnCards).toBeInstanceOf(Array)
    expect(turnCards.length).toBe(3)
    expect(turnCards).toEqual(expect.arrayContaining(cards))

    var room = await game.getRoom(roomCode)
    expect(room.status).toBe(3)

    players = await game.getPlayersList(roomCode, true)
    players.forEach((player) => {
        var status = "waiting"
        if (player._id.toString() == currentPlayer._id.toString()) {
            status = "ready"
        }
        expect(player.game_status).toEqual(status)
    })

})

test("End Choose before the time", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)

    expect(await game.endChooseAndGetCards(roomCode)).toBeFalsy()
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    expect(await game.endChooseAndGetCards(roomCode)).toBeFalsy()

    var players = await game.getPlayersList(roomCode, true)
    for(var p =0; p<players.length; p++) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }

        if (p+1 < players.length) {
            expect(await game.endChooseAndGetCards(roomCode)).toBeFalsy()
        }
    }

    expect(await game.endChooseAndGetCards(roomCode)).not.toBeFalsy()

})


test("End Choose twice", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)

    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)

    var players = await game.getPlayersList(roomCode, true)
    for(var p =0; p<players.length; p++) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    expect(await game.endChooseAndGetCards(roomCode)).not.toBeFalsy()
    expect(await game.endChooseAndGetCards(roomCode)).toBeFalsy()

})

test("Guess Cards", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode, true)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    await game.areAllPlayersReady(roomCode)
    await game.endChooseAndGetCards(roomCode)

    expect(await game.guessedCard(roomCode, currentPlayer.cards[0], players[1].socket_id)).toBeTruthy()

    var room = await game.getRoom(roomCode)
    expect(room.guessed_cards).toBeInstanceOf(Array)
    expect(room.guessed_cards.length).toBe(1)
    expect(room.guessed_cards[0].card).toBe(currentPlayer.cards[0])
    expect(room.guessed_cards[0].player).toEqual(players[1]._id)

    var player = await game.getPlayerBySocketId(players[1].socket_id)
    expect(player.game_status).toEqual("ready")

})

test("Guessing before the time", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)
    
    var currentPlayer = await game.nextPlayer(roomCode)

    expect(await game.guessedCard(roomCode, currentPlayer.cards[0], "socket1")).toBeFalsy()

    
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode, true)

    expect(await game.guessedCard(roomCode, currentPlayer.cards[0], players[1].socket_id)).toBeFalsy()

    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    expect(await game.guessedCard(roomCode, currentPlayer.cards[0], players[1].socket_id)).toBeFalsy()
    
    await game.endChooseAndGetCards(roomCode)

    expect(await game.guessedCard(roomCode, currentPlayer.cards[0], players[1].socket_id)).toBeTruthy()

    var room = await game.getRoom(roomCode)
    expect(room.guessed_cards).toBeInstanceOf(Array)
    expect(room.guessed_cards.length).toBe(1)
    expect(room.guessed_cards[0].card).toBe(currentPlayer.cards[0])
    expect(room.guessed_cards[0].player).toEqual(players[1]._id)

    var player = await game.getPlayerBySocketId(players[1].socket_id)
    expect(player.game_status).toEqual("ready")

})

test("Current Player guessing a card", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode, true)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    await game.endChooseAndGetCards(roomCode)

    expect(await game.guessedCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)).toBeFalsy()
})

test("Guessin my own card", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode, true)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    await game.areAllPlayersReady(roomCode)
    await game.endChooseAndGetCards(roomCode)

    expect(await game.guessedCard(roomCode, players[1].cards[0], players[1].socket_id)).toBeFalsy()
})

test("Guessin twice", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode, true)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    await game.areAllPlayersReady(roomCode)
    await game.endChooseAndGetCards(roomCode)

    expect(await game.guessedCard(roomCode, currentPlayer.cards[0], players[1].socket_id)).toBeTruthy()
    expect(await game.guessedCard(roomCode, currentPlayer.cards[0], players[1].socket_id)).toBeFalsy()
})


test("End Turn", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    var players = await game.getPlayersList(roomCode, true)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    expect(await game.endChooseAndGetCards(roomCode)).not.toBeFalsy()

    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.guessedCard(roomCode, currentPlayer.cards[0], player.socket_id)
        }
    }

    expect(await game.areAllPlayersReady(roomCode)).toBeTruthy()

    expect(await game.endTurn(roomCode)).toBeTruthy()
    
    var room = await game.getRoom(roomCode)
    expect(room.status).toBe(1)
    expect(room.chosen_cards).toBeInstanceOf(Array)
    expect(room.chosen_cards.length).toBe(0)

    expect(room.guessed_cards).toBeInstanceOf(Array)
    expect(room.guessed_cards.length).toBe(0)

    expect(room.correct_card).toBeNull()

    players = await game.getPlayersList(roomCode)
    for(var p in players) {
        var player = players[p]
        var points = 2
        if (player._id.toString() == currentPlayer._id.toString()) {
            points = 0
        }
        expect(player.points).toBe(points)
        expect(player.game_status).toEqual("waiting")
        expect(player.cards.length).toBe(6)
    }
})

test.concurrent.each([
    { player_guesses: [-1, -1, -1, -1], player_points: [0, 2, 2, 2, 2]}, // everybody guess it right with 4 players
    { player_guesses: [1, 0, 0], player_points: [0, 4, 3, 2]}, // nobody guess it right
    { player_guesses: [-1, 0, 0], player_points: [3, 5, 0, 0]}, // one player got it righ and other players choose his card
    { player_guesses: [-1, 2, 1], player_points: [3, 3, 1, 1]}, // one player got it righ and other players choose each other cards
    { player_guesses: [-1, -1, 1], player_points: [3, 3, 4, 0]}, // two players got it right
    
])("End turn with guesses $player_guesses and points $player_points", async ({player_guesses, player_points}) => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    for (var i=0; i < player_points.length; i++) {
        await game.joinRoom("Player "+i, roomCode, null, null, "socket"+i, false)
    }

    await game.startGame(roomCode)

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)

    var players = await game.getPlayersList(roomCode, true)

    var indexToRemove = null
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() == currentPlayer._id.toString()) {
            indexToRemove = p
        } else {
            expect(await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)).toBeTruthy()
        }
    }
    players.splice(indexToRemove, 1)

    expect(await game.endChooseAndGetCards(roomCode)).not.toBeFalsy()
    
    for (var i in players) {
        var guess = currentPlayer.cards[0]
        if (player_guesses[i] != -1) { // this player guessed the correct card
            guess = players[player_guesses[i]].cards[0]

        }
        expect(await game.guessedCard(roomCode, guess, players[i].socket_id)).toBeTruthy()
    }


    expect(await game.endTurn(roomCode)).toBeTruthy()

    var updatedPlayers = await game.getPlayersList(roomCode, true)

    updatedPlayers.forEach(player => {
        var points = 0 
        if (player._id.toString() == currentPlayer._id.toString()) {
            points = player_points[0]
        } else {
            for (var i=0; i < players.length; i++) {
                if (player._id.toString() == players[i]._id.toString()) {
                    points = player_points[i+1]
                    break;
                }
            }
        }

        expect(player.points).toBe(points)
    })
})

test("End Turn before the time", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)

    expect(await game.endTurn(roomCode)).toBeFalsy()

    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)
    expect(await game.endTurn(roomCode)).toBeFalsy()

    var players = await game.getPlayersList(roomCode, true)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }
    await game.endChooseAndGetCards(roomCode)
    expect(await game.endTurn(roomCode)).toBeFalsy()

    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.guessedCard(roomCode, currentPlayer.cards[0], player.socket_id)
        }
    }

    expect(await game.endTurn(roomCode)).toBeTruthy()
})

test("End Turn twice", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)
    await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)
    await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)

    await game.startGame(roomCode)


    var currentPlayer = await game.nextPlayer(roomCode)
    await game.chosenCard(roomCode, currentPlayer.cards[0], currentPlayer.socket_id)

    var players = await game.getPlayersList(roomCode, true)
    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.similarCardChosen(roomCode, player.cards[0], player.socket_id)
        }
    }

    await game.endChooseAndGetCards(roomCode)

    for(var p in players) {
        var player = players[p]
        if (player._id.toString() != currentPlayer._id.toString()) {
            await game.guessedCard(roomCode, currentPlayer.cards[0], player.socket_id)
        }
    }


    expect(await game.endTurn(roomCode)).toBeTruthy()
    expect(await game.endTurn(roomCode)).toBeFalsy()
})

test("Deactivate Player", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
    expect(await game.removePlayer("socket1", roomCode, false)).toBeTruthy()
    var player = await game.getPlayerBySocketId("socket1")
    expect(player.status).toBe(0)
})

test("Remove Player", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
    expect(await game.removePlayer("socket1", roomCode, true)).toBeTruthy()
    expect(await game.getPlayerBySocketId("socket1")).toBeNull()
})

test("Deacitvate Invalid Player", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.removePlayer("socket1", roomCode, false)).toBeFalsy()
})

test("Remove Invalid Player", async () => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.removePlayer("socket1", roomCode, true)).toBeFalsy()
})

test("Remove the last Player", async() => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
    expect(await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)).toBeTruthy()
    expect(await game.removePlayer("socket1", roomCode, true)).toBeTruthy()
    expect(await game.roomExists(roomCode)).toBeTruthy()
    expect(await game.removePlayer("socket2", roomCode, true)).toBeTruthy()
    expect(await game.roomExists(roomCode)).toBeFalsy()
})


test("Deactivate the last Player", async() => {
    var game = new Game(database)
    var roomCode = await game.createRoom()
    expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
    expect(await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)).toBeTruthy()
    expect(await game.removePlayer("socket1", roomCode, false)).toBeTruthy()
    expect(await game.roomExists(roomCode)).toBeTruthy()
    expect(await game.removePlayer("socket2", roomCode, false)).toBeTruthy()
    expect(await game.roomExists(roomCode)).toBeFalsy()
})


afterAll(async () => {
    dbClient.close()
})