'use strict';

/**
 * One immutable version of a criterion; versions of the same criterion share `criterionGroupId`.
 * Immutability and soft deletion: see 20261116024530-extend-assessment_versioning-immutability.js.
 * @author Eyad Mohamed
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('CREATE SEQUENCE "criterion_group_id_seq"', {transaction});

            await queryInterface.createTable('criterion', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                criterionGroupId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: Sequelize.literal(`nextval('"criterion_group_id_seq"')`),
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
                minPoints: {
                    type: Sequelize.DECIMAL,
                    allowNull: true,
                },
                maxPoints: {
                    type: Sequelize.DECIMAL,
                    allowNull: true,
                },
                settings: {
                    type: Sequelize.JSONB,
                    allowNull: false,
                    defaultValue: Sequelize.literal("'{}'::jsonb"),
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

            await queryInterface.addConstraint('criterion', {
                type: 'unique',
                fields: ['criterionGroupId', 'versionNumber'],
                name: 'criterion_group_version_unique',
                transaction,
            });
            await queryInterface.addConstraint('criterion', {
                type: 'check',
                fields: [],
                where: Sequelize.literal('"minPoints" IS NULL OR "maxPoints" IS NULL OR "minPoints" <= "maxPoints"'),
                name: 'criterion_points_range_check',
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.dropTable('criterion', {transaction});
            await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS "criterion_group_id_seq"', {transaction});
        });
    },
};
