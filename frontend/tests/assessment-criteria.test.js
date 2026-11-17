/**
 * Tests of the Criteria tab of the Assessment Management Dashboard (Phase C: versioned criteria).
 *
 * Pure parts (form mapping, settings rows, bound ranges, validation, request helper) run directly. The components
 * are the real ones (PointBoundField, SettingsEditor, CriterionModal with its two steps, StepperModal, BasicModal
 * and the shared VersionsModal) mounted with the real Vue, vue-i18n, Bootstrap and the English catalog on a Happy
 * DOM document. The dashboard page with its three tabs, the rubric and assessment modals and the selection step are
 * tested in assessment-dashboard.test.js. Only BasicTable, BasicButton and
 * ConfirmModal are light stand-ins, and the backend is an in-memory fake that follows the criterion* socket contract
 * of backend/webserver/sockets/criterion.js: `criterionGetLatest`, `criterionGetVersions`, `criterionGet`,
 * `criterionCreate`, `criterionCreateVersion` (the backend assigns the version number and refuses one sent by the
 * client) and `criterionDelete` (soft delete, refused while referenced). The real events run against PostgreSQL in
 * the backend suites; no browser test is claimed here.
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
const settingsLib = await import(`${DIR}settingsForm.js`)
const boundsLib = await import(`${DIR}pointBounds.js`)
const socketLib = await import(`${DIR}assessmentSocket.js`)
const failureLib = await import(`${DIR}failureMessage.js`)
const validation = await import(`${DIR}assessmentValidation.js`)

const en = JSON.parse(readFileSync(new URL('../../utils/modules/i18n/en/assessmentManagement.json', import.meta.url), 'utf8'))
const MESSAGES = {
    assessmentManagement: en,
    errors: JSON.parse(readFileSync(new URL('../../utils/modules/i18n/en/errors.json', import.meta.url), 'utf8')),
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

const translate = key => key.split('.').reduce((node, part) => node?.[part], MESSAGES) ?? key


// A button that renders its title or text; clicks and `disabled` reach the element like on the real one.
const BasicButton = {
    props: ['text', 'title', 'icon', 'disabled'],
    render() {
        return h('button', {disabled: this.disabled, 'data-icon': this.icon, title: this.title}, this.text || this.title || '')
    },
}
const BasicModal = loadComponent('basic/Modal.vue', {Modal: BootstrapModal, uuid: () => 'uuid'})
const StepperModal = loadComponent('basic/modal/StepperModal.vue', {BasicModal, BasicButton})
const AssessmentFormField = loadComponent('components/dashboard/assessments/AssessmentFormField.vue')
const FormHelp = {props: ['help'], render() { return h('span', {class: 'form-help'}, this.help) }}
const FormCollapsible = loadComponent('basic/form/Collapsible.vue', {LoadIcon: {render: () => null}})
const PointBoundField = loadComponent('components/dashboard/assessments/PointBoundField.vue', {
    FormHelp, parsePoints: validation.parsePoints, sliderRange: boundsLib.sliderRange, sliderStep: boundsLib.sliderStep,
})
const SettingsEditor = loadComponent('components/dashboard/assessments/SettingsEditor.vue', {
    BasicButton, FormCollapsible, SETTINGS_LIMITS: settingsLib.SETTINGS_LIMITS,
    emptySettingsRow: settingsLib.emptySettingsRow, validateSettingsRows: settingsLib.validateSettingsRows,
})
const CriterionDetailsStep = loadComponent('components/dashboard/assessments/CriterionDetailsStep.vue', {
    AssessmentFormField, PointBoundField, SettingsEditor, activeBounds: form.activeBounds,
})
const ScoringOptionsStep = loadComponent('components/dashboard/assessments/ScoringOptionsStep.vue', {
    BasicButton, AssessmentFormField, parsePoints: validation.parsePoints, pointBounds: form.pointBounds,
})
const CriterionModal = loadComponent('components/dashboard/assessments/CriterionModal.vue', {
    StepperModal,
    CriterionDetailsStep,
    ScoringOptionsStep,
    failureText: failureLib.failureText,
    requestAssessment: socketLib.requestAssessment,
    visibleErrors: validation.visibleErrors,
    ...form,
})

// ---------------------------------------------------------------------------------------------------------------
// Fake backend with the criterion* contract (Phase B backend: automatic version numbers, soft delete)

const clone = value => JSON.parse(JSON.stringify(value))
const ok = data => ({success: true, data})
const fail = (key, params = {}, message = key) => ({success: false, key, params, message})

function makeBackend(seed = []) {
    let nextId = 1000
    let nextGroup = 500
    const rows = clone(seed).map(row => ({deleted: false, ...row}))
    const referenced = new Set()
    const live = group => rows.filter(row => !row.deleted && row.criterionGroupId === group)
    // one above the highest leading integer of every label of the group, deleted versions included: never reused
    const nextNumber = group => String(1 + Math.max(0, ...rows.filter(row => row.criterionGroupId === group).map(row => parseInt(row.versionNumber, 10) || 0)))
    const store = (fields, group) => {
        const id = ++nextId
        const row = {
            ...clone(fields), id, criterionGroupId: group, versionNumber: nextNumber(group), deleted: false,
            createdAt: '2026-11-10T10:00:00.000Z',
            scoringOptions: (fields.scoringOptions ?? []).map((option, i) => ({id: id * 10 + i, criterionId: id, ...option, position: i + 1})),
        }
        delete row.copyFromId
        rows.push(row)
        return clone(row)
    }
    const refuseClientNumber = payload => ('versionNumber' in payload
        ? fail('errors.assessment.versionNumberNotAllowed', {}, 'The version number is assigned automatically.') : null)
    return {
        rows,
        referenced,
        handlers: {
            criterionGetLatest: () => {
                const groups = [...new Set(rows.filter(row => !row.deleted).map(row => row.criterionGroupId))]
                return ok(groups.map(group => {
                    const versions = live(group)
                    const latest = versions.reduce((a, b) => (b.id > a.id ? b : a))
                    const {scoringOptions, deleted, ...plain} = clone(latest) // eslint-disable-line no-unused-vars
                    return {...plain, versionCount: versions.length}
                }))
            },
            criterionGetVersions: ({criterionGroupId}) => {
                const versions = live(criterionGroupId).sort((a, b) => b.id - a.id)
                return versions.length
                    ? ok(versions.map(({id, criterionGroupId: group, versionNumber, name, createdAt}) => ({id, criterionGroupId: group, versionNumber, name, createdAt})))
                    : fail('errors.assessment.criterion.groupNotFound')
            },
            criterionGet: ({criterionId}) => {
                const row = rows.find(r => r.id === criterionId && !r.deleted)
                return row ? ok(clone(row)) : fail('errors.assessment.criterion.notFound')
            },
            criterionCreate: payload => refuseClientNumber(payload) ?? ok(store(payload, ++nextGroup)),
            criterionCreateVersion: payload => {
                const refused = refuseClientNumber(payload)
                if (refused) return refused
                const source = rows.find(r => r.id === payload.copyFromId)
                if (!source || source.criterionGroupId !== payload.criterionGroupId) {
                    return fail('errors.assessment.criterion.copySourceMismatch')
                }
                return ok(store(payload, payload.criterionGroupId))
            },
            criterionDelete: ({criterionId}) => {
                const row = rows.find(r => r.id === criterionId && !r.deleted)
                if (!row) return fail('errors.assessment.criterion.notFound')
                if (referenced.has(criterionId)) {
                    return fail('errors.assessment.criterion.inUse', {criterionId, count: 1, rubricIds: '7'},
                        `Criterion version ${criterionId} cannot be deleted: it is used by 1 rubric version(s) (7).`)
                }
                row.deleted = true
                const rest = live(row.criterionGroupId)
                return ok({id: row.id, criterionGroupId: row.criterionGroupId, latestVersionId: rest.length ? Math.max(...rest.map(r => r.id)) : null})
            },
        },
    }
}

const criterion = (id, group, version, extra = {}) => ({
    id, criterionGroupId: group, versionNumber: version, name: `Criterion ${group}`, description: 'desc',
    minPoints: -2, maxPoints: 3.5, settings: {tag: 'x', weight: 5, strict: true},
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
const fire = (element, type) => element.dispatchEvent(new window.Event(type, {bubbles: true}))

/** Sets an input like a user: one event, then Vue renders before the next field changes. */
async function setValue(selector, value) {
    const element = $(selector)
    element.value = value
    fire(element, element.tagName === 'SELECT' ? 'change' : 'input')
    await nextTick()
}

