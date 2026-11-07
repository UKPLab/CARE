/**
 * Seed data for the assessment management prototype.
 *
 * Derived from the Exposé assessment/feedback configurations. Relationships are
 * stored as ordered id lists (assessment.rubricIds, rubric.criterionIds) so a
 * criterion shared by several rubrics exists exactly once.
 *
 * @author Eyad Mohamed
 */

/**
 * @returns {{assessments: Array, rubrics: Array, criteria: Array}} A fresh copy of the seed data
 */
export function createSeedData() {
  const criteria = [
    {
      id: 1, code: "LA1", name: "Language quality", description: "Evaluation of linguistic accuracy and sentence clarity",
      minPoints: 0, maxPoints: 2, gradingFunction: "auto_grading", subjective: true, expertLevel: 1,
      scoring: [
        { points: 0, description: "many linguistic errors (e.g. wrong tense, wrong personal pronouns)" },
        { points: 1, description: "few linguistic errors, clear and comprehensible sentences" },
        { points: 2, description: "no linguistic errors, clear and comprehensible sentences with consistent terminology" },
      ],
    },
    {
      id: 2, code: "LA2", name: "Common Thread", description: "Assessment of structural continuity and coherence throughout the text",
      minPoints: 0, maxPoints: 2, gradingFunction: "auto_grading", subjective: true, expertLevel: 1,
      scoring: [
        { points: 0, description: "No recognizable common thread, the structure is unclear and jumpy" },
        { points: 1, description: "Partly recognizable, but the structure is not continuous" },
        { points: 2, description: "Continuous structure that is easy to follow from beginning to end" },
      ],
    },
    {
      id: 3, code: "MD2", name: "Methodology Relevance", description: "Relevance of the chosen methodology to the research question",
      minPoints: 0, maxPoints: 1, gradingFunction: "auto_grading", subjective: true, expertLevel: 1,
      scoring: [
        { points: 0, description: "Methodology is not relevant to the research question" },
        { points: 1, description: "Methodology is relevant and justified" },
      ],
    },
    {
      id: 4, code: "MD7", name: "Methodology Details", description: "Level of detail in the description of the methodology",
      minPoints: 0, maxPoints: 1, gradingFunction: "auto_grading", subjective: true, expertLevel: 2,
      scoring: [
        { points: 0, description: "Methodology is described superficially" },
        { points: 1, description: "Methodology is described in sufficient detail to be reproduced" },
      ],
    },
    {
      id: 5, code: "BI1", name: "Citation consistency", description: "Consistency of citation style across the bibliography",
      minPoints: 0, maxPoints: 1, gradingFunction: "auto_grading", subjective: false, expertLevel: 0,
      scoring: [
        { points: 0, description: "Citation style is inconsistent" },
        { points: 1, description: "Citation style is consistent throughout" },
      ],
    },
    {
      id: 6, code: "ER1", name: "Neglect", description: "Assesses whether important details have been overlooked",
      minPoints: -2, maxPoints: 0, gradingFunction: "auto_grading", subjective: true, expertLevel: 2,
      scoring: [
        { points: 0, description: "All important details have been considered" },
        { points: -1, description: "Important details have been overlooked" },
        { points: -2, description: "Most important details have been overlooked" },
      ],
    },
    {
      id: 7, code: "ST2", name: "Number of pages", description: "Checks that the document meets the page limit",
      minPoints: 0, maxPoints: 1, gradingFunction: "check_pdf_pages", subjective: false, expertLevel: 0,
      scoring: [
        { points: 0, description: "Page limit not met" },
        { points: 1, description: "Page limit met" },
      ],
    },
    {
      id: 8, code: "AD1", name: "Additional points", description: "Extra points for outstanding work",
      minPoints: 0, maxPoints: 2, gradingFunction: "manual_grading", subjective: true, expertLevel: 1,
      scoring: [
        { points: 0, description: "No additional strengths identified" },
        { points: 1, description: "Notable additional strengths" },
        { points: 2, description: "Exceptional additional strengths" },
      ],
    },
    {
      id: 9, code: "AD2", name: "Negative points", description: "Deduction for major mistakes",
      minPoints: -2, maxPoints: 0, gradingFunction: "manual_grading", subjective: true, expertLevel: 1,
      scoring: [
        { points: 0, description: "No major mistakes" },
        { points: -1, description: "Major mistake" },
        { points: -2, description: "Several major mistakes" },
      ],
    },
  ];

  const rubrics = [
    { id: 1, code: "LA", name: "Language / Quality", description: "Assessment of linguistic quality and coherence.", minPoints: 0, maxPoints: 4, calculation: "sum", defaultPoints: null, isBonus: false, criterionIds: [1, 2] },
    { id: 2, code: "MD", name: "Methodology", description: "Assessment of the methodological approach.", minPoints: 0, maxPoints: 5, calculation: "min", defaultPoints: null, isBonus: false, criterionIds: [3, 4] },
    { id: 3, code: "ER", name: "Errors", description: "Deductions for errors in the feedback.", minPoints: 0, maxPoints: 4, calculation: "max", defaultPoints: 4, isBonus: false, criterionIds: [6] },
    { id: 4, code: "WQ", name: "Writing Quality", description: "Overall writing quality of a paper.", minPoints: 0, maxPoints: 3, calculation: "sum", defaultPoints: null, isBonus: false, criterionIds: [1, 5] },
    { id: 5, code: "AD", name: "Additional points", description: "Bonus or deduction for exceptional or flawed work.", minPoints: -2, maxPoints: 2, calculation: "sum", defaultPoints: null, isBonus: true, criterionIds: [8, 9] },
  ];

  const assessments = [
    { id: 1, name: "Exposé Assessment", description: "Assessment of student research exposés and their academic quality.", version: "1.0.0", rubricIds: [1, 2] },
    { id: 2, name: "Exposé Feedback", description: "Evaluation of feedback provided by reviewers.", version: "1.0.0", rubricIds: [3] },
    { id: 3, name: "Research Paper Assessment", description: "Assessment of written research papers.", version: "1.0.0", rubricIds: [1, 4] },
  ];

  return { assessments, rubrics, criteria };
}
