/**
 * Regression tests for the page visibility stats of the PDF viewer (#509).
 *
 * Mounts the real PDFViewer and PDFPage (templates, computed, watchers, provide/inject) with Vue's
 * custom renderer, so no DOM is needed. Only the PDF file, the browser APIs and the child components
 * without a part in this flow are replaced.
 *
 * Run from `frontend`: npm run test:unit
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import {setTimeout as wait} from 'node:timers/promises'
import {compile, computed, createRenderer, h, reactive, toRaw} from 'vue'
import debounce from 'lodash.debounce'
import {PDF} from '../../src/components/annotator/pdfViewer/pdfStore.js'

const DOCUMENT_ID = 7
const SESSION_ID = 42
const STEP_ID = 9
const PAGE_OFFSET_TOP = 152.5
// Longer than the 300 ms throttle of the page's visibility directive.
const THROTTLE_WAIT_MS = 350

const elementsById = new Map()
const noop = () => {}

Object.assign(globalThis, {
    document: {
        documentElement: {getAttribute: () => 'light'},
        head: {appendChild: noop},
        createElement: () => ({}),
        getElementById: id => elementsById.get(id) ?? null,
    },
    window: {devicePixelRatio: 1},
    ResizeObserver: class {
        observe() {}
        disconnect() {}
    },
})
Object.defineProperty(globalThis, 'localStorage', {value: {getItem: () => null, setItem: noop}})

/** Evaluates the options object and the template of an SFC, replacing its imports with the given stubs. */
function loadComponent(path, stubs = {}) {
    const source = readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8')
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    const importPattern = /^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
    const names = [...script.matchAll(importPattern)].flatMap(([, clause]) =>
        clause.replace(/[{}]/g, '').split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
    const body = script.replace(importPattern, '').replace(/^import\s+['"][^'"]+['"];?[ \t]*$/gm, '')
        .replace('export default', 'return')
    const options = new Function(...names, body)(...names.map(name => stubs[name] ?? {}))
    return {...options, render: compile(source.match(/<template>([\s\S]*)<\/template>/)[1])}
}

/** Waits for promises, Vue's queues and the page's nextTick to finish. */
async function settle() {
    for (let i = 0; i < 5; i++) {
        await new Promise(setImmediate)
    }
}

/** Mounts the viewer for a PDF of the given length and waits until the document is open. Register `unmount` with t.after. */
async function openPdf({pageCount = 6, acceptStats = true, ObserveVisibility} = {}) {
    elementsById.clear()
    const state = reactive({acceptStats, hiddenStudyStepId: null})
    const stats = []
    const requestedPages = new Set()
    const observed = new Map()
    const pageFromElement = el => Number(el.id.split('-')[2])

    const PDFPage = loadComponent('components/annotator/pdfViewer/PDFPage.vue', {
        ObserveVisibility: ObserveVisibility ?? {
            beforeMount: (el, {value}) => observed.set(pageFromElement(el), value.callback),
        },
        Highlights: {methods: {removeAllHighlights: noop}, render: () => null},
        Loader: {render: () => null},
        Anchoring: class {},
        getCollapsedAnnotationIds: () => [],
        toRaw,
    })
    const PDFViewer = loadComponent('components/annotator/pdfViewer/PDFViewer.vue', {
        PDFPage,
        PDF,
        computed,
        debounce,
        Adder: {render: () => null},
        BasicLoading: {render: () => null},
        PDFToolbar: {render: () => null},
        pdfjsLib: {
            GlobalWorkerOptions: {},
            getDocument: () => ({
                promise: Promise.resolve({
                    numPages: pageCount,
                    // A page only has to be requested here, the pending promise stops before pdf.js paints.
                    getPage: page => {
                        requestedPages.add(page)
                        return new Promise(noop)
                    },
                }),
            }),
        },
    })

    // Unmounting a v-for walks the siblings up to its end anchor, so the renderer keeps a real tree.
    const remove = node => {
        node.parent?.children.splice(node.parent.children.indexOf(node), 1)
        node.parent = null
    }
    const {createApp} = createRenderer({
        patchProp: (el, key, _old, value) => {
            if (key === 'id') {
                el.id = value
                elementsById.set(value, el)
            }
        },
        insert: (node, parent, anchor) => {
            remove(node)
            parent.children ??= []
            parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node)
            node.parent = parent
        },
        remove,
        createElement: () => ({clientWidth: 800, offsetTop: PAGE_OFFSET_TOP, style: {}}),
        createText: () => ({}),
        createComment: () => ({}),
        setText: noop,
        setElementText: noop,
        parentNode: node => node.parent ?? null,
        nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
    })
    const app = createApp({
        provide: () => ({
            documentId: DOCUMENT_ID,
            studySessionId: SESSION_ID,
            studyStepId: STEP_ID,
            readOnly: false,
            acceptStats: computed(() => state.acceptStats),
            hiddenStudyStepId: computed(() => state.hiddenStudyStepId),
        }),
        render: () => h(PDFViewer),
    })
    app.config.warnHandler = noop
    Object.assign(app.config.globalProperties, {
        $store: {
            getters: {
                'settings/getValue': () => 'light',
                'table/annotation/getFiltered': () => [],
            },
        },
        $socket: {
            emit: (event, payload, callback) => {
                if (event === 'documentGet') {
                    callback({success: true, data: {file: new Uint8Array()}})
                } else if (event === 'stats') {
                    stats.push(structuredClone(payload))
                }
            },
        },
        $t: key => key,
        eventBus: {emit: noop},
    })
    app.mount({})
    await settle()

    return {
        state,
        stats,
        unmount: () => app.unmount(),
        requestedPages: () => [...requestedPages].sort((a, b) => a - b),
        rows: () => stats.map(({data}) => [data.visibility.pageNumber, data.visibility.isVisible]),
        /** Reports a page like the visibility directive does and lets the viewer react. */
        report: async (pageNumber, isVisible) => {
            observed.get(pageNumber)(isVisible)
            await settle()
        },
    }
}

