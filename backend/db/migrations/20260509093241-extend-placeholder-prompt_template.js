'use strict';

/** @type {import('sequelize-cli').Migration} */
const promptPlaceholders = [
  {
    type: 8,
    placeholderKey: "pdfText",
    placeholderLabel: "PDF text",
    placeholderType: "text",
    placeholderDescription: "Text from the PDF in the current context.",
    placeholderExample: "Document text content from the current PDF context. ... [truncated at 15000 chars if needed]",
  },
  {
    type: 8,
    placeholderKey: "editorText",
    placeholderLabel: "Editor text",
    placeholderType: "text",
    placeholderDescription: "Text from the current editor document in the current context.",
    placeholderExample: "Document text content from the current editor context. ... [truncated at 15000 chars if needed]",
  },
  {
    type: 8,
    placeholderKey: "assessmentResult",
    placeholderLabel: "Assessment result",
    placeholderType: "text",
    placeholderDescription: "Saved rubric from the assessment sidebar for this document and step.",
    placeholderExample: "{\"Clarity\":{\"currentScore\":3,\"assessment\":\"Good structure but weak conclusion\"},\"Sources\":{\"currentScore\":2,\"assessment\":\"Missing one reference\"}}",
  },
  {
    type: 8,
    placeholderKey: "inlineComments",
    placeholderLabel: "Inline comments",
    placeholderType: "text",
    placeholderDescription: "Structured comments and annotations for this document and step.",
    placeholderExample: "[{\"page\":2,\"quote\":\"Baseline is unclear\",\"comment\":\"Please define baseline.\",\"tag\":\"MajorIssue\"},{\"page\":4,\"quote\":\"Table 2\",\"comment\":\"Nice comparison.\",\"tag\":\"Strength\"}]",
  },
  {
    type: 8,
    placeholderKey: "nlpAssessmentSuggestion",
    placeholderLabel: "NLP assessment suggestion",
    placeholderType: "text",
    placeholderDescription: "Model draft assessment for this step if available.",
    placeholderExample: "[{\"name\":\"Clarity\",\"score\":3,\"justification\":\"Clear flow with minor issues\"},{\"name\":\"Sources\",\"score\":2,\"justification\":\"Some claims lack citations\"}]",
  },
  {
    type: 8,
    placeholderKey: "previousAssessmentResult",
    placeholderLabel: "Previous assessment result",
    placeholderType: "text",
    placeholderDescription: "Saved rubric from the previous step when carry-over is configured.",
    placeholderExample: "{\"Clarity\":{\"currentScore\":2,\"assessment\":\"Argumentation was fragmented\"},\"Sources\":{\"currentScore\":2,\"assessment\":\"References were incomplete\"}}",
  },
  {
    type: 8,
    placeholderKey: "assessmentConfiguration",
    placeholderLabel: "Assessment configuration",
    placeholderType: "text",
    placeholderDescription: "Assessment rubric configuration used in this step.",
    placeholderExample: "{\"type\":\"assessment\",\"rubrics\":[{\"name\":\"Overall\",\"criteria\":[{\"name\":\"Clarity\",\"maxPoints\":5},{\"name\":\"Sources\",\"maxPoints\":5}]}]}",
  },
  {
    type: 8,
    placeholderKey: "submissionFiles",
    placeholderLabel: "Submission files",
    placeholderType: "text",
    placeholderDescription: "All PDFs in the submission (id, filename, text when provided by the caller) plus a manifest of non-PDF files.",
    placeholderExample: "{\"pdfFiles\":[{\"documentId\":101,\"filename\":\"main.pdf\",\"text\":\"Extracted or caller-supplied text...\"},{\"documentId\":104,\"filename\":\"extra.pdf\",\"text\":\"\"}],\"otherFiles\":[{\"role\":\"attachment\",\"documentId\":102,\"filename\":\"spreadsheet.xlsx\",\"type\":\"other\"},{\"role\":\"attachment\",\"documentId\":103,\"filename\":\"sources.zip\",\"type\":\"zip\"}]}",
  },
  {
    type: 8,
    placeholderKey: "studyContext",
    placeholderLabel: "Study context",
    placeholderType: "text",
    placeholderDescription: "Basic metadata from current study, step, and document context.",
    placeholderExample: "{\"studyName\":\"Current study name\",\"stepName\":\"Current step name\",\"documentTitle\":\"Current document title\"}",
  },
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
