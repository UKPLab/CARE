/**
 * Assessment keyboard interaction — specification machine for CARE issue #220.
 *
 * This machine is a SPECIFICATION, not a runtime controller. The Vue components
 * keep owning `isEditing` / `isSaved`; the handlers in AssessmentCriteria.vue,
 * AssessmentRubric.vue and Assessment.vue are written by hand to match this file.
 *
 * Three orthogonal regions (Harel AND-composition):
 *   field    — what one criterion's editor is doing
 *   position — which rubric/criterion is expanded
 *   save     — the documentDataSave round trip (one per assessment)
 *
 * Focus location is context, not a fourth region: 4 field states x 7 focus
 * locations would be unreadable, and focus is checked by the oracle at every
 * step instead.
 *
 * Sneak paths (events that can arrive but have no designed transition) are NOT
 * expressible in XState as distinct from "unhandled". They are exported
 * separately as `sneakPaths` so the manual test checklist can include them.
 */

import { setup } from "xstate";

export const assessmentKeyboardMachine = setup({
  guards: {
    notReadOnly: ({ context }) => !context.readOnly,
    focusOnHeader: ({ context }) => context.focusOn === "header",
    focusOnPen: ({ context }) => context.focusOn === "pen",
    focusOnFloppy: ({ context }) => context.focusOn === "floppy",
    serverSaysSaved: ({ event }) => event.isSaved === true,
    hasNextCriterion: ({ context }) => context.criterionIndex + 1 < context.criteriaInRubric,
    hasNextRubric: ({ context }) => context.rubricIndex + 1 < context.rubricCount,
  },
  actions: {
    focusTextarea: () => {},
    focusPen: () => {},
    focusFloppy: () => {},
    focusNextHeader: () => {},
    focusNextStepControl: () => {},
    commitText: () => {},          // saveEdit
    discardText: () => {},         // cancelEdit
    markDone: () => {},            // saveAssessment + emit saved-and-next
    uncompleteStep: () => {},      // forcedAssessment side effect of commitText
    showSaveFailedToast: () => {}, // the one thing we add in the save region
    // existing CARE behaviour we model but do not fix:
    leaveIsEditingTrue: () => {},
    discardTypingOnReload: () => {},
    overwriteSaveSnapshot: () => {},
    reloadAllFromServer: () => {},
  },
}).createMachine({
  id: "assessmentKeyboard",
  type: "parallel",
  context: {
    readOnly: false,
    forcedAssessment: false,
    focusOn: "none", // header | pen | floppy | textarea | cancel | none
    criterionIndex: 0,
    criteriaInRubric: 1,
    rubricIndex: 0,
    rubricCount: 1,
  },
  states: {
    /* ---------------------------------------------------------- field --- */
    field: {
      initial: "collapsed",
      states: {
        collapsed: {
          // sneak: CTRL_ENTER, SHIFT_ENTER, ESCAPE, BLUR, COLLAPSE
          on: {
            EXPAND: { target: "read" },
            ENTER: { target: "read", guard: "focusOnHeader" },
            SPACE: { target: "read", guard: "focusOnHeader" },
            RELOAD: [
              { target: "done", guard: "serverSaysSaved" },
              { target: "read" },
            ],
          },
        },

        read: {
          // sneak: EXPAND, CTRL_ENTER, SHIFT_ENTER, ESCAPE, BLUR
          on: {
            COLLAPSE: { target: "collapsed" },
            EDIT: { target: "editing", guard: "notReadOnly", actions: "focusTextarea" },
            MARK_DONE: { target: "done", guard: "notReadOnly", actions: "markDone" },
            ENTER: [
              { target: "collapsed", guard: "focusOnHeader" },
              { target: "editing", guard: "focusOnPen", actions: "focusTextarea" },
              { target: "done", guard: "focusOnFloppy", actions: "markDone" },
            ],
            SPACE: [
              { target: "collapsed", guard: "focusOnHeader" },
              { target: "editing", guard: "focusOnPen", actions: "focusTextarea" },
              { target: "done", guard: "focusOnFloppy", actions: "markDone" },
            ],
            RELOAD: [
              { target: "done", guard: "serverSaysSaved" },
              { target: "read" },
            ],
          },
        },

        editing: {
          // sneak: EXPAND only. COLLAPSE and RELOAD change state, so they are
          // transitions with harmful side effects, not ignores.
          on: {
            COLLAPSE: { target: "collapsed", actions: "leaveIsEditingTrue" },
            RELOAD: [
              { target: "done", guard: "serverSaysSaved", actions: "discardTypingOnReload" },
              { target: "read", actions: "discardTypingOnReload" },
            ],
            TYPE: { target: "editing" },
            ENTER: { target: "editing" },        // native newline, no preventDefault
            SHIFT_ENTER: { target: "editing" },  // native newline
            SPACE: { target: "editing" },        // native space
            BLUR: { target: "editing" },         // text stays uncommitted
            CTRL_ENTER: {
              target: "read",
              guard: "notReadOnly",
              actions: ["commitText", "focusFloppy", "uncompleteStep"],
            },
            ESCAPE: {
              target: "read",
              actions: ["discardText", "focusPen"],
            },
          },
        },

        done: {
          // sneak: EXPAND, CTRL_ENTER, SHIFT_ENTER, ESCAPE, BLUR
          on: {
            COLLAPSE: { target: "collapsed" },
            EDIT: { target: "editing", guard: "notReadOnly", actions: "focusTextarea" },
            MARK_DONE: { target: "done", guard: "notReadOnly", actions: "markDone" },
            ENTER: [
              { target: "collapsed", guard: "focusOnHeader" },
              { target: "editing", guard: "focusOnPen", actions: "focusTextarea" },
              { target: "done", guard: "focusOnFloppy", actions: "markDone" },
            ],
            SPACE: [
              { target: "collapsed", guard: "focusOnHeader" },
              { target: "editing", guard: "focusOnPen", actions: "focusTextarea" },
              { target: "done", guard: "focusOnFloppy", actions: "markDone" },
            ],
            RELOAD: [
              { target: "done", guard: "serverSaysSaved" },
              { target: "read" },
            ],
          },
        },
      },
    },

    /* ------------------------------------------------------- position --- */
    position: {
      initial: "noRubric", // expandedGroups starts as {}
      states: {
        noRubric: {
          // sneak: CLOSE_RUBRIC
          on: {
            OPEN_RUBRIC: { target: "criterionMid" }, // auto-opens criterion 0
            RELOAD: { target: "noRubric" },
          },
        },

        rubricNoCriterion: {
          // reached only after a rubric is completed (index set to null)
          // sneak: CLOSE_CRITERION
          on: {
            OPEN_RUBRIC: { target: "rubricNoCriterion" },
            CLOSE_RUBRIC: { target: "noRubric" },
            OPEN_CRITERION: [
              { target: "criterionMid", guard: "hasNextCriterion" },
              { target: "criterionLastInRubric", guard: "hasNextRubric" },
              { target: "criterionLastOverall" },
            ],
            RELOAD: { target: "rubricNoCriterion" },
          },
        },

        criterionMid: {
          on: {
            OPEN_RUBRIC: { target: "criterionMid" },
            CLOSE_RUBRIC: { target: "noRubric" },
            OPEN_CRITERION: { target: "criterionMid" },
            CLOSE_CRITERION: { target: "rubricNoCriterion" },
            ADVANCE: [
              { target: "criterionMid", guard: "hasNextCriterion", actions: "focusNextHeader" },
              { target: "criterionLastInRubric", guard: "hasNextRubric", actions: "focusNextHeader" },
              { target: "criterionLastOverall", actions: "focusNextHeader" },
            ],
            RELOAD: { target: "criterionMid" },
          },
        },

        criterionLastInRubric: {
          on: {
            OPEN_RUBRIC: { target: "criterionMid" },
            CLOSE_RUBRIC: { target: "noRubric" },
            OPEN_CRITERION: { target: "criterionMid" },
            CLOSE_CRITERION: { target: "rubricNoCriterion" },
            // emits focus-next-rubric; next rubric opens at its criterion 0
            ADVANCE: { target: "criterionMid", actions: "focusNextHeader" },
            RELOAD: { target: "criterionLastInRubric" },
          },
        },

        criterionLastOverall: {
          on: {
            OPEN_RUBRIC: { target: "criterionMid" },
            CLOSE_RUBRIC: { target: "noRubric" },
            OPEN_CRITERION: { target: "criterionMid" },
            CLOSE_CRITERION: { target: "rubricNoCriterion" },
            // everything collapses (Assessment.vue:608)
            ADVANCE: { target: "noRubric", actions: "focusNextStepControl" },
            RELOAD: { target: "criterionLastOverall" },
          },
        },
      },
    },

    /* ----------------------------------------------------------- save --- */
    save: {
      initial: "idle",
      states: {
        idle: {
          // sneak: ECHO_MATCH (guard at Assessment.vue:296 requires the flag)
          on: {
            SAVE_REQUESTED: { target: "saving" },
            ECHO_MISMATCH: { target: "idle" }, // falls through to reload
          },
        },

        saving: {
          // sneak: RETRY only. The two below change something, so they are
          // transitions with harmful side effects, not ignores.
          on: {
            ACK_OK: { target: "saving" }, // flag waits for the echo, not the ack
            ACK_FAIL: { target: "failed", actions: "showSaveFailedToast" },
            ECHO_MATCH: { target: "idle" },
            SAVE_REQUESTED: { target: "saving", actions: "overwriteSaveSnapshot" },
            ECHO_MISMATCH: { target: "saving", actions: "reloadAllFromServer" },
          },
        },

        failed: {
          // sneak: ACK_OK (late ack), ACK_FAIL (no second toast), ECHO_MISMATCH
          on: {
            SAVE_REQUESTED: { target: "saving" }, // next user action retries implicitly
            ECHO_MATCH: { target: "idle" },       // a foreign save happened to match
          },
        },
      },
    },
  },
});

