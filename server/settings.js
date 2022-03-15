const settings = Object.freeze({
    'player': {
        'status': {
            'INACTIVE':  0,
            'ACTIVE': 1,
        },
        'game_status': {
            'READY': 'ready',
            'IDDLE': 'iddle',
            'WAITING': 'waiting',
        },
    },
    'database': {
        'collections': {
            'ROOMS': 'rooms',
            'PLAYERS': 'players',
        },
    },
    'room': {
        'CODE_SIZE': 9,
        'MAX_PLAYERS': 8,
        'MIN_PLAYERS': 3,
        'status': {
            'CREATED': 0,
            'STARTED': 1,
            'CHOOSE_SIMILAR_CARD': 2,
            'FIND_THE_CHOSEN_CARD': 3,
        },
    },
    'game': {
        'HAND_SIZE': 6,
        'MAXIMUM_CARDS': 52,
    }
})

module.exports = settings
