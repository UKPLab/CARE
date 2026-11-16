/**
 * Scrollbar regression checks for BackendTable's All mode.
 * Uses the real component and Vue with a Happy DOM document. The socket returns
 * sample rows; layout measurements are supplied because Happy DOM has no layout.
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {afterEach, test} from 'node:test'
import {setTimeout as wait} from 'node:timers/promises'
import {Window} from 'happy-dom'
import deepEqual from 'deep-equal'
import * as layout from '../../src/basic/table/helpers/tableLayout.js'
import * as fixedColumns from '../../src/basic/table/helpers/tableFixedColumns.js'
import * as pipeline from '../../src/basic/table/helpers/tableDataPipeline.js'
import * as interactions from '../../src/basic/table/helpers/tableRowInteractions.js'
import {filterRowButtons} from '../../src/basic/table/helpers/tableCellHelpers.js'
import {matchesTokenList} from '../../src/basic/table/searchTokens.js'

const window = new Window()
Object.assign(globalThis, {
    window, document: window.document,
    Element: window.Element, HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement, Node: window.Node,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
})
const {compile, createApp, h, nextTick} = await import('vue')
const ROW_HEIGHT = 41
const VIEW_HEIGHT = 410
const studies = Array.from({length: 102}, (_, index) => ({id: index + 1, name: `Study ${index + 1}`}))
const cleanups = []

/** Loads the real SFC using the existing component-test approach and actual table helpers. */
function loadTable() {
    const source = readFileSync(new URL('../../src/basic/BackendTable.vue', import.meta.url), 'utf8')
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    const imports = /^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
    const names = [...script.matchAll(imports)].flatMap(([, clause]) =>
        clause.replace(/[{}]/g, '').split(',').map(name => name.trim()).filter(Boolean))
    const dependencies = {
        ...layout, ...fixedColumns, ...pipeline, ...interactions,
        deepEqual, filterRowButtons, matchesTokenList,
        resolveApiMessage: response => response?.message,
        TCell: {props: ['row', 'column'], render() { return h('span', String(this.row[this.column.key])) }},
        HeaderCell: {props: ['column'], render() { return h('th', this.column.key) }},
        TButtonGroup: {render: () => null},
        Pagination: {render: () => null},
        TableSearch: {render: () => null},
        Loader: {render: () => null},
    }
    const options = new Function(...names, script.replace(imports, '').replace('export default', 'return'))(
        ...names.map(name => dependencies[name]))
    return {...options, render: compile(source.match(/<template>([\s\S]*)<\/template>/)[1])}
}

const BackendTable = loadTable()

afterEach(async () => {
    while (cleanups.length) {
        cleanups.pop()()
    }
    await window.happyDOM.whenAsyncComplete()
    document.body.innerHTML = ''
})

/** Lets the window-seek debounce and queued Vue updates finish. */
async function settle() {
    // Includes the component's 100 ms window-seek debounce and queued Vue updates.
    await wait(180)
    await nextTick()
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
    await settle()
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
    await settle()
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
