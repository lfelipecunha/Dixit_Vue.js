const express = require("express")
const cors = require("cors")
const SocketServer = require('socket.io').Server
const http = require("http")
const memorystore = require("memorystore")
const mongo = require("mongodb")

const Game = require("./game.js")
const Player = require("./player.js")
const settings = require('./settings.js')

const app = express()

const httpServer = http.createServer(app)
const io = new SocketServer(httpServer, {
  cors: {
    origin: ["http://192.168.15.112", 'http://localhost'],
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
})

app.use(cors())

const dbClient = new mongo.MongoClient("mongodb://database:27017")
let dataBase = null

io.on('connection', async (socket) => {
  let game = null
  let player = null
  let roomCode = null

  socket.emit('Connected')

  socket.on('CreateRoom', async () => {
    game = new Game(dataBase);
    await game.init()
    socket.emit("NewRoom", game.room.getCode())
  })

  socket.on('Join', async(data) => {
    try {
      if (!!data?.room) {
        game = new Game(dataBase, data.room.toLowerCase())
        await game.init()
      } else if (game == null) {
        throw new Error("Please inform a room!")
      }

      player = await game.join(data?.name, socket.id)
      if (player === false) {
        player = null
        throw new Error("An error occcurs on join to room!")
      }
      roomCode = (await game.room.getData()).room
      socket.join(game.room.getCode())
      socket.emit("Joined", {room: game.room.getCode(), minimalPlayers: settings.room.MIN_PLAYERS})
      socket.emit("UpdatePlayer", await player.getData())
      let playersList = await game.room.getPlayers(true)
      io.to(game.room.getCode()).emit("PlayersList", playersList)
    } catch (e) {
      console.error(e)
      socket.emit('Error', e.message)
    }
  })

  socket.on("StartGame", async () => {
    try {
      if (!!game && await game.start()) {
        console.log("Game Started")
        io.to(game.room.getCode()).emit("GameStarted")
        let players = await game.room.getPlayers()
        for (let p in players) {
          io.to(players[p].socket_id).emit("UpdatePlayer", players[p])
        }

        let nextPlayer = await game.nextPlayer()
        io.to((await nextPlayer.getData()).socket_id).emit("MyTurn")
        let playersList = await game.room.getPlayers(true)
        io.to(game.room.getCode()).emit("PlayersList", playersList)
      } else {
        throw "An error occurs on start game"
      }
    } catch (e) {
      console.error(e)
      socket.emit('Error', e)
    }
  })

  socket.on("ChosenCard", async (data) => {
    try {
      if (!data?.card && data?.card !== 0) {
        throw 'You need to send a card!'
      }

      if (!data?.tip) {
        throw 'You need to send a tip'
      }
      if (!await game.chosenCard(player, data.card, data.tip)) {
        throw 'An error occurs on choose a card!'
      }
      io.to(game.room.getCode()).emit("ChooseSimilarCard", {tip: data.tip})
      const playersList = await game.room.getPlayers(true)
      io.to(game.room.getCode()).emit("PlayersList", playersList)
      let players = await game.room.getPlayers()
      for (var p in players) {
        io.to(players[p].socket_id).emit("UpdatePlayer", players[p])
      }
    } catch (e) {
      console.error(e)
      socket.emit('Error', e)
    }
  })

  socket.on("SimilarCardChosen", async (data) => {
    try {
      if (!data?.card && data?.card !== 0) {
        throw 'You need to send a card!'
      }
      if (!await game.similarCardChosen(player, data.card)) {
        throw 'An error occurs on choose a similar card!'
      }
      if (await game.room.areAllPlayersReady()) {
        let cards = await game.endChooseAndGetCards()
        io.to(game.room.getCode()).emit("FindTheChosenCard", {cards: cards, tip: (await game.room.getData()).tip})
        let playersList = await game.room.getPlayers()
        for (let p of playersList) {
          console.log(p)
          io.to(p.socket_id).emit('UpdatePlayer', p)
        }
      } else {
        socket.emit('UpdatePlayer', await player.getData())
      }
      let playersList = await game.room.getPlayers(true)
      io.to(game.room.getCode()).emit("PlayersList", playersList)
    } catch (e) {
      console.error(e)
      socket.emit('Error', e)
    }
  })

  socket.on("GuessedCard", async (data) => {
    try {
      if (!data?.card && data?.card !== 0) {
        throw 'You need to send a card!'
      }
      if (! await game.guessedCard(player, data.card)) {
        throw 'An error occurs on guess a card!'
      }
      if (await game.room.areAllPlayersReady()) {
        await game.endTurn()
        io.to(game.room.getCode()).emit("EndOfTurn")

        if (await game.isEndOfGame()) {
          let podium = await game.end()
          io.to(game.room.getCode()).emit('EndGame', {podium: podium})
        } else {
          let nextPlayer = await game.nextPlayer()
          let players = await game.room.getPlayers()
          for (var p in players) {
            io.to(players[p].socket_id).emit("UpdatePlayer", players[p])
          }

          io.to((await nextPlayer.getData()).socket_id).emit("MyTurn")
        }
      } else {
        socket.emit('UpdatePlayer', await player.getData())
      }
      let playersList = await game.room.getPlayers(true)
      io.to(game.room.getCode()).emit("PlayersList", playersList)

    } catch (e) {
      console.error(e)
      socket.emit('Error', e)
    }
  })

  socket.on('OldSocketId', async (socketId) => {
    let p = await Game.createPlayerBySocketId(dataBase, socketId, socket.id)
    if (!!p) {
      player = p
      game = new Game(dataBase, player.room.getCode())
      socket.join(game.room.getCode())
      socket.emit("Joined", {room: game.room.getCode(), minimalPlayers: settings.room.MIN_PLAYERS})
      socket.emit("GameStarted");
      socket.emit('UpdatePlayer', await player.getData())
      const status = await player.restoreStatus()
      console.log(status)
      if (status.chooseCard) {
        socket.emit('MyTurn')
      }

      if (status.chooseSimiliarCard) {
        socket.emit('ChooseSimilarCard', {tip: (await game.room.getData()).tip})
      } else if (status.guessCard) {
        let roomData = await game.room.getData()
        socket.emit('FindTheChosenCard',{cards: roomData.shuffled_cards, tip: roomData.tip})
      }
      let playersList = await game.room.getPlayers(true)
      io.to(game.room.getCode()).emit("PlayersList", playersList)
    } else {
      socket.emit('InvalidSocketId')
    }
  })

  socket.on('disconnect', async () => {
    if (!!player) {
      await player.remove()
      let playersList = await game.room.getPlayers(true)
      io.to(game.room.getCode()).emit("PlayersList", playersList)
    }
  })

})

app.get("/ping", (_, res) => {
  const fs = require('fs')
  const path = require('path')

  const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8')
  res.send(html)
})

dbClient.connect().then(() => {
  dataBase = dbClient.db("dixit_game")
  httpServer.listen("8081")
})
