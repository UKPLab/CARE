/**
 * Helper functions for generating random stuff.
 *
 * @author Linyin Huang
 */
const animals = [
  "Antelope",
  "BengalTiger",
  "Buffalo",
  "Cheetah",
  "Coyote",
  "Dingo",
  "Dolphin",
  "Eagle",
  "Emu",
  "Elephant",
  "Falcon",
  "Flamingo",
  "Fox",
  "Gazelle",
  "Giraffe",
  "Hedgehog",
  "Hippopotamus",
  "Iguana",
  "Impala",
  "Jackal",
  "Jaguar",
  "Kangaroo",
  "Koala",
  "Lemur",
  "Lion",
  "Manatee",
  "Monkey",
  "Narwhal",
  "Numbat",
  "Octopus",
  "Ocelot",
  "Panda",
  "Penguin",
  "Phoenix", 
  "Quail",
  "Quokka",
  "Rabbit",
  "Raccoon",
  "RedPanda",
  "Rhinoceros",
  "Sloth",
  "Squirrel",
  "Tapir",
  "Turtle",
  "Unicorn",
  "Urial",
  "Viper",
  "Vulture",
  "Walrus",
  "Wombat",
  "Yak",
  "Zebra",
];

/**
 * Generate random string of the specified length
 * @param {number} length The length of the random string
 * @returns {string} Generated string
 */
function generateRandomString(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Generate a random animal-themed username
 * @returns {string} A random username consisting of an animal's name and 4-character random string
 */
exports.generateAnimalUsername = function generateAnimalUsername() {
  const randomCharacter = animals[Math.floor(Math.random() * animals.length)];
  const randomSuffix = generateRandomString(4);
  return randomCharacter + randomSuffix;
};
