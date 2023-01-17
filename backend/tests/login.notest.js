const request = require('supertest')
const Server = require('../webserver/Server.js')
const db = require("../db/index.js")

const server = new Server();

describe('Post Endpoints', () => {

    it.skip('should create a new post', async () => {
        const res = await request(server.app)
            .post('/auth/login')
            .send({
                username: "admin",
                password: "admincare",
            })
        expect(res.statusCode).toEqual(200)
        //expect(res.body).toHaveProperty('post')
    })

    afterAll(() => {
        db.sequelize.close();
    });
})
