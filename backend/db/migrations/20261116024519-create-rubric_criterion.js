'use strict';

/**
 * Places a criterion version at a position in a rubric version. The row id is the criterion occurrence id.
 * Immutability and soft deletion: see 20261116024530-extend-assessment_versioning-immutability.js.
 * @author Eyad Mohamed
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable('rubric_criterion', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                rubricId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'rubric', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                criterionId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'criterion', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT',
                },
                criterionPositionInRubric: {
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

            await queryInterface.addConstraint('rubric_criterion', {
                type: 'unique',
                fields: ['rubricId', 'criterionId'],
                name: 'rubric_criterion_criterion_unique',
                transaction,
            });
            await queryInterface.addConstraint('rubric_criterion', {
                type: 'unique',
                fields: ['rubricId', 'criterionPositionInRubric'],
                name: 'rubric_criterion_position_unique',
                transaction,
            });
            await queryInterface.addIndex('rubric_criterion', ['criterionId'], {name: 'rubric_criterion_criterionId_index', transaction});
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.dropTable('rubric_criterion', {transaction});
        });
    },
};