async function setChecked(selector, checked) {
    const element = $(selector)
    element.checked = checked
    fire(element, 'change')
    await nextTick()
}

async function click(label) {
    const button = buttonByText(label)
    assert.ok(button, `button "${label}" not found, have: ${$$('button').map(text).join(' | ')}`)
    assert.equal(button.disabled, false, `button "${label}" is disabled`)
    fire(button, 'click')
    await flush()
}

/** Mounts the real CriterionModal over a fake backend. */
function mountModal({criteria = [], backend = makeBackend(criteria), socket = fakeSocket(backend.handlers)} = {}) {
    const toasts = []
    const saved = []
    const modal = mount(CriterionModal, {onSaved: data => saved.push(data)}, {
        $socket: socket,
        eventBus: {emit: (event, data) => toasts.push({event, ...data})},
    })
    return {modal, socket, backend, toasts, saved}
}

const isOpen = modal => modal.$refs.stepper.$refs.stepperModal.isShown
const optionPoints = () => $$('[id^="option-points-"]').map(input => input.value)
const openSettings = async () => {
    fire($('.collapsible-header'), 'click')
    await flush()
}
const settingRows = () => $$('[id^="settings-key-"]').map(key => [key.value, $(`#${key.id.replace('key', 'value')}`).value])

async function fillDetails(values) {
    for (const [selector, value] of Object.entries(values)) {
        await setValue(selector, value)
    }
}

// ---------------------------------------------------------------------------------------------------------------
// 1. Settings rows (pure)

test('settings rows: stored values keep their JSON type until edited, typed values are strings, keys are trimmed', () => {
    const rows = settingsLib.rowsFromSettings({a: 'text', n: 5, b: false})
    assert.deepEqual(rows.map(r => [r.key, r.value]), [['a', 'text'], ['n', '5'], ['b', 'false']])
    assert.deepEqual(settingsLib.settingsFromRows(rows), {a: 'text', n: 5, b: false}, 'untouched: types preserved')

    const edited = rows.map(r => (r.key === 'n' ? {...r, value: '6', raw: undefined} : r))
    assert.deepEqual(settingsLib.settingsFromRows(edited), {a: 'text', n: '6', b: false}, 'an edited value becomes a string')

    const typed = [{...settingsLib.emptySettingsRow(), key: '  level ', value: '3'}, {...settingsLib.emptySettingsRow(), key: 'ok', value: 'true'}]
    assert.deepEqual(settingsLib.settingsFromRows(typed), {level: '3', ok: 'true'}, 'new input is stored as strings, even if it looks like a number or boolean')
    assert.deepEqual(settingsLib.settingsFromRows([]), {})
    assert.deepEqual(settingsLib.rowsFromSettings(null), [])
})

test('settings rows: function, expertLevel and subjective are ordinary keys', () => {
    const settings = {function: 'x', expertLevel: 2, subjective: true}
    assert.deepEqual(settingsLib.settingsFromRows(settingsLib.rowsFromSettings(settings)), settings)
    assert.deepEqual(settingsLib.validateSettingsRows(settingsLib.rowsFromSettings(settings)), {rows: {}})
})

test('settings validation: empty, duplicate, too long and unsafe keys, long values and too many rows', () => {
    const row = (key, value = '', raw) => ({...settingsLib.emptySettingsRow(), key, value, raw})
    const [blank, ok1, dupA, dupB, long, unsafe1, unsafe2, unsafe3, spaced] = [
        row('  '), row('a'), row('d'), row(' d '), row('k'.repeat(256)),
        row('__proto__'), row('constructor'), row('prototype'), row('  trimmed  ')]
    const result = settingsLib.validateSettingsRows([blank, ok1, dupA, dupB, long, unsafe1, unsafe2, unsafe3, spaced])
    assert.equal(result.rows[blank.uid].key, 'settingsKeyRequired')
    assert.equal(result.rows[ok1.uid], undefined)
    assert.equal(result.rows[dupA.uid].key, 'settingsKeyDuplicate', 'both rows of a duplicate are marked')
    assert.equal(result.rows[dupB.uid].key, 'settingsKeyDuplicate')
    assert.equal(result.rows[long.uid].key, 'settingsKeyTooLong')
    for (const unsafe of [unsafe1, unsafe2, unsafe3]) assert.equal(result.rows[unsafe.uid].key, 'settingsKeyUnsafe')
    assert.equal(result.rows[spaced.uid], undefined)

    const longValue = row('v', 'x'.repeat(10001))
    assert.equal(settingsLib.validateSettingsRows([longValue]).rows[longValue.uid].value, 'settingsValueTooLong')
    assert.equal(settingsLib.settingsRowsValid([row('v', 'x'.repeat(10000))]), true)
    assert.equal(settingsLib.settingsRowsValid([row('v', 'x'.repeat(10001))]), false)
    assert.equal(settingsLib.settingsRowsValid([row('n', '1'.repeat(20000), 5)]), true, 'a stored non-text value is not length-checked')
    const many = Array.from({length: 101}, (_, i) => row(`key${i}`))
    assert.equal(settingsLib.validateSettingsRows(many).general, 'settingsTooMany')
    assert.equal(settingsLib.settingsRowsValid(many.slice(0, 100)), true)
})

