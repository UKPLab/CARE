/**
 * Regression tests for the records the Annotator passes on to the study (#507).
 *
 * Mounts the real Annotator options (computed, watchers, provide/inject) with Vue's custom
 * renderer, so no DOM is needed, and checks the result against the real Sidebar and Highlights
 * predicates and the real Study.updateStudyData.
 *
 * Run from `frontend`: npm run test:unit
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {computed, createRenderer, h, nextTick, reactive} from 'vue'
import {isInSessionScope} from '../src/assets/annotations.js'

const downloads = []

/** Evaluates the options object of an SFC, replacing its imports with the given stubs. */
function loadOptions(path, stubs = {}) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    const importPattern = /^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
    const names = [...script.matchAll(importPattern)].flatMap(([, clause]) =>
        clause.replace(/[{}]/g, '').split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
    const body = script.replace(importPattern, '').replace('export default', 'return')
    return new Function(...names, body)(...names.map(name => stubs[name] ?? {}))
}

const AnnotatorOptions = loadOptions('components/annotator/Annotator.vue', {
    computed,
    debounce: fn => fn,
    mapMutations: () => ({}),
    mergeAnnotationsAndComments: (annotations, comments) => ({annotations, comments}),
    downloadObjectsAs: content => downloads.push(content),
})
const SidebarOptions = loadOptions('components/annotator/sidebar/Sidebar.vue')
const StudyOptions = loadOptions('components/Study.vue', {computed})

const DOC = 7
const SESSION = 42
const STEP = 9
const LATER_STEP = 10

const record = (id, studySessionId, studyStepId, extra = {}) => ({
    id, documentId: DOC, studySessionId, studyStepId, anchors: null,
    annotationId: null, parentCommentId: null, ...extra,
})

const DOCUMENT_LEVEL = record(1, null, null)
const CURRENT = record(2, SESSION, STEP)
const OTHER_SESSION = record(3, SESSION + 1, STEP)
const OTHER_STEP = record(4, SESSION, LATER_STEP)
const OTHER_DOCUMENT = record(5, null, null, {documentId: DOC + 1})
const SESSIONLESS_WITH_STEP = record(6, null, STEP)
const ALL_RECORDS = [DOCUMENT_LEVEL, CURRENT, OTHER_SESSION, OTHER_STEP, OTHER_DOCUMENT, SESSIONLESS_WITH_STEP]

const stepWith = (id, flag) => ({
    id, configuration: {settings: flag === undefined ? {} : {showAllDocumentAnnotations: flag}},
})

/**
 * Mounts an Annotator for one step, wired to Study the way Study.vue wires it, and loads the
 * records into the store afterwards, like the socket refresh does.
 */
function mountAnnotator({
    steps = [], studySessionId = SESSION, studyStepId = STEP, currentStepId = studyStepId,
    settings = {}, sessions = [], studies = [], records = [],
} = {}) {
    const state = reactive({records: [], currentStepId})
    const study = {studyData: {}}
    const getters = {
        'auth/getUserId': 1,
        'settings/getValue': key => settings[key],
        'table/annotation/getByKey': (key, value) => state.records.filter(r => r[key] === value),
        'table/annotation/get': id => state.records.find(r => r.id === id),
        'table/comment/getFiltered': predicate => state.records.filter(predicate),
        'table/study/get': id => studies.find(s => s.id === id),
        'table/study_session/getAll': sessions,
        'table/study_step/get': id => steps.find(s => s.id === id),
        'table/tag/get': () => undefined,
        'table/user_environment/getAll': [],
    }

    const {created: _c, mounted: _m, beforeUnmount: _b, unmounted: _u, ...options} = AnnotatorOptions
    const Annotator = {...options, components: {}, render: () => null}
    let instance
    const Parent = {
        provide: () => ({
            studySessionId: computed(() => studySessionId),
            currentStudyStep: computed(() => steps.find(s => s.id === state.currentStepId) ?? null),
        }),
        render: () => h(Annotator, {
            documentId: DOC,
            studyStepId,
            ref: el => { instance = el ?? instance },
            'onUpdate:data': data => StudyOptions.methods.updateStudyData.call(study, studyStepId, 'annotator', data),
        }),
    }

    const noop = () => {}
    const {createApp} = createRenderer({
        patchProp: noop, insert: noop, remove: noop, createElement: () => ({}), createText: () => ({}),
        createComment: () => ({}), setText: noop, setElementText: noop, parentNode: () => null, nextSibling: () => null,
    })
    const app = createApp(Parent)
    Object.assign(app.config.globalProperties, {
        $store: {getters}, $socket: {emit: noop}, $t: key => key, eventBus: {on: noop, off: noop},
    })
    app.mount({})

    state.records = records
    return {
        state,
        vm: instance,
        emitted: () => study.studyData[studyStepId]?.annotator,
        providedFlag: () => instance.$.provides.showAllDocumentAnnotations.value,
        getters,
    }
}

const ids = records => records.map(r => r.id).sort((a, b) => a - b)

async function emittedIds(annotator) {
    await nextTick()
    return {annotations: ids(annotator.emitted().annotations), comments: ids(annotator.emitted().comments)}
}

