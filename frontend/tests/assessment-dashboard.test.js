/**
 * Tests of the Rubrics and Assessments tabs and of the dashboard page of the Assessment Management Dashboard
 * (Phase D: rubrics and assessments on the real backend events).
 *
 * Pure parts (rubric and assessment form mapping, calculation options, selection rows) run directly. The components
 * are the real ones (RubricModal, AssessmentModal, their steps, the ordered version selection, StepperModal,
 * BasicModal, the shared VersionsModal, the table panel and the page mixin) mounted with the real Vue, vue-i18n,
 * Bootstrap and the English catalog on a Happy DOM document. Only BasicTable (it also takes part in the selection
 * the way the real one does, by changing its model array in place), BasicButton and ConfirmModal are light stand-ins.
 * The backend is an in-memory fake that follows the criterion*, rubric* and assessment* socket contracts; the real
 * events run against PostgreSQL in backend/tests/socket.assessment_frontend_contract.test.js with the very payload
 * builders tested here. No browser test is claimed.
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
const criterionForm = await import(`${DIR}criterionForm.js`)
const rubricForm = await import(`${DIR}rubricForm.js`)
const assessmentForm = await import(`${DIR}assessmentForm.js`)
const selection = await import(`${DIR}selectionRows.js`)
const settingsLib = await import(`${DIR}settingsForm.js`)
const boundsLib = await import(`${DIR}pointBounds.js`)
const socketLib = await import(`${DIR}assessmentSocket.js`)
const failureLib = await import(`${DIR}failureMessage.js`)
const validation = await import(`${DIR}assessmentValidation.js`)
const constants = await import(`${DIR}assessmentConstants.js`)
const tableConstants = await import('../src/basic/dashboard/constants.js')

const readCatalog = lang => JSON.parse(readFileSync(new URL(`../../utils/modules/i18n/${lang}/assessmentManagement.json`, import.meta.url), 'utf8'))
const en = readCatalog('en')
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

/** Evaluates a plain module whose default export is an object (the page mixin). */
function loadMixin(path, stubs = {}) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
    const importPattern = /^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
    const names = [...source.matchAll(importPattern)].flatMap(([, clause]) =>
        clause.replace(/[{}]/g, '').split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
    return new Function(...names, source.replace(importPattern, '').replace('export default', 'return'))(
        ...names.map(name => stubs[name] ?? {}))
}

const translate = key => key.split('.').reduce((node, part) => node?.[part], MESSAGES) ?? key


const BasicButton = {
    props: ['text', 'title', 'icon', 'disabled'],
    render() {
        return h('button', {disabled: this.disabled, 'data-icon': this.icon, title: this.title}, this.text || this.title || '')
    },
}
const FormHelp = {props: ['help'], render() { return h('span', {class: 'form-help', 'data-help': this.help}, '?') }}
const FormCollapsible = loadComponent('basic/form/Collapsible.vue', {LoadIcon: {render: () => null}})
const BasicModal = loadComponent('basic/Modal.vue', {Modal: BootstrapModal, uuid: () => 'uuid'})
const StepperModal = loadComponent('basic/modal/StepperModal.vue', {BasicModal, BasicButton})
const AssessmentFormField = loadComponent('components/dashboard/assessments/AssessmentFormField.vue')
const PointBoundField = loadComponent('components/dashboard/assessments/PointBoundField.vue', {
    FormHelp, parsePoints: validation.parsePoints, sliderRange: boundsLib.sliderRange, sliderStep: boundsLib.sliderStep,
})
const SettingsEditor = loadComponent('components/dashboard/assessments/SettingsEditor.vue', {
    BasicButton, FormCollapsible, SETTINGS_LIMITS: settingsLib.SETTINGS_LIMITS,
    emptySettingsRow: settingsLib.emptySettingsRow, validateSettingsRows: settingsLib.validateSettingsRows,
})

// A table that lists the rows with their action buttons and, with `selectableRows`, a checkbox per row that changes
// the model array IN PLACE (push / splice) like the real BasicTable does.
const tableCalls = []
const BasicTable = {
    props: ['columns', 'data', 'options', 'buttons', 'maxTableHeight', 'modelValue'],
    emits: ['action', 'update:modelValue'],
    setup(props, {emit}) {
        tableCalls.push(props)
        const toggle = row => {
            const index = props.modelValue.findIndex(r => r.id === row.id)
            if (index >= 0) props.modelValue.splice(index, 1)
            else props.modelValue.push(row)
        }
        return () => h('table', {'data-test': 'table'}, props.data.map(row => h('tr', {'data-row': row.id}, [
            props.options?.selectableRows
                ? h('td', h('input', {type: 'checkbox', 'data-select': row.id, checked: props.modelValue.some(r => r.id === row.id), onChange: () => toggle(row)}))
                : null,
            h('td', row.name), h('td', String(row.versionNumber ?? '')), h('td', String(row.versionCount ?? '')),
            ...(props.buttons ?? []).map(button => h('button', {
                'data-action': button.action, title: button.title, class: button.options?.specifiers?.disabled ? 'disabled' : '',
                onClick: () => emit('action', {action: button.action, params: row}),
            }, button.title)),
        ])))
    },
}
const BasicLoading = {props: ['text'], render() { return h('div', {'data-test': 'loading'}, this.text) }}
const BasicIcon = {props: ['iconName', 'size'], render: () => null}
const OrderedSelectionStep = loadComponent('components/dashboard/assessments/OrderedSelectionStep.vue', {BasicTable, BasicButton, BasicIcon})
const RubricDetailsStep = loadComponent('components/dashboard/assessments/RubricDetailsStep.vue', {
    AssessmentFormField, PointBoundField, SettingsEditor, FormHelp,
    calculationOptions: constants.calculationOptions, usesDefaultPoints: constants.usesDefaultPoints,
    parsePoints: validation.parsePoints, activeBounds: criterionForm.activeBounds,
})
const AssessmentDetailsStep = loadComponent('components/dashboard/assessments/AssessmentDetailsStep.vue', {AssessmentFormField})
const RubricModal = loadComponent('components/dashboard/assessments/RubricModal.vue', {
    StepperModal, RubricDetailsStep, OrderedSelectionStep, failureText: failureLib.failureText,
    requestAssessment: socketLib.requestAssessment, ...rubricForm, ...selection,
    activeBounds: criterionForm.activeBounds, CRITERION_MODES: criterionForm.CRITERION_MODES,
})
const AssessmentModal = loadComponent('components/dashboard/assessments/AssessmentModal.vue', {
    StepperModal, AssessmentDetailsStep, OrderedSelectionStep, failureText: failureLib.failureText,
    requestAssessment: socketLib.requestAssessment, visibleErrors: validation.visibleErrors, ...assessmentForm, ...selection,
    CRITERION_MODES: criterionForm.CRITERION_MODES,
})
const confirmCalls = []
const ConfirmModal = {
    methods: {open(title, message, warning, cb) { confirmCalls.push({title, message, warning, cb}) }},
    render: () => null,
}
const rowAction = (kind, o) => ({kind, ...o})
const VersionsModal = loadComponent('components/dashboard/assessments/VersionsModal.vue', {
    BasicButton, BasicLoading, BasicModal, BasicTable, ConfirmModal, dashboardRowAction: rowAction,
    withSearch: tableConstants.withSearch,
    failureText: failureLib.failureText, requestAssessment: socketLib.requestAssessment, escapeHtml: criterionForm.escapeHtml,
})
const versionedBackendMixin = loadMixin('components/dashboard/assessments/versionedBackendMixin.js', {
    failureText: failureLib.failureText, requestAssessment: socketLib.requestAssessment,
})

// ---------------------------------------------------------------------------------------------------------------
// Fake backend with the criterion*, rubric* and assessment* contracts (automatic numbers, soft delete, reference
// protection, no deletion of assessments)

const errorsCatalog = lang => JSON.parse(readFileSync(new URL(`../../utils/modules/i18n/${lang}/errors.json`, import.meta.url), 'utf8')).assessment
const fill = (template, params) => template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match))
const clone = value => JSON.parse(JSON.stringify(value))
const ok = data => ({success: true, data})
const fail = (key, params = {}, message = key) => ({success: false, key, params, message})
const GROUP = {criterion: 'criterionGroupId', rubric: 'rubricGroupId', assessment: 'assessmentGroupId'}
const CHILDREN = {rubric: 'criterionIds', assessment: 'rubricIds'}
const TARGET = {rubric: 'criterion', assessment: 'rubric'}