// ---------------------------------------------------------------------------------------------------------------
// 2. Bounds (pure)

test('bounds: parseBound reads any finite number, empty and invalid text are null', () => {
    assert.equal(boundsLib.parseBound('-2.5'), -2.5)
    assert.equal(boundsLib.parseBound('0'), 0)
    assert.equal(boundsLib.parseBound(''), null)
    assert.equal(boundsLib.parseBound('abc'), null)
    assert.equal(boundsLib.parseBound('Infinity'), null)
})

test('bounds: the slider range is -10..10 by default, grows with the entered values and shrinks back, and holds both bounds', () => {
    assert.deepEqual(boundsLib.sliderRange(null), {min: -10, max: 10})
    assert.deepEqual(boundsLib.sliderRange(3), {min: -10, max: 10})
    assert.deepEqual(boundsLib.sliderRange(25), {min: -10, max: 30})
    assert.deepEqual(boundsLib.sliderRange(-137.5), {min: -140, max: 10})
    assert.deepEqual(boundsLib.sliderRange(5, 250), {min: -10, max: 250}, 'the other bound is inside the range too')
    assert.deepEqual(boundsLib.sliderRange(-3, null), {min: -10, max: 10}, 'back to the default when the large value is gone')
    assert.equal(boundsLib.sliderStep(2), 1)
    assert.equal(boundsLib.sliderStep(2.5), 0.1)
    assert.equal(boundsLib.sliderStep(null), 1)
})

test('bounds: min above max is the only pair error; equal values and one missing bound are fine', () => {
    assert.equal(boundsLib.boundsError(3, 2), 'maxBelowMin')
    assert.equal(boundsLib.boundsError(2, 2), undefined)
    assert.equal(boundsLib.boundsError(null, 2), undefined)
    assert.equal(boundsLib.boundsError(3, null), undefined)
    assert.equal(boundsLib.boundsError(-5, -6), 'maxBelowMin', 'negative values compare like any other')
})

// ---------------------------------------------------------------------------------------------------------------
// 3. Form mapping and validation (pure)

test('payload: inactive bounds are null (never 0), no version number, settings as stored/typed, options in order without ids', () => {
    const base = form.emptyCriterionForm()
    base.name = 'Clarity'
    const payload = form.toCriterionPayload(base, [{uid: 1, points: -1.5, description: 'deduct'}, {uid: 2, points: '3', description: undefined}])
    assert.deepEqual(payload, {
        name: 'Clarity', description: '', minPoints: null, maxPoints: null, settings: {},
        scoringOptions: [{points: -1.5, description: 'deduct'}, {points: 3, description: ''}],
    })
    for (const gone of ['versionNumber', 'function', 'expertLevel', 'subjective']) assert.equal(gone in payload, false)

    const bounded = {...base, minActive: true, minPoints: -2.5, maxActive: true, maxPoints: 0}
    assert.equal(form.toCriterionPayload(bounded, []).minPoints, -2.5)
    assert.equal(form.toCriterionPayload(bounded, []).maxPoints, 0, 'zero is a real value, not "off"')
    const off = {...bounded, minActive: false, maxActive: false}
    assert.deepEqual([form.toCriterionPayload(off, []).minPoints, form.toCriterionPayload(off, []).maxPoints], [null, null], 'the remembered numbers are ignored while off')
})

test('form from a stored version: null bounds are switched off, settings keep their types, options come in stored order without ids', () => {
    const stored = criterion(7, 3, '4', {minPoints: null, maxPoints: -1})
    const f = form.formFromCriterion(stored)
    assert.deepEqual([f.minActive, f.maxActive, f.maxPoints], [false, true, -1])
    assert.deepEqual(settingsLib.settingsFromRows(f.settingsRows), {tag: 'x', weight: 5, strict: true})
    assert.deepEqual(form.optionsFromCriterion(stored), [{points: -2, description: 'worst'}, {points: 3.5, description: 'best'}])
    assert.deepEqual(form.versionSource(stored), {id: 7, criterionGroupId: 3, versionNumber: '4', name: 'Criterion 3'})
    assert.equal(form.versionSource(null), null)
})

test('version request: group, source and the full edited content, no version number', () => {
    const source = form.versionSource(criterion(7, 3, '4'))
    const f = form.formFromCriterion(criterion(7, 3, '4'))
    const request = form.versionRequest(source, f, form.optionsFromCriterion(criterion(7, 3, '4')).map((o, uid) => ({uid, ...o})))
    assert.equal(request.criterionGroupId, 3)
    assert.equal(request.copyFromId, 7)
    assert.deepEqual(request.settings, {tag: 'x', weight: 5, strict: true})
    assert.equal('versionNumber' in request, false)
    assert.deepEqual(request.scoringOptions.map(o => o.points), [-2, 3.5])
})

test('validation: a name is required, names need not be unique, an active bound needs a number, min must not exceed max', () => {
    const base = form.emptyCriterionForm()
    assert.deepEqual(form.validateCriterionForm({...base, name: 'A'}), {})
    assert.equal(form.validateCriterionForm(base).name, 'required')
    assert.equal(form.validateCriterionForm({...base, name: 'x'.repeat(256)}).name, 'tooLong')
    assert.equal(form.validateCriterionForm({...base, name: 'A', minActive: true, minPoints: ''}).minPoints, 'number')
    assert.equal(form.validateCriterionForm({...base, name: 'A', maxActive: true, maxPoints: ''}).maxPoints, 'number')
    assert.deepEqual(form.validateCriterionForm({...base, name: 'A', minActive: false, minPoints: ''}), {}, 'an inactive bound is never checked')
    assert.equal(form.validateCriterionForm({...base, name: 'A', minActive: true, minPoints: 3, maxActive: true, maxPoints: 2}).maxPoints, 'maxBelowMin')
    assert.deepEqual(form.validateCriterionForm({...base, name: 'A', minActive: true, minPoints: -4, maxActive: true, maxPoints: -4}), {})
    assert.deepEqual(form.validateCriterionForm({...base, name: 'A', minActive: true, minPoints: 3, maxActive: false, maxPoints: 2}), {}, 'only active bounds are compared')
    const duplicate = [{...settingsLib.emptySettingsRow(), key: 'a'}, {...settingsLib.emptySettingsRow(), key: 'a'}]
    assert.ok(form.validateCriterionForm({...base, name: 'A', settingsRows: duplicate}).settings, 'settings problems block the step')
})

