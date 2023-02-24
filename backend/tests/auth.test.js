const request = require('supertest')
const Server = require("../webserver/Server.js");

describe('Test Login', () => {

    beforeAll(async () => {
        this.server = new Server();
        this.http = this.server.start(3020);
    });

    /**
     * Test the /POST login route with valid credentials
     */
    test('Admin Login', async () => {
        return request(this.server.http)
            .post('/auth/login')
            .send({
                username: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PWD,
            }).expect(200);
        //expect(res.statusCode).toEqual(200)
    })

    test('Admin Login2', async () => {
        return request(this.server.http)
            .post('/auth/login')
            .send({
                username: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PWD,
            }).expect(200);
        //expect(res.statusCode).toEqual(200)
    })

    /**
     * Test the /POST login route with invalid credentials
     */
    test('Invalid Login', async () => {
        return request(this.server.http)
            .post('/auth/login')
            .send({
                username: process.env.ADMIN_EMAIL,
                password: 'invalid',
            }).expect(401);
    });

    /**
     * Test the /GET config route
     */
    test('Get Config', async () => {
        return request(this.server.http)
            .get('/config.js')
            .expect(200);
    });

    /**
     * Test the /POST register route
     */
    test('Register', (done) => {
        request(this.server.http)
            .post('/auth/register')
            .send({
                userName: 'testuser',
                password: 'testuser',
                email: 'test@test.de',
                firstName: 'test',
                lastName: 'user',
                acceptTerms: true,
            }).expect(201).end((err, res) => {
            if (err) {
                done(err);
            }
            request(this.server.http)
                .post('/auth/login')
                .send({
                    username: 'testuser',
                    password: 'testuser',
                }).expect(200).end((err, res) => {
                if (err) {
                    done(err);
                }
                done();
            });

        });
        /* expect(register.statusCode).toEqual(201);
         return request(this.server.app)
             .post('/auth/login')
             .send({
                 username: 'testuser',
                 password: 'testuser',
             }).expect(200);*/
    });

    afterAll(async () => {
        this.server.stop();
    });

})
