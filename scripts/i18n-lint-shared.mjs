/**
 * Shared helpers for the i18n checkers in frontend/scripts and backend/scripts.
 * 
 * @author Andrii Nikitin
 */

import fs from 'node:fs'
import path from 'node:path'

/** Namespaces that appear as the first segment of real keys; filled by loadCatalogKeys. */
export const KNOWN_NAMESPACES = new Set()

export function flattenObject(obj, prefix = '', out = {}) {
    for (const key of Object.keys(obj)) {
        const value = obj[key]
        const newKey = prefix ? `${prefix}.${key}` : key
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flattenObject(value, newKey, out)
        } else {
            out[newKey] = value
        }
    }
    return out
}

/** Flatten every `<namespace>.json` in `enDir` into one `key -> message` map. */
export function loadCatalogKeys(enDir) {
    const flat = {}
    for (const file of fs.readdirSync(enDir)) {
        if (!file.endsWith('.json')) continue
        const ns = path.basename(file, '.json')
        KNOWN_NAMESPACES.add(ns)
        const data = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'))
        flattenObject(data, ns, flat)
    }
    return flat
}

export function catalogHasKey(catalog, key) {
    return Object.prototype.hasOwnProperty.call(catalog, key)
}

/**
 * Build the file list for i18n scanning: walk a directory tree and keep only
 * matching extensions (e.g. `.vue`, `.js`)
 */
export function walkFiles(dir, { extensions, skipDirNames = new Set(), out = [] } = {}) {
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (skipDirNames.has(entry.name)) continue
            walkFiles(full, { extensions, skipDirNames, out })
            continue
        }
        if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full)
    }
    return out
}

/** Line number in the file where a match starts — used in messages like `Foo.vue:42`. */
export function lineAt(source, index) {
    return source.slice(0, index).split('\n').length
}

/** Silences findings on the line it appears on, in any comment syntax (JS or HTML). */
export const IGNORE_MARKER = 'i18n-lint-ignore'

/**
 * Build an `isIgnoredLine(filePath, line)` predicate, so a deliberate exception
 * is a grep-able marker in the source instead of an edit to the checker.
 *
 * Both checkers count how many findings this filter actually silences and print
 * `ignored=N` in their summary (markers on clean lines do not count). Grep the
 * marker separately if you want every annotation, not only effective suppressions.
 */
export function createLineIgnoreFilter() {
    const cache = new Map()
    return function isIgnoredLine(filePath, line) {
        if (!cache.has(filePath)) {
            const lines = new Set()
            let raw = ''
            try {
                raw = fs.readFileSync(filePath, 'utf8')
            } catch {
                raw = ''
            }
            if (raw.includes(IGNORE_MARKER)) {
                raw.split('\n').forEach((text, index) => {
                    if (text.includes(IGNORE_MARKER)) lines.add(index + 1)
                })
            }
            cache.set(filePath, lines)
        }
        return cache.get(filePath).has(line)
    }
}

/** Keywords after which `/` opens a regex literal instead of being division. */
const REGEX_ALLOWED_KEYWORDS = new Set([
    'return',
    'typeof',
    'instanceof',
    'in',
    'of',
    'case',
    'delete',
    'void',
    'new',
    'throw',
    'do',
    'else',
    'yield',
    'await',
])

/**
 * True when `/` at `i` starts a regex literal rather than division / HTML (`</tag>`).
 * Needed so quotes inside `/"/g` do not derail the string walker for the rest of the file.
 */
export function isRegexLiteralStart(source, i) {
    let k = i - 1
    while (k >= 0 && /[ \t\n\r]/.test(source[k])) k -= 1
    if (k < 0) return true
    const prev = source[k]
    if (prev === '<') return false
    if (/[\w$)'"`\]]/.test(prev)) {
        // `return /re/` and friends: an identifier can still be a keyword.
        if (!/\w/.test(prev)) return false
        let start = k
        while (start >= 0 && /[\w$]/.test(source[start])) start -= 1
        return REGEX_ALLOWED_KEYWORDS.has(source.slice(start + 1, k + 1))
    }
    return true
}

/** Index just past the string/template literal that starts at `i`. */
function skipStringLiteral(source, i) {
    const q = source[i]
    let j = i + 1
    while (j < source.length) {
        const c = source[j]
        if (c === '\\') {
            j += 2
            continue
        }
        if (c === q) return j + 1
        if (q === '`' && c === '$' && source[j + 1] === '{') {
            let depth = 1
            j += 2
            while (j < source.length && depth > 0) {
                if (source[j] === '"' || source[j] === "'" || source[j] === '`') {
                    j = skipStringLiteral(source, j)
                    continue
                }
                if (source[j] === '{') depth += 1
                else if (source[j] === '}') depth -= 1
                j += 1
            }
            continue
        }
        j += 1
    }
    return j
}

/**
 * Walk source: drop comments, keep code. Optionally collect string/template contents
 * (handles empty "" and escapes — unlike a naive [^'"`]+ regex).
 * Also skips JS regex literals so e.g. `.replace(/"/g, …)` does not swallow the file.
 */
export function walkSource(source, { onString } = {}) {
    let out = ''
    let i = 0
    // Comments are dropped but their newlines are kept, so reported line numbers
    // still match the original file.
    const dropComment = (endIndex) => {
        out += source.slice(i, endIndex).replace(/[^\n]/g, '')
        i = endIndex
    }
    while (i < source.length) {
        if (source.startsWith('<!--', i)) {
            const end = source.indexOf('-->', i + 4)
            dropComment(end === -1 ? source.length : end + 3)
            continue
        }
        if (source.startsWith('/*', i)) {
            const end = source.indexOf('*/', i + 2)
            dropComment(end === -1 ? source.length : end + 2)
            continue
        }
        // `://` is a bare URL in template text, not a comment.
        if (source.startsWith('//', i) && source[i - 1] !== ':') {
            const end = source.indexOf('\n', i)
            dropComment(end === -1 ? source.length : end)
            continue
        }
        if (source[i] === '/' && !source.startsWith('/*', i) && isRegexLiteralStart(source, i)) {
            let j = i + 1
            let inClass = false
            while (j < source.length) {
                const c = source[j]
                if (c === '\\') {
                    j += 2
                    continue
                }
                if (c === '\n') break
                if (inClass) {
                    if (c === ']') inClass = false
                    j += 1
                    continue
                }
                if (c === '[') {
                    inClass = true
                    j += 1
                    continue
                }
                if (c === '/') {
                    j += 1
                    break
                }
                j += 1
            }
            while (j < source.length && /[gimsuyvd]/.test(source[j])) j += 1
            out += source.slice(i, j)
            i = j
            continue
        }
        const q = source[i]
        if (q === '"' || q === "'" || q === '`') {
            let j = i + 1
            let value = ''
            let dynamic = false
            while (j < source.length) {
                if (source[j] === '\\') {
                    value += source.slice(j, j + 2)
                    j += 2
                    continue
                }
                if (source[j] === q) {
                    j += 1
                    break
                }
                if (q === '`' && source[j] === '$' && source[j + 1] === '{') {
                    dynamic = true
                    value += '${'
                    let depth = 1
                    j += 2
                    while (j < source.length && depth > 0) {
                        if (source[j] === '{') depth += 1
                        else if (source[j] === '}') depth -= 1
                        if (depth > 0) value += source[j]
                        j += 1
                    }
                    value += '}'
                    continue
                }
                value += source[j]
                j += 1
            }
            if (onString) onString(value, dynamic)
            out += source.slice(i, j)
            i = j
            continue
        }
        out += source[i]
        i += 1
    }
    return out
}

export function stripComments(source) {
    return walkSource(source)
}

/**
 * Split the arguments of the call whose `(` sits at `openParenIndex`.
 * Quote- and nesting-aware, so `generateError(getCode(a, b), 'key')` still
 * yields `'key'` as the second argument.
 *
 * @returns {{ args: {text: string, start: number}[], end: number }} end = index past `)`
 */
export function parseCallArgs(source, openParenIndex) {
    const args = []
    let depth = 0
    let argStart = openParenIndex + 1
    let i = openParenIndex
    while (i < source.length) {
        const c = source[i]
        if (c === '"' || c === "'" || c === '`') {
            i = skipStringLiteral(source, i)
            continue
        }
        if (c === '(' || c === '[' || c === '{') {
            depth += 1
            i += 1
            continue
        }
        if (c === ')' || c === ']' || c === '}') {
            depth -= 1
            if (depth === 0) {
                const text = source.slice(argStart, i)
                if (text.trim() || args.length > 0) args.push({ text, start: argStart })
                return { args, end: i + 1 }
            }
            i += 1
            continue
        }
        if (c === ',' && depth === 1) {
            args.push({ text: source.slice(argStart, i), start: argStart })
            argStart = i + 1
            i += 1
            continue
        }
        i += 1
    }
    return { args, end: source.length }
}

/** Content of `arg` when it is a single plain string literal, else null. */
export function stringLiteralValue(arg) {
    if (!arg) return null
    const text = arg.text.trim()
    const q = text[0]
    if (q !== '"' && q !== "'" && q !== '`') return null
    if (skipStringLiteral(text, 0) !== text.length) return null
    return text.slice(1, -1)
}

/**
 * Find calls of `calleeRe` (must be global) and return the requested argument
 * when it is a plain string literal.
 *
 * @returns {{ index: number, end: number, value: string }[]}
 */
export function findCallStringArgs(source, calleeRe, argIndex = 0) {
    const found = []
    let m
    while ((m = calleeRe.exec(source)) !== null) {
        let open = m.index + m[0].length
        while (open < source.length && /\s/.test(source[open])) open += 1
        if (source[open] !== '(') continue
        const { args, end } = parseCallArgs(source, open)
        const value = stringLiteralValue(args[argIndex])
        if (value === null) continue
        found.push({ index: m.index, end, value, callee: m[0] })
    }
    return found
}

export function looksLikeKey(str) {
    if (!str || typeof str !== 'string') return false
    if (str.includes('${')) return false
    if (!/^[a-zA-Z][\w-]*(\.[\w-]+)+$/.test(str)) return false
    return KNOWN_NAMESPACES.has(str.split('.')[0])
}

/** Placeholders / punctuation that are not user-facing copy. */
const IGNORE_RAW_LITERALS = new Set(['-', '–', '—', '•', '·', '#', '{ }', '{}'])

/**
 * Guess whether a string literal is user-facing English that should use i18n.
 *
 * Pass `propName` when checking object props (`label`, `title`, …).
 */
export function looksLikeEnglish(str, { propName } = {}) {
    if (!str || typeof str !== 'string') return false
    const trimmed = str.trim()
    if (!trimmed || IGNORE_RAW_LITERALS.has(trimmed)) return false
    if (trimmed.length < 2) return false
    if (trimmed.includes('${')) return true
    if (looksLikeKey(trimmed)) return false
    if (/^[a-z][a-zA-Z0-9_]*$/.test(trimmed)) {
        const isIdentifierSpelling = !/^[a-z]+$/.test(trimmed)
        if (isIdentifierSpelling) return false
        return trimmed !== propName
    }
    if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) return false
    if (/^https?:\/\//.test(trimmed)) return false
    // Digits / punctuation only (incl. hyphen) — e.g. table empty cell "-".
    if (/^[\d\s./\\:+#()&%|,;!?"'~*_`{}\-]+$/.test(trimmed)) return false
    if (!/[A-Za-z]/.test(trimmed)) return false
    if (/\s/.test(trimmed)) return true
    if (/^[A-Z][a-z]+/.test(trimmed) && trimmed.length >= 3) return true
    return false
}