/**
 * Sneak paths: events that can reach a state, have no designed behaviour, AND
 * change nothing observable. If the state changes or data is touched it is a
 * transition - even a harmful, unintended one - and it belongs in the machine
 * above, not here.
 *
 * Expected result is "nothing observable changes" — which still has to be
 * tested, because doing nothing is not the same as having no handler.
 */
export const sneakPaths = [
  { region: "field", state: "collapsed", events: ["CTRL_ENTER", "SHIFT_ENTER", "ESCAPE", "BLUR", "COLLAPSE"] },
  { region: "field", state: "read", events: ["EXPAND", "CTRL_ENTER", "SHIFT_ENTER", "ESCAPE", "BLUR"] },
  { region: "field", state: "editing", events: ["EXPAND"] },
  { region: "field", state: "done", events: ["EXPAND", "CTRL_ENTER", "SHIFT_ENTER", "ESCAPE", "BLUR"] },
  { region: "position", state: "noRubric", events: ["CLOSE_RUBRIC"] },
  { region: "position", state: "rubricNoCriterion", events: ["CLOSE_CRITERION"] },
  { region: "save", state: "idle", events: ["ECHO_MATCH"] },
  { region: "save", state: "saving", events: ["RETRY"] },
  { region: "save", state: "failed", events: ["ACK_OK", "ACK_FAIL", "ECHO_MISMATCH"] },
];

/**
 * The six things the oracle checks after every transition.
 */
export const observables = [
  "textarea present in DOM",
  "which element has focus",
  "isEditing / isSaved pair",
  "which buttons are rendered",
  "badge colour (grey / green)",
  "whether a documentDataSave went out (Socket Profiler)",
];
