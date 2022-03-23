const mongo = require('mongodb')
const Game = require("../game.js")
const Player = require("../player.js")
const settings = require('../settings.js')

const mongoURL = process.env.MONGOURL || "mongodb://database:27017"

var dbClient = new mongo.MongoClient(mongoURL)
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
  await game.init()
  expect(game.room).not.toBeNull()
  expect(game.room).not.toBeUndefined()
})

test("Create 2 rooms - Garantee the code generation", async () => {
  var game1 = new Game(database)
  var game2 = new Game(database)
  await game1.init()
  await game2.init()
  expect(game1.room.getCode()).not.toBe(game2.room.getCode())
})

test("Join Room", async () => {
  var game = new Game(database)
  await game.init()
  //var roomCode = await game.createRoom()
  var socketId = "123455"

  //    var joined = await game.joinRoom("Player", roomCode, null, null, socketId, false)
  var joined = await game.join('Player', socketId)
  expect(joined).toBeTruthy()
  var players = await game.room.getPlayers()
  expect(players).toBeInstanceOf(Array)
  expect(players.length).toBe(1)

  var player = players[0]//await game.getPlayerBySocketId(socketId)
  expect(player.socket_id).toBe(socketId)
  expect(player.name).toBe("Player")
  expect(player.room).toBe(game.room.getCode())
  expect(player.status).toBe(settings.player.status.ACTIVE)
  expect(player.game_status).toBe(settings.player.game_status.WAITING)
  expect(player.cards).toBeInstanceOf(Array)
  expect(player.cards.length).toBe(0)
  expect(player.points).toBe(0)

  expect(player.socket_id).toBe(players[0].socket_id)
})

test("Join Room limit exceed", async () => {
  var game = new Game(database)
  //    var roomCode = await game.createRoom()
  await game.init()

  for (var i=0; i<settings.room.MAX_PLAYERS; i++) {
    //expect(await game.joinRoom("Player "+i, roomCode, null, null, "socket"+i, false)).toBeTruthy()
    expect(await game.join("Player "+i, "socket"+i)).toBeTruthy()
  }
  expect(await game.join("Player " + settings.room.MAX_PLAYERS, "socket" + settings.room.MAX_PLAYERS)).toBeFalsy()
})

test("Game with an invalid room code", () => {
  var game = new Game(database, "123456")
  expect(game.init()).rejects.toThrow();
})

test("Join to without a name", async () => {
  var game = new Game(database)
  await game.init()
  var joined = await game.join(null, "123456")
  expect(joined).toBeFalsy()
})

test("Join to without a socket ID", async () => {
  var game = new Game(database)
  await game.init()
  expect(game.join("Player", null)).rejects.toThrow();

})

test("Join with duplicated socket ID", async () => {
  var game = new Game(database)
  await game.init()
  expect(await game.join("Player", "123")).toBeTruthy()
  expect(await game.join("Player 2", "123")).toBeFalsy()
})

test("Join with duplicated Name", async () => {
  var game = new Game(database)
  await game.init()
  expect(await game.join("Player", "123")).toBeTruthy()
  expect(await game.join("Player", "1234")).toBeTruthy()
  expect((await game.room.getPlayers()).length).toBe(2)
})

test("Join a started game", async () => {
  var game = new Game(database)
  await game.init()
  expect(await game.join("Player 1", "socket1", false)).toBeTruthy()
  expect(await game.join("Player 2", "socket2", false)).toBeTruthy()
  expect(await game.join("Player 3", "socket3", false)).toBeTruthy()
  expect(await game.start()).toBeTruthy()
  expect(await game.join("Player 4", "socket4")).toBeFalsy()
})

