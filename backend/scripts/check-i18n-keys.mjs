#!/usr/bin/env node
/**
 * Backend i18n checker.
 *
 * User-facing errors: TranslatableError, generateError(code, key).
 *
 * Also checks db model field UI strings (`label`, `placeholder`, `title`, option `name`).
 *
 * @author Andrii Nikitin
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Shared helpers*/
import {
    catalogHasKey,
    createLineIgnoreFilter,
    findCallStringArgs,
    lineAt,
    loadCatalogKeys,
    looksLikeEnglish,
    looksLikeKey,
    stripComments,
    walkFiles,
} from '../../scripts/i18n-lint-shared.mjs'

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
    'scripts',
])

/** Setup wizard is out of scope */
const WIZARD_PATH_PARTS = [
    `${path.sep}db${path.sep}models${path.sep}wizard_`,
    `${path.sep}components${path.sep}wizard${path.sep}`,
    `${path.sep}auth${path.sep}SetupWizard`,
]

/** UI props checked for missing keys when value looks like an i18n key. */
const UI_KEY_PROPS = ['label', 'placeholder', 'title', 'message', 'text', 'name']

/**
 * Props that must not be leftover English in db models (field labels / placeholders).
 */
const UI_REQUIRE_KEY_PROPS = new Set(['label', 'placeholder', 'title', 'message', 'text'])

function isUnder(dir, filePath) {
    const rel = path.relative(dir, filePath)
    return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const findings = []
const isIgnoredLine = createLineIgnoreFilter()
let ignoredCount = 0

/** Record a finding unless the line has `i18n-lint-ignore` */
function report(file, line, message) {
    if (isIgnoredLine(file, line)) {
        ignoredCount += 1
        return
    }
    const rel = path.relative(REPO_ROOT, file)
    findings.push({ file: rel, line, message })
}

/**
 * Validate one string passed to TranslatableError or generateError.
 *
 * @param {string} helperName e.g. TranslatableError, generateError
 * @param {{ onlyKeys?: boolean }} [opts] onlyKeys: only verify keys exist in catalog
 */
function checkErrorMessage(filePath, source, index, value, helperName, catalog, opts = {}) {
    if (!value || value.includes('${')) return
    if (looksLikeKey(value)) {
        if (!catalogHasKey(catalog, value)) {
            report(
                filePath,
                lineAt(source, index),
                `missing i18n key in ${helperName}: ${value}`
            )
        }
        return
    }
    if (opts.onlyKeys) return
    if (looksLikeEnglish(value)) {
        report(
            filePath,
            lineAt(source, index),
            `hardcoded ${helperName} (use i18n key): ${JSON.stringify(value)}`
        )
    }
}

/**
 * Scan `label:` / `placeholder:` / … in model/migration seeds.
 * if the value looks like an i18n key, it must exist in the EN catalog.
 *
 * @param {{ onlyKeys?: boolean }} [opts]
 *   onlyKeys=true (migrations): check only keys exist in catalog; skip hardcoded-English.
 *   onlyKeys=false (models): same key check, plus flag English on label/placeholder/title/message/text.
 */
function checkUiStringProps(filePath, source, catalog, { onlyKeys = false } = {}) {
    const propAlt = UI_KEY_PROPS.join('|')
    const re = new RegExp(`\\b(${propAlt})\\s*:\\s*(['\`"])([^'\`"]+)\\2`, 'g')
    let m
    while ((m = re.exec(source)) !== null) {
        const prop = m[1]
        const value = m[3]
        if (!value || value.includes('${')) continue

        if (looksLikeKey(value)) {
            if (!catalogHasKey(catalog, value)) {
                report(
                    filePath,
                    lineAt(source, m.index),
                    `missing i18n key in ${prop}: ${value}`
                )
            }
            continue
        }

        if (
            !onlyKeys &&
            UI_REQUIRE_KEY_PROPS.has(prop) &&
            looksLikeEnglish(value, { propName: prop })
        ) {
            report(
                filePath,
                lineAt(source, m.index),
                `hardcoded ${prop} (use i18n key): ${JSON.stringify(value)}`
            )
        }
    }
}

/**
 * Find TranslatableError / generateError calls and validate their message strings.
 *
 * @param {{ onlyKeys?: boolean }} [opts]
 *   onlyKeys=true (migrations): if value looks like a key, it must be in the catalog; skip hardcoded-English.
 *   onlyKeys=false (default): same key check, plus flag English literals.
 */
function checkErrorCalls(filePath, source, catalog, opts = {}) {
    for (const call of findCallStringArgs(source, /new\s+TranslatableError/g, 0)) {
        checkErrorMessage(filePath, source, call.index, call.value, 'TranslatableError', catalog, opts)
    }

    for (const call of findCallStringArgs(source, /\bgenerateError/g, 1)) {
        checkErrorMessage(filePath, source, call.index, call.value, 'generateError', catalog, opts)
    }
}

/**
 * Load one backend file and run the checks that apply to its path.
 */
function checkFile(filePath, catalog) {
    const raw = fs.readFileSync(filePath, 'utf8')
    const source = stripComments(raw)

    const inModels = isUnder(MODELS_DIR, filePath)
    const inMigrations = isUnder(MIGRATIONS_DIR, filePath)

    if (inMigrations) {
        checkUiStringProps(filePath, source, catalog, { onlyKeys: true })
        checkErrorCalls(filePath, source, catalog, { onlyKeys: true })
        return
    }

    checkErrorCalls(filePath, source, catalog)

    if (inModels) {
        checkUiStringProps(filePath, source, catalog)
    }
}

function main() {
    if (!fs.existsSync(EN_DIR)) {
        console.error(`EN catalog directory not found: ${EN_DIR}`)
        process.exit(2)
    }

    const catalog = loadCatalogKeys(EN_DIR)
    const beFiles = walkFiles(BACKEND_ROOT, {
        extensions: ['.js'],
        skipDirNames: USAGE_SKIP_DIR_NAMES,
    }).filter((file) => !WIZARD_PATH_PARTS.some((part) => file.includes(part)))

    for (const file of beFiles) {
        checkFile(file, catalog)
    }

    let missing = 0
    let hardcoded = 0
    for (const f of findings) {
        if (f.message.includes('hardcoded')) hardcoded += 1
        else if (f.message.includes('missing i18n')) missing += 1
    }

    if (findings.length === 0) {
        console.log(
            `backend i18n check: ok — missing=0 hardcoded=0 ignored=${ignoredCount} (scanned ${beFiles.length} BE files, ${Object.keys(catalog).length} catalog keys)`
        )
        return
    }

    console.error(
        `backend i18n check: ${findings.length} issue(s) — missing=${missing} hardcoded=${hardcoded} ignored=${ignoredCount}\n`
    )
    for (const f of findings) {
        console.error(`${f.file}:${f.line}: ${f.message}`)
    }
    process.exit(1)
}

main()
