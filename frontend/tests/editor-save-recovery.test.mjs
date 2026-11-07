import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window = new Window();
for (const key of ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'Text', 'MutationObserver', 'DOMParser']) globalThis[key] = key === 'window' ? window : window[key];
const {default: Quill} = await import('quill');
const Delta = Quill.import('delta');
const {deltaToDb, dbToDelta} = await import('editor-delta-conversion');
const source = readFileSync(process.env.EDITOR_SOURCE || new URL('../src/components/editor/editor/Editor.vue', import.meta.url), 'utf8');
const script = source.split('<script>')[1].split('</script>')[0].replace(/^import .*;$/gm, '').replace('export default', 'globalThis.component =');
const sandbox = {BasicButton: {}, LoadIcon: {}, Quill, Delta, debounce: () => {}, deltaToDb, dbToDelta, resolveApiMessage: () => '', setTimeout, clearTimeout};
vm.runInNewContext(script, sandbox);
function setup() {
  const element = document.createElement('div'); document.body.append(element);
  const quill = new Quill(element); quill.setContents(new Delta().insert('ab\n'));
  const sent = [];
  const c = { $route: {params: {}}, ...sandbox.component.methods };
  Object.assign(c, sandbox.component.data.call(c), {editor: {getEditor: () => quill}, documentId: 1, studySessionId: 2, studyStepId: 3, finalReadOnly: false, $socket: {id: 'self', emit: (event, data, callback) => sent.push({event, data, callback})}, $store: {commit() {}}, unappliedEdits: [], $nextTick: () => Promise.resolve(), $emit() {}, $t: k => k, eventBus: {emit() {}}, debouncedProcessDelta: Object.assign(() => {}, {cancel() {}})});
  quill.on('text-change', (d,o,s) => c.handleTextChange(d,o,s));
  const type = (index, text) => quill.insertText(index,text,'user');
  return {c, quill, sent, type};
}
test('failed save retains draft and drops dependent later operations until saved-content reload', async () => {
  const {c,quill,sent,type} = setup();
  type(1,'FAIL'); c.processDelta(); type(5,'LATER'); c.processDelta();
  assert.equal(sent.length,1);
  sent[0].callback({success:false});
  assert.equal(quill.getText(),'aFAILLATERb\n');
  assert.equal(quill.isEnabled(),false);
  assert.match(c.failedDraft,/FAILLATER/);
  c.processDelta(); assert.equal(sent.length,1);
  c.recoverSavedContent(); await sent[1].callback({success:true,data:{deltas:new Delta().insert('ab\n')}});
  assert.equal(quill.getText(),'ab\n'); assert.equal(quill.isEnabled(),true);
  type(0,'Z'); c.processDelta();
  assert.deepEqual(JSON.parse(JSON.stringify(sent[2].data.ops)),JSON.parse(JSON.stringify(deltaToDb([{insert:'Z'}]))));
  sent[2].callback({success:true});
  assert.equal(quill.getText(),'Zab\n');
});
test('rapid successful typing drains batches in acknowledgement order', async () => {
  const {c,quill,sent,type} = setup();
  type(1,'X'); c.processDelta(); type(2,'Y'); c.processDelta();
  assert.equal(sent.length,1); sent[0].callback({success:true});
  assert.equal(sent.length,2); sent[1].callback({success:true});
  assert.equal(quill.getText(),'aXYb\n');
});
test('disconnect keeps ambiguous write locked and never automatically replays it', async () => {
  const {c,sent,type,quill} = setup();
  type(1,'X'); c.processDelta(); type(2,'Y');
  sandbox.component.sockets.disconnect.call(c);
  c.recoverSavedContent(); assert.equal(sent.length,1);
  assert.equal(quill.isEnabled(),false);
  sent[0].callback({success:true});
  c.recoverSavedContent(); await sent[1].callback({success:true,data:{deltas:new Delta().insert('aXb\n')}});
  assert.equal(quill.getText(),'aXb\n'); assert.match(c.failedDraft,/aXYb/);
  assert.equal(sent.filter(s=>s.event==='documentEdit').length,1);
});
test('broadcast straddling recovery causes a fresh snapshot, not a duplicate', async () => {
  const {c,sent,quill} = setup(); c.pauseFailedSave(); c.recoverSavedContent();
  c.processEdits([{sender:'other',insert:'C'}]);
  sent[0].callback({success:true,data:{deltas:new Delta().insert('ab\n')}});
  assert.equal(sent.length,2);
  await sent[1].callback({success:true,data:{deltas:new Delta().insert('aCb\n')}});
  assert.equal(quill.getText(),'aCb\n');
});
test('context change and unmount ignore stale recovery callbacks', () => {
  for (const cancel of [c=>c.invalidateSaveContext(),c=>{c.disposed=true; clearTimeout(c.recoveryTimer);}]) {
    const {c,sent,quill} = setup(); c.pauseFailedSave(); c.recoverSavedContent(); cancel(c);
    sent[0].callback({success:true,data:{deltas:new Delta().insert('WRONG\n')}});
    assert.equal(quill.getText(),'ab\n');
  }
});


test('recovery transforms selection and clears unconfirmed undo history', async () => {
  const {c,quill,sent,type} = setup();
  type(1,'FAIL'); quill.setSelection(5,0,'silent'); c.processDelta();
  sent[0].callback({success:false});
  c.recoverSavedContent();
  await sent[1].callback({success:true,data:{deltas:new Delta().insert('ab\n')}});
  assert.equal(quill.getSelection()?.index,1);
  quill.history.undo(); assert.equal(quill.getText(),'ab\n');
});
test('unmount flush waits for later buffered batches before closing', async () => {
  const {c,sent,type} = setup();
  type(1,'X'); c.processDelta(); type(2,'Y');
  const flushed = c.flushPendingEdits();
  sent[0].callback({success:true});
  let done = false; flushed.then(()=>{done=true;});
  await Promise.resolve(); assert.equal(done,false);
  assert.equal(sent.length,2); sent[1].callback({success:true});
  await flushed; assert.equal(done,true);
});

test('failed snapshot keeps draft paused and permits another explicit read', async () => {
  const {c,sent,quill} = setup();
  c.pauseFailedSave(); c.recoverSavedContent();
  await sent[0].callback({success:false,error:{message:'read failed'}});
  assert.equal(quill.isEnabled(),false); assert.equal(c.recovering,false);
  c.recoverSavedContent();
  await sent[1].callback({success:true,data:{deltas:new Delta().insert('ab\n')}});
  assert.equal(quill.isEnabled(),true);
});


test('lost acknowledgement expires locally; only a queued recovery read unlocks editing', async () => {
  const original = sandbox.setTimeout;
  let expire;
  sandbox.setTimeout = callback => { expire = callback; return 0; };
  const {c, sent, quill, type} = setup();
  try {
    type(1, 'X'); const pending = c.processDelta(); type(2, 'Y');
    expire(); await pending;
    assert.equal(quill.isEnabled(), false);
    assert.equal(c.saveInFlight, null);
    c.recoverSavedContent();
    assert.equal(sent[1].event, 'documentRecover');
    assert.equal(quill.isEnabled(), false);
    await sent[1].callback({success:true,data:{deltas:new Delta().insert('aXb\n')}});
    assert.equal(quill.getText(), 'aXb\n');
    assert.equal(quill.isEnabled(), true);
    type(2, 'Z'); c.processDelta();
    sent[0].callback({success:false});
    assert.equal(c.saveFailed, false);
    assert.ok(c.saveInFlight);
    sent[2].callback({success:true});
  } finally { sandbox.setTimeout = original; }
});


test('missing acknowledgement after unmount settles flush without sending dependent edits', async () => {
  const original = sandbox.setTimeout;
  let expire;
  sandbox.setTimeout = callback => { expire = callback; return 0; };
  const {c, sent, type} = setup();
  try {
    type(1, 'X'); c.processDelta(); type(2, 'Y'); c.disposed = true;
    const flushed = c.flushPendingEdits(); expire(); await flushed;
    assert.equal(sent.length, 1);
    assert.equal(c.deltaBuffer.length, 0);
  } finally { sandbox.setTimeout = original; }
});
