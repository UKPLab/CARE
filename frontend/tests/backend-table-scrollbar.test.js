import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'

const source = readFileSync(new URL('../src/basic/BackendTable.vue', import.meta.url), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
const importPattern = /^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
const names = [...script.matchAll(importPattern)].flatMap(([, clause]) =>
    clause.replace(/[{}]/g, '').split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
const component = new Function(...names, script.replace(importPattern, '').replace('export default', 'return'))(
    ...names.map(() => ({})))

test('clicking the scrollbar track commits its target row immediately', () => {
    const seekTargets = []
    const thumb = {contains: target => target === thumb}
    const track = {
        getBoundingClientRect: () => ({top: 100, height: 100}),
        querySelector: () => thumb,
    }
    const wrapper = {scrollTop: 50}
    const context = {
        $refs: {infiniteScrollbar: track, tableWrapper: wrapper},
        infiniteThumbHeight: 20,
        viewportHeight: 200,
        effectiveRowHeight: 20,
        total: 100,
        rowsBefore: 0,
        loadedCount: 10,
        rowIndexForFraction: component.methods.rowIndexForFraction,
        previewThumb: component.methods.previewThumb,
        commitThumbFraction: component.methods.commitThumbFraction,
        scheduleWindowSeek: target => seekTargets.push(target),
    }

    component.methods.onInfiniteScrollbarDown.call(context, {clientY: 150, target: track})

    assert.deepEqual(seekTargets, [45])
    assert.equal(context._thumbFraction, null)
    assert.equal(context._windowHold, true)
    assert.equal(wrapper.scrollTop, 0)
})

test('thumb preview scrolls loaded rows with the pointer', () => {
    const scrollTargets = []
    let updates = 0
    const context = {
        $refs: {tableWrapper: {scrollTop: 0}},
        viewportHeight: 200,
        effectiveRowHeight: 20,
        total: 100,
        rowsBefore: 0,
        loadedCount: 100,
        isInfiniteMode: true,
        rowIndexForFraction: component.methods.rowIndexForFraction,
        scrollToRowIndex: target => scrollTargets.push(target),
        scheduleVirtualUpdate: () => { updates += 1 },
    }

    component.methods.previewThumb.call(context, 40, 80)

    assert.deepEqual(scrollTargets, [45])
    assert.equal(updates, 1)
    assert.equal(context.visibleFirstRow, 45)
    assert.equal(component.computed.thumbAwaitingRows.call(context), false)
})

test('thumb preview seeks unloaded rows while dragging', () => {
    const seekTargets = []
    const context = {
        $refs: {tableWrapper: {scrollTop: 0}},
        viewportHeight: 200,
        effectiveRowHeight: 20,
        total: 100,
        rowsBefore: 0,
        loadedCount: 10,
        _thumbDrag: {},
        rowIndexForFraction: component.methods.rowIndexForFraction,
        scheduleWindowSeek: target => seekTargets.push(target),
    }

    component.methods.previewThumb.call(context, 40, 80)

    assert.deepEqual(seekTargets, [45])
    assert.equal(context.visibleFirstRow, 45)
})

test('scheduled thumb seek uses the latest dragged-to row', async () => {
    const seekTargets = []
    const context = {
        _pinnedRow: 45,
        rowsBefore: 0,
        loadedCount: 10,
        _windowFetchBusy: false,
        seekWindow: target => seekTargets.push(target),
    }

    component.methods.scheduleWindowSeek.call(context, 45)
    context._pinnedRow = 60
    await new Promise(resolve => setTimeout(resolve, 150))

    assert.deepEqual(seekTargets, [60])
})

test('scheduled seek scrolls instead of fetching when its target is now loaded', async () => {
    const scrollTargets = []
    let updates = 0
    const context = {
        _pinnedRow: 45,
        rowsBefore: 0,
        loadedCount: 100,
        _windowFetchBusy: false,
        _windowHold: true,
        _thumbDrag: null,
        scrollToRowIndex: target => scrollTargets.push(target),
        scheduleVirtualUpdate: () => { updates += 1 },
        seekWindow: () => assert.fail('loaded target should not fetch'),
    }

    component.methods.scheduleWindowSeek.call(context, 45)
    await new Promise(resolve => setTimeout(resolve, 150))

    assert.deepEqual(scrollTargets, [45])
    assert.equal(updates, 1)
    assert.equal(context._pinnedRow, null)
    assert.equal(context._windowHold, false)
})

test('scrolling to the current row does not suppress the next user scroll', () => {
    const context = {
        $refs: {tableWrapper: {scrollTop: 0}},
        total: 100,
        effectiveRowHeight: 20,
        _suppressScroll: false,
    }

    component.methods.scrollToRowIndex.call(context, 0)
    assert.equal(context._suppressScroll, false)

    component.methods.scrollToRowIndex.call(context, 2)
    assert.equal(context._suppressScroll, true)
    assert.equal(context.$refs.tableWrapper.scrollTop, 40)
})