test('logs a visible row for page 1 when the document opens', async t => {
    const {report, stats, unmount} = await openPdf()
    t.after(unmount)
    assert.deepEqual(stats, [])

    await report(1, true)

    assert.deepEqual(stats, [{
        action: 'pdfPageVisibilityChange',
        data: {
            documentId: DOCUMENT_ID,
            readOnly: false,
            visibility: {pageNumber: 1, isVisible: true, offset: PAGE_OFFSET_TOP - 52.5},
            studySessionId: SESSION_ID,
            studyStepId: STEP_ID,
        },
    }])
})

test('logs every page shown at load and no row for a page that was never visible', async t => {
    const {report, rows, unmount} = await openPdf()
    t.after(unmount)

    await report(1, true)
    await report(2, true)
    await report(3, false)
    await report(4, false)

    assert.deepEqual(rows(), [[1, true], [2, true]])
})

test('does not log page 1 as not visible before it was visible', async t => {
    const {report, rows, unmount} = await openPdf()
    t.after(unmount)

    await report(1, false)
    assert.deepEqual(rows(), [])

    await report(1, true)
    assert.deepEqual(rows(), [[1, true]])
})

test('ignores repeated callbacks with the same state', async t => {
    const {report, rows, unmount} = await openPdf()
    t.after(unmount)

    await report(1, true)
    await report(1, true)
    await report(2, true)
    await report(2, true)
    await report(1, false)
    await report(1, false)

    assert.deepEqual(rows(), [[1, true], [2, true], [1, false]])
})

test('logs page 1 leaving and returning in order', async t => {
    const {report, rows, unmount} = await openPdf()
    t.after(unmount)

    await report(1, true)
    await report(2, true)
    await report(1, false)
    await report(1, true)

    assert.deepEqual(rows(), [[1, true], [2, true], [1, false], [1, true]])
})

test('logs nothing without consent, and only later changes once consent is given', async t => {
    const {report, rows, state, stats, requestedPages, unmount} = await openPdf({acceptStats: false})
    t.after(unmount)

    await report(1, true)
    await report(2, true)
    await report(1, false)
    assert.deepEqual(stats, [])
    assert.ok(requestedPages().includes(1), 'pages still render without consent')

    state.acceptStats = true
    await report(2, true)
    assert.deepEqual(rows(), [], 'consent does not log a state from before it was given')

    await report(3, true)
    assert.deepEqual(rows(), [[3, true]])
})

test('renders the first pages before any page reports its visibility', async t => {
    const {requestedPages, unmount} = await openPdf()
    t.after(unmount)

    assert.deepEqual(requestedPages(), [1, 2, 3, 4])
})

test('keeps the render window around the visible pages after the first report', async t => {
    const {report, requestedPages, unmount} = await openPdf({pageCount: 12})
    t.after(unmount)

    await report(1, true)
    assert.deepEqual(requestedPages(), [1, 2, 3, 4])

    await report(8, true)
    await report(1, false)
    assert.deepEqual(requestedPages(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
})

test('logs the initial rows through the real visibility directive', async t => {
    const observers = []
    const previousObserver = globalThis.IntersectionObserver
    globalThis.IntersectionObserver = class {
        constructor(callback) {
            this.callback = callback
            observers.push(this)
        }
        observe() {}
        disconnect() {}
    }
    const {ObserveVisibility} = createRequire(import.meta.url)('vue3-observe-visibility')
    try {
        const {rows, unmount} = await openPdf({ObserveVisibility})
        t.after(unmount)
        assert.equal(observers.length, 6)

        // The browser reports each observed element once when observing starts.
        observers.forEach((observer, index) => {
            const isIntersecting = index < 2
            observer.callback([{isIntersecting, intersectionRatio: isIntersecting ? 1 : 0}])
        })
        // The directive holds hidden reports, and repeats visible ones, until its throttle ends.
        await wait(THROTTLE_WAIT_MS)
        await settle()

        assert.deepEqual(rows(), [[1, true], [2, true]])
    } finally {
        if (previousObserver === undefined) {
            delete globalThis.IntersectionObserver
        } else {
            globalThis.IntersectionObserver = previousObserver
        }
    }
})

test('preserves hidden-step and unmount visibility after the dev merge', async t => {
    const {report, rows, state, unmount} = await openPdf()
    t.after(unmount)
    await report(1, true)
    state.hiddenStudyStepId = STEP_ID
    await settle()
    assert.deepEqual(rows(), [[1, true], [1, false]])
    await report(2, true)
    assert.deepEqual(rows(), [[1, true], [1, false]], 'hidden viewer emits no observer stats')
    state.hiddenStudyStepId = null
    await settle()
    assert.deepEqual(rows(), [[1, true], [1, false], [1, true], [2, true]])
    unmount()
    assert.deepEqual(rows().slice(-2), [[1, false], [2, false]])
})

test('a fresh viewer logs page 1 again after remount', async () => {
    const first = await openPdf()
    await first.report(1, true)
    first.unmount()
    const second = await openPdf()
    try {
        await second.report(1, true)
        assert.deepEqual(second.rows(), [[1, true]])
    } finally {
        second.unmount()
    }
})