test('validation of options: any number without bounds, negative and decimal values, active bounds only', () => {
    const options = [{uid: 1, points: -1.5}, {uid: 2, points: 0.25}, {uid: 3, points: ''}, {uid: 4, points: 'x'}]
    assert.deepEqual(form.validateOptionList(options), {3: {points: 'required'}, 4: {points: 'number'}})
    const bounded = [{uid: 1, points: -2}, {uid: 2, points: 3.5}, {uid: 3, points: 3.6}, {uid: 4, points: -2.1}]
    assert.deepEqual(form.validateOptionList(bounded, -2, 3.5), {3: {points: 'pointsBetween'}, 4: {points: 'pointsBetween'}}, 'the bounds themselves are valid')
    assert.deepEqual(form.validateOptionList([{uid: 1, points: 9}], null, 3), {1: {points: 'pointsAtMost'}})
    assert.deepEqual(form.validateOptionList([{uid: 1, points: -9}], -3, null), {1: {points: 'pointsAtLeast'}})
    assert.deepEqual(form.validateOptionList([{uid: 1, points: -9}], null, null), {})
    assert.deepEqual(form.activeBounds({minActive: true, minPoints: -1, maxActive: false, maxPoints: 4}), {min: -1, max: null})
})

test('backend errors are assigned to the field and step that shows them', () => {
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.pointsRange'}), {field: 'maxPoints', step: 0})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.settingsKeyDuplicate'}), {field: 'settings', step: 0})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.settingsInvalid'}), {field: 'settings', step: 0})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.optionBelowMin'}), {field: null, step: 1})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.fieldRequired', params: {field: 'name'}}), {field: 'name', step: 0})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.fieldInvalid', params: {field: 'scoringOptions'}}), {field: null, step: 1})
    assert.deepEqual(form.errorTarget({key: 'errors.assessment.accessDenied'}), {field: null, step: null})
})

test('escapeHtml neutralises markup in names shown in the confirm dialog', () => {
    assert.equal(form.escapeHtml('<b>"x"</b> & \'y\''), '&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;')
    assert.equal(form.escapeHtml(null), '')
})

test('requestAssessment resolves with the data of a successful answer and rejects with the backend answer, a missing connection and a missing answer', async () => {
    const socket = fakeSocket({criterionGetLatest: () => ok([1, 2])})
    assert.deepEqual(await socketLib.requestAssessment(socket, 'criterionGetLatest', {}), [1, 2])
    assert.deepEqual(socket.calls, [{event: 'criterionGetLatest', payload: {}}])

    const denied = fakeSocket({x: () => fail('errors.assessment.accessDenied')})
    await assert.rejects(socketLib.requestAssessment(denied, 'x'), error => error.key === 'errors.assessment.accessDenied' && error.response.success === false)
    const offline = {connected: false, emit: () => assert.fail('must not emit')}
    await assert.rejects(socketLib.requestAssessment(offline, 'x'), error => error.key === socketLib.CLIENT_ERROR_KEYS.notConnected)
    const silent = fakeSocket({})
    await assert.rejects(socketLib.requestAssessment(silent, 'x', {}, {timeoutMs: 20}), error => error.key === socketLib.CLIENT_ERROR_KEYS.timeout)
    silent.pending[0].ack(ok(1))
})

// ---------------------------------------------------------------------------------------------------------------
// 4. PointBoundField

/** Holds the state of one bound like the details step does. */
const BoundHost = {
    props: ['startActive', 'startValue', 'other', 'readonly', 'error'],
    data() {
        return {active: this.startActive ?? false, value: this.startValue ?? 0, touched: 0}
    },
    render() {
        return h(PointBoundField, {
            fieldId: 'bound', label: 'Minimum points', active: this.active, modelValue: this.value, other: this.other ?? null,
            readonly: this.readonly, error: this.error ?? '',
            'onUpdate:active': v => { this.active = v }, 'onUpdate:modelValue': v => { this.value = v }, onTouch: () => { this.touched++ },
        })
    },
}
const mountBound = props => mount(BoundHost, props, {})

test('bound field: off by default, slider and number input are disabled and the hint says no limit applies', async () => {
    const host = mountBound({})
    await flush()
    assert.equal($('#bound-active').checked, false)
    assert.equal($('#bound').disabled, true)
    assert.equal($('#bound-slider').disabled, true)
    assert.match(text($('.point-bound')), /Not set: no limit applies/)
    assert.equal(host.active, false)
})

test('bound field: the checkbox label and the label text toggle it, and the inputs follow', async () => {
    const host = mountBound({})
    await flush()
    await setChecked('#bound-active', true)
    assert.equal(host.active, true)
    assert.equal($('#bound').disabled, false)
    assert.equal($('#bound-slider').disabled, false)
    assert.equal($('.point-bound label').getAttribute('for'), 'bound-active')
    await setChecked('#bound-active', false)
    assert.equal($('#bound').disabled, true)
})

test('bound field: slider and number input stay in sync, negative and decimal values are kept, nothing is clamped', async () => {
    const host = mountBound({startActive: true, startValue: 2})
    await flush()
    assert.equal($('#bound-slider').value, '2')
    assert.equal($('#bound').value, '2')

    await setValue('#bound-slider', '-7')
    assert.equal(host.value, -7)
    assert.equal($('#bound').value, '-7')

    await setValue('#bound', '-2.75')
    assert.equal(host.value, -2.75, 'decimals are kept exactly')
    await flush()
    assert.equal(Number($('#bound-slider').value), -2.75, 'the slider follows the number input')

    await setValue('#bound', '12345.5')
    assert.equal(host.value, 12345.5, 'no clamping to the slider range')
    await flush()
    assert.equal($('#bound-slider').max, '12350', 'the slider range grew to hold the value')
    assert.equal($('#bound-slider').min, '-10')

    await setValue('#bound', '4')
    await flush()
    assert.equal($('#bound-slider').max, '10', 'and shrank back')
    assert.equal(host.value, 4)
})

test('bound field: the slider range contains the other bound; an empty input is "", not 0', async () => {
    const host = mountBound({startActive: true, startValue: 1, other: 250})
    await flush()
    assert.equal($('#bound-slider').max, '250')
    await setValue('#bound', '')
    assert.equal(host.value, '', 'an empty input is reported as empty so the form can say a number is needed')
})

test('bound field: the number input reports the blur and shows the error; read-only disables everything', async () => {
    const host = mountBound({startActive: true, startValue: 1, error: 'Enter a number.'})
    await flush()
    fire($('#bound'), 'blur')
    assert.equal(host.touched, 1)
    assert.match(text($('.invalid-feedback')), /Enter a number\./)
    assert.equal($('#bound').classList.contains('is-invalid'), true)

    document.body.innerHTML = ''
    mountBound({startActive: true, startValue: 1, readonly: true})
    await flush()
    for (const id of ['#bound-active', '#bound-slider', '#bound']) assert.equal($(id).disabled, true, id)
})

// ---------------------------------------------------------------------------------------------------------------
// 5. SettingsEditor

const SettingsHost = {
    props: ['start', 'readonly', 'showAll'],
    data() {
        return {rows: settingsLib.rowsFromSettings(this.start ?? {})}
    },
    render() {
        return h(SettingsEditor, {modelValue: this.rows, readonly: this.readonly, showAll: this.showAll, 'onUpdate:modelValue': v => { this.rows = v }})
    },
}

