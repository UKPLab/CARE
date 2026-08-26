#!/usr/bin/env node
/**
 * Frontend i18n checker for `<script>` and `.js`
 *
 * User-facing text in Vue templates is covered by ESLint rule
 * `@intlify/vue-i18n/no-raw-text`. This script complements it for the script block:
 *
 * 1. Literal $t / this.$t / i18n.global.t / keypath= — key must exist in EN catalogs.
 * 2. Hardcoded English in object props title / message / label / text (data, methods, toasts, …).
 * 3. Unused catalog keys: unused only if referenced on neither frontend nor backend.
 *
 * @author Andrii Nikitin
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Shared helpers */
import {
    catalogHasKey,
    createLineIgnoreFilter,
    lineAt,
    loadCatalogKeys,
    looksLikeEnglish,
    looksLikeKey,
    stripComments,
    walkFiles,
    walkSource,
} from '../../scripts/i18n-lint-shared.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..')
const SRC_ROOT = path.join(FRONTEND_ROOT, 'src')
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend')
const EN_DIR = path.join(REPO_ROOT, 'utils/modules/i18n/en')

/** Paths ignored for missing-key / hardcoded checks (wizard + Settings + unused submission modals). */
const HARDCODED_IGNORE_PARTS = [
    `${path.sep}auth${path.sep}SetupWizard.vue`,
    `${path.sep}components${path.sep}wizard${path.sep}`,
    `${path.sep}components${path.sep}dashboard${path.sep}Settings.vue`,
    `${path.sep}components${path.sep}dashboard${path.sep}submission${path.sep}UploadModal.vue`,
    `${path.sep}components${path.sep}dashboard${path.sep}submission${path.sep}PublishModal.vue`,
]

/** Directories skipped when walking FE/BE source. */
const USAGE_SKIP_DIR_NAMES = new Set([
    'node_modules',
    'dist',
    'build',
    'coverage',
    'tests',
])

/**
 * True when `filePath` is excluded from missing-key / hardcoded checks
 * (@see {@link HARDCODED_IGNORE_PARTS})
 */
function isHardcodedIgnored(filePath) {
    return HARDCODED_IGNORE_PARTS.some((part) => filePath.includes(part))
}

const findings = []
const isIgnoredLine = createLineIgnoreFilter()
let ignoredCount = 0

/** Record a finding unless the line has `i18n-lint-ignore`*/
function report(file, line, message) {
    if (isIgnoredLine(file, line)) {
        ignoredCount += 1
        return
    }
    const rel = path.relative(REPO_ROOT, file)
    findings.push({ file: rel, line, message })
}

/**
 * Find i18n keys referenced in a source file (for the unused-key pass only).
 *
 * Walks string literals and `$t('…')` / `keypath="…"` call sites, then records:
 * - exact keys in `usedExact` (e.g. `errors.common.accessDenied`)
 * - prefixes in `usedPrefixes` when the key is built dynamically
 *   (e.g. `users.roles.${role}` → prefix `users.roles.`)
 *
 * A catalog key counts as used when it matches exactly or starts with a recorded prefix.
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

    // Every quoted string in the file: record it if it is (or contains) a key.
    walkSource(source, {
        onString(value) {
            mark(value)
            // Sometimes the whole $t('key') call sits inside one outer string, e.g.
            // :title="'$t(\'sidebar.nav.home\')'" — pull the key out of that inner text.
            for (const m of value.matchAll(
                /(?:\$te?|i18n\.global\.te?|\bhasKey|\bt)\(\s*(['"])([^'"]+)\1/g
            )) {
                mark(m[2])
            }
        },
    })

    // Normal $t('key') / this.$t('key') calls written directly in source
    const callRe =
        /(?:\$te?|this\.\$te?|i18n\.global\.te?|\bhasKey|\b(?:TranslatableError|generateError))\(\s*(?:[^'"`,()\n]+,\s*)?(['"`])([^'"`]*?)\1/g
    let m
    while ((m = callRe.exec(source)) !== null) {
        mark(m[2])
    }

    // <i18n-t keypath="…"> in templates.
    const keypathRe = /keypath\s*=\s*(['"])([^'"]+)\1/g
    while ((m = keypathRe.exec(source)) !== null) {
        mark(m[2])
    }
}

/**
 * True when a catalog key was seen in source — exact match or under a dynamic prefix
 * (e.g. key `users.roles.admin` matches prefix `users.roles.` from `users.roles.${x}`).
 */
function isKeyUsed(key, usedExact, usedPrefixes) {
    if (usedExact.has(key)) return true
    for (const prefix of usedPrefixes) {
        if (key.startsWith(prefix)) return true
    }
    return false
}

