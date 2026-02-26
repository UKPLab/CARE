'use strict';

/**
 * Wizard settings per step requiredInWizard: true only where the setting must be filled.
 */
const WIZARD_SETTINGS = [
    // general
    { key: 'app.config.copyright', wizardStep: 'general', wizardOrder: 1, requiredInWizard: true },
    { key: 'app.config.consent.enabled', wizardStep: 'general', wizardOrder: 2, requiredInWizard: false },
    { key: 'app.login.guest', wizardStep: 'general', wizardOrder: 3, requiredInWizard: false },
    { key: 'app.login.forgotPassword', wizardStep: 'general', wizardOrder: 4, requiredInWizard: false },
    { key: 'app.study.enabled', wizardStep: 'general', wizardOrder: 5, requiredInWizard: false },
    { key: 'app.landing.showDocs', wizardStep: 'general', wizardOrder: 6, requiredInWizard: false },
    { key: 'app.landing.linkDocs', wizardStep: 'general', wizardOrder: 7, requiredInWizard: true },
    { key: 'app.landing.showProject', wizardStep: 'general', wizardOrder: 8, requiredInWizard: false },
    { key: 'app.landing.linkProject', wizardStep: 'general', wizardOrder: 9, requiredInWizard: false },
    { key: 'app.landing.showFeedback', wizardStep: 'general', wizardOrder: 10, requiredInWizard: false },
    { key: 'app.landing.linkFeedback', wizardStep: 'general', wizardOrder: 11, requiredInWizard: false },
    // mail
    { key: 'system.mailService.enabled', wizardStep: 'mail', wizardOrder: 12, requiredInWizard: false },
    { key: 'system.mailService.sendMail.enabled', wizardStep: 'mail', wizardOrder: 13, requiredInWizard: false },
    { key: 'system.mailService.sendMail.path', wizardStep: 'mail', wizardOrder: 14, requiredInWizard: false },
    { key: 'system.mailService.senderAddress', wizardStep: 'mail', wizardOrder: 15, requiredInWizard: false },
    { key: 'system.mailService.smtp.enabled', wizardStep: 'mail', wizardOrder: 16, requiredInWizard: false },
    { key: 'system.mailService.smtp.host', wizardStep: 'mail', wizardOrder: 17, requiredInWizard: false },
    { key: 'system.mailService.smtp.port', wizardStep: 'mail', wizardOrder: 18, requiredInWizard: false },
    { key: 'system.mailService.smtp.secure', wizardStep: 'mail', wizardOrder: 19, requiredInWizard: false },
    { key: 'system.mailService.smtp.auth.enabled', wizardStep: 'mail', wizardOrder: 20, requiredInWizard: false },
    { key: 'system.mailService.smtp.auth.user', wizardStep: 'mail', wizardOrder: 21, requiredInWizard: false },
    { key: 'system.mailService.smtp.auth.pass', wizardStep: 'mail', wizardOrder: 22, requiredInWizard: false },
    { key: 'system.baseUrl', wizardStep: 'mail', wizardOrder: 23, requiredInWizard: false },
    { key: 'app.register.emailVerification', wizardStep: 'mail', wizardOrder: 24, requiredInWizard: false },
    // app.login.forgotPassword already in general; in mail step it's a toggle in UI, same key
    // registration
    { key: 'app.register.enabled', wizardStep: 'registration', wizardOrder: 25, requiredInWizard: false },
    { key: 'app.register.requestName', wizardStep: 'registration', wizardOrder: 26, requiredInWizard: false },
    { key: 'app.register.requestStats', wizardStep: 'registration', wizardOrder: 27, requiredInWizard: false },
    { key: 'app.register.requestData', wizardStep: 'registration', wizardOrder: 28, requiredInWizard: false },
    { key: 'app.register.acceptStats.default', wizardStep: 'registration', wizardOrder: 29, requiredInWizard: false },
    { key: 'app.register.acceptDataSharing.default', wizardStep: 'registration', wizardOrder: 30, requiredInWizard: false },
    { key: 'app.register.terms', wizardStep: 'registration', wizardOrder: 31, requiredInWizard: false },
    // moodle
    { key: 'rpc.moodleAPI.apiUrl', wizardStep: 'moodle', wizardOrder: 32, requiredInWizard: false },
    { key: 'rpc.moodleAPI.apiKey', wizardStep: 'moodle', wizardOrder: 33, requiredInWizard: false },
    { key: 'rpc.moodleAPI.courseID', wizardStep: 'moodle', wizardOrder: 34, requiredInWizard: false },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        for (const { key, wizardStep, wizardOrder, requiredInWizard } of WIZARD_SETTINGS) {
            await queryInterface.sequelize.query(
                `UPDATE setting SET "showInWizard" = true, "wizardStep" = :wizardStep, "wizardOrder" = :wizardOrder, "requiredInWizard" = :requiredInWizard, "updatedAt" = :now WHERE key = :key`,
                {
                    replacements: { key, wizardStep, wizardOrder, requiredInWizard, now: new Date() },
                    type: Sequelize.QueryTypes.UPDATE,
                }
            );
        }
    },

    async down(queryInterface, Sequelize) {
        for (const { key } of WIZARD_SETTINGS) {
            await queryInterface.sequelize.query(
                `UPDATE setting SET "showInWizard" = false, "wizardStep" = NULL, "wizardOrder" = NULL, "requiredInWizard" = false, "updatedAt" = :now WHERE key = :key`,
                {
                    replacements: { key, now: new Date() },
                    type: Sequelize.QueryTypes.UPDATE,
                }
            );
        }
    },
};
