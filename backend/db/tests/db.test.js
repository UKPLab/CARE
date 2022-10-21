// Source: https://codesandbox.io/s/5zglq?file=/src/__tests__/database.js
const Sequelize = require("sequelize");
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.js')[env];

jest.mock("sequelize");

describe("database wrapper", () => {
    beforeEach(() => {
        Sequelize.mockClear();
    });

    it("exports an instance of sequelize", () => {
        expect(Sequelize).not.toHaveBeenCalled();
        require("../index.js");
        expect(Sequelize).toHaveBeenCalledWith(
            config.database, config.username, config.password, config
        );
    });
});