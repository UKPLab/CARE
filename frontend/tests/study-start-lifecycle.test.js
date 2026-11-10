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

/** Mounts a parent with a BasicModal behind a v-if, the way the application removes its modals. */
function mountBasicModal(modalProps = {}) {
    const events = []
    const vm = mount({
        data: () => ({visible: true}),
        render() {
            return this.visible
                ? h(BasicModal, {
                    ref: 'modal',
                    name: 'test',
                    onShow: () => events.push('show'),
                    onHide: () => events.push('hide'),
                    ...modalProps,
                })
                : null
        },
    })
    const modal = vm.$refs.modal
    const element = modal.$refs.Modal
    const dialogStyle = element.querySelector('.modal-dialog').style
    // Bootstrap reads both values as seconds and adds them up, Happy DOM has no default for the delay.
    dialogStyle.transitionDuration = `${DIALOG_TRANSITION_MS / 1000}s`
    dialogStyle.transitionDelay = '0s'
    return {
        modal,
        element,
        events,
        shown: () => waitFor(() => modal.isShown, 'modal to be shown'),
        unmountModal: async () => {
            vm.visible = false
            await nextTick()
        },
    }
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
    return {vm, ack: acks[0].ack, toasts, starts}
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

test('unmounting while the modal is closing leaves nothing behind', async () => {
    const {modal, shown, unmountModal, events} = mountBasicModal()
    modal.open()
    await shown()

    modal.close()
    await unmountModal()
    await wait(SETTLE_MS)

    assert.deepEqual(events, ['show'], 'an unmounted modal must not emit')
    assertPageClean()
})

test('unmounting while the backdrop of an opening modal fades in leaves nothing behind', async () => {
    const {modal, unmountModal, events} = mountBasicModal()
    modal.open()
    assert.equal(document.querySelectorAll('.modal-backdrop').length, 1)

    await unmountModal()
    // Bootstrap appends the element again when the backdrop is done, it must stay hidden until it is removed.
    for (let elapsed = 0; elapsed < SETTLE_MS; elapsed += 5) {
        const visible = [...document.querySelectorAll('.modal')].filter(modalElement => modalElement.style.display !== 'none')
        assert.equal(visible.length, 0, 'removed modal is visible again')
        await wait(5)
    }

    assert.deepEqual(events, [], 'an unmounted modal must not emit')
    assertPageClean()
})

test('unmounting while the dialog of an opening modal fades in leaves nothing behind', async () => {
    const {modal, element, unmountModal, events} = mountBasicModal()
    modal.open()
    await waitFor(() => element.classList.contains('show'), 'dialog transition')
    assert.equal(modal.isShown, false, 'still opening')

    await unmountModal()
    await wait(SETTLE_MS)

    assert.deepEqual(events, [], 'an unmounted modal must not emit')
    assertPageClean()
})

test('unmounting right after a close requested during opening leaves nothing behind', async () => {
    const {modal, unmountModal} = mountBasicModal()
    modal.open()
    modal.close()

    await unmountModal()
    await wait(SETTLE_MS)

    assertPageClean()
})

test('unmounting an open modal without closing it releases the page', async () => {
    const {modal, shown, unmountModal} = mountBasicModal()
    modal.open()
    await shown()
    assert.equal(document.body.classList.contains('modal-open'), true)
    assert.equal(document.body.style.overflow, 'hidden')

    await unmountModal()
    await wait(SETTLE_MS)

    assertPageClean()
})

test('unmounting during the static backdrop transition leaves nothing behind', async () => {
    const {modal, element, shown, unmountModal} = mountBasicModal({disableKeyboard: true})
    modal.open()
    await shown()
    // Bootstrap answers Escape on a modal without keyboard support with a transition on the dialog.
    element.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))
    assert.equal(element.classList.contains('modal-static'), true)

    await unmountModal()
    await wait(SETTLE_MS)

    assertPageClean()
})

test('unmounting a modal which was never opened disposes it right away', async () => {
    const {element, unmountModal} = mountBasicModal()
    assert.ok(BootstrapModal.getInstance(element))

    await unmountModal()

    assert.equal(BootstrapModal.getInstance(element), null)
    assertPageClean()
})

test('unmounting an open modal disposes it only after its transitions finished', async () => {
    const {modal, element, shown, unmountModal} = mountBasicModal()
    modal.open()
    await shown()

    await unmountModal()
    assert.ok(BootstrapModal.getInstance(element), 'the pending hide still needs the instance')
    await wait(SETTLE_MS)

    assert.equal(BootstrapModal.getInstance(element), null)
    assertPageClean()
})