test.skip("Rejoin", async () => {
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


test.skip("Rejoin a started game", async () => {
  var game = new Game(database)
  var roomCode = await game.createRoom()
  expect(await game.joinRoom("Player 1", roomCode, null, null, "oldsocket", false)).toBeTruthy()
  expect(await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)).toBeTruthy()
  expect(await game.joinRoom("Player 3", roomCode, null, null, "socket3", false)).toBeTruthy()
  expect(await game.startGame(roomCode)).toBeTruthy()

  expect(await game.removePlayer("old_socket", roomCode, false))
  expect(await game.joinRoom(null, roomCode, roomCode, "oldsocket", "newsocket", true)).toBeTruthy()
})

test.skip("Rejoin with invalid socket", async () => {
  var game = new Game(database)
  var roomCode = await game.createRoom()
  expect(await game.joinRoom(null, roomCode, roomCode, "oldsocket", "newsocket", true)).toBeFalsy()
})

test("Starting Game", async() => {
  var game = new Game(database)
  await game.init()
  var socket1 = "socket-1"
  var socket2 = "socket-2"
  var socket3 = "socket-3"
  expect(await game.join("Player 1", socket1)).toBeTruthy()
  expect(await game.join("Player 2", socket2)).toBeTruthy()
  expect(await game.join("Player 3", socket3)).toBeTruthy()
  expect((await game.room.getPlayers()).length).toBe(3)

  expect(await game.start()).toBeTruthy()

  var roomData = await game.room.getData()

  expect(roomData.cards).toBeInstanceOf(Array)
  expect(roomData.cards.length).toBeGreaterThan(0)
  expect(roomData.status).toBe(settings.room.status.STARTED)

  expect(await game.room.isStarted()).toBeTruthy()

  var players = await game.room.getPlayers()
  await players.forEach(player => {
    expect(player.cards).toBeInstanceOf(Array)
    expect(player.cards.length).toBe(settings.game.HAND_SIZE)
  });
})

test("Start Game Without the minimal players", async () => {
  var game = new Game(database)
  await game.init()
  expect(await game.join("Player 1", "socket1")).toBeTruthy()
  expect(await game.join("Player 2", "socket2")).toBeTruthy()
  expect((await game.room.getPlayers()).length).toBe(2)
  expect(await game.start()).toBeFalsy()
})

test("Start Game twice", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")
  expect(await game.start()).toBeTruthy()
  expect(await game.start()).toBeFalsy()
})

test("Cards distribution", async () => {
  var game = new Game(database)
  await game.init()
  var socket1 = "socket-1"
  var socket2 = "socket-2"
  var socket3 = "socket-3"
  await game.join("Player 1", socket1)
  await game.join("Player 2", socket2)
  await game.join("Player 3", socket3)

  await game.start()
  var room = await game.room.getData()
  var players = await game.room.getPlayers()

  await game.distributeCards(1)

  var updatedRoom = await game.room.getData()
  var updatedPlayers = await game.room.getPlayers()

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

test("Calculating Next Player", async() => {
  var game = new Game(database)
  await game.init()
  var socket1 = "socket-1"
  var socket2 = "socket-2"
  var socket3 = "socket-3"
  await game.join("Player 1", socket1)
  await game.join("Player 2", socket2)
  await game.join("Player 3", socket3)

  await game.start()
  for(var i=0; i<4; i++) {
    var index = i % 3
    var currentPlayer = await (await game.nextPlayer()).getData()
    var iddle = settings.player.game_status.IDDLE
    var status = [iddle, iddle, iddle]
    status[index] = settings.player.game_status.WAITING
    expect(currentPlayer).not.toBeNull()

    var room = await game.room.getData()
    var players = await game.room.getPlayers()

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
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var player = await game.nextPlayer()

  var card = (await player.getData()).cards[0]

  expect(await game.chosenCard(player, card)).toBeTruthy()
  var room = await game.room.getData()
  expect(room.chosen_cards).toBeInstanceOf(Array)
  expect(room.chosen_cards.length).toBe(1)
  expect(room.chosen_cards[0].card).toBe(card)

  var playerData = await player.getData()
  expect(room.chosen_cards[0].player.toString()).toBe(playerData._id.toString())
  expect(playerData.cards).toBeInstanceOf(Array)
  expect(playerData.cards).toEqual(expect.not.arrayContaining([card]))
  expect(room.correct_card).toBe(card)
  expect(room.status).toBe(settings.room.status.CHOOSE_SIMILAR_CARD)
})

test("Choose a card that is not mine", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var player = await game.nextPlayer()

  var card = (await game.room.getData()).cards[0]

  expect(await game.chosenCard(player, card)).toBeFalsy()
})

test("Choose a card when it's no my time", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await (await game.nextPlayer()).getData()
  var players = await game.room.getPlayers()
  expect.assertions(2)
  for (var i=0; i < players.length; i++) {
    var player = players[i]
    if (player._id.toString() != currentPlayer._id.toString()) {
      expect(await game.chosenCard(new Player(database, player.socket_id, game.room), player.cards[0])).toBeFalsy()
    }
  }
})

test("Choose a card twice", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var cards = (await currentPlayer.getData()).cards
  expect(await game.chosenCard(currentPlayer, cards[0])).toBeTruthy()
  expect(await game.chosenCard(currentPlayer, cards[1])).toBeFalsy()
})

