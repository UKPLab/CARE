/**
 * Tests of the Criteria tab of the Assessment Management Dashboard (Stage 3A).
 *
 * Pure parts (form mapping, validation, request helper) run directly. The components are the real ones
 * (CriterionModal with its two steps, StepperModal, BasicModal, the dashboard page, the table panel and the
 * criteria mixin) mounted with the real Vue, vue-i18n, Bootstrap and the English catalog on a Happy DOM
 * document. Only BasicTable, BasicButton and ConfirmModal are light stand-ins, and the backend is an
 * in-memory fake that follows the criterion* socket contract of backend/webserver/sockets/criterion.js
 * (the real events were also driven with the same payloads against a running backend, see the report).
 *
 * Run from `frontend`: npm run test:unit
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {afterEach, test} from 'node:test'
import {setTimeout as wait} from 'node:timers/promises'
import {Window} from 'happy-dom'

const window = new Window()
Object.assign(globalThis, {
    window,
    document: window.document,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    Node: window.Node,
    Event: window.Event,
    getComputedStyle: window.getComputedStyle.bind(window),
})

const {compile, createApp, h, nextTick} = await import('vue')
const {createI18n} = await import('vue-i18n')
const {Modal: BootstrapModal} = createRequire(import.meta.url)('bootstrap')

const DIR = '../src/components/dashboard/assessments/'
const form = await import(`${DIR}criterionForm.js`)
const socketLib = await import(`${DIR}assessmentSocket.js`)
const validation = await import(`${DIR}assessmentValidation.js`)
const constants = await import(`${DIR}assessmentConstants.js`)
const mockStore = await import(`${DIR}assessmentMockStore.js`)
const tableConstants = await import('../src/basic/dashboard/constants.js')

const en = JSON.parse(readFileSync(new URL('../../utils/modules/i18n/en/assessmentManagement.json', import.meta.url), 'utf8'))
const MESSAGES = {
    assessmentManagement: en,
    common: {close: 'Close', previous: 'Previous', nextText: 'Next', submitText: 'Submit', abort: 'Abort', confirm: 'Confirm'},
}

/** Evaluates the options object and the template of an SFC, replacing its imports with the given stubs. */
function loadComponent(path, stubs = {}) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    const importPattern = /^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
    const names = [...script.matchAll(importPattern)].flatMap(([, clause]) =>
        clause.replace(/[{}]/g, '').split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
    const options = new Function(...names, script.replace(importPattern, '').replace('export default', 'return'))(
        ...names.map(name => stubs[name] ?? {}))
    const template = source.match(/<template>([\s\S]*)<\/template>/)[1]
    return {...options, render: compile(template, {isCustomElement: tag => tag === 'vr'})}
}

/** Evaluates a plain module whose default export is an object (the criteria mixin). */
function loadMixin(path, stubs = {}) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
    const importPattern = /^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
    const names = [...source.matchAll(importPattern)].flatMap(([, clause]) =>
        clause.replace(/[{}]/g, '').split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
    return new Function(...names, source.replace(importPattern, '').replace('export default', 'return'))(
        ...names.map(name => stubs[name] ?? {}))
}

/** Stand-in for resolveApiMessage: the backend's English `message`, or the English text of a client-side key. */
const translate = key => key.split('.').reduce((node, part) => node?.[part], MESSAGES) ?? key
const resolveApiMessage = response => response.message ?? translate(response.key)

// A button that renders its title or text; clicks and `disabled` reach the element like on the real one.
const BasicButton = {
    props: ['text', 'title', 'icon', 'disabled'],
    render() {
        return h('button', {disabled: this.disabled, 'data-icon': this.icon, title: this.title}, this.text || this.title || '')
    },
}
const BasicModal = loadComponent('basic/Modal.vue', {Modal: BootstrapModal, uuid: () => 'uuid'})
const StepperModal = loadComponent('basic/modal/StepperModal.vue', {BasicModal, BasicButton})
const AssessmentFormField = loadComponent(`components/dashboard/assessments/AssessmentFormField.vue`)
const CriterionDetailsStep = loadComponent('components/dashboard/assessments/CriterionDetailsStep.vue', {
    AssessmentFormField,
    GRADING_FUNCTIONS: constants.GRADING_FUNCTIONS,
    parsePoints: validation.parsePoints,
})
const ScoringOptionsStep = loadComponent('components/dashboard/assessments/ScoringOptionsStep.vue', {
    BasicButton, AssessmentFormField, parsePoints: validation.parsePoints, pointBounds: form.pointBounds,
})
const CriterionModal = loadComponent('components/dashboard/assessments/CriterionModal.vue', {
    StepperModal,
    CriterionDetailsStep,
    ScoringOptionsStep,
    resolveApiMessage,
    requestAssessment: socketLib.requestAssessment,
    visibleErrors: validation.visibleErrors,
    ...form,
})
const criteriaBackendMixin = loadMixin('components/dashboard/assessments/criteriaBackendMixin.js', {
    resolveApiMessage, requestAssessment: socketLib.requestAssessment, escapeHtml: form.escapeHtml,
})

// ---------------------------------------------------------------------------------------------------------------
// Fake backend with the criterion* contract

const clone = value => JSON.parse(JSON.stringify(value))
const ok = data => ({success: true, data})
const fail = (key, params = {}, message = key) => ({success: false, key, params, message})

/** In-memory version of the Stage 2A handlers: ids, groups, unique versions, ordered options, delete guard. */
function makeBackend(seed = []) {
    let nextId = 1000
    let nextGroup = 500
    let nextOption = 9000
    const rows = clone(seed)
    const referenced = new Set()
    const store = (fields, groupId) => {
        const id = ++nextId
        const row = {
            ...clone(fields), id, criterionGroupId: groupId, createdAt: '2026-11-10T10:00:00.000Z',
            scoringOptions: fields.scoringOptions.map((o, i) => ({id: ++nextOption, criterionId: id, ...o, position: i + 1})),
        }
        delete row.copyFromId
        rows.push(row)
        return clone(row)
    }
    return {
        rows,
        referenced,
        handlers: {
            criterionGetAll: () => ok(clone(rows)),
            criterionGet: ({criterionId}) => {
                const row = rows.find(r => r.id === criterionId)
                return row ? ok(clone(row)) : fail('errors.assessment.criterion.notFound')
            },
            criterionCreate: payload => ok(store(payload, ++nextGroup)),
            criterionCreateVersion: payload => {
                const source = rows.find(r => r.id === payload.copyFromId)
                if (!source || source.criterionGroupId !== payload.criterionGroupId) {
                    return fail('errors.assessment.criterion.copySourceMismatch')
                }
                if (rows.some(r => r.criterionGroupId === payload.criterionGroupId && r.versionNumber === payload.versionNumber)) {
                    return fail('errors.assessment.criterion.versionExists', {versionNumber: payload.versionNumber},
                        `Version "${payload.versionNumber}" already exists for this criterion.`)
                }
                return ok(store(payload, payload.criterionGroupId))
            },
            criterionDelete: ({criterionId}) => {
                const index = rows.findIndex(r => r.id === criterionId)
                if (index < 0) return fail('errors.assessment.criterion.notFound')
                if (referenced.has(criterionId)) {
                    return fail('errors.assessment.criterion.inUse', {criterionId, count: 1, rubricIds: '7'},
                        `Criterion version ${criterionId} cannot be deleted: it is used by 1 rubric version(s) (7).`)
                }
                const [removed] = rows.splice(index, 1)
                return ok({id: removed.id, criterionGroupId: removed.criterionGroupId})
            },
        },
    }
}

const criterion = (id, group, version, extra = {}) => ({
    id, criterionGroupId: group, versionNumber: version, name: `Criterion ${group}`, description: 'desc',
    minPoints: -2, maxPoints: 3.5, function: 'auto_grading', subjective: true, expertLevel: 2,
    createdAt: `2026-11-0${id % 9 + 1}T08:00:00.000Z`,
    scoringOptions: [
        {id: id * 10 + 2, criterionId: id, points: 3.5, description: 'best', position: 2},
        {id: id * 10 + 1, criterionId: id, points: -2, description: 'worst', position: 1},
    ],
    ...extra,
})