test('a modal can be opened and closed repeatedly', async () => {
    const {modal, shown, events, unmountModal} = mountBasicModal()
    for (let i = 0; i < 3; i++) {
        modal.open()
        await shown()
        modal.close()
        await waitFor(() => !modal.isShown, 'modal to be hidden')
    }
    await wait(SETTLE_MS)

    assert.deepEqual(events, ['show', 'hide', 'show', 'hide', 'show', 'hide'])
    await unmountModal()
    assertPageClean()
})

/**
 * Mounts a modal and reopens it right after its close hid the dialog. Bootstrap allows this while the backdrop
 * of the close still fades out, so the hidden event of the close arrives during the new opening.
 */
async function mountReopenedModal() {
    const style = document.createElement('style')
    style.textContent = `.modal-backdrop{transition-duration:${DIALOG_TRANSITION_MS / 1000}s;transition-delay:0s}`
    document.head.append(style)
    cleanups.push(() => style.remove())

    const mounted = mountBasicModal()
    const {modal, element, shown} = mounted
    modal.open()
    await shown()
    modal.close()
    await waitFor(() => element.style.display === 'none', 'dialog of the close to be hidden')
    modal.open()
    return mounted
}

/** Fails if the modal is disposed too early, waits for its disposal and for any callback still queued after it. */
async function assertDisposedAfterTransitions(element) {
    assert.ok(BootstrapModal.getInstance(element), 'the reopening still needs the instance')
    await waitFor(() => BootstrapModal.getInstance(element) === null, 'modal to be disposed')
    await wait(SETTLE_MS)
}

test('unmounting a reopened modal before the hidden event of its last close leaves nothing behind', async () => {
    const {element, events, unmountModal} = await mountReopenedModal()
    assert.deepEqual(events, ['show'], 'the last close is still running')

    await unmountModal()
    await assertDisposedAfterTransitions(element)

    assert.deepEqual(events, ['show'], 'an unmounted modal must not emit')
    assertPageClean()
})

test('unmounting a reopened modal after the hidden event of its last close leaves nothing behind', async () => {
    const {modal, element, events, unmountModal} = await mountReopenedModal()
    await waitFor(() => events.includes('hide'), 'hidden event of the last close')
    assert.equal(modal.isShown, false, 'still opening')

    await unmountModal()
    await assertDisposedAfterTransitions(element)

    assert.deepEqual(events, ['show', 'hide'], 'an unmounted modal must not emit')
    assertPageClean()
})

test('modals mounted while an earlier one is closing all clean up', async () => {
    for (let i = 0; i < 3; i++) {
        const {modal, shown, unmountModal} = mountBasicModal()
        modal.open()
        await shown()
        modal.close()
        await unmountModal()
    }
    await wait(SETTLE_MS)

    assertPageClean()
})

test('unmounting a closing nested modal resumes its parent, which stays usable', async () => {
    const outerEvents = []
    const vm = mount({
        data: () => ({innerVisible: true}),
        render() {
            return h(BasicModal, {ref: 'outer', name: 'outer', onHide: () => outerEvents.push('hide')}, {
                body: () => this.innerVisible ? h(BasicModal, {ref: 'inner', name: 'inner'}) : null,
            })
        },
    })
    const {outer, inner} = vm.$refs
    const outerElement = outer.$refs.Modal
    outer.open()
    await waitFor(() => outer.isShown, 'outer modal')
    inner.open()
    await waitFor(() => inner.isShown, 'inner modal')
    assert.equal(outerElement.classList.contains('nested-suspended'), true)

    inner.close()
    vm.innerVisible = false
    await nextTick()
    await wait(SETTLE_MS)

    assert.deepEqual(errors.map(String), [])
    assert.equal(outerElement.classList.contains('nested-suspended'), false)
    assert.equal(outer.isShown, true)
    assert.equal(document.querySelectorAll('.modal').length, 1, 'only the outer modal is left')
    assert.equal(document.querySelectorAll('.modal-backdrop').length, 1, 'only the outer backdrop is left')

    outer.close()
    await waitFor(() => !outer.isShown, 'outer modal to close')
    assert.deepEqual(outerEvents, ['hide'])
    assert.equal(document.querySelectorAll('.modal-backdrop').length, 0)
    assert.equal(document.body.classList.contains('modal-open'), false)
    assert.equal(document.body.style.overflow, '')
})

test('unmounting an open parent with an open nested modal leaves nothing behind', async () => {
    const vm = mount({
        data: () => ({visible: true}),
        render() {
            return this.visible
                ? h(BasicModal, {ref: 'outer', name: 'outer'}, {body: () => h(BasicModal, {ref: 'inner', name: 'inner'})})
                : null
        },
    })
    const {outer, inner} = vm.$refs
    outer.open()
    await waitFor(() => outer.isShown, 'outer modal')
    inner.open()
    await waitFor(() => inner.isShown, 'inner modal')

    vm.visible = false
    await nextTick()
    await wait(SETTLE_MS)

    assertPageClean()
})