test("Choose similar cards", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()

  await game.chosenCard(currentPlayer, data.cards[0])
  var players = await game.room.getPlayers()
  var quantity = 1
  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      expect(await game.similarCardChosen(playerObj, player.cards[0])).toBeTruthy()
      var updatedPlayer = await playerObj.getData()
      expect(updatedPlayer.cards).toEqual(expect.not.arrayContaining([player.cards[0]]))
      expect(updatedPlayer.game_status).toBe(settings.player.game_status.READY)
      var room = await game.room.getData()
      quantity++
      expect(room.chosen_cards.length).toBe(quantity)
      expect(room.chosen_cards).toEqual(expect.arrayContaining([{card: player.cards[0], player: player._id}]))
    }
  }
})

test("The current player choose a similar card", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()

  await game.chosenCard(currentPlayer, data.cards[0])
  expect(await game.similarCardChosen(currentPlayer, data.cards[0])).toBeFalsy()
})


test("Choose a similar card when it's not possible", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()

  var players = await game.room.getPlayers()
  for (var i=0; i< players.length; i++) {
    var player = players[i]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      expect(await game.similarCardChosen(playerObj, player.cards[0])).toBeFalsy()
    }
  }
  await game.chosenCard(currentPlayer, data.cards[0])
  for (var i=0; i< players.length; i++) {
    var player = players[i]
      if (player._id.toString() != data._id.toString()) {
        var playerObj = new Player(database, player.socket_id, game.room)
          expect(await game.similarCardChosen(playerObj, player.cards[0])).toBeTruthy()
      }
  }
  //    expect(await game.areAllPlayersReady(roomCode)).toBeTruthy()
  for (var i=0; i< players.length; i++) {
    var player = players[i]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
        expect(await game.similarCardChosen(playerObj, player.cards[0])).toBeFalsy()
    }
  }
})

test("Choose a similar card twice", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      expect(await game.similarCardChosen(playerObj, player.cards[0])).toBeTruthy()
      expect(await game.similarCardChosen(playerObj, player.cards[0])).toBeFalsy()
    }
  }
})

test("Choose similar cards that is not mine", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()

  expect.assertions(2)
  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      expect(await game.similarCardChosen(playerObj, data.cards[0])).toBeFalsy()
    }
  }
})

test("End Choose", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])
  let cards = [data.cards[0]]

  var players = await game.room.getPlayers()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      cards.push(player.cards[0])
      expect(await game.similarCardChosen(playerObj, player.cards[0])).toBeTruthy()
    }
  }

  expect(await game.room.areAllPlayersReady()).toBeTruthy()
  var turnCards = await game.endChooseAndGetCards()
  expect(turnCards).toBeInstanceOf(Array)
  expect(turnCards.length).toBe(cards.length)
  expect(turnCards).toEqual(expect.arrayContaining(cards))

  var room = await game.room.getData()
  expect(room.status).toBe(settings.room.status.FIND_THE_CHOSEN_CARD)

  players = await game.room.getPlayers()
  players.forEach((player) => {
    var status = settings.player.game_status.WAITING
    if (player._id.toString() == data._id.toString()) {
      status = settings.player.game_status.READY
    }
    expect(player.game_status).toEqual(status)
  })
})

test("End Choose before the time", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      await game.similarCardChosen(playerObj, player.cards[0])
    }

    if (p+1 < players.length) {
      expect(await game.endChooseAndGetCards()).toBeFalsy()
    }
  }

  expect(await game.endChooseAndGetCards()).not.toBeFalsy()

})


test("End Choose twice", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      await game.similarCardChosen(playerObj, player.cards[0])
    }
  }

  expect(await game.endChooseAndGetCards()).not.toBeFalsy()
  expect(await game.endChooseAndGetCards()).toBeFalsy()
})

