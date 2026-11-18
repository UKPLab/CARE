'use strict';

/**
 * One immutable version of a rubric; same group and lifecycle rules as `criterion`.
 * `calculation` is free text ("sum" or "max" for new rubrics, older data may hold "min").
 * @author Eyad Mohamed
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('CREATE SEQUENCE "rubric_group_id_seq"', {transaction});

            await queryInterface.createTable('rubric', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                rubricGroupId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: Sequelize.literal(`nextval('"rubric_group_id_seq"')`),
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
                calculation: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
                defaultPoints: {
                    type: Sequelize.DECIMAL,
                    allowNull: true,
                },
                isBonus: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
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

            await queryInterface.addConstraint('rubric', {
                type: 'unique',
                fields: ['rubricGroupId', 'versionNumber'],
                name: 'rubric_group_version_unique',
                transaction,
            });
            await queryInterface.addConstraint('rubric', {
                type: 'check',
                fields: [],
                where: Sequelize.literal('"minPoints" <= "maxPoints"'),
                name: 'rubric_points_range_check',
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.dropTable('rubric', {transaction});
            await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS "rubric_group_id_seq"', {transaction});
        });
    },
};
