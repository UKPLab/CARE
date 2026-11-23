import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import { installDiagnostics, getDiagnostics, clearDiagnostics } from '../src/assets/diagnostics.js';
import { clearActivity, describeElement, getActivity, recordActivity } from '../src/assets/activityTrail.js';
import BehaviorLogger from '../src/assets/behaviorLogger.js';

const SECRET = 'Private document draft';

/**
 * Minimal DOM element for the activity trail: it must never read id, class, name or text.
 */
const element = (tagName, attributes = {}, extra = {}) => ({
  tagName,
  id: `id-${SECRET}`,
  className: SECRET,
  name: SECRET,
  textContent: SECRET,
  innerText: SECRET,
  value: SECRET,
  getAttribute: (name) => (name in attributes ? attributes[name] : null),
  ...extra,
});

/** Run fn with window/document stubs that record listeners. */
function withBrowser(fn) {
  const previous = { window: globalThis.window, document: globalThis.document };
  const listeners = { document: {}, window: {} };
  const target = (name) => ({
    addEventListener: (event, handler) => { listeners[name][event] = handler; },
    removeEventListener: (event) => { delete listeners[name][event]; },
  });
  globalThis.window = {
    ...target('window'),
    location: { pathname: '/document/abc' },
    scrollX: 0,
    scrollY: 300,
    screen: { width: 1920, height: 1080 },
  };
  globalThis.document = { ...target('document'), hidden: false };
  try {
    return fn(listeners);
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
  }
}

test('diagnostics omit document text in errors and request payloads', () => {
  const listeners = {};
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener: (name, handler) => { listeners[name] = handler; } };
  const app = { config: { errorHandler() {} } };
  const socket = {
    emit(_event, _payload, callback) { callback({ success: false, key: 'errors.save', errorId: 'safe-id' }); },
    on() {},
  };
  try {
    installDiagnostics(app, socket, { afterEach() {} });
    listeners.error({ message: SECRET, filename: 'https://care.test/app.js?token=secret', lineno: 1 });
    listeners.unhandledrejection({ reason: new Error(SECRET) });
    app.config.errorHandler(new Error(SECRET), null, 'render');
    socket.emit('documentSave', { contents: SECRET }, () => {});
    const saved = JSON.stringify(getDiagnostics());
    assert.ok(!saved.includes(SECRET));
    assert.ok(!saved.includes('token='));
    assert.ok(saved.includes('documentSave'));
    assert.ok(saved.includes('errors.save'));
  } finally {
    globalThis.window = previousWindow;
  }
});

test('activity trail keeps structural element metadata only', () => {
  withBrowser(() => {
    clearActivity();
    const input = element('INPUT', { role: 'textbox' }, { type: 'text' });
    const path = [input, element('LABEL'), element('FORM'), element('BODY'), element('HTML'), globalThis.document];
    recordActivity('click', { target: input, clientX: 10.4, clientY: 20.6, composedPath: () => path }, 1000);
    recordActivity('navigation', { path: '/reset?token=secret#x' }, 1000);
    recordActivity('keydown', { key: 'a' }, 1000);

    const activity = getActivity({ maxEntries: 10, maxAgeMinutes: 10 });
    assert.equal(activity.length, 2);
    assert.deepEqual(activity[0].element, { tag: 'input', role: 'textbox', inputType: 'text', ancestors: ['label', 'form'] });
    assert.equal(activity[0].x, 10);
    assert.equal(activity[0].path, '/document/abc');
    assert.equal(activity[1].path, '/reset');
    const text = JSON.stringify(activity);
    assert.ok(!text.includes(SECRET));
    assert.ok(!text.includes('token'));
    // A role that is not on the allow list is dropped
    assert.deepEqual(describeElement(element('DIV', { role: SECRET })), { tag: 'div' });
  });
});

test('activity trail samples mouse moves and scrolling, applies limits and can be cleared', () => {
  withBrowser(() => {
    clearActivity();
    for (let i = 0; i < 50; i++) {
      recordActivity('mouseMove', { clientX: i, clientY: i }, 60000);
      recordActivity('scroll', { target: globalThis.document }, 60000);
    }
    const sampled = getActivity({ maxEntries: 100, maxAgeMinutes: 10 });
    assert.deepEqual(sampled.map((entry) => entry.type), ['mouseMove', 'scroll']);
    assert.equal(sampled[1].scrollY, 300);

    for (let i = 0; i < 5; i++) recordActivity('windowFocus', { focused: i % 2 === 0 }, 1000);
    assert.equal(getActivity({ maxEntries: 3, maxAgeMinutes: 10 }).length, 3);
    assert.equal(getActivity({ maxEntries: 100, maxAgeMinutes: 10 }, Date.now() + 11 * 60 * 1000).length, 0);

    clearActivity();
    assert.deepEqual(getActivity({ maxEntries: 100, maxAgeMinutes: 10 }), []);
  });
});

