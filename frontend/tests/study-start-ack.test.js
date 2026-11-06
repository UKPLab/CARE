/**
 * Regression tests for the errors around starting a study (#510).
 *
 * Mounts the real StudyModal and BasicModal with the real Vue, vue-i18n and Bootstrap on a Happy DOM
 * document. Only the socket, the store and the child components without a part in this flow are replaced.
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
// Vue and Bootstrap read the DOM globals while they load, hence the dynamic imports below.
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

const MESSAGES = {
    studies: {
        study: 'Study',
        startStudy: 'Start study',
        clickToStart: 'Click to start',
        returnToDashboard: 'Dashboard',
        messages: {studyStarted: 'Study started', enjoy: 'Enjoy'},
    },
    errors: {studies: {studyCannotStart: 'Study cannot start'}},
}
const STUDY_ID = 3
const SESSION_ID = 5
// Inline transition of the dialog, it keeps the "opening" and "static backdrop" phases open for a while.
const DIALOG_TRANSITION_MS = 50
// Longer than the static backdrop transition, the longest chain of transitions here.
const SETTLE_MS = 3 * DIALOG_TRANSITION_MS

/** Evaluates the options object and the template of an SFC, replacing its imports with the given stubs. */
function loadComponent(path, stubs = {}) {
    const source = readFileSync(path.endsWith('StudyModal.vue') && process.env.STUDY_MODAL_SOURCE ? process.env.STUDY_MODAL_SOURCE : new URL(`../src/${path}`, import.meta.url), 'utf8')
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    const importPattern = /^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
    const names = [...script.matchAll(importPattern)].flatMap(([, clause]) =>
        clause.replace(/[{}]/g, '').split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
    const options = new Function(...names, script.replace(importPattern, '').replace('export default', 'return'))(
        ...names.map(name => stubs[name] ?? {}))
    const template = source.match(/<template>([\s\S]*)<\/template>/)[1]
    return {...options, render: compile(template, {isCustomElement: tag => tag === 'vr'})}
}

const BasicModal = loadComponent('basic/Modal.vue', {Modal: BootstrapModal, uuid: () => 'uuid'})
const StudyModal = loadComponent('components/study/StudyModal.vue', {
    Modal: BasicModal,
    Loader: {render: () => null},
    BasicTable: {render: () => null},
    Editor: {render: () => null},
    BasicButton: {props: ['text'], render() { return h('button', this.text) }},
    resolveApiMessage: response => response.message,
    formatLocalizedDateTime: value => value,
    returnToDashboardHelper: () => {},
})

const store = {
    getters: {
        'table/study/get': () => ({name: 'T13', start: null, closed: null, timeLimit: 0, collab: false}),
        'table/study_session/get': () => ({id: SESSION_ID, userId: 1, start: null}),
        'table/study_session/getByKey': () => [],
        'auth/getUserId': 1,
    },
}

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
    await wait(SETTLE_MS)
    document.body.innerHTML = ''
    document.body.removeAttribute('style')
    document.body.removeAttribute('class')
    errors = []
})

/** Mounts a root component with the plugins and globals of the application, it is unmounted after the test. */
function mount(component, globals = {}) {
    const app = createApp(component)
    app.use(createI18n({legacy: true, locale: 'en', messages: {en: MESSAGES}, missingWarn: false, fallbackWarn: false}))
    app.config.warnHandler = () => {}
    app.config.errorHandler = error => errors.push(error)
    Object.assign(app.config.globalProperties, {$store: store, ...globals})
    const host = document.createElement('div')
    document.body.append(host)
    cleanups.push(() => app.unmount())
    return app.mount(host)
}

/** Resolves once the condition holds, fails the test if it never does. */
async function waitFor(condition, label) {
    for (let i = 0; i < 200; i++) {
        if (condition()) {
            return
        }
        await wait(2)
    }
    assert.fail(`Timed out waiting for ${label}`)
}

/** Fails if an error was raised anywhere, or if a modal left a trace on the page. */
function assertPageClean() {
    assert.deepEqual(errors.map(String), [])
    assert.equal(document.querySelectorAll('.modal-backdrop').length, 0, 'orphan backdrop')
    assert.equal(document.querySelectorAll('.modal').length, 0, 'orphan modal element')
    assert.equal(document.body.classList.contains('modal-open'), false, 'body keeps modal-open')
    assert.equal(document.body.style.overflow, '', 'body keeps the scroll lock')
    assert.equal(document.body.style.paddingRight, '', 'body keeps the scrollbar padding')
}