/** Socket whose answers come from handlers; a handler returning undefined leaves the ack pending. */
function fakeSocket(handlers) {
    const calls = []
    const pending = []
    return {
        connected: true,
        calls,
        pending,
        emit(event, payload, ack) {
            calls.push({event, payload: clone(payload)})
            const response = handlers[event]?.(payload)
            if (response === undefined) {
                pending.push({event, ack})
            } else {
                queueMicrotask(() => ack(response))
            }
        },
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Mounting

const cleanups = []
let errors = []
window.addEventListener('error', event => {
    errors.push(event.error ?? event.message)
    event.preventDefault()
})

afterEach(async () => {
    while (cleanups.length) {
        cleanups.pop()()
    }
    await wait(60)
    document.body.innerHTML = ''
    document.body.removeAttribute('style')
    document.body.removeAttribute('class')
    assert.deepEqual(errors.map(String), [])
    errors = []
})

function mount(component, props, globals) {
    const app = createApp({render: () => h(component, {ref: 'root', ...props})})
    app.use(createI18n({legacy: true, locale: 'en', messages: {en: MESSAGES}, missingWarn: false, fallbackWarn: false}))
    app.config.warnHandler = () => {}
    app.config.errorHandler = error => errors.push(error)
    Object.assign(app.config.globalProperties, globals)
    const host = document.createElement('div')
    document.body.append(host)
    cleanups.push(() => app.unmount())
    return app.mount(host).$refs.root
}

async function waitFor(condition, label) {
    for (let i = 0; i < 300; i++) {
        if (condition()) return
        await wait(2)
    }
    assert.fail(`Timed out waiting for ${label}`)
}

const flush = async () => {
    await wait(5)
    await nextTick()
}
const text = element => element.textContent.replace(/\s+/g, ' ').trim()
const $ = selector => document.querySelector(selector)
const $$ = selector => [...document.querySelectorAll(selector)]
const buttonByText = label => $$('button').find(b => text(b) === label)

/** Sets an input like a user: one event, then Vue renders before the next field changes. */
async function setValue(selector, value) {
    const element = $(selector)
    element.value = value
    element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}))
    await nextTick()
}

async function click(label) {
    const button = buttonByText(label)
    assert.ok(button, `button "${label}" not found, have: ${$$('button').map(text).join(' | ')}`)
    assert.equal(button.disabled, false, `button "${label}" is disabled`)
    button.dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
}

/** Mounts the real CriterionModal over a fake backend. */
function mountModal({criteria = [], backend = makeBackend(criteria), socket = fakeSocket(backend.handlers)} = {}) {
    const toasts = []
    const saved = []
    const modal = mount(CriterionModal, {criteria, onSaved: data => saved.push(data)}, {
        $socket: socket,
        eventBus: {emit: (event, data) => toasts.push({event, ...data})},
    })
    return {modal, socket, backend, toasts, saved}
}

const isOpen = modal => modal.$refs.stepper.$refs.stepperModal.isShown
const optionPoints = () => $$('[id^="option-points-"]').map(input => input.value)
const optionTexts = () => $$('[id^="option-description-"]').map(input => input.value)

async function fillDetails(values) {
    for (const [selector, value] of Object.entries(values)) {
        await setValue(selector, value)
    }
}

// ---------------------------------------------------------------------------------------------------------------
// 1. Form mapping and validation (pure)

test('payload: empty optional numbers and function become null, never 0; options keep their order and carry no ids', () => {
    const f = {...form.emptyCriterionForm(), versionNumber: ' 1.0 ', name: 'N'}
    const payload = form.toCriterionPayload(f, [
        {uid: 5, id: 77, points: '2', description: 'b'},
        {uid: 6, points: -1.5, description: ''},
        {uid: 7, points: 0.25, description: 'c'},
    ])
    assert.deepEqual(payload, {
        versionNumber: '1.0', name: 'N', description: '', minPoints: null, maxPoints: null, function: null,
        subjective: false, expertLevel: 1,
        scoringOptions: [{points: 2, description: 'b'}, {points: -1.5, description: ''}, {points: 0.25, description: 'c'}],
    })
    assert.equal('code' in payload, false)
    assert.equal('gradingFunction' in payload, false)
})

test('payload: zero is kept as zero, and the function select maps to the backend field `function`', () => {
    const f = {...form.emptyCriterionForm(), versionNumber: '1', name: 'N', minPoints: 0, maxPoints: 0, function: 'check_pdf_pages'}
    const payload = form.toCriterionPayload(f, [])
    assert.equal(payload.minPoints, 0)
    assert.equal(payload.maxPoints, 0)
    assert.equal(payload.function, 'check_pdf_pages')
    assert.deepEqual(payload.scoringOptions, [])
})

test('form from a stored version: null becomes an empty input, options come in stored order without ids', () => {
    const stored = criterion(5, 3, '2', {minPoints: null, maxPoints: null, function: null, description: null})
    const f = form.formFromCriterion(stored)
    assert.deepEqual([f.minPoints, f.maxPoints, f.function, f.description], ['', '', '', ''])
    assert.deepEqual(form.optionsFromCriterion(stored), [{points: -2, description: 'worst'}, {points: 3.5, description: 'best'}])
})

test('version request: group, source, trimmed new version number and the full edited content', () => {
    const stored = criterion(5, 3, '1')
    const f = {...form.formFromCriterion(stored), versionNumber: ' 2 ', minPoints: ''}
    const request = form.versionRequest(stored, f, form.optionsFromCriterion(stored))
    assert.equal(request.criterionGroupId, 3)
    assert.equal(request.copyFromId, 5)
    assert.equal(request.versionNumber, '2')
    assert.equal(request.minPoints, null)
    assert.equal(request.maxPoints, 3.5)
    assert.equal(request.scoringOptions.length, 2)
})

test('validation: name and version are required, names need not be unique, min must not exceed max', () => {
    const valid = {...form.emptyCriterionForm(), name: 'N', versionNumber: '1'}
    assert.deepEqual(form.validateCriterionForm(valid), {})
    assert.deepEqual(form.validateCriterionForm({...valid, name: '  ', versionNumber: ''}), {name: 'required', versionNumber: 'required'})
    assert.equal(form.validateCriterionForm({...valid, minPoints: 3, maxPoints: 2}).maxPoints, 'maxBelowMin')
    assert.deepEqual(form.validateCriterionForm({...valid, minPoints: 2, maxPoints: 2}), {})
    assert.deepEqual(form.validateCriterionForm({...valid, minPoints: -5, maxPoints: ''}), {})   // only one bound set
    assert.equal(form.validateCriterionForm({...valid, minPoints: Number.NaN}).minPoints, 'number')
    assert.equal(form.validateCriterionForm({...valid, name: 'x'.repeat(256)}).name, 'tooLong')
    assert.equal(form.validateCriterionForm({...valid, expertLevel: 1.5}).expertLevel, 'integer')
})

test('expert level: any whole number the database can hold is valid; decimals, non-numbers and empty are not', () => {
    const level = expertLevel => form.validateCriterionForm({...form.emptyCriterionForm(), name: 'N', versionNumber: '1', expertLevel}).expertLevel
    for (const value of [0, 1, 2, 3, 7, 100, 1000000, -1, -50, 2147483647, -2147483648]) {
        assert.equal(level(value), undefined, `accepted: ${value}`)
    }
    for (const value of [1.5, 0.1, -2.25, Number.NaN, Infinity, 'abc', '2']) {
        assert.equal(level(value), 'integer', `refused: ${value}`)
    }
    for (const value of ['', null, undefined, '  ']) {
        assert.equal(level(value), 'required', `empty: ${JSON.stringify(value)}`)
    }
    assert.equal(level(2147483648), 'integerRange')
    assert.equal(level(-2147483649), 'integerRange')
    assert.equal(form.toCriterionPayload({...form.emptyCriterionForm(), versionNumber: '1', name: 'N', expertLevel: 42}, []).expertLevel, 42)
})

test('validation of options: any number is fine without bounds; empty lists, duplicates and empty descriptions are allowed', () => {
    assert.deepEqual(form.validateOptionList([]), {})
    assert.deepEqual(form.validateOptionList([
        {uid: 1, points: -3.25, description: ''}, {uid: 2, points: -3.25, description: 'same points'}, {uid: 3, points: 1e6, description: ''},
    ]), {})
    assert.deepEqual(form.validateOptionList([{uid: 1, points: ''}, {uid: 2, points: Number.NaN}]),
        {1: {points: 'required'}, 2: {points: 'number'}})
})

