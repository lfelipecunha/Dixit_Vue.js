const VOWELS = 'aeiou'.split('');
const CONSONANTS = 'bcdfghjklmnprstvwxyz'.split('');
const VOWELS_LENGTH = VOWELS.length;
const CONSONANTS_LENGTH = CONSONANTS.length;

function GenerateRandomString(length) {
    if (length < 3) {
        throw new Error("Invalid size!")
    }
    let randomstring = '';

    for (let i = 0; i < length; i ++) {
        if (i == Math.floor(length/2)) {
            randomstring += '-'
        } else if (i % 2 === 0) {
            randomstring += CONSONANTS[Math.floor(Math.random() * CONSONANTS_LENGTH)];
        } else {
            if (Math.round(Math.random()*10) <= 7) {
                randomstring += VOWELS[Math.floor(Math.random() * VOWELS_LENGTH)];
            } else {
                randomstring += Math.floor(Math.random()*10)
            }
        }
    }

    return randomstring;
};

module.exports = GenerateRandomString