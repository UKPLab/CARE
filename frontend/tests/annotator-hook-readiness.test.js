/**
 * Integration tests for when a hook may read the annotator data of an earlier step (#507).
 *
 * Runs the real Vuex table modules, the real subscribeTable plugin, the real Annotator and NlpRequest
 * options (with their mounted hooks) and the real Study.updateStudyData. The test plays the backend:
 * it decides when each refresh and acknowledgement arrives, so every order is deterministic.
 *
 * Run from `frontend`: npm run test:unit
 */
import assert from 'node:assert/strict'
import {afterEach, test} from 'node:test'
import {EventEmitter} from 'node:events'
import {computed, createRenderer, h, nextTick, reactive} from 'vue'
import {createStore} from 'vuex'
import {annotatorRecordsForPrompt, annotatorRecordsForSkill} from '../src/assets/annotations.js'
import * as serviceKeys from '../src/assets/serviceDocumentDataKeys.js'
import subscribeTable from '../src/plugins/subscribeTable.js'
import {createTable} from '../src/store/utils.js'
import {loadOptions} from './helpers/loadOptions.js'

const AnnotatorOptions = loadOptions('components/annotator/Annotator.vue', {
    computed,
    debounce: fn => fn,
    mapMutations: () => ({}),
    resolveApiMessage: () => 'failed',
})
const NlpRequestOptions = loadOptions('basic/service/NlpRequest.vue', {
    ...serviceKeys,
    annotatorRecordsForPrompt,
    annotatorRecordsForSkill,
    pdfjsLib: {GlobalWorkerOptions: {}},
    resolveApiMessage: () => 'failed',
    uuid: () => 'request-id',
})
const StudyOptions = loadOptions('components/Study.vue', {computed})

const DOC = 7
const SESSION = 42
const STEP = 9
const LATER_STEP = 10
const HOOK_INPUTS = {
    'inlineComments[1]': {stepIndex: 0, key: 'comments', type: 'annotator'},
    'inlineComments[2]': {stepIndex: 0, key: 'annotations', type: 'annotator'},
}

const cleanups = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()) })
const noop = () => {}
const element = () => ({addEventListener: noop, removeEventListener: noop, querySelectorAll: () => []})
const {createApp} = createRenderer({
    patchProp: noop, insert: noop, remove: noop, createElement: element, createText: element,
    createComment: element, setText: noop, setElementText: noop, parentNode: () => null, nextSibling: () => null,
})

const annotation = (id, studySessionId, studyStepId, text, documentId = DOC) =>
    ({id, documentId, studySessionId, studyStepId, text, tagId: 1, createdAt: 'at', anchors: null, userId: 4})
const comment = (id, studySessionId, studyStepId, text, documentId = DOC) =>
    ({id, documentId, studySessionId, studyStepId, text, annotationId: null, createdAt: 'at', tags: '[]', userId: 4})

const COMMENT_VALUE = (id, text) => ({id, comment: text, quote: '', annotationId: null, createdAt: 'at'})
const ANNOTATION_VALUE = (id, text) => ({id, quote: text, tagId: 1, createdAt: 'at'})

/** Lets socket callbacks, watchers and the async hook request finish. */
async function settle() {
    for (let i = 0; i < 4; i++) {
        await nextTick()
        await new Promise(resolve => setImmediate(resolve))
    }
}

/**
 * Mounts a study page the way Study.vue wires it: the Annotator of the first step, and on request the
 * NlpRequest of the later step.
 *
 * @param {Object} [options]
 * @param {boolean} [options.flag] showAllDocumentAnnotations of the annotator step
 * @param {boolean} [options.withRequest] Mount the later step's request together with the Annotator
 * @param {Function} [options.prepare] Runs with the store before anything is mounted
 */
