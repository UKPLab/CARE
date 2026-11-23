/**
 * Scrollbar regression checks for BackendTable's All mode.
 * Mounts the real controller, rendered table parts and helpers with Vue and Happy DOM.
 * The socket returns sample rows; layout measurements are supplied because Happy DOM has no layout.
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {afterEach, test} from 'node:test'
import {setTimeout as wait} from 'node:timers/promises'
import {Window} from 'happy-dom'
import deepEqual from 'deep-equal'
import debounce from 'lodash.debounce'

const window = new Window()
Object.assign(globalThis, {
    window, document: window.document,
    Element: window.Element, HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement, Node: window.Node,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
})
const vueRuntime = await import('vue')
const {compile, createApp, h, nextTick} = vueRuntime
const ROW_HEIGHT = 41
const VIEW_HEIGHT = 410
const studies = Array.from({length: 102}, (_, index) => ({id: index + 1, name: `Study ${index + 1}`}))
const cleanups = []

// Keep unrelated leaf views/services small; scrolling and virtualization run their real code.
const stubs = {
    deepEqual, debounce,
    resolveApiMessage: response => response?.message,
    TCell: {props: ['row', 'column'], render() { return h('span', String(this.row[this.column.key])) }},
    HeaderCell: {props: ['column'], render() { return h('th', this.column.key) }},
    TButtonGroup: {render: () => null},
    Pagination: {render: () => null},
    TableSearch: {render: () => null},
    Loader: {render: () => null},
}
const modules = new Map()

/** Follows real Vue parts and JS helpers, resolving Vite's @/ alias inside this test loader. */
function loadModule(url) {
    if (modules.has(url.href)) return modules.get(url.href)
    const source = readFileSync(url, 'utf8')
    const script = url.pathname.endsWith('.vue') ? source.match(/<script>([\s\S]*?)<\/script>/)[1] : source
    const imports = /^import\s+([^'"]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm
    const names = [], values = []
    for (const [, clause, specifier] of script.matchAll(imports)) {
        const bindings = clause.replace(/[{}]/g, '').split(',').map(item => item.trim()).filter(Boolean)
        let dependency
        if (!bindings.every(item => item.split(/\s+as\s+/).at(-1) in stubs)) {
            if (specifier === 'vue') dependency = vueRuntime
            else if (specifier.startsWith('@/')) {
                dependency = loadModule(new URL(`../../src/${specifier.slice(2)}`, import.meta.url))
            } else if (specifier.startsWith('.')) dependency = loadModule(new URL(specifier, url))
            else throw new Error(`Unsupported test dependency: ${specifier}`)
        }
        for (const item of bindings) {
            const [exported, local = exported] = item.split(/\s+as\s+/)
            const value = stubs[local] ?? dependency?.[clause.includes('{') ? exported : 'default']
            assert.notEqual(value, undefined, `${specifier} provides ${exported}`)
            names.push(local)
            values.push(value)
        }
    }
    const exports = [...script.matchAll(/export\s+(?:const|let|function)\s+(\w+)/g)].map(match => match[1])
    const body = script.replace(imports, '').replace(/export default/, 'const defaultExport =')
        .replace(/export (?=(?:const|let|function)\b)/g, '')
    const result = new Function(...names,
        `${body}\nreturn {${exports.join(',')}${exports.length ? ',' : ''} default: typeof defaultExport === 'undefined' ? undefined : defaultExport};`)(...values)
    const template = source.match(/<template>([\s\S]*)<\/template>/)
    if (result.default && template) result.default.render = compile(template[1])
    modules.set(url.href, result)
    return result
}

const BackendTable = loadModule(new URL('../../src/basic/BackendTable.vue', import.meta.url)).default

afterEach(async () => {
    while (cleanups.length) {
        cleanups.pop()()
    }
    await window.happyDOM.whenAsyncComplete()
    document.body.innerHTML = ''
})

/** Waits for loaded rows and pending seek/fetch/render work, failing if the table stays busy. */
async function settle(vm) {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
        await nextTick()
        if (vm.loadedCount > 0 && vm.viewportHeight > 0
            && !vm.queryLoading && !vm.seekTimer && !vm.windowFetchBusy
            && !vm.windowHold && !vm.scrollRaf) {
            return
        }
        await wait(5)
    }
    assert.fail('Timed out waiting for the table to finish loading and rendering')
}

/** Mounts the real table with deterministic sample rows and browser-like dimensions. */
async function mountTable() {
    const queries = []
    function response(payload) {
        queries.push(payload.query)
        const offset = payload.query.after != null ? Number(payload.query.after)
            : payload.query.before != null ? Math.max(0, Number(payload.query.before) - payload.query.limit)
                : payload.query.offset || 0
        const items = studies.slice(offset, offset + payload.query.limit)
        return {success: true, data: {items, meta: {
            total: studies.length, offset, pageSize: payload.query.limit,
            startCursor: String(offset), endCursor: String(offset + items.length),
            hasPrev: offset > 0, hasNext: offset + items.length < studies.length,
        }}}
    }
    const socket = {
        connected: true, on() {}, off() {},
        emit(event, payload, callback) {
            if (event === 'queryTable') {
                queueMicrotask(() => callback(response(payload)))
            }
        },
        timeout() {
            return {emit(event, payload, callback) {
                queueMicrotask(() => callback(null, response(payload)))
            }}
        },
    }
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(BackendTable, {
        table: 'study', columns: [{key: 'name'}],
        options: {pagination: {itemsPerPage: 0}},
    })
    const errors = []
    app.config.warnHandler = () => {}
    app.config.errorHandler = error => errors.push(error)
    Object.assign(app.config.globalProperties, {
        $socket: socket, $t: key => key, eventBus: {emit() {}},
    })
    cleanups.push(() => app.unmount())
    const vm = app.mount(host)
    const wrapper = host.querySelector('.table-wrapper')
    Object.defineProperties(wrapper, {
        clientHeight: {get: () => VIEW_HEIGHT},
        scrollHeight: {get: () => {
            const rows = [...wrapper.querySelectorAll('tbody tr')]
            return ROW_HEIGHT + rows.reduce((height, row) => height +
                (row.hasAttribute('data-row') ? ROW_HEIGHT : parseFloat(row.firstElementChild.style.height) || 0), 0)
        }},
        // A real browser clamps scrollTop when virtual spacers shrink the content.
        scrollTop: {
            get() { return Math.min(this.fixtureScrollTop || 0, Math.max(0, this.scrollHeight - VIEW_HEIGHT)) },
            set(value) { this.fixtureScrollTop = Math.max(0, Math.min(value, this.scrollHeight - VIEW_HEIGHT)) },
        },
    })
    await settle(vm)
    assert.deepEqual(errors, [], 'component mounts without runtime errors')
    const track = host.querySelector('[role="scrollbar"]')
    assert.ok(track, 'All mode displays the scrollbar')
    track.getBoundingClientRect = () => ({top: 0, height: VIEW_HEIGHT})
    return {vm, host, wrapper, track, queries, errors}
}

/** Drags the public scrollbar and releases after Vue has rendered its preview.
 * @param {Object} table Mounted table fixture.
 * @param {number} fraction Position on the scrollbar, from 0 to 1.
 */
async function dragTo(table, fraction) {
    const thumbHeight = parseFloat(table.track.firstElementChild.style.height)
    const maxTop = VIEW_HEIGHT - thumbHeight
    table.track.dispatchEvent(new window.MouseEvent('mousedown', {clientY: thumbHeight / 2, bubbles: true}))
    window.dispatchEvent(new window.MouseEvent('mousemove', {clientY: thumbHeight / 2 + fraction * maxTop}))
    // The browser paints the drag preview before the user releases the button.
    await nextTick()
    window.dispatchEvent(new window.MouseEvent('mouseup'))
    await settle(table.vm)
    assert.deepEqual(table.errors, [], 'dragging causes no component errors')
}

test('releasing the All-mode scrollbar keeps the destination study rows', async () => {
    const table = await mountTable()
    await dragTo(table, 0.75)
    const firstVisibleIndex = Math.floor(table.wrapper.scrollTop / ROW_HEIGHT)
    assert.equal(firstVisibleIndex, 69, 'the viewport stays at the selected row instead of jumping back')
    assert.ok(table.host.textContent.includes('Study 70'), 'the selected study is rendered')
    assert.ok(table.queries.some(query => query.limit === 150), 'an unloaded destination requests its rows')
})

test('releasing the scrollbar at an already loaded study keeps that position', async () => {
    const table = await mountTable()
    await dragTo(table, 0.25)
    assert.equal(Math.floor(table.wrapper.scrollTop / ROW_HEIGHT), 23,
        'the viewport stays at Study 24 after releasing the thumb')
    assert.ok(table.host.textContent.includes('Study 24'), 'the selected study is rendered')
})

test('dragging down and back up keeps the newly selected study rows', async () => {
    const table = await mountTable()
    await dragTo(table, 0.75)
    await dragTo(table, 0.25)
    assert.equal(Math.floor(table.wrapper.scrollTop / ROW_HEIGHT), 23,
        'dragging back up stays at Study 24')
    assert.ok(table.host.textContent.includes('Study 24'), 'the selected study is rendered')
})
