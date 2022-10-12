'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const guestId = await queryInterface.rawSelect('user', {where: {user_name: 'guest'},}, ['id']);

        await queryInterface.bulkInsert("document", [
            {
                name: "Showcase Document",
                hash: "8852a746-360e-4c31-add2-4d1c75bfb96d",
                creator: guestId,
                updatedAt: new Date(),
                createdAt: new Date(),
                deleted: false
            }
        ], {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("document", {
            hash: ["8852a746-360e-4c31-add2-4d1c75bfb96d"]
        }, {
            cascade: true,
            truncate: true
        })
    }
};
