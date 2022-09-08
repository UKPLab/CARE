const request = require('supertest')
const webserver = require('../webserver/webServer.js')
const db = require("../db/index.js")

const app = webserver();

describe('Post Endpoints', () => {

    it('should create a new post', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({
                username: "admin",
                password: "admin",
            })
        //console.log(res);
        expect(res.statusCode).toEqual(200)
        //expect(res.body).toHaveProperty('post')
    })

    afterAll(() => {
        db.sequelize.close();
    });
})