function makeWorld(seed = {}) {
    const store = {
        criterion: clone(seed.criterion ?? []).map(r => ({deleted: false, ...r})),
        rubric: clone(seed.rubric ?? []).map(r => ({deleted: false, ...r})),
        assessment: clone(seed.assessment ?? []).map(r => ({deleted: false, ...r})),
    }
    // assessment version id -> text of the study step that uses it (stands in for the JSON reference check)
    const studyUses = seed.studyUses ?? {}
    let nextId = 5000
    let nextGroup = 700
    const live = (kind, group) => store[kind].filter(r => !r.deleted && (group === undefined || r[GROUP[kind]] === group))
    const nextNumber = (kind, group) => String(1 + Math.max(0, ...store[kind].filter(r => r[GROUP[kind]] === group).map(r => parseInt(r.versionNumber, 10) || 0)))
    const link = (kind, row) => {
        // links with the full target version, like the backend answers
        if (kind === 'rubric') {
            return {criteria: row.criterionIds.map((criterionId, i) => ({id: row.id * 100 + i, rubricId: row.id, criterionId, criterionPositionInRubric: i + 1, criterion: clone(store.criterion.find(c => c.id === criterionId))}))}
        }
        return {rubrics: row.rubricIds.map((rubricId, i) => ({id: row.id * 100 + i, assessmentId: row.id, rubricId, rubricPositionInAssessment: i + 1, rubric: {...clone(store.rubric.find(r => r.id === rubricId))}}))}
    }
    const full = (kind, row) => {
        const plain = clone(row)
        if (kind === 'criterion') return plain
        const {criterionIds, rubricIds, ...rest} = plain // eslint-disable-line no-unused-vars
        return {...rest, ...link(kind, row)}
    }
    const check = (kind, payload) => {
        if ('versionNumber' in payload) return fail('errors.assessment.versionNumberNotAllowed', {}, 'The version number is assigned automatically.')
        if ('previousAssessmentVersionId' in payload) return fail('errors.assessment.unexpected', {}, 'predecessor must not be sent')
        if (kind === 'criterion') return null
        const ids = payload[CHILDREN[kind]] ?? []
        const duplicate = ids.find((id, i) => ids.indexOf(id) !== i)
        if (duplicate !== undefined) {
            return kind === 'rubric'
                ? fail('errors.assessment.rubric.duplicateCriterion', {criterionId: duplicate}, `Criterion version ${duplicate} is selected twice.`)
                : fail('errors.assessment.assessment.duplicateRubric', {rubricId: duplicate}, `Rubric version ${duplicate} is selected twice.`)
        }
        const missing = ids.filter(id => !live(TARGET[kind]).some(t => t.id === id))
        if (missing.length) {
            return kind === 'rubric'
                ? fail('errors.assessment.rubric.criteriaNotFound', {criterionIds: missing.join(', ')}, `Criterion version(s) ${missing.join(', ')} not found.`)
                : fail('errors.assessment.assessment.rubricsNotFound', {rubricIds: missing.join(', ')}, `Rubric version(s) ${missing.join(', ')} not found.`)
        }
        return null
    }
    const create = (kind, payload, group) => {
        const row = {...clone(payload), id: ++nextId, [GROUP[kind]]: group, versionNumber: nextNumber(kind, group), deleted: false, createdAt: '2026-11-10T10:00:00.000Z'}
        delete row.copyFromId
        store[kind].push(row)
        return clone(full(kind, row))
    }
    const handlers = {}
    for (const kind of ['criterion', 'rubric', 'assessment']) {
        handlers[`${kind}GetAll`] = () => ok(live(kind).map(row => full(kind, row)))
        handlers[`${kind}GetLatest`] = () => {
            const groups = [...new Set(live(kind).map(r => r[GROUP[kind]]))]
            return ok(groups.map(group => {
                const versions = live(kind, group)
                const latest = versions.reduce((a, b) => (b.id > a.id ? b : a))
                const {scoringOptions, criterionIds, rubricIds, deleted, ...plain} = clone(latest) // eslint-disable-line no-unused-vars
                return {...plain, versionCount: versions.length}
            }))
        }
        handlers[`${kind}GetVersions`] = payload => {
            const versions = live(kind, payload[GROUP[kind]]).sort((a, b) => b.id - a.id)
            return versions.length
                ? ok(versions.map(({id, versionNumber, name, createdAt, ...rest}) => ({id, [GROUP[kind]]: rest[GROUP[kind]], versionNumber, name, createdAt})))
                : fail(`errors.assessment.${kind}.groupNotFound`)
        }
        handlers[`${kind}Get`] = payload => {
            const row = live(kind).find(r => r.id === payload[`${kind}Id`])
            return row ? ok(full(kind, row)) : fail(`errors.assessment.${kind}.notFound`)
        }
        handlers[`${kind}Create`] = payload => check(kind, payload) ?? ok(create(kind, payload, ++nextGroup))
        handlers[`${kind}CreateVersion`] = payload => {
            const source = live(kind).find(r => r.id === payload.copyFromId)
            if (!source || source[GROUP[kind]] !== payload[GROUP[kind]]) return fail(`errors.assessment.${kind}.copySourceMismatch`)
            return check(kind, payload) ?? ok(create(kind, payload, payload[GROUP[kind]]))
        }
        handlers[`${kind}Delete`] = payload => {
            const id = payload[`${kind}Id`]
            const row = live(kind).find(r => r.id === id)
            if (!row) return fail(`errors.assessment.${kind}.notFound`)
            if (kind === 'assessment' && studyUses[id]) {
                const params = {name: row.name, version: row.versionNumber, count: 1, studySteps: studyUses[id], templateSteps: '-', triggers: '-', triggerActions: '-', queuedRuns: '-'}
                return fail('errors.assessment.assessment.inUse', params, fill(errorsCatalog('en').assessment.inUse, params))
            }
            const parent = kind === 'criterion' ? 'rubric' : 'assessment'
            const users = kind === 'assessment' ? [] : live(parent).filter(r => r[CHILDREN[parent]].includes(id))
            if (users.length) {
                const params = {name: row.name, version: row.versionNumber, count: users.length, references: users.map(u => `'${u.name}' (v${u.versionNumber})`).join(', ')}
                return fail(`errors.assessment.${kind}.inUse`, params, fill(errorsCatalog('en')[kind].inUse, params))
            }
            row.deleted = true
            const rest = live(kind, row[GROUP[kind]])
            return ok({id, [GROUP[kind]]: row[GROUP[kind]], latestVersionId: rest.length ? Math.max(...rest.map(r => r.id)) : null})
        }
    }
    return {store, handlers}
}

const crit = (id, group, version, extra = {}) => ({id, criterionGroupId: group, versionNumber: version, name: `Criterion ${group}`, description: '', minPoints: 0, maxPoints: 3, settings: {}, createdAt: '2026-11-01T08:00:00.000Z', scoringOptions: [], ...extra})
const rub = (id, group, version, criterionIds, extra = {}) => ({id, rubricGroupId: group, versionNumber: version, name: `Rubric ${group}`, description: '', minPoints: 0, maxPoints: 10, calculation: 'sum', defaultPoints: null, isBonus: false, settings: {}, criterionIds, createdAt: '2026-11-02T08:00:00.000Z', ...extra})
const asm = (id, group, version, rubricIds, extra = {}) => ({id, assessmentGroupId: group, versionNumber: version, name: `Assessment ${group}`, description: '', previousAssessmentVersionId: null, rubricIds, createdAt: '2026-11-03T08:00:00.000Z', ...extra})

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
            if (response === undefined) pending.push({event, ack})
            else queueMicrotask(() => ack(response))
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
    while (cleanups.length) cleanups.pop()()
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

/** Ticks the checkbox of a row in the selection table. */
async function pick(id) {
    const box = $(`[data-select="${id}"]`)
    assert.ok(box, `row ${id} is not offered`)
    fire(box, 'change')
    await flush()
}

const mountModal = (component, world = makeWorld(), socket = fakeSocket(world.handlers)) => {
    const toasts = []
    const saved = []
    const modal = mount(component, {onSaved: data => saved.push(data)}, {$socket: socket, eventBus: {emit: (event, data) => toasts.push({event, ...data})}})
    return {modal, socket, world, toasts, saved}
}
const isOpen = modal => modal.$refs.stepper.$refs.stepperModal.isShown
const settingRows = () => $$('[id^="settings-key-"]').map(key => [key.value, $(`#${key.id.replace('key', 'value')}`).value])
const orderedNames = () => $$('.list-group-item .fw-semibold').map(text)
const orderedDetails = () => $$('.list-group-item .text-muted').map(text)

const CRITERIA = [crit(1, 1, '1', {name: 'Clarity'}), crit(2, 1, '2', {name: 'Clarity'}), crit(3, 2, '1', {name: 'Depth', minPoints: null, maxPoints: -1}), crit(4, 3, '1', {name: 'Style'})]
const RUBRICS = [rub(10, 1, '1', [1, 3]), rub(11, 1, '2', [2, 3, 4], {name: 'Rubric 1', calculation: 'max', defaultPoints: 8, isBonus: true, settings: {tier: 'a', level: 2, strict: true}}), rub(12, 2, '1', [4], {calculation: 'min'})]

// ---------------------------------------------------------------------------------------------------------------
// 1. Pure: constants, rubric form, assessment form, selection rows

test('calculation: new rubrics choose Summation or Base + adjustments; there is no Capped sum choice, an older stored value stays listed', () => {
    assert.deepEqual(constants.CALCULATION_METHODS.map(m => m.value), ['sum', 'max'])
    assert.equal(en.calculation.sum, 'Summation')
    assert.deepEqual(constants.calculationOptions('sum').map(m => m.value), ['sum', 'max'])
    assert.deepEqual(constants.calculationOptions(null).map(m => m.value), ['sum', 'max'])
    const legacy = constants.calculationOptions('min')
    assert.deepEqual(legacy.map(m => m.value), ['sum', 'max', 'min'])
    assert.equal(legacy[2].labelKey, 'assessmentManagement.calculation.min')
    assert.deepEqual(constants.calculationOptions('weird').at(-1), {value: 'weird', labelKey: null, usesDefaultPoints: false})
    assert.equal(constants.usesDefaultPoints('max'), true)
    assert.equal(constants.usesDefaultPoints('sum'), false)
    assert.equal(constants.usesDefaultPoints('min'), false)
})

test('rubric payload: Summation, inactive bounds null, no default points, no version number, criterion version ids in order', () => {
    const f = rubricForm.emptyRubricForm()
    f.name = 'Style'
    assert.deepEqual(rubricForm.toRubricPayload(f, [3, 1, 2]), {
        name: 'Style', description: '', minPoints: null, maxPoints: null, calculation: 'sum', defaultPoints: null,
        isBonus: false, settings: {}, criterionIds: [3, 1, 2],
    })
    const max = {...f, calculation: 'max', defaultPoints: 8.5, isBonus: true, minActive: true, minPoints: -2, settingsRows: settingsLib.rowsFromSettings({k: 'v', n: 5})}
    const payload = rubricForm.toRubricPayload(max, [])
    assert.deepEqual([payload.calculation, payload.defaultPoints, payload.isBonus, payload.minPoints, payload.maxPoints], ['max', 8.5, true, -2, null])
    assert.deepEqual(payload.settings, {k: 'v', n: 5}, 'untouched stored values keep their type')
    for (const gone of ['versionNumber', 'code']) assert.equal(gone in payload, false)
    const sum = {...max, calculation: 'sum'}
    assert.equal(rubricForm.toRubricPayload(sum, []).defaultPoints, null, 'default points only mean something for Base + adjustments')
})

