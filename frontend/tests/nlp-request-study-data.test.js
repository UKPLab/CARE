/**
 * Regression tests for the prior-step study data a service request reads.
 *
 * Runs the real NlpRequest options on data stored by the real Study.updateStudyData. The JSON
 * round trip matches the socket transport: a value of `undefined` drops the key, and the backend
 * then leaves the placeholder token in the prompt.
 *
 * Run from `frontend`: npm run test:unit
 */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {computed, watch} from 'vue'
import {annotatorRecordsForPrompt, annotatorRecordsForSkill} from '../src/assets/annotations.js'
import {loadOptions} from './helpers/loadOptions.js'

const NlpRequestOptions = loadOptions('basic/service/NlpRequest.vue', {
    annotatorRecordsForPrompt, annotatorRecordsForSkill,
    pdfjsLib: {GlobalWorkerOptions: {}},
    resolveApiMessage: () => 'request failed',
})
const StudyOptions = loadOptions('components/Study.vue', {computed})

const ANNOTATOR_STEP = {id: 9}
const EDITOR_STEP = {id: 10}
const STEPS = [ANNOTATOR_STEP, EDITOR_STEP]
const IDENTITY = {userId: 4, creator_name: 'someone', studySessionId: 42, studyStepId: 9, documentId: 5, anonymous: false}
const ANNOTATION = {id: 2, text: 'a quote', tagId: 1, createdAt: '2026-01-01', anchors: [{range: {}}], selectors: {target: []}, ...IDENTITY}
const COMMENT = {id: 1, text: 'a comment', annotationId: ANNOTATION.id, createdAt: '2026-01-02', ...IDENTITY}
const COMMENT_IN_PROMPT = {id: 1, comment: 'a comment', quote: 'a quote', annotationId: 2, createdAt: '2026-01-02'}
const ANNOTATION_IN_PROMPT = {id: 2, quote: 'a quote', tagId: 1, createdAt: '2026-01-01'}

const COMMENTS_INPUT = {value: 'annotator_comments_step0', stepIndex: 0, key: 'comments', type: 'annotator'}
const ANNOTATIONS_INPUT = {value: 'annotator_annotation_step0', stepIndex: 0, key: 'annotations', type: 'annotator'}

/** Builds the request `this` for a study into which the steps stored the given data. */
function request(stored = [], inputs = {}) {
    const study = {studyData: {}}
    stored.forEach(([stepId, type, data]) => StudyOptions.methods.updateStudyData.call(study, stepId, type, data))
    const runHook = []
    return {
        ...NlpRequestOptions.data(),
        ...NlpRequestOptions.methods,
        $watch: (source, callback, options) => watch(source, callback, options),
        studyData: study.studyData,
        orderedStudySteps: STEPS,
        service: {hookId: 3, inputs},
        studyStepId: EDITOR_STEP.id,
        studySessionId: 42,
        documentId: 5,
        documentData: {},
        resultKeyBase: 'hook_3',
        eventBus: {emit: () => { throw new Error('the request must not fail') }},
        $t: key => key,
        $emit: () => {},
        $socket: {emit: () => {}},
        $ai: {runHook: async params => { runHook.push(params); return {output: 'done'} }},
        runHook,
    }
}

const overSocket = value => JSON.parse(JSON.stringify(value))

test('saved keyed mappings read their field from the annotator data', async () => {
    const vm = request([[ANNOTATOR_STEP.id, 'annotator', {annotations: [ANNOTATION], comments: [COMMENT]}]], {
        'inlineComments[1]': COMMENTS_INPUT,
        'inlineComments[2]': ANNOTATIONS_INPUT,
    })
    await vm.sendHookRequest()
    assert.equal(vm.status, 'completed')
    assert.deepEqual(overSocket(vm.runHook[0].values), {
        'inlineComments[1]': [COMMENT_IN_PROMPT],
        'inlineComments[2]': [ANNOTATION_IN_PROMPT],
    })
})

test('prompt values carry no identity, location or study fields', async () => {
    const vm = request([[ANNOTATOR_STEP.id, 'annotator', {annotations: [ANNOTATION], comments: [COMMENT]}]], {
        'inlineComments[1]': COMMENTS_INPUT,
        'inlineComments[2]': ANNOTATIONS_INPUT,
    })
    await vm.sendHookRequest()
    const sent = JSON.stringify(vm.runHook[0].values)
    for (const field of ['userId', 'creator_name', 'anonymous', 'studySessionId', 'studyStepId', 'documentId', 'anchors', 'selectors']) {
        assert.equal(sent.includes(field), false, field)
    }
})