test('settings editor: collapsed without rows, opens on click; rows can be added, edited and removed', async () => {
    const host = mount(SettingsHost, {}, {})
    await flush()
    assert.equal($('[id^="settings-key-"]'), null, 'collapsed')
    assert.match(text($('.collapsible-header')), /Advanced Settings/)
    await openSettings()
    assert.match(text($('.card-body')), /No settings\./)
    await click('Add setting')
    await click('Add setting')
    assert.equal(settingRows().length, 2)
    const keys = $$('[id^="settings-key-"]')
    await setValue(`#${keys[0].id}`, 'language')
    await setValue(`#${keys[0].id.replace('key', 'value')}`, 'en')
    await setValue(`#${keys[1].id}`, 'level')
    await setValue(`#${keys[1].id.replace('key', 'value')}`, '3')
    assert.deepEqual(settingsLib.settingsFromRows(host.rows), {language: 'en', level: '3'})

    fire($$('button[title="Remove setting"]')[0], 'click')
    await flush()
    assert.deepEqual(settingRows(), [['level', '3']])
    assert.deepEqual(settingsLib.settingsFromRows(host.rows), {level: '3'})
})

test('settings editor: with stored rows it starts open; untouched typed values keep their type, an edited one becomes a string', async () => {
    const host = mount(SettingsHost, {start: {weight: 5, strict: true, tag: 'x'}}, {})
    await flush()
    assert.deepEqual(settingRows(), [['weight', '5'], ['strict', 'true'], ['tag', 'x']])
    assert.deepEqual(settingsLib.settingsFromRows(host.rows), {weight: 5, strict: true, tag: 'x'})
    const weight = $$('[id^="settings-value-"]')[0]
    await setValue(`#${weight.id}`, '6')
    assert.deepEqual(settingsLib.settingsFromRows(host.rows), {weight: '6', strict: true, tag: 'x'})
})

test('settings editor: inline errors for an empty key (after leaving the row), duplicates, unsafe and long keys', async () => {
    mount(SettingsHost, {start: {a: '1', b: '2'}}, {})
    await flush()
    const [firstKey, secondKey] = $$('[id^="settings-key-"]')
    await setValue(`#${secondKey.id}`, 'a')
    assert.match(text(document.body), /This key is used more than once\./)
    assert.equal(firstKey.classList.contains('is-invalid'), true, 'a duplicate is shown at once, on both rows')
    assert.equal(secondKey.classList.contains('is-invalid'), true)
    assert.equal($$('.invalid-feedback').length, 2)

    await setValue(`#${secondKey.id}`, '__proto__')
    assert.match(text(document.body), /This key name is not allowed\./)
    await setValue(`#${secondKey.id}`, 'k'.repeat(256))
    assert.match(text(document.body), /at most 255 characters/)
    await setValue(`#${secondKey.id}`, '')
    assert.equal(text(document.body).includes('Enter a key.'), false, 'an empty key waits for the first blur')
    fire(secondKey, 'blur')
    await flush()
    assert.match(text(document.body), /Enter a key\./)
})

test('settings editor: read-only shows the rows, no add or remove, no errors', async () => {
    mount(SettingsHost, {start: {a: '1'}, readonly: true}, {})
    await flush()
    assert.deepEqual(settingRows(), [['a', '1']])
    assert.equal($$('[id^="settings-key-"], [id^="settings-value-"]').every(input => input.disabled), true)
    assert.equal(buttonByText('Add setting'), undefined)
    assert.equal($('button[title="Remove setting"]'), null)
})

// ---------------------------------------------------------------------------------------------------------------
// 6. CriterionModal: create

test('create: no version, grading function, expert level or subjective field; two steps; Next waits for the name', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    assert.match(text($('.modal-title')), /Add Criterion/)
    assert.equal($('#criterion-name') !== null, true)
    for (const gone of ['#criterion-version', '#criterion-function', '#criterion-expert', '#criterion-subjective', '#criterion-code']) {
        assert.equal($(gone), null, gone)
    }
    assert.equal($('#criterion-min-active').checked, false)
    assert.equal($('#criterion-max-active').checked, false)
    assert.equal(buttonByText('Next').disabled, true, 'the name is required')
    await setValue('#criterion-name', 'Clarity')
    assert.equal(buttonByText('Next').disabled, false)
})

test('create: bounds, settings and ordered options with negative and decimal points are sent to criterionCreate; the generated number is shown', async () => {
    const {modal, socket, toasts, saved} = mountModal()
    modal.openCreate()
    await flush()
    await fillDetails({'#criterion-name': 'Clarity', '#criterion-description': 'How clear'})
    await setChecked('#criterion-min-active', true)
    await setValue('#criterion-min', '-2.5')
    await setChecked('#criterion-max-active', true)
    await setValue('#criterion-max', '4')
    await openSettings()
    await click('Add setting')
    await setValue('#' + $$('[id^="settings-key-"]')[0].id, 'level')
    await setValue('#' + $$('[id^="settings-value-"]')[0].id, '3')
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
    fire($$('button[title="Move down"]')[0], 'click')   // the order is the user's, not sorted by points
    await flush()
    assert.deepEqual(optionPoints(), ['-1.5', '3', '0.25'])

    await click('Create Criterion')
    await waitFor(() => saved.length === 1, 'saved event')
    assert.deepEqual(socket.calls.map(c => c.event), ['criterionCreate'])
    assert.deepEqual(socket.calls[0].payload, {
        name: 'Clarity', description: 'How clear', minPoints: -2.5, maxPoints: 4, settings: {level: '3'},
        scoringOptions: [{points: -1.5, description: 'deduct'}, {points: 3, description: 'three'}, {points: 0.25, description: 'partial'}],
    })
    assert.equal(saved[0].versionNumber, '1', 'the backend assigned the number')
    assert.equal(toasts.at(-1).variant, 'success')
    assert.match(toasts.at(-1).message, /version 1/)
    await waitFor(() => !isOpen(modal), 'modal to close')
})

test('create: nothing but a name is needed; inactive bounds are sent as null and there are no options', async () => {
    const {modal, socket, saved} = mountModal()
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'Bare')
    await click('Next')
    assert.match(text(document.body), /No scoring options\./)
    await click('Create Criterion')
    await waitFor(() => saved.length === 1, 'saved event')
    assert.deepEqual(socket.calls[0].payload, {name: 'Bare', description: '', minPoints: null, maxPoints: null, settings: {}, scoringOptions: []})
})