test('rubric from a stored version: legacy calculation and typed settings kept, bounds switched off when null, criterion ids in stored order', () => {
    const stored = {...rub(12, 2, '1', []), calculation: 'min', minPoints: null, maxPoints: 4, settings: {x: 1}, criteria: [
        {criterionId: 7, criterionPositionInRubric: 2}, {criterionId: 5, criterionPositionInRubric: 1}]}
    const f = rubricForm.formFromRubric(stored)
    assert.deepEqual([f.calculation, f.minActive, f.maxActive, f.maxPoints], ['min', false, true, 4])
    assert.deepEqual(settingsLib.settingsFromRows(f.settingsRows), {x: 1})
    assert.deepEqual(rubricForm.criterionIdsFromRubric(stored), [5, 7])
    assert.equal(rubricForm.toRubricPayload(f, [5, 7]).calculation, 'min', 'copying keeps the stored value until the user changes it')
    assert.deepEqual(rubricForm.rubricSource(stored), {id: 12, rubricGroupId: 2, versionNumber: '1', name: 'Rubric 2'})
    const request = rubricForm.rubricVersionRequest(rubricForm.rubricSource(stored), f, [5])
    assert.deepEqual([request.rubricGroupId, request.copyFromId, 'versionNumber' in request], [2, 12, false])
})

test('rubric validation: a name, active bounds, min <= max, default points for Base + adjustments inside the active bounds, settings', () => {
    const f = rubricForm.emptyRubricForm()
    assert.equal(rubricForm.validateRubricForm(f).name, 'required')
    f.name = 'R'
    assert.deepEqual(rubricForm.validateRubricForm(f), {})
    assert.equal(rubricForm.validateRubricForm({...f, minActive: true, minPoints: 3, maxActive: true, maxPoints: 2}).maxPoints, 'maxBelowMin')
    assert.equal(rubricForm.validateRubricForm({...f, calculation: 'max'}).defaultPoints, 'required')
    assert.equal(rubricForm.validateRubricForm({...f, calculation: 'max', defaultPoints: 'x'}).defaultPoints, 'number')
    assert.deepEqual(rubricForm.validateRubricForm({...f, calculation: 'max', defaultPoints: -5}), {}, 'no bound: any default is fine')
    const bounded = {...f, calculation: 'max', minActive: true, minPoints: 0, maxActive: true, maxPoints: 10}
    assert.equal(rubricForm.validateRubricForm({...bounded, defaultPoints: 11}).defaultPoints, 'pointsBetween')
    assert.deepEqual(rubricForm.validateRubricForm({...bounded, defaultPoints: 10}), {})
    assert.equal(rubricForm.validateRubricForm({...bounded, maxActive: false, defaultPoints: -1}).defaultPoints, 'pointsAtLeast')
    assert.equal(rubricForm.validateRubricForm({...bounded, minActive: false, defaultPoints: 11}).defaultPoints, 'pointsAtMost')
    const duplicate = [{...settingsLib.emptySettingsRow(), key: 'a'}, {...settingsLib.emptySettingsRow(), key: 'a'}]
    assert.ok(rubricForm.validateRubricForm({...f, settingsRows: duplicate}).settings)
    assert.equal(rubricForm.validateRubricForm({...f, calculation: 'min', defaultPoints: ''}).defaultPoints, undefined, 'a legacy method has no default points')
})

test('rubric backend errors are assigned to the field and step that shows them', () => {
    assert.deepEqual(rubricForm.rubricErrorTarget({key: 'errors.assessment.pointsRange'}), {field: 'maxPoints', step: 0})
    assert.deepEqual(rubricForm.rubricErrorTarget({key: 'errors.assessment.settingsKeyDuplicate'}), {field: 'settings', step: 0})
    assert.deepEqual(rubricForm.rubricErrorTarget({key: 'errors.assessment.rubric.criteriaNotFound'}), {field: null, step: 1})
    assert.deepEqual(rubricForm.rubricErrorTarget({key: 'errors.assessment.rubric.duplicateCriterion'}), {field: null, step: 1})
    assert.deepEqual(rubricForm.rubricErrorTarget({key: 'errors.assessment.fieldInvalid', params: {field: 'criterionIds'}}), {field: null, step: 1})
    assert.deepEqual(rubricForm.rubricErrorTarget({key: 'errors.assessment.fieldInvalid', params: {field: 'isBonus'}}), {field: 'isBonus', step: 0})
    assert.deepEqual(rubricForm.rubricErrorTarget({key: 'errors.assessment.accessDenied'}), {field: null, step: null})
})

test('assessment payload: name, description and rubric version ids in order; no version number and never a predecessor', () => {
    const f = {name: 'Exam', description: 'Final'}
    assert.deepEqual(assessmentForm.toAssessmentPayload(f, [12, 10]), {name: 'Exam', description: 'Final', rubricIds: [12, 10]})
    const stored = {id: 5, assessmentGroupId: 9, versionNumber: '3', name: 'Exam', previousAssessmentVersionId: 4,
        rubrics: [{rubricId: 11, rubricPositionInAssessment: 2}, {rubricId: 10, rubricPositionInAssessment: 1}]}
    assert.deepEqual(assessmentForm.rubricIdsFromAssessment(stored), [10, 11])
    const request = assessmentForm.assessmentVersionRequest(assessmentForm.assessmentSource(stored), assessmentForm.formFromAssessment(stored), [10, 11])
    assert.deepEqual(Object.keys(request).sort(), ['assessmentGroupId', 'copyFromId', 'description', 'name', 'rubricIds'])
    assert.equal(request.assessmentGroupId, 9)
    assert.equal(request.copyFromId, 5)
    assert.equal(assessmentForm.assessmentSource(null), null)
    assert.equal(assessmentForm.validateAssessmentForm({name: ' '}).name, 'required')
    assert.equal(assessmentForm.validateAssessmentForm({name: 'x'.repeat(256)}).name, 'tooLong')
    assert.deepEqual(assessmentForm.validateAssessmentForm({name: 'ok'}), {})
    assert.deepEqual(assessmentForm.assessmentErrorTarget({key: 'errors.assessment.assessment.duplicateRubric'}), {field: null, step: 1})
    assert.deepEqual(assessmentForm.assessmentErrorTarget({key: 'errors.assessment.fieldRequired', params: {field: 'name'}}), {field: 'name', step: 0})
})

test('selection rows: one row per version with its id, version label and point range; the range is open where a bound is missing', () => {
    assert.equal(selection.formatRange(-1, 3.5), '-1 – 3.5')
    assert.equal(selection.formatRange(0, null), '≥ 0')
    assert.equal(selection.formatRange(null, -2), '≤ -2')
    assert.equal(selection.formatRange(null, null), '–')
    const rows = selection.versionRows(CRITERIA)
    assert.deepEqual(rows.map(r => [r.id, r.name, r.detail]), [[2, 'Clarity', 'v2'], [1, 'Clarity', 'v1'], [3, 'Depth', 'v1'], [4, 'Style', 'v1']], 'by name, newest version first')
    assert.equal(rows.find(r => r.id === 3).points, '≤ -1')
    const linked = selection.rowsFromRubricCriteria({criteria: [
        {criterionId: 4, criterionPositionInRubric: 2, criterion: crit(4, 3, '1', {name: 'Style'})},
        {criterionId: 1, criterionPositionInRubric: 1, criterion: crit(1, 1, '1', {name: 'Clarity'})}]})
    assert.deepEqual(linked.map(r => [r.id, r.name]), [[1, 'Clarity'], [4, 'Style']])
    const assessed = selection.rowsFromAssessmentRubrics({rubrics: [{rubricId: 10, rubricPositionInAssessment: 1, rubric: rub(10, 1, '1', [])}]})
    assert.deepEqual(assessed.map(r => r.detail), ['v1'])
})

// ---------------------------------------------------------------------------------------------------------------
// 2. Rubric modal

test('rubric create: Summation or Base + adjustments (no Capped sum), bounds off, bonus checkbox with a help tooltip, settings, two steps', async () => {
    const {modal} = mountModal(RubricModal, makeWorld({criterion: CRITERIA}))
    assert.equal(await modal.openCreate(), true)
    await flush()
    assert.match(text($('.modal-title')), /Add Rubric/)
    for (const gone of ['#rubric-code', '#rubric-version']) assert.equal($(gone), null, gone)
    assert.deepEqual($$('#rubric-calculation option').map(text), ['Summation', 'Base + adjustments'])
    assert.equal(text(document.body).includes('Capped sum'), false)
    assert.equal($('#rubric-min-active').checked, false)
    assert.equal($('#rubric-max-active').checked, false)
    assert.equal($('#rubric-default'), null, 'default points only for Base + adjustments')
    assert.equal($('#rubric-bonus').checked, false)
    assert.equal($('.rubric-bonus .form-help').dataset.help, en.rubric.bonusHelp, 'question-mark tooltip on the bonus checkbox')
    assert.equal(en.rubric.bonusHelp, "A bonus rubric adds its points as extra points to the achieved score, but it does not increase the assessment's maximum score. The final score cannot exceed 100%.")
    assert.equal($('.rubric-bonus .form-help').getAttribute('data-bs-container'), 'body', 'the tooltip is attached to the body, so the modal cannot clip it')
    assert.equal($('.alert-info'), null, 'no versioning banner when a rubric is created')
    assert.equal(buttonByText('Next').disabled, true)
    await setValue('#rubric-name', 'Style')
    assert.equal(buttonByText('Next').disabled, false)
    fire($('.collapsible-header'), 'click')
    await flush()
    assert.match(text(document.body), /Advanced Settings/)
})

