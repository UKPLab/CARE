#!/usr/bin/env node
/**
 * Frontend i18n checker (complements @intlify/vue-i18n/no-raw-text).
 *
 * 1. Literal $t / this.$t / keypath keys must exist in EN catalogs.
 * 2. Hardcoded user-facing English in title/message/label/text / throw (Vue SFCs).
 * 3. Unused catalog keys: unused only if referenced on neither frontend nor backend
 *    (including db/migrations meta / seeds).
 *
 * Catalogs: utils/modules/i18n/en/*.json (basename = namespace).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..')
const SRC_ROOT = path.join(FRONTEND_ROOT, 'src')
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend')
const EN_DIR = path.join(REPO_ROOT, 'utils/modules/i18n/en')

/** Paths ignored for missing-key / hardcoded checks (wizard + Settings out of scope). */
const HARDCODED_IGNORE_PARTS = [
    `${path.sep}auth${path.sep}SetupWizard.vue`,
    `${path.sep}components${path.sep}wizard${path.sep}`,
    `${path.sep}components${path.sep}dashboard${path.sep}Settings.vue`,
]

/** Directories skipped when walking FE/BE source. */
const USAGE_SKIP_DIR_NAMES = new Set([
    'node_modules',
    'dist',
    'build',
    'coverage',
    'tests',
])

/** Namespaces that appear as the first segment of real keys. */
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

function isHardcodedIgnored(filePath) {
    return HARDCODED_IGNORE_PARTS.some((part) => filePath.includes(part))
}

/**
 * Walk source: drop comments, keep code. Optionally collect string/template contents
 * (handles empty "" and escapes — unlike a naive [^'"`]+ regex).
 */