const opts = (...points) => points.map((p, i) => ({uid: i + 1, points: p, description: ''}))

test('version numbers: dotted numbers are accepted, everything else is refused', () => {
    const check = versionNumber => form.validateCriterionForm({...form.emptyCriterionForm(), name: 'N', versionNumber}).versionNumber
    for (const version of ['1', '1.1', '1.1.1', '2.0.3', ' 4.5 ', '10.20.30', '007']) {
        assert.equal(check(version), undefined, `accepted: ${JSON.stringify(version)}`)
    }
    for (const version of ['abc', 'v1', '1.a', '1.2-beta', '1.', '.1', '1..2', '1,2', '-1', '1 .2', '1.2.3.', '1e3', '\u0661.\u0661']) {
        assert.equal(check(version), 'versionFormat', `refused: ${JSON.stringify(version)}`)
    }
    assert.equal(check(''), 'required')
    assert.equal(check('1'.repeat(256)), 'tooLong')
    assert.equal(form.VERSION_PATTERN.source, '^\\d+(\\.\\d+)*$')
})

test('option points must lie inside the criterion range: at the bounds and inside is valid, outside is not, values are not changed', () => {
    assert.deepEqual(form.validateOptionList(opts(0, 4, 2, 1.5, 0.001, 3.999), 0, 4), {})
    assert.deepEqual(form.validateOptionList(opts(-0.01, 2, 4.01), 0, 4), {1: {points: 'pointsBetween'}, 3: {points: 'pointsBetween'}})
    assert.deepEqual(form.validateOptionList(opts(-3, -1.5, -1), -3, -1), {})
    assert.deepEqual(form.validateOptionList(opts(0, -3.01), -3, -1), {1: {points: 'pointsBetween'}, 2: {points: 'pointsBetween'}})
    assert.deepEqual(form.validateOptionList(opts(2), 2, 2), {})
    const original = opts(9, -9)
    const before = JSON.stringify(original)
    form.validateOptionList(original, 0, 4)
    assert.equal(JSON.stringify(original), before, 'nothing is clamped or rewritten')
})

test('option range with one bound or none: only the bounds that exist are enforced, empty and invalid bounds count as none', () => {
    assert.deepEqual(form.validateOptionList(opts(1, 99999), 1, ''), {})
    assert.deepEqual(form.validateOptionList(opts(0.99), 1, ''), {1: {points: 'pointsAtLeast'}})
    assert.deepEqual(form.validateOptionList(opts(-5, -1000), '', -5), {})
    assert.deepEqual(form.validateOptionList(opts(-4.9), '', -5), {1: {points: 'pointsAtMost'}})
    assert.deepEqual(form.validateOptionList(opts(-1e9, 1e9), '', ''), {})
    assert.deepEqual(form.validateOptionList(opts(-1e9, 1e9), Number.NaN, 'x'), {})
    assert.deepEqual(form.validateOptionList(opts(1, -1), 0), {2: {points: 'pointsAtLeast'}}, 'missing max argument means none')
})

test('changing the bounds revalidates the same options', () => {
    const options = opts(1, 3)
    assert.deepEqual(form.validateOptionList(options, 0, 4), {})
    assert.deepEqual(form.validateOptionList(options, 0, 2), {2: {points: 'pointsBetween'}})
    assert.deepEqual(form.validateOptionList(options, 2, 4), {1: {points: 'pointsBetween'}})
    assert.deepEqual(form.validateOptionList(options, 0, ''), {})
    assert.deepEqual(form.validateOptionList(options, '', ''), {})
    assert.deepEqual(form.pointBounds('', 'x'), {min: null, max: null})
    assert.deepEqual(form.pointBounds(-2, 3.5), {min: -2, max: 3.5})
})

test('backend errors are assigned to the field and step that shows them', () => {
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.criterion.versionExists'}), {field: 'versionNumber', step: 0})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.fieldRequired', params: {field: 'name'}}), {field: 'name', step: 0})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.optionInvalid', params: {position: 2}}), {field: null, step: 1})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.pointsRange'}), {field: 'maxPoints', step: 0})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.versionFormat'}), {field: 'versionNumber', step: 0})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.optionBelowMin', params: {position: 1, min: 0}}), {field: null, step: 1})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.optionAboveMax', params: {position: 1, max: 4}}), {field: null, step: 1})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.accessDenied'}), {field: null, step: null})
    assert.deepEqual(form.errorTarget(undefined), {field: null, step: null})
})

test('escapeHtml neutralises markup in names shown in the confirm dialog', () => {
    assert.equal(form.escapeHtml('<img src=x onerror="a()">&\''), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;')
})

// ---------------------------------------------------------------------------------------------------------------
// 2. Request helper

test('requestAssessment resolves with the data of a successful answer', async () => {
    const socket = fakeSocket({criterionGetAll: () => ok([1, 2])})
    assert.deepEqual(await socketLib.requestAssessment(socket, 'criterionGetAll', {}), [1, 2])
    assert.deepEqual(socket.calls, [{event: 'criterionGetAll', payload: {}}])
})

test('requestAssessment rejects with the backend answer, a missing connection and a missing answer', async () => {
    const denied = fakeSocket({criterionGetAll: () => fail('errors.assessment.accessDenied')})
    await assert.rejects(socketLib.requestAssessment(denied, 'criterionGetAll'),
        error => error.key === 'errors.assessment.accessDenied' && error.response.success === false)

    const offline = {connected: false, emit: () => assert.fail('must not emit')}
    await assert.rejects(socketLib.requestAssessment(offline, 'x'), error => error.key === socketLib.CLIENT_ERROR_KEYS.notConnected)

    const silent = fakeSocket({})
    await assert.rejects(socketLib.requestAssessment(silent, 'x', {}, {timeoutMs: 20}), error => error.key === socketLib.CLIENT_ERROR_KEYS.timeout)
    silent.pending[0].ack(ok(1))   // a late answer after the timeout changes nothing
})

// ---------------------------------------------------------------------------------------------------------------
// 3. CriterionModal: create

test('create: titles, no code field, two steps, ordered options with negative and decimal points are sent to criterionCreate', async () => {
    const {modal, socket, toasts, saved} = mountModal()
    modal.openCreate()
    await flush()
    assert.equal(text($('.modal-title') ?? document.body).includes('Add Criterion'), true)
    assert.equal($('#criterion-code'), null)
    assert.equal($('#criterion-name') !== null && $('#criterion-version') !== null, true)

    assert.equal(buttonByText('Next').disabled, true, 'required fields are empty')
    await fillDetails({'#criterion-name': 'Clarity', '#criterion-version': '1', '#criterion-description': 'How clear',
        '#criterion-max': '4', '#criterion-function': 'manual_grading', '#criterion-expert': '2'})
    $('#criterion-subjective').checked = true
    $('#criterion-subjective').dispatchEvent(new window.Event('change', {bubbles: true}))
    await flush()
    await click('Next')

    await click('Add Scoring Option')
    await click('Add Scoring Option')
    await click('Add Scoring Option')
    const points = $$('[id^="option-points-"]')
    await setValue(`#${points[0].id}`, '3')
    await setValue(`#${points[1].id}`, '-1.5')
    await setValue(`#${points[2].id}`, '0.25')
    const descriptions = $$('[id^="option-description-"]')
    await setValue(`#${descriptions[0].id}`, 'three')
    await setValue(`#${descriptions[1].id}`, 'deduct')
    await setValue(`#${descriptions[2].id}`, 'partial')
    await flush()
    // reorder: the first option moves down, so the order is -1.5, 3, 0.25 (not sorted by points)
    await $$('button[title="Move down"]')[0].dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    assert.deepEqual(optionPoints(), ['-1.5', '3', '0.25'])

    await click('Create Criterion')
    await waitFor(() => saved.length === 1, 'saved event')
    assert.deepEqual(socket.calls.map(c => c.event), ['criterionCreate'])
    assert.deepEqual(socket.calls[0].payload, {
        versionNumber: '1', name: 'Clarity', description: 'How clear', minPoints: null, maxPoints: 4, function: 'manual_grading',
        subjective: true, expertLevel: 2,
        scoringOptions: [{points: -1.5, description: 'deduct'}, {points: 3, description: 'three'}, {points: 0.25, description: 'partial'}],
    })
    assert.equal(toasts.at(-1).variant, 'success')
    assert.equal(saved[0].scoringOptions.map(o => o.points).join(), '-1.5,3,0.25')
    await waitFor(() => !isOpen(modal), 'modal to close')
})

test('create: a criterion without scoring options and with empty point boundaries can be created', async () => {
    const {modal, socket, saved} = mountModal()
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'Bare', '#criterion-version': '1'})
    await flush()
    await click('Next')
    assert.equal(text(document.body).includes('No scoring options.'), true)
    await click('Create Criterion')
    await waitFor(() => saved.length === 1, 'saved event')
    assert.equal(socket.calls[0].payload.minPoints, null)
    assert.equal(socket.calls[0].payload.maxPoints, null)
    assert.equal(socket.calls[0].payload.function, null)
    assert.deepEqual(socket.calls[0].payload.scoringOptions, [])
})