test('rubric create: bounds, calculation, default points, bonus, settings and the chosen criterion versions in order are sent to rubricCreate', async () => {
    const {modal, socket, toasts, saved} = mountModal(RubricModal, makeWorld({criterion: CRITERIA}))
    await modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'Mixed')
    await setValue('#rubric-description', 'Both')
    await setChecked('#rubric-min-active', true)
    await setValue('#rubric-min', '-2.5')
    await setChecked('#rubric-max-active', true)
    await setValue('#rubric-max', '10')
    await setValue('#rubric-calculation', 'max')
    await flush()
    assert.equal(buttonByText('Next').disabled, true, 'default points are needed')
    await setValue('#rubric-default', '8')
    await setChecked('#rubric-bonus', true)
    fire($('.collapsible-header'), 'click')
    await flush()
    await click('Add setting')
    await setValue('#' + $$('[id^="settings-key-"]')[0].id, 'tier')
    await setValue('#' + $$('[id^="settings-value-"]')[0].id, 'gold')
    await click('Next')

    assert.equal(buttonByText('Create Rubric').disabled, true, 'at least one criterion version')
    assert.match(text(document.body), /Select at least one criterion\./)
    await pick(4)
    await pick(1)
    assert.deepEqual(orderedNames(), ['Style', 'Clarity'], 'in the order picked')
    assert.deepEqual(orderedDetails(), ['v1', 'v1'])
    fire($$('button[title="Move up"]')[1], 'click')
    await flush()
    assert.deepEqual(orderedNames(), ['Clarity', 'Style'])
    await click('Create Rubric')
    await waitFor(() => saved.length === 1, 'saved')
    assert.deepEqual(socket.calls.map(c => c.event), ['criterionGetAll', 'rubricCreate'])
    assert.deepEqual(socket.calls[1].payload, {
        name: 'Mixed', description: 'Both', minPoints: -2.5, maxPoints: 10, calculation: 'max', defaultPoints: 8, isBonus: true,
        settings: {tier: 'gold'}, criterionIds: [1, 4],
    })
    assert.equal(saved[0].versionNumber, '1')
    assert.match(toasts.at(-1).message, /Rubric "Mixed" \(version 1\) was created\./)
    await waitFor(() => !isOpen(modal), 'modal to close')
})

test('rubric create: the selection offers criterion VERSIONS (each version is a row), never soft-deleted ones, no note under Selected order', async () => {
    const world = makeWorld({criterion: CRITERIA})
    world.handlers.criterionDelete({criterionId: 2})   // version 2 of Clarity is deleted
    const {modal} = mountModal(RubricModal, world)
    await modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'R')
    await click('Next')
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [1, 3, 4], 'version 2 is not offered')
    assert.match(text(document.body), /Selected order/)
    assert.equal($('.selection-pinned-note'), null)
    assert.equal(text(document.body).includes('never picked up automatically'), false, 'the explanatory note is gone')
    await pick(1)
    await pick(1)   // ticking again removes it
    assert.deepEqual(orderedNames(), [])
    assert.match(text(document.body), /No criteria selected yet\./)
})

test('rubric create: switched-off bounds and a hidden default are null; Summation sends no default points', async () => {
    const {modal, socket, saved} = mountModal(RubricModal, makeWorld({criterion: CRITERIA}))
    await modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'Plain')
    await click('Next')
    await pick(3)
    await click('Create Rubric')
    await waitFor(() => saved.length === 1, 'saved')
    const payload = socket.calls.at(-1).payload
    assert.deepEqual([payload.minPoints, payload.maxPoints, payload.calculation, payload.defaultPoints, payload.isBonus, payload.settings], [null, null, 'sum', null, false, {}])
})

test('rubric create: default points outside the active bounds and min above max block Next with an inline message', async () => {
    const {modal} = mountModal(RubricModal, makeWorld({criterion: CRITERIA}))
    await modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'R')
    await setChecked('#rubric-min-active', true)
    await setValue('#rubric-min', '0')
    await setChecked('#rubric-max-active', true)
    await setValue('#rubric-max', '10')
    await setValue('#rubric-calculation', 'max')
    await setValue('#rubric-default', '12')
    await flush()
    assert.match(text(document.body), /Points must be between 0 and 10\./)
    assert.equal(buttonByText('Next').disabled, true)
    await setValue('#rubric-default', '10')
    assert.equal(buttonByText('Next').disabled, false)
    await setValue('#rubric-min', '11')
    await flush()
    assert.match(text(document.body), /Maximum points must be greater than or equal to minimum points\./)
    assert.equal(buttonByText('Next').disabled, true)
})

test('rubric new version: starts from the stored version with its criterion versions pinned; a legacy calculation stays until changed', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS})
    const {modal, socket, saved, toasts} = mountModal(RubricModal, world)
    await modal.openNewVersion(12)   // calculation "min": no longer offered, but stored
    await flush()
    assert.match(text($('.modal-title')), /Create New Rubric Version/)
    assert.equal($('.alert-info'), null, 'no blue versioning banner')
    assert.equal(text(document.body).includes('assigned automatically'), false)
    assert.equal($('#rubric-version'), null)
    assert.deepEqual($$('#rubric-calculation option').map(text), ['Summation', 'Base + adjustments', 'Capped sum (older rubrics)'])
    assert.equal($('#rubric-calculation').value, 'min')
    assert.equal(buttonByText('Next').disabled, false)
    await click('Next')
    assert.deepEqual(orderedNames(), ['Style'], 'the criterion version of the stored rubric is selected (pinned)')
    await pick(3)
    assert.deepEqual(orderedNames(), ['Style', 'Depth'])
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved')
    assert.deepEqual(socket.calls.map(c => c.event), ['rubricGet', 'criterionGetAll', 'rubricCreateVersion'])
    const payload = socket.calls.at(-1).payload
    assert.deepEqual([payload.rubricGroupId, payload.copyFromId, payload.calculation, payload.criterionIds], [2, 12, 'min', [4, 3]])
    assert.equal('versionNumber' in payload, false)
    assert.equal(saved[0].versionNumber, '2')
    assert.match(toasts.at(-1).message, /Version 2 of the rubric "Rubric 2" was created\./)
})

test('rubric new version: stored settings keep their type, an edited value becomes text, the bonus flag and default points are copied', async () => {
    const {modal, socket, saved} = mountModal(RubricModal, makeWorld({criterion: CRITERIA, rubric: RUBRICS}))
    await modal.openNewVersion(11)
    await flush()
    assert.equal($('#rubric-bonus').checked, true)
    assert.equal($('#rubric-default').value, '8')
    assert.equal($('#rubric-calculation').value, 'max')
    const level = $$('[id^="settings-value-"]')[1]
    await setValue(`#${level.id}`, '3')
    await click('Next')
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved')
    const payload = socket.calls.at(-1).payload
    assert.deepEqual(payload.settings, {tier: 'a', level: '3', strict: true})
    assert.deepEqual([payload.isBonus, payload.defaultPoints, payload.criterionIds], [true, 8, [2, 3, 4]])
})

test('rubric view: loaded with rubricGet, every input disabled, the criteria shown as an ordered list without table or controls, Close only closes', async () => {
    const {modal, socket} = mountModal(RubricModal, makeWorld({criterion: CRITERIA, rubric: RUBRICS}))
    await modal.openView(11)
    await flush()
    assert.deepEqual(socket.calls, [{event: 'rubricGet', payload: {rubricId: 11}}], 'no criterion list is needed for a view')
    assert.match(text($('.modal-title')), /View Rubric — v2/)
    assert.equal($$('input, textarea, select').every(input => input.disabled), true)
    assert.equal(buttonByText('Add setting'), undefined)
    assert.deepEqual($$('[id^="settings-key-"]').map(i => i.value), ['tier', 'level', 'strict'])
    await click('Next')
    assert.equal($('[data-test="table"]'), null)
    assert.deepEqual(orderedNames(), ['Clarity', 'Depth', 'Style'])
    assert.deepEqual(orderedDetails(), ['v2', 'v1', 'v1'])
    assert.equal($('button[title="Move up"]'), null)
    assert.equal($('button[title="Remove from list"]'), null)
    await click('Close')
    await waitFor(() => !isOpen(modal), 'modal to close')
    assert.equal(socket.calls.length, 1)
})

test('rubric view of a legacy rubric: the stored calculation is shown, nothing is changed', async () => {
    const {modal} = mountModal(RubricModal, makeWorld({criterion: CRITERIA, rubric: RUBRICS}))
    await modal.openView(12)
    await flush()
    assert.equal($('#rubric-calculation').value, 'min')
    assert.equal($('#rubric-calculation option[value="min"]').textContent, 'Capped sum (older rubrics)')
    assert.equal($('#rubric-calculation').disabled, true)
})

test('rubric: a duplicate criterion from the backend is shown on step 2, a settings error at the settings on step 1; the input stays', async () => {
    const world = makeWorld({criterion: CRITERIA})
    const socket = fakeSocket({
        ...world.handlers,
        rubricCreate: () => fail('errors.assessment.rubric.duplicateCriterion', {criterionId: 1}, 'Criterion version 1 is selected twice.'),
    })
    const {modal, saved} = mountModal(RubricModal, world, socket)
    await modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'Keep me')
    await click('Next')
    await pick(1)
    await click('Create Rubric')
    await waitFor(() => $('.alert-danger') !== null, 'error')
    assert.match(text($('.alert-danger')), /selected more than once/)
    assert.equal(saved.length, 0)
    assert.equal(isOpen(modal), true)
    await click('Previous')
    assert.equal($('#rubric-name').value, 'Keep me')

    socket.calls.length = 0
    socket.pending.length = 0
    const failing = fakeSocket({...world.handlers, rubricCreate: () => fail('errors.assessment.settingsKeyDuplicate', {key: 'a'}, 'The setting key "a" is used more than once.')})
    document.body.innerHTML = ''
    const second = mountModal(RubricModal, world, failing)
    await second.modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'S')
    await click('Next')
    await pick(1)
    await click('Create Rubric')
    await waitFor(() => $('.invalid-feedback') !== null, 'settings error')
    assert.match(text(document.body), /The setting key "a" is used more than once\./)
    assert.equal(second.modal.$refs.stepper.currentStep, 0)
})

