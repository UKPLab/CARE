'use strict';
const fs = require('fs');

const terms = fs.readFileSync('../../terms.txt', 'utf8');

const settings = [
    {
        key: "dashboard.navigation.component.default",
        value: "Home",
        description: "The default component to display in the dashboard"
    },
    {key: "tags.tagSet.default", value: "1", description: "The default tagset to use for new annotations"},
    {key: "app.config.copyright", value: "Copyright © 2022-2023 Team Care UKP Labs (TU Darmstadt)", description: "The copyright text to display on the login page"},
    {key: "app.register.requestName", type: "boolean", value: "true", description: "Whether to request the user's name during registration"},
    {key: "app.register.requestStats", type: "boolean", value: "true", description: "Whether to request the user's statistics approval during registration"},
    {key: "app.login.guest", type: "boolean", value: "true", description: "Whether to allow guest logins"},
    {key: "app.register.terms", type: "html", value: terms, description: "Terms and conditions text to display during registration"},
]

module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('setting',
            settings.map(t => {
                t['createdAt'] = new Date();
                t['updatedAt'] = new Date();
                return t;
            }), {returning: true});

    },

    async down(queryInterface, Sequelize) {
        //delete nav elements first
        await queryInterface.bulkDelete("setting", {
            key: settings.map(t => t.key)
        }, {});
    }
};
