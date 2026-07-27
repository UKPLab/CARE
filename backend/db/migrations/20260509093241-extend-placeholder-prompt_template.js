'use strict';

/** @type {import('sequelize-cli').Migration} */
const promptPlaceholders = [
  {
    type: 8,
    placeholderKey: "pdfText",
    placeholderLabel: "PDF text",
    placeholderType: "text",
    placeholderDescription: "Plain text extracted from a PDF.",
    placeholderExample:
      "PDF Text: We compared three annotation tools in a graduate seminar (n=24). " +
      "Reviewers highlighted claims on pages 2–4 and left margin notes about study design.",
  },
  {
    type: 8,
    placeholderKey: "editorText",
    placeholderLabel: "Editor text",
    placeholderType: "text",
    placeholderDescription: "Plain text from an HTML or modal editor document.",
    placeholderExample:
      "Editor Text: The introduction should state the research question clearly. " +
      "Draft paragraph: \"This study examines how peer feedback changes revision quality.\"",
  },
  {
    type: 8,
    placeholderKey: "assessmentResult",
    placeholderLabel: "Assessment result",
    placeholderType: "text",
    placeholderDescription: "Saved rubric from the assessment sidebar for this document and step.",
    placeholderExample:
      '{"clarity":{"currentScore":3,"assessment":"Good structure but weak conclusion"},"sources":{"currentScore":2,"assessment":"Missing one reference"}}',
  },
  {
    type: 8,
    placeholderKey: "inlineComments",
    placeholderLabel: "Inline comments",
    placeholderType: "text",
    placeholderDescription: "Structured comments and annotations for this document and step.",
    placeholderExample:
      '[{"page":2,"quote":"Baseline is unclear","comment":"Please define baseline.","tag":"MajorIssue"},{"page":4,"quote":"Table 2","comment":"Nice comparison.","tag":"Strength"}]',
  },
  {
    type: 8,
    placeholderKey: "nlpAssessmentSuggestion",
    placeholderLabel: "NLP assessment suggestion",
    placeholderType: "text",
    placeholderDescription: "Model draft assessment for this step if available.",
    placeholderExample:
      '[{"name":"clarity","score":3,"justification":"Clear flow with minor issues"},{"name":"sources","score":2,"justification":"Some claims lack citations"}]',
  },
  {
    type: 8,
    placeholderKey: "previousAssessmentResult",
    placeholderLabel: "Previous assessment result",
    placeholderType: "text",
    placeholderDescription: "Saved rubric from the previous step when carry-over is configured.",
    placeholderExample:
      '{"clarity":{"currentScore":2,"assessment":"Argumentation was fragmented"},"sources":{"currentScore":2,"assessment":"References were incomplete"}}',
  },
  {
    type: 8,
    placeholderKey: "assessmentConfiguration",
    placeholderLabel: "Assessment configuration",
    placeholderType: "text",
    placeholderDescription: "Assessment rubric configuration used in this step.",
    placeholderExample:
      '{"type":"assessment","rubrics":[{"name":"overall","criteria":[{"name":"clarity","maxPoints":5},{"name":"sources","maxPoints":5}]}]}',
  },
  {
    type: 8,
    placeholderKey: "submissionFiles",
    placeholderLabel: "Submission file",
    placeholderType: "text",
    placeholderDescription: "Text extracted from a mapped submission file (PDF, TeX, etc.).",
    placeholderExample:
      "Submission File: Chapter 1 — Introduction\n\nThis thesis presents a user study on collaborative reading platforms. " +
      "Participants annotated shared PDFs over three weekly sessions.",
  },
  {
    type: 8,
    placeholderKey: "studyContext",
    placeholderLabel: "Study context",
    placeholderType: "text",
    placeholderDescription: "Basic metadata from current study, step, and document context.",
    placeholderExample:
      '{"studyName":"Peer Review Pilot","stepName":"Essay feedback","documentTitle":"Draft essay v2.pdf"}',
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