test('rubric: a missing connection when opening shows the error and does not open; a second click while loading does nothing', async () => {
    const offline = mountModal(RubricModal, makeWorld(), {connected: false, emit: () => {}, calls: []})
    assert.equal(await offline.modal.openCreate(), false)
    assert.equal(offline.toasts.at(-1).variant, 'danger')
    assert.match(offline.toasts.at(-1).message, /Not connected to the server/)

    document.body.innerHTML = ''
    const world = makeWorld({criterion: CRITERIA})
    const socket = fakeSocket({...world.handlers, criterionGetAll: () => undefined})
    const {modal} = mountModal(RubricModal, world, socket)
    const first = modal.openCreate()
    assert.equal(await modal.openCreate(), false)
    socket.pending[0].ack(world.handlers.criterionGetAll())
    assert.equal(await first, true)
})

// ---------------------------------------------------------------------------------------------------------------
// 3. Assessment modal

test('assessment create: name and description only, no version field; the rubric versions are chosen in step 2 and sent in order without a predecessor', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS})
    const {modal, socket, saved, toasts} = mountModal(AssessmentModal, world)
    await modal.openCreate()
    await flush()
    assert.match(text($('.modal-title')), /Add Assessment/)
    assert.equal($('#assessment-version'), null)
    assert.equal(buttonByText('Next').disabled, true)
    await setValue('#assessment-name', 'Exam')
    await setValue('#assessment-description', 'Final')
    await click('Next')
    assert.equal(buttonByText('Create Assessment').disabled, true)
    assert.match(text(document.body), /Select at least one rubric\./)
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [11, 10, 12], 'every rubric version is a row: by name, newest version first')
    await pick(12)
    await pick(11)
    assert.deepEqual(orderedNames(), ['Rubric 2', 'Rubric 1'])
    assert.deepEqual(orderedDetails(), ['v1', 'v2'])
    await click('Create Assessment')
    await waitFor(() => saved.length === 1, 'saved')
    assert.deepEqual(socket.calls.map(c => c.event), ['rubricGetAll', 'assessmentCreate'])
    assert.deepEqual(socket.calls[1].payload, {name: 'Exam', description: 'Final', rubricIds: [12, 11]})
    assert.equal(saved[0].versionNumber, '1')
    assert.match(toasts.at(-1).message, /Assessment "Exam" \(version 1\) was created\./)
    await waitFor(() => !isOpen(modal), 'modal to close')
})

test('assessment create: the selection table offers every live rubric version and never a deleted one; ticking twice removes a pick', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS})
    world.handlers.rubricDelete({rubricId: 10})
    const {modal} = mountModal(AssessmentModal, world)
    await modal.openCreate()
    await flush()
    await setValue('#assessment-name', 'A')
    await click('Next')
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [11, 12], 'rubric version 10 is deleted')
    await pick(11)
    await pick(11)
    assert.match(text(document.body), /No rubrics selected yet\./)
})

test('assessment new version: starts from the stored version with its rubric versions pinned, sends group and source, the number comes from the backend', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS, assessment: [asm(20, 1, '1', [10, 12]), asm(21, 1, '2', [11], {previousAssessmentVersionId: 20})]})
    const {modal, socket, saved, toasts} = mountModal(AssessmentModal, world)
    await modal.openNewVersion(21)
    await flush()
    assert.match(text($('.modal-title')), /Create New Assessment Version/)
    assert.equal($('#assessment-version'), null)
    assert.equal($('.alert-info'), null, 'no blue versioning banner')
    assert.equal(text(document.body).includes('assigned automatically'), false)
    assert.equal($('#assessment-name').value, 'Assessment 1')
    await setValue('#assessment-name', 'Renamed')
    await click('Next')
    assert.deepEqual(orderedNames(), ['Rubric 1'])
    assert.deepEqual(orderedDetails(), ['v2'], 'pinned to version 2 of the rubric')
    await pick(12)
    await click('Create New Version')
    await waitFor(() => saved.length === 1, 'saved')
    const payload = socket.calls.at(-1).payload
    assert.deepEqual(payload, {assessmentGroupId: 1, copyFromId: 21, name: 'Renamed', description: '', rubricIds: [11, 12]})
    assert.equal(saved[0].versionNumber, '3')
    assert.match(toasts.at(-1).message, /Version 3 of the assessment "Renamed" was created\./)
})

test('assessment view: read-only name, description and ordered rubric list; no table, no controls; Close only closes', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS, assessment: [asm(20, 1, '1', [12, 10])]})
    const {modal, socket} = mountModal(AssessmentModal, world)
    await modal.openView(20)
    await flush()
    assert.deepEqual(socket.calls, [{event: 'assessmentGet', payload: {assessmentId: 20}}])
    assert.match(text($('.modal-title')), /View Assessment — v1/)
    assert.equal($$('input, textarea').every(input => input.disabled), true)
    await click('Next')
    assert.equal($('[data-test="table"]'), null)
    assert.deepEqual(orderedNames(), ['Rubric 2', 'Rubric 1'])
    assert.equal($('button[title="Move up"]'), null)
    await click('Close')
    await waitFor(() => !isOpen(modal), 'modal to close')
})

test('assessment: a backend refusal of a rubric version is shown on step 2 and keeps the input; a name error from the backend shows at the field', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS})
    const socket = fakeSocket({...world.handlers, assessmentCreate: () => fail('errors.assessment.assessment.rubricsNotFound', {rubricIds: '10'}, 'Rubric version(s) 10 not found.')})
    const {modal, saved} = mountModal(AssessmentModal, world, socket)
    await modal.openCreate()
    await flush()
    await setValue('#assessment-name', 'Keep')
    await click('Next')
    await pick(10)
    await click('Create Assessment')
    await waitFor(() => $('.alert-danger') !== null, 'error')
    assert.match(text($('.alert-danger')), /Rubric version\(s\) not found: 10\./)
    assert.equal(saved.length, 0)
    assert.equal(isOpen(modal), true)
    await click('Previous')
    assert.equal($('#assessment-name').value, 'Keep')
})

// ---------------------------------------------------------------------------------------------------------------
// 4. Versions modal for rubrics and assessments

function mountVersions(kind, world, props = {}) {
    tableCalls.length = 0
    confirmCalls.length = 0
    const socket = fakeSocket(world.handlers)
    const toasts = []
    const viewed = []
    const changed = []
    const modal = mount(VersionsModal, {
        kind, kindLabel: `assessmentManagement.kinds.${kind}`, onView: v => viewed.push(v), onChanged: c => changed.push(c), ...props,
    }, {$socket: socket, eventBus: {emit: (event, data) => toasts.push({event, ...data})}})
    return {modal, socket, toasts, viewed, changed}
}
const GROUP_OF = {rubric: 'rubricGroupId', assessment: 'assessmentGroupId'}

test('versions modal for rubrics: lists the versions of one rubric, View hands the version over, a delete is confirmed first and refreshes the page', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS})
    const {modal, socket, viewed, changed, toasts} = mountVersions('rubric', world)
    modal.open({groupId: 1, name: 'Rubric 1'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    assert.deepEqual(socket.calls[0], {event: 'rubricGetVersions', payload: {[GROUP_OF.rubric]: 1}})
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [11, 10], 'newest first')
    assert.deepEqual(tableCalls.at(-1).buttons.map(b => b.action), ['view', 'delete'])
    assert.equal(tableCalls.at(-1).options.search, true, 'search is on in the Versions modal of every kind')
    fire($('[data-row="10"] [data-action="view"]'), 'click')
    await flush()
    assert.equal(viewed[0].id, 10)

    fire($('[data-row="10"] [data-action="delete"]'), 'click')
    await flush()
    assert.match(confirmCalls[0].message, /Delete version "1" of the rubric "Rubric 1"\?/)
    confirmCalls[0].cb(true)
    await waitFor(() => changed.length === 1, 'changed')
    assert.deepEqual(socket.calls.find(c => c.event === 'rubricDelete').payload, {rubricId: 10})
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [11])
    assert.match(toasts.at(-1).message, /Version 1 of the rubric "Rubric 1" was deleted\./)
})

test('versions modal for rubrics: a rubric version used by an assessment is refused with the backend message', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS, assessment: [asm(20, 1, '1', [10])]})
    const {modal, toasts, changed} = mountVersions('rubric', world)
    modal.open({groupId: 1, name: 'Rubric 1'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    fire($('[data-row="10"] [data-action="delete"]'), 'click')
    await flush()
    confirmCalls[0].cb(true)
    await waitFor(() => toasts.length === 1, 'toast')
    assert.equal(toasts[0].variant, 'danger')
    assert.match(toasts[0].message, /used by 1 assessment version/)
    assert.equal($$('[data-row]').length, 2)
    assert.equal(changed.length, 0)
})

test('versions modal for assessments: Delete is available, confirmed first, deletes only the chosen version and refreshes the page', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS, assessment: [asm(20, 1, '1', [10]), asm(21, 1, '2', [10], {previousAssessmentVersionId: 20}), asm(22, 1, '3', [10], {previousAssessmentVersionId: 21})]})
    const {modal, socket, viewed, changed, toasts} = mountVersions('assessment', world)
    modal.open({groupId: 1, name: 'Assessment 1'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    assert.equal($('.versions-delete-disabled'), null, 'no "cannot be deleted" explanation')
    assert.equal(text(document.body).includes('cannot be deleted for now'), false)
    const button = $('[data-row="21"] [data-action="delete"]')
    assert.equal(button.classList.contains('disabled'), false)
    assert.equal(button.title, 'Delete')
    fire(button, 'click')
    await flush()
    assert.equal(confirmCalls.length, 1, 'asks first')
    assert.deepEqual(socket.calls.map(c => c.event), ['assessmentGetVersions'], 'nothing is sent before the confirmation')
    assert.match(confirmCalls[0].message, /Delete version "2" of the assessment "Assessment 1"\?/)
    confirmCalls[0].cb(false)
    await flush()
    assert.deepEqual(socket.calls.map(c => c.event), ['assessmentGetVersions'], 'declined: nothing is sent')

    fire(button, 'click')
    await flush()
    confirmCalls[1].cb(true)
    await waitFor(() => changed.length === 1, 'changed')
    assert.deepEqual(socket.calls.find(c => c.event === 'assessmentDelete').payload, {assessmentId: 21}, 'only this version')
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [22, 20], 'the list is refreshed')
    assert.match(toasts.at(-1).message, /Version 2 of the assessment "Assessment 1" was deleted\./)
    assert.equal(world.store.assessment.filter(a => !a.deleted).length, 2, 'the other versions stay')
    fire($('[data-row="20"] [data-action="view"]'), 'click')
    await flush()
    assert.equal(viewed[0].id, 20, 'View still works')
})

