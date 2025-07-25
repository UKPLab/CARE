const JSZip = require("jszip");
const Ajv = require("ajv");
const micromatch = require("micromatch");  // small glob matcher


/**
 * Validate the zip file against the schema
 *
 * @author Yiwei Wang
 * @type {ZipValidator}
 */


const ajv = new Ajv(
    {
        allErrors: true,
        strict: false,
    }
);

/**
 * Compile once; throw if admin saved an invalid schema.
 * 
 * Schema is stored in the database settings table under key "upload.zip.validationSchema"
 * Admin users can edit this via the settings interface or a dedicated admin endpoint.
 */

function compileSchema(schemaText) {
    let userSchema;
    try { userSchema = JSON.parse(schemaText); }
    catch (err) { throw new Error("ZIP-schema is not valid JSON: " + err.message); }

    if (!ajv.validateSchema(userSchema)) {
        throw new Error(
            "ZIP-schema fails JSON-Schema validation: " + ajv.errorsText(ajv.errors)
        )
    }

    return userSchema;
}

/**
 * Get a default schema when no schema is configured
 */
function getDefaultSchema() {
    return {
        required: [],
        forbidden: [],
        allowedExtensions: [],
        maxFileCount: null,
        maxTotalSize: null
    };
}

/**
 * Validate one ZIP Buffer against the compiled schema object.
 */
async function validateZip(buffer, schemaObj) {

    // `JSZip.loadAsync` returns an object – but if someone uploads a RAR
    // accidentally, JSZip will throw. We catch that here, so callers see
    // a normal validation-failure object instead of an exception.
    let zip;
    try { zip = await JSZip.loadAsync(buffer); }
    catch (e) {
        return { isValid: false, violations: ["File is not a valid ZIP archive"], summary: {} };
    }
    const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);


    const result = {
        isValid: true,
        violations: [],
        summary: {
            fileCount: files.length,
            totalSize: buffer.length,
            missing: [],
            forbidden: [],
        },
    }

    // 1. basic counters
    if (schemaObj.maxFileCount && files.length > schemaObj.maxFileCount) {
        result.violations.push(
            `ZIP file contains ${files.length} files, but the maximum allowed is ${schemaObj.maxFileCount}.`
        );
    }
    if (schemaObj.maxTotalSize && buffer.length > schemaObj.maxTotalSize) {
        result.violations.push(
            `ZIP file is ${buffer.length} bytes, but the maximum allowed is ${schemaObj.maxTotalSize}.`
        );
    }

    // 2. required files
    schemaObj.required.forEach(f => {
        if (!files.includes(f)) result.summary.missing.push(f);
    });
    if (result.summary.missing.length > 0) {
        result.violations.push(
            `ZIP file is missing the following required files: ${result.summary.missing.join(", ")}.`
        );
    }
    
    // 3. forbidden files
    if (schemaObj.forbidden?.length) {
        result.summary.forbidden = files.filter(f => micromatch.isMatch(f, schemaObj.forbidden));
        if (result.summary.forbidden.length) {
            result.violations.push(
                `ZIP file contains the following forbidden files: ${result.summary.forbidden.join(", ")}.`
            )
        }
    }

    // 4. allowed extensions
    if (schemaObj.allowedExtensions?.length) {
        const badExtensions = files.filter(f => {
            const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
            return !schemaObj.allowedExtensions.includes(ext);
        });
        if (badExtensions.length) {
            result.violations.push(
                `ZIP file contains the following files with forbidden extensions: ${badExtensions.join(", ")}.`
            )
        }
    }
    

    // 5. check for duplicates
    const seen = new Set();
    const duplicates = files.filter(f => {
        if (seen.has(f)) return true;
        seen.add(f);
        return false;
    });

    if (duplicates.length) {
        result.violations.push(
            `ZIP file contains the following duplicate files: ${duplicates.join(", ")}.`
        )
    }

    result.isValid = result.violations.length === 0;
    return result;
}

/**
 * Validate ZIP with provided schema (called from socket with database schema)
 */
async function validateZipWithSchema(buffer, schemaText) {
    let schema;
    
    if (!schemaText) {
        schema = getDefaultSchema();
    } else {
        try {
            schema = compileSchema(schemaText);
        } catch (error) {
            // If schema is invalid, use default and log error
            console.error("Invalid ZIP validation schema in database:", error.message);
            schema = getDefaultSchema();
        }
    }
    
    return await validateZip(buffer, schema);
}

module.exports = {
    compileSchema,
    validateZip,
    getDefaultSchema,
    validateZipWithSchema,
}