test('create: min above max shows the error and blocks Next; an inactive bound is not compared', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'A')
    await setChecked('#criterion-min-active', true)
    await setValue('#criterion-min', '5')
    await setChecked('#criterion-max-active', true)
    await setValue('#criterion-max', '2')
    await flush()
    assert.match(text(document.body), /Maximum points must be greater than or equal to minimum points\./)
    assert.equal(buttonByText('Next').disabled, true)
    await setChecked('#criterion-max-active', false)
    await flush()
    assert.equal(buttonByText('Next').disabled, false, 'switching the maximum off removes the conflict')
    await setChecked('#criterion-max-active', true)
    await setValue('#criterion-max', '5')
    await flush()
    assert.equal(buttonByText('Next').disabled, false, 'equal bounds are allowed')
})

test('create: an active bound with an empty number input shows an error, a number typed later clears it', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'A')
    await setChecked('#criterion-min-active', true)
    await setValue('#criterion-min', '')
    await flush()
    assert.match(text(document.body), /Enter a number\./)
    assert.equal(buttonByText('Next').disabled, true)
    await setValue('#criterion-min', '-0.5')
    await flush()
    assert.equal(buttonByText('Next').disabled, false)
})

test('create: the slider moves the bound and the number input shows it', async () => {
    const {modal, socket, saved} = mountModal()
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'A')
    await setChecked('#criterion-max-active', true)
    await setValue('#criterion-max-slider', '7')
    assert.equal($('#criterion-max').value, '7')
    await click('Next')
    await click('Create Criterion')
    await waitFor(() => saved.length === 1, 'saved')
    assert.equal(socket.calls[0].payload.maxPoints, 7)
    assert.equal(socket.calls[0].payload.minPoints, null)
})

test('create: option points follow the active bounds, a bound switched off in step 1 stops being enforced, nothing is changed', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'A')
    await setChecked('#criterion-min-active', true)
    await setValue('#criterion-min', '-2')
    await setChecked('#criterion-max-active', true)
    await setValue('#criterion-max', '3.5')
    await click('Next')
    await click('Add Scoring Option')
    await click('Add Scoring Option')
    const [first, second] = $$('[id^="option-points-"]')
    await setValue(`#${first.id}`, '-2')
    await setValue(`#${second.id}`, '3.6')
    await flush()
    assert.match(text(document.body), /Points must be between -2 and 3\.5\./)
    assert.equal(buttonByText('Create Criterion').disabled, true)
    assert.equal(second.value, '3.6', 'the entered value is not adjusted')

    await click('Previous')
    await setChecked('#criterion-max-active', false)
    await click('Next')
    assert.equal(text(document.body).includes('Points must be between'), false)
    assert.equal(buttonByText('Create Criterion').disabled, false, 'without a maximum only the minimum is enforced')
    await setValue(`#${first.id}`, '-2.1')
    await flush()
    assert.match(text(document.body), /Points must be at least -2\./)
})

test('create: settings entered in step 1 are still there after going to step 2 and back', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'A')
    await openSettings()
    await click('Add setting')
    await setValue('#' + $$('[id^="settings-key-"]')[0].id, 'k')
    await setValue('#' + $$('[id^="settings-value-"]')[0].id, 'v')
    await click('Next')
    await click('Previous')
    assert.deepEqual(settingRows(), [['k', 'v']])
})

test('create: a duplicate or empty settings key blocks Next and shows the message; fixing it unblocks', async () => {
    const {modal} = mountModal()
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'A')
    await openSettings()
    await click('Add setting')
    await click('Add setting')
    const keys = $$('[id^="settings-key-"]')
    await setValue(`#${keys[0].id}`, 'same')
    await setValue(`#${keys[1].id}`, 'same')
    assert.equal(buttonByText('Next').disabled, true)
    assert.match(text(document.body), /This key is used more than once\./)
    await setValue(`#${keys[1].id}`, 'other')
    assert.equal(buttonByText('Next').disabled, false)
})

test('create: an option without a number blocks the submit; a second click while the first request is pending sends nothing', async () => {
    const backend = makeBackend()
    let release
    const socket = fakeSocket({...backend.handlers, criterionCreate: payload => { release = () => socket.pending.at(-1).ack(backend.handlers.criterionCreate(payload)); return undefined }})
    const {modal, saved} = mountModal({backend, socket})
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'A')
    await click('Next')
    await click('Add Scoring Option')
    assert.equal(buttonByText('Create Criterion').disabled, true, 'points are empty')
    await setValue('#' + $$('[id^="option-points-"]')[0].id, '1')
    await click('Create Criterion')
    fire(buttonByText('Create Criterion') ?? document.body, 'click')
    await flush()
    assert.equal(socket.calls.filter(c => c.event === 'criterionCreate').length, 1)
    release()
    await waitFor(() => saved.length === 1, 'saved')
})

test('create: a backend settings error keeps the modal and every value and shows the message at the settings; the client never sends a version number', async () => {
    const backend = makeBackend()
    const socket = fakeSocket({...backend.handlers, criterionCreate: () => fail('errors.assessment.settingsKeyDuplicate', {key: 'a'}, 'The setting key "a" is used more than once.')})
    const {modal, saved} = mountModal({backend, socket})
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'Keep me')
    await click('Next')
    await click('Create Criterion')
    await waitFor(() => $('.invalid-feedback') !== null, 'error')
    assert.match(text(document.body), /The setting key "a" is used more than once\./)
    assert.equal(saved.length, 0)
    assert.equal(isOpen(modal), true)
    assert.equal($('#criterion-name').value, 'Keep me')
    assert.equal('versionNumber' in socket.calls[0].payload, false)
})

test('create: a missing connection is reported in the modal without losing the input', async () => {
    const socket = {connected: false, emit: () => {}, calls: []}
    const {modal} = mountModal({socket})
    modal.openCreate()
    await flush()
    await setValue('#criterion-name', 'Offline')
    await click('Next')
    await click('Create Criterion')
    await flush()
    assert.match(text(document.body), /Not connected to the server/)
    await click('Previous')
    assert.equal($('#criterion-name').value, 'Offline')
})

// ---------------------------------------------------------------------------------------------------------------
// 7. CriterionModal: view and new version

test('view: the stored version is loaded with criterionGet, every input of both steps is disabled and the last button only closes', async () => {
    const stored = criterion(1, 1, '2')
    const {modal, socket} = mountModal({criteria: [stored]})
    await modal.openView(1)
    await flush()
    assert.deepEqual(socket.calls, [{event: 'criterionGet', payload: {criterionId: 1}}])
    assert.match(text($('.modal-title')), /View Criterion — v2/)
    assert.equal(text(document.body).includes('Criterion group'), false, 'no group note')
    assert.equal(text(document.body).includes('shown read-only'), false)
    assert.equal($('.alert-info'), null)
    assert.equal($('#criterion-name').value, 'Criterion 1')
    assert.equal($('#criterion-min').value, '-2')
    assert.equal($('#criterion-max').value, '3.5')
    assert.deepEqual(settingRows(), [['tag', 'x'], ['weight', '5'], ['strict', 'true']])
    const inputs = $$('input, textarea, select')
    assert.equal(inputs.length > 0 && inputs.every(input => input.disabled), true, 'all inputs disabled')
    assert.equal(buttonByText('Add setting'), undefined)
    assert.equal($('button[title="Remove setting"]'), null)
    assert.equal(buttonByText('Next').disabled, false)
    await click('Next')
    assert.deepEqual(optionPoints(), ['-2', '3.5'])
    assert.equal($$('input').every(input => input.disabled), true)
    assert.equal(buttonByText('Add Scoring Option'), undefined)
    await click('Close')
    await waitFor(() => !isOpen(modal), 'modal to close')
    assert.equal(socket.calls.length, 1, 'viewing sends nothing else')
})

