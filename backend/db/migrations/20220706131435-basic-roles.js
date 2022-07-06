'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert("sysrole", [
        {
            name: "regular",
            description: "no system rights",
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "maintainer",
            description: "manage users",
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "admin",
            description: "full control",
            createdAt: new Date(),
            updatedAt: new Date(),
        }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("sysrole", {
        name: ['regular', 'maintainer', 'admin']
    }, {})
  }
};
