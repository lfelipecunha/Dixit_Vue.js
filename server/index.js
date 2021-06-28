import express from "express"
import cors from "cors"
import {Server as SocketServer} from "socket.io"
import http from "http"
import session from "express-session"
import memorystore from "memorystore"
import Game from "./game.js"
import mongo from "mongodb"


var MemoryStore = memorystore(session)

const sessionMiddleware = session({
    store: new MemoryStore(),
    secret: 'keyboard cat', 
    cookie: { maxAge: 60000 }
});

var app = express()

var httpServer = http.createServer(app)
var io = new SocketServer(httpServer, {
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

var dbClient = new mongo.MongoClient("mongodb://database:27017")
await dbClient.connect()
var dataBase = dbClient.db("dixit_game")
var game = new Game(dataBase);
io.on('connection', (socket) => {
    const sock_session = socket.request.session
    socket.on('CreateRoom', () => {
        game.createRoom().then((room) => {
            socket.emit("RoomCreated", room)
        })
    })

    // When a new socket joined to a specific room
    socket.on('JoinRoom', (data) => {
        console.log('Session', sock_session)
        if (data.room && (data.name || data.rejoin)) {
            game.joinRoom(
                data.name, 
                data.room, 
                sock_session.room, 
                sock_session.socket_id,
                socket.id,
                data.rejoin
            ).then((joined) => {
                console.log("Joined?", joined)
                if (joined) {
                    sock_session.socket_id = socket.id
                    sock_session.room = data.room
                    console.log("Saved?", sock_session.save((attr) => {
                        console.log(attr)
                    }))
                    socket.join(data.room)
                    socket.emit("Joined", data.room)
                    game.getPlayerBySocketId(socket.id).then((player) => {
                        console.log('Player', player)
                        socket.emit("UpdatePlayer", player)
                        game.getPlayersList(data.room, false).then((players_list) => {
                            io.to(data.room).emit("PlayersList", players_list)
                        })
                    })
                } else {
                    socket.emit("NotJoined")
                }
            })
        }
    })

    socket.on("StartGame", () => {
        var room = sock_session.room
        console.log(sock_session)
        console.log("Room", room)
        game.startGame(room).then((started) => {
            if (started) {
                console.log("Game Started")
                io.to(room).emit("GameStarted")
                game.getPlayersList(room, true).then((players) => {
                    for (var p in players) {
                        var player  = players[p]
                        console.log('Player', player)
                        io.to(player.socket_id).emit("UpdatePlayer", player)
                    }
                })

                game.nextPlayer(room).then((player) => {
                    io.to(player.socket_id).emit("MyTurn")
                    game.getPlayersList(room, false).then((players_list) => {
                        io.to(room).emit("PlayersList", players_list)
                    })
                })
            } else {
                socket.emit("NotStarted")
            }
            
        })
        
    })

    socket.on("ChosenCard", (data) => {
        if (data.card && data.sugestion) {
            game.chosenCard(sock_session.room, data.card, socket.id).then((result) => {
                if (result) {
                    io.to(sock_session.room).emit("ChooseSimilarCard", {sugestion: data.sugestion})
                    game.getPlayersList(sock_session.room, false).then((players_list) => {
                        io.to(room).emit("PlayersList", players_list)
                    })
                }
            })
        }
    })

    socket.on("SimilarCardChosen", (data) => {
        if (data.card) {
            game.similarCardChosen(sock_session.room, data.card, socket.id).then(() => {
                game.areAllPlayersWaiting(sock_session.room).then((result) => {
                    if (result) {
                        game.endChooseAndGetCards(socket.room).then((cards) => {
                            io.to(sock_session.room).emit("FindTheChosenCards", cards)
                            game.getPlayersList(sock_session.room, false).then((players_list) => {
                                io.to(sock_session.room).emit("PlayersList", players_list)
                            })
                        })
                    }
                })
            })
        }
    })

    socket.on("guessed_card", (data) => {
        if (data.card) {
            game.guessedCard(sock_session.room, data.card, socket.id).then((result) => {
                if (result) {
                    game.areAllPlayersWaiting(sock_session.room).then((ended) => {
                        if (ended) {
                            game.endTurn(sock_session.room).then(() => {
                                game.nextPlayer(sock_session.room).then((curren_player) => {
                                    game.getPlayersList(sock_session.room, true).then((players) => {
                                        for (var p in players) {
                                            var player  = players[p]
                                            io.to(player.socket_id).emit("UpdatePlayer", player)
                                        }
                                        io.to(curren_player.socket_id).emit("MyTurn")
                                    })

                                    game.getPlayersList(sock_session.room, false).then((players_list) => {
                                        io.to(sock_session.room).emit("PlayersList", players_list)
                                    })
                                })
                            })
                        }
                    })
                }
            })
        }
        // @TODO idetify when all players have already guessed the card, befor emit this event
        io.emit("end_of_turn")

        //@TODO determine the next player
        socket.emit("your_turn")

        //@TODO determine when the game is over
    })

    socket.on('disconnect', () => {
        var room = sock_session.room
        if (room) {
            game.isStarded(room).then((started) => {
                game.removePlayer(socket.id, room, !started).then(() => {
                    game.getPlayersList(room,false).then((players_list) => {
                        io.to(room).emit("PlayersList", players_list)
                    })
                })
            })
        }
    })

})

app.get("/ping", (_, res) => {
    res.send()
})

httpServer.listen("8081")