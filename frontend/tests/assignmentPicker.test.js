import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {fileURLToPath, pathToFileURL} from "node:url";
import vue from "@vitejs/plugin-vue";
import {Window} from "happy-dom";
import {build} from "vite";

const APP_ENTRY_STUB = "virtual:care-app-entry";
const ROWS = [
  {id: 1, userId: 5, userName: "owner", createdAt: "2026-01-01T00:00:00.000Z"},
  {id: 3, userId: 6, userName: "group", parentSubmissionId: 2, createdAt: "2026-01-02T00:00:00.000Z"},
];
const HIDDEN_COPY = {id: 4, userId: 5, userName: "owner", parentSubmissionId: 1, hideInFrontend: true};

/**
 * Bundle the real picker, with BackendTable and its pagination, into one module node can import.
 * @returns {Promise<string>} path of the bundle
 */
async function bundlePicker() {
  const src = fileURLToPath(new URL("../src", import.meta.url));
  const [{output}] = [await build({
    configFile: false,
    logLevel: "silent",
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [vue(), {
      // assets/utils.js reads i18n from the app entry, which would start the whole app.
      name: "stub-app-entry",
      enforce: "pre",
      resolveId: (id) => (id.endsWith("/main.js") ? APP_ENTRY_STUB : null),
      load: (id) => (id === APP_ENTRY_STUB ? "export const i18n = {global: {t: (key) => key, te: () => false}};" : null),
    }],
    resolve: {alias: {"@": src}},
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    build: {
      write: false,
      minify: false,
      lib: {entry: fileURLToPath(new URL("./assignmentPicker.entry.js", import.meta.url)), formats: ["es"]},
    },
  })].flat();
  const chunk = output.find((item) => item.type === "chunk" && item.isEntry);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "care-picker-")), "picker.mjs");
  fs.writeFileSync(file, chunk.code);
  return file;
}

test("the real picker asks for its scope, renders the answer and keeps hidden live rows out", async (t) => {
  const window = new Window({url: "http://localhost/"});
  const domGlobals = {
    window,
    document: window.document,
    SVGElement: window.SVGElement,
    Element: window.Element,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
    HTMLAnchorElement: window.HTMLAnchorElement,
    ResizeObserver: window.ResizeObserver,
    IntersectionObserver: window.IntersectionObserver,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
  };
  Object.assign(globalThis, domGlobals);
  t.after(async () => {
    await window.happyDOM.close();
    Object.keys(domGlobals).forEach((name) => delete globalThis[name]);
  });

  const bundle = await bundlePicker();
  t.after(() => fs.rmSync(path.dirname(bundle), {recursive: true, force: true}));
  const {AssignmentSelectionStep, createApp, h, nextTick} = await import(pathToFileURL(bundle));
  const settle = async () => {
    for (let i = 0; i < 5; i++) {
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };

  const requests = [];
  const handlers = {};
  const socket = {
    connected: true,
    id: "picker",
    on: (event, handler) => { handlers[event] = handler; },
    off: (event) => { delete handlers[event]; },
    timeout: () => ({emit: (event, payload, acknowledge) => socket.emit(event, payload, (res) => acknowledge(null, res))}),
    // The server's answer depends on the scope: without it the hidden copy comes back.
    emit: (event, payload, acknowledge) => {
      if (event !== "queryTable") return;
      requests.push(payload);
      const items = payload.scope?.assignmentBulk ? ROWS : [...ROWS, HIDDEN_COPY];
      acknowledge({
        success: true,
        data: {
          items,
          meta: {
            total: items.length,
            pageSize: payload.query.limit,
            totalPages: 1,
            offset: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      });
    },
  };

  const selections = [];
  const step = {
    provide: {assignmentType: "submission", bulk: true, targetWorkflowId: null},
    render: () => h(AssignmentSelectionStep, {
      "onUpdate:selection": (selection) => selections.push(selection),
    }),
  };
  const app = createApp(step);
  Object.assign(app.config.globalProperties, {
    $t: (key) => key,
    $socket: socket,
    $store: {getters: {
      "auth/checkRight": () => true,
      "table/assignment/getAll": [],
      "table/document/getFiltered": () => [],
      "admin/getSystemRoles": [],
    }},
    $route: {query: {}},
    eventBus: {on() {}, off() {}, emit() {}},
  });
  app.config.warnHandler = () => {};
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  app.mount(host);
  t.after(() => app.unmount());
  await settle();

  assert.deepEqual(requests.at(-1).scope, {assignmentBulk: true}, "the query carries the assignment scope");
  const ids = () => [...host.querySelectorAll("tbody tr")]
    .map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()).find(Boolean));
  assert.deepEqual(ids(), ["1", "3"], "rows are the ones the scoped query returned");

  handlers.submissionDelta({operation: "create", row: HIDDEN_COPY, originSocketId: "other"});
  await settle();
  assert.deepEqual(ids(), ["1", "3"], "a hidden copy arriving live stays out");
  assert.equal(host.querySelector(".pending-inserts-banner"), null, "and it does not announce new rows");

  host.querySelector("thead input[type=checkbox]").click();
  await settle();
  const selection = selections.at(-1);
  assert.equal(selection.allMatching, true);
  assert.equal(selection.count, ROWS.length, "select-all counts the eligible rows");
});