test("Guess Cards", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      await game.similarCardChosen(playerObj, player.cards[0])
    }
  }

  await game.endChooseAndGetCards()
  let p1 = new Player(database, players[1].socket_id, game.room)

  expect(await game.guessedCard(p1, data.cards[0])).toBeTruthy()

  var room = await game.room.getData()
  expect(room.guessed_cards).toBeInstanceOf(Array)
  expect(room.guessed_cards.length).toBe(1)
  expect(room.guessed_cards[0].card).toBe(data.cards[0])
  expect(room.guessed_cards[0].player.toString()).toEqual(players[1]._id.toString())

  var p1Data = await p1.getData()
  expect(p1Data.game_status).toEqual(settings.player.game_status.READY)
})

test("Guessing before the time", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  var players = await game.room.getPlayers()

  let p1 = new Player(database, players[1].socket_id, game.room)

  expect(await game.guessedCard(p1, data.cards[0])).toBeFalsy()

  await game.chosenCard(currentPlayer, data.cards[0])

  expect(await game.guessedCard(p1, data.cards[0])).toBeFalsy()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
        await game.similarCardChosen(playerObj, player.cards[0])
    }
  }

  expect(await game.guessedCard(p1, data.cards[0])).toBeFalsy()
})

test("Current Player guessing a card", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      await game.similarCardChosen(playerObj, player.cards[0])
    }
  }

  await game.endChooseAndGetCards()

  expect(await game.guessedCard(currentPlayer, data.cards[0])).toBeFalsy()
})

test("Guessin my own card", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      await game.similarCardChosen(playerObj, player.cards[0])
    }
  }

  await game.endChooseAndGetCards()

  let p1 = new Player(database, players[1].socket_id, game.room)

  expect(await game.guessedCard(p1, players[1].cards[0])).toBeFalsy()
})

test("Guessin twice", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      await game.similarCardChosen(playerObj, player.cards[0])
    }
  }

  await game.endChooseAndGetCards()

  let p1 = new Player(database, players[1].socket_id, game.room)
  expect(await game.guessedCard(p1, data.cards[0])).toBeTruthy()
  expect(await game.guessedCard(p1, data.cards[0])).toBeFalsy()
})


test("End Turn", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()
  var playersObj = {}

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      playersObj[p] = playerObj
      await game.similarCardChosen(playerObj, player.cards[0])
    }
  }

  await game.endChooseAndGetCards()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      await game.guessedCard(playersObj[p], data.cards[0])
    }
  }

  expect(await game.endTurn()).toBeTruthy()

  var room = await game.room.getData()
  expect(room.status).toBe(settings.room.status.STARTED)
  expect(room.chosen_cards).toBeInstanceOf(Array)
  expect(room.chosen_cards.length).toBe(0)

  expect(room.guessed_cards).toBeInstanceOf(Array)
  expect(room.guessed_cards.length).toBe(0)

  expect(room.correct_card).toBeNull()

  players = await game.room.getPlayers()
  for(var p in players) {
    var player = players[p]
    var points = 2
    if (player._id.toString() == data._id.toString()) {
      points = 0
    }
    expect(player.points).toBe(points)
    expect(player.game_status).toEqual(settings.player.game_status.WAITING)
    expect(player.cards.length).toBe(settings.game.HAND_SIZE)
  }
})

test.concurrent.each([
  { player_guesses: [-1, -1, -1, -1], player_points: [0, 2, 2, 2, 2]}, // everybody guess it right with 4 players
  { player_guesses: [1, 0, 0], player_points: [0, 4, 3, 2]}, // nobody guess it right
  { player_guesses: [-1, 0, 0], player_points: [3, 5, 0, 0]}, // one player got it righ and other players choose his card
  { player_guesses: [-1, 2, 1], player_points: [3, 3, 1, 1]}, // one player got it righ and other players choose each other cards
  { player_guesses: [-1, -1, 1], player_points: [3, 3, 4, 0]}, // two players got it right

])("End turn with guesses $player_guesses and points $player_points", async ({player_guesses, player_points}) => {
  let game = new Game(database)
  await game.init()
  for (let i=0; i < player_points.length; i++) {
    await game.join("Player "+i, "socket"+i)
  }

  await game.start()

  let currentPlayer = await game.nextPlayer()
  let currentPlayerData = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, currentPlayerData.cards[0])

  let players = await game.room.getPlayers()

  let indexToRemove = null
  for(var p in players) {
    let player = players[p]
    if (player._id.toString() == currentPlayerData._id.toString()) {
      indexToRemove = p
    } else {
      let pObj = new Player(database, player.socket_id, game.room)
      expect(await game.similarCardChosen(pObj, player.cards[0])).toBeTruthy()
    }
  }
  players.splice(indexToRemove, 1)

  expect(await game.endChooseAndGetCards()).not.toBeFalsy()

  for (let i in players) {
    let guess = currentPlayerData.cards[0]
    if (player_guesses[i] != -1) { // this player guessed the correct card
      guess = players[player_guesses[i]].cards[0]
    }
    let pObj = new Player(database, players[i].socket_id, game.room)
    expect(await game.guessedCard(pObj, guess)).toBeTruthy()
  }

  expect(await game.endTurn()).toBeTruthy()

  let updatedPlayers = await game.room.getPlayers()

  updatedPlayers.forEach(player => {
    let points = 0
    if (player._id.toString() == currentPlayerData._id.toString()) {
      points = player_points[0]
    } else {
      for (let i=0; i < players.length; i++) {
        if (player._id.toString() == players[i]._id.toString()) {
          points = player_points[i+1]
          break;
        }
      }
    }

    expect(player.points).toBe(points)
  })
})

