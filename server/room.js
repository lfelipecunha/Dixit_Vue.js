const random_human_readable = require( "./random_human_readable")
var settings = require('./settings.js')


class Room {
    constructor(db, code) {
        this.database = db
        this.collection = db.collection(settings.database.collections.ROOMS)
        this.playersCollection = db.collection(settings.database.collections.PLAYERS)
        this.code = code
    }

    async init() {
        if (this.code) {
            if (! await this._exists(this.code)) {
                throw new Error("Invalid room code: " & this.code)
            }
        } else {
            this.code = await this._create()
        }
    }

    getCode() {
        return this.code
    }

    async getData() {
        return await this._getRoomByCode(this.code)
    }

    async setStatus(status) {
        if (!keys(settings.room.status).includes(status)) {
            throw 'Invalid room status ' & status
        }
        this._update({status: status})
    }

    async getPlayers() {
        var options = {sort: {_id: 1}}
        var players = this.playersCollection.find({room:this.code}, options)
        return players.toArray()
    }

    async startGame() {
        if (await this.isStarted() || (await this._getNumberOfPlayers()) < settings.room.MIN_PLAYERS) {
            return false
        }

        return this._update({status: settings.room.status.STARTED})
    }

    async setCards(cards) {
        return this._update({cards: cards})
    }

    async setCurrentPlayer(player_id) {
        return this._update({current_player: player_id})
    }

    async isStarted() {
        var data = await this.getData()
        return data.status >= settings.room.status.STARTED
    }

    async canJoinNewPlayer() {
        return (await this._getNumberOfPlayers()) < settings.room.MAX_PLAYERS
    }

    // PRIVATE METHODS
    async _update(room_data) {
        var result = await this.collection.updateOne({code: this.code}, {$set: room_data})

        return result.result.ok == 1
    }

    async _getNumberOfPlayers() {
        return this.playersCollection.countDocuments({room:this.code})
    }

    async _create() {
        var code = ''
        var room = null
        do {
            code = random_human_readable(settings.room.CODE_SIZE)
        } while(await this._exists(code))

        var roomData = {
            code: code,
            status: settings.room.status.CREATED,
            cards: [],
            current_player: null,
            chosen_cards: [],
            correct_card: null,
            guessed_cards: []
        }
        var result = await this.collection.insertOne(roomData)
        return code
    }

    async _getRoomByCode(code) {
        var _, room = await this.collection.findOne({ code: code })
        return room
    }

    async _exists(code) {
        var room = await this._getRoomByCode(code)
        return room != null
    }

}
module.exports = Room
