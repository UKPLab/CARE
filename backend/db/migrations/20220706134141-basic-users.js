'use strict';
const {genSalt, genPwdHash} = require("../methods/utils.js");

module.exports = {
    async up(queryInterface, Sequelize) {
        const users = [{
            name: "admin",
            role: "admin",
            email: process.env.ADMIN_EMAIL,
            pwd: process.env.ADMIN_PWD
        },
            {
                name: "guest",
                role: "regular",
                email: process.env.GUEST_EMAIL,
                pwd: process.env.GUEST_PWD
            }
        ];

        await queryInterface.bulkInsert("user",
            await Promise.all(users.map(async user => {
                const salt = genSalt();
                let passwordHash = await genPwdHash(user.pwd, salt);
                //passwordHash = passwordHash.toString('hex');

                return {
                    sysrole: user.role,
                    first_name: user.name,
                    last_name: "user",
                    user_name: user.name,
                    email: user.email,
                    password_hash: passwordHash,
                    salt: salt,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            }))
        );
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("user", {
            user_name: ['admin', 'guest']
        }, {})
    }
};
