const { dbToDelta, deltaToPlainText, deltaToHtml } = require('editor-delta-conversion');
const {
    sanitizeFolderName,
    getDisplayName,
    getConsentedUserIds,
    appendStoredFileIfExists,
    attachTagNames,
    createJsonArrayStream,
    createCsvRowsStream
} = require('./export.js');
const { compareGradeRecords, buildGradeRecords } = require('./exportGrades.js');

// Stored files the study export ships per step, by document type: PDF and LaTeX ZIP.
const STUDY_DOCUMENT_EXTENSIONS = { 0: '.pdf', 4: '.zip' };

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
async function processDocumentForExport(server, doc, docFolder, shouldExcludeNonConsentingEdits, shouldExcludeNonConsentingAnnotations, docUserRoles, archive) {
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
                where: { parentDocumentId: doc.id, deleted: false },
                attributes: ['id'],
                raw: true,
            });
            const allDocIds = [doc.id, ...copies.map(c => c.id)];

            let [annotations, comments] = await Promise.all([
                server.db.models.annotation.findAll({ where: { documentId: allDocIds, deleted: false }, raw: true }),
                server.db.models.comment.findAll({ where: { documentId: allDocIds, deleted: false }, raw: true }),
            ]);

            annotations = await attachTagNames(server, annotations);

            if (shouldExcludeNonConsentingAnnotations) {
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

            appendStoredFileIfExists(server, archive, doc.hash, '.pdf', `${docFolder}/document.pdf`, 'PDF');
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
            if (shouldExcludeNonConsentingEdits) {
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
            appendStoredFileIfExists(server, archive, doc.hash, '.zip', `${docFolder}/document.zip`, 'ZIP');
            break;
        }

        default:
            server.logger.warn(`[DocumentExport] Unhandled document type ${doc.type} for document ${doc.hash}, skipping.`);
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
async function processDocumentBasedExport(server, projectId, userIds, documentTypes, shouldExcludeNonConsentingEdits, shouldExcludeNonConsentingAnnotations, baseFolderName, archive) {
    try {
        documentTypes = typeof documentTypes === 'string' ? JSON.parse(documentTypes) : documentTypes;
        if (!Array.isArray(documentTypes)) documentTypes = [0, 1, 2, 4];
    } catch (e) {
        server.logger.warn("Could not parse documentTypes:", documentTypes);
        documentTypes = [0, 1, 2, 4];
    }

    const docs = await server.db.models.document.findAll({
        where: { projectId, userId: userIds, deleted: false, parentDocumentId: null },
    });

    if (docs.length === 0) {
        server.logger.warn(`[DocumentExport] No documents found for project ${projectId}`);
        return;
    }

    const filteredDocs = docs.filter(doc =>
        documentTypes.includes(doc.type) || documentTypes.includes(String(doc.type))
    );

    if (filteredDocs.length === 0) {
        server.logger.warn(`[DocumentExport] No documents matching selected types found for project ${projectId}`);
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
        await processDocumentForExport(server, doc, docFolder, shouldExcludeNonConsentingEdits, shouldExcludeNonConsentingAnnotations, docUserRoles, archive);
    }
}

/**
 * Main export function for the "studies" export type.
 * Fetches all studies for the selected users/workflows and, per study session and step,
 * archives annotations, comments, edits, document_data, grades, and (optionally) the
 * underlying document files.
 * @param {Object} server - The server instance providing database models and Sequelize operators.
 * @param {number|string} projectId - The ID of the project to export.
 * @param {Array<number|string>} userIds - List of user IDs to filter studies by.
 * @param {Array<Object>} users - Full user records for the selected users.
 * @param {boolean} hasPrivateInfoRight - Whether the requester may export real names.
 * @param {Object} userMapping - Map of user IDs to generated aliases.
 * @param {Array<number>} workflowIds - Workflow IDs to filter studies by.
 * @param {string} baseFolderName - The root folder name inside the ZIP archive.
 * @param {Object} archive - The archiver instance to append files to.
 * @param {Object} options - Export flags.
 * @param {boolean} options.shouldGenerateAliases - Whether student names should be anonymized.
 * @param {boolean} options.shouldIncludeEmptyStudies - Whether to include studies/sessions with no exportable content.
 * @param {boolean} options.shouldExcludeNonConsentingEdits - Whether to drop edits from users who didn't consent to data sharing.
 * @param {boolean} options.shouldExcludeNonConsentingAnnotations - Whether to drop annotations/comments from users who didn't consent to data sharing.
 * @param {boolean} options.shouldIncludeDocumentFiles - Whether to include the underlying PDF/ZIP document files per step.
 * @param {boolean} options.shouldIncludeGrades - Whether to include grade/score files per session.
 * @param {boolean} options.shouldIncludeAiScores - Whether to include AI-assisted scores alongside human grades.
 * @returns {Promise<void>}
 */
async function processStudyBasedExport(server, projectId, userIds, users, hasPrivateInfoRight, userMapping, workflowIds, baseFolderName, archive, options) {
    const {
        shouldGenerateAliases,
        shouldIncludeEmptyStudies,
        shouldExcludeNonConsentingEdits,
        shouldExcludeNonConsentingAnnotations,
        shouldIncludeDocumentFiles,
        shouldIncludeGrades,
        shouldIncludeAiScores,
    } = options;

    const studyWhere = { userId: userIds, projectId, deleted: false, workflowId: workflowIds };

    const studies = await server.db.models.study.findAll({ where: studyWhere });

    if (studies.length === 0) {
        server.logger.warn(`[StudyExport] No studies found for selected users in project ${projectId}`);
        return;
    }

    const writtenCriteriaReferenceIds = new Set();

    for (const study of studies) {
        const studyFolder = `${baseFolderName}/${study.hash}`;

        const sortedSteps = await server.db.models.study_step.getSortedStudySteps(study.id);

        const stepDocumentsById = new Map();
        // A step references one document, but PDF and LaTeX ZIP are separate documents
        // of the same submission, each with its own hash.
        const submissionDocumentsBySubmissionId = new Map();
        if (shouldIncludeDocumentFiles) {
            const stepDocumentIds = [...new Set(sortedSteps.map(step => step.documentId).filter(Boolean))];
            const stepDocuments = stepDocumentIds.length > 0
                ? await server.db.models.document.findAll({ where: { id: stepDocumentIds }, raw: true })
                : [];
            for (const doc of stepDocuments) stepDocumentsById.set(doc.id, doc);

            const submissionIds = [...new Set(stepDocuments.map(doc => doc.submissionId).filter(Boolean))];
            const submissionDocuments = submissionIds.length > 0
                ? await server.db.models.document.findAll({
                    where: { submissionId: submissionIds, deleted: false },
                    raw: true,
                })
                : [];
            for (const doc of submissionDocuments) {
                if (!submissionDocumentsBySubmissionId.has(doc.submissionId)) {
                    submissionDocumentsBySubmissionId.set(doc.submissionId, []);
                }
                submissionDocumentsBySubmissionId.get(doc.submissionId).push(doc);
            }
        }

        const sessions = await server.db.models.study_session.findAll({
            where: { studyId: study.id, deleted: false },
            raw: true,
        });

        const sessionResults = [];
        for (const session of sessions) {
            const stepResults = [];
            let sessionHasContent = false;

            for (let i = 0; i < sortedSteps.length; i++) {
                const step = sortedSteps[i];
                const files = [];

                switch (step.stepType) {
                    case 1: { // Annotator
                        let annotations = await server.db.models.annotation.findAll({
                            where: { documentId: step.documentId, studySessionId: session.id, studyStepId: step.id, deleted: false },
                            raw: true,
                        });

                        annotations = await attachTagNames(server, annotations);

                        let comments = await server.db.models.comment.findAll({
                            where: { documentId: step.documentId, studySessionId: session.id, studyStepId: step.id, deleted: false },
                            raw: true,
                        });

                        if (shouldExcludeNonConsentingAnnotations) {
                            const allUserIds = [...new Set([
                                ...annotations.map(a => a.userId),
                                ...comments.map(c => c.userId)
                            ].filter(Boolean))];
                            const consentedIds = await getConsentedUserIds(server, allUserIds);
                            annotations = annotations.filter(a => !a.userId || consentedIds.has(a.userId));
                            comments = comments.filter(c => !c.userId || consentedIds.has(c.userId));
                        }

                        if (annotations.length > 0) {
                            files.push({ name: 'annotations.json', content: JSON.stringify(annotations, null, 2) });
                            sessionHasContent = true;
                        }

                        if (comments.length > 0) {
                            const commentVotes = await server.db.models.comment_vote.findAll({
                                where: { commentId: comments.map(c => c.id), deleted: false },
                                raw: true,
                            });
                            files.push({
                                name: 'comments.json',
                                content: JSON.stringify(
                                    comments.map(c => ({ ...c, votes: commentVotes.filter(v => v.commentId === c.id) })),
                                    null, 2
                                )
                            });
                            sessionHasContent = true;
                        }

                        // Assessments live on the annotator step, so without this the whole
                        // document_data of an assessment workflow never leaves the database.
                        const annotatorData = await server.db.models.document_data.findAll({
                            where: { documentId: step.documentId, studySessionId: session.id, studyStepId: step.id, deleted: false },
                            raw: true,
                        });
                        if (annotatorData.length > 0) {
                            files.push({ name: 'document_data.json', content: JSON.stringify(annotatorData, null, 2) });
                            sessionHasContent = true;
                        }
                        break;
                    }

                    case 2: // Editor
                    case 3: { // Modal
                        const [templateEdits, sessionEdits] = await Promise.all([
                            server.db.models.document_edit.findAll({
                                where: { documentId: step.documentId, studySessionId: null, studyStepId: null, deleted: false },
                                order: [['createdAt', 'ASC']],
                                raw: true,
                            }),
                            server.db.models.document_edit.findAll({
                                where: { documentId: step.documentId, studySessionId: session.id, studyStepId: step.id, deleted: false },
                                order: [['createdAt', 'ASC']],
                                raw: true,
                            }),
                        ]);

                        let edits = [...templateEdits, ...sessionEdits].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                        if (shouldExcludeNonConsentingEdits) {
                            const editorUserIds = [...new Set(edits.map(e => e.userId).filter(Boolean))];
                            const consentedIds = await getConsentedUserIds(server, editorUserIds);
                            edits = edits.filter(e => !e.userId || consentedIds.has(e.userId));
                        }

                        if (edits.length > 0) {
                            const delta = dbToDelta(edits);
                            const text = deltaToPlainText(delta);
                            if (text.trim()) {
                                files.push({ name: 'edits.json', content: JSON.stringify(edits, null, 2) });
                                files.push({ name: 'text.txt', content: text });
                                files.push({ name: 'html.html', content: deltaToHtml(delta) });
                                sessionHasContent = true;
                            }
                        }

                        const documentData = await server.db.models.document_data.findAll({
                            where: { documentId: step.documentId, studySessionId: session.id, studyStepId: step.id, deleted: false },
                            raw: true,
                        });
                        if (documentData.length > 0) {
                            files.push({ name: 'document_data.json', content: JSON.stringify(documentData, null, 2) });
                        }
                        break;
                    }
                }

                stepResults.push({ stepIndex: i, files });

            }

            sessionResults.push({ session, stepResults, hasContent: sessionHasContent });
        }

        const includedSessions = shouldIncludeEmptyStudies
            ? sessionResults
            : sessionResults.filter(s => s.hasContent);

        if (!shouldIncludeEmptyStudies && includedSessions.length === 0) continue;

        const studyMeta = {
            id: study.id,
            name: study.name,
            userId: study.userId,
            workflowId: study.workflowId,
            sessions: includedSessions.map(({ session }) => ({
                hash: session.hash,
                id: session.id,
                userId: session.userId,
                numberSteps: session.numberSteps,
                steps: sortedSteps.map((step, i) => ({
                    id: step.id,
                    stepNumber: i + 1,
                    stepType: step.stepType,
                    configuration: step.configuration,
                }))
            }))
        };

        archive.append(JSON.stringify(studyMeta, null, 2), { name: `${studyFolder}/meta.json` });

        let gradeRecordsBySessionId = new Map();
        if (shouldIncludeGrades) {
            // Scope by this study's sessions, not by the study owner: review assessments are
            // stored on a document owned by the reviewed author, so an owner-scoped lookup
            // finds none of them. See buildGradeRecords().
            const { records: ownerGradeRecords, criteriaReferencesByConfigId } = await buildGradeRecords(
                server, projectId, [study.userId], users, shouldGenerateAliases, hasPrivateInfoRight, userMapping,
                { sessionIds: sessions.map(s => s.id) }
            );

            for (const [configurationId, reference] of criteriaReferencesByConfigId.entries()) {
                if (writtenCriteriaReferenceIds.has(configurationId)) continue;
                writtenCriteriaReferenceIds.add(configurationId);
                archive.append(
                    JSON.stringify(reference, null, 2),
                    { name: `${baseFolderName}/criteria_reference_${configurationId}.json` }
                );
            }

            for (const record of ownerGradeRecords) {
                if (!gradeRecordsBySessionId.has(record.studySessionId)) gradeRecordsBySessionId.set(record.studySessionId, []);
                gradeRecordsBySessionId.get(record.studySessionId).push(record);
            }
        }

        for (const { session, stepResults } of includedSessions) {
            const sessionFolder = `${studyFolder}/${session.hash}`;

            if (shouldIncludeGrades) {
                const allSessionGrades = (gradeRecordsBySessionId.get(session.id) || []).sort(compareGradeRecords);

                const humanGrades = allSessionGrades.filter(r => !r.isAiGraded).map(({ sessionHash, isAiGraded, ...rest }) => rest);
                const aiGrades = allSessionGrades.filter(r => r.isAiGraded).map(({ sessionHash, isAiGraded, ...rest }) => rest);

                if (humanGrades.length > 0) {
                    archive.append(JSON.stringify(humanGrades, null, 2), { name: `${sessionFolder}/scores.json` });
                }
                if (shouldIncludeAiScores && aiGrades.length > 0) {
                    archive.append(JSON.stringify(aiGrades, null, 2), { name: `${sessionFolder}/scores_ai.json` });
                }
            }

            for (const { stepIndex, files } of stepResults) {
                const stepFolder = `${sessionFolder}/step_${stepIndex + 1}`;

                if (shouldIncludeDocumentFiles) {
                    const step = sortedSteps[stepIndex];
                    const stepDocument = stepDocumentsById.get(step.documentId);
                    if (stepDocument) {
                        const submissionSiblings = stepDocument.submissionId
                            ? (submissionDocumentsBySubmissionId.get(stepDocument.submissionId) || [])
                            : [];
                        const candidates = [
                            stepDocument,
                            ...submissionSiblings.filter(doc => doc.id !== stepDocument.id),
                        ];

                        const appendedExtensions = new Set();
                        for (const doc of candidates) {
                            const extension = STUDY_DOCUMENT_EXTENSIONS[doc.type];
                            if (!extension || appendedExtensions.has(extension)) continue;
                            appendedExtensions.add(extension);
                            appendStoredFileIfExists(
                                server,
                                archive,
                                doc.hash,
                                extension,
                                `${stepFolder}/document${extension}`,
                                extension.slice(1).toUpperCase(),
                            );
                        }
                    }
                }

                for (const file of files) {
                    archive.append(file.content, { name: `${stepFolder}/${file.name}` });
                }
            }
        }
    }
}

/**
 * Exports usage statistics for the selected users, respecting each user's acceptStats consent.
 * @param {string} behaviourOutputFormat - 'single' for one combined file, 'perUser' for one file per user.
 */
async function processUserBehaviourExport(server, users, shouldGenerateAliases, hasPrivateInfoRight, userMapping, behaviourOutputFormat, behaviourFileFormat, baseFolderName, archive) {
    const { Op } = server.db.Sequelize;

    const consentedUsers = users.filter(u => u.acceptStats);
    if (consentedUsers.length === 0) return;
    const usersById = new Map(consentedUsers.map(u => [u.id, u]));
    const consentedUserIds = consentedUsers.map(u => u.id);
    const extension = behaviourFileFormat === 'csv' ? 'csv' : 'json';

    const parseStatData = (raw) => {
        try {
            return JSON.parse(raw);
        } catch (e) {
            return raw;
        }
    };

    const toRecord = (stat) => {
        const user = usersById.get(stat.userId);
        return {
            action: stat.action,
            data: behaviourFileFormat === 'csv' ? stat.data : parseStatData(stat.data),
            timestamp: stat.timestamp instanceof Date ? stat.timestamp.toISOString() : stat.timestamp,
            user: getDisplayName(user, shouldGenerateAliases, hasPrivateInfoRight, userMapping),
            username: user?.userName ?? null,
            userId: stat.userId,
            session: stat.session,
        };
    };

    const buildStream = (fetchPage) => behaviourFileFormat === 'csv'
        ? createCsvRowsStream(fetchPage, toRecord, ['action', 'data', 'timestamp', 'user', 'username', 'userId', 'session'])
        : createJsonArrayStream(fetchPage, toRecord);

    if (behaviourOutputFormat === 'perUser') {
        for (const user of consentedUsers) {
            const folderName = sanitizeFolderName(getDisplayName(user, shouldGenerateAliases, hasPrivateInfoRight, userMapping));
            const fetchPage = (lastId, limit) => server.db.models.statistic.findAll({
                where: { userId: user.id, deleted: false, id: { [Op.gt]: lastId } },
                order: [['id', 'ASC']],
                limit,
                raw: true,
            });
            archive.append(buildStream(fetchPage), { name: `${baseFolderName}/${folderName}/behaviour_data.${extension}` });
        }
    } else {
        const fetchPage = (lastId, limit) => server.db.models.statistic.findAll({
            where: { userId: { [Op.in]: consentedUserIds }, deleted: false, id: { [Op.gt]: lastId } },
            order: [['id', 'ASC']],
            limit,
            raw: true,
        });
        archive.append(buildStream(fetchPage), { name: `${baseFolderName}/behaviour_data.${extension}` });
    }
}

module.exports = {
    processDocumentForExport,
    processDocumentBasedExport,
    processStudyBasedExport,
    processUserBehaviourExport,
};