/** Mounts a StudyModal below a parent which, like Study.vue, only renders it while the session has not started. */
async function openStudyModal({onStart = () => {}} = {}) {
    const acks = []
    const toasts = []
    const starts = []
    const vm = mount({
        data: () => ({sessionStarted: false}),
        render() {
            return this.sessionStarted
                ? null
                : h(StudyModal, {
                    ref: 'study',
                    studyId: STUDY_ID,
                    studyClosed: false,
                    studySessionId: SESSION_ID,
                    onStart: data => {
                        starts.push(data)
                        onStart(this)
                    },
                })
        },
    }, {
        $socket: {emit: (event, payload, ack) => acks.push({event, payload, ack})},
        eventBus: {emit: (event, data) => toasts.push({event, ...data})},
    })
    const study = vm.$refs.study
    study.open()
    await waitFor(() => study.$refs.modal.isShown, 'study modal to be shown')
    document.querySelector('.btn-primary').click()
    assert.equal(acks.length, 1)
    assert.equal(acks[0].event, 'studySessionStart')
    assert.deepEqual(acks[0].payload, {studyId: STUDY_ID, studySessionId: SESSION_ID})
    return {vm, acks, ack: acks[0].ack, toasts, starts}
}

const STARTED_TOAST = {event: 'toast', title: 'Study started', message: 'Enjoy', variant: 'success'}
const FAILED_TOAST = {event: 'toast', title: 'Study cannot start', message: 'No session left', variant: 'danger'}

test('a mounted study modal closes, reports the start and shows a translated toast', async () => {
    const {ack, toasts, starts} = await openStudyModal({onStart: parent => { parent.sessionStarted = true }})

    ack({success: true, data: {id: SESSION_ID}})
    await wait(SETTLE_MS)

    assert.deepEqual(starts, [{studySessionId: SESSION_ID}])
    assert.deepEqual(toasts, [STARTED_TOAST])
    assertPageClean()
})

test('a mounted study modal stays open and shows a translated toast if the start fails', async () => {
    const {ack, toasts, starts} = await openStudyModal()

    ack({success: false, message: 'No session left'})
    await wait(SETTLE_MS)

    assert.deepEqual(starts, [])
    assert.deepEqual(toasts, [FAILED_TOAST])
    assert.deepEqual(errors.map(String), [])
    assert.ok(document.querySelector('.modal.show'), 'modal should stay open')
})

test('a successful acknowledgement after the study modal unmounted still shows its toast', async () => {
    const {vm, ack, toasts, starts} = await openStudyModal()
    // The session update reached the parent first, the acknowledgement is still on its way.
    vm.sessionStarted = true
    await nextTick()

    ack({success: true, data: {id: SESSION_ID}})
    await wait(SETTLE_MS)

    assert.deepEqual(starts, [], 'an unmounted modal must not emit')
    assert.deepEqual(toasts, [STARTED_TOAST])
    assertPageClean()
})

test('a failed acknowledgement after the study modal unmounted still shows its toast', async () => {
    const {vm, ack, toasts, starts} = await openStudyModal()
    vm.sessionStarted = true
    await nextTick()

    ack({success: false, message: 'No session left'})
    await wait(SETTLE_MS)

    assert.deepEqual(starts, [])
    assert.deepEqual(toasts, [FAILED_TOAST])
    assertPageClean()
})

// Repeated user actions must not create concurrent sessions while an ack is pending.
test('repeated starts before acknowledgement send one request and one success toast', async () => {
    const {vm, acks, ack, toasts, starts} = await openStudyModal()
    vm.$refs.study.start()
    vm.$refs.study.start()
    assert.equal(acks.length, 1, 'only one session-start request may be in flight')
    ack({success: true, data: {id: SESSION_ID}})
    await nextTick()
    assert.deepEqual(starts, [{studySessionId: SESSION_ID}])
    assert.deepEqual(toasts, [STARTED_TOAST])
})

test('a rejected start can be retried and reports each server result once', async () => {
    const {vm, acks, ack, toasts} = await openStudyModal()
    ack({success: false, message: 'No session left'})
    vm.$refs.study.start()
    assert.equal(acks.length, 2)
    acks[1].ack({success: true, data: {id: SESSION_ID}})
    assert.deepEqual(toasts, [FAILED_TOAST, STARTED_TOAST])
})

