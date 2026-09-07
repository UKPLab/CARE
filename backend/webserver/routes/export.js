const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const Papa = require('papaparse');
const {
    replaceAuthorInZip,
    buildUserMapping,
    sanitizeFolderName,
    getDisplayName,
    calculateSubmissionVersion,
    resolveHasPrivateInfoRight,
    parseUserIds,
    loadExportRequestContext,
    resolveIsAdmin,
} = require('../../utils/helper/export.js');
const {
    buildGradeCsvRow,
    compareGradeRecords,
    buildGradeRecords,
} = require('../../utils/helper/exportGrades.js');
const {
    processDocumentBasedExport,
    processStudyBasedExport,
    processUserBehaviourExport,
} = require('../../utils/helper/exportProcessors.js');
const storageDir = path.join(__dirname, "..", "..", "..", "files");

module.exports = function (server) {

    server.app.post('/export/stream', async function (req, res) {

        // Auth checking
        const currentUserId = req.user?.id;
        if (!currentUserId) return res.status(401).json({ message: "dashboard.projects.export.api.loginRequired" });
        const currentUser = await server.db.models.user.findByPk(currentUserId);
        if (!currentUser) return res.status(401).json({ message: "dashboard.projects.export.api.userNotFound" });
        const hasPrivateInfoRight = await resolveHasPrivateInfoRight(server, currentUserId);


        // Input parsing
        const { projectId, exportType, generateAliases, fakerSeed, gradeFormat, mergeCsvFiles, excludeNonConsentingEdits, excludeNonConsentingAnnotations, includeEmptyStudies, includeDocumentFiles, includeGrades, includeAiScores, behaviourOutputFormat, behaviourFileFormat } = req.body;
        let { userIds: rawUserIds = [], documentTypes = [0, 1, 2, 4], workflowIds = [] } = req.body;
        const shouldGenerateAliases = String(generateAliases) === 'true';
        const shouldMergeCsvFiles = String(mergeCsvFiles) === "true";
        const shouldExcludeNonConsentingEdits = String(excludeNonConsentingEdits) === 'true';
        const shouldExcludeNonConsentingAnnotations = String(excludeNonConsentingAnnotations) === 'true';
        const shouldIncludeEmptyStudies = String(includeEmptyStudies) === 'true';
        const shouldIncludeDocumentFiles = String(includeDocumentFiles) === 'true';
        const shouldIncludeGrades = String(includeGrades) === 'true';
        const shouldIncludeAiScores = includeAiScores === undefined ? true : String(includeAiScores) === 'true';
        const normalizedBehaviourOutputFormat = behaviourOutputFormat === 'perUser' ? 'perUser' : 'single';
        const normalizedBehaviourFileFormat = behaviourFileFormat === 'csv' ? 'csv' : 'json';
        const normalizedGradeFormat = String(gradeFormat || "json").toLowerCase();
        const parsedProjectId = Number(projectId);
        const userIds = parseUserIds(server, rawUserIds);

        try {
            const context = await loadExportRequestContext(server, { parsedProjectId, exportType, normalizedGradeFormat, userIds, workflowIds, currentUserId });
            if (!context.success) {
                return res.status(context.status).json({ message: context.message });
            }
            const { users, workflowIds: parsedWorkflowIds } = context;

            // build user mapping for aliases
            const { userMapping, mappingCsv } = buildUserMapping(users, shouldGenerateAliases, hasPrivateInfoRight, fakerSeed, currentUser.salt);

            // archiver stream setup
            const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
            const exportFolderName = `${timestamp}_${exportType}.zip`;
            res.attachment(exportFolderName);
            const archive = archiver('zip', { zlib: { level: 5 } });
            archive.on('error', function(err) {
                server.logger.error("Archiver Error:", err);
                if (!res.headersSent) res.status(500).json({ message: "dashboard.projects.export.api.archiverError" });
            });

            // start stream & start by piping the mapping if necessary
            archive.pipe(res);
            if (shouldGenerateAliases) {
                archive.append(mappingCsv, { name: 'aliases_mapping.csv' });
            }

            const baseFolderName = exportFolderName.split('.')[0];

            // process based on type
            switch (exportType) {
                case 'submissions': 
                    await processSubmissionsExport(
                        server,
                        parsedProjectId,
                        userIds,
                        users,
                        shouldGenerateAliases,
                        hasPrivateInfoRight,
                        userMapping,
                        baseFolderName,
                        archive
                    );
                    break;
                case 'grades':
                    await processGradesExport(
                        server,
                        parsedProjectId,
                        userIds,
                        users,
                        shouldGenerateAliases,
                        hasPrivateInfoRight,
                        userMapping,
                        normalizedGradeFormat,
                        shouldMergeCsvFiles,
                        archive
                    );
                    break;
                case 'documents':
                    await processDocumentBasedExport(
                        server,
                        parsedProjectId,
                        userIds,
                        users,
                        documentTypes,
                        shouldExcludeNonConsentingEdits,
                        shouldExcludeNonConsentingAnnotations,
                        shouldGenerateAliases,
                        userMapping,
                        baseFolderName,
                        archive
                    );
                    break;
                case 'studies':
                    await processStudyBasedExport(
                        server,
                        parsedProjectId,
                        userIds,
                        users,
                        hasPrivateInfoRight,
                        userMapping,
                        parsedWorkflowIds,
                        baseFolderName,
                        archive,
                        {
                            shouldGenerateAliases,
                            shouldIncludeEmptyStudies,
                            shouldExcludeNonConsentingEdits,
                            shouldExcludeNonConsentingAnnotations,
                            shouldIncludeDocumentFiles,
                            shouldIncludeGrades,
                            shouldIncludeAiScores,
                        }
                    );
                    break;
                case 'userBehaviour': {
                    const isAdmin = await resolveIsAdmin(server, currentUserId);
                    if (!isAdmin) {
                        return res.status(403).json({ message: "dashboard.projects.export.api.adminRightsRequired" });
                    }
                    await processUserBehaviourExport(
                        server,
                        users,
                        shouldGenerateAliases,
                        hasPrivateInfoRight,
                        userMapping,
                        normalizedBehaviourOutputFormat,
                        normalizedBehaviourFileFormat,
                        baseFolderName,
                        archive
                    );
                    break;
                }
                default:
                    return res.status(400).json({ message: "dashboard.projects.export.api.unsupportedExportType" });
            }

            await archive.finalize();

        } catch (error) {
            server.logger.error("Export Error:", error);
            if (!res.headersSent) res.status(500).json({ message: "dashboard.projects.export.api.exportFailed" });
            else res.end();
        }
    });

    /**
     * Does the fetching, filtering, and archiving of student submissions for a specific project.
     * Handles file renaming based on validation rules and manages directory structures
     * (Student Name/Version/File) within the ZIP archive.
     * @param {Object} server - The server instance providing database models and Sequelize operators.
     * @param {number} projectId - The ID of the project to export submissions from.
     * @param {Array<number|string>} userIds - List of user IDs for this export.
     * @param {Array<Object>} users - Full user objects.
     * @param {boolean} shouldGenerateAliases - If true, students' real names are replaced with fake names.
     * @param {boolean} hasPrivateInfoRight - If true, non-anonymized exports use full name instead of username.
     * @param {Object} userMapping - A map of user IDs to their generated fake names.
     * @param {string} baseFolderName - The root directory name inside the generated ZIP.
     * @param {Object} archive - The archiver instance (stream) where files are appended.
     * @returns {Promise<void>} - Resolves once all submissions have been processed and added to the archive.
     */
    async function processSubmissionsExport(server, projectId, userIds, users, shouldGenerateAliases, hasPrivateInfoRight, userMapping, baseFolderName, archive) {
        
        // Fetch all submissions for the selected users
        const submissions = await server.db.models.submission.findAll({
            where: {
                projectId,
                userId: userIds,
                parentSubmissionId: null,
                deleted: false
            },
            include: [{
                model: server.db.models.document,
                as: 'documents'
            }]
        });

        // Fetch validation configurations that was used when document was uploaded to rename file in consistent way
        const configurationIds = [...new Set(submissions.map(s => s.validationConfigurationId).filter(Boolean))];
        const configurations = await server.db.models.configuration.findAll({
            where: { id: configurationIds }
        });

        const configMap = new Map(configurations.map(c => [c.id, c.content?.rules || null]));
        const submissionMap = new Map(submissions.map(s => [s.id, s]));
        const usersById = new Map(users.map((user) => [user.id, user]));

        const extensionMap = {
            0: ".pdf",
            1: ".html",
            4: ".zip"
        };

        for (const submission of submissions) {
            const student = usersById.get(submission.userId);
            if (!student) continue;

            const validationRules = configMap.get(submission.validationConfigurationId);
            const folderName = sanitizeFolderName(
                getDisplayName(student, shouldGenerateAliases, hasPrivateInfoRight, userMapping)
            );

            for (const doc of submission.documents) {
                const version = calculateSubmissionVersion(submission, submissionMap);
                const extension = extensionMap[doc.type] || "";
                const originalName = doc.originalFilename || `${doc.name}${extension}` || "";
                
                let exportName = doc.hash;
                if (validationRules && validationRules.requiredFiles) {
                    for (const rule of validationRules.requiredFiles) {
                        if (rule.exportName && new RegExp(rule.pattern, 'i').test(originalName)) {
                            exportName = rule.exportName;
                            break; 
                        }
                    }
                }
                const fileName = `${exportName}${extension}`;
                
                const filePath = path.join(storageDir, `${doc.hash}${extension}`);
                const destPathInArchive = `${baseFolderName}/${folderName}/version_${version}/${fileName}`;

                if (fs.existsSync(filePath)) {
                    if (shouldGenerateAliases && doc.type == 4) {
                        const realName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
                        const fakeName = userMapping[student.id];
                        try {
                            const newZipBuffer = await replaceAuthorInZip(filePath, realName, fakeName);
                            archive.append(newZipBuffer, { name: destPathInArchive });
                        } catch (err) {
                            server.logger.error(`Failed to change names for zip ${doc.hash}:`, err);
                            archive.file(filePath, { name: destPathInArchive });
                        }
                    } else {
                        archive.file(filePath, { name: destPathInArchive });
                    }
                } else {
                    server.logger.error(`[NOT FOUND] Looking for document: ${doc.hash} at ${filePath}`);
                }
            }
        }
    }

    /**
     * Exports assessment results for the selected users as a ZIP archive.
     * Each selected user gets one or more hash-named folders containing
     * either JSON or CSV score files depending on the requested format.
     *
     * @param {Object} server - The server instance providing database models and Sequelize operators.
     * @param {number} projectId - The project whose grades should be exported.
     * @param {Array<number|string>} userIds - List of user IDs included in the export.
     * @param {Array<Object>} users - Full user records for the selected users.
     * @param {boolean} shouldGenerateAliases - Whether student names should be anonymized.
     * @param {boolean} hasPrivateInfoRight - Whether the requester may export real names.
     * @param {Object} userMapping - Map of user IDs to generated aliases.
     * @param {string} gradeFormat - The output format for grade files, `json` or `csv`.
     * @param {Object} archive - The active ZIP archive stream.
     * @returns {Promise<void>} Resolves when all grade files have been appended.
     */
    async function processGradesExport(
        server,
        projectId,
        userIds,
        users,
        shouldGenerateAliases,
        hasPrivateInfoRight,
        userMapping,
        gradeFormat,
        mergeCsvFiles,
        archive
    ) {
        const { records, criteriaReferencesByConfigId } = await buildGradeRecords(
            server, projectId, userIds, users, shouldGenerateAliases, hasPrivateInfoRight, userMapping
        );

        const recordsByUser = new Map();
        for (const record of records) {
            if (!recordsByUser.has(record.userId)) recordsByUser.set(record.userId, []);
            recordsByUser.get(record.userId).push(record);
        }

        if (criteriaReferencesByConfigId.size > 0) {
            for (const [configurationId, reference] of criteriaReferencesByConfigId.entries()) {
                archive.append(
                    JSON.stringify(reference, null, 2),
                    { name: `grades/criteria_reference_${configurationId}.json` }
                );
            }
        } else {
            archive.append(JSON.stringify({}, null, 2), { name: "grades/criteria_reference.json" });
        }

        const usedFolderNames = new Set();
        const getUniqueHashFolderName = (baseHash, userId, sessionId) => {
            const raw = baseHash || `session_${sessionId || "unknown"}_user_${userId}`;
            const safeBase = sanitizeFolderName(raw);
            let candidate = safeBase;
            let suffix = 1;
            while (usedFolderNames.has(candidate)) {
                candidate = `${safeBase}_${suffix}`;
                suffix += 1;
            }
            usedFolderNames.add(candidate);
            return candidate;
        };

        if (gradeFormat === "csv" && mergeCsvFiles) {
            const mergedGroups = new Map();
            for (const user of users) {
                const userRecords = recordsByUser.get(user.id) || [];
                for (const record of userRecords) {
                    const studyNameKey = sanitizeFolderName(record.studyName || "study").replace(/\s+/g, "_");
                    const configurationIdKey = record.configurationId != null ? record.configurationId : "no_config";
                    const stepIdKey = record.studyStepId != null ? record.studyStepId : "no_step";
                    const groupKey = `${studyNameKey}__${stepIdKey}__${configurationIdKey}`;
                    if (!mergedGroups.has(groupKey)) mergedGroups.set(groupKey, []);
                    mergedGroups.get(groupKey).push(record);
                }
            }

            for (const [groupKey, groupRecords] of mergedGroups.entries()) {
                const sortedRecords = [...groupRecords].sort(compareGradeRecords);

                const csvRows = sortedRecords.map((record) => buildGradeCsvRow(record));

                const [studyNamePart, stepIdPart, configurationIdPart] = groupKey.split("__");
                const fileName = `${studyNamePart}_${stepIdPart}_${configurationIdPart}.csv`;
                archive.append(Papa.unparse(csvRows), { name: `grades/${fileName}` });
            }
            return;
        }

        for (const user of users) {
            const userRecords = (recordsByUser.get(user.id) || []).sort(compareGradeRecords);

            const recordsByHash = new Map();
            for (const record of userRecords) {
                const hashKey = record.sessionHash || null;
                if (!recordsByHash.has(hashKey)) recordsByHash.set(hashKey, []);
                recordsByHash.get(hashKey).push(record);
            }

            for (const [hashKey, hashRecords] of recordsByHash.entries()) {
                const folderName = getUniqueHashFolderName(hashKey, user.id, hashRecords[0]?.studySessionId);
                const hashFolder = `grades/${folderName}`;
                const exportedRecords = hashRecords.map(({ sessionHash, ...rest }) => rest);

                if (gradeFormat === "csv") {
                    const csvRows = exportedRecords.map((record) => buildGradeCsvRow(record));
                    archive.append(Papa.unparse(csvRows), { name: `${hashFolder}/scores.csv` });
                } else {
                    archive.append(JSON.stringify(exportedRecords, null, 2), { name: `${hashFolder}/scores.json` });
                }
            }
        }
    }

};