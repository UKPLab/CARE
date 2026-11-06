import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {annotatorRecordsForSkill} from '../src/assets/annotations.js'
import {loadOptions} from './helpers/loadOptions.js'

const options = loadOptions('basic/service/NlpRequest.vue', {
    annotatorRecordsForSkill,
    pdfjsLib: {GlobalWorkerOptions: {}},
    resolveApiMessage: () => 'request failed',
})
// Evaluate the real broker adapter with only its infrastructure imports replaced; no DB or model calls.
const module = {exports: {}}
vm.runInNewContext(readFileSync(new URL('../../backend/webserver/services/nlp.js', import.meta.url), 'utf8'), {
    module, require: name => name === '../Service.js' ? class {} : {},
})
const NLPService = module.exports
const mapping = key => ({type: 'annotator', stepIndex: 0, key})
const identity = {userId: 44, creator_name: 'private', studySessionId: 55, studyStepId: 66, documentId: 77, extra: 'private'}
const selectors = {target: [{selector: [{type: 'TextPositionSelector', start: 1, end: 7}, {type: 'TextQuoteSelector', exact: 'sample', prefix: '', suffix: ''}, {type: 'PagePositionSelector', number: 1}]}]}
const annotation = {id: 1, text: 'sample', tagId: 2, selectors, anchors: [{range: {}}], ...identity}
const comment = {id: 3, text: 'note', annotationId: 1, parentCommentId: null, tags: '[]', ...identity}

/** Captures the real component request and forwards it through the real NLP service adapter. */
async function outgoing(data, inputs = {annotations: mapping('annotations'), comments: mapping('comments')}) {
    const sent = [], external = [], toasts = []
    const request = {
        ...options.methods, studyData: data === undefined ? {} : {9: {annotator: data}},
        orderedStudySteps: [{id: 9}], service: {inputs}, isHook: false, id: 'test', skill: 'contract_probe',
        nlpRequestTimeout: 10000, $t: key => key,
        eventBus: {emit: (...args) => toasts.push(args)},
        $socket: {emit: (event, payload) => sent.push({event, payload: JSON.parse(JSON.stringify(payload))})},
    }
    request.sendRequest()
    clearTimeout(request.timeoutId)
    const broker = new NLPService({})
    broker.nlpSocket = {connected: true, emit: (event, payload) => external.push({event, payload: JSON.parse(JSON.stringify(payload))})}
    for (const item of sent) await broker.request({socket: {id: 'transport-client'}}, item.payload.data)
    return {request, sent, external, toasts}
}

test('external skillRequest preserves content, supported locations and comment relationships without record metadata', async () => {
    const {external} = await outgoing({annotations: [annotation], comments: [comment]})
    assert.deepEqual(external, [{event: 'skillRequest', payload: {
        id: 'test', name: 'contract_probe', clientId: 'transport-client', data: {
            annotations: [{id: 1, text: 'sample', tagId: 2, selectors}],
            comments: [{id: 3, text: 'note', annotationId: 1, parentCommentId: null, tags: '[]'}],
        },
    }}])
    assert.equal(annotation.userId, 44)
})

test('loaded empty records reach the external broker as empty arrays', async () => {
    const {external} = await outgoing({annotations: [], comments: []})
    assert.deepEqual(external[0].payload.data, {annotations: [], comments: []})
})

test('unloaded or unsupported mapped records fail visibly without an external request', async () => {
    for (const data of [undefined, {}, {annotations: []}, {annotations: [{...annotation, selectors: {target: [{selector: [{type: 'Unknown'}]}]}}], comments: []}]) {
        const result = await outgoing(data)
        assert.equal(result.request.status, 'failed')
        assert.equal(result.sent.length, 0)
        assert.equal(result.external.length, 0)
        assert.equal(result.toasts.length, 1)
    }
})

test('editor and assessment mapping shapes remain unchanged', async () => {
    const inputs = {editor: {type: 'editor', stepIndex: 0, key: 'currentVersion'}, assessment: {type: 'assessment', stepIndex: 0}}
    const request = {...options.methods, orderedStudySteps: [{id: 9}], studyData: {9: {editor: {currentVersion: '<p>text</p>'}, assessment: {score: 4}}}}
    assert.equal(request.buildPayload(inputs.editor), '<p>text</p>')
    assert.deepEqual(request.buildPayload(inputs.assessment), {score: 4})
})

test('selector metadata and target source links are excluded while supported selector fields survive', () => {
    const record = {...annotation, createdAt: '2026-01-01', updatedAt: '2026-01-02', selectors: {target: [{
        source: '/documents/77/sessions/55', userId: 44,
        selector: [{type: 'RangeSelector', startContainer: '/div[1]', startOffset: 0, endContainer: '/div[2]', endOffset: 4, ...identity}],
    }]}}
    assert.deepEqual(annotatorRecordsForSkill({annotations: [record]}, 'annotations'), [{
        id: 1, text: 'sample', tagId: 2, createdAt: '2026-01-01', updatedAt: '2026-01-02',
        selectors: {target: [{selector: [{type: 'RangeSelector', startContainer: '/div[1]', startOffset: 0, endContainer: '/div[2]', endOffset: 4}]}]},
    }])
})

test('unsupported mapping keys fail instead of exposing the whole annotator object', async () => {
    const result = await outgoing({annotations: [annotation], comments: [comment]}, {value: mapping('unknown')})
    assert.equal(result.request.status, 'failed')
    assert.equal(result.external.length, 0)
    assert.equal(result.toasts.length, 1)
})
