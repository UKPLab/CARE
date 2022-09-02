// Source: https://codesandbox.io/s/5zglq?file=/src/__tests__/consumer.js:0-817
const mockDatabase = {
  query: jest.fn(),
};

// NOTE: jest.doMock is used here because jest.mock is automatically hoisted to top of file.
jest.doMock("../index.js", () => {
  return mockDatabase;
});

// NOTE: we are importing dependencies after jest.doMock call (IMPORTANT)
const database = require("../index.js");
const document = require("../methods/document.js");

describe("database document", () => {
  describe("get example document", () => {

    test('exists', async () => {
      expect(document.getDoc("8852a746-360e-4c31-add2-4d1c75bfb96d")).toBeDefined();
    });

    /*it("exists", () => {
      expect(document.getDoc("8852a746-360e-4c31-add2-4d1c75bfb96d")).toBeDefined();
    });

    it("calls database.query", async () => {
      const input = "foobar";
      mockDatabase.query.mockResolvedValue("it works!");
      const result = await consumer.example(input);
      expect(database.query).toHaveBeenCalledWith(input);
      expect(result).toEqual("it works!");
    });*/
  });
});