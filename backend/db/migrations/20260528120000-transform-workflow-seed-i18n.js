'use strict';

/** Seed workflows from basic/extend migrations — match by English name before update. */
const I18N_BY_SEED_NAME = {
  "Peer Review Workflow": {
    name: "workflow.names.peer_review_workflow",
    description: "workflow.descriptions.peer_review_workflow",
  },
  "Ruhr-Uni Bochum Project": {
    name: "workflow.names.ruhr-uni_bochum_project",
    description: "workflow.descriptions.ruhr-uni_bochum_project",
  },
  "Ruhr-Uni Bochum Project (Control)": {
    name: "workflow.names.ruhr-uni_bochum_project_control",
    description: "workflow.descriptions.ruhr-uni_bochum_project_control",
  },
  "Annotation Workflow": {
    name: "workflow.names.annotation_workflow",
    description: "workflow.descriptions.annotation_workflow",
  },
  "Peer Review Workflow (Assessment)": {
    name: "workflow.names.peer_review_workflow_(assessment)",
    description: "workflow.descriptions.peer_review_workflow_(assessment)",
  },
  "Peer Review Workflow (Assessment with AI)": {
    name: "workflow.names.peer_review_workflow_(assessment_with_ai)",
    description: "workflow.descriptions.peer_review_workflow_(assessment_with_ai)",
  },
  "Review Assessment Workflow": {
    name: "workflow.names.review_assessment_workflow",
    description: "workflow.descriptions.review_assessment_workflow",
  },
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [seedName, i18n] of Object.entries(I18N_BY_SEED_NAME)) {
      await queryInterface.bulkUpdate(
        "workflow",
        { name: i18n.name, description: i18n.description, updatedAt: new Date() },
        { name: seedName },
        {}
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // No-op: original English strings not restored.
  },
};