test("Multiple turns", async () => {
  const configuration = {
    'players': 4,
    'turns': [
      {'guesses': [null,    2,    1,    1], 'points': [ 0,  4, 3, 2] }, // player 1
      {'guesses': [  -1, null,    0,    0], 'points': [ 5,  7, 3, 2] }, // player 2
      {'guesses': [  -1,    3, null,    1], 'points': [ 8,  8, 6, 3] }, // player 3
      {'guesses': [  -1,   -1,    1, null], 'points': [11, 12, 6, 6] }  // player 4
    ]
  }
  let game = new Game(database)
  await game.init()

  for (let i=0; i < configuration.players; i++) {
    await game.join("Player "+i, "socket"+i)
  }

  await game.start()
  for (let turn=0; turn < configuration.turns.length; turn++) {
    let player_guesses = configuration.turns[turn].guesses
    let player_points = configuration.turns[turn].points

    let currentPlayer = await game.nextPlayer()
    let currentPlayerData = await currentPlayer.getData()
    await game.chosenCard(currentPlayer, currentPlayerData.cards[0])

    let players = await game.room.getPlayers()

    for(var p in players) {
      let player = players[p]
      if (player._id.toString() != currentPlayerData._id.toString()) {
        let pObj = new Player(database, player.socket_id, game.room)
        await game.similarCardChosen(pObj, player.cards[0])
      }
    }

    await game.endChooseAndGetCards()

    for (let i in players) {
      if (players[i]._id.toString() != currentPlayerData._id.toString()) {
        let guess = currentPlayerData.cards[0]
        if (player_guesses[i] != -1) { // this player guessed the wrong card
          guess = players[player_guesses[i]].cards[0]
        }
        let pObj = new Player(database, players[i].socket_id, game.room)
        expect(await game.guessedCard(pObj, guess)).toBeTruthy()
      }
    }

    expect(await game.endTurn()).toBeTruthy()

    let updatedPlayers = await game.room.getPlayers()

    updatedPlayers.forEach(player => {
      let points = 0
      for (let i=0; i < players.length; i++) {
        if (player._id.toString() == players[i]._id.toString()) {
          points = player_points[i]
          break;
        }
      }

      expect(player.points).toBe(points)
    })
  }
})

test("End Turn before the time", async () => {
  let game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  expect(await game.endTurn()).toBeFalsy()

  let currentPlayer = await game.nextPlayer()
  let currentPlayerData = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, currentPlayerData.cards[0])
  expect(await game.endTurn()).toBeFalsy()

  let players = await game.room.getPlayers()
  for(let p in players) {
    let player = players[p]
    if (player._id.toString() != currentPlayerData._id.toString()) {
      let pObj = new Player(database, player.socket_id, game.room)
      await game.similarCardChosen(pObj, player.cards[0])
    }
  }
  await game.endChooseAndGetCards()

  for(let p in players) {
    let player = players[p]
    if (player._id.toString() != currentPlayerData._id.toString()) {
      expect(await game.endTurn()).toBeFalsy()
      let pObj = new Player(database, player.socket_id, game.room)
      await game.guessedCard(pObj, currentPlayerData.cards[0])
    }
  }

  expect(await game.endTurn()).toBeTruthy()
})

