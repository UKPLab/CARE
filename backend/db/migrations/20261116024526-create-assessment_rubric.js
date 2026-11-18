'use strict';

/**
 * Places a rubric version at a position in an assessment version.
 * Immutability and soft deletion: see 20261116024530-extend-assessment_versioning-immutability.js.
 * @author Eyad Mohamed
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable('assessment_rubric', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                assessmentId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'assessment', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                rubricId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'rubric', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT',
                },
                rubricPositionInAssessment: {
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

            await queryInterface.addConstraint('assessment_rubric', {
                type: 'unique',
                fields: ['assessmentId', 'rubricId'],
                name: 'assessment_rubric_rubric_unique',
                transaction,
            });
            await queryInterface.addConstraint('assessment_rubric', {
                type: 'unique',
                fields: ['assessmentId', 'rubricPositionInAssessment'],
                name: 'assessment_rubric_position_unique',
                transaction,
            });
            await queryInterface.addIndex('assessment_rubric', ['rubricId'], {name: 'assessment_rubric_rubricId_index', transaction});
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.dropTable('assessment_rubric', {transaction});
        });
    },
};
