'use strict';

/**
 * One immutable version of an assessment; same group and lifecycle rules as `criterion`.
 * `previousAssessmentVersionId` is kept valid by 20261116024533-extend-assessment-version_chain.js.
 * @author Eyad Mohamed
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('CREATE SEQUENCE "assessment_group_id_seq"', {transaction});

            await queryInterface.createTable('assessment', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                assessmentGroupId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: Sequelize.literal(`nextval('"assessment_group_id_seq"')`),
                },
                versionNumber: {
                    type: Sequelize.STRING,
                    allowNull: false,
                },
                name: {
                    type: Sequelize.STRING,
                    allowNull: false,
                },
                description: {
                    type: Sequelize.TEXT,
                    allowNull: false,
                },
                previousAssessmentVersionId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: 'assessment', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT',
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

            await queryInterface.addConstraint('assessment', {
                type: 'unique',
                fields: ['assessmentGroupId', 'versionNumber'],
                name: 'assessment_group_version_unique',
                transaction,
            });
            await queryInterface.addIndex('assessment', ['previousAssessmentVersionId'], {name: 'assessment_previousAssessmentVersionId_index', transaction});
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.dropTable('assessment', {transaction});
            await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS "assessment_group_id_seq"', {transaction});
        });
    },
};
