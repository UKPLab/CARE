#!/usr/bin/env node
/**
 * Backend i18n checker.
 *
 * User-facing throws use TranslatableError (or generateError for code + key):
 *   - new TranslatableError('key' | 'English…') — key must exist; English → hardcoded
 *   - generateError(code, 'key' | 'English…') — same for the message arg
 *   - hasKey('key') / translateMaybeKey('key') — key must exist
 *
 * Plain `new Error('…')` is internal control flow:
 *   - i18n-looking key → error (use TranslatableError for user-facing, or a
 *     non-key message if truly internal)
 *   - English / other non-key text → OK (not scanned as hardcoded)
 *   - `new Error("…").stack` tracers ignored
 *
 * Also checks db model field UI strings (`label`, `placeholder`, `title`, option
 * `name`): must be catalog keys (or non-copy placeholders like "#"), not English.
 *
 * Migrations: keys-only — if a UI prop or API string literal looks like an i18n
 * key, verify it exists in the EN catalog. No hardcoded-English checks.
 * Setting `key:` values are not checked. Plain Error-with-key still flagged.
 *
 * Setup wizard (backend wizard_* models) is skipped entirely.
 * CLI under backend/scripts/ is skipped.
 *
 * Unused catalog keys are covered by frontend/scripts/check-i18n-keys.mjs
 * (FE + BE usage scan).
 *
 * Keep helpers (walkSource / looksLikeKey) in sync with
 * frontend/scripts/check-i18n-keys.mjs where practical.
 *
 * Catalogs: utils/modules/i18n/en/*.json (basename = namespace).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..')
const EN_DIR = path.join(REPO_ROOT, 'utils/modules/i18n/en')
const MODELS_DIR = path.join(BACKEND_ROOT, 'db', 'models')
const MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'db', 'migrations')

const USAGE_SKIP_DIR_NAMES = new Set([
    'node_modules',
    'dist',
    'build',
    'coverage',
    'tests',
    'scripts', // CLI only; not Socket/HTTP user-facing
])

/** Skip setup-wizard backend sources entirely (mirrors FE SetupWizard ignore). */
const WIZARD_IGNORE_PARTS = [
    `${path.sep}db${path.sep}models${path.sep}wizard_`,
    `${path.sep}components${path.sep}wizard${path.sep}`,
    `${path.sep}auth${path.sep}SetupWizard`,
]

/** UI props checked for missing keys when value looks like an i18n key. */
const UI_KEY_PROPS = ['label', 'placeholder', 'title', 'message', 'text', 'name']

/**
 * Props that must not be leftover English in db models (field labels / placeholders).
 * Option `name` is key-only: English locale labels like "Deutsch" are left alone;
 * when `name` is already a dotted key it must exist in the catalog.
 */
const UI_REQUIRE_KEY_PROPS = new Set(['label', 'placeholder', 'title', 'message', 'text'])

const KNOWN_NAMESPACES = new Set()

function flattenObject(obj, prefix = '', out = {}) {
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

function loadCatalogKeys() {
    const flat = {}
    for (const file of fs.readdirSync(EN_DIR)) {
        if (!file.endsWith('.json')) continue
        const ns = path.basename(file, '.json')
        KNOWN_NAMESPACES.add(ns)
        const data = JSON.parse(fs.readFileSync(path.join(EN_DIR, file), 'utf8'))
        flattenObject(data, ns, flat)
    }
    return flat
}

function walkFiles(dir, { extensions, out = [] } = {}) {
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (USAGE_SKIP_DIR_NAMES.has(entry.name)) continue
            walkFiles(full, { extensions, out })
            continue
        }
        if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full)
    }
    return out
}

function isWizardIgnored(filePath) {
    return WIZARD_IGNORE_PARTS.some((part) => filePath.includes(part))
}

