import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import { installDiagnostics, getDiagnostics } from '../src/assets/diagnostics.js';

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
    const secret = 'Private document draft';
    listeners.error({ message: secret, filename: 'https://care.test/app.js?token=secret', lineno: 1 });
    listeners.unhandledrejection({ reason: new Error(secret) });
    app.config.errorHandler(new Error(secret), null, 'render');
    socket.emit('documentSave', { contents: secret }, () => {});
    const saved = JSON.stringify(getDiagnostics());
    assert.ok(!saved.includes(secret));
    assert.ok(!saved.includes('token='));
    assert.ok(saved.includes('documentSave'));
    assert.ok(saved.includes('errors.save'));
  } finally {
    globalThis.window = previousWindow;
  }
});

test('a delayed preview cannot restore a cancelled report', () => {
  const source = fs.readFileSync(new URL('../src/components/problem_report/ProblemReportModal.vue', import.meta.url), 'utf8');
  const script = parse(source).descriptor.script.content;
  let sequence = 0;
  const context = {
    uuid: () => `form-${++sequence}`,
    getDiagnostics: () => [],
    buildReportContext: () => ({}),
    resolveApiMessage: () => '',
    URL: { revokeObjectURL() {} },
  };
  for (const name of ['BasicModal', 'BasicButton', 'BasicForm', 'ChoiceChips', 'AttachmentPicker', 'ReportSummary']) context[name] = {};
  vm.createContext(context);
  vm.runInContext(script.replace(/^import .*;\r?$/gm, '').replace('export default', 'globalThis.component ='), context);
  const component = context.component;
  const form = { ...component.methods };
  Object.assign(form, component.data.call(form));
  let acknowledge;
  form.$socket = { timeout: () => ({ emit: (_event, _payload, callback) => { acknowledge = callback; } }) };
  form.$refs = { modal: { close() {} } };
  form.eventBus = { emit() {} };
  form.validate = () => true;
  form.$nextTick = () => {};
  form.descriptionData.problemReportDescription = 'Original report';
  form.form.problemTypes = ['error'];
  form.showPreview();
  form.cancel();
  acknowledge(null, { success: true, data: { description: 'Original report' } });
  assert.equal(form.step, 'form');
  assert.equal(form.preview, null);
  assert.equal(form.loadingPreview, false);
});