/**
 * Missing-key and hardcoded checks for one frontend `.vue` or `.js` file.
 *
 * 1. Literal `$t` / `this.$t` / `i18n.global.t('…')` — key must exist in the catalog.
 * 2. Literal `keypath="…"` on `<i18n-t>` — same.
 * 3. Object props `title` / `message` / `label` / `text` in script — key must exist,
 *    or English text is flagged as hardcoded
 */
function checkFileHardcodedAndMissing(filePath, catalog) {
    const raw = fs.readFileSync(filePath, 'utf8')
    // Comments stripped so `// $t('ghost')` does not count; line numbers stay aligned.
    const source = stripComments(raw)

    // --- 1. $t('literal key') — only static keys; `$t(\`foo.${x}\`)` is skipped ---
    const tCallRe =
        /(?:\$t|this\.\$t|i18n\.global\.t)\(\s*(['"`])([^'"`]*?)\1/g
    let m
    while ((m = tCallRe.exec(source)) !== null) {
        const key = m[2]
        if (!key || key.includes('${')) continue
        if (!catalogHasKey(catalog, key)) {
            report(
                filePath,
                lineAt(source, m.index),
                `missing i18n key: ${key}`
            )
        }
    }

    // --- 2. <i18n-t keypath="…"> (often in template; same missing-key rule) ---
    const keypathRe = /keypath\s*=\s*(['"])([^'"]+)\1/g
    while ((m = keypathRe.exec(source)) !== null) {
        const key = m[2]
        if (!key || key.includes('${')) continue
        if (!catalogHasKey(catalog, key)) {
            report(
                filePath,
                lineAt(source, m.index),
                `missing i18n keypath: ${key}`
            )
        }
    }

    // --- 3. Script object props: { title: '…', message: '…', label: '…', text: '…' } ---
    const propRe =
        /(?:^|[{\n,;])\s*(title|message|label|text)\s*:\s*(['"`])([^'"`]+)\2/gm
    while ((m = propRe.exec(source)) !== null) {
        const value = m[3]
        if (value.includes('${')) {
            // `Hello ${name}` — swap ${…} for X and see if the rest looks like English copy.
            if (looksLikeEnglish(value.replace(/\$\{[^}]+\}/g, 'X'), { propName: m[1] })) {
                report(
                    filePath,
                    lineAt(source, m.index),
                    `hardcoded ${m[1]} (use $t / i18n key): ${JSON.stringify(value)}`
                )
            }
            continue
        }
        if (looksLikeKey(value)) {
            // Already a catalog key string, e.g. label: 'sidebar.nav.home' (not wrapped in $t).
            if (!catalogHasKey(catalog, value)) {
                report(
                    filePath,
                    lineAt(source, m.index),
                    `missing i18n key in ${m[1]}: ${value}`
                )
            }
            continue
        }
        // Plain English, e.g. label: 'Cancel' or title: 'settings'.
        if (looksLikeEnglish(value, { propName: m[1] })) {
            report(
                filePath,
                lineAt(source, m.index),
                `hardcoded ${m[1]} (use $t / i18n key): ${JSON.stringify(value)}`
            )
        }
    }
}

function main() {
    if (!fs.existsSync(EN_DIR)) {
        console.error(`EN catalog directory not found: ${EN_DIR}`)
        process.exit(2)
    }

    const catalog = loadCatalogKeys(EN_DIR)

    const walkOpts = { skipDirNames: USAGE_SKIP_DIR_NAMES }
    const feFiles = walkFiles(SRC_ROOT, { extensions: ['.vue', '.js'], ...walkOpts })
    const beFiles = walkFiles(BACKEND_ROOT, { extensions: ['.js'], ...walkOpts })

    // Usage from FE + BE.
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
        console.log(
            `i18n check: ok — missing=0 unused=0 hardcoded=0 ignored=${ignoredCount} (scanned ${feFiles.length} FE + ${beFiles.length} BE files, ${catalogKeys.length} catalog keys)`
        )
        return
    }

    let missing = 0
    let unused = 0
    let hardcoded = 0
    for (const f of findings) {
        if (f.message.includes('unused i18n key')) unused += 1
        else if (f.message.includes('hardcoded')) hardcoded += 1
        else if (f.message.includes('missing i18n')) missing += 1
    }

    console.error(
        `i18n check: ${findings.length} issue(s) — missing=${missing} unused=${unused} hardcoded=${hardcoded} ignored=${ignoredCount}\n`
    )
    for (const f of findings) {
        console.error(`${f.file}:${f.line}: ${f.message}`)
    }
    process.exit(1)
}

main()