function mountStudy({flag, withRequest = false, requestDocumentId = DOC, legacy = false, prepare = noop} = {}) {
    const store = createStore({
        modules: {
            auth: {namespaced: true, getters: {getUserId: () => 1}},
            settings: {namespaced: true, getters: {getValue: () => () => undefined}},
            service: {namespaced: true, getters: {getResults: () => () => ({})}},
        },
    })
    for (const name of ['annotation', 'comment', 'study', 'study_session', 'study_step', 'tag', 'user_environment']) {
        createTable(store, {name, fields: []})
    }
    store.commit('table/study_step/SOCKET_study_stepRefresh', [{
        id: STEP, configuration: {settings: flag === undefined ? {} : {showAllDocumentAnnotations: flag}},
    }])
    prepare(store)

    const socketCalls = []
    const study = reactive({studyData: {}})
    const ui = reactive({showRequest: withRequest, sessionId: SESSION})
    const bus = new EventEmitter()
    bus.on("toast", toast => toasts.push(toast))
    const toasts = []
    const runHook = []
    let annotatorVm
    let requestVm

    const {components: _a, ...annotatorOptions} = AnnotatorOptions
    const Annotator = {...annotatorOptions, render: () => h('div', {ref: 'viewer'})}
    const NlpRequest = {...NlpRequestOptions, render: () => h('span')}
    const Parent = {
        provide: () => ({
            studyData: computed(() => study.studyData),
            orderedStudySteps: computed(() => [{id: STEP, documentId: DOC}, {id: LATER_STEP, documentId: requestDocumentId}]),
            studySessionId: computed(() => ui.sessionId),
            currentStudyStep: computed(() => ({id: STEP})),
        }),
        render: () => [
            h(Annotator, {
                ref: vm => { annotatorVm = vm ?? annotatorVm },
                documentId: DOC,
                studyStepId: STEP,
                'onUpdate:data': data => StudyOptions.methods.updateStudyData.call(study, STEP, 'annotator', data),
            }),
            ui.showRequest ? h(NlpRequest, {
                name: 'hook',
                service: {...(legacy ? {} : {hookId: 3}), inputs: HOOK_INPUTS},
                skill: 'contract_probe',
                inputs: HOOK_INPUTS,
                documentData: {},
                documentId: requestDocumentId,
                studyStepId: LATER_STEP,
                ref: vm => { requestVm = vm ?? requestVm },
            }) : null,
        ],
    }

    const app = createApp(Parent)
    app.use(subscribeTable)
    Object.assign(app.config.globalProperties, {
        $store: store,
        $socket: {on: bus.on.bind(bus), off: bus.off.bind(bus), emit: (event, data, ack) => socketCalls.push({event, data, ack})},
        $t: key => key,
        $ai: {runHook: async params => { runHook.push(params); return {output: 'done'} }},
        eventBus: bus,
    })
    app.mount({})
    cleanups.push(() => {
        ++annotatorVm.recordsRequestId
        clearTimeout(annotatorVm.recordsTimer)
        if (requestVm) {
            ++requestVm.hookGeneration
            requestVm.cancelReadiness?.()
        }
    })

    const deliver = (table, rows) => store.commit(`table/${table}/SOCKET_${table}Refresh`, JSON.parse(JSON.stringify(rows)))
    const dataRequests = () => socketCalls.filter(call => call.event === 'documentGetData')

    return {
        ui, toasts, runHook, deliver, dataRequests, socketCalls, bus, unmount: () => {
            AnnotatorOptions.beforeUnmount.call(annotatorVm)
            NlpRequestOptions.beforeUnmount.call(requestVm)
        },
        annotator: () => study.studyData[STEP]?.annotator,
        request: () => requestVm,
        /** The table subscriptions answer: this must never count as "records loaded". */
        acknowledgeSubscriptions() {
            socketCalls.filter(call => call.event === 'subscribeAppData').forEach((call, i) =>
                call.ack({success: true, data: `subscription-${i}`}))
        },
        /** Answers a documentGetData the way the backend does: rows first, then the acknowledgement. */
        async answerData({annotations = [], comments = [], request = dataRequests().at(-1)} = {}) {
            deliver('annotation', annotations)
            deliver('comment', comments)
            request.ack({success: true})
            await settle()
        },
        async startRequest() {
            ui.showRequest = true
            await settle()
        },
    }
}

/** What the backend receives, after the JSON transport of the socket. */
const sentValues = page => JSON.parse(JSON.stringify(page.runHook.map(call => call.values)))

test('the Annotator requests its records for its own step and session', async () => {
    const page = mountStudy()
    await settle()
    const [request, ...others] = page.dataRequests()
    assert.deepEqual(others, [])
    assert.deepEqual(request.data, {documentId: DOC, studySessionId: SESSION, studyStepId: STEP})
})

