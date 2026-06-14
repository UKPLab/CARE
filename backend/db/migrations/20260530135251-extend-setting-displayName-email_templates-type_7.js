'use strict';

/**
 * Set displayName, displayGroup, and displaySubsection for submission upload email
 * template settings (type 7), added after extend-setting-displayName-email_templates.
 *
 * @type {import('sequelize-cli').Migration}
 */

const UPDATES = [
    { key: 'email.template.submissionUpload', displayName: 'Submission upload (assignment owner)', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.submissionUploadConfirmation', displayName: 'Submission upload (submitter)', displayGroup: 'Mail', displaySubsection: 'Email templates' },
];

module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();
        for (const u of UPDATES) {
            await queryInterface.sequelize.query(
                `UPDATE setting SET "displayName" = :dn, "displayGroup" = :dg, "displaySubsection" = :ds, "updatedAt" = :now WHERE key = :k`,
                { replacements: { dn: u.displayName, dg: u.displayGroup, ds: u.displaySubsection, k: u.key, now } }
            );
        }
    },

    async down(queryInterface, Sequelize) {
        const now = new Date();
        for (const u of UPDATES) {
            await queryInterface.sequelize.query(
                `UPDATE setting SET "displayName" = NULL, "displayGroup" = NULL, "displaySubsection" = NULL, "updatedAt" = :now WHERE key = :k`,
                { replacements: { k: u.key, now } }
            );
        }
    },
};
