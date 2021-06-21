import express from "express"
import cors from "cors"
import {Server as SocketServer} from "socket.io"
import http, { request } from "http"
import session from "express-session"
import memorystore from "memorystore"
import Game from "./game.js"


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
var game = new Game(io);
io.on('connection', (socket) => {
    socket.on('CreateRoom', () => {
        game.createRoom().then((room) => {
            socket.emit("RoomCreated", room)
        })
    })

    // When a new socket joined to a specific room
    socket.on('JoinRoom', (data) => {
        if (data.room && (data.name || data.rejoin)) {
            game.joinRoom(
                data.name, 
                data.room, 
                socket.request.session.room, 
                socket.request.session.socket_id,
                socket.id,
                data.rejoin
            ).then((joined) => {
                console.log("Joined?", joined)
                if (joined) {
                    socket.request.session.socket_id = socket.id
                    socket.request.session.room = data.room
                    socket.join(data.room)
                    socket.emit("Joined", data.room)
                    game.getPlayerBySocketId(socket.socket_id).then((player) => {
                        socket.emit("UpdatePlayer", player)
                        game.getPlayersList(data.room).then((players_list) => {
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
        var room = socket.request.session.room
        console.log(socket.request.session)
        console.log("Room", room)
        console.log("Game Started")
        game.startGame(room).then((started) => {
            if (started) {
                io.to(room).emit("GameStarted")
                game.getPlayersList(room).then((players) => {
                    for (var p in players) {
                        var player  = players[p]
                        io.to(player.socket_id).emit("UpdatePlayer", player)
                    }
                })
                // @TODO define the first player and emit the event for him
                game.nextPlayer(room).then((player) => {
                    io.to(player.socket_id).emit("MyTurn")
                })
            } else {
                socket.emit("NotStarted")
            }
            
        })
        
    })

    socket.on("chosen_card", (data) => {
        io.emit("choose_a_similar_card")
    })

    socket.on("similar_card_chosen", (data) => {
        // @TODO idetify when all players have already chosen the card, before emit this event
        io.emit("find_the_chosen_card")
    })

    socket.on("guessed_card", (data) => {
        // @TODO idetify when all players have already guessed the card, befor emit this event
        io.emit("end_of_turn")

        //@TODO determine the next player
        socket.emit("your_turn")

        //@TODO determine when the game is over
    })

    socket.on('disconnect', () => {
        var room = socket.request.session.room
        if (room) {
            game.isStarded(room).then((started) => {
                game.removePlayer(socket.id, room, !started).then(() => {
                    game.getPlayersList(room).then((players_list) => {
                        io.to(room).emit("PlayersList", players_list)
                    })
                })
            })
        }
    })

})

httpServer.listen("8081")