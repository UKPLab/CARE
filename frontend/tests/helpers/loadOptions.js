import {readFileSync} from 'node:fs'

/**
 * Evaluates the options object of an SFC, replacing its imports with the given stubs.
 *
 * @param {string} path Path of the SFC below `frontend/src`
 * @param {Object} [stubs] Values for the imported names; other imports become empty objects
 * @returns {Object} The options object of the component
 */
export function loadOptions(path, stubs = {}) {
    const source = readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8')
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    const importPattern = /^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?[ \t]*$/gm
    const names = [...script.matchAll(importPattern)].flatMap(([, clause]) =>
        clause.replace(/[{}]/g, '').split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
    const body = script.replace(importPattern, '').replace('export default', 'return')
    return new Function(...names, body)(...names.map(name => stubs[name] ?? {}))
}
