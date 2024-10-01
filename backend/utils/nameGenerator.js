const marvelCharacters = [
  "IronMan",
  "CaptainAmerica",
  "Thor",
  "Hulk",
  "BlackWidow",
  "Hawkeye",
  "SpiderMan",
  "BlackPanther",
  "DoctorStrange",
  "CaptainMarvel",
  "Wolverine",
  "Deadpool",
  "Thanos",
  "Loki",
  "StarLord",
  "Groot",
  "Gamora",
  "Rocket",
  "Vision",
  "ScarletWitch",
  "AntMan",
  "Wasp",
  "Daredevil",
  "Punisher",
  "SilverSurfer",
  "Gambit",
  "Cyclops",
  "MrFantastic",
  "Nightcrawler",
  "NickFury",
  "IceMan",
  "HumanTorch",
  "ProfessorX",
  "Storm",
  "JeanGrey",
  "Rogue",
  "EmmaFrost",
  "WarMachine",
  "ShangChi",
];

function generateRandomString(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

exports.generateMarvelUsername = function generateMarvelUsername() {
  const randomCharacter = marvelCharacters[Math.floor(Math.random() * marvelCharacters.length)];
  const randomSuffix = generateRandomString(4);
  return randomCharacter + randomSuffix;
};