test('view: a version with a missing bound shows it switched off; a version that cannot be loaded shows the error and does not open', async () => {
    const {modal, toasts} = mountModal({criteria: [criterion(1, 1, '1', {minPoints: null})]})
    await modal.openView(1)
    await flush()
    assert.equal($('#criterion-min-active').checked, false)
    assert.equal($('#criterion-max-active').checked, true)

    const second = mountModal({criteria: []})
    assert.equal(await second.modal.openView(99), false)
    assert.equal(second.toasts.at(-1).variant, 'danger')
    assert.equal(toasts.length, 0)
})

test('new version: starts from the stored version without a version field, says the number is automatic, sends group, source, full content and types', async () => {
    const {modal, socket, saved, toasts} = mountModal({criteria: [criterion(1, 1, '1'), criterion(2, 1, '2')]})
    await modal.openNewVersion(2)
    await flush()
    assert.match(text($('.modal-title')), /Create New Criterion Version/)
    assert.equal($('#criterion-version'), null)
    assert.equal($('.alert-info'), null, 'no blue versioning banner')
    assert.equal(text(document.body).includes('assigned automatically'), false)
    assert.equal($('#criterion-name').value, 'Criterion 1')
    assert.equal(buttonByText('Next').disabled, false, 'valid as it is: nothing has to be entered')

    await setValue('#criterion-name', 'Renamed')
    const weight = $$('[id^="settings-value-"]')[1]
    await setValue(`#${weight.id}`, '9')   // typed: becomes a string; the untouched others keep their type
    await click('Next')
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved')
    assert.deepEqual(socket.calls.map(c => c.event), ['criterionGet', 'criterionCreateVersion'])
    const payload = socket.calls[1].payload
    assert.equal(payload.criterionGroupId, 1)
    assert.equal(payload.copyFromId, 2)
    assert.equal(payload.name, 'Renamed')
    assert.deepEqual(payload.settings, {tag: 'x', weight: '9', strict: true})
    assert.deepEqual([payload.minPoints, payload.maxPoints], [-2, 3.5])
    assert.deepEqual(payload.scoringOptions.map(o => o.points), [-2, 3.5], 'options in stored order, no ids')
    assert.equal('versionNumber' in payload, false)
    assert.equal(saved[0].versionNumber, '3', 'one above the highest existing number')
    assert.match(toasts.at(-1).message, /Version 3 of the criterion "Renamed"/)
})

test('new version: a switched-off bound is sent as null, a removed setting stays removed, removed options are not sent', async () => {
    const {modal, socket, saved} = mountModal({criteria: [criterion(1, 1, '1')]})
    await modal.openNewVersion(1)
    await flush()
    await setChecked('#criterion-min-active', false)
    fire($$('button[title="Remove setting"]')[0], 'click')
    await flush()
    await click('Next')
    fire($$('button[title="Remove scoring option"]')[0], 'click')
    await flush()
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved')
    const payload = socket.calls.at(-1).payload
    assert.equal(payload.minPoints, null)
    assert.deepEqual(payload.settings, {weight: 5, strict: true})
    assert.equal(payload.scoringOptions.length, 1)
})

test('new version: a copied version whose options lie outside its bounds shows the errors until they are fixed; viewing it shows none', async () => {
    const odd = criterion(1, 1, '1', {minPoints: 0, maxPoints: 1})
    const {modal} = mountModal({criteria: [odd]})
    await modal.openNewVersion(1)
    await flush()
    await click('Next')
    assert.match(text(document.body), /Points must be between 0 and 1\./)
    assert.equal(buttonByText('Create New Version').disabled, true)
    document.body.innerHTML = ''   // only the view modal below is on the page now
    const view = mountModal({criteria: [odd]})
    await view.modal.openView(1)
    await flush()
    await click('Next')
    assert.equal(text(document.body).includes('Points must be between'), false)
})

// ---------------------------------------------------------------------------------------------------------------
// 8. Table stand-ins, VersionsModal and the dashboard page

const tableCalls = []
const BasicTable = {
    props: ['columns', 'data', 'options', 'buttons', 'maxTableHeight'],
    emits: ['action'],
    setup(props, {emit}) {
        tableCalls.push(props)
        return () => h('table', {'data-test': 'table'}, props.data.map(row => h('tr', {'data-row': row.id}, [
            h('td', String(row.id)), h('td', row.name), h('td', String(row.versionNumber)), h('td', String(row.versionCount ?? '')),
            ...props.buttons.map(button => h('button', {
                'data-action': button.action, title: button.title, class: button.options?.specifiers?.disabled ? 'disabled' : '',
                onClick: () => emit('action', {action: button.action, params: row}),
            }, button.title)),
        ])))
    },
}
const BasicLoading = {props: ['text'], render() { return h('div', {'data-test': 'loading'}, this.text) }}
const confirmCalls = []
const ConfirmModal = {
    methods: {open(title, message, warning, cb) { confirmCalls.push({title, message, warning, cb}) }},
    render: () => null,
}
const rowAction = (kind, o) => ({kind, ...o})
const VersionsModal = loadComponent('components/dashboard/assessments/VersionsModal.vue', {
    BasicButton, BasicLoading, BasicModal, BasicTable, ConfirmModal, dashboardRowAction: rowAction,
    withSearch: (await import('../src/basic/dashboard/constants.js')).withSearch,
    failureText: failureLib.failureText, requestAssessment: socketLib.requestAssessment, escapeHtml: form.escapeHtml,
})

function mountVersions({criteria = [], backend = makeBackend(criteria), socket = fakeSocket(backend.handlers), props = {}} = {}) {
    tableCalls.length = 0
    confirmCalls.length = 0
    const toasts = []
    const viewed = []
    const changed = []
    const modal = mount(VersionsModal, {
        kind: 'criterion', kindLabel: 'assessmentManagement.kinds.criterion',
        onView: version => viewed.push(version), onChanged: data => changed.push(data), ...props,
    }, {$socket: socket, eventBus: {emit: (event, data) => toasts.push({event, ...data})}})
    return {modal, socket, backend, toasts, viewed, changed}
}

const GROUP = [criterion(1, 1, '1'), criterion(2, 1, '2'), criterion(3, 1, '3')]
const isVersionsOpen = modal => modal.$refs.modal.isShown

