const express = require("express")
const cors = require("cors")
const SocketServer = require('socket.io').Server
const http = require("http")
const session = require("express-session")
const memorystore = require("memorystore")
const mongo = require("mongodb")

const Game = require("./game.js")
const Player = require("./player.js")

const MemoryStore = memorystore(session)

const sessionMiddleware = session({
  store: new MemoryStore(),
  secret: 'keyboard cat',
  cookie: { maxAge: 60000 }
});

const app = express()

const httpServer = http.createServer(app)
const io = new SocketServer(httpServer, {
  cors: {
    origin: ["http://localhost:8080"],
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
})

app.use(cors())

// register middleware in Express
app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

const dbClient = new mongo.MongoClient("mongodb://database:27017")
let dataBase = null

io.on('connection', async (socket) => {
  let game = null
  let player = null
  let roomCode = null

  const sock_session = socket.request.session

  socket.on('CreateRoom', async () => {
    game = new Game(dataBase);
    await game.init()
    socket.emit("NewRoom", game.room.code)
  })

  socket.on('Join', async(data) => {
    try {
      if (!!data?.room) {
        game = new Game(dataBase, data.room)
        await game.init()
      } else if (game == null) {
        throw "Please inform a room!"
      }

      player = await game.join(data?.name, socket.id)
      if (player === false) {
        player = null
        throw "An error occcurs on join to room!"
      }
      roomCode = (await game.room.getData()).room
      socket.join(game.room.code)
      socket.emit("Joined", game.room.code)
    } catch (e) {
      console.error(e)
      socket.emit('Error', e)
    }
  })

  socket.on("StartGame", async () => {
    try {
      if (!!game && await game.start()) {
        console.log("Game Started")
        io.to(roomCode).emit("GameStarted")
        let players = await game.room.getPlayers()
        for (let p in players) {
          io.to(players[p].socket_id).emit("UpdatePlayer", players[p])
        }

        let nextPlayer = await game.nextPlayer()
        io.to((await nextPlayer.getData()).socket_id).emit("MyTurn")
        let playersList = await game.room.getPlayers(true)
        io.to(roomCode).emit("PlayersList", playersList)
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
      if (!data?.card) {
        throw 'You need to send a card!'
      }

      if (!data?.tip) {
        throw 'You need to send a tip'
      }
      if (!await game.chosenCard(player, data.card, data.tip)) {
        throw 'An error occurs on choose a card!'
      }
      io.to(game.room.code).emit("ChooseSimilarCard", {tip: data.tip})
      const playersList = await game.room.getPlayers(true)
      io.to(game.room.code).emit("PlayersList", playersList)
    } catch (e) {
      console.error(e)
      socket.emit('Error', e)
    }
  })

  socket.on("SimilarCardChosen", async (data) => {
    try {
      if (!data?.card) {
        throw 'You need to send a card!'
      }
      if (!await game.similarCardChosen(player, data.card)) {
        throw 'An error occurs on choose a similar card!'
      }
      if (await game.room.areAllPlayersReady()) {
        let cards = await game.endChooseAndGetCards()
        io.to(game.room.code).emit("FindTheChosenCards", cards)
        let playersList = await game.room.getPlayers(true)
        io.to(game.room.code).emit("PlayersList", playersList)
      }
    } catch (e) {
      console.error(e)
      socket.emit('Error', e)
    }
  })

  socket.on("GuessedCard", async (data) => {
    try {
      if (!data?.card) {
        throw 'You need to send a card!'
      }
      if (! await game.guessedCard(player, data.card)) {
        throw 'An error occurs on guess a card!'
      }
      if (await game.room.areAllPlayersReady()) {
        await game.endTurn()
        io.to(game.room.code).emit("EndOfTurn")

        if (await game.isEndOfGame()) {
          let podium = await game.end()
          io.to(game.room.code).emit('EndGame', {podium: podium})
        } else {
          let nextPlayer = await game.nextPlayer()
          let players = await game.room.getPlayers()
          for (var p in players) {
            io.to(players[p].socket_id).emit("UpdatePlayer", players[p])
          }

          io.to((await currenPlayer.getData()).socket_id).emit("MyTurn")
          let playerList = await game.room.getPlayers()
          io.to(game.room.code).emit("PlayersList", playersList)
        }
      }

    } catch (e) {
      console.error(e)
      socket.emit('Error', e)
    }
  })

  socket.on('OldSocketId', async (socketId) => {
    let p = await Game.createPlayerBySocketId(dataBase, socketId, socket.id)
    console.log(p)
    if (!!p) {
      player = p
      game = new Game(dataBase, await player.room.getCode())
      socket.emit('UpdatePlayer', await player.getData())
      const status = await player.restoreStatus()
      console.log(status)
      if (status.chooseCard) {
        socket.emit('MyTurn')
      } else if (status.chooseSimiliarCard) {
        socket.emit('ChooseSimilarCard', {tip: (await game.room.getData()).tip})
      } else if (status.guessCard) {
        socket.emit('FindTheChosenCards',(await game.room.getData()).shuffled_cards)
      }
      let playersList = await game.room.getPlayers(true)
      io.to(game.room.code).emit("PlayersList", playersList)
    }
  })

  socket.on('disconnect', async () => {
    if (!!player) {
      await player.remove()
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