function walkSource(source, { onString } = {}) {
    let out = ''
    let i = 0
    while (i < source.length) {
        if (source.startsWith('<!--', i)) {
            const end = source.indexOf('-->', i + 4)
            i = end === -1 ? source.length : end + 3
            continue
        }
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

/** Placeholders / punctuation that are not user-facing copy. */
const IGNORE_RAW_LITERALS = new Set(['-', '–', '—', '•', '·'])

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
    // Digits / punctuation only (incl. hyphen) — e.g. table empty cell "-".
    if (/^[\d\s./\\:+#()&%|,;!?"'~*_`\-]+$/.test(trimmed)) return false
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
 * Collect exact keys + dynamic prefixes (e.g. users.roles. from `users.roles.${x}`).
 * A catalog key is "used" if exact match or starts with a dynamic prefix.
 *
 * Uses both:
 * - string-literal walk (models labels, throw Error("errors…"), etc.)
 * - call-site regex ($t in Vue attrs like :title="$t('key')" nest quotes)
 */
function collectUsageFromSource(source, usedExact, usedPrefixes) {
    const mark = (raw) => {
        if (!raw) return
        if (raw.includes('${')) {
            // `ns.foo.${x}` or `${base}.labels.${slug}.${key}`
            const prefix = raw.slice(0, raw.indexOf('${'))
            if (prefix && /^[a-zA-Z][\w.-]*\.?$/.test(prefix)) {
                usedPrefixes.add(prefix.endsWith('.') ? prefix : `${prefix}.`)
            }
            // Static segments between interpolations, e.g. ".labels." — skip;
            // bases like "templates.placeholders" are marked via the branch below.
            return
        }
        if (looksLikeKey(raw)) {
            usedExact.add(raw)
            // Composed keys: base = "templates.placeholders" then `${base}.labels.${slug}.…`
            usedPrefixes.add(`${raw}.`)
        }
    }

    walkSource(source, {
        onString(value) {
            mark(value)
            // Vue/HTML attrs often wrap the whole call: "$t('ns.key')"
            for (const m of value.matchAll(
                /(?:\$te?|i18n\.global\.te?|\bhasKey|\bt)\(\s*(['"])([^'"]+)\1/g
            )) {
                mark(m[2])
            }
        },
    })

    // Call sites in script + templates (covers :title="$t('…')" and keypath=).
    const callRe =
        /(?:\$te?|this\.\$te?|i18n\.global\.te?|\bhasKey|\b(?:TranslatableError|generateError))\(\s*(?:[^'"`,()\n]+,\s*)?(['"`])([^'"`]*?)\1/g
    let m
    while ((m = callRe.exec(source)) !== null) {
        mark(m[2])
    }

    const keypathRe = /keypath\s*=\s*(['"])([^'"]+)\1/g
    while ((m = keypathRe.exec(source)) !== null) {
        mark(m[2])
    }
}

function isKeyUsed(key, usedExact, usedPrefixes) {
    if (usedExact.has(key)) return true
    for (const prefix of usedPrefixes) {
        if (key.startsWith(prefix)) return true
    }
    return false
}

function checkFileHardcodedAndMissing(filePath, catalog) {
    const raw = fs.readFileSync(filePath, 'utf8')
    const source = stripComments(raw)
    const isVue = filePath.endsWith('.vue')

    const tCallRe =
        /(?:\$t|this\.\$t|i18n\.global\.t)\(\s*(['"`])([^'"`]*?)\1/g
    let m
    while ((m = tCallRe.exec(source)) !== null) {
        const key = m[2]
        if (!key || key.includes('${')) continue
        if (!Object.prototype.hasOwnProperty.call(catalog, key)) {
            report(
                filePath,
                lineAt(source, m.index),
                `missing i18n key: ${key}`
            )
        }
    }

    const keypathRe = /keypath\s*=\s*(['"])([^'"]+)\1/g
    while ((m = keypathRe.exec(source)) !== null) {
        const key = m[2]
        if (!key || key.includes('${')) continue
        if (!Object.prototype.hasOwnProperty.call(catalog, key)) {
            report(
                filePath,
                lineAt(source, m.index),
                `missing i18n keypath: ${key}`
            )
        }
    }

    const propRe =
        /(?:^|[{\n,;])\s*(title|message|label|text)\s*:\s*(['"`])([^'"`]+)\2/gm
    while ((m = propRe.exec(source)) !== null) {
        const value = m[3]
        if (value.includes('${')) {
            if (looksLikeEnglish(value.replace(/\$\{[^}]+\}/g, 'X'))) {
                report(
                    filePath,
                    lineAt(source, m.index),
                    `hardcoded ${m[1]} (use $t / i18n key): ${JSON.stringify(value)}`
                )
            }
            continue
        }
        if (looksLikeKey(value)) {
            if (!Object.prototype.hasOwnProperty.call(catalog, value)) {
                report(
                    filePath,
                    lineAt(source, m.index),
                    `missing i18n key in ${m[1]}: ${value}`
                )
            }
            continue
        }
        if (looksLikeEnglish(value)) {
            report(
                filePath,
                lineAt(source, m.index),
                `hardcoded ${m[1]} (use $t / i18n key): ${JSON.stringify(value)}`
            )
        }
    }

    if (isVue) {
        const throwRe =
            /throw\s+new\s+\w*Error\s*\(\s*(['"`])([^'"`]+)\1/g
        while ((m = throwRe.exec(source)) !== null) {
            const value = m[2]
            if (value.includes('${')) continue
            if (looksLikeKey(value)) {
                if (!Object.prototype.hasOwnProperty.call(catalog, value)) {
                    report(
                        filePath,
                        lineAt(source, m.index),
                        `missing i18n key in throw: ${value}`
                    )
                }
                continue
            }
            if (looksLikeEnglish(value)) {
                report(
                    filePath,
                    lineAt(source, m.index),
                    `hardcoded throw message (use i18n key if user-facing): ${JSON.stringify(value)}`
                )
            }
        }
    }
}

function main() {
    if (!fs.existsSync(EN_DIR)) {
        console.error(`EN catalog directory not found: ${EN_DIR}`)
        process.exit(2)
    }

    const catalog = loadCatalogKeys()

    const feFiles = walkFiles(SRC_ROOT, { extensions: ['.vue', '.js'] })
    const beFiles = walkFiles(BACKEND_ROOT, { extensions: ['.js'] })

    // Usage from FE + BE (wizard included so keys only used there are not "unused").
    const usedExact = new Set()
    const usedPrefixes = new Set()
    for (const file of [...feFiles, ...beFiles]) {
        collectUsageFromSource(fs.readFileSync(file, 'utf8'), usedExact, usedPrefixes)
    }

    // Missing / hardcoded: frontend only, wizard excluded.
    for (const file of feFiles.filter((f) => !isHardcodedIgnored(f))) {
        checkFileHardcodedAndMissing(file, catalog)
    }

    // Unused: in catalog, referenced on neither FE nor BE.
    const catalogKeys = Object.keys(catalog).sort()
    for (const key of catalogKeys) {
        if (!isKeyUsed(key, usedExact, usedPrefixes)) {
            const ns = key.split('.')[0]
            report(
                path.join(EN_DIR, `${ns}.json`),
                1,
                `unused i18n key: ${key}`
            )
        }
    }

    if (findings.length === 0) {
        console.log('i18n check: ok')
        return
    }

    console.error(`i18n check: ${findings.length} issue(s)\n`)
    for (const f of findings) {
        console.error(`${f.file}:${f.line}: ${f.message}`)
    }
    process.exit(1)
}

main()