test('empty initial refreshes: the hook runs with empty lists and completes', async () => {
    const page = mountStudy()
    await page.answerData()
    assert.deepEqual(page.annotator(), {annotations: [], comments: []})

    await page.startRequest()
    assert.deepEqual(sentValues(page), [{'inlineComments[1]': [], 'inlineComments[2]': []}])
    assert.equal(page.request().status, 'completed')
    assert.deepEqual(page.toasts, [])
})

test('rows already in the store: the refresh changes nothing, and they still reach the hook', async () => {
    const page = mountStudy({
        prepare: store => {
            store.commit('table/annotation/SOCKET_annotationRefresh', [annotation(1, SESSION, STEP, 'quote')])
            store.commit('table/comment/SOCKET_commentRefresh', [comment(2, SESSION, STEP, 'note')])
        },
    })
    await settle()
    assert.equal(page.annotator(), null)

    page.dataRequests()[0].ack({success: true})
    await settle()
    await page.startRequest()
    assert.deepEqual(sentValues(page), [{
        'inlineComments[1]': [COMMENT_VALUE(2, 'note')],
        'inlineComments[2]': [ANNOTATION_VALUE(1, 'quote')],
    }])
    assert.equal(page.request().status, 'completed')
})

for (const [flag, commentIds, annotationIds] of [
    [true, [2, 12], [1, 11]],
    [false, [12], [11]],
    [undefined, [12], [11]],
]) {
    test(`flag ${flag}: the hook gets exactly the records of the view`, async () => {
        const page = mountStudy({flag})
        await page.answerData({
            annotations: [
                annotation(1, null, null, 'document'),
                annotation(11, SESSION, STEP, 'own'),
                annotation(21, SESSION + 1, STEP, 'other session'),
                annotation(31, SESSION, LATER_STEP, 'other step'),
                annotation(41, null, null, 'other document', DOC + 1),
            ],
            comments: [
                comment(2, null, null, 'document'),
                comment(12, SESSION, STEP, 'own'),
                comment(22, SESSION + 1, STEP, 'other session'),
                comment(32, SESSION, LATER_STEP, 'other step'),
                comment(42, null, null, 'other document', DOC + 1),
            ],
        })
        await page.startRequest()
        const [values] = sentValues(page)
        assert.deepEqual(values['inlineComments[1]'].map(r => r.id).sort((a, b) => a - b), commentIds)
        assert.deepEqual(values['inlineComments[2]'].map(r => r.id).sort((a, b) => a - b), annotationIds)
    })
}

test('nothing before the acknowledgement counts as loaded: no empty prompt from early deliveries', async () => {
    const page = mountStudy()
    await settle()

    // Subscriptions answer and deliver rows, some empty or of another document
    page.acknowledgeSubscriptions()
    page.deliver('annotation', [])
    page.deliver('comment', [comment(99, null, null, 'other document', DOC + 1)])
    await settle()
    assert.equal(page.annotator(), null)

    await page.startRequest()
    assert.deepEqual(page.runHook, [])
    assert.equal(page.request().status, 'pending')
    assert.equal(page.toasts.length, 0)

    // Annotations arrive, comments do not yet: still no partial prompt
    page.deliver('annotation', [annotation(1, SESSION, STEP, 'quote')])
    await settle()
    page.request().retryRequest()
    await settle()
    assert.deepEqual(page.runHook, [])
    assert.equal(page.request().status, 'pending')

    await page.answerData({annotations: [annotation(1, SESSION, STEP, 'quote')], comments: [comment(2, SESSION, STEP, 'note')]})
    page.request().retryRequest()
    await settle()
    assert.deepEqual(sentValues(page), [{
        'inlineComments[1]': [COMMENT_VALUE(2, 'note')],
        'inlineComments[2]': [ANNOTATION_VALUE(1, 'quote')],
    }])
    assert.equal(page.request().status, 'completed')
})

test('resume on the later step: late readiness automatically sends one prompt', async () => {
    // Annotator and request mount in the same flush, as when the page reopens on the later step
    const page = mountStudy({withRequest: true})
    await settle()
    assert.deepEqual(page.runHook, [])
    assert.equal(page.request().status, 'pending')
    assert.equal(page.toasts.length, 0)

    await page.answerData({comments: [comment(2, SESSION, STEP, 'note')]})
    assert.equal(page.request().status, 'completed')

    assert.deepEqual(sentValues(page), [{'inlineComments[1]': [COMMENT_VALUE(2, 'note')], 'inlineComments[2]': []}])
    assert.equal(page.request().status, 'completed')
    assert.equal(page.toasts.length, 0)
})