test('create: an option without a number blocks the submit; step buttons follow the validation', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1', '#criterion-min': '5', '#criterion-max': '2'})
    await flush()
    assert.equal(buttonByText('Next').disabled, true, 'min above max')
    await setValue('#criterion-max', '6')
    await flush()
    await click('Next')
    await click('Add Scoring Option')
    assert.equal(buttonByText('Create Criterion').disabled, true, 'empty points')
    await setValue(`#${$$('[id^="option-points-"]')[0].id}`, '5.5')
    await flush()
    assert.equal(buttonByText('Create Criterion').disabled, false)
})

test('create: a second click while the first request is pending sends nothing', async () => {
    const backend = makeBackend()
    const handlers = {...backend.handlers, criterionCreate: () => undefined}   // never answers by itself
    const {modal, socket, saved} = mountModal({backend, socket: fakeSocket(handlers)})
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1'})
    await flush()
    await click('Next')
    await click('Create Criterion')
    modal.submit()
    modal.submit()
    await flush()
    assert.equal(socket.calls.filter(c => c.event === 'criterionCreate').length, 1)

    socket.pending[0].ack(ok({...criterion(1, 1, '1'), name: 'N'}))
    await waitFor(() => saved.length === 1, 'saved event')
    assert.equal(socket.calls.filter(c => c.event === 'criterionCreate').length, 1)
})

test('create: a backend validation error keeps the modal open and every value, and shows the message next to the field', async () => {
    const backend = makeBackend()
    const handlers = {...backend.handlers, criterionCreate: () => fail('errors.assessment.fieldRequired', {field: 'name'}, 'name is required.')}
    const {modal, saved, toasts} = mountModal({backend, socket: fakeSocket(handlers)})
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'Keep me', '#criterion-version': '1', '#criterion-min': '-3', '#criterion-description': 'kept text'})
    await flush()
    await click('Next')
    await click('Add Scoring Option')
    await setValue(`#${$$('[id^="option-points-"]')[0].id}`, '-0.5')
    await flush()
    await click('Create Criterion')
    await flush()
    assert.equal(isOpen(modal), true)
    assert.equal(saved.length, 0)
    assert.equal(toasts.some(t => t.variant === 'success'), false)
    // the field error belongs to step 1, the modal went back to it
    assert.equal(text(document.body).includes('name is required.'), true)
    assert.equal($('#criterion-name').value, 'Keep me')
    assert.equal($('#criterion-min').value, '-3')
    assert.equal($('#criterion-description').value, 'kept text')
    await click('Next')
    assert.deepEqual(optionPoints(), ['-0.5'])
})

test('create: network failure (not connected) is reported in the modal without losing the input', async () => {
    const socket = fakeSocket({})
    const {modal, saved} = mountModal({socket})
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'Offline', '#criterion-version': '1'})
    await flush()
    await click('Next')
    socket.connected = false
    await click('Create Criterion')
    await flush()
    assert.equal(isOpen(modal), true)
    assert.equal(saved.length, 0)
    assert.equal($('.alert-danger')?.textContent.includes(en.messages.notConnected), true)
    socket.connected = true
    socket.emit = (event, payload, ack) => queueMicrotask(() => ack(ok({...criterion(9, 9, '1'), name: 'Offline'})))
    await click('Create Criterion')
    await waitFor(() => saved.length === 1, 'saved event after the retry')
    assert.equal(saved[0].name, 'Offline')
})

test('create: duplicate version answer from the backend is shown at the version field on step 1, even when sent from step 2', async () => {
    const backend = makeBackend([criterion(1, 1, '1')])
    const handlers = {...backend.handlers, criterionCreate: () => fail('errors.assessment.criterion.versionExists', {versionNumber: '1'}, 'Version "1" already exists for this criterion.')}
    const {modal} = mountModal({backend, socket: fakeSocket(handlers)})
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1'})
    await flush()
    await click('Next')
    await click('Create Criterion')
    await flush()
    assert.equal($('#criterion-version') !== null, true, 'back on step 1')
    assert.equal(text(document.body).includes('already exists for this criterion'), true)
    await setValue('#criterion-version', '2')   // editing the field clears its backend error
    await flush()
    assert.equal(text(document.body).includes('already exists for this criterion'), false)
})

// ---------------------------------------------------------------------------------------------------------------
// 4. CriterionModal: view

test('view: the stored version is loaded with criterionGet, every input of both steps is disabled and the last button only closes', async () => {
    const backend = makeBackend([criterion(5, 3, '2')])
    const {modal, socket, saved} = mountModal({backend})
    assert.equal(await modal.openView(5), true)
    await flush()
    assert.equal(text(document.body).includes('View Criterion — v2'), true)
    assert.deepEqual(socket.calls, [{event: 'criterionGet', payload: {criterionId: 5}}])
    assert.equal($('#criterion-name').value, 'Criterion 3')
    assert.equal($('#criterion-version').value, '2')
    const step1 = $$('input, textarea, select')
    assert.ok(step1.length >= 8)
    assert.equal(step1.every(e => e.disabled), true, 'step 1 is read-only')

    await click('Next')
    assert.deepEqual(optionPoints(), ['-2', '3.5'], 'stored order, decimals and negatives shown')
    assert.deepEqual(optionTexts(), ['worst', 'best'])
    assert.equal($$('input, textarea').every(e => e.disabled), true, 'step 2 is read-only')
    assert.equal(buttonByText('Add Scoring Option'), undefined)
    assert.equal($$('button[title="Remove scoring option"], button[title="Move up"], button[title="Move down"]').length, 0)

    await click('Close')
    await waitFor(() => !isOpen(modal), 'modal to close')
    assert.deepEqual(socket.calls.map(c => c.event), ['criterionGet'], 'closing sends nothing')
    assert.equal(saved.length, 0)
})

test('view: a version that cannot be loaded shows the error and does not open the modal', async () => {
    const {modal, toasts} = mountModal({backend: makeBackend()})
    assert.equal(await modal.openView(404), false)
    assert.equal(isOpen(modal), false)
    assert.equal(toasts.at(-1).variant, 'danger')
    assert.equal(toasts.at(-1).message, 'errors.assessment.criterion.notFound')
})

// ---------------------------------------------------------------------------------------------------------------
// 5b. Refinements: version field, version format, option range

test('version field: placeholder instead of an example text, the hint on create, rings not clipped, format error at once', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    const input = $('#criterion-version')
    assert.equal(input.getAttribute('placeholder'), 'e.g. 1.1 or 2')
    assert.equal(text(document.body).includes('Entered by you'), false, 'the example text is gone from below the field')
    assert.deepEqual($$('.form-text').map(text), ['Version number must be new.'], 'create shows the hint too')
    // the step content has side padding, so the focus and validation rings are not cut off by the modal area
    assert.ok(input.closest('.px-2'), 'padding wrapper around the step')
    assert.ok($('#criterion-name').closest('.px-2'))

    await fillDetails({'#criterion-name': 'N', '#criterion-version': 'v1'})
    await flush()
    assert.equal(input.classList.contains('is-invalid'), true, 'shown without leaving the field')
    assert.equal(text(document.body).includes('Use numbers separated by dots, for example 1, 1.1 or 2.0.3.'), true)
    assert.equal(buttonByText('Next').disabled, true)
    for (const bad of ['1.', '1.2-beta', 'abc', '1.a']) {
        await setValue('#criterion-version', bad)
        assert.equal(buttonByText('Next').disabled, true, bad)
    }
    for (const good of ['1', '1.1', '1.1.1', '2.0.3']) {
        await setValue('#criterion-version', good)
        await flush()
        assert.equal(buttonByText('Next').disabled, false, good)
        assert.equal(input.classList.contains('is-invalid'), false, good)
    }
})