test('versions modal: lists the versions of one group newest first with number, name and creation date; the title names the criterion', async () => {
    const {modal, socket} = mountVersions({criteria: [...GROUP, criterion(9, 2, '1')]})
    modal.open({groupId: 1, name: 'Criterion 1'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    assert.deepEqual(socket.calls, [{event: 'criterionGetVersions', payload: {criterionGroupId: 1}}])
    assert.match(text($('.modal-title')), /Versions of "Criterion 1"/)
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [3, 2, 1], 'newest first; the other group is not shown')
    const props = tableCalls.at(-1)
    assert.deepEqual(props.columns.map(c => [c.name, c.key]), [['Version', 'versionNumber'], ['Name', 'name'], ['Created at', 'createdAt']])
    assert.equal(props.columns.find(c => c.key === 'createdAt').type, 'datetime')
    assert.deepEqual(props.buttons.map(b => b.action), ['view', 'delete'])
    assert.equal(props.options.search, true, 'the search box finds a version by name or number')
    assert.equal(props.options.pagination, 10)
    assert.equal(props.options.striped, true)
})

test('versions modal: View hands the version to the page; nothing is requested or changed', async () => {
    const {modal, socket, viewed} = mountVersions({criteria: GROUP})
    modal.open({groupId: 1, name: 'C'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    fire($('[data-row="2"] [data-action="view"]'), 'click')
    await flush()
    assert.equal(viewed.length, 1)
    assert.equal(viewed[0].id, 2)
    assert.equal(socket.calls.length, 1)
})

test('versions modal: Delete asks first and quotes version and name; cancelling sends nothing', async () => {
    const {modal, socket} = mountVersions({criteria: [criterion(1, 1, '1', {name: '<b>Risky</b>'})]})
    modal.open({groupId: 1, name: 'C'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    fire($('[data-row="1"] [data-action="delete"]'), 'click')
    await flush()
    assert.equal(confirmCalls.length, 1)
    assert.match(confirmCalls[0].message, /Delete version "1" of the criterion "&lt;b&gt;Risky&lt;\/b&gt;"\?/)
    confirmCalls[0].cb(false)
    await flush()
    assert.deepEqual(socket.calls.map(c => c.event), ['criterionGetVersions'])
    assert.equal($('[data-row="1"]') !== null, true)
})

test('versions modal: a confirmed delete keeps the row until the backend answers, then reloads the list and tells the page', async () => {
    const backend = makeBackend(GROUP)
    let release
    const socket = fakeSocket({...backend.handlers, criterionDelete: payload => { release = () => socket.pending.at(-1).ack(backend.handlers.criterionDelete(payload)); return undefined }})
    const {modal, toasts, changed} = mountVersions({backend, socket})
    modal.open({groupId: 1, name: 'C'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    fire($('[data-row="2"] [data-action="delete"]'), 'click')
    await flush()
    confirmCalls[0].cb(true)
    await flush()
    assert.equal($('[data-row="2"]') !== null, true, 'still listed while the request runs')
    assert.deepEqual(socket.calls.at(-1), {event: 'criterionDelete', payload: {criterionId: 2}})
    release()
    await waitFor(() => $('[data-row="2"]') === null, 'row to disappear after the reload')
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [3, 1])
    assert.equal(changed.length, 1, 'the page reloads its main table (latest version and count)')
    assert.equal(changed[0].groupId, 1)
    assert.equal(toasts.at(-1).variant, 'success')
    assert.match(toasts.at(-1).message, /Version 2 of the criterion "Criterion 1" was deleted\./)
})

test('versions modal: deleting the last version closes the modal', async () => {
    const {modal, changed} = mountVersions({criteria: [criterion(1, 1, '1')]})
    modal.open({groupId: 1, name: 'C'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    fire($('[data-row="1"] [data-action="delete"]'), 'click')
    await flush()
    confirmCalls[0].cb(true)
    await waitFor(() => changed.length === 1, 'changed')
    await waitFor(() => !isVersionsOpen(modal), 'modal to close')
})

test('versions modal: a version that is still used is refused with the backend message; the list stays and nothing is reloaded', async () => {
    const backend = makeBackend(GROUP)
    backend.referenced.add(2)
    const {modal, socket, toasts, changed} = mountVersions({backend})
    modal.open({groupId: 1, name: 'C'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    fire($('[data-row="2"] [data-action="delete"]'), 'click')
    await flush()
    confirmCalls[0].cb(true)
    await waitFor(() => toasts.length === 1, 'toast')
    assert.equal(toasts[0].variant, 'danger')
    assert.match(toasts[0].message, /used by 1 rubric version/)
    assert.equal($$('[data-row]').length, 3)
    assert.equal(changed.length, 0)
    assert.equal(socket.calls.filter(c => c.event === 'criterionGetVersions').length, 1)
})

test('versions modal: Delete is always offered (no disabled state, no explanation banner)', async () => {
    const {modal} = mountVersions({criteria: GROUP})
    modal.open({groupId: 1, name: 'C'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    assert.equal($('.versions-delete-disabled'), null)
    assert.equal($$('[data-action="delete"]').every(button => !button.classList.contains('disabled')), true)
})

test('advanced settings: the empty state of a read-only view says only "No settings."; the editable one keeps the hint and the add button', async () => {
    const {modal} = mountModal({criteria: [criterion(1, 1, '1', {settings: {}})]})
    await modal.openView(1)
    await flush()
    await openSettings()
    const empty = $$('p.fst-italic').map(text)
    assert.deepEqual(empty, ['No settings.'])
    assert.equal(text(document.body).includes('Add a key and a value'), false)
    assert.equal(buttonByText('Add setting'), undefined, 'a read-only view has no add button')
    await click('Close')
})

test('advanced settings: the editable empty state keeps its hint and the add button', async () => {
    const {modal} = mountModal({criteria: []})
    await modal.openCreate()
    await flush()
    await openSettings()
    assert.deepEqual($$('p.fst-italic').map(text), ['No settings. Add a key and a value if you need one.'])
    assert.notEqual(buttonByText('Add setting'), undefined)
})

test('versions modal: a failed load shows the error with a retry; an unknown group shows the backend message', async () => {
    let failing = true
    const backend = makeBackend(GROUP)
    const socket = fakeSocket({...backend.handlers, criterionGetVersions: payload => (failing ? fail('errors.assessment.accessDenied', {}, 'no access') : backend.handlers.criterionGetVersions(payload))})
    const {modal} = mountVersions({backend, socket})
    modal.open({groupId: 1, name: 'C'})
    await waitFor(() => $('.alert-danger') !== null, 'error')
    assert.match(text($('.alert-danger')), /do not have access to the Assessment Management Dashboard/)
    failing = false
    fire($('.alert-danger button'), 'click')
    await waitFor(() => $('[data-test="table"]') !== null, 'table after retry')
    assert.equal($('.alert-danger'), null)
})
