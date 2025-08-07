'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const adminId = await queryInterface.rawSelect('user', {where: {userName: 'admin'},}, ['id']);

        await queryInterface.bulkInsert("document", [
            {
                name: "Validation Config",
                hash: "1c784430-6ef0-4958-9451-c1960866135e",
                userId: adminId,
                public: false,
                updatedAt: new Date(),
                createdAt: new Date(),
                deleted: false,
                type: 3,
            }
        ], {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("document", {
            hash: ["1c784430-6ef0-4958-9451-c1960866135e"]
        }, {
            cascade: true,
            truncate: true
        })
    }
};