test('a comment without an annotation has an empty quote', async () => {
    const note = {...COMMENT, annotationId: null}
    const vm = request([[ANNOTATOR_STEP.id, 'annotator', {annotations: [], comments: [note]}]], {
        'inlineComments[1]': COMMENTS_INPUT,
    })
    await vm.sendHookRequest()
    assert.deepEqual(overSocket(vm.runHook[0].values), {
        'inlineComments[1]': [{...COMMENT_IN_PROMPT, quote: '', annotationId: null}],
    })
})

test('a mapped annotator field that does not exist sends null', async () => {
    const vm = request([[ANNOTATOR_STEP.id, 'annotator', {annotations: [], comments: []}]], {
        'inlineComments[1]': {...COMMENTS_INPUT, key: 'unknown'},
    })
    await vm.sendHookRequest()
    assert.deepEqual(overSocket(vm.runHook[0].values), {'inlineComments[1]': null})
})

test('empty annotator records stay empty lists', async () => {
    const vm = request([[ANNOTATOR_STEP.id, 'annotator', {annotations: [], comments: []}]], {
        'inlineComments[1]': COMMENTS_INPUT,
    })
    await vm.sendHookRequest()
    assert.equal(vm.status, 'completed')
    assert.deepEqual(overSocket(vm.runHook[0].values), {'inlineComments[1]': []})
})

test('terminal annotator load failure fails the hook, and an explicit retry sends recovered records', async () => {
    const vm = request([[ANNOTATOR_STEP.id, 'annotator', {loadError: true}]], {'inlineComments[1]': COMMENTS_INPUT})
    const toasts = []
    vm.eventBus = {emit: (name, toast) => toasts.push(toast)}
    await vm.sendHookRequest()
    assert.equal(vm.status, 'failed')
    assert.equal(vm.runHook.length, 0)
    assert.equal(toasts.length, 1)

    StudyOptions.methods.updateStudyData.call(vm, ANNOTATOR_STEP.id, 'annotator', {annotations: [], comments: [COMMENT]})
    await vm.sendHookRequest()
    assert.equal(vm.status, 'completed')
    assert.deepEqual(overSocket(vm.runHook[0].values), {'inlineComments[1]': [{...COMMENT_IN_PROMPT, quote: '', annotationId: 2}]})
})

test('a mapped assessment that a step never stored sends null and keeps its key', async () => {
    const vm = request([], {assessmentResult: {stepIndex: 0, type: 'assessment'}})
    await vm.sendHookRequest()
    assert.equal(vm.status, 'completed')
    assert.deepEqual(overSocket(vm.runHook[0].values), {assessmentResult: null})
})

test('a mapped step or field that does not exist sends null', () => {
    const vm = request([[ANNOTATOR_STEP.id, 'annotator', {annotations: [], comments: []}]])
    assert.equal(vm.buildPayloadFromStudyData({...COMMENTS_INPUT, stepIndex: 7}), null)
    assert.equal(vm.buildPayloadFromStudyData({...COMMENTS_INPUT, key: 'unknown'}), null)
})

test('editor and assessment mappings keep their shape', () => {
    const editor = {firstVersion: '<p>a</p>', currentVersion: '<p>b</p>'}
    const assessment = {score: 3}
    const vm = request([
        [EDITOR_STEP.id, 'editor', editor],
        [EDITOR_STEP.id, 'assessment', assessment],
    ])
    assert.equal(vm.buildPayloadFromStudyData({stepIndex: 1, key: 'currentVersion', type: 'editor'}), editor.currentVersion)
    assert.deepEqual(vm.buildPayloadFromStudyData({stepIndex: 1, type: 'assessment'}), assessment)
})

test('skill requests resolve keyed mappings the same way', () => {
    const vm = request([[ANNOTATOR_STEP.id, 'annotator', {annotations: [], comments: [COMMENT]}]])
    assert.deepEqual(vm.buildPayload(COMMENTS_INPUT), [{id: 1, text: 'a comment', annotationId: 2, createdAt: '2026-01-02'}])
})