/** The ids the real Sidebar lists for the same store and flag. */
function sidebarIds(annotator) {
    return ids(SidebarOptions.computed.documentComments.call({
        $store: {getters: annotator.getters},
        documentId: DOC,
        studySessionId: SESSION,
        studyStepId: STEP,
        showAllDocumentAnnotations: annotator.providedFlag(),
    }))
}

/** The ids the real Highlights predicate shows for the same store and flag. */
function highlightIds(annotator) {
    const scope = {studySessionId: SESSION, studyStepId: STEP, showAllDocumentAnnotations: annotator.providedFlag()}
    return ids(ALL_RECORDS.filter(r => r.documentId === DOC && isInSessionScope(r, scope)))
}

const both = expected => ({annotations: expected, comments: expected})

test('flag on: document-level records reach the study data', async () => {
    const annotator = mountAnnotator({steps: [stepWith(STEP, true)], records: [DOCUMENT_LEVEL, OTHER_DOCUMENT]})
    assert.deepEqual(await emittedIds(annotator), both([1]))
})

test('flag on: current session and step are kept next to document-level records', async () => {
    const annotator = mountAnnotator({steps: [stepWith(STEP, true)], records: ALL_RECORDS})
    assert.deepEqual(await emittedIds(annotator), both([1, 2]))
    assert.deepEqual(sidebarIds(annotator), [1, 2])
    assert.deepEqual(highlightIds(annotator), [1, 2])
})

for (const flag of [false, undefined]) {
    test(`flag ${flag}: only the current session and step reach the study data`, async () => {
        const annotator = mountAnnotator({steps: [stepWith(STEP, flag)], records: ALL_RECORDS})
        assert.deepEqual(await emittedIds(annotator), both([2]))
        assert.deepEqual(sidebarIds(annotator), [2])
        assert.deepEqual(highlightIds(annotator), [2])
    })
}

test('replies of the current step stay in the study data, the sidebar lists only root comments', async () => {
    const reply = record(8, SESSION, STEP, {parentCommentId: CURRENT.id})
    const annotator = mountAnnotator({steps: [stepWith(STEP, true)], records: [...ALL_RECORDS, reply]})
    assert.deepEqual((await emittedIds(annotator)).comments, [1, 2, 8])
    assert.deepEqual(sidebarIds(annotator), [1, 2])
})

test('the flag of the own step decides after Study moved on to a later step', async () => {
    const steps = [stepWith(STEP, true), stepWith(LATER_STEP, undefined)]
    const annotator = mountAnnotator({steps, records: ALL_RECORDS})
    assert.deepEqual(await emittedIds(annotator), both([1, 2]))

    annotator.state.currentStepId = LATER_STEP
    annotator.state.records = [...ALL_RECORDS]
    assert.deepEqual(await emittedIds(annotator), both([1, 2]))
    assert.equal(annotator.providedFlag(), true)
})

test('the flag of a later step does not add document-level records to an earlier step', async () => {
    const steps = [stepWith(STEP, false), stepWith(LATER_STEP, true)]
    const annotator = mountAnnotator({steps, records: ALL_RECORDS})
    assert.deepEqual(await emittedIds(annotator), both([2]))

    annotator.state.currentStepId = LATER_STEP
    annotator.state.records = [...ALL_RECORDS]
    assert.deepEqual(await emittedIds(annotator), both([2]))
    assert.equal(annotator.providedFlag(), false)
})

test('outside a study: records of open studies stay hidden', async () => {
    const annotator = mountAnnotator({
        studySessionId: null, studyStepId: null, records: ALL_RECORDS,
        sessions: [{id: SESSION, studyId: 1}, {id: SESSION + 1, studyId: 2}],
        studies: [{id: 1, closed: null}, {id: 2, closed: '2026-01-01'}],
    })
    assert.deepEqual(await emittedIds(annotator), both([1, 3, 6]))
})

test('outside a study with download allowed: only records without a session', async () => {
    const annotator = mountAnnotator({
        studySessionId: null, studyStepId: null, records: ALL_RECORDS,
        settings: {'annotator.download.enabledBeforeStudyClosing': 'true'},
    })
    assert.deepEqual(await emittedIds(annotator), both([1, 6]))
})

test('session placeholder 0: nothing is passed on, even with the flag on', async () => {
    const annotator = mountAnnotator({studySessionId: 0, steps: [stepWith(STEP, true)], records: ALL_RECORDS})
    assert.deepEqual(await emittedIds(annotator), both([]))
})

const allowDownload = {'annotator.download.enabledBeforeStudyClosing': 'true'}

test('download: records of the own session across steps, without document-level records', async () => {
    const annotator = mountAnnotator({steps: [stepWith(STEP, true)], settings: allowDownload, records: ALL_RECORDS})
    await nextTick()
    downloads.length = 0
    annotator.vm.downloadAnnotations()
    assert.deepEqual(ids(downloads[0].annotations), [2, 4])
    assert.deepEqual(ids(downloads[0].comments), [2, 4])
})

test('download stays disabled when only document-level records are visible', async () => {
    const annotator = mountAnnotator({steps: [stepWith(STEP, true)], settings: allowDownload, records: [DOCUMENT_LEVEL]})
    await nextTick()
    assert.equal(annotator.vm.sidebarButtons.find(b => b.id === 'download-annotations').disabled, true)
})
