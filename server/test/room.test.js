var mongo = require('mongodb')
var Room = require("../room.js")

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
    var room = new Room(database)
    await room.init()
    var roomCode = room.getCode()
    expect(roomCode).not.toBeNull()
    expect(roomCode).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)

    roomData = await room.getData()
    expect(roomData).not.toBeNull()
    expect(roomData).not.toBeUndefined()

    expect(roomData.code).toBe(roomCode)
    expect(roomData.status).toBe(0)

    expect(roomData.current_player).toBeNull()
    expect(roomData.correct_card).toBeNull()

    expect(roomData.cards).toBeInstanceOf(Array)
    expect(roomData.cards.length).toBe(0)
    expect(roomData.chosen_cards).toBeInstanceOf(Array)
    expect(roomData.chosen_cards.length).toBe(0)
    expect(roomData.guessed_cards).toBeInstanceOf(Array)
    expect(roomData.guessed_cards.length).toBe(0)
})


afterAll(async () => {
    dbClient.close()
})
