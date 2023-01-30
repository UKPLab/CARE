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
    {
        key: "app.config.copyright",
        value: "Copyright © 2022-2023 Team Care UKP Labs (TU Darmstadt)",
        description: "The copyright text to display on the login page"
    },
    {
        key: "app.register.requestName",
        type: "boolean",
        value: "true",
        description: "Whether to request the user's name during registration"
    },
    {
        key: "app.register.requestStats",
        type: "boolean",
        value: "true",
        description: "Whether to request the user's statistics approval during registration"
    },
    {key: "app.login.guest", type: "boolean", value: "true", description: "Whether to allow guest logins"},
    {
        key: "app.register.terms",
        type: "html",
        value: terms,
        description: "Terms and conditions text to display during registration"
    },
    {
        key: "app.landing.showDocs",
        type: "boolean",
        value: "true",
        description: "Whether to show the documentation links on the landing page"
    },
    {key: "app.landing.linkDocs", value: "/docs", description: "The URL to the documentation"},
    {
        key: "app.landing.showProject",
        type: "boolean",
        value: "true",
        description: "Whether to show the official project page link on the landing page"
    },
    {
        key: "app.landing.linkProject",
        value: process.env.APP_LINK_PROJECT,
        description: "The URL to the official project page"
    },
    {
        key: "app.landing.showFeedback",
        type: "boolean",
        value: "true",
        description: "Whether to show the official feedback link on the landing page"
    },
    {
        key: "app.landing.linkFeedback",
        value: process.env.APP_LINK_FEEDBACK,
        description: "The URL to the official feedback page"
    },
    {key: "service.nlp.url", value: process.env.SERVICE_NLP_URL, description: "The URL of the NLP service"},
    {
        key: "service.nlp.token",
        value: process.env.SERVICE_NLP_TOKEN,
        description: "The token to use for the NLP service"
    },
    {
        key: "service.nlp.timeout",
        type: "number",
        value: "60000",
        description: "The timeout between connection attempts for the NLP service (ms)"
    },
    {
        key: "service.nlp.retryDelay",
        type: "number",
        value: "10000",
        description: "The delay between retries if connection errors occurs for the NLP service (ms)"
    },
    {
        key: "service.nlp.enabled",
        value: process.env.SERVICE_NLP_ENABLED,
        type: "boolean",
        description: "Whether to automatically connect to the NLP service"
    },
    {
        key: "annotator.collab.response",
        value: "true",
        type: "boolean",
        description: "Whether the comment response functionality is activated."
    },
    {
        key: "service.nlp.test.fallback",
        value: "true",
        type: "boolean",
        description: "Whether to use the fallback NLP service if the main service is not available, files on local file system are used as fallback and return examples"
    },
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
