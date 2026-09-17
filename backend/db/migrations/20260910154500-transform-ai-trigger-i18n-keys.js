"use strict";

const { translateMaybeKey } = require("../../utils/i18n");

/**
 * Convert already-seeded AI/trigger English catalog strings to i18n keys.
 * Editing the original seed migrations does not update databases that already ran them.
 *
 * @type {import('sequelize-cli').Migration}
 */

const PROMPT_PLACEHOLDERS = [
  "pdfText",
  "editorText",
  "assessmentResult",
  "inlineComments",
  "nlpAssessmentSuggestion",
  "previousAssessmentResult",
  "assessmentConfiguration",
  "submissionFiles",
  "studyContext",
];

function promptKeys(placeholderKey) {
  return {
    placeholderLabel: `templates.placeholders.labels.prompt.${placeholderKey}`,
    placeholderDescription: `templates.placeholders.descriptions.prompt.${placeholderKey}`,
  };
}

const SETTING_KEY = "trigger.queue.pollInterval";
const SETTING_KEYS = {
  displayName: "settings.triggerQueue.pollInterval.displayName",
  description: "settings.triggerQueue.pollInterval.description",
  displayGroup: "settings.triggerQueue.group",
  displaySubsection: "settings.triggerQueue.queue",
};

const EVENT_PATCHES = {
  "submission.uploaded": {
    up: {
      label: "triggers.metadata.events.assignment.label",
      description: "triggers.metadata.events.assignment.description",
      formLabel: "triggers.metadata.events.assignment.fields.assignment",
    },
    down: {
      label: "Assignment",
      description: "Fires when a student uploads a submission for a selected assignment.",
      formLabel: "Assignment",
    },
  },
};

const ACTION_PATCHES = {
  "Email notification": {
    up: {
      label: "triggers.metadata.actions.email.label",
      description: "triggers.metadata.actions.email.description",
      recipientLabel: "triggers.metadata.actions.email.fields.recipient",
      templateLabel: "triggers.metadata.actions.email.fields.template",
      uploader: "triggers.metadata.actions.email.options.uploader",
      admins: "triggers.metadata.actions.email.options.admins",
    },
    down: {
      label: "Send an email",
      description: "Sends an email to a recipient derived from the event context.",
      recipientLabel: "Send to",
      templateLabel: "Email template",
      uploader: "The uploader",
      admins: "All admins",
    },
  },
  "AI Preprocessing": {
    up: {
      label: "triggers.metadata.actions.aiPreprocessing.label",
      description: "triggers.metadata.actions.aiPreprocessing.description",
    },
    down: {
      label: "AI Preprocessing",
      description:
        "Runs an NLP skill on the uploaded submission with the same skill, input mapping, and base file options as Dashboard → Submissions → Apply Skills. Results are stored in document_data.",
    },
  },
};

function parseConfig(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return {};
    }
  }
  return { ...value };
}

function patchEventConfig(config, patch) {
  const next = parseConfig(config);
  next.label = patch.label;
  next.description = patch.description;
  if (Array.isArray(next.formSchema) && next.formSchema[0]) {
    next.formSchema[0] = { ...next.formSchema[0], label: patch.formLabel };
  }
  return next;
}

function patchActionConfig(config, patch) {
  const next = parseConfig(config);
  next.label = patch.label;
  next.description = patch.description;
  if (!Array.isArray(next.formSchema)) return next;

  next.formSchema = next.formSchema.map((field) => {
    if (field.key === "recipient") {
      const options = (field.options || []).map((option) => {
        if (option.value === "uploader") return { ...option, name: patch.uploader };
        if (option.value === "admins") return { ...option, name: patch.admins };
        return option;
      });
      return { ...field, label: patch.recipientLabel, options };
    }
    if (field.key === "templateId") {
      return { ...field, label: patch.templateLabel };
    }
    return field;
  });
  return next;
}

async function updateCatalogRows(queryInterface, Sequelize, table, patches, patchFn, direction) {
  const toJsonb = (obj) => Sequelize.literal(`'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`);

  for (const [name, versions] of Object.entries(patches)) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, configuration FROM ${table} WHERE name = :name`,
      { replacements: { name } }
    );
    for (const row of rows) {
      await queryInterface.bulkUpdate(
        table,
        {
          configuration: toJsonb(patchFn(row.configuration, versions[direction])),
          updatedAt: new Date(),
        },
        { id: row.id }
      );
    }
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    for (const placeholderKey of PROMPT_PLACEHOLDERS) {
      await queryInterface.bulkUpdate(
        "placeholder",
        { ...promptKeys(placeholderKey), updatedAt: now },
        { type: 8, placeholderKey },
        {}
      );
    }

    await queryInterface.bulkUpdate("setting", { ...SETTING_KEYS, updatedAt: now }, { key: SETTING_KEY }, {});

    await updateCatalogRows(queryInterface, Sequelize, "trigger_event", EVENT_PATCHES, patchEventConfig, "up");
    await updateCatalogRows(queryInterface, Sequelize, "trigger_action", ACTION_PATCHES, patchActionConfig, "up");
  },

  async down(queryInterface, Sequelize) {
    const now = new Date();

    for (const placeholderKey of PROMPT_PLACEHOLDERS) {
      const keys = promptKeys(placeholderKey);
      await queryInterface.bulkUpdate(
        "placeholder",
        {
          placeholderLabel: translateMaybeKey(keys.placeholderLabel),
          placeholderDescription: translateMaybeKey(keys.placeholderDescription),
          updatedAt: now,
        },
        { type: 8, placeholderKey },
        {}
      );
    }

    await queryInterface.bulkUpdate(
      "setting",
      {
        displayName: translateMaybeKey(SETTING_KEYS.displayName),
        description: translateMaybeKey(SETTING_KEYS.description),
        displayGroup: translateMaybeKey(SETTING_KEYS.displayGroup),
        displaySubsection: translateMaybeKey(SETTING_KEYS.displaySubsection),
        updatedAt: now,
      },
      { key: SETTING_KEY },
      {}
    );

    await updateCatalogRows(queryInterface, Sequelize, "trigger_event", EVENT_PATCHES, patchEventConfig, "down");
    await updateCatalogRows(queryInterface, Sequelize, "trigger_action", ACTION_PATCHES, patchActionConfig, "down");
  },
};