test('versions modal for assessments: the oldest, the newest and the only version can be deleted; the modal closes when none is left', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS, assessment: [asm(20, 1, '1', [10]), asm(21, 1, '2', [10], {previousAssessmentVersionId: 20})]})
    const {modal, changed, socket} = mountVersions('assessment', world)
    modal.open({groupId: 1, name: 'Assessment 1'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    const remove = async id => {
        fire($(`[data-row="${id}"] [data-action="delete"]`), 'click')
        await flush()
        confirmCalls.at(-1).cb(true)
        await waitFor(() => socket.calls.filter(c => c.event === 'assessmentDelete').length === deletes + 1, 'delete sent')
        deletes += 1
        await flush()
    }
    let deletes = 0
    await remove(21)   // the newest
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [20])
    assert.equal(changed.at(-1).versions.length, 1)
    await remove(20)   // the only one
    assert.equal(changed.at(-1).versions.length, 0, 'the page learns that the group is gone')
    await waitFor(() => $('[data-test="table"]') === null, 'the table to go away with the modal')
    assert.equal(socket.calls.filter(c => c.event === 'assessmentGetVersions').length, 2, 'no reload after the last version')
})

test('versions modal for assessments: a version used by a study step is refused and the message names the study, not database ids', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS, assessment: [asm(20, 1, '1', [10]), asm(21, 1, '2', [10], {previousAssessmentVersionId: 20})], studyUses: {21: "'Essay study' / 'Annotator'"}})
    const {modal, toasts, changed} = mountVersions('assessment', world)
    modal.open({groupId: 1, name: 'Assessment 1'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    fire($('[data-row="21"] [data-action="delete"]'), 'click')
    await flush()
    confirmCalls[0].cb(true)
    await waitFor(() => toasts.length === 1, 'toast')
    assert.equal(toasts[0].variant, 'danger')
    assert.equal(toasts[0].message, "Cannot delete 'Assessment 1' (version 2) because it is still used. Studies: 'Essay study' / 'Annotator'; study templates: -; triggers: -; trigger actions: -; pending trigger runs: -.")
    assert.doesNotMatch(toasts[0].message, /\b21\b/)
    assert.equal($$('[data-row]').length, 2, 'nothing was removed')
    assert.equal(changed.length, 0)
})

test('error messages: criterion, rubric and assessment deletions are worded with names and versions in English, German and French', () => {
    const cases = {
        criterion: {name: "Criterion 1", version: '1', count: 2, references: "'Rubric 1' (v1), 'Rubric R1' (v2)"},
        rubric: {name: "Rubric 1", version: '1', count: 2, references: "'Assessment 1' (v1), 'Assessment A1' (v3)"},
        assessment: {name: "Assessment 1", version: '1', count: 3, studySteps: "'Study' / 'Step'", templateSteps: '-', triggers: '-', triggerActions: '-', queuedRuns: '-'},
    }
    for (const lang of ['en', 'de', 'fr']) {
        const catalog = errorsCatalog(lang)
        const i18n = createI18n({legacy: false, locale: lang, messages: {[lang]: {errors: {assessment: catalog}}}})
        for (const [kind, params] of Object.entries(cases)) {
            const message = i18n.global.t(`errors.assessment.${kind}.inUse`, params)
            assert.ok(message.includes(params.name) && message.includes(`${params.version}`), `${lang} ${kind} names the entity and its version: ${message}`)
            assert.equal(/\{\w+\}/.test(message), false, `${lang} ${kind}: every placeholder is filled`)
            for (const value of [params.references, params.studySteps].filter(Boolean)) assert.ok(message.includes(value), `${lang} ${kind} lists ${value}`)
            // the same placeholders in every language
            const placeholders = text => [...new Set(text.match(/\{\w+\}/g))].sort()
            assert.deepEqual(placeholders(catalog[kind].inUse), placeholders(errorsCatalog('en')[kind].inUse), `${lang} ${kind} placeholders`)
        }
        assert.equal(i18n.global.te('errors.assessment.assessment.deleteDisabled'), false, 'the "temporarily disabled" message is gone')
        for (const kind of ['criterion', 'rubric']) {
            assert.ok(i18n.global.t(`errors.assessment.${kind}.inUseUnknown`, {name: 'N', version: '1'}).includes('N'))
        }
    }
})

test('error messages: names with braces, pipes, quotes, markup and at-signs are shown literally, as plain text', () => {
    const tricky = "A {version} | B @:x <img src=x onerror=alert(1)> 'q' \"d\""
    const i18n = createI18n({legacy: false, locale: 'en', messages: {en: {errors: {assessment: errorsCatalog('en')}}}})
    const message = i18n.global.t('errors.assessment.criterion.inUse', {name: tricky, version: '1', count: 1, references: `'${tricky}' (v2)`})
    assert.ok(message.includes(`Cannot delete '${tricky}' (version 1)`), message)
    assert.ok(message.includes(`: '${tricky}' (v2).`), message)
})

// ---------------------------------------------------------------------------------------------------------------
// 5. The dashboard page

const modalCalls = []
const stubModal = name => ({
    methods: {
        where() { return this.$el?.closest?.('[data-test^="versions-"]')?.dataset.test ?? 'page' },
        openCreate() { modalCalls.push({name, method: 'openCreate', in: this.where()}) },
        openView(id) { modalCalls.push({name, method: 'openView', id, in: this.where()}) },
        openNewVersion(id) { modalCalls.push({name, method: 'openNewVersion', id, in: this.where()}) },
    },
    emits: ['saved'],
    render: () => h('i', {'data-modal': name}),
})
const versionsStub = {
    props: ['kind', 'kindLabel', 'deleteDisabledReason'],   // a leftover prop must never be passed by the page
    emits: ['view', 'changed'],
    methods: {open(group) { modalCalls.push({name: 'versions', method: 'open', kind: this.kind, group, reason: this.deleteDisabledReason}) }},
    render() { return h('div', {'data-test': `versions-${this.kind}`}, this.$slots.default?.()) },
}
const AssessmentTablePanel = loadComponent('components/dashboard/assessments/AssessmentTablePanel.vue', {
    BasicButton, BasicLoading, BasicTable, withSearch: tableConstants.withSearch, DASHBOARD_TABLE_HEIGHT: tableConstants.DASHBOARD_TABLE_HEIGHT,
})
const BasicCard = {props: ['title'], render() { return h('div', [h('h3', this.title), this.$slots.body?.()]) }}
const DashboardAssessments = loadComponent('components/dashboard/Assessments.vue', {
    BasicCard,
    BasicButton: {render() { return h('button', {class: 'nav-link'}, this.$slots.default?.()) }},
    AssessmentTablePanel,
    AssessmentModal: stubModal('assessment'),
    RubricModal: stubModal('rubric'),
    CriterionModal: stubModal('criterion'),
    VersionsModal: versionsStub,
    dashboardRowAction: rowAction,
    dashboardRowButton: (icon, o) => ({icon, ...o}),
    calculationOptions: constants.calculationOptions,
    versionedBackendMixin,
})

function mountDashboard(world = makeWorld(), socket = fakeSocket(world.handlers)) {
    tableCalls.length = 0
    modalCalls.length = 0
    const page = mount(DashboardAssessments, {}, {$socket: socket, eventBus: {emit: () => {}}})
    return {page, socket, world}
}
const openTab = async label => {
    fire($$('.nav-link').find(b => text(b).startsWith(label)), 'click')
    await flush()
}
const rowIds = () => $$('[data-row]').map(row => Number(row.dataset.row))
const WORLD = () => makeWorld({criterion: CRITERIA, rubric: RUBRICS, assessment: [asm(20, 1, '1', [10]), asm(21, 1, '2', [11], {previousAssessmentVersionId: 20}), asm(22, 2, '1', [12])]})

test('page: the latest versions of all three kinds are loaded from the backend on mount; the tabs count groups, not versions', async () => {
    const {socket} = mountDashboard(WORLD())
    await waitFor(() => socket.calls.length === 3, 'three requests')
    assert.deepEqual(socket.calls.map(c => c.event).sort(), ['assessmentGetLatest', 'criterionGetLatest', 'rubricGetLatest'])
    await flush()
    assert.match(text($('.nav-tabs')), /Assessments 2/)
    assert.match(text($('.nav-tabs')), /Rubrics 2/)
    assert.match(text($('.nav-tabs')), /Criteria 3/)
    assert.deepEqual(rowIds(), [21, 22], 'assessments tab first: the latest version of each group, no prototype data')
    assert.equal(text(document.body).includes('Prototype'), false)
})

test('page: Assessments tab: Name, Description, Latest version, Versions, Created at; View, Create new version and Versions, no Delete', async () => {
    mountDashboard(WORLD())
    await flush()
    const props = tableCalls.at(-1)
    assert.deepEqual(props.columns.map(c => c.key), ['name', 'description', 'versionNumber', 'versionCount', 'createdAt'])
    assert.deepEqual(props.columns.map(c => c.name), ['Name', 'Description', 'Latest version', 'Versions', 'Created at'])
    assert.equal(props.columns.every(c => c.sortable), true)
    assert.equal(props.columns.find(c => c.key === 'createdAt').type, 'datetime')
    assert.deepEqual(props.buttons.map(b => b.action), ['view', 'newVersion', 'versions'])
    assert.deepEqual(props.buttons.map(b => b.title), ['View', 'Create new version', 'Versions'])
    assert.equal(props.options.search, true)
    assert.equal(props.options.pagination, 10)
    assert.equal(props.maxTableHeight, tableConstants.DASHBOARD_TABLE_HEIGHT)
    const [first] = props.data
    assert.deepEqual([first.versionNumber, first.versionCount], ['2', 2])
})

