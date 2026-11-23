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
    FileReader: window.FileReader,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    getComputedStyle: window.getComputedStyle.bind(window),
})

const vueRuntime = await import('vue')
const {compile, createApp, h, nextTick, reactive} = vueRuntime
const {createI18n} = await import('vue-i18n')
const {Modal: BootstrapModal} = createRequire(import.meta.url)('bootstrap')

const MESSAGES = {
    common: JSON.parse(readFileSync(new URL('../../../utils/modules/i18n/en/common.json', import.meta.url), 'utf8')),
    navigation: JSON.parse(readFileSync(new URL('../../../utils/modules/i18n/en/navigation.json', import.meta.url), 'utf8')),
    components: JSON.parse(readFileSync(new URL('../../../utils/modules/i18n/en/components.json', import.meta.url), 'utf8')),
    modals: {closeModal: 'Close modal'},
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
    const url = new URL(`../../src/${path}`, import.meta.url)
    const source = readFileSync(url, 'utf8')
    const options = loadOptions(url, stubs).default
    const template = source.match(/<template>([\s\S]*)<\/template>/)[1]
    return {...options, render: compile(template, {isCustomElement: tag => tag === 'vr'})}
}

// Load real child components and helpers while allowing services or leaf views to be stubbed.
function loadOptions(url, stubs) {
    const source = readFileSync(url, 'utf8')
    const script = url.pathname.endsWith('.vue') ? source.match(/<script>([\s\S]*?)<\/script>/)[1] : source
    const importPattern = /^import\s+([^'"]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm
    const names = [], values = []
    for (const [, clause, specifier] of script.matchAll(importPattern)) {
        let dependency
        const bindings = clause.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean)
        const fullyStubbed = bindings.every(item => item.split(/\s+as\s+/).at(-1) in stubs)
        if (!fullyStubbed && specifier.startsWith('.') && specifier.endsWith('.vue')) {
            const target = new URL(specifier, url)
            dependency = loadOptions(target, stubs)
        }
        if (!fullyStubbed && specifier.startsWith('.') && specifier.endsWith('.js')) {
            dependency = loadOptions(new URL(specifier, url), stubs)
        }
        if (!fullyStubbed && specifier.startsWith('@/basic/table/helpers/')) {
            dependency = loadOptions(new URL(`../../src/${specifier.slice(2)}`, import.meta.url), stubs)
        }
        if (specifier === 'vue') dependency = vueRuntime
        if (['deep-equal', 'lodash.debounce'].includes(specifier)) {
            dependency = {default: createRequire(import.meta.url)(specifier)}
        }
        for (const item of bindings) {
            const [exported, local = exported] = item.split(/\s+as\s+/)
            names.push(local)
            values.push(stubs[local] ?? dependency?.[clause.includes('{') ? exported : 'default'] ?? {})
        }
    }
    const exports = [...script.matchAll(/export\s+(?:const|let|function)\s+(\w+)/g)].map(m => m[1])
    const body = script.replace(importPattern, '').replace(/export default/, 'const defaultExport =')
        .replace(/export (?=(?:const|let|function)\b)/g, '')
    const result = new Function(...names, `${body}\nreturn {${exports.join(',')}${exports.length ? ',' : ''} default: typeof defaultExport === 'undefined' ? undefined : defaultExport};`)(...values)
    const template = source.match(/<template>([\s\S]*)<\/template>/)
    if (result.default && template) result.default.render = compile(template[1], {isCustomElement: tag => tag === 'vr'})
    return result
}

test('two-factor setup retains the server secret and generates its QR code', async () => {
    const requests = []
    const events = []
    const options = loadOptions(new URL('../../src/auth/TotpEnrollment.vue', import.meta.url), {
        axios: {post: async (...args) => {
            requests.push(args)
            return {status: 200, data: {secretBase32: 'TESTSECRET', otpauthUrl: 'otpauth://totp/test'}}
        }},
        QRCode: {toDataURL: async url => `qr:${url}`},
        getServerURL: () => 'https://care.test',
    }).default
    const state = {...options.data(), ...options.methods, $emit: event => events.push(event)}
    await state.initiateTotpSetup()
    assert.equal(state.totpSecret, 'TESTSECRET')
    assert.equal(state.totpQrCode, 'qr:otpauth://totp/test')
    assert.equal(state.totpSetupStep, 'initiate')
    assert.equal(requests[0][0], 'https://care.test/auth/2fa/totp/setup/initiate')
    assert.equal(requests[0][2].withCredentials, true)
    state.cancelTotpSetup()
    assert.equal(state.totpSecret, null)
    assert.equal(state.totpQrCode, null)
    assert.deepEqual(events, ['cancel'])
})

test('two-factor enrollment stays busy until its status refresh completes', async () => {
    const options = loadOptions(new URL('../../src/auth/TotpEnrollment.vue', import.meta.url), {
        axios: {post: async () => ({status: 200})}, getServerURL: () => '',
    }).default
    const events = []
    let finishRefresh
    const state = {...options.data(), ...options.methods, canVerifyTotpSetup: true,
        $t: key => key, eventBus: {emit() {}}, $emit: event => events.push(event),
        refreshStatus: () => new Promise(resolve => { finishRefresh = resolve })}
    const pending = state.verifyTotpSetup()
    await Promise.resolve()
    assert.equal(state.isSubmitting, true)
    assert.equal(events.includes('complete'), false)
    finishRefresh()
    await pending
    assert.equal(state.isSubmitting, false)
    assert.deepEqual(events, ['complete'])
})

test('a rejected two-factor setup clears the pending state and reports the failure', async () => {
    const toasts = []
    const events = []
    const options = loadOptions(new URL('../../src/auth/TotpEnrollment.vue', import.meta.url), {
        axios: {post: async () => ({status: 400, data: {message: 'Setup failed'}})},
        getServerURL: () => '',
        resolveApiMessage: response => response.message,
    }).default
    const state = {...options.data(), ...options.methods, $t: key => key, $emit: event => events.push(event),
        eventBus: {emit: (name, payload) => toasts.push({name, ...payload})}}
    await state.initiateTotpSetup()
    assert.deepEqual(events, ['cancel'])
    assert.equal(state.totpSecret, null)
    assert.equal(toasts[0].name, 'toast')
    assert.equal(toasts[0].variant, 'danger')
    assert.equal(toasts[0].message, 'Setup failed')
})

test('searchable select filters, chooses an option, and closes on an outside click', async t => {
    const component = loadComponent('basic/form/SearchableSelect.vue', {translateMaybeKey: value => value})
    const state = reactive({value: -1})
    const blurs = []
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp({render: () => h(component, {
        modelValue: state.value,
        selectOptions: [{value: 'first', name: 'First'}, {value: 'second', name: 'Second'}],
        options: {},
        'onUpdate:modelValue': value => { state.value = value },
        onBlur: value => blurs.push(value),
    })})
    app.config.globalProperties.$t = key => key
    app.mount(host)
    t.after(() => {app.unmount(); host.remove()})
    host.querySelector('button').click()
    await nextTick()
    const search = host.querySelector('input')
    search.value = 'SECOND'
    search.dispatchEvent(new window.Event('input', {bubbles: true}))
    await nextTick()
    const items = host.querySelectorAll('.dropdown-item')
    assert.equal(items.length, 1)
    assert.match(items[0].textContent, /Second/)
    items[0].dispatchEvent(new window.MouseEvent('mousedown', {bubbles: true}))
    await nextTick()
    assert.equal(state.value, 'second')
    assert.deepEqual(blurs, [true])
    assert.equal(host.querySelector('.dropdown-menu'), null)
    host.querySelector('button').click()
    await nextTick()
    document.body.dispatchEvent(new window.MouseEvent('mousedown', {bubbles: true}))
    await nextTick()
    assert.equal(host.querySelector('.dropdown-menu'), null)
})

test('auth fields retain input attributes and emit typed text and blur', async t => {
    const component = loadComponent('auth/AuthInputField.vue')
    const updates = [], blurs = []
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(component, {modelValue: 'initial', label: 'Email',
        input: {id: 'email', name: 'email', type: 'email', required: true},
        'onUpdate:modelValue': value => updates.push(value), onBlur: () => blurs.push(true)})
    app.mount(host)
    t.after(() => {app.unmount(); host.remove()})
    const input = host.querySelector('input')
    assert.equal(input.value, 'initial')
    assert.equal(input.required, true)
    assert.equal(host.querySelector('label').htmlFor, 'email')
    input.value = 'person@example.test'
    input.dispatchEvent(new window.Event('input', {bubbles: true}))
    input.dispatchEvent(new window.Event('blur'))
    assert.deepEqual(updates, ['person@example.test'])
    assert.deepEqual(blurs, [true])
    updates.length = 0
    input.dispatchEvent(new window.Event('compositionstart'))
    input.value = 'intermediate composition'
    input.dispatchEvent(new window.Event('input'))
    assert.deepEqual(updates, [])
    input.value = '完成@example.test'
    input.dispatchEvent(new window.Event('compositionend'))
    assert.deepEqual(updates, ['完成@example.test'])
})

test('import file picker parses browser files and normalizes a single record into a list', async t => {
    const component = loadComponent('basic/modal/ImportFilePicker.vue', {
        getSupportedImportFormats: () => [{extensions: ['.json'], parse: JSON.parse}],
    })
    const parsed = []
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(component, {onParsed: value => parsed.push(value)})
    app.config.globalProperties.$t = key => key
    const vm = app.mount(host)
    t.after(() => {app.unmount(); host.remove()})
    const record = {name: 'Workflow', children: [{name: 'First step'}]}
    await vm.processFile(new window.File([JSON.stringify(record)], 'Workflow.JSON', {type: 'application/json'}))
    assert.deepEqual(parsed, [[record]])
    vm.reset()
    assert.equal(vm.selectedFile, null)
    assert.equal(vm.parseError, null)
    assert.equal(host.querySelector('input').value, '')
})

test('post-login prompts request consent before enforced two-factor setup', async t => {
    const events = []
    const modal = name => ({
        data: () => ({visible: false}),
        methods: {
            isVisible() {return this.visible},
            open() {if (!this.visible) {this.visible = true; events.push(`${name}:open`)}},
            close() {this.visible = false; events.push(`${name}:close`)},
        },
        render: () => h('div'),
    })
    const component = loadComponent('auth/PostLoginPrompts.vue', {
        ConsentModal: modal('consent'), TwoFactorSettingsModal: modal('two-factor'),
    })
    const user = reactive({acceptTerms: false, loginMethod: 'local', twoFactorMethods: []})
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(component)
    app.config.globalProperties.$store = {getters: {
        'auth/getUser': user, 'settings/getValue': () => 'true',
    }}
    app.mount(host)
    t.after(() => {app.unmount(); host.remove()})
    await nextTick()
    assert.deepEqual(events, ['consent:open'])
    user.acceptTerms = true
    await nextTick()
    await nextTick()
    assert.deepEqual(events, ['consent:open', 'consent:close', 'two-factor:open'])
    user.twoFactorMethods.push('totp')
    await nextTick()
    await nextTick()
    assert.equal(events.at(-1), 'two-factor:close')
})

test('chat streaming accepts only the active request and clears its preview when it ends', async t => {
    const messageTypes = await import('../../src/assets/aiMessageTypes.js')
    const component = loadComponent('components/aiAssistant/AiConversationTranscript.vue', {
        ...messageTypes,
        AiConversationBody: {render() {return h('div', this.$slots.default?.())}},
        AiConversationMessage: {props: ['message'], render() {return h('pre', this.message.content)}},
    })
    const state = reactive({request: null})
    const host = document.createElement('div')
    document.body.appendChild(host)
    let vm
    const app = createApp({render: () => h(component, {
        ref: value => {vm = value}, activeRequest: state.request,
        snapshot: {messages: [], activeConversationId: 7}, studyStepId: 3,
    })})
    app.provide('studySessionId', 5)
    app.config.globalProperties.$t = key => key
    app.mount(host)
    t.after(() => {app.unmount(); host.remove()})
    state.request = {type: 'send', requestId: 'request-1', submittedContent: 'Question', conversationId: 7}
    await nextTick()
    const sendDelta = data => component.sockets.serviceRefresh.call(vm, {
        service: 'AIAssistantService', type: 'conversationDelta', data: {
            requestId: 'request-1', studySessionId: 5, studyStepId: 3,
            conversationId: 7, assistantMessageId: 9, ...data,
        },
    })
    sendDelta({text: 'Hello '})
    sendDelta({requestId: 'another-request', text: 'wrong request'})
    sendDelta({studySessionId: 99, text: 'wrong session'})
    sendDelta({text: 'world'})
    await waitFor(() => host.textContent.includes('Hello world'), 'streamed reply')
    assert.equal(host.textContent.includes('wrong'), false)
    state.request = null
    await nextTick()
    assert.equal(host.textContent.includes('Hello world'), false)
})

test('an edited comment saves and requests sentiment before its body unmounts', async () => {
    const leaf = {render: () => h('span')}
    const component = loadComponent('components/annotator/sidebar/card/Comment.vue', {
        LoadIcon: leaf, IconLoading: leaf, TagSelector: leaf,
        Collaboration: {...leaf, methods: {removeCollab() {}}},
        CommentActions: leaf, AnnotationReplies: leaf,
        formatLocalizedDate: value => value,
    })
    const comment = reactive({id: 1, userId: 1, creator_name: 'Human', text: 'Edited text', tags: [], draft: true})
    const events = []
    mount({
        provide: () => ({listenOnActive() {}, unlistenOnActive() {}}),
        render: () => h(component, {commentId: 1}),
    }, {
        $store: {getters: {
            'table/comment/get': () => comment, 'auth/getUserId': 1,
            'settings/getValue': key => key.includes('defaultNumsShown') ? '1' : 'true',
            'service/get': (_service, type) => type === 'skillUpdate' ? {sentiment_classification: {}} : {},
        }},
        $socket: {emit: (event, data, ack) => {
            events.push({event, data})
            ack?.({success: true})
        }},
    })
    await nextTick()
    events.length = 0
    cleanups.pop()()
    assert.deepEqual(events.map(item => item.event), ['commentUpdate', 'serviceRequest'])
    assert.equal(events[1].data.data.data.text, 'Edited text')
})

test('the extracted editor sidebar renders without reading undeclared state', async t => {
    const lookBack = await import('../../src/components/study/helpers/lookBack.js')
    const leaf = {render: () => h('span')}
    const component = loadComponent('components/editor/sidebar/EditorSidebar.vue', {
        ...lookBack,
        BasicSidebar: {render: () => h('aside')}, SidebarTemplate: leaf,
        SidebarHistory: leaf, SidebarConfigurator: leaf, TemplateConfigurator: leaf,
    })
    const warnings = []
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(component, {withoutHistory: true})
    app.config.globalProperties.$store = {getters: {
        'auth/isAdmin': false, 'settings/getValue': () => 'false',
    }}
    app.config.globalProperties.$t = key => key
    app.config.warnHandler = warning => warnings.push(warning)
    app.mount(host)
    t.after(() => {app.unmount(); host.remove()})
    assert.ok(host.querySelector('aside'))
    assert.equal(warnings.some(warning => warning.includes('not defined')), false)
})

test('two-factor settings cannot disable the last required method', async () => {
    for (const [file, flag, method] of [
        ['EmailTwoFactorSettings', 'emailEnabled', 'disableEmail2FA'],
        ['TotpTwoFactorSettings', 'totpEnabled', 'disableTotp2FA'],
    ]) {
        const requests = [], toasts = []
        const options = loadOptions(new URL(`../../src/auth/${file}.vue`, import.meta.url), {
            axios: {post: (...args) => requests.push(args)},
        }).default
        const state = {...options.data.call({enabled: true}), ...options.methods,
            isTwoFactorRequired: true, enabledMethods: ['single'],
            $t: key => key, eventBus: {emit: (_name, payload) => toasts.push(payload)}}
        state[flag] = false
        await state[method]()
        assert.equal(state[flag], true)
        assert.equal(requests.length, 0)
        assert.equal(toasts[0].variant, 'warning')
    }
})

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
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
        if (condition()) {
            return
        }
        await wait(5)
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

function wizardState(file, props, stubs = {}) {
    const options = loadOptions(new URL(`../../src/components/wizard/${file}.vue`, import.meta.url), stubs).default
    const state = {...props, ...options.data?.call(props)}
    for (const [name, method] of Object.entries(options.methods ?? {})) state[name] = method.bind(state)
    for (const [name, getter] of Object.entries(options.computed ?? {})) {
        Object.defineProperty(state, name, {get: () => getter.call(state)})
    }
    return state
}

test('setup Next validates without creating an account; Finish creates the account before saving settings', async () => {
    const requests = [], navigation = []
    let hasAdmin = false
    const axios = {post: async (url, payload, config) => {
        requests.push({url, payload, config})
        return {status: 200, data: {success: true}}
    }}
    const admin = wizardState('SetupWizardAdminStep', {
        formData: {userName: ' admin ', email: ' admin@example.test ', password: 'validpass'},
        $emit: event => {if (event === 'created') hasAdmin = true},
    }, {axios, getServerURL: () => 'https://care.test'})
    admin.submitAdmin()
    assert.equal(requests.length, 0)
    const summary = wizardState('SetupWizardSummaryStep', {
        hasAdmin: false, createAdmin: admin.createAccount, $emit: () => {},
        formSettings: {'system.mailService.enabled': 'false', 'app.register.emailVerification': 'true', count: 5},
        settingsFromFile: {count: '7', extra: false},
        $router: {push: route => navigation.push(route), go: value => navigation.push(value)},
    }, {axios, getServerURL: () => 'https://care.test'})
    await summary.finish()
    assert.equal(hasAdmin, true)
    assert.deepEqual(requests.map(request => request.url), [
        'https://care.test/auth/setup-admin', 'https://care.test/setup/complete',
    ])
    assert.deepEqual(requests[0].payload, {userName: 'admin', email: 'admin@example.test', password: 'validpass'})
    assert.equal(requests[0].config.withCredentials, true)
    assert.deepEqual(Object.fromEntries(requests[1].payload.settings.map(({key, value}) => [key, value])), {
        'system.mailService.enabled': 'false', 'app.register.emailVerification': 'false', count: '7', extra: 'false',
    })
    assert.deepEqual(navigation, ['/dashboard', 0])
})

test('setup does not save settings when administrator creation fails', async () => {
    const requests = [], errors = []
    const axios = {post: async url => {
        requests.push(url)
        return {status: 400, data: {message: 'Name already exists'}}
    }}
    const admin = wizardState('SetupWizardAdminStep', {
        formData: {userName: 'admin', email: 'admin@example.test', password: 'validpass'},
        $emit: (event, message) => {if (event === 'error' && message) errors.push(message)},
    }, {axios, getServerURL: () => ''})
    const summary = wizardState('SetupWizardSummaryStep', {
        hasAdmin: false, createAdmin: admin.createAccount, formSettings: {}, settingsFromFile: null, $emit: () => {},
    }, {axios, getServerURL: () => ''})
    await summary.finish()
    assert.deepEqual(requests, ['/auth/setup-admin'])
    assert.deepEqual(errors, ['Name already exists'])
    assert.equal(summary.finishing, false)
})

// BackendTable and its table search, mounted with all their real parts (table/server, table/search).

// v-model reads these when it updates a text input.
Object.assign(globalThis, {Document: window.Document, ShadowRoot: window.ShadowRoot})

/** Socket double: records every emit, answers queryTable through `reply`, keeps listeners per event. */
function fakeTableSocket(reply) {
    const listeners = new Map()
    const emitted = []
    const add = (event, fn) => listeners.set(event, [...(listeners.get(event) || []), fn])
    const socket = {
        id: 'socket-1',
        connected: true,
        emitted,
        listeners,
        on: add,
        once: add,
        off(event, fn) {
            listeners.set(event, (listeners.get(event) || []).filter(listener => listener !== fn))
        },
        emit(event, payload, ack) {
            emitted.push({event, payload})
            if (event === 'queryTable' && ack) setTimeout(() => ack(reply(payload)))
        },
        timeout() {
            return {emit: (event, payload, ack) => socket.emit(event, payload, response => ack(null, response))}
        },
        fire(event, payload) {
            for (const listener of listeners.get(event) || []) listener(payload)
        },
    }
    return socket
}

const TABLE_ROWS = Array.from({length: 25}, (_, index) => ({id: index + 1, name: `Study ${index + 1}`}))

/** Server double for queryTable: keyset pages of TABLE_ROWS, filtered by the free-text search. */
function queryTableReply({query}) {
    let rows = TABLE_ROWS.filter(row => !query.search || row.name.includes(query.search))
    if (query.sort?.direction === 'DESC') rows = [...rows].reverse()
    let start = 0
    if (query.after) start = rows.findIndex(row => row.id === query.after) + 1
    if (query.before) start = Math.max(0, rows.findIndex(row => row.id === query.before) - query.limit)
    if (query.fromEnd) start = Math.max(0, rows.length - query.limit)
    const items = rows.slice(start, start + query.limit)
    return {success: true, data: {items, meta: {
        total: rows.length, page: 1, pageSize: query.limit, totalPages: Math.ceil(rows.length / query.limit),
        startCursor: items[0]?.id ?? null, endCursor: items.at(-1)?.id ?? null,
    }}}
}

const TABLE_STUBS = {
    LoadIcon: {render: () => h('i', {class: 'icon-stub'})},
    Loader: {render: () => null},
    DatetimePicker: {render: () => null},
    TCell: {props: ['column', 'row'], render() {
        return h('span', {class: 'cell-text'}, String(this.row[this.column.key]))
    }},
    resolveApiMessage: response => response?.message ?? 'error',
}

async function mountBackendTable(props = {}) {
    const BackendTable = loadComponent('basic/BackendTable.vue', TABLE_STUBS)
    const socket = fakeTableSocket(queryTableReply)
    const toasts = []
    const holder = reactive({show: true})
    let table
    mount({render: () => holder.show ? h(BackendTable, {
        ref: instance => {table = instance ?? table},
        table: 'study',
        columns: [{key: 'name', name: 'Name', sortable: true}],
        options: {pagination: 10, selectableRows: true, search: true},
        queryFilterSchema: {state: {label: 'State', type: 'enum', options: ['open', 'closed']}},
        ...props,
    }) : null}, {$socket: socket, eventBus: {emit: (event, payload) => toasts.push(payload)}})
    const rowNames = () => [...document.querySelectorAll('tbody tr[data-row] .cell-text')].map(cell => cell.textContent)
    await waitFor(() => rowNames().length > 0, 'first page')
    return {table: () => table, socket, toasts, holder, rowNames}
}

const tableQueries = socket => socket.emitted.filter(({event}) => event === 'queryTable').map(({payload}) => payload.query)
const tableRows = () => [...document.querySelectorAll('tbody tr[data-row]')]

test('a mounted BackendTable loads its first page over the socket and renders the rows', async () => {
    const {socket, rowNames} = await mountBackendTable()
    assert.deepEqual(rowNames(), TABLE_ROWS.slice(0, 10).map(row => row.name))
    assert.deepEqual(tableQueries(socket), [{limit: 10, sort: {column: 'id', direction: 'ASC'}}])
    assert.equal(socket.emitted.filter(({event}) => event === 'queryTableAcquire').length, 1)
    assert.equal(socket.listeners.get('studyDelta').length, 1)
    assert.equal(socket.listeners.get('studyStale').length, 1)
    assert.deepEqual(errors.map(String), [])
})

test('BackendTable row clicks and the header checkbox drive getSelection and applySelection', async () => {
    const {table, rowNames} = await mountBackendTable()
    tableRows()[1].dispatchEvent(new window.Event('click'))
    await nextTick()
    assert.deepEqual(table().getSelection().ids, [2])
    assert.equal(document.querySelectorAll('tbody tr[data-row] input:checked').length, 1)

    const all = document.querySelector('thead input[type=checkbox]')
    all.dispatchEvent(new window.Event('change'))
    await nextTick()
    let selection = table().getSelection()
    assert.equal(selection.allMatching, true)
    assert.equal(selection.count, TABLE_ROWS.length)
    assert.equal(document.querySelectorAll('tbody tr[data-row] input:checked').length, rowNames().length)
    // Unticking one row while everything matches excludes it.
    tableRows()[0].dispatchEvent(new window.Event('click'))
    await nextTick()
    selection = table().getSelection()
    assert.deepEqual(selection.excludeIds, [1])
    assert.equal(all.indeterminate, true)

    table().applySelection({ids: [3, 4]})
    await nextTick()
    selection = table().getSelection()
    assert.equal(selection.allMatching, false)
    assert.deepEqual(selection.ids, [3, 4])
    assert.deepEqual(tableRows().filter(row => row.querySelector('input').checked)
        .map(row => row.textContent.trim()), ['Study 3', 'Study 4'])
    assert.deepEqual(errors.map(String), [])
})

test('BackendTable pages forward by cursor and sorts from the header', async () => {
    const {table, socket, rowNames} = await mountBackendTable()
    table().paginationPageChange(2)
    await waitFor(() => rowNames()[0] === 'Study 11', 'second page')
    assert.equal(tableQueries(socket).at(-1).after, 10)

    table().paginationPageChange(1)
    await waitFor(() => rowNames()[0] === 'Study 1', 'first page again')

    document.querySelector('thead th:not(:first-child) .icon-stub').dispatchEvent(new window.MouseEvent('click'))
    await waitFor(() => tableQueries(socket).at(-1).sort.column === 'name', 'sorted query')
    assert.deepEqual(errors.map(String), [])
})

test('BackendTable search bar and applySearch refetch with the query, unmount releases the socket', async () => {
    const {table, socket, holder, rowNames} = await mountBackendTable()
    const input = document.querySelector('.token-input')
    input.value = 'Study 2'
    input.dispatchEvent(new window.Event('input'))
    await waitFor(() => tableQueries(socket).at(-1).search === 'Study 2', 'search query')
    await waitFor(() => rowNames().length === 7, 'searched rows')
    assert.equal(document.querySelectorAll('.search-bar-btn').length, 2)

    table().applySearch({search: '', columnFilters: {state: {operator: '=', value: 'open'}}})
    await waitFor(() => tableQueries(socket).at(-1).columnFilters?.state?.value === 'open', 'filter query')
    await nextTick()
    assert.equal(document.querySelectorAll('.token-chip').length, 1)
    assert.equal(document.querySelector('.token-input').value, '')

    holder.show = false
    await nextTick()
    assert.equal(socket.emitted.at(-1).event, 'queryTableRelease')
    assert.equal(socket.listeners.get('studyDelta').length, 0)
    assert.equal(socket.listeners.get('studyStale').length, 0)
    assert.equal(socket.listeners.get('connect').length, 0)
    assert.deepEqual(errors.map(String), [])
})

test('BackendTable applies socket deltas: an update highlights, a delete marks the row', async () => {
    const {socket, rowNames} = await mountBackendTable()
    socket.fire('studyDelta', {operation: 'update', row: {id: 2, name: 'Renamed'}, originSocketId: 'other'})
    await nextTick()
    await nextTick()
    assert.equal(rowNames()[1], 'Renamed')
    assert.ok(tableRows()[1].classList.contains('row-updated'))
    socket.fire('studyDelta', {operation: 'delete', row: {id: 3}, originSocketId: 'other'})
    await nextTick()
    assert.ok(tableRows()[2].classList.contains('row-deleting'))
    assert.deepEqual(errors.map(String), [])
})

test('a mounted BasicTable selects rows and filters them by its search input', async () => {
    const BasicTable = loadComponent('basic/Table.vue', TABLE_STUBS)
    const state = reactive({selected: []})
    mount({render: () => h(BasicTable, {
        data: TABLE_ROWS,
        modelValue: state.selected,
        'onUpdate:modelValue': value => {state.selected = value},
        columns: [{key: 'name', name: 'Name'}],
        options: {pagination: 10, selectableRows: true, search: true},
    })})
    const names = () => [...document.querySelectorAll('tbody tr .cell-text')].map(cell => cell.textContent)
    await waitFor(() => names().length === 10, 'first page')
    document.querySelectorAll('tbody tr')[2].dispatchEvent(new window.Event('click'))
    await waitFor(() => state.selected.length > 0, 'selection')
    assert.deepEqual(state.selected.map(row => row.id), [3])
    assert.equal(document.querySelector('tbody tr:nth-child(3) input').checked, true)

    const input = document.querySelector('input[aria-label="table-search"]')
    input.value = 'Study 2'
    input.dispatchEvent(new window.Event('input'))
    await waitFor(() => names().length === 7, 'filtered rows')
    assert.deepEqual(errors.map(String), [])
})

test('a mounted BasicSidebar switches tabs, emits actions and toggles from the top bar', async () => {
    // Aliased imports are not followed by loadOptions, so the sidebar parts are handed in.
    const TopBarButton = {props: ['show', 'title', 'disabled'], render() {
        return h('button', {title: this.title, disabled: this.disabled}, this.$slots.default?.())
    }}
    const parts = Object.fromEntries(['SidebarHeader', 'SidebarResizeHandle', 'SidebarToggle', 'SidebarContent',
        'SidebarPeekZone'].map(name => [name, loadComponent(`basic/sidebar/${name}.vue`, {...TABLE_STUBS, TopBarButton})]))
    const BasicSidebar = loadComponent('basic/Sidebar.vue', {...parts, scrollElement: async () => {}})
    const topBar = document.createElement('ul')
    topBar.id = 'topBarNavItems'
    document.body.append(topBar)
    const events = []
    const tab = title => ({render() {
        return h('div', {class: `pane-${title}`}, title)
    }, props: ['title', 'icon', 'buttons']})
    const First = tab('first'), Second = tab('second')
    mount({render: () => h(BasicSidebar, {
        buttons: [{action: 'general', title: 'General', isGeneral: true}],
        onSidebarChange: slot => events.push(['change', slot]),
        onSidebarAction: ({action, slotName}) => events.push(['action', action, slotName]),
        onSidebarVisibilityChange: visible => events.push(['visible', visible]),
    }, {
        first: () => h(First, {title: 'first', icon: 'a', buttons: [{action: 'own', title: 'Own'}]}),
        second: () => h(Second, {title: 'second', icon: 'b'}),
    })}, {$socket: {emit: () => {}}})
    await waitFor(() => document.querySelectorAll('.sidebar-header .nav-link').length === 2, 'tabs')
    const shown = () => [...document.querySelectorAll('[data-sidebar-slot]')]
        .filter(pane => pane.style.display !== 'none').map(pane => pane.dataset.sidebarSlot)
    assert.deepEqual(shown(), ['first'])
    assert.equal(document.querySelectorAll('.sidebar-action-button').length, 2)

    document.querySelectorAll('.sidebar-action-button')[1].dispatchEvent(new window.MouseEvent('click'))
    document.querySelectorAll('.sidebar-header .nav-link')[1].dispatchEvent(new window.MouseEvent('click'))
    await nextTick()
    assert.deepEqual(shown(), ['second'])
    assert.equal(document.querySelectorAll('.sidebar-action-button').length, 1)

    topBar.querySelector('button, .btn').dispatchEvent(new window.MouseEvent('click'))
    await nextTick()
    assert.equal(document.querySelector('#sidebarContainer').style.display, 'none')
    assert.deepEqual(events, [
        ['change', 'first'], ['visible', true], ['action', 'own', 'first'], ['change', 'second'], ['visible', false],
    ])
    assert.deepEqual(errors.map(String), [])
})

// Assignment wizard (dashboard/study/AssignmentModal): the root orchestrates steps and selection
// snapshots, the confirmation step owns the create requests.

const ASSIGNMENT_DIR = 'components/dashboard/study'
const selectionModule = loadOptions(new URL('../../src/basic/table/emptySelection.js', import.meta.url), {})

/** Options-API instance double: data, computed getters and bound methods over the given props. */
function assignmentState(file, props, stubs = {}) {
    const options = loadOptions(new URL(`../../src/${ASSIGNMENT_DIR}/${file}.vue`, import.meta.url), stubs).default
    const state = {$t: key => key, $options: options, ...props}
    Object.assign(state, options.data?.call(state), props)
    state.$data = state
    for (const [name, method] of Object.entries(options.methods ?? {})) state[name] = method.bind(state)
    for (const [name, getter] of Object.entries(options.computed ?? {})) {
        Object.defineProperty(state, name, {get: () => getter.call(state)})
    }
    return state
}

/** Socket double answering each event from `replies` and recording its payload. */
function assignmentSocket(replies) {
    const emitted = []
    return {emitted, emit: (event, payload, ack) => {
        emitted.push({event, payload})
        ack(replies[event])
    }}
}

function confirmationState(props) {
    const toasts = [], settled = [], downloads = []
    const state = assignmentState('assignment/ConfirmationStep', {
        bulk: true, template: {id: 1}, assignmentType: 'document', targetWorkflowId: null,
        newStudyOwner: 'session_owner', selectedAssignments: [], selectedReviewer: [],
        reviewerSelectionMode: {}, workflowSteps: [], roles: [], roleSelection: {}, reviewerSelection: {},
        enableEmailNotification: false, workflowMapping: undefined,
        eventBus: {emit: (event, toast) => toasts.push(toast)},
        $emit: (event, value) => settled.push([event, value]),
        $store: {getters: {'table/document/getFiltered': () => []}},
        ...props,
    }, {
        downloadObjectsAs: (...args) => downloads.push(args),
        resolveApiMessage: res => `api:${res?.message}`,
    })
    return {state, toasts, settled, downloads}
}

test('bulk confirmation sends query-table snapshots, downloads role CSV rows and settles successfully', () => {
    const socket = assignmentSocket({assignmentCreateBulk: {success: true, data: {csvRows: [{reviewer: 7}]}}})
    const {state, toasts, settled, downloads} = confirmationState({
        assignmentType: 'submission', selectedReviewer: [{id: 7}], reviewerSelectionMode: {mode: 'role'},
        roles: [{id: 2, name: 'Student'}], roleSelection: {2: 1}, enableEmailNotification: true, $socket: socket,
    })
    const reviewers = {allMatching: true, count: 30}, submissions = {allMatching: true, count: 12}
    state.submit('progress-1', {reviewerQuerySelection: reviewers, assignmentSelection: submissions})
    assert.deepEqual(socket.emitted.map(({event}) => event), ['assignmentCreateBulk'])
    const payload = socket.emitted[0].payload
    assert.equal(payload.progressId, 'progress-1')
    assert.equal(payload.mode, 'role')
    assert.equal(payload.enableEmailNotification, true)
    assert.equal(payload.reviewerQuerySelection, reviewers)
    assert.equal(payload.assignmentSelection, submissions)
    assert.equal(payload.documents, undefined)
    assert.deepEqual(downloads, [[[{reviewer: 7}], 'assignments', 'csv']])
    assert.equal(toasts[0].variant, 'success')
    assert.deepEqual(settled, [['settled', true]])
})

test('single confirmation resolves the selection first and maps documents onto workflow steps', () => {
    const socket = assignmentSocket({
        assignmentBulkResolveSelection: {success: true, data: {selectedAssignments: [], selectedReviewer: [{id: 8}]}},
        assignmentCreateSingle: {success: false, message: 'denied'},
    })
    const {state, toasts, settled} = confirmationState({
        bulk: false, selectedAssignments: [{id: 5}], workflowSteps: [{id: 11}, {id: 12}], $socket: socket,
    })
    const selection = {assignmentType: 'document', reviewerQuerySelection: {ids: [8]}}
    state.submit('unused', selection)
    assert.deepEqual(socket.emitted.map(({event}) => event), ['assignmentBulkResolveSelection', 'assignmentCreateSingle'])
    assert.equal(socket.emitted[0].payload, selection)
    const payload = socket.emitted[1].payload
    assert.deepEqual(payload.selectedAssignments, [{id: 5}])
    assert.deepEqual(payload.reviewer, [{id: 8}])
    assert.deepEqual(payload.documents, [{documentId: 5, workflowStepId: 11}, {documentId: null, workflowStepId: 12}])
    assert.deepEqual(toasts, [{title: 'dashboard.study.failedToCreateAssignment', message: 'api:denied', variant: 'danger'}])
    assert.deepEqual(settled, [['settled', false]])
})

test('a failed single-assignment resolve settles without creating anything', () => {
    const socket = assignmentSocket({assignmentBulkResolveSelection: {success: false, message: 'gone'}})
    const {state, settled} = confirmationState({bulk: false, assignmentType: 'study_session', $socket: socket})
    state.submit('unused', {})
    assert.deepEqual(socket.emitted.map(({event}) => event), ['assignmentBulkResolveSelection'])
    assert.deepEqual(settled, [['settled', false]])
})

test('distribution step reports mode, quotas and review count as one modal value', () => {
    const state = assignmentState('assignment/DistributionStep', {
        modalValue: {reviewerSelectionMode: {mode: 'role'}, roleSelection: {2: '2', 3: '1'}},
        selectedReviewer: [], selectedAssignments: [{id: 1}], assignmentCount: 4, assignmentType: 'study_session', roles: [],
    })
    assert.deepEqual(state.reviewerSelectionModeFields[0].options.map(option => option.value), ['role', 'reviewer', 'session_user'])
    assert.equal(state.isValid, true)
    assert.equal(state.distribution.numberOfReviews, 12)
    state.reviewerSelectionMode = {mode: 'reviewer'}
    state.reviewerSelection = {7: '3'}
    assert.equal(state.remainingAssignments, 1)
    assert.equal(state.isValid, false)
    assert.equal(state.distribution.numberOfReviews, 3)
})

test('assignment wizard snapshots live selections across steps and hands them to the confirmation step', () => {
    const submitted = [], waiting = [], progress = []
    const liveReviewers = {allMatching: true, count: 9}
    const socket = assignmentSocket({
        assignmentBulkResolveSelection: {success: true, data: {selectedAssignments: [{id: 1}], selectedReviewer: [{id: 2}]}},
    })
    const state = assignmentState('AssignmentModal', {$socket: socket}, {
        resolveApiMessage: () => '', cloneSelection: selectionModule.cloneSelection, emptySelection: selectionModule.emptySelection,
    })
    state.$refs = {
        assignmentStepper: {
            setWaiting: value => waiting.push(value),
            startProgress: () => 'progress-2',
            stopProgress: () => progress.push('stop'),
            close: () => progress.push('close'),
        },
    }
    Object.assign(state, {bulk: true, assignmentType: 'study_session'})
    assert.deepEqual(state.steps.map(step => step.panel), [
        'template', 'workflow-mapping', 'session-selection', 'reviewer-selection', 'distribution', 'confirmation',
    ])
    state.assignmentSelection = {allMatching: true, count: 4}
    state.activeStep = 3
    state.$refs.reviewerSelectionStep = {getSelection: () => liveReviewers}
    state.onStepChange(4)
    assert.deepEqual(state.reviewerQuerySelection, liveReviewers)
    assert.notEqual(state.reviewerQuerySelection, liveReviewers)
    assert.deepEqual(socket.emitted[0].payload.assignmentSelection, {allMatching: true, count: 4})
    assert.deepEqual([state.assignmentModalValue, state.selectedReviewer], [[{id: 1}], [{id: 2}]])
    assert.deepEqual(waiting, [true, false])
    assert.equal(state.assignmentCount, 4)

    delete state.$refs.reviewerSelectionStep
    state.$refs.confirmationStep = {submit: (...args) => submitted.push(args)}
    state.onSubmit()
    assert.equal(submitted[0][0], 'progress-2')
    assert.deepEqual(submitted[0][1].reviewerQuerySelection, liveReviewers)
    assert.deepEqual(submitted[0][1].assignmentSelection, {allMatching: true, count: 4})
    state.onSettled(false)
    state.onSettled(true)
    assert.deepEqual(progress, ['stop', 'stop', 'close'])

    const key = state.stepResetKey
    state.reset()
    assert.deepEqual([state.bulk, state.stepResetKey, state.assignmentType, state.activeStep], [true, key + 1, 'document', 0])
    assert.deepEqual(state.reviewerQuerySelection, selectionModule.emptySelection())
    assert.equal(state.steps.length, 5)
})
