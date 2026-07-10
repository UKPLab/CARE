const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const Papa = require('papaparse');
const { dbToDelta, deltaToPlainText, deltaToHtml } = require('editor-delta-conversion');
const { calculateAssessmentScore, buildScoresFromState } = require('assessment-score');
const {
    replaceAuthorInZip,
    buildUserMapping,
    sanitizeFolderName,
    getPrivateAwareName,
    getDisplayName,
    calculateSubmissionVersion,
    parseAssessmentState,
    getAssessmentConfigurationId,
    resolveAssessmentConfigurationContent,
    addCriteriaReferenceEntry,
    buildGradeCsvRow,
    loadGradeExportContext,
    getConsentedUserIds,
    compareGradeRecords,
    appendStoredFileIfExists,
    resolveHasPrivateInfoRight,
    parseUserIds,
    loadExportRequestContext,
    SUPPORTED_EXPORT_TYPES,
} = require('../../utils/helper/export.js');
const storageDir = path.join(__dirname, "..", "..", "..", "files");
const ASSESSMENT_RESULT_KEY = "assessment_result";

module.exports = function (server) {

    server.app.post('/export/stream', async function (req, res) {

        // Auth checking
        const currentUserId = req.user?.id;
        if (!currentUserId) return res.status(401).send("Log in required");
        const currentUser = await server.db.models.user.findByPk(currentUserId);
        if (!currentUser) return res.status(401).send("User not found");
        const hasPrivateInfoRight = await resolveHasPrivateInfoRight(server, currentUserId);


        // Input parsing
        const { projectId, exportType, generateAliases, fakerSeed, gradeFormat, mergeCsvFiles, includeNonConsentingEdits, includeNonConsentingAnnotations } = req.body;
        let { userIds = [], documentTypes = [0, 1, 2, 4] } = req.body;
        const shouldGenerateAliases = String(generateAliases) === 'true';
        const shouldMergeCsvFiles = String(mergeCsvFiles) === "true";
        const shouldIncludeNonConsentingEdits = String(includeNonConsentingEdits) === 'true';
        const shouldIncludeNonConsentingAnnotations = String(includeNonConsentingAnnotations) === 'true';
        const normalizedGradeFormat = String(gradeFormat || "json").toLowerCase();
        const { Op } = server.db.Sequelize;
        const parsedProjectId = Number(projectId);
        const userIds = parseUserIds(rawUserIds);

        try {
            const context = await loadExportRequestContext(server, { parsedProjectId, exportType, normalizedGradeFormat, userIds});
            if (!constext.succes) {
                return res.status(context.status).send(context.message);
            }
            const { users } = context;

            // build user mapping for aliases
            const { userMapping, mappingCsv } = buildUserMapping(users, shouldGenerateAliases, hasPrivateInfoRight, fakerSeed, currentUser.salt);

            // archiver stream setup
            const exportFolderName = `${exportType}_${Date.now()}.zip`;
            res.attachment(exportFolderName);
            const archive = archiver('zip', { zlib: { level: 5 } });
            archive.on('error', function(err) {
                console.error("Archiver Error:", err);
                if (!res.headersSent) res.status(500).send({error: err.message});
            });

            // start stream & start by piping the mapping if necessary
            archive.pipe(res);
            if (shouldGenerateAliases) {
                archive.append(mappingCsv, { name: 'aliases_mapping.csv' });
            }

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
                        exportFolderName.split('.')[0],
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
                        documentTypes,
                        shouldIncludeNonConsentingEdits,
                        shouldIncludeNonConsentingAnnotations,
                        exportFolderName.split('.')[0],
                        archive
                    );
                    break;
                default:
                    return res.status(400).send("Unsupported export type.");
            }

            await archive.finalize();

        } catch (error) {
            console.error("Export Error:", error);
            if (!res.headersSent) res.status(500).send("Export failed.");
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
                            console.error(`Failed to change names for zip ${doc.hash}:`, err);
                            archive.file(filePath, { name: destPathInArchive });
                        }
                    } else {
                        archive.file(filePath, { name: destPathInArchive });
                    }
                } else {
                    console.error(`[NOT FOUND] Looking for document: ${doc.hash} at ${filePath}`);
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
        const { Op } = server.db.Sequelize;
        const gradeRows = await server.db.models.document_data.findAll({
            where: {
                key: ASSESSMENT_RESULT_KEY,
                deleted: false,
                studySessionId: { [Op.ne]: null }
            },
            include: [{
                model: server.db.models.document,
                as: "document",
                // required: true turns this include into an inner join.
                required: true,
                where: {
                    projectId,
                    userId: { [Op.in]: userIds },
                    deleted: false
                },
                include: [{
                    model: server.db.models.submission,
                    as: "submission",
                    required: false
                }]
            }],
            // Sort by session first, then step within the session, then creation time within the step.
            order: [["studySessionId", "ASC"], ["studyStepId", "ASC"], ["createdAt", "ASC"]]
        });

        const {
            sessionsById,
            studiesById,
            studyStepsById,
            configurationsById,
            usersById
        } = await loadGradeExportContext(server, gradeRows, users);

        const recordsByUser = new Map();
        // Grade export currently assumes that all exported rows point to one assessment config.
        const criteriaReferenceState = {
            key: null,
            reference: null
        };
        for (const row of gradeRows) {
            const document = row.document;
            const ownerUser = usersById.get(document.userId);
            if (!ownerUser) {
                console.warn("Skipping grade export row because the document owner could not be resolved.", {
                    documentId: document.id,
                    documentUserId: document.userId,
                    studySessionId: row.studySessionId,
                    studyStepId: row.studyStepId
                });
                continue;
            }
            const session = sessionsById.get(row.studySessionId);
            const reviewerUser = session ? usersById.get(session.userId) : null;
            const study = session ? studiesById.get(session.studyId) : null;
            const graderUser = study ? usersById.get(study.userId) : null;
            const studyStep = studyStepsById.get(row.studyStepId);
            const submission = document.submission;
            const studyStepConfiguration = studyStep?.configuration;
            // configurationId is exported as metadata; assessmentConfig is the rubric content
            // needed for score calculation and criteria_reference.json.
            const configurationId = getAssessmentConfigurationId(studyStepConfiguration);
            const studyName = study?.name || `study_${session?.studyId || "unknown"}`;

            const scoreObject = row.value || {};
            const assessmentState = typeof scoreObject === "string" ? parseAssessmentState(scoreObject) : scoreObject;
            const flatScores = buildScoresFromState(assessmentState);
            const assessmentConfig = resolveAssessmentConfigurationContent(
                studyStepConfiguration,
                configurationsById
            );
            addCriteriaReferenceEntry(
                criteriaReferenceState,
                configurationId,
                assessmentConfig
            );
            const assessmentScore = calculateAssessmentScore(assessmentConfig, flatScores);
            const totalPoints = assessmentScore.achieved_points;

            const record = {
                projectId,
                userId: ownerUser.id,
                userExtId: ownerUser.extId ?? null,
                userName: ownerUser.userName ?? "",
                displayName: getDisplayName(ownerUser, shouldGenerateAliases, hasPrivateInfoRight, userMapping),
                submissionId: submission?.id ?? document.submissionId ?? null,
                submissionExtId: submission?.extId ?? null,
                studySessionId: row.studySessionId ?? null,
                studyStepId: row.studyStepId ?? null,
                configurationId,
                studyName,
                sessionHash: session?.hash ?? null,
                studyOwner: getPrivateAwareName(graderUser, hasPrivateInfoRight),
                sessionOwner: getPrivateAwareName(reviewerUser, hasPrivateInfoRight),
                author: getPrivateAwareName(ownerUser, hasPrivateInfoRight),
                scores: flatScores,
                totalPoints,
                createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
                studyStepType: studyStep?.stepType ?? null
            };

            if (!recordsByUser.has(ownerUser.id)) recordsByUser.set(ownerUser.id, []);
            recordsByUser.get(ownerUser.id).push(record);
        }

        archive.append(
            JSON.stringify(criteriaReferenceState.reference || {}, null, 2),
            { name: "grades/criteria_reference.json" }
        );

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
            const records = (recordsByUser.get(user.id) || []).sort(compareGradeRecords);

            const recordsByHash = new Map();
            for (const record of records) {
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

    /**
     * Exports a single document to the archive based on its type.
     * - Type 0 (PDF): exports annotations, comments (with votes), document_data, and the PDF file.
     * - Type 1 (HTML) / Type 2 (Modal): exports edits, plain text, HTML, and document_data.
     * - Type 4 (ZIP): exports the zip file and document_data.
     * @param {Object} server - The server instance providing database models.
     * @param {Object} doc - The document record from the database.
     * @param {string} docFolder - The target folder path inside the archive.
     * @param {Object} archive - The archiver instance to append files to.
     * @returns {Promise<void>}
     */
    async function processDocumentForExport(server, doc, docFolder, includeNonConsentingEdits, includeNonConsentingAnnotations, docUserRoles, archive) {
        // document_data for all types, at the doc level.
        const documentData = await server.db.models.document_data.findAll({
            where: { documentId: doc.id, deleted: false },
            raw: true,
        });
        if (documentData.length > 0) {
            archive.append(JSON.stringify(documentData, null, 2), { name: `${docFolder}/document_data.json` });
        }

        const docMeta = {
            ...doc.toJSON(),
            userRoles: docUserRoles,
        };
        archive.append(JSON.stringify(docMeta, null, 2), { name: `${docFolder}/meta.json` });

        switch (doc.type) {
            case 0: { // PDF
                // Annotations live on study-session copies (parentDocumentId = doc.id),
                // not on the root document. Collect all copy IDs and query across them.
                const copies = await server.db.models.document.findAll({
                    where: { parentDocumentId: doc.id },
                    attributes: ['id'],
                    raw: true,
                });
                const allDocIds = [doc.id, ...copies.map(c => c.id)];

                let [annotations, comments] = await Promise.all([
                    server.db.models.annotation.findAll({ where: { documentId: allDocIds }, raw: true }),
                    server.db.models.comment.findAll({ where: { documentId: allDocIds }, raw: true }),
                ]);

                if (!includeNonConsentingAnnotations) {
                    const allUserIds = [...new Set([
                        ...annotations.map(a => a.userId),
                        ...comments.map(c => c.userId),
                    ].filter(Boolean))];
                    const consentedUserIds = await getConsentedUserIds(server, allUserIds);
                    annotations = annotations.filter(a => !a.userId || consentedUserIds.has(a.userId));
                    comments = comments.filter(c => !c.userId || consentedUserIds.has(c.userId));
                }

                const commentVotes = await server.db.models.comment_vote.findAll({
                    where: { commentId: comments.map(c => c.id), deleted: false },
                    raw: true,
                });
                const commentsWithVotes = comments.map(c => ({
                    ...c,
                    votes: commentVotes.filter(v => v.commentId === c.id),
                }));

                // All annotations and comments go into one file each.
                if (annotations.length > 0) {
                    archive.append(JSON.stringify(annotations, null, 2), { name: `${docFolder}/annotations.json` });
                }
                if (commentsWithVotes.length > 0) {
                    archive.append(JSON.stringify(commentsWithVotes, null, 2), { name: `${docFolder}/comments.json` });
                }

                appendStoredFileIfExists(archive, doc.hash, '.pdf', `${docFolder}/document.pdf`, 'PDF');
                break;
            }

            case 1: // HTML
            case 2: { // MODAL
                // fetch all edits for this document, ordered chronologically
                let allEdits = await server.db.models.document_edit.findAll({
                    where: { documentId: doc.id, deleted: false },
                    order: [['createdAt', 'ASC']],
                    raw: true,
                });

                // filter by consent unless the option is enabled
                if (!includeNonConsentingEdits) {
                    const editorUserIds = [...new Set(allEdits.map(e => e.userId).filter(Boolean))];
                    const consentedUserIds = await getConsentedUserIds(server, editorUserIds);
                    allEdits = allEdits.filter(e => !e.userId || consentedUserIds.has(e.userId));
                }

                // group edits by studySessionId (null = template)
                const sessionGroups = new Map();
                for (const edit of allEdits) {
                    const key = edit.studySessionId ?? '__template__';
                    if (!sessionGroups.has(key)) sessionGroups.set(key, []);
                    sessionGroups.get(key).push(edit);
                }

                // fetch study sessions to resolve hashes
                const sessionIds = [...sessionGroups.keys()].filter(k => k !== '__template__');
                const sessions = sessionIds.length > 0
                    ? await server.db.models.study_session.findAll({
                        where: { id: sessionIds },
                        attributes: ['id', 'hash'],
                        raw: true,
                    })
                    : [];
                const sessionHashMap = new Map(sessions.map(s => [s.id, s.hash]));

                for (const [key, edits] of sessionGroups.entries()) {
                    const isTemplate = key === '__template__';
                    const delta = dbToDelta(edits);

                    // skip empty content
                    const text = deltaToPlainText(delta);
                    if (!text.trim()) continue;

                    const subFolder = isTemplate
                        ? `${docFolder}/template`
                        : `${docFolder}/${sessionHashMap.get(key) ?? key}`;

                    archive.append(text,                                  { name: `${subFolder}/text.txt` });
                    archive.append(deltaToHtml(delta),                    { name: `${subFolder}/html.html` });
                    archive.append(JSON.stringify(edits, null, 2),        { name: `${subFolder}/edits.json` });
                }
                break;
            }

            case 4: { // ZIP
                appendStoredFileIfExists(archive, doc.hash, '.zip', `${docFolder}/document.zip`, 'ZIP');
                break;
            }

            default:
                console.warn(`[DocumentExport] Unhandled document type ${doc.type} for document ${doc.hash}, skipping.`);
        }
    }

    /**
     * Main export function for the "documents" export type.
     * Fetches all studies and steps for a project, collects unique documents,
     * filters by owner data sharing consent, and exports each document to the archive.
     * @param {Object} server - The server instance providing database models.
     * @param {number|string} projectId - The ID of the project to export.
     * @param {string} baseFolderName - The root folder name inside the ZIP archive.
     * @param {Object} archive - The archiver instance to append files to.
     * @param {Array<number>} userIds - List of user IDs to filter documents by.
     * @param {Array<number>} documentTypes - List of document types to include (0=PDF, 1=HTML, 2=Modal, 4=ZIP).
     * @returns {Promise<void>}
     */
    async function processDocumentBasedExport(server, projectId, userIds, documentTypes, includeNonConsentingEdits, includeNonConsentingAnnotations, baseFolderName, archive) {
        try {
            documentTypes = typeof documentTypes === 'string' ? JSON.parse(documentTypes) : documentTypes;
            if (!Array.isArray(documentTypes)) documentTypes = [0, 1, 2, 4];
        } catch (e) {
            console.warn("Could not parse documentTypes:", documentTypes);
            documentTypes = [0, 1, 2, 4];
        }
        
        const docs = await server.db.models.document.findAll({
            where: { projectId, userId: userIds, deleted: false, parentDocumentId: null },
        });

        if (docs.length === 0) {
            console.warn(`[DocumentExport] No documents found for project ${projectId}`);
            return;
        }

        const filteredDocs = docs.filter(doc =>
            documentTypes.includes(doc.type) || documentTypes.includes(String(doc.type))
        );

        if (filteredDocs.length === 0) {
            console.warn(`[DocumentExport] No documents matching selected types found for project ${projectId}`);
            return;
        }

        const uniqueUserIds = [...new Set(filteredDocs.map(doc => doc.userId).filter(Boolean))];

        const userRoleRows = await server.db.models.user_role_matching.findAll({
            where: { userId: uniqueUserIds },
            raw: true,
        });
        
        const rolesMap = {};
        for (const row of userRoleRows) {
            if (!rolesMap[row.userId]) rolesMap[row.userId] = [];
            rolesMap[row.userId].push(row.userRoleId);
        }

        for (const doc of filteredDocs) {
            const docFolder = `${baseFolderName}/${doc.hash}`;
            const docUserRoles = rolesMap[doc.userId] || [];
            await processDocumentForExport(server, doc, docFolder, includeNonConsentingEdits, includeNonConsentingAnnotations, docUserRoles, archive);
        }
    }
};