test('the behavior logger feeds the trail without changing what it sends as statistics', () => {
  withBrowser((listeners) => {
    const sent = [];
    const seen = [];
    const socket = { emit: (event, payload) => sent.push({ event, payload }) };
    const logger = new BehaviorLogger(socket, 10, { onActivity: (type) => seen.push(type) });
    logger.init();
    assert.ok(listeners.document.scroll, 'scroll is only listened to for the trail');
    sent.length = 0;

    const button = element('BUTTON');
    listeners.document.click({ target: { ...button, matches: () => false }, composedPath: () => [button] });
    listeners.document.scroll({ target: globalThis.document });
    logger.reportRouteChange(null, { path: '/dashboard', fullPath: '/dashboard?x=1' });

    assert.deepEqual(seen, ['click', 'scroll', 'navigation']);
    // Clicks outside the allow list are still not sent as statistics; scrolling is never sent
    assert.deepEqual(sent.map((entry) => entry.payload.action), ['routeStep']);

    logger.destroy();
    assert.equal(listeners.document.scroll, undefined);
    assert.equal(listeners.document.click, undefined);

    const plain = new BehaviorLogger(socket, 10);
    plain.init();
    assert.equal(listeners.document.scroll, undefined, 'no extra listener without the trail');
    plain.destroy();
  });
});

/**
 * Load ProblemReportModal's options and build an instance with data, computed getters and methods.
 */
function createModal({ acceptStats = true, activityEnabled = true } = {}) {
  const source = fs.readFileSync(new URL('../src/components/problem_report/ProblemReportModal.vue', import.meta.url), 'utf8');
  const script = parse(source).descriptor.script.content;
  let sequence = 0;
  const calls = { activity: 0 };
  const context = {
    uuid: () => `form-${++sequence}`,
    getDiagnostics: () => [{ type: 'navigation', time: new Date().toISOString(), path: '/x' }],
    getActivity: () => { calls.activity++; return [{ type: 'click', time: new Date().toISOString() }]; },
    buildReportContext: () => ({ page: '/dashboard', reportedAt: new Date().toISOString() }),
    choiceLabel: (_t, _kind, value) => value,
    normalizeAnswers: (form, description, settings) => ({
      problemTypes: settings.problemTypes.filter((type) => form.problemTypes.includes(type)),
      blocked: form.blocked,
      frequency: form.frequency,
      description: description.trim(),
    }),
    readReportSettings: () => ({}),
    resolveApiMessage: (response) => response?.key || '',
    URL: { revokeObjectURL() {} },
    Date,
    Promise,
    setInterval: (callback, interval) => { calls.timer = {callback, interval}; return 1; },
    clearInterval: () => { calls.timer = null; },
  };
  for (const name of ['BasicModal', 'BasicButton', 'BasicForm', 'FormCollapsible', 'ChoiceChips', 'AttachmentPicker', 'ReportSummary', 'ProblemReportFields', 'ProblemReportPreview']) context[name] = {};
  vm.createContext(context);
  vm.runInContext(script.replace(/^import .*;\r?$/gm, '').replace('export default', 'globalThis.component ='), context);
  const component = context.component;
  const previewSource = fs.readFileSync(new URL('../src/components/problem_report/ProblemReportPreview.vue', import.meta.url), 'utf8');
  const previewScript = parse(previewSource).descriptor.script.content;
  vm.runInContext(previewScript.replace(/^import .*;\r?$/gm, '').replace('export default', 'globalThis.previewComponent ='), context);

  const instance = { ...component.methods };
  for (const [name, getter] of Object.entries(component.computed)) {
    Object.defineProperty(instance, name, { get: () => getter.call(instance) });
  }
  Object.assign(instance, component.data.call(instance));
  const preview = { $t: (key) => key, $i18n: { locale: 'en' } };
  for (const key of Object.keys(context.previewComponent.props)) {
    Object.defineProperty(preview, key, { get: () => instance[key] });
  }
  for (const [name, getter] of Object.entries(context.previewComponent.computed)) {
    Object.defineProperty(preview, name, { get: () => getter.call(preview) });
  }
  instance.preview = preview;
  const emitted = [];
  const toasts = [];
  instance.emitted = emitted;
  instance.toasts = toasts;
  instance.calls = calls;
  instance.acceptStats = acceptStats;
  instance.$t = (key) => key;
  instance.$i18n = { locale: 'en' };
  instance.$route = { path: '/dashboard' };
  instance.$store = { getters: { 'settings/getValue': () => null } };
  instance.$socket = {
    timeout: () => ({ emit: (event, payload, callback) => emitted.push({ event, payload, callback }) }),
  };
  instance.$refs = {
    modal: { open() { instance.opened = true; }, close() { instance.opened = false; } },
    fields: { validateDescription: () => instance.description.trim().length > 0, focusDescription() {}, clearErrors() {} },
  };
  instance.eventBus = { emit: (event, payload) => { if (event === 'toast') toasts.push(payload); } };
  instance.effectiveSettings = {
    problemTypes: ['error', 'slowOrStuck'],
    frequencies: [],
    askBlocked: true,
    descriptionMaxLength: 100,
    attachmentTypes: [],
    attachmentsMaxCount: 5,
    activityEnabled,
    activityMaxEntries: 50,
    activityMaxAgeMinutes: 10,
    databaseHealthEnabled: true,
  };
  return instance;
}

