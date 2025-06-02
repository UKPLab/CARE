export const testData = {
  name: "Test 1 ",
  workflowId: 2,
  stepDocuments: [
    {
      id: 5,
      documentId: 4,
    },
    {
      id: 6,
      documentId: 8,
      configuration: {
        services: [
          {
            name: "nlpEditComparison",
            type: "nlpRequest",
            skill: "skill_eic",
            inputs: {
              v1: {
                stepId: 1,
                dataSource: "firstVersion",
              },
              v2: {
                stepId: 1,
                dataSource: "currentVersion",
              },
            },
          },
        ],
        placeholders: {
          text: [
            {
              input: {
                stepId: 1,
                dataSource: "firstVersion",
              },
            },
            {
              input: {
                stepId: 1,
                dataSource: "currentVersion",
              },
            },
          ],
          chart: [
            {
              input: {
                stepId: 1,
                dataSource: "currentVersion",
              },
            },
          ],
          comparison: [],
        },
      },
    },
    {
      id: 7,
      documentId: 6,
    },
    {
      id: 8,
      documentId: 7,
      configuration: {
        services: [
          {
            name: "nlpEditComparison",
            type: "nlpRequest",
            skill: "skill_eic",
            inputs: {
              v1: {
                stepId: 1,
                dataSource: "firstVersion",
              },
              v2: {
                stepId: 1,
                dataSource: "firstVersion",
              },
            },
          },
        ],
        placeholders: {
          text: [
            {
              input: {
                stepId: 3,
                dataSource: "firstVersion",
              },
            },
            {
              input: {
                stepId: 3,
                dataSource: "firstVersion",
              },
            },
          ],
          chart: [
            {
              input: {
                stepId: 3,
                dataSource: "firstVersion",
              },
            },
          ],
          comparison: [],
        },
      },
    },
  ],
  description: "<p>Some random study</p>",
  timeLimit: 0,
  limitSessions: 0,
  limitSessionsPerUser: 0,
  collab: false,
  anonymize: false,
  resumable: false,
  multipleSubmit: false,
  start: null,
  end: null,
  id: 2,
};
