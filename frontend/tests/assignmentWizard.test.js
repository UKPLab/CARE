import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
import {Window} from "happy-dom";
import {parse} from "vue/compiler-sfc";

const STEP_DIR = fileURLToPath(new URL("../src/components/dashboard/study/assignment", import.meta.url));

/**
 * Load a single-file component's options, without its imports.
 * @param {string} file component file name
 * @returns {{options: Object, template: string}}
 */
function loadComponent(file) {
  const {descriptor} = parse(fs.readFileSync(path.join(STEP_DIR, file), "utf8"));
  const script = descriptor.script.content
    .replace(/^import [\s\S]*?;\s*$/gm, "")
    .replace("export default", "module.exports =");
  const module = {exports: {}};
  vm.runInNewContext(script, {module, BasicForm: {}, BasicTable: {}, BackendTable: {}});
  return {options: module.exports, template: descriptor.template.content};
}

const distributionStep = loadComponent("DistributionStep.vue");
const distribution = distributionStep.options;

/**
 * Evaluate the wizard's review count.
 * @param {Object} state component state
 * @returns {number}
 */
function numberOfReviews(state) {
  return distribution.computed.numberOfReviews.call({
    assignmentCount: 0,
    selectedAssignments: [],
    roleSelection: {},
    reviewerSelection: {},
    ...state,
  });
}

const threeSessionsOfTwoOwners = [{id: 11, userId: 77}, {id: 12, userId: 77}, {id: 13, userId: 88}];

test("session_user counts sessions, not owners", () => {
  assert.equal(numberOfReviews({
    reviewerSelectionMode: {mode: "session_user"},
    selectedAssignments: threeSessionsOfTwoOwners,
  }), 3);
});

test("session_user counts an all-matching selection that has no loaded rows", () => {
  assert.equal(numberOfReviews({
    reviewerSelectionMode: {mode: "session_user"},
    assignmentCount: 3,
  }), 3);
});

test("session_user ignores leftovers from the other modes", () => {
  assert.equal(numberOfReviews({
    reviewerSelectionMode: {mode: "session_user"},
    assignmentCount: 3,
    reviewerSelection: {77: 1},
    roleSelection: {5: 2},
  }), 3);
});

test("role mode still multiplies the reviews per role by the selection", () => {
  assert.equal(numberOfReviews({
    reviewerSelectionMode: {mode: "role"},
    selectedAssignments: threeSessionsOfTwoOwners,
    roleSelection: {5: 2, 6: 1},
  }), 9);
});

test("manual mode still sums the reviewers' allocations", () => {
  assert.equal(numberOfReviews({
    reviewerSelectionMode: {mode: "reviewer"},
    assignmentCount: 3,
    reviewerSelection: {77: 1, 88: 2},
  }), 3);
});

test("without a mode nothing is counted", () => {
  assert.equal(numberOfReviews({reviewerSelectionMode: {}, assignmentCount: 3}), 0);
});

test("the count reaches the modal each time the stepper mounts the step", async () => {
  const window = new Window();
  const domGlobals = {window, document: window.document, SVGElement: window.SVGElement, Element: window.Element};
  Object.assign(globalThis, domGlobals);
  // Vue's DOM runtime reads the global document when it loads.
  const {compile, computed, createApp, h, nextTick, ref} = createRequire(import.meta.url)("vue");

  const component = {
    ...distribution,
    components: {BasicForm: {render: () => null}},
    render: compile(distributionStep.template),
  };
  const shown = ref(true);
  const selection = ref(threeSessionsOfTwoOwners);
  const emitted = [];
  const app = createApp({
    provide: {selectedAssignments: computed(() => selection.value)},
    render: () => (shown.value ? h(component, {
      modalValue: {reviewerSelectionMode: {mode: "session_user"}},
      "onUpdate:numberOfReviews": (count) => emitted.push(count),
    }) : null),
  });
  app.config.globalProperties.$t = (key) => key;
  const host = window.document.createElement("div");

  try {
    app.mount(host);
    assert.deepEqual(emitted, [3]);

    shown.value = false;
    await nextTick();
    selection.value = threeSessionsOfTwoOwners.slice(0, 2);
    shown.value = true;
    await nextTick();
    assert.deepEqual(emitted, [3, 2]);
  } finally {
    app.unmount();
    await window.happyDOM.close();
    Object.keys(domGlobals).forEach((name) => delete globalThis[name]);
  }
});

test("the submission picker sends the assignment scope and keeps hidden live rows out", () => {
  const {options, template} = loadComponent("AssignmentSelectionStep.vue");
  assert.match(template, /table="submission"[\s\S]*?:query-scope="submissionQueryScope"/);
  assert.match(template, /table="submission"[\s\S]*?:query-scope-matcher="isSubmissionInScope"/);
  assert.equal(options.computed.submissionQueryScope().assignmentBulk, true);
  assert.equal(options.methods.isSubmissionInScope({hideInFrontend: true}), false);
  assert.equal(options.methods.isSubmissionInScope({hideInFrontend: false}), true);
});
