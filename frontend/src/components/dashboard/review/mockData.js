export const mockValidators = [
  {
    id: 1,
    name: "LaTex Template",
    description: "Full template with figures and sections",
    files: ["main.tex", "references.bib", "template.json", "figures/", "sections/"],
  },
  {
    id: 2,
    name: "Exposé Template",
    description: "Thesis-specific validation rules",
    files: ["thesis.tex", "abstract.tex", "chapters/", "bibliography.bib"],
  },
];

export const mockAssignments = [
  {
    userid: 12345,
    submissionURLs: [
      {
        filename: "EiwA_Template_25_26.pdf",
        fileurl:
          "https://moodle.informatik.tu-darmstadt.de/webservice/pluginfile.php/307653/assignsubmission_file/submission_files/1220915/EiwA_Template_25_26.pdf?token=REDACTED_SECRET",
      },
      {
        filename: "EiwA_Template_25_26_revision1.pdf",
        fileurl:
          "https://moodle.informatik.tu-darmstadt.de/webservice/pluginfile.php/307653/assignsubmission_file/submission_files/1220915/EiwA_Template_25_26_revision1.pdf?token=REDACTED_SECRET",
      },
      {
        filename: "EiwA_Template_25_26_revision2.pdf",
        fileurl:
          "https://moodle.informatik.tu-darmstadt.de/webservice/pluginfile.php/307653/assignsubmission_file/submission_files/1220915/EiwA_Template_25_26_revision2.pdf?token=REDACTED_SECRET",
      },
      {
        filename: "UKP Expose Template (v4.01).zip",
        fileurl:
          "https://moodle.informatik.tu-darmstadt.de/webservice/pluginfile.php/307653/assignsubmission_file/submission_files/1220915/UKP%20Expose%20Template%20%28v4.01%29.zip?token=REDACTED_SECRET",
      },
    ],
  },
];