function isUnder(dir, filePath) {
    const rel = path.relative(dir, filePath)
    return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * True when `/` at `i` starts a regex literal rather than division / HTML (`</tag>`).
 * Needed so quotes inside `/"/g` do not derail the string walker for the rest of the file.
 */
function isRegexLiteralStart(source, i) {
    let k = i - 1
    while (k >= 0 && /[ \t\n\r]/.test(source[k])) k -= 1
    if (k < 0) return true
    const prev = source[k]
    if (prev === '<') return false
    if (/[\w$)'"`\]]/.test(prev)) return false
    return true
}

/**
 * Walk source: drop comments. Optionally collect string/template contents.
 * Also skips JS regex literals so e.g. `.replace(/"/g, …)` does not swallow the file.
 */
function walkSource(source, { onString } = {}) {
    let out = ''
    let i = 0
    while (i < source.length) {
        if (source.startsWith('/*', i)) {
            const end = source.indexOf('*/', i + 2)
            i = end === -1 ? source.length : end + 2
            continue
        }
        if (source.startsWith('//', i)) {
            const end = source.indexOf('\n', i)
            i = end === -1 ? source.length : end
            continue
        }
        if (
            source[i] === '/' &&
            !source.startsWith('//', i) &&
            !source.startsWith('/*', i) &&
            isRegexLiteralStart(source, i)
        ) {
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

function stripComments(source) {
    return walkSource(source)
}

function lineAt(source, index) {
    return source.slice(0, index).split('\n').length
}

function looksLikeKey(str) {
    if (!str || typeof str !== 'string') return false
    if (str.includes('${')) return false
    if (!/^[a-zA-Z][\w-]*(\.[\w-]+)+$/.test(str)) return false
    const ns = str.split('.')[0]
    return KNOWN_NAMESPACES.has(ns)
}

const IGNORE_RAW_LITERALS = new Set(['-', '–', '—', '•', '·', '#', '{ }', '0', '{}'])

function looksLikeEnglish(str) {
    if (!str || typeof str !== 'string') return false
    const trimmed = str.trim()
    if (!trimmed || IGNORE_RAW_LITERALS.has(trimmed)) return false
    if (trimmed.length < 2) return false
    if (trimmed.includes('${')) return true
    if (looksLikeKey(trimmed)) return false
    if (/^[a-z][a-zA-Z0-9_]*$/.test(trimmed)) return false
    if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) return false
    if (/^https?:\/\//.test(trimmed)) return false
    if (/^[\d\s./\\:+#()&%|,;!?"'~*_`{}\-]+$/.test(trimmed)) return false
    if (!/[A-Za-z]/.test(trimmed)) return false
    if (/\s/.test(trimmed)) return true
    if (/^[A-Z][a-z]+/.test(trimmed) && trimmed.length >= 3) return true
    return false
}

const findings = []

function report(file, line, message) {
    const rel = path.relative(REPO_ROOT, file)
    findings.push({ file: rel, line, message })
}

/**
 * Validate a string argument from a user-facing i18n API.
 * @param {string} apiLabel short name for messages (e.g. TranslatableError)
 * @param {{ keysOnly?: boolean }} [opts] keysOnly: only missing-key (migrations)
 */
function checkApiString(filePath, source, index, value, apiLabel, catalog, opts = {}) {
    if (!value || value.includes('${')) return
    if (looksLikeKey(value)) {
        if (!Object.prototype.hasOwnProperty.call(catalog, value)) {
            report(
                filePath,
                lineAt(source, index),
                `missing i18n key in ${apiLabel}: ${value}`
            )
        }
        return
    }
    if (opts.keysOnly) return
    if (looksLikeEnglish(value)) {
        report(
            filePath,
            lineAt(source, index),
            `hardcoded ${apiLabel} (use i18n key): ${JSON.stringify(value)}`
        )
    }
}

/**
 * Scan `label:` / `placeholder:` / … string props.
 * @param {{ requireKeys: boolean }} opts
 *   requireKeys=true (models): English on label/placeholder/… → hardcoded; key → must exist
 *   requireKeys=false (migrations): English ignored; key → must exist
 */
function checkUiStringProps(filePath, source, catalog, { requireKeys }) {
    const propAlt = UI_KEY_PROPS.join('|')
    const re = new RegExp(`\\b(${propAlt})\\s*:\\s*(['\`"])([^'\`"]+)\\2`, 'g')
    let m
    while ((m = re.exec(source)) !== null) {
        const prop = m[1]
        const value = m[3]
        if (!value || value.includes('${')) continue

        if (looksLikeKey(value)) {
            if (!Object.prototype.hasOwnProperty.call(catalog, value)) {
                report(
                    filePath,
                    lineAt(source, m.index),
                    `missing i18n key in ${prop}: ${value}`
                )
            }
            continue
        }

        if (
            requireKeys &&
            UI_REQUIRE_KEY_PROPS.has(prop) &&
            looksLikeEnglish(value)
        ) {
            report(
                filePath,
                lineAt(source, m.index),
                `hardcoded ${prop} (use i18n key): ${JSON.stringify(value)}`
            )
        }
    }
}

/** True when `new Error("…")` is only used to capture `.stack` (not thrown/returned). */
function isErrorStackTracer(source, matchEndIndex) {
    return /^\s*\)\s*\.stack\b/.test(source.slice(matchEndIndex))
}

/**
 * @param {{ keysOnly?: boolean }} [opts]
 *   keysOnly (migrations): TranslatableError/generateError/helpers — missing-key
 *   only; no hardcoded-English. Plain Error-with-key still flagged always.
 */
function checkApiCalls(filePath, source, catalog, opts = {}) {
    const teRe =
        /new\s+TranslatableError\s*\(\s*(['"`])([^'"`]*?)\1/g
    let m
    while ((m = teRe.exec(source)) !== null) {
        checkApiString(filePath, source, m.index, m[2], 'TranslatableError', catalog, opts)
    }

    const geRe =
        /\bgenerateError\s*\(\s*(?:[^'"`,()\n]+|(['"`])[^'"`]*\1)\s*,\s*(['"`])([^'"`]*?)\2/g
    while ((m = geRe.exec(source)) !== null) {
        checkApiString(filePath, source, m.index, m[3], 'generateError', catalog, opts)
    }

    // Plain Error is internal. Keys belong on TranslatableError / generateError.
    const errRe = /\bnew\s+Error\s*\(\s*(['"`])([^'"`]*?)\1/g
    while ((m = errRe.exec(source)) !== null) {
        if (isErrorStackTracer(source, m.index + m[0].length)) continue
        const value = m[2]
        if (!value || value.includes('${')) continue
        if (looksLikeKey(value)) {
            report(
                filePath,
                lineAt(source, m.index),
                `Error with i18n key (use TranslatableError for user-facing, or a non-key message for internal): ${value}`
            )
        }
    }

    const helperRe =
        /\b(?:hasKey|translateMaybeKey)\s*\(\s*(['"`])([^'"`]*?)\1/g
    while ((m = helperRe.exec(source)) !== null) {
        const name = /hasKey|translateMaybeKey/.exec(m[0])[0]
        checkApiString(filePath, source, m.index, m[2], name, catalog, opts)
    }
}

function checkFile(filePath, catalog) {
    if (isWizardIgnored(filePath)) return

    const raw = fs.readFileSync(filePath, 'utf8')
    const source = stripComments(raw)

    const inModels = isUnder(MODELS_DIR, filePath)
    const inMigrations = isUnder(MIGRATIONS_DIR, filePath)

    if (inMigrations) {
        // Migrations: keys-only (UI props + API literals). No hardcoded English.
        checkUiStringProps(filePath, source, catalog, { requireKeys: false })
        checkApiCalls(filePath, source, catalog, { keysOnly: true })
        return
    }

    checkApiCalls(filePath, source, catalog)

    if (inModels) {
        checkUiStringProps(filePath, source, catalog, { requireKeys: true })
    }
}

function main() {
    if (!fs.existsSync(EN_DIR)) {
        console.error(`EN catalog directory not found: ${EN_DIR}`)
        process.exit(2)
    }

    const catalog = loadCatalogKeys()
    const beFiles = walkFiles(BACKEND_ROOT, { extensions: ['.js'] })

    for (const file of beFiles) {
        checkFile(file, catalog)
    }

    let missing = 0
    let hardcoded = 0
    let plainErrorKey = 0
    for (const f of findings) {
        if (f.message.includes('Error with i18n key')) plainErrorKey += 1
        else if (f.message.includes('hardcoded')) hardcoded += 1
        else if (f.message.includes('missing i18n')) missing += 1
    }

    if (findings.length === 0) {
        console.log(
            `backend i18n check: ok — missing=0 hardcoded=0 plainErrorKey=0 (scanned ${beFiles.length} BE files, ${Object.keys(catalog).length} catalog keys)`
        )
        return
    }

    console.error(
        `backend i18n check: ${findings.length} issue(s) — missing=${missing} hardcoded=${hardcoded} plainErrorKey=${plainErrorKey}\n`
    )
    for (const f of findings) {
        console.error(`${f.file}:${f.line}: ${f.message}`)
    }
    process.exit(1)
}

main()