test('page: Rubrics tab: latest version with its count, the readable calculation (Summation, Base + adjustments, an older value as its legacy name) and the bounds', async () => {
    mountDashboard(WORLD())
    await flush()
    await openTab('Rubrics')
    const props = tableCalls.at(-1)
    assert.deepEqual(props.columns.map(c => c.key), ['name', 'description', 'versionNumber', 'versionCount', 'calculationLabel', 'minPoints', 'maxPoints', 'createdAt'])
    assert.deepEqual(props.columns.map(c => c.name), ['Name', 'Description', 'Latest version', 'Versions', 'Calculation method', 'Minimum points', 'Maximum points', 'Created at'])
    assert.deepEqual(rowIds(), [11, 12])
    assert.deepEqual(props.data.map(r => r.calculationLabel), ['Base + adjustments', 'Capped sum (older rubrics)'])
    assert.deepEqual(props.buttons.map(b => b.action), ['view', 'newVersion', 'versions'])
    assert.deepEqual(props.data.map(r => r.versionCount), [2, 1])
})

test('page: Criteria tab keeps its columns and actions', async () => {
    mountDashboard(WORLD())
    await flush()
    await openTab('Criteria')
    const props = tableCalls.at(-1)
    assert.deepEqual(props.columns.map(c => c.key), ['name', 'description', 'versionNumber', 'versionCount', 'minPoints', 'maxPoints', 'createdAt'])
    assert.deepEqual(rowIds(), [2, 3, 4])
    assert.deepEqual(props.buttons.map(b => b.action), ['view', 'newVersion', 'versions'])
})

test('page: Add, View, Create new version and Versions act on the active tab with the latest version of the row', async () => {
    mountDashboard(WORLD())
    await flush()
    fire(buttonByText('Add Assessment'), 'click')
    fire($('[data-row="21"] [data-action="view"]'), 'click')
    fire($('[data-row="21"] [data-action="newVersion"]'), 'click')
    fire($('[data-row="21"] [data-action="versions"]'), 'click')
    await openTab('Rubrics')
    fire(buttonByText('Add Rubric'), 'click')
    fire($('[data-row="11"] [data-action="view"]'), 'click')
    fire($('[data-row="11"] [data-action="newVersion"]'), 'click')
    fire($('[data-row="11"] [data-action="versions"]'), 'click')
    await flush()
    const pageCalls = modalCalls.filter(c => c.in !== 'versions-assessment' || c.method === 'open')
    assert.deepEqual(JSON.parse(JSON.stringify(pageCalls.map(({name, method, id, kind, group}) => ({name, method, id, kind, group})))), [
        {name: 'assessment', method: 'openCreate'},
        {name: 'assessment', method: 'openView', id: 21},
        {name: 'assessment', method: 'openNewVersion', id: 21},
        {name: 'versions', method: 'open', kind: 'assessment', group: {groupId: 1, name: 'Assessment 1'}},
        {name: 'rubric', method: 'openCreate'},
        {name: 'rubric', method: 'openView', id: 11},
        {name: 'rubric', method: 'openNewVersion', id: 11},
        {name: 'versions', method: 'open', kind: 'rubric', group: {groupId: 1, name: 'Rubric 1'}},
    ])
})

test('page: one shared Versions modal per kind; the assessment one has Delete disabled with the explanation, the others do not; each hosts its own read-only modal', async () => {
    const {page} = mountDashboard(WORLD())
    await flush()
    assert.deepEqual($$('[data-test^="versions-"]').map(el => el.dataset.test).sort(), ['versions-assessment', 'versions-criterion', 'versions-rubric'])
    for (const kind of ['assessment', 'rubric', 'criterion']) {
        assert.equal($(`[data-test="versions-${kind}"] [data-modal="${kind}"]`) !== null, true, `${kind} view modal is inside its Versions modal`)
    }
    fire($$('[data-action="versions"]')[0], 'click')
    await flush()
    assert.equal(modalCalls.at(-1).kind, 'assessment')
    assert.equal(modalCalls.at(-1).reason, undefined, 'assessment versions can be deleted like the others')
    await openTab('Rubrics')
    fire($$('[data-action="versions"]')[0], 'click')
    await flush()
    assert.equal(modalCalls.at(-1).reason, undefined, 'rubric versions can be deleted')
    page.viewVersion('rubric', {id: 10})
    assert.deepEqual(modalCalls.at(-1), {name: 'rubric', method: 'openView', id: 10, in: 'versions-rubric'}, 'the view of a version opens inside the Versions modal')
})

test('page: loading and failure are per tab; a failed tab shows its message with a retry, the others are unaffected', async () => {
    const world = WORLD()
    let failing = true
    const socket = fakeSocket({...world.handlers, rubricGetLatest: () => (failing ? fail('errors.assessment.accessDenied', {}, 'no access') : world.handlers.rubricGetLatest())})
    mountDashboard(world, socket)
    await flush()
    assert.deepEqual(rowIds(), [21, 22], 'assessments are fine')
    await openTab('Rubrics')
    assert.match(text($('.alert-danger')), /do not have access to the Assessment Management Dashboard/)
    failing = false
    fire($('.alert-danger button'), 'click')
    await waitFor(() => $('.alert-danger') === null, 'error to disappear')
    assert.deepEqual(rowIds(), [11, 12])
    assert.equal(socket.calls.filter(c => c.event === 'rubricGetLatest').length, 2)
})

test('page: empty tabs show their own message; a missing connection is reported in every tab', async () => {
    mountDashboard(makeWorld())
    await flush()
    assert.match(text($('p.text-muted')), /No assessments yet/)
    await openTab('Rubrics')
    assert.match(text($('p.text-muted')), /No rubrics yet/)
    await openTab('Criteria')
    assert.match(text($('p.text-muted')), /No criteria yet/)

    document.body.innerHTML = ''
    mountDashboard(makeWorld(), {connected: false, emit: () => {}, calls: []})
    await flush()
    assert.match(text($('.alert-danger')), /Not connected to the server/)
})

test('page: a first load shows the loading state, a reload keeps the table and only the newest answer counts', async () => {
    const world = WORLD()
    const socket = fakeSocket({...world.handlers, assessmentGetLatest: () => undefined})
    const {page} = mountDashboard(world, socket)
    await flush()
    assert.equal($('[data-test="loading"]')?.textContent, 'Loading…')
    socket.pending[0].ack(world.handlers.assessmentGetLatest())
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    assert.deepEqual(rowIds(), [21, 22])
    page.loadVersioned('assessment', {force: true})
    page.loadVersioned('assessment', {force: true})
    await flush()
    assert.equal($('[data-test="loading"]'), null, 'a reload does not replace the table')
    const [older, newer] = socket.pending.slice(1)
    newer.ack(ok([]))
    older.ack(world.handlers.assessmentGetLatest())
    await flush()
    assert.deepEqual(rowIds(), [], 'the answer of the newest request wins, the older one is ignored')
})

test('page: a change in a Versions modal or a saved version reloads that kind, so the latest version and the count come from the backend', async () => {
    const world = WORLD()
    const {page, socket} = mountDashboard(world)
    await flush()
    await openTab('Rubrics')
    assert.equal(tableCalls.at(-1).data[0].versionCount, 2)
    // a new version is created in the rubric modal: the page reloads the rubrics
    world.handlers.rubricCreateVersion({rubricGroupId: 1, copyFromId: 11, name: 'Rubric 1', criterionIds: [4]})
    page.loadVersioned('rubric', {force: true})
    await waitFor(() => tableCalls.at(-1).data[0]?.versionCount === 3, 'new count')
    assert.equal(tableCalls.at(-1).data[0].versionNumber, '3', 'the new version is the latest')
    assert.equal(socket.calls.filter(c => c.event === 'rubricGetLatest').length, 2)
})

// ---------------------------------------------------------------------------------------------------------------
// 6. Final review: duplicate submissions, input kept between steps, arbitrary settings, identical names

/** A socket whose create answer stays pending until released, so a second click can be tried meanwhile. */
function slowCreate(world, event) {
    const gate = {release: null}
    const socket = fakeSocket({...world.handlers, [event]: payload => {
        gate.release = () => socket.pending.at(-1).ack(world.handlers[event](payload))
        return undefined
    }})
    return {socket, gate}
}

test('rubric: a second click on Create while the first request is pending sends nothing and the modal closes once', async () => {
    const world = makeWorld({criterion: CRITERIA})
    const {socket, gate} = slowCreate(world, 'rubricCreate')
    const {modal, saved} = mountModal(RubricModal, world, socket)
    await modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'Once')
    await click('Next')
    await pick(1)
    await click('Create Rubric')
    await modal.submit()   // the guard that a second click on the submit button reaches
    await flush()
    assert.equal(socket.calls.filter(c => c.event === 'rubricCreate').length, 1)
    gate.release()
    await waitFor(() => saved.length === 1, 'saved')
    assert.equal(saved.length, 1)
    assert.equal(world.store.rubric.length, 1, 'one version stored')
})

test('assessment: a second submit while the first request is pending sends nothing', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS})
    const {socket, gate} = slowCreate(world, 'assessmentCreate')
    const {modal, saved} = mountModal(AssessmentModal, world, socket)
    await modal.openCreate()
    await flush()
    await setValue('#assessment-name', 'Once')
    await click('Next')
    await pick(10)
    await click('Create Assessment')
    await modal.submit()
    await modal.submit()
    await flush()
    assert.equal(socket.calls.filter(c => c.event === 'assessmentCreate').length, 1)
    gate.release()
    await waitFor(() => saved.length === 1, 'saved')
    assert.equal(world.store.assessment.length, 1)
})

