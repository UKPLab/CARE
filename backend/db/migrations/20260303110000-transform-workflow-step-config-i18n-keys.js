'use strict';

const { resolveEnText } = require('../migration-i18n-utils');

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
  "If enabled, users must save a score and justification for every criterion before they can proceed.":
    "studies.workflowConfig.assessment.forcedAssessment.helpUsers",
  "Select the configuration file for assessment sidebar.":
    "studies.workflowConfig.assessment.configurationIdSidebar.help",
  "Show all document Annotations":
    "studies.workflowConfig.showAllDocumentAnnotations.label",
  "Show All Document Annotations":
    "studies.workflowConfig.showAllDocumentAnnotations.label",
  "If enabled, all document annotations will be shown to the reviewer.":
    "studies.workflowConfig.showAllDocumentAnnotations.help",
  "If enabled, default annotations will be shown to the reviewer.":
    "studies.workflowConfig.showAllDocumentAnnotations.helpDefault",
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

/** i18n keys written by `up` — only these strings are restored on `down`. */
const I18N_KEYS = new Set(Object.values(REPLACEMENTS));

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

function deepRestoreEnglish(value) {
  if (Array.isArray(value)) {
    return value.map(deepRestoreEnglish);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepRestoreEnglish(v)])
    );
  }
  if (typeof value === 'string' && I18N_KEYS.has(value)) {
    const english = resolveEnText(value);
    return english ?? value;
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
    const rows = await queryInterface.sequelize.query(
      'SELECT id, configuration FROM workflow_step',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const row of rows) {
      let cfg = row.configuration;
      if (typeof cfg === 'string') {
        try {
          cfg = JSON.parse(cfg);
        } catch (e) {
          continue;
        }
      }
      if (!cfg || typeof cfg !== 'object') {
        continue;
      }
      const nextCfg = deepRestoreEnglish(cfg);
      await queryInterface.bulkUpdate(
        'workflow_step',
        { configuration: JSON.stringify(nextCfg), updatedAt: new Date() },
        { id: row.id },
        {}
      );
    }
  },
};