test('version field: create and new version show only "Version number must be new." below the input, the view shows no hint', async () => {
    const backend = makeBackend([criterion(5, 3, '1')])
    const {modal} = mountModal({backend, criteria: backend.rows})
    await modal.openNewVersion(5)
    await flush()
    const hints = $$('.form-text').map(text)
    assert.deepEqual(hints, ['Version number must be new.'])
    assert.equal($('#criterion-version').getAttribute('placeholder'), 'e.g. 1.1 or 2')
    assert.equal(text(document.body).includes('Entered by you'), false)
    await setValue('#criterion-version', '1')   // taken: the existing message replaces nothing but adds the error
    assert.equal($$('.form-text').map(text).join(), 'Version number must be new.')
    assert.equal(text(document.body).includes('already used by this criterion'), true)
})

test('version field: a stored version that does not match the format is shown as it is and does not block copying it', async () => {
    const legacy = criterion(11, 6, 'v1-beta', {minPoints: -2, maxPoints: 4})
    const backend = makeBackend([legacy])
    const {modal, saved, socket} = mountModal({backend, criteria: backend.rows})
    await modal.openView(11)
    await flush()
    assert.equal($('#criterion-version').value, 'v1-beta')
    assert.deepEqual($$('.form-text').map(text), [], 'the read-only view has no "must be new" hint')
    assert.equal($('#criterion-version').classList.contains('is-invalid'), false, 'no validation in a read-only view')
    modal.$refs.stepper.close()
    await waitFor(() => !isOpen(modal), 'close')

    await modal.openNewVersion(11)
    await flush()
    assert.equal($('#criterion-version').value, '', 'the old number is not copied')
    await setValue('#criterion-version', '2')
    await flush()
    await click('Next')
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved')
    assert.equal(socket.calls.find(c => c.event === 'criterionCreateVersion').payload.versionNumber, '2')
    assert.equal(backend.rows[0].versionNumber, 'v1-beta', 'the stored version is untouched')
})

test('version field: a version-format answer from the backend is shown at the version field', async () => {
    const backend = makeBackend()
    const handlers = {...backend.handlers, criterionCreate: () => fail('errors.assessment.versionFormat', {}, 'Version number must be numbers separated by dots.')}
    const {modal, saved} = mountModal({backend, socket: fakeSocket(handlers)})
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1'})
    await flush()
    await click('Next')
    await click('Create Criterion')
    await flush()
    assert.equal(saved.length, 0)
    assert.equal($('#criterion-version') !== null, true, 'back on step 1')
    assert.equal(text(document.body).includes('Version number must be numbers separated by dots.'), true)
})

test('expert level: a number input replaces the dropdown, whole numbers of any size are accepted and sent', async () => {
    const {modal, socket, saved} = mountModal()
    modal.openCreate()
    await flush()
    const input = $('#criterion-expert')
    assert.equal(input.tagName, 'INPUT')
    assert.equal(input.getAttribute('type'), 'number')
    assert.equal(input.getAttribute('step'), '1')
    assert.equal(input.hasAttribute('max'), false, 'no arbitrary maximum')
    assert.equal(input.classList.contains('form-control'), true, 'same input styling as the other fields')
    assert.equal($$('select').some(select => select.id === 'criterion-expert'), false)
    assert.equal(input.value, '1')

    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1', '#criterion-expert': '12345'})
    await flush()
    assert.equal(buttonByText('Next').disabled, false)
    await click('Next')
    await click('Create Criterion')
    await waitFor(() => saved.length === 1, 'saved')
    assert.equal(socket.calls[0].payload.expertLevel, 12345)
})

test('expert level: decimals, an empty value and values beyond the database column show inline errors and block Next', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1'})
    const input = $('#criterion-expert')

    await setValue('#criterion-expert', '1.5')
    await flush()
    assert.equal(input.classList.contains('is-invalid'), true)
    assert.equal(text(document.body).includes('Enter a whole number.'), true, 'shown at once')
    assert.equal(buttonByText('Next').disabled, true)

    await setValue('#criterion-expert', '0.1')
    assert.equal(buttonByText('Next').disabled, true)

    await setValue('#criterion-expert', '3000000000')
    await flush()
    assert.equal(text(document.body).includes('fits the database'), true)
    assert.equal(buttonByText('Next').disabled, true)

    await setValue('#criterion-expert', '')
    await flush()
    assert.equal(buttonByText('Next').disabled, true, 'required')
    assert.equal(input.classList.contains('is-invalid'), false, 'an empty field waits for the first blur')
    input.dispatchEvent(new window.Event('blur'))
    await flush()
    assert.equal(input.classList.contains('is-invalid'), true)
    assert.equal(text(document.body).includes('This field is required.'), true)

    await setValue('#criterion-expert', '-3')
    await flush()
    assert.equal(buttonByText('Next').disabled, false, 'negative whole numbers are valid for the backend')
    assert.equal(input.classList.contains('is-invalid'), false)
})

test('expert level: text typed into the number input never counts as a valid level', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1', '#criterion-expert': 'abc'})
    await flush()
    // a number input holds no text: the value is empty (browsers) or not a number, either way it is refused
    assert.equal(buttonByText('Next').disabled, true)
})

test('expert level: any stored level is shown in the view and kept in a new version', async () => {
    const odd = criterion(21, 9, '1', {expertLevel: 7})
    const backend = makeBackend([odd, criterion(22, 10, '1', {expertLevel: 0}), criterion(23, 11, '1', {expertLevel: 250})])
    const {modal, saved, socket} = mountModal({backend, criteria: backend.rows})
    await modal.openView(21)
    await flush()
    assert.equal($('#criterion-expert').value, '7')
    assert.equal($('#criterion-expert').disabled, true)
    modal.$refs.stepper.close()
    await waitFor(() => !isOpen(modal), 'close')

    await modal.openNewVersion(21)
    await flush()
    assert.equal($('#criterion-expert').value, '7', 'copied into the new version')
    await setValue('#criterion-version', '2')
    await flush()
    await click('Next')
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved')
    assert.equal(socket.calls.find(c => c.event === 'criterionCreateVersion').payload.expertLevel, 7)
    assert.equal(backend.rows[0].expertLevel, 7, 'the original is unchanged')

    for (const [id, expected] of [[22, '0'], [23, '250']]) {
        modal.$refs.stepper.close()
        await waitFor(() => !isOpen(modal), 'close')
        await modal.openView(id)
        await flush()
        assert.equal($('#criterion-expert').value, expected)
    }
})