test('rubric: everything entered in step 1 and the picks of step 2 survive going back and forth', async () => {
    const {modal} = mountModal(RubricModal, makeWorld({criterion: CRITERIA}))
    await modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'Kept')
    await setValue('#rubric-description', 'Still here')
    await setChecked('#rubric-min-active', true)
    await setValue('#rubric-min', '-3.5')
    await setChecked('#rubric-max-active', true)
    await setValue('#rubric-max', '12')
    await setValue('#rubric-calculation', 'max')
    await setValue('#rubric-default', '9')
    await setChecked('#rubric-bonus', true)
    fire($('.collapsible-header'), 'click')
    await flush()
    await click('Add setting')
    await setValue('#' + $$('[id^="settings-key-"]')[0].id, 'k')
    await setValue('#' + $$('[id^="settings-value-"]')[0].id, 'v')
    await click('Next')
    await pick(4)
    await pick(1)
    fire($$('button[title="Move up"]')[1], 'click')
    await flush()
    await click('Previous')
    assert.deepEqual(
        [$('#rubric-name').value, $('#rubric-description').value, $('#rubric-min').value, $('#rubric-max').value, $('#rubric-calculation').value, $('#rubric-default').value, $('#rubric-bonus').checked, $('#rubric-min-active').checked],
        ['Kept', 'Still here', '-3.5', '12', 'max', '9', true, true])
    assert.deepEqual(settingRows(), [['k', 'v']])
    await click('Next')
    assert.deepEqual(orderedNames(), ['Clarity', 'Style'], 'the order the user set is kept')
    assert.equal($('[data-select="1"]').checked && $('[data-select="4"]').checked, true, 'the table still shows the picks ticked')
})

test('assessment: name, description and the rubric picks survive going back and forth', async () => {
    const {modal} = mountModal(AssessmentModal, makeWorld({criterion: CRITERIA, rubric: RUBRICS}))
    await modal.openCreate()
    await flush()
    await setValue('#assessment-name', 'Kept')
    await setValue('#assessment-description', 'Still here')
    await click('Next')
    await pick(12)
    await pick(10)
    await click('Previous')
    assert.deepEqual([$('#assessment-name').value, $('#assessment-description').value], ['Kept', 'Still here'])
    await click('Next')
    assert.deepEqual(orderedNames(), ['Rubric 2', 'Rubric 1'])
})

test('rubric: function, expertLevel and subjective are ordinary settings keys; all values are sent as text, nothing else is special', async () => {
    const {modal, socket, saved} = mountModal(RubricModal, makeWorld({criterion: CRITERIA}))
    await modal.openCreate()
    await flush()
    await setValue('#rubric-name', 'Free keys')
    fire($('.collapsible-header'), 'click')
    await flush()
    for (const [key, value] of [['function', 'manual'], ['expertLevel', '2'], ['subjective', 'true'], ['any key at all', 'any value']]) {
        await click('Add setting')
        const keys = $$('[id^="settings-key-"]')
        const last = keys.at(-1)
        await setValue(`#${last.id}`, key)
        await setValue(`#${last.id.replace('key', 'value')}`, value)
    }
    assert.equal(buttonByText('Next').disabled, false, 'no key is refused because of its name')
    await click('Next')
    await pick(1)
    await click('Create Rubric')
    await waitFor(() => saved.length === 1, 'saved')
    assert.deepEqual(socket.calls.at(-1).payload.settings, {function: 'manual', expertLevel: '2', subjective: 'true', 'any key at all': 'any value'})
})

test('page: two criteria, rubrics or assessments with the same name are separate rows; their versions are found by group, not by name', async () => {
    const world = makeWorld({
        criterion: [crit(1, 1, '1', {name: 'Same'}), crit(2, 2, '1', {name: 'Same'}), crit(3, 2, '2', {name: 'Same'})],
        rubric: [rub(10, 1, '1', [1], {name: 'Twin'}), rub(11, 2, '1', [2], {name: 'Twin'})],
        assessment: [asm(20, 1, '1', [10], {name: 'Twin'}), asm(21, 2, '1', [11], {name: 'Twin'})],
    })
    mountDashboard(world)
    await flush()
    assert.deepEqual(rowIds(), [20, 21], 'two assessments with one name')
    await openTab('Rubrics')
    assert.deepEqual(rowIds(), [10, 11])
    await openTab('Criteria')
    assert.deepEqual(rowIds(), [1, 3], 'group 1 has one version, group 2 two; same name')
    assert.deepEqual(tableCalls.at(-1).data.map(r => r.versionCount), [1, 2])
    fire($('[data-row="3"] [data-action="versions"]'), 'click')
    await flush()
    assert.deepEqual(modalCalls.at(-1).group, {groupId: 2, name: 'Same'}, 'the Versions modal gets the group id')
    // the Versions modal itself lists only that group's versions, although another group has the same name
    document.body.innerHTML = ''
    const {modal} = mountVersions('criterion', world)
    modal.open({groupId: 2, name: 'Same'})
    await waitFor(() => $('[data-test="table"]') !== null, 'versions')
    assert.deepEqual($$('[data-row]').map(row => Number(row.dataset.row)), [3, 2])
})

// ---------------------------------------------------------------------------------------------------------------
// Failure texts: the real translation path (catalogs of the three languages), also for backends that do not match

/** A component stand-in with the same $te / $t / $i18n a real component gets from vue-i18n */
function vmFor(lang) {
    const i18n = createI18n({
        legacy: true, locale: lang, missingWarn: false, fallbackWarn: false,
        messages: {[lang]: {assessmentManagement: readCatalog(lang), errors: JSON.parse(readFileSync(new URL(`../../utils/modules/i18n/${lang}/errors.json`, import.meta.url), 'utf8'))}},
    })
    return {$te: key => i18n.global.te(key), $t: (key, params) => i18n.global.t(key, params), $i18n: i18n.global}
}
const response = (key, params, message) => ({response: {success: false, key, params, message}, message: key})

test('failure text: the real refusals of the backend are translated completely in English, German and French', () => {
    const refusals = [
        ['criterion', {name: 'Clarity', version: '2', count: 2, references: "'Rubric 1' (v1), 'Rubric R1' (v2)"}],
        ['rubric', {name: 'Rubric 1', version: '2', count: 4, references: "'Assessment A' (v1), 'Assessment B' (v2)"}],
        ['assessment', {name: 'Assessment A', version: '3', count: 1, studySteps: "'Study' / 'Step'", templateSteps: '-', triggers: '-', triggerActions: '-', queuedRuns: '-'}],
    ]
    for (const lang of ['en', 'de', 'fr']) {
        const vm = vmFor(lang)
        for (const [kind, params] of refusals) {
            const text = failureLib.failureText(response(`errors.assessment.${kind}.inUse`, params, 'server english'), vm)
            assert.notEqual(text, 'server english', `${lang} ${kind}: translated, not the server text`)
            assert.ok(text.includes(params.name) && text.includes(params.version), `${lang} ${kind}: ${text}`)
            assert.equal(/''|\(version \)|\(Version \)|: \.|\{\w+\}/.test(text), false, `${lang} ${kind}: no empty gap in "${text}"`)
            for (const value of [params.references, params.studySteps].filter(Boolean)) assert.ok(text.includes(value), `${lang} ${kind} lists ${value}`)
        }
    }
})

test('failure text: a backend with other parameters (older or newer) never produces a sentence with empty gaps', () => {
    for (const lang of ['en', 'de', 'fr']) {
        const vm = vmFor(lang)
        // what a backend from before the named messages sends: ids, and its own English text
        const old = failureLib.failureText(response('errors.assessment.rubric.inUse', {rubricId: 12, count: 4, assessmentIds: '1, 2'}, 'Rubric version 12 cannot be deleted: it is used by 4 assessment version(s) (1, 2).'), vm)
        assert.equal(old, 'Rubric version 12 cannot be deleted: it is used by 4 assessment version(s) (1, 2).', `${lang}: the backend's own text instead of gaps`)
        const empty = failureLib.failureText(response('errors.assessment.criterion.inUse', {name: '', version: undefined, count: 3, references: ''}, undefined), vm)
        assert.equal(empty, vm.$t('assessmentManagement.messages.requestFailed'), `${lang}: generic sentence`)
        assert.equal(/\{|''|\(version \)/.test(empty), false)
    }
})

test('failure text: a key the frontend does not know shows the backend text, never "Unknown error"', () => {
    const vm = vmFor('en')
    const gone = failureLib.failureText(response('errors.assessment.assessment.deleteDisabled', {}, 'Deleting assessment versions is temporarily disabled.'), vm)
    assert.equal(gone, 'Deleting assessment versions is temporarily disabled.')
    assert.equal(failureLib.failureText(response('errors.nothing.here', {}, 'errors.nothing.here'), vm), 'The request failed. Please try again.')
    assert.equal(failureLib.failureText({response: {success: false}, message: 'Network down'}, vm), 'Network down', 'a plain error message is better than nothing')
    assert.equal(failureLib.failureText({}, vm), 'The request failed. Please try again.')
    // keys of the client itself (not connected, timeout) are translated
    assert.equal(failureLib.failureText(new socketLib.AssessmentRequestError({success: false, key: socketLib.CLIENT_ERROR_KEYS.timeout}), vm), 'The server did not answer in time. Try again.')
})

test('versions modal for assessments: a refusal from a backend that is out of date is shown with its own text, not as an unknown error', async () => {
    const world = makeWorld({criterion: CRITERIA, rubric: RUBRICS, assessment: [asm(20, 1, '1', [10]), asm(21, 1, '2', [10], {previousAssessmentVersionId: 20})]})
    const socket = fakeSocket({...world.handlers, assessmentDelete: () => fail('errors.assessment.assessment.deleteDisabled', {}, 'Deleting assessment versions is temporarily disabled.')})
    tableCalls.length = 0
    confirmCalls.length = 0
    const toasts = []
    const modal = mount(VersionsModal, {kind: 'assessment', kindLabel: 'assessmentManagement.kinds.assessment'}, {$socket: socket, eventBus: {emit: (event, data) => toasts.push({event, ...data})}})
    modal.open({groupId: 1, name: 'Assessment 1'})
    await waitFor(() => $('[data-test="table"]') !== null, 'table')
    fire($('[data-row="21"] [data-action="delete"]'), 'click')
    await flush()
    confirmCalls[0].cb(true)
    await waitFor(() => toasts.length === 1, 'toast')
    assert.equal(toasts[0].message, 'Deleting assessment versions is temporarily disabled.')
    assert.doesNotMatch(toasts[0].message, /Unknown error/)
    assert.equal($$('[data-row]').length, 2, 'nothing was removed')
})
