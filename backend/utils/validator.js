const yauzl = require("yauzl");
const path = require("path");
const fs = require("fs");
const UPLOAD_PATH = `${__dirname}/../../files`;

/**
 * Validation utility class for handling file validation and submission processing
 *
 * @author Linyin Huang
 */
class Validator {
    constructor(server, models) {
        this.server = server;
        this.models = models;
    }

    /**
     * Download files from Moodle to temporary location
     * @param {Array} files - Array of file objects with fileUrl and fileName
     * @param {Object} options - Moodle API options
     * @returns {Promise<Array>} - Array of temp file objects
     */
    async downloadFilesToTemp(files, options) {
        const tempFiles = [];

        for (const file of files) {
            try {
                const downloadedFiles = await this.server.rpcs["MoodleRPC"].downloadSubmissionsFromUrl({
                    fileUrls: [file.fileUrl],
                    options: options,
                });

                // Create temp file object
                const tempFile = {
                    content: downloadedFiles[0], // Array of bytes
                    fileName: file.fileName,
                    fileType: file.fileType,
                };

                tempFiles.push(tempFile);
            } catch (error) {
                throw new Error(`Failed to download file ${file.fileName}: ${error.message}`);
            }
        }

        return tempFiles;
    }

    /**
     * Validate submission files against validation schema
     * @param {Array} tempFiles - Array of temporary file objects
     * @param {string} validationDocumentId - ID of validation schema document
     * @returns {Promise<Object>} Validation result
     */
    async validateSubmissionFiles(tempFiles, validationDocumentId) {
        try {
            // 1. Get validation schema
            const validationSchema = await this.getValidationSchema(validationDocumentId);

            // 2. Validate against rules
            const validationResult = await this.validateAgainstRules(tempFiles, validationSchema.rules);

            return validationResult;
        } catch (error) {
            return {
                success: false,
                message: `Validation error: ${error.message}`,
            };
        }
    }

    /**
     * Get validation schema by documentId
     * @param {number} documentId - Document ID referring to the validation schema
     * @returns {Promise<Object>} Validation schema
     */
    async getValidationSchema(documentId) {
        const document = await this.models["document"].getById(documentId);
        if (!document) {
            throw new Error(`Validation schema document not found: ${documentId}`);
        }

        const schemaPath = path.join(UPLOAD_PATH, `${document.hash}.json`);
        try {
            const schemaContent = await fs.promises.readFile(schemaPath, "utf8");
            return JSON.parse(schemaContent);
        } catch (err) {
            throw new Error(`Error reading validation schema: ${err.message}`);
        }
    }

    /**
     * Categorize files by type
     * @param {Array} files - Array of file objects
     * @returns {Object} - Categorized files
     */
    categorizeFiles(files) {
        return {
            pdfs: files.filter((file) => file.fileName.match(/\.pdf$/i)),
            zips: files.filter((file) => file.fileName.match(/\.zip$/i)),
            others: files.filter((file) => !file.fileName.match(/\.(pdf|zip)$/i)),
        };
    }

    /**
     * Validate files against validation rules
     * @param {Array} tempFiles - Array of temporary file objects
     * @param {Object} rules - Validation rules
     * @returns {Promise<Object>} Validation result
     */
    async validateAgainstRules(tempFiles, rules) {
        // Categorize files for additional files check
        const categorizedFiles = this.categorizeFiles(tempFiles);
        const { others } = categorizedFiles;

        // Check additional files policy
        if (!rules.additionalFilesAreAllowed && others.length > 0) {
            return {
                success: false,
                message: `Additional files not allowed. Found: ${others.map((f) => f.fileName).join(", ")}`,
            };
        }

        // Check each required file type
        for (const fileConfig of rules.requiredFiles) {
            const result = await this.validateRequiredFile(fileConfig, tempFiles);
            if (!result.success) {
                return result;
            }
        }

        return { success: true, message: "All validation rules passed" };
    }

    /**
     * Validate a specific required file type
     * @param {Object} fileConfig - Required file configuration
     * @param {Array} tempFiles - Array of temporary file objects
     * @returns {Promise<Object>} Validation result
     */
    async validateRequiredFile(fileConfig, tempFiles) {
        const { pattern, required, description, includeFiles } = fileConfig;
        // Find matching files based on pattern
        const matchingFiles = tempFiles.filter((file) => new RegExp(pattern).test(file.fileName));

        // Check if required file exists
        if (required && matchingFiles.length === 0) {
            return {
                success: false,
                message: `Required file missing: ${description || pattern}`,
            };
        }

        // For archive files, validate contents
        if (includeFiles && matchingFiles.length > 0) {
            for (const archiveFile of matchingFiles) {
                const archiveContentResult = await this.validateZipFileContents(archiveFile, includeFiles);
                if (!archiveContentResult.success) {
                    return archiveContentResult;
                }
            }
        }

        return { success: true };
    }

    /**
     * Validate ZIP file contents
     * @param {Object} zipFile - ZIP file object with content
     * @param {Array} requiredIncludes - Required files that should be in ZIP
     * @returns {Promise<Object>} Validation result
     */
    async validateZipFileContents(zipFile, requiredIncludes) {
        return new Promise((resolve, reject) => {
            // Create a buffer from the file content
            const buffer = Buffer.from(zipFile.content);

            yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    return resolve({
                        success: false,
                        message: `Cannot open ZIP file ${zipFile.fileName}: ${err.message}`,
                    });
                }

                const zipEntries = [];

                zipfile.readEntry();
                zipfile.on("entry", (entry) => {
                    zipEntries.push(entry.fileName);
                    zipfile.readEntry();
                });

                zipfile.on("end", () => {
                    // Validate each required include file
                    for (const includeFile of requiredIncludes) {
                        const matches = zipEntries.filter((entry) => new RegExp(includeFile.pattern).test(entry));

                        if (includeFile.required && matches.length === 0) {
                            return resolve({
                                success: false,
                                message: `Required file missing in ZIP ${zipFile.fileName}: ${includeFile.description || includeFile.pattern}`,
                            });
                        }

                        if (includeFile.maxMatches && matches.length > includeFile.maxMatches) {
                            return resolve({
                                success: false,
                                message: `Too many matches for ${includeFile.description || includeFile.pattern} in ${zipFile.fileName}: found ${matches.length}, max ${includeFile.maxMatches}`,
                            });
                        }
                    }

                    resolve({ success: true });
                });

                zipfile.on("error", (error) => {
                    resolve({
                        success: false,
                        message: `Error reading ZIP file ${zipFile.fileName}: ${error.message}`,
                    });
                });
            });
        });
    }
}

module.exports = Validator;