test('subjective checkbox: the box and its label show the pointer while editable, the label toggles it, the view is disabled', async () => {
    const source = readFileSync(new URL('../src/components/dashboard/assessments/CriterionDetailsStep.vue', import.meta.url), 'utf8')
    const rule = source.match(/<style scoped>([\s\S]*?)<\/style>/)[1]
    assert.match(rule, /\.criterion-subjective \.form-check-input:not\(:disabled\),/)
    assert.match(rule, /\.form-check-label \{\s*cursor: pointer;/)

    const backend = makeBackend([criterion(31, 12, '1', {subjective: false})])
    const {modal} = mountModal({backend, criteria: backend.rows})
    await modal.openNewVersion(31)
    await flush()
    const box = $('#criterion-subjective')
    assert.ok(box.closest('.criterion-subjective'), 'create and new version use the same step markup')
    assert.equal(box.disabled, false)
    assert.equal($('label[for="criterion-subjective"]') !== null, true, 'the label is bound to the box')
    modal.$refs.stepper.close()
    await waitFor(() => !isOpen(modal), 'close')
    await modal.openView(31)
    await flush()
    assert.equal($('#criterion-subjective').disabled, true, 'no pointer rule applies when disabled')
})

/** Create modal on step 2 with the given bounds and one option per given points value. */
async function createWithOptions({min = '', max = '', points = ['']} = {}) {
    const ctx = mountModal()
    ctx.modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1', '#criterion-min': String(min), '#criterion-max': String(max)})
    await flush()
    await click('Next')
    for (const _ of points) {
        await click('Add Scoring Option')
    }
    for (const [index, value] of points.entries()) {
        await setValue(`#${$$('[id^="option-points-"]')[index].id}`, String(value))
    }
    await flush()
    return ctx
}
const pointsInputs = () => $$('[id^="option-points-"]')
const feedback = () => $$('.invalid-feedback').map(text)

test('option range: points at and inside the bounds are accepted, negative and decimal included', async () => {
    await createWithOptions({min: -2, max: 3.5, points: [-2, -0.25, 0, 1.75, 3.5]})
    assert.deepEqual(feedback(), [])
    assert.equal(buttonByText('Create Criterion').disabled, false)
    assert.deepEqual(optionPoints(), ['-2', '-0.25', '0', '1.75', '3.5'])
})

test('option range: points outside the bounds get an inline error with the allowed range, block the submit and are not changed', async () => {
    const {socket} = await createWithOptions({min: 0, max: 4, points: [5, -0.5, 2]})
    assert.deepEqual(feedback(), ['Points must be between 0 and 4.', 'Points must be between 0 and 4.'])
    assert.equal(pointsInputs()[0].classList.contains('is-invalid'), true)
    assert.equal(pointsInputs()[2].classList.contains('is-invalid'), false)
    assert.equal(buttonByText('Create Criterion').disabled, true)
    assert.deepEqual(optionPoints(), ['5', '-0.5', '2'], 'entered values are never clamped')
    assert.deepEqual(pointsInputs().map(i => [i.getAttribute('min'), i.getAttribute('max')]), [['0', '4'], ['0', '4'], ['0', '4']])
    assert.equal(socket.calls.some(c => c.event === 'criterionCreate'), false)

    await setValue(`#${pointsInputs()[0].id}`, '4')
    await setValue(`#${pointsInputs()[1].id}`, '0')
    await flush()
    assert.deepEqual(feedback(), [])
    assert.equal(buttonByText('Create Criterion').disabled, false)
})

test('option range: one bound is enforced alone, no bound means any number, the input attributes follow', async () => {
    await createWithOptions({min: 1, max: '', points: [0.5, 500]})
    assert.deepEqual(feedback(), ['Points must be at least 1.'])
    assert.deepEqual(pointsInputs().map(i => [i.getAttribute('min'), i.getAttribute('max')]), [['1', null], ['1', null]])
})

test('option range: only a maximum', async () => {
    await createWithOptions({min: '', max: -5, points: [-4.9, -1000]})
    assert.deepEqual(feedback(), ['Points must be at most -5.'])
    assert.equal(buttonByText('Create Criterion').disabled, true)
})

test('option range: without bounds any number is accepted', async () => {
    await createWithOptions({points: [-1e6, 0.001, 1e6]})
    assert.deepEqual(feedback(), [])
    assert.equal(buttonByText('Create Criterion').disabled, false)
    assert.equal(pointsInputs()[0].hasAttribute('min'), false)
})

test('option range: changing the criterion bounds in step 1 revalidates the existing options', async () => {
    await createWithOptions({min: 0, max: 4, points: [1, 3]})
    assert.deepEqual(feedback(), [])
    await click('Previous')
    await setValue('#criterion-max', '2')
    await flush()
    await click('Next')
    assert.deepEqual(feedback(), ['Points must be between 0 and 2.'])
    assert.deepEqual(optionPoints(), ['1', '3'], 'the option is kept as entered')
    assert.equal(buttonByText('Create Criterion').disabled, true)

    await click('Previous')
    await setValue('#criterion-max', '')
    await flush()
    await click('Next')
    assert.deepEqual(feedback(), [], 'with only the minimum left, 3 is fine')
    await click('Previous')
    await setValue('#criterion-min', '2')
    await flush()
    await click('Next')
    assert.deepEqual(feedback(), ['Points must be at least 2.'], '1 is now below the minimum')
    await click('Previous')
    await setValue('#criterion-min', '')
    await flush()
    await click('Next')
    assert.deepEqual(feedback(), [])
    assert.equal(buttonByText('Create Criterion').disabled, false)
})

test('option range: a copied version whose options lie outside its bounds shows the errors until they are fixed; viewing it shows none', async () => {
    const legacy = criterion(12, 7, '1', {minPoints: 0, maxPoints: 2, scoringOptions: [
        {id: 1, criterionId: 12, points: 9, description: 'legacy', position: 1},
        {id: 2, criterionId: 12, points: 1, description: 'fine', position: 2},
    ]})
    const backend = makeBackend([legacy])
    const {modal, saved, socket} = mountModal({backend, criteria: backend.rows})
    await modal.openView(12)
    await flush()
    await click('Next')
    assert.deepEqual(feedback(), [], 'a read-only version is displayed, not validated')
    assert.deepEqual(optionPoints(), ['9', '1'])
    modal.$refs.stepper.close()
    await waitFor(() => !isOpen(modal), 'close')

    await modal.openNewVersion(12)
    await flush()
    await setValue('#criterion-version', '2')
    await flush()
    await click('Next')
    assert.deepEqual(feedback(), ['Points must be between 0 and 2.'])
    assert.equal(buttonByText('Create New Version').disabled, true)
    assert.deepEqual(optionPoints(), ['9', '1'])

    await click('Previous')
    await setValue('#criterion-max', '10')
    await flush()
    await click('Next')
    assert.deepEqual(feedback(), [])
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved')
    assert.equal(socket.calls.find(c => c.event === 'criterionCreateVersion').payload.maxPoints, 10)
    assert.deepEqual(backend.rows[0], legacy, 'the original is unchanged')
})

test('option range: a range error from the backend is shown in the modal on step 2 and keeps the input', async () => {
    const backend = makeBackend()
    const handlers = {...backend.handlers, criterionCreate: () => fail('errors.assessment.optionAboveMax', {position: 1, max: 4}, 'Scoring option 1: points must not be above the criterion\'s maximum of 4.')}
    const {modal, saved} = mountModal({backend, socket: fakeSocket(handlers)})
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'N', '#criterion-version': '1'})
    await flush()
    await click('Next')
    await click('Add Scoring Option')
    await setValue(`#${pointsInputs()[0].id}`, '3')
    await flush()
    await click('Create Criterion')
    await flush()
    assert.equal(saved.length, 0)
    assert.equal(isOpen(modal), true)
    assert.equal($('.alert-danger')?.textContent.includes('must not be above the criterion'), true)
    assert.deepEqual(optionPoints(), ['3'])
})

// ---------------------------------------------------------------------------------------------------------------
// 5. CriterionModal: new version

test('new version: starts from the stored version, requires a manually entered version number and says the original stays', async () => {
    const original = criterion(5, 3, '1', {minPoints: null})
    const backend = makeBackend([original])
    const {modal, socket, saved} = mountModal({backend, criteria: backend.rows})
    assert.equal(await modal.openNewVersion(5), true)
    await flush()
    assert.equal(text(document.body).includes('Create New Criterion Version'), true)
    assert.equal(text(document.body).includes('Version 1 stays unchanged'), true)
    assert.equal($('#criterion-name').value, 'Criterion 3')
    assert.equal($('#criterion-version').value, '', 'no automatic increment')
    assert.equal($('#criterion-min').value, '', 'null shows as empty')
    assert.equal(buttonByText('Next').disabled, true, 'version number missing')

    await setValue('#criterion-version', '1')
    await flush()
    assert.equal(buttonByText('Next').disabled, true, 'version 1 exists in this group')
    assert.equal(text(document.body).includes('already used by this criterion'), true)

    await setValue('#criterion-version', '2')
    await setValue('#criterion-name', 'Criterion 3 (revised)')
    await setValue('#criterion-min', '-10')
    await flush()
    await click('Next')
    assert.deepEqual(optionPoints(), ['-2', '3.5'])
    // edit: change the first description, remove the second option, add a new decimal one
    await setValue(`#${$$('[id^="option-description-"]')[0].id}`, 'worst, reworded')
    $$('button[title="Remove scoring option"]')[1].dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    await click('Add Scoring Option')
    await setValue(`#${$$('[id^="option-points-"]')[1].id}`, '1.75')
    await flush()
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved event')

    const request = socket.calls.find(c => c.event === 'criterionCreateVersion').payload
    assert.equal(request.criterionGroupId, 3)
    assert.equal(request.copyFromId, 5)
    assert.equal(request.versionNumber, '2')
    assert.equal(request.name, 'Criterion 3 (revised)')
    assert.equal(request.minPoints, -10)
    assert.equal(request.maxPoints, 3.5)
    assert.deepEqual(request.scoringOptions, [{points: -2, description: 'worst, reworded'}, {points: 1.75, description: ''}])
    assert.equal(JSON.stringify(request).includes('"id"'), false, 'no existing option ids are sent')

    // both versions exist, the original is unchanged
    assert.equal(backend.rows.length, 2)
    assert.deepEqual(backend.rows[0], original)
    assert.equal(saved[0].criterionGroupId, 3)
    assert.notEqual(saved[0].id, 5)
})