const last = (modal, event) => modal.emitted.filter((entry) => entry.event === event).pop();
const prepared = (payload) => ({
  success: true,
  data: {
    context: { ...payload.context, page: payload.context.page },
    diagnostics: payload.diagnostics,
    activity: { status: 'included', entries: payload.activity },
    databaseHealth: { status: 'ok', capturedAt: new Date().toISOString() },
    databaseHealthExpiresInMs: 60 * 60 * 1000,
  },
});

test('opening the form shows the automatic details right away, without answering anything', () => {
  const modal = createModal();
  modal.open();
  last(modal, 'problemReportConfig').callback(null, { success: true, data: modal.effectiveSettings });
  assert.equal(modal.opened, true);
  const prepare = last(modal, 'problemReportPrepare');
  assert.ok(prepare, 'details are requested on open');
  assert.equal(prepare.payload.clientRequestId, modal.clientRequestId);
  assert.equal(modal.preview.detailsState, 'loading');
  assert.equal(modal.preview.detailsStatusText, 'problemReport.details.loading');

  prepare.callback(null, prepared(prepare.payload));
  assert.equal(modal.preview.detailsState, 'ready');
  assert.equal(modal.preview.liveReport.context.page, '/dashboard');
  assert.equal(modal.preview.liveReport.databaseHealth.status, 'ok');
  assert.equal(modal.preview.liveReport.description, '');

  // The answers below the form follow the form as the user types
  modal.descriptionData.problemReportDescription = '  It hangs  ';
  modal.form.problemTypes = ['slowOrStuck'];
  assert.equal(modal.preview.liveReport.description, 'It hangs');
  assert.deepEqual([...modal.preview.liveReport.problemTypes], ['slowOrStuck']);
});

test('a failed details request shows an unavailable state and submit captures details then', async () => {
  const modal = createModal();
  modal.prepareDetails();
  last(modal, 'problemReportPrepare').callback(new Error('timeout'));
  assert.equal(modal.preview.detailsState, 'unavailable');
  assert.equal(modal.preview.detailsStatusText, 'problemReport.details.unavailable');

  modal.form.problemTypes = ['error'];
  modal.descriptionData.problemReportDescription = 'Broken';
  await modal.submit();
  const submit = last(modal, 'problemReportSubmit');
  assert.ok(submit.payload.context, 'details are captured at submit');
  assert.equal(submit.payload.context.page, '/dashboard');
});

test('an older details response never replaces a newer one', () => {
  const modal = createModal();
  modal.prepareDetails();
  const first = last(modal, 'problemReportPrepare');
  modal.prepareDetails();
  const second = last(modal, 'problemReportPrepare');
  second.callback(null, prepared(second.payload));
  first.callback(null, { success: true, data: { ...prepared(first.payload).data, context: { page: '/stale' } } });
  assert.equal(modal.details.payload.context, second.payload.context);
  assert.notEqual(modal.preview.liveReport.context.page, '/stale');
  assert.equal(modal.preparing, false);
});

test('a delayed details response cannot restore a cancelled report', () => {
  const modal = createModal();
  modal.descriptionData.problemReportDescription = 'Original report';
  modal.form.problemTypes = ['error'];
  modal.prepareDetails();
  const pending = last(modal, 'problemReportPrepare');
  const firstId = modal.clientRequestId;
  modal.cancel();
  pending.callback(null, prepared(pending.payload));
  assert.equal(modal.details, null);
  assert.equal(modal.preparing, false);
  assert.notEqual(modal.clientRequestId, firstId);
  assert.equal(modal.description, '');
});

