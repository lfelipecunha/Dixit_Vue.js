import express from "express"
import cors from "cors"
import {Server as SocketServer} from "socket.io"
import http from "http"


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

io.on('connection', (socket) => {
    console.log(socket.id)
    socket.on("hello", data => {

    })

    socket.on("start", () => {
        console.log("Game Started")
        io.emit("gameStarted")
        // @TODO define the first player and emit the event for him
        socket.emit("yourTurn")
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

})

app.post("/create_room", (req,res) => {
    res.send()
})

app.post("/register", (req, res) => {
    res.send()
})


httpServer.listen("8081")