test('new version: clearing a copied boundary sends null; the backend rejecting the version number keeps the modal and input', async () => {
    const original = criterion(5, 3, '1')
    const backend = makeBackend([original])
    // the table was loaded before somebody else added version 2, so only the backend can know
    const {modal, saved} = mountModal({backend, criteria: [original]})
    await modal.openNewVersion(5)
    await flush()
    backend.rows.push(criterion(6, 3, '2'))
    await setValue('#criterion-version', '2')
    await setValue('#criterion-max', '')
    await flush()
    await click('Next')
    await click('Create New Version')
    await flush()
    assert.equal(isOpen(modal), true)
    assert.equal(saved.length, 0)
    assert.equal(text(document.body).includes('already exists for this criterion'), true)
    assert.equal($('#criterion-max').value, '')
    await setValue('#criterion-version', '3')
    await flush()
    await click('Next')
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved event')
    assert.equal(saved[0].maxPoints, null)
    assert.equal(saved[0].versionNumber, '3')
})

test('new version: the same version number is fine in another group', async () => {
    const backend = makeBackend([criterion(5, 3, '1'), criterion(6, 4, '2')])
    const {modal} = mountModal({backend, criteria: backend.rows})
    await modal.openNewVersion(5)
    await flush()
    await setValue('#criterion-version', '2')   // group 4 has version 2, group 3 does not
    await flush()
    assert.equal(buttonByText('Next').disabled, false)
})

// ---------------------------------------------------------------------------------------------------------------
// 6. Dashboard page, table panel and delete

const tableCalls = []
const BasicTable = {
    props: ['columns', 'data', 'options', 'buttons', 'maxTableHeight'],
    emits: ['action'],
    setup(props, {emit}) {
        tableCalls.push(props)
        return () => h('table', {'data-test': 'table'}, props.data.map(row => h('tr', {'data-row': row.id}, [
            h('td', String(row.id)), h('td', row.name), h('td', String(row.versionNumber)),
            ...props.buttons.map(button => h('button', {'data-action': button.action, onClick: () => emit('action', {action: button.action, params: row})}, button.title)),
        ])))
    },
}
const BasicLoading = {props: ['text'], render() { return h('div', {'data-test': 'loading'}, this.text) }}
const AssessmentTablePanel = loadComponent('components/dashboard/assessments/AssessmentTablePanel.vue', {
    BasicButton, BasicLoading, BasicTable, withSearch: tableConstants.withSearch, DASHBOARD_TABLE_HEIGHT: tableConstants.DASHBOARD_TABLE_HEIGHT,
})
const modalCalls = []
const stubModal = name => ({
    methods: {
        open(record) { modalCalls.push({name, method: 'open', record}) },
        openCreate() { modalCalls.push({name, method: 'openCreate'}) },
        openView(id) { modalCalls.push({name, method: 'openView', id}) },
        openNewVersion(id) { modalCalls.push({name, method: 'openNewVersion', id}) },
    },
    props: ['criteria'],
    render: () => null,
})
const confirmCalls = []
const ConfirmModal = {
    methods: {open(title, message, warning, cb) { confirmCalls.push({title, message, warning, cb}) }},
    render: () => null,
}
const BasicCard = {props: ['title'], render() { return h('div', [h('h3', this.title), this.$slots.body?.()]) }}
const DashboardAssessments = loadComponent('components/dashboard/Assessments.vue', {
    BasicCard,
    BasicButton: {render() { return h('button', {class: 'nav-link'}, this.$slots.default?.()) }},
    ConfirmModal,
    AssessmentTablePanel,
    AssessmentModal: stubModal('assessment'),
    RubricModal: stubModal('rubric'),
    CriterionModal: stubModal('criterion'),
    dashboardRowAction: (kind, o) => ({kind, ...o}),
    dashboardRowButton: (icon, o) => ({icon, ...o}),
    CALCULATION_METHODS: constants.CALCULATION_METHODS,
    criteriaBackendMixin,
    assessmentState: mockStore.assessmentState,
    deleteAssessment: mockStore.deleteAssessment,
    deleteRubric: mockStore.deleteRubric,
    assessmentsUsingRubric: mockStore.assessmentsUsingRubric,
})

function mountDashboard({criteria = [], backend = makeBackend(criteria), socket = fakeSocket(backend.handlers)} = {}) {
    tableCalls.length = 0
    modalCalls.length = 0
    confirmCalls.length = 0
    const toasts = []
    const page = mount(DashboardAssessments, {}, {$socket: socket, eventBus: {emit: (event, data) => toasts.push({event, ...data})}})
    return {page, socket, backend, toasts}
}

const openCriteriaTab = async () => {
    const tab = $$('.nav-link').find(b => text(b).startsWith('Criteria'))
    tab.dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
}
const rowIds = () => $$('[data-row]').map(row => Number(row.dataset.row))

const HISTORY = [criterion(1, 1, '1'), criterion(2, 1, '2'), criterion(3, 2, '1', {name: 'Same name', minPoints: null, maxPoints: null})]

test('page: criteria are loaded from the backend on mount, all versions are listed in the table and counted in the tab', async () => {
    const {socket} = mountDashboard({criteria: HISTORY})
    await waitFor(() => socket.calls.length === 1, 'first request')
    assert.deepEqual(socket.calls, [{event: 'criterionGetAll', payload: {}}])
    await flush()
    assert.match(text($('.nav-tabs')), /Criteria 3/)
    await openCriteriaTab()
    assert.deepEqual(rowIds(), [1, 2, 3], 'historical versions are listed directly, no separate versions screen')
    const props = tableCalls.at(-1)
    assert.deepEqual(props.data, HISTORY)
    // no mock data: the table shows exactly what the backend returned (ids from the database)
    assert.equal(mockStore.assessmentState.criteria.every(c => !props.data.some(d => d.id === c.id && d.name === c.name)), true)
})

test('page: columns are ID, Group, Name, Version, Minimum/Maximum points and Created at; no code column; table options keep search, sort, pagination', async () => {
    mountDashboard({criteria: HISTORY})
    await flush()
    await openCriteriaTab()
    const props = tableCalls.at(-1)
    assert.deepEqual(props.columns.map(c => c.key), ['id', 'criterionGroupId', 'name', 'versionNumber', 'minPoints', 'maxPoints', 'createdAt'])
    assert.deepEqual(props.columns.map(c => c.name), ['ID', 'Group', 'Name', 'Version', 'Minimum points', 'Maximum points', 'Created at'])
    assert.equal(props.columns.every(c => c.sortable), true)
    assert.equal(props.columns.find(c => c.key === 'createdAt').type, 'datetime')
    assert.equal(props.options.search, true)
    assert.equal(props.options.pagination, 10)
    assert.equal(props.maxTableHeight, tableConstants.DASHBOARD_TABLE_HEIGHT)
    assert.deepEqual(props.buttons.map(b => b.action), ['view', 'newVersion', 'delete'])
    assert.equal(props.buttons.some(b => b.action === 'edit'), false, 'the old Edit action is gone')
})

test('page: loading state while the first answer is pending, then the rows; a reload keeps the table', async () => {
    const backend = makeBackend(HISTORY)
    const socket = fakeSocket({...backend.handlers, criterionGetAll: () => undefined})
    const {page} = mountDashboard({backend, socket})
    await flush()
    await openCriteriaTab()
    assert.equal($('[data-test="loading"]')?.textContent, 'Loading…')
    assert.equal($('[data-test="table"]'), null)
    socket.pending[0].ack(ok(clone(HISTORY)))
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    assert.deepEqual(rowIds(), [1, 2, 3])

    page.loadCriteria({ force: true })
    await flush()
    assert.equal($('[data-test="loading"]'), null, 'a reload does not replace the table')
    assert.equal(rowIds().length, 3)
    socket.pending[1].ack(ok(clone(HISTORY)))
})