test('submit waits for details, sends exactly the shown snapshot and keeps the report for a safe retry', async () => {
  const modal = createModal();
  modal.form.problemTypes = ['error'];
  modal.descriptionData.problemReportDescription = 'Saving fails';
  modal.prepareDetails();
  await modal.submit();
  assert.equal(last(modal, 'problemReportSubmit'), undefined, 'no submit while details are loading');

  const prepare = last(modal, 'problemReportPrepare');
  prepare.callback(null, prepared(prepare.payload));
  await modal.submit();
  const first = last(modal, 'problemReportSubmit');
  assert.equal(first.payload.clientRequestId, modal.clientRequestId);
  assert.equal(first.payload.context, prepare.payload.context);
  assert.equal(first.payload.diagnostics, prepare.payload.diagnostics);
  assert.equal(first.payload.activity, prepare.payload.activity);
  assert.equal(first.payload.description, 'Saving fails');
  assert.ok(!('databaseHealth' in first.payload), 'database health is never sent by the client');

  // A second click while sending does nothing
  await modal.submit();
  assert.equal(modal.emitted.filter((entry) => entry.event === 'problemReportSubmit').length, 1);

  first.callback(new Error('timeout'));
  assert.equal(modal.description, 'Saving fails');
  assert.equal(modal.toasts.pop().title, 'problemReport.messages.submitFailed');

  await modal.submit();
  const retry = last(modal, 'problemReportSubmit');
  assert.equal(retry.payload.clientRequestId, first.payload.clientRequestId);
  retry.callback(null, { success: true, data: { id: 5 } });
  assert.equal(modal.description, '');
  assert.notEqual(modal.clientRequestId, first.payload.clientRequestId);
  assert.equal(modal.opened, false);
});

test('required answers are validated on submit only', async () => {
  const modal = createModal();
  modal.prepareDetails();
  const prepare = last(modal, 'problemReportPrepare');
  prepare.callback(null, prepared(prepare.payload));
  await modal.submit();
  assert.equal(last(modal, 'problemReportSubmit'), undefined);
  assert.equal(modal.errors.problemTypes, 'errors.problemReport.problemTypeRequired');

  modal.form.problemTypes = ['error'];
  modal.descriptionData.problemReportDescription = 'x'.repeat(101);
  await modal.submit();
  assert.equal(last(modal, 'problemReportSubmit'), undefined);
  assert.equal(modal.errors.descriptionTooLong, 'errors.problemReport.descriptionTooLong');
});

test('expired details are refreshed and shown again before anything is saved', async () => {
  const modal = createModal();
  modal.form.problemTypes = ['error'];
  modal.descriptionData.problemReportDescription = 'Broken';
  modal.prepareDetails();
  const prepare = last(modal, 'problemReportPrepare');
  prepare.callback(null, prepared(prepare.payload));
  modal.details.expiresAt = Date.now() - 1;
  await modal.submit();
  assert.equal(last(modal, 'problemReportSubmit'), undefined);
  assert.equal(modal.detailsNotice, 'problemReport.details.expired');
  assert.notEqual(last(modal, 'problemReportPrepare'), prepare);
});

test('activity is not read without statistics consent', () => {
  const modal = createModal({ acceptStats: false });
  modal.prepareDetails();
  const prepare = last(modal, 'problemReportPrepare');
  assert.equal(modal.calls.activity, 0);
  assert.deepEqual([...prepare.payload.activity], []);
  assert.ok(modal.preview.noticeText.includes('problemReport.notice.noActivity'));

  const consented = createModal({ acceptStats: true });
  consented.prepareDetails();
  assert.equal(consented.calls.activity, 1);
  assert.ok(consented.preview.noticeText.includes('problemReport.notice.activity'));
  assert.ok(!consented.preview.noticeText.includes('problemReport.notice.databaseHealth'));
});

test('withdrawn consent immediately hides activity and excludes it from submission', () => {
  const modal = createModal({ acceptStats: true });
  modal.prepareDetails();
  const prepare = last(modal, 'problemReportPrepare');
  prepare.callback(null, prepared(prepare.payload));
  modal.acceptStats = false;
  assert.equal(modal.preview.liveReport.activity.status, 'noConsent');
  assert.equal(modal.preview.liveReport.activity.entries.length, 0);
  assert.equal(modal.submissionSnapshot().activity.length, 0);
});

