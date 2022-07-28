'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('review',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                startAt: {
                    allowNull: false, type: Sequelize.DATE
                },
                startBy: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "user", key: "id"
                    }
                },
                document: {
                type: Sequelize.STRING,
                references: {
                    model: "document",
                    key: "hash"
                }
                },
                hash: {
                type: Sequelize.STRING, allowNull: false, unique: true
            },
                submitAt: {
                    allowNull: true, type: Sequelize.DATE
                },
                decisionBy: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "user", key: "id"
                    }
                },
                decisionAt: {
                    allowNull: true, type: Sequelize.DATE
                },
                decisionReason: {
                    type: Sequelize.STRING(4096)
                },
                submitted: {
                    type: Sequelize.BOOLEAN,
                    default: false
                },
                accepted: {
                    type: Sequelize.BOOLEAN,
                    default: false
                },
                createdAt: {
                    allowNull: false, type: Sequelize.DATE
                }, updatedAt: {
                    allowNull: false, type: Sequelize.DATE
                }
            });
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('review');
  }
};
