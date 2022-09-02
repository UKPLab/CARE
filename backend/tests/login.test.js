const request = require('supertest')
const app = require('../index.js')
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
})
