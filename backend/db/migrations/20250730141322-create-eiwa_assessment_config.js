'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const adminId = await queryInterface.rawSelect('user', {where: {userName: 'admin'},}, ['id']);

        await queryInterface.bulkInsert("document", [
            {
                name: "Assessment Config",
                hash: "d8ef6767-39bc-44ea-9a7a-1356d9200871",
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
            hash: ["d8ef6767-39bc-44ea-9a7a-1356d9200871"]
        }, {
            cascade: true,
            truncate: true
        })
    }
};
