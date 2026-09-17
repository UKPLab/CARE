'use strict';

/** @type {import('sequelize-cli').Migration} */
const promptPlaceholders = [
  {
    type: 8,
    placeholderKey: "pdfText",
    placeholderLabel: "templates.placeholders.labels.prompt.pdfText",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.pdfText",
    placeholderExample: "Document text content from the current PDF context. ... [truncated at 15000 chars if needed]",
  },
  {
    type: 8,
    placeholderKey: "editorText",
    placeholderLabel: "templates.placeholders.labels.prompt.editorText",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.editorText",
    placeholderExample: "Document text content from the current editor context. ... [truncated at 15000 chars if needed]",
  },
  {
    type: 8,
    placeholderKey: "assessmentResult",
    placeholderLabel: "templates.placeholders.labels.prompt.assessmentResult",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.assessmentResult",
    placeholderExample:
      '{"clarity":{"currentScore":3,"assessment":"Good structure but weak conclusion"},"sources":{"currentScore":2,"assessment":"Missing one reference"}}',
  },
  {
    type: 8,
    placeholderKey: "inlineComments",
    placeholderLabel: "templates.placeholders.labels.prompt.inlineComments",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.inlineComments",
    placeholderExample:
      '[{"page":2,"quote":"Baseline is unclear","comment":"Please define baseline.","tag":"MajorIssue"},{"page":4,"quote":"Table 2","comment":"Nice comparison.","tag":"Strength"}]',
  },
  {
    type: 8,
    placeholderKey: "nlpAssessmentSuggestion",
    placeholderLabel: "templates.placeholders.labels.prompt.nlpAssessmentSuggestion",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.nlpAssessmentSuggestion",
    placeholderExample:
      '[{"name":"clarity","score":3,"justification":"Clear flow with minor issues"},{"name":"sources","score":2,"justification":"Some claims lack citations"}]',
  },
  {
    type: 8,
    placeholderKey: "previousAssessmentResult",
    placeholderLabel: "templates.placeholders.labels.prompt.previousAssessmentResult",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.previousAssessmentResult",
    placeholderExample:
      '{"clarity":{"currentScore":2,"assessment":"Argumentation was fragmented"},"sources":{"currentScore":2,"assessment":"References were incomplete"}}',
  },
  {
    type: 8,
    placeholderKey: "assessmentConfiguration",
    placeholderLabel: "templates.placeholders.labels.prompt.assessmentConfiguration",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.assessmentConfiguration",
    placeholderExample:
      '{"type":"assessment","rubrics":[{"name":"overall","criteria":[{"name":"clarity","maxPoints":5},{"name":"sources","maxPoints":5}]}]}',
  },
  {
    type: 8,
    placeholderKey: "submissionFiles",
    placeholderLabel: "templates.placeholders.labels.prompt.submissionFiles",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.submissionFiles",
    placeholderExample: "Extracted text from the file mapped to this instance (e.g. main PDF body)…",
  },
  {
    type: 8,
    placeholderKey: "studyContext",
    placeholderLabel: "templates.placeholders.labels.prompt.studyContext",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.studyContext",
    placeholderExample:
      '{"studyName":"Peer Review Pilot","stepName":"Essay feedback","documentTitle":"Draft essay v2.pdf"}',
  },
];

const emailExamples = [
  { type: 1, placeholderKey: "username", placeholderExample: "jane.doe" },
  { type: 1, placeholderKey: "firstName", placeholderExample: "Jane" },
  { type: 1, placeholderKey: "lastName", placeholderExample: "Doe" },
  { type: 1, placeholderKey: "link", placeholderExample: "http://localhost:3000/…?token=exampleToken" },
  { type: 1, placeholderKey: "otp", placeholderExample: "482193" },
  { type: 1, placeholderKey: "tokenExpiry", placeholderExample: "24" },
  { type: 2, placeholderKey: "username", placeholderExample: "jane.doe" },
  { type: 2, placeholderKey: "link", placeholderExample: "http://localhost:3000/review/exampleSessionHash" },
  { type: 3, placeholderKey: "username", placeholderExample: "jane.doe" },
  { type: 3, placeholderKey: "assignmentType", placeholderExample: "document" },
  { type: 3, placeholderKey: "assignmentName", placeholderExample: "Peer Review Pilot" },
  { type: 3, placeholderKey: "link", placeholderExample: "http://localhost:3000/session/exampleSessionHash" },
  { type: 6, placeholderKey: "username", placeholderExample: "jane.doe" },
  { type: 6, placeholderKey: "studyName", placeholderExample: "Peer Review Pilot" },
  { type: 7, placeholderKey: "username", placeholderExample: "jane.doe" },
  { type: 7, placeholderKey: "assignmentName", placeholderExample: "Peer Review Pilot" },
  { type: 7, placeholderKey: "eventType", placeholderExample: "uploaded" },
  { type: 7, placeholderKey: "assignmentId", placeholderExample: "12" },
  { type: 7, placeholderKey: "submissionId", placeholderExample: "34" },
  { type: 7, placeholderKey: "timestamp", placeholderExample: "22 August 2026, 14:29" },
];

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn("placeholder", "placeholderExample", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.bulkInsert(
      "placeholder",
      promptPlaceholders.map((placeholder) => ({
        ...placeholder,
        required: false,
        deleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );

    for (const row of emailExamples) {
      await queryInterface.bulkUpdate(
        "placeholder",
        { placeholderExample: row.placeholderExample, updatedAt: new Date() },
        { type: row.type, placeholderKey: row.placeholderKey }
      );
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "placeholder",
      {
        type: 8,
        placeholderKey: promptPlaceholders.map((placeholder) => placeholder.placeholderKey),
      },
      {}
    );

    await queryInterface.removeColumn("placeholder", "placeholderExample");
  }
};