test('page: no duplicate load while one is running, and the retry after a failure loads again', async () => {
    const backend = makeBackend(HISTORY)
    let fails = true
    const socket = fakeSocket({...backend.handlers, criterionGetAll: () => (fails ? fail('errors.assessment.accessDenied', {}, 'no access') : ok(clone(HISTORY)))})
    const {page} = mountDashboard({backend, socket})
    await flush()
    await openCriteriaTab()
    assert.match(text($('.alert-danger')), /no access/)
    assert.equal($('.alert-danger button') !== null, true, 'retry button')
    fails = false
    $('.alert-danger button').dispatchEvent(new window.Event('click', {bubbles: true}))
    await waitFor(() => $('.alert-danger') === null, 'error to disappear')
    assert.deepEqual(rowIds(), [1, 2, 3])

    const calls = socket.calls.length
    page.loadCriteria()
    page.loadCriteria()
    await flush()
    assert.equal(socket.calls.length, calls + 1, 'the second call while one runs is ignored')
})

test('page: network failure on load shows the translated error, not an empty table', async () => {
    const socket = {connected: false, emit: () => {}, calls: []}
    mountDashboard({socket})
    await flush()
    await openCriteriaTab()
    assert.match(text($('.alert-danger')), /Not connected to the server/)
})

test('page: an empty library shows the empty message', async () => {
    mountDashboard({criteria: []})
    await flush()
    await openCriteriaTab()
    assert.match(text($('p.text-muted')), /No criteria yet/)
    assert.equal($('[data-test="table"]'), null)
})

test('page: Add, View and Create New Version open the modal in the right mode with the row id', async () => {
    mountDashboard({criteria: HISTORY})
    await flush()
    await openCriteriaTab()
    $$('button').find(b => text(b) === 'Add Criterion').dispatchEvent(new window.Event('click', {bubbles: true}))
    $('[data-row="2"] [data-action="view"]').dispatchEvent(new window.Event('click', {bubbles: true}))
    $('[data-row="2"] [data-action="newVersion"]').dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    assert.deepEqual(modalCalls, [
        {name: 'criterion', method: 'openCreate'},
        {name: 'criterion', method: 'openView', id: 2},
        {name: 'criterion', method: 'openNewVersion', id: 2},
    ])
})

test('delete: asks first; the row stays until the backend confirms; then the table reloads without the version', async () => {
    const backend = makeBackend(HISTORY)
    const handlers = {...backend.handlers}
    const gate = []
    const socket = fakeSocket({...handlers, criterionDelete: payload => { gate.push(payload); return undefined }})
    const {toasts} = mountDashboard({backend, socket})
    await flush()
    await openCriteriaTab()
    $('[data-row="2"] [data-action="delete"]').dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    assert.equal(confirmCalls.length, 1)
    assert.equal(confirmCalls[0].message.startsWith('Delete version "2" of the criterion "Criterion 1"?'), true, confirmCalls[0].message)
    assert.match(confirmCalls[0].message, /Only this version is deleted/)
    assert.equal(socket.calls.some(c => c.event === 'criterionDelete'), false, 'nothing is sent before confirming')

    confirmCalls[0].cb(false)
    await flush()
    assert.equal(socket.calls.some(c => c.event === 'criterionDelete'), false, 'declining deletes nothing')

    confirmCalls[0].cb(true)
    confirmCalls[0].cb(true)   // a double confirm
    await flush()
    assert.deepEqual(socket.calls.filter(c => c.event === 'criterionDelete').map(c => c.payload), [{criterionId: 2}])
    assert.deepEqual(rowIds(), [1, 2, 3], 'not removed optimistically')

    backend.handlers.criterionDelete({criterionId: 2})   // the backend deletes, then answers
    socket.pending.find(p => p.event === 'criterionDelete').ack(ok({id: 2, criterionGroupId: 1}))
    await waitFor(() => rowIds().length === 2, 'reload')
    assert.deepEqual(rowIds(), [1, 3])
    assert.equal(toasts.at(-1).variant, 'success')
    assert.equal(socket.calls.filter(c => c.event === 'criterionGetAll').length, 2)
})

test('page: stored versions with a number that does not match the format are listed as they are', async () => {
    mountDashboard({criteria: [criterion(1, 1, 'v1-beta'), criterion(2, 1, '1.2')]})
    await flush()
    await openCriteriaTab()
    assert.deepEqual(tableCalls.at(-1).data.map(row => row.versionNumber), ['v1-beta', '1.2'])
    assert.deepEqual(rowIds(), [1, 2])
})

test('delete: the confirm text puts the version in quotation marks and escapes it like the name', async () => {
    mountDashboard({criteria: [criterion(9, 9, '1.2"><b>x', {name: 'A'})]})
    await flush()
    await openCriteriaTab()
    $('[data-row="9"] [data-action="delete"]').dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    assert.equal(confirmCalls[0].message.startsWith('Delete version "1.2&quot;&gt;&lt;b&gt;x" of the criterion "A"?'), true, confirmCalls[0].message)
})

test('delete: the confirm text escapes markup in the criterion name', async () => {
    const evil = criterion(8, 8, '1', {name: '<img src=x onerror=alert(1)>'})
    mountDashboard({criteria: [evil]})
    await flush()
    await openCriteriaTab()
    $('[data-row="8"] [data-action="delete"]').dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    assert.equal(confirmCalls[0].message.includes('<img'), false)
    assert.equal(confirmCalls[0].message.includes('&lt;img'), true)
})

test('delete: a version used by a rubric is refused with the backend message, the table stays and nothing reloads', async () => {
    const backend = makeBackend(HISTORY)
    backend.referenced.add(1)
    const {socket, toasts} = mountDashboard({backend})
    await flush()
    await openCriteriaTab()
    $('[data-row="1"] [data-action="delete"]').dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    confirmCalls[0].cb(true)
    await flush()
    assert.equal(toasts.at(-1).variant, 'danger')
    assert.match(toasts.at(-1).message, /used by 1 rubric version\(s\) \(7\)/)
    assert.deepEqual(rowIds(), [1, 2, 3])
    assert.equal(socket.calls.filter(c => c.event === 'criterionGetAll').length, 1)
})

test('create or version saved in the modal reloads the table, so every version shows', async () => {
    const backend = makeBackend(HISTORY)
    const {page, socket} = mountDashboard({backend})
    await flush()
    await openCriteriaTab()
    backend.handlers.criterionCreateVersion({...criterion(1, 1, '3'), copyFromId: 1, scoringOptions: []})
    page.$refs.criterionModal.$emit('saved', {})
    await waitFor(() => rowIds().length === 4, 'reload after saved')
    assert.equal(socket.calls.filter(c => c.event === 'criterionGetAll').length, 2)
})

// ---------------------------------------------------------------------------------------------------------------
// 7. The other tabs

test('Assessments and Rubrics tabs still show their prototype data, note and actions; they send nothing to the backend', async () => {
    const {socket} = mountDashboard({criteria: HISTORY})
    await flush()
    const callsAfterLoad = socket.calls.length
    assert.match(text($('p.text-muted')), /Prototype with local sample data/)

    assert.deepEqual(rowIds(), mockStore.assessmentState.assessments.map(a => a.id))
    assert.deepEqual(tableCalls.at(-1).columns.map(c => c.key), ['id', 'name', 'description', 'version', 'rubricCount'])
    assert.deepEqual(tableCalls.at(-1).buttons.map(b => b.action), ['edit', 'delete'])

    const rubricsTab = $$('.nav-link').find(b => text(b).startsWith('Rubrics'))
    rubricsTab.dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    assert.deepEqual(rowIds(), mockStore.assessmentState.rubrics.map(r => r.id))
    assert.deepEqual(tableCalls.at(-1).columns.map(c => c.key), ['id', 'code', 'name', 'calculationLabel', 'criterionCount'])

    const first = mockStore.assessmentState.rubrics[0]
    $(`[data-row="${first.id}"] [data-action="edit"]`).dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    assert.deepEqual(modalCalls.at(-1), {name: 'rubric', method: 'open', record: first})

    const before = mockStore.assessmentState.rubrics.length
    $(`[data-row="${first.id}"] [data-action="delete"]`).dispatchEvent(new window.Event('click', {bubbles: true}))
    await flush()
    confirmCalls.at(-1).cb(true)
    await flush()
    assert.equal(mockStore.assessmentState.rubrics.length, before - 1, 'the prototype delete still works locally')
    assert.equal(socket.calls.length, callsAfterLoad, 'no backend calls from the prototype tabs')
})