test('a server-discarded snapshot refreshes details and keeps the draft', async () => {
  const modal = createModal();
  modal.form.problemTypes = ['error'];
  modal.descriptionData.problemReportDescription = 'Broken';
  modal.prepareDetails();
  const prepare = last(modal, 'problemReportPrepare');
  prepare.callback(null, prepared(prepare.payload));
  await modal.submit();
  const submit = last(modal, 'problemReportSubmit');
  assert.equal(submit.payload.databaseHealthCapturedAt, modal.preview.liveReport.databaseHealth.capturedAt);
  submit.callback(null, {success: false, key: 'errors.problemReport.detailsExpired'});
  assert.equal(modal.description, 'Broken');
  assert.equal(modal.detailsNotice, 'problemReport.details.expired');
  assert.notEqual(last(modal, 'problemReportPrepare'), prepare);
});

test('report details stay fixed at the moment Report is clicked, including retries', () => {
  const modal = createModal();
  assert.equal(modal.detailsExpanded, false);
  modal.open();
  const captured = modal.capturedSnapshot;
  assert.equal(modal.calls.activity, 1);
  last(modal, 'problemReportConfig').callback(null, {success: true, data: modal.effectiveSettings});
  const prepare = last(modal, 'problemReportPrepare');
  assert.equal(prepare.payload.context, captured.context);
  prepare.callback(null, prepared(prepare.payload));
  modal.prepareDetails();
  assert.equal(modal.calls.activity, 1, 'activity is never re-collected while filling in the report');
  assert.equal(last(modal, 'problemReportPrepare').payload.context, captured.context);
  assert.equal(modal.submissionSnapshot().context, captured.context);
  assert.equal(modal.calls.timer, undefined, 'no periodic update is scheduled');
});

/**
 * Load a component's script options in a VM context. Every imported name becomes a stub
 * unless the caller provides it.
 */
function loadOptions(file, provided = {}) {
  const source = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const { script, template, styles } = parse(source).descriptor;
  const imports = /^import\s+([\s\S]+?)\s+from\s+['"][^'"]+['"];?[ \t]*\r?$/gm;
  const names = [...script.content.matchAll(imports)]
    .flatMap(([, clause]) => clause.replace(/[{}]/g, '').split(',').map((part) => part.trim().split(/\s+as\s+/).pop()))
    .filter(Boolean);
  const context = { ...Object.fromEntries(names.map((name) => [name, () => {}])), ...provided };
  vm.createContext(context);
  vm.runInContext(script.content.replace(imports, '').replace('export default', 'globalThis.component ='), context);
  return { options: context.component, template: template.content, style: styles.map((style) => style.content).join('\n') };
}

test('clearDiagnostics empties the diagnostics buffer', () => {
  // An existing handler keeps the recorded error out of the console
  const app = { config: { errorHandler() {} } };
  const socket = { emit() {}, on() {} };
  withBrowser(() => installDiagnostics(app, socket, { afterEach() {} }));
  app.config.errorHandler(new Error('x'), { $options: { name: 'SomeComponent' } }, 'render');
  assert.ok(getDiagnostics().length > 0);
  clearDiagnostics();
  assert.deepEqual(getDiagnostics(), []);
});

test('signing in as a different user drops the previous account\'s report details', () => {
  const cleared = [];
  const { options } = loadOptions('App.vue', {
    clearActivity: () => cleared.push('activity'),
    clearDiagnostics: () => cleared.push('diagnostics'),
  });
  let user = {};
  const app = { $store: { getters: { 'auth/getUser': user }, commit: (_name, data) => { user = data; app.$store.getters['auth/getUser'] = data; } }, loaded: {} };

  options.sockets.appUser.call(app, { id: 1 });
  assert.deepEqual(cleared, [], 'first sign-in on the page keeps its details');
  options.sockets.appUser.call(app, { id: 1 });
  assert.deepEqual(cleared, [], 'a reconnect of the same user keeps its details');
  options.sockets.appUser.call(app, { id: 2 });
  assert.deepEqual(cleared, ['activity', 'diagnostics']);
});

test('the report button floats bottom-right and follows the feature setting', () => {
  let enabled = true;
  const { options, template, style } = loadOptions('components/problem_report/ProblemReportLauncher.vue', {
    readReportSettings: () => ({ enabled }),
  });
  const launcher = { $store: { getters: { 'settings/getValue': () => null } } };
  assert.equal(options.computed.problemReportEnabled.call(launcher), true);
  enabled = false;
  assert.equal(options.computed.problemReportEnabled.call(launcher), false);

  assert.match(template, /v-if="problemReportEnabled"/);
  assert.match(template, /@click="\$refs\.problemReportModal\.open\(\)"/);
  assert.match(style, /#problemReportButton\s*{[^}]*position:\s*fixed;[^}]*right:[^}]*bottom:/);
});
