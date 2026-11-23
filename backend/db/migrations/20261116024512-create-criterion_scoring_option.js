'use strict';

/**
 * One selectable score level of a criterion version, ordered by `position`.
 * Immutability and soft deletion: see 20261116024530-extend-assessment_versioning-immutability.js.
 * @author Eyad Mohamed
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable('criterion_scoring_option', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                criterionId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'criterion', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                points: {
                    type: Sequelize.DECIMAL,
                    allowNull: false,
                },
                description: {
                    type: Sequelize.TEXT,
                    allowNull: false,
                },
                position: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                },
                deleted: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
                deletedAt: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: null,
                },
                createdAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.fn('NOW'),
                },
                updatedAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.fn('NOW'),
                },
            }, {transaction});

            await queryInterface.addConstraint('criterion_scoring_option', {
                type: 'unique',
                fields: ['criterionId', 'position'],
                name: 'criterion_scoring_option_position_unique',
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.dropTable('criterion_scoring_option', {transaction});
        });
    },
};