test("End Turn twice", async () => {
  let game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  let currentPlayer = await game.nextPlayer()
  let currentPlayerData = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, currentPlayerData.cards[0])

  let players = await game.room.getPlayers()
  for(let p in players) {
    let player = players[p]
    if (player._id.toString() != currentPlayerData._id.toString()) {
      let pObj = new Player(database, player.socket_id, game.room)
      await game.similarCardChosen(pObj, player.cards[0])
    }
  }
  await game.endChooseAndGetCards()

  for(let p in players) {
    let player = players[p]
    if (player._id.toString() != currentPlayerData._id.toString()) {
      let pObj = new Player(database, player.socket_id, game.room)
      await game.guessedCard(pObj, currentPlayerData.cards[0])
    }
  }

  expect(await game.endTurn()).toBeTruthy()
  expect(await game.endTurn()).toBeFalsy()
})

test("End Game", async () => {
  var game = new Game(database)
  await game.init()
  await game.join("Player 1", "socket1")
  await game.join("Player 2", "socket2")
  await game.join("Player 3", "socket3")

  await game.start()

  var currentPlayer = await game.nextPlayer()
  var data = await currentPlayer.getData()
  await game.chosenCard(currentPlayer, data.cards[0])

  var players = await game.room.getPlayers()
  var playersObj = {}

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      var playerObj = new Player(database, player.socket_id, game.room)
      playersObj[p] = playerObj
      await game.similarCardChosen(playerObj, player.cards[0])
    }
  }

  await game.endChooseAndGetCards()

  for(var p in players) {
    var player = players[p]
    if (player._id.toString() != data._id.toString()) {
      await game.guessedCard(playersObj[p], data.cards[0])
    }
  }

  expect(await game.endTurn()).toBeTruthy()

  let playersResult = await game.end()

  expect(playersResult).toBeInstanceOf(Array)
  expect(playersResult.length).toBe(3)

  let aux = null
  for (let i in playersResult) {
    let curP = playersResult[i]
      if (!!aux) {
        expect(aux.points).toGreatherThanOrEqual(curP.points)
      }
    aux = curP
  }

  var room = await game.room.getData()
  expect(room.status).toBe(settings.room.status.CREATED)
  expect(room.chosen_cards).toBeInstanceOf(Array)
  expect(room.chosen_cards.length).toBe(0)

  expect(room.guessed_cards).toBeInstanceOf(Array)
  expect(room.guessed_cards.length).toBe(0)

  expect(room.correct_card).toBeNull()

  players = await game.room.getPlayers()
  for(var p in players) {
    expect(player.points).toBe(0)
    expect(player.game_status).toEqual(settings.player.game_status.WAITING)
    expect(player.cards.length).toBe(0)
  }
})

test.skip("Deactivate Player", async () => {
  var game = new Game(database)
  var roomCode = await game.createRoom()
  expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
  expect(await game.removePlayer("socket1", roomCode, false)).toBeTruthy()
  var player = await game.getPlayerBySocketId("socket1")
  expect(player.status).toBe(0)
})

test.skip("Remove Player", async () => {
  var game = new Game(database)
  var roomCode = await game.createRoom()
  expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
  expect(await game.removePlayer("socket1", roomCode, true)).toBeTruthy()
  expect(await game.getPlayerBySocketId("socket1")).toBeNull()
})

test.skip("Deacitvate Invalid Player", async () => {
  var game = new Game(database)
  var roomCode = await game.createRoom()
  expect(await game.removePlayer("socket1", roomCode, false)).toBeFalsy()
})

test.skip("Remove Invalid Player", async () => {
  var game = new Game(database)
  var roomCode = await game.createRoom()
  expect(await game.removePlayer("socket1", roomCode, true)).toBeFalsy()
})

test.skip("Remove the last Player", async() => {
  var game = new Game(database)
  var roomCode = await game.createRoom()
  expect(await game.joinRoom("Player 1", roomCode, null, null, "socket1", false)).toBeTruthy()
  expect(await game.joinRoom("Player 2", roomCode, null, null, "socket2", false)).toBeTruthy()
  expect(await game.removePlayer("socket1", roomCode, true)).toBeTruthy()
  expect(await game.roomExists(roomCode)).toBeTruthy()
  expect(await game.removePlayer("socket2", roomCode, true)).toBeTruthy()
  expect(await game.roomExists(roomCode)).toBeFalsy()
})

test.skip("Deactivate the last Player", async() => {
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
