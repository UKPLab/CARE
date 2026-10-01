"use strict";

const WORKFLOW_NAMES = [
    "Peer Review Workflow (AI Chat)",
    "Peer Review Workflow (Assessment, AI Chat)",
    "Peer Review Workflow (AI Assessment, AI Chat)",
    "Review Assessment Workflow (AI Chat)",
    "Revision Workflow (AI Chat)",
];

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            UPDATE workflow_step AS step
            SET configuration = jsonb_set(
                COALESCE(step.configuration::jsonb, '{}'::jsonb),
                '{placeholders}',
                'false'::jsonb,
                true
            )
            FROM workflow
            WHERE step."workflowId" = workflow.id
              AND workflow.name IN (:workflowNames)
              AND workflow.deleted = false
              AND step.deleted = false
        `, {replacements: {workflowNames: WORKFLOW_NAMES}});
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            UPDATE workflow_step AS step
            SET configuration = COALESCE(step.configuration::jsonb, '{}'::jsonb) - 'placeholders'
            FROM workflow
            WHERE step."workflowId" = workflow.id
              AND workflow.name IN (:workflowNames)
              AND workflow.deleted = false
              AND step.deleted = false
        `, {replacements: {workflowNames: WORKFLOW_NAMES}});
    },
};
