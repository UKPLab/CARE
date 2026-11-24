// Only UUID generation is substituted; database and report logic remain real.
// This avoids changing Jest flags or production dependencies for these tests.
const uuid = () => ({v4: () => require("node:crypto").randomUUID()});
jest.doMock(require.resolve("uuid", {paths: [require.resolve("sequelize")]}), uuid);
jest.doMock("uuid", uuid);
