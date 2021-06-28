const random_human_readable = require("../random_human_readable");

test.each([10, 9, 3])("Gerenate a random string: length $length", (length) => {
    var string = random_human_readable(length)
    expect(string.length).toBe(length)
    var left = Math.floor(length/2)
    var right = length - left - 1 // -1 'cause of "-" char
    expect(string).toMatch(new RegExp("[a-z0-9]{"+ left +"}-[a-z0-9]{"+ right +"}"))
})

test("Error when generate with a random string with length less than 3", () => {
    expect.assertions(2)
    expect(() => {random_human_readable(1)}).toThrow()
    expect(() => {random_human_readable(2)}).toThrow()
})