test('resume with no records at all: readiness completes with empty lists', async () => {
    const page = mountStudy({withRequest: true})
    await settle()
    assert.equal(page.request().status, 'pending')

    await page.answerData()
    page.request().retryRequest()
    await settle()
    assert.deepEqual(sentValues(page), [{'inlineComments[1]': [], 'inlineComments[2]': []}])
    assert.equal(page.request().status, 'completed')
})

test('a failed acknowledgement stays not loaded, even when rows were delivered', async () => {
    const page = mountStudy()
    page.deliver('comment', [comment(2, SESSION, STEP, 'note')])
    page.dataRequests()[0].ack({success: false, message: 'denied'})
    await settle()
    assert.equal(page.annotator(), null)

    await page.startRequest()
    assert.deepEqual(page.runHook, [])
    assert.equal(page.request().status, 'pending')
})

test('records made after loading reach a later hook, and moving forward does not reload', async () => {
    const page = mountStudy()
    await page.answerData()
    page.deliver('comment', [comment(2, SESSION, STEP, 'added')])
    await settle()

    await page.startRequest()
    assert.equal(page.dataRequests().length, 1)
    assert.deepEqual(sentValues(page), [{'inlineComments[1]': [COMMENT_VALUE(2, 'added')], 'inlineComments[2]': []}])
})

test('a deleted record leaves the data of a later hook', async () => {
    const page = mountStudy()
    await page.answerData({comments: [comment(2, SESSION, STEP, 'gone'), comment(3, SESSION, STEP, 'kept')]})
    page.deliver('comment', [{...comment(2, SESSION, STEP, 'gone'), deleted: true}])
    await settle()

    await page.startRequest()
    assert.deepEqual(sentValues(page), [{'inlineComments[1]': [COMMENT_VALUE(3, 'kept')], 'inlineComments[2]': []}])
})

test('session change: the old records are withdrawn, and only the latest acknowledgement counts', async () => {
    const page = mountStudy()
    await page.answerData({comments: [comment(2, SESSION, STEP, 'old session')]})
    assert.equal(page.annotator().comments.length, 1)

    page.ui.sessionId = SESSION + 1
    await settle()
    assert.equal(page.annotator(), null)
    assert.equal(page.dataRequests().length, 2)

    page.ui.sessionId = SESSION + 2
    await settle()
    assert.equal(page.dataRequests().length, 3)

    // The answer to the request in between arrives late and must not unlock the newest session
    const [, between, latest] = page.dataRequests()
    between.ack({success: true})
    await settle()
    assert.equal(page.annotator(), null)

    await page.startRequest()
    assert.deepEqual(page.runHook, [])
    assert.equal(page.request().status, 'pending')

    await page.answerData({comments: [comment(3, SESSION + 2, STEP, 'new session')], request: latest})
    page.request().retryRequest()
    await settle()
    assert.deepEqual(sentValues(page), [{'inlineComments[1]': [COMMENT_VALUE(3, 'new session')], 'inlineComments[2]': []}])
})


test('lost acknowledgement is retried read-only; late old acknowledgement cannot unlock data', async t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    const page = mountStudy({withRequest: true})
    await settle()
    const old = page.dataRequests()[0]
    t.mock.timers.tick(10000)
    t.mock.timers.tick(500)
    assert.equal(page.dataRequests().length, 2)
    old.ack({success: true})
    await settle()
    assert.equal(page.annotator(), null)
    assert.deepEqual(page.runHook, [])
    await page.answerData({comments: [comment(2, SESSION, STEP, 'recovered')]})
    assert.equal(page.runHook.length, 1)
    assert.equal(page.request().status, 'completed')
    assert.equal(page.toasts.length, 0)
    t.mock.timers.tick(40000)
    assert.equal(page.dataRequests().length, 2)
    assert.equal(page.runHook.length, 1)
})

test('failed record loads stop after three attempts with an explicit hook error', async t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    const page = mountStudy({withRequest: true})
    await settle()
    for (const delay of [500, 1000, 0]) {
        page.dataRequests().at(-1).ack({success: false})
        if (delay) t.mock.timers.tick(delay)
    }
    await settle()
    assert.equal(page.dataRequests().length, 3)
    assert.deepEqual(page.runHook, [])
    assert.equal(page.request().status, 'failed')
    assert.equal(page.toasts.length, 1)
    t.mock.timers.tick(60000)
    assert.equal(page.dataRequests().length, 3)
})

for (const lost of [true, false]) test(`exhaustion (${lost ? 'lost acks' : 'server failure'}) retries a different source document without reload`, async t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    const page = mountStudy({withRequest: true, requestDocumentId: DOC + 1})
    await settle()
    for (const delay of [500, 1000, 0]) {
        if (lost) t.mock.timers.tick(10000)
        else page.dataRequests().at(-1).ack({success: false})
        if (delay) t.mock.timers.tick(delay)
    }
    await settle()
    assert.equal(page.request().status, 'failed')
    assert.equal(page.dataRequests().length, 3)
    assert.equal(page.runHook.length, 0)
    page.request().retryRequest()
    page.request().retryRequest()
    await settle()
    assert.equal(page.dataRequests().length, 4)
    assert.equal(page.request().status, 'pending')
    page.dataRequests()[0].ack({success: true})
    await settle()
    assert.equal(page.runHook.length, 0)
    await page.answerData({comments: [comment(2, SESSION, STEP, 'recovered')]})
    assert.equal(page.request().status, 'completed')
    assert.equal(page.runHook.length, 1)
    page.request().retryRequest()
    t.mock.timers.tick(60000)
    assert.equal(page.runHook.length, 1)
    assert.equal(page.dataRequests().length, 4)
})

test('reconnect restarts an unfinished read and ignores its old acknowledgement', async t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    const page = mountStudy({withRequest: true})
    await settle()
    const old = page.dataRequests()[0]
    page.bus.emit('connect')
    old.ack({success: true})
    await settle()
    assert.equal(page.annotator(), null)
    assert.equal(page.runHook.length, 0)
    await page.answerData()
    assert.equal(page.runHook.length, 1)
    page.bus.emit('connect')
    assert.equal(page.dataRequests().length, 2)
})


test('unmount clears read timers, retry listeners and the waiting hook', async t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    const page = mountStudy({withRequest: true})
    await settle()
    const request = page.dataRequests()[0]
    page.unmount()
    assert.equal(page.bus.listenerCount('annotatorRetryLoad'), 0)
    assert.equal(page.bus.listenerCount('connect'), 0)
    page.bus.emit('connect')
    request.ack({success: true})
    t.mock.timers.tick(60000)
    await settle()
    assert.equal(page.dataRequests().length, 1)
    assert.equal(page.runHook.length, 0)
})

test('context changes cancel a waiting hook before any model call', async () => {
    const page = mountStudy({withRequest: true})
    await settle()
    page.ui.sessionId++
    await settle()
    await page.answerData()
    assert.equal(page.runHook.length, 0)
    assert.equal(page.request().status, 'failed')
})

for (const lost of [true, false]) test(`legacy skill recovers after ${lost ? 'lost acknowledgements' : 'server failures'}`, async t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    const page = mountStudy({withRequest: true, legacy: true, requestDocumentId: DOC + 1})
    await settle()
    const sent = () => page.socketCalls.filter(call => call.event === 'serviceRequest')
    assert.equal(sent().length, 0)
    assert.equal(page.request().status, 'pending')
    for (const delay of [500, 1000, 0]) {
        if (lost) t.mock.timers.tick(10000)
        else page.dataRequests().at(-1).ack({success: false})
        if (delay) t.mock.timers.tick(delay)
    }
    await settle()
    assert.equal(page.request().status, 'failed')
    page.request().retryRequest()
    page.request().retryRequest()
    await settle()
    assert.equal(page.dataRequests().length, 4)
    assert.equal(page.request().status, 'pending')
    assert.equal(sent().length, 0)
    page.dataRequests()[0].ack({success: true})
    await settle()
    assert.equal(sent().length, 0)
    await page.answerData({comments: [comment(2, SESSION, STEP, 'recovered')]})
    assert.equal(sent().length, 1)
    assert.equal(sent()[0].data.data.data['inlineComments[1]'][0].text, 'recovered')
    assert.deepEqual(sent()[0].data.data.data['inlineComments[2]'], [])
    assert.equal(sent()[0].data.data.data['inlineComments[1]'][0].tags, '[]')
})
