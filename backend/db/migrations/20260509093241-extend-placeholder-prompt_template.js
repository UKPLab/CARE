'use strict';

/** @type {import('sequelize-cli').Migration} */
const promptPlaceholders = [
  {
    type: 8,
    placeholderKey: "pdfText",
    placeholderLabel: "templates.placeholders.labels.prompt.pdfText",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.pdfText",
    placeholderExample:
      "PDF Text: We compared three annotation tools in a graduate seminar (n=24). " +
      "Reviewers highlighted claims on pages 2–4 and left margin notes about study design.",
  },
  {
    type: 8,
    placeholderKey: "editorText",
    placeholderLabel: "templates.placeholders.labels.prompt.editorText",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.editorText",
    placeholderExample:
      "Editor Text: The introduction should state the research question clearly. " +
      "Draft paragraph: \"This study examines how peer feedback changes revision quality.\"",
  },
  {
    type: 8,
    placeholderKey: "assessmentResult",
    placeholderLabel: "templates.placeholders.labels.prompt.assessmentResult",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.assessmentResult",
    placeholderExample:
      "Assessment Result: {\"Clarity\":{\"currentScore\":3,\"assessment\":\"Clear structure; conclusion could be stronger.\"}," +
      "\"Sources\":{\"currentScore\":2,\"assessment\":\"Two claims need citations.\"}}",
  },
  {
    type: 8,
    placeholderKey: "inlineComments",
    placeholderLabel: "templates.placeholders.labels.prompt.inlineComments",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.inlineComments",
    placeholderExample:
      "Inline Comments: [{\"page\":2,\"quote\":\"The baseline is unclear\",\"comment\":\"Define the baseline in the methods section.\"," +
      "\"tag\":\"MajorIssue\"},{\"page\":4,\"quote\":\"Table 2 summarizes the main findings\",\"comment\":\"Good comparison of conditions.\"," +
      "\"tag\":\"Strength\"}]",
  },
  {
    type: 8,
    placeholderKey: "nlpAssessmentSuggestion",
    placeholderLabel: "templates.placeholders.labels.prompt.nlpAssessmentSuggestion",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.nlpAssessmentSuggestion",
    placeholderExample:
      "NLP Assessment Suggestion: [{\"name\":\"Clarity\",\"score\":3,\"justification\":\"Logical flow with minor gaps in the conclusion.\"}," +
      "{\"name\":\"Sources\",\"score\":2,\"justification\":\"Several statements lack supporting references.\"}]",
  },
  {
    type: 8,
    placeholderKey: "previousAssessmentResult",
    placeholderLabel: "templates.placeholders.labels.prompt.previousAssessmentResult",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.previousAssessmentResult",
    placeholderExample:
      "Previous Assessment Result: {\"Clarity\":{\"currentScore\":2,\"assessment\":\"Argumentation was fragmented in the prior draft.\"}," +
      "\"Sources\":{\"currentScore\":2,\"assessment\":\"Reference list was incomplete last step.\"}}",
  },
  {
    type: 8,
    placeholderKey: "assessmentConfiguration",
    placeholderLabel: "templates.placeholders.labels.prompt.assessmentConfiguration",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.assessmentConfiguration",
    placeholderExample:
      "Assessment Configuration: {\"type\":\"assessment\",\"rubrics\":[{\"name\":\"Overall\",\"criteria\":[{\"name\":\"Clarity\",\"maxPoints\":5},{\"name\":\"Sources\",\"maxPoints\":5}]}]}",
  },
  {
    type: 8,
    placeholderKey: "submissionFiles",
    placeholderLabel: "templates.placeholders.labels.prompt.submissionFiles",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.submissionFiles",
    placeholderExample:
      "Submission File: Chapter 1 — Introduction\n\nThis thesis presents a user study on collaborative reading platforms. " +
      "Participants annotated shared PDFs over three weekly sessions.",
  },
  {
    type: 8,
    placeholderKey: "studyContext",
    placeholderLabel: "templates.placeholders.labels.prompt.studyContext",
    placeholderType: "text",
    placeholderDescription: "templates.placeholders.descriptions.prompt.studyContext",
    placeholderExample:
      "Study Context: {\"studyName\":\"Peer Review Pilot\",\"stepName\":\"Essay feedback\",\"documentTitle\":\"Draft essay v2.pdf\"}",
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
