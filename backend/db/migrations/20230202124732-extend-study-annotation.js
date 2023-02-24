'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            'annotation',
            'studySessionId',
            {
                type: Sequelize.INTEGER,
                references: {
                    model: "study_session",
                    key: "id"
                },
                allowNull: true
            }
        )
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('annotation', "studyId");
    }
};
