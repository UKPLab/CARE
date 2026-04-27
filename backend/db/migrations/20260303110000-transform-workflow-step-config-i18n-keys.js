'use strict';

const REPLACEMENTS = {
  "The link is added to the end of the document \n `~SESSION_HASH~` will be replace with the current session hash":
    "studies.workflowConfig.addLinkEod.reviewLink.help",
  "Do you find the feedback helpful?":
    "studies.workflowConfig.addLinkEod.reviewText.help",
  "Assessment Configuration File:":
    "studies.workflowConfig.assessment.configurationId.label",
  "Select the configuration file for this workflow step assessment.":
    "studies.workflowConfig.assessment.configurationId.help",
  "Forced Assessment":
    "studies.workflowConfig.assessment.forcedAssessment.label",
  "If enabled, reviewers must save a score and justification for every criterion before they can proceed.":
    "studies.workflowConfig.assessment.forcedAssessment.help",
  "Configuration File:":
    "studies.workflowConfig.assessmentWithAi.configurationId.label",
  "Select the configuration file for this workflow step.":
    "studies.workflowConfig.assessmentWithAi.configurationId.help",
  "Modal Size":
    "studies.workflowConfig.modalSize.label",
  Small:
    "studies.workflowConfig.modalSize.options.small",
  Medium:
    "studies.workflowConfig.modalSize.options.medium",
  Large:
    "studies.workflowConfig.modalSize.options.large",
  "Extra Large":
    "studies.workflowConfig.modalSize.options.extraLarge",
};

function deepReplace(value) {
  if (Array.isArray(value)) {
    return value.map(deepReplace);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepReplace(v)])
    );
  }
  if (typeof value === "string" && value in REPLACEMENTS) {
    return REPLACEMENTS[value];
  }
  return value;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const rows = await queryInterface.sequelize.query(
      "SELECT id, configuration FROM workflow_step",
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const row of rows) {
      let cfg = row.configuration;
      if (typeof cfg === "string") {
        try {
          cfg = JSON.parse(cfg);
        } catch (e) {
          continue;
        }
      }
      if (!cfg || typeof cfg !== "object") {
        continue;
      }
      const nextCfg = deepReplace(cfg);
      await queryInterface.bulkUpdate(
        "workflow_step",
        { configuration: JSON.stringify(nextCfg), updatedAt: new Date() },
        { id: row.id },
        {}
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // No-op: reverse mapping is intentionally omitted.
  },
};

