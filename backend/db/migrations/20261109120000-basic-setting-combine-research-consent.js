"use strict";

/** @author Mohammed Rawhani */
module.exports = {
    async up(queryInterface) {
        const [step] = await queryInterface.select(null, "wizard_step", {
            where: {key: "registration"}, limit: 1,
        });
        const now = new Date();
        await queryInterface.bulkInsert("setting", [{
            key: "app.register.combineResearchConsent",
            value: "false",
            type: "boolean",
            description: "Show one optional checkbox for both research permissions when both are requested. Combined consent starts unchecked.",
            displayName: "Combine research consent checkboxes",
            displayGroup: "User Registration",
            displaySubsection: "Consent options",
            onlyAdmin: false,
            allowUserOverride: false,
            showInWizard: true,
            wizardStepId: step.id,
            wizardOrder: 31,
            requiredInWizard: false,
            deleted: false,
            createdAt: now,
            updatedAt: now,
        }]);
    },
    async down(queryInterface) {
        await queryInterface.bulkDelete("setting", {key: "app.register.combineResearchConsent"});
    },
};
