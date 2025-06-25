'use strict';

const settings = [
    {
        key: "annotator.download.enabledBeforeStudyClosing",
        value: false,
        type: "boolean",
        description: "Whether annotations can be downloaded before a study is closed"
    }
]

module.exports = {
    async up(queryInterface, Sequelize) {
         const groups = await queryInterface.bulkInsert(
            "setting",
            settings.map((t) => {
                t["createdAt"] = new Date();
                t["updatedAt"] = new Date();
                return t;
            }), {returning: true}
        );
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map((t) => t.key),
        }, {});
    }

}