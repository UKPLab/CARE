const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { faker } = require('@faker-js/faker');
const JSZip = require('jszip');
const { deriveUserSeed } = require('../auth/utils');
const Papa = require('papaparse');
const { dbToDelta, deltaToPlainText, deltaToHtml } = require('editor-delta-conversion');
const storageDir = path.join(__dirname, "..", "..", "..", "files");
const { calculateAssessmentScore, buildScoresFromState } = require('assessment-score');

module.exports = function (server) {

    server.app.post('/export/stream', async function (req, res) {

        // Auth checking
        const currentUserId = req.user?.id;
        if (!currentUserId) return res.status(401).send("Log in required");

        const currentUser = await server.db.models.user.findByPk(currentUserId);
        if (!currentUser) return res.status(401).send("User not found");

        // check if user has right to see full names
        let hasPrivateInfoRight = false;

        const roleIds = await server.db.models["user_role_matching"].getUserRolesById(currentUserId);
        const isAdmin = await server.db.models["user_role_matching"].isAdminInUserRoles(roleIds);
        if (isAdmin) {
            // override, admin has all rights
            hasPrivateInfoRight = true;
        } else {
            const userRightsObj = await server.db.models.user.getUserRights(currentUserId);  
            
            if (userRightsObj) {
                const allRights = Object.values(userRightsObj).flat();
                hasPrivateInfoRight = allRights.includes('frontend.dashboard.studies.view.userPrivateInfo');
            }
        }

        // Input parsing
        const { projectId, exportType, generateAliases, fakerSeed, gradeFormat, excludeNonConsentingEdits, excludeNonConsentingAnnotations, includeEmptyStudies } = req.body;
        let { userIds = [], documentTypes = [0, 1, 2, 4] } = req.body;
        const shouldGenerateAliases = String(generateAliases) === 'true';
        const shouldExcludeNonConsentingEdits = String(excludeNonConsentingEdits) === 'true';
        const shouldExcludeNonConsentingAnnotations = String(excludeNonConsentingAnnotations) === 'true';
        const normalizedGradeFormat = String(gradeFormat || "json").toLowerCase();
        const shouldIncludeEmptyStudies = String(includeEmptyStudies) === 'true';
        const supportedExportTypes = new Set(["submissions", "grades", "documents", "studies"]);
        const { Op } = server.db.Sequelize;
        const parsedProjectId = Number(projectId);

        try {
            userIds = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;
            if (!Array.isArray(userIds)) userIds = [];
        } catch (e) {
            console.warn("Could not parse userIds:", userIds);
            userIds = [];
        }

        try {
            if (!Number.isInteger(parsedProjectId)) return res.status(400).send("Missing projectId.");
            if (!supportedExportTypes.has(exportType)) {
                return res.status(400).send("Unsupported export type.");
            }

            workflowIds = typeof workflowIds === 'string' ? JSON.parse(workflowIds) : workflowIds;
            if (!Array.isArray(workflowIds)) workflowIds = [];

            if (exportType === "grades" && !["json", "csv"].includes(normalizedGradeFormat)) {
                return res.status(400).send("Unsupported grade format. Use json or csv.");
            }
            if (userIds.length === 0) {
                console.warn("Export aborted: No valid users selected.");
                return res.status(400).send("No valid users selected.");
            }

            const projectCheck = await server.db.models.project.findOne({ where: { id: parsedProjectId } });
            if (!projectCheck) {
                console.warn(`${parsedProjectId} does not exist.`);
                return res.status(403).send("The selected project does not exist.");
            }

            const users = await server.db.models.user.findAll({ where: { id: { [Op.in]: userIds } } });
            if (users.length === 0) {
                console.warn("Export aborted: No existing users to export.");
                return res.status(400).send("No authorized users to export.");
            }

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
                        archive
                    );
                    break;
                case 'documents':
                    await processDocumentBasedExport(
                        server,
                        projectId,
                        userIds,
                        documentTypes,
                        shouldExcludeNonConsentingEdits,
                        baseFolderName,
                        archive
                    );
                    break;
                case 'studies':
                    await processStudyBasedExport(
                        server,
                        projectId,
                        userIds,
                        workflowIds,
                        shouldIncludeEmptyStudies,
                        shouldExcludeNonConsentingEdits,
                        shouldExcludeNonConsentingAnnotations,
                        baseFolderName,
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

    // HELPER FUNCTIONS

    /**
     * Opens a zip file, replaces the student's real name with a fake name in all .tex files,
     * and returns the modified zip as a Buffer.
     * @param {string} filePath - Path to the original zip file on disk
     * @param {string} realName - The student's real name to search for
     * @param {string} fakeName - The generated fake name to insert
     * @returns {Promise<Buffer>} - The newly generated zip file buffer
     */
    async function replaceAuthorInZip(filePath, realName, fakeName) {
        const fileData = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(fileData);

         // TODO: What if the realName contains middle name?
        const [realFirstName = "", realLastName = ""] = String(realName || "").split(/\s+/, 2);
        const [fakeFirstName = "", fakeLastName = ""] = String(fakeName || "").split(/\s+/, 2);

        const authorRegex = /\\author\s*\{[^}]*\}/g;

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.tex')) {
                let text = await zipEntry.async("string");
                text = text.replace(authorRegex, `\\author{${fakeName}}`);
                if (realFirstName && fakeFirstName) text = text.replace(realFirstName, fakeFirstName);
                if (realLastName && fakeLastName) text = text.replace(realLastName, fakeLastName);
                
                zip.file(relativePath, text); 
            }
        }

        return await zip.generateAsync({ 
            type: "nodebuffer", 
            compression: "DEFLATE" 
        });
    }

    /**
     * Constructs a mapping of user IDs to aliases and generates a 
     * corresponding CSV string.
     * @param {Array<Object>} users - Array of user objects from the database.
     * @param {boolean} shouldGenerateAliases - Whether the export should use fake names.
     * @param {boolean} hasPrivateInfoRight - Whether the current user is allowed to see/export full names.
     * @param {number|string} fakerSeed - The base integer seed (from the form input).
     * @param {string} salt - The hex-encoded salt string from the user's database record.
     * @returns {Object} An object containing:
     * - userMapping: An object mapping user IDs to their generated fake names.
     * - mappingCsv: A CSV-formatted string containing the mapping (conditionally includes real names).
     */
    function buildUserMapping(users, shouldGenerateAliases, hasPrivateInfoRight, fakerSeed, salt) {
        let userMapping = {};
        let csvRows = [];

        if (shouldGenerateAliases) {
            if (fakerSeed && !isNaN(parseInt(fakerSeed, 10))) {
                const derivedFakerSeed = deriveUserSeed(parseInt(fakerSeed, 10), salt);
                faker.seed(derivedFakerSeed);
            }

            const sortedUsers = [...users].sort((a, b) => Number(a.id) - Number(b.id));
            sortedUsers.forEach(u => {
                const realUsername = u.userName;
                const realName = `${u.firstName} ${u.lastName}`;
                const fakeName = `${faker.person.firstName()} ${faker.person.lastName()}`;
                
                userMapping[u.id] = fakeName;

                let rowData = {
                    "Username": realUsername
                };
                if (hasPrivateInfoRight) {
                    rowData["Real Name"] = realName;
                }

                rowData["Generated Alias"] = fakeName;

                csvRows.push(rowData);
            });
        }
        const mappingCsv = csvRows.length > 0 ? Papa.unparse(csvRows) : "";
        return { userMapping, mappingCsv };
    }

    /**
     * Does the fetching, filtering, and archiving of student submissions for a specific project.
     * Handles file renaming based on validation rules and manages directory structures
     * (Student Name/Version/File) within the ZIP archive.
     * @param {Object} server - The server instance providing database models and Sequelize operators.
     * @param {number|string} projectId - The ID of the project to export submissions from.
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

        const extensionMap = {
            0: ".pdf",
            1: ".html",
            4: ".zip"
        };

        for (const submission of submissions) {
            const student = users.find(u => u.id === submission.userId);
            if (!student) continue;

            const validationRules = configMap.get(submission.validationConfigurationId);
            let folderName = shouldGenerateAliases ? userMapping[student.id] : (hasPrivateInfoRight ? `${student.firstName} ${student.lastName}` : `${student.userName}`);
            folderName = sanitizeFolderName(folderName);

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
     * Normalizes a folder name so it is safe to use inside a ZIP archive.
     *
     * @param {string|number|null|undefined} value - The raw folder name.
     * @returns {string} A sanitized folder name with reserved characters replaced.
     */
    function sanitizeFolderName(value) {
        return String(value || "unknown")
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Flattens a nested object into dot-notation keys.
     *
     * @param {any} value - The input value to flatten.
     * @param {string} [prefix=""] - The prefix to prepend to nested keys.
     * @param {Object} [out={}] - The accumulator object.
     * @returns {Object} The flattened object.
     */
    function flattenObject(value, prefix = "", out = {}) {
        if (value === null || value === undefined) return out;
        if (typeof value !== "object" || Array.isArray(value)) {
            out[prefix] = value;
            return out;
        }

        for (const [key, child] of Object.entries(value)) {
            const nextPrefix = prefix ? `${prefix}.${key}` : key;
            flattenObject(child, nextPrefix, out);
        }
        return out;
    }

    /**
     * Parses an assessment state payload when it is stored as JSON text.
     *
     * @param {string} rawAssessmentState - The raw JSON string from document_data.
     * @returns {Object} The parsed assessment state or an empty object on failure.
     */
    function parseAssessmentState(rawAssessmentState) {
        try {
            const parsed = JSON.parse(rawAssessmentState);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            console.warn("Failed to parse assessment state:", error.message);
            return {};
        }
    }

    /**
     * Resolves the assessment rubric configuration from a study step.
     * Study steps store a reference (configurationId); rubrics live in the configuration table.
     *
     * @param {Object|null|undefined} studyStepConfiguration - The study step's configuration JSON.
     * @param {Map<number, Object>} configurationsById - Loaded configuration records by id.
     * @returns {Object|null} Assessment config content (with rubrics) or null.
     */
    function resolveAssessmentConfigurationContent(studyStepConfiguration, configurationsById) {
        if (!studyStepConfiguration || typeof studyStepConfiguration !== "object") return null;

        const configurationId =
            studyStepConfiguration.settings?.configurationId ??
            studyStepConfiguration.configurationId ??
            null;

        if (configurationId != null) {
            const configuration = configurationsById.get(Number(configurationId));
            if (configuration?.content) return configuration.content;
        }

        return Array.isArray(studyStepConfiguration.rubrics) ? studyStepConfiguration : null;
    }

    /**
     * Resolves the display name for a user based on the current export settings.
     *
     * @param {Object} user - The user record to display.
     * @param {boolean} shouldGenerateAliases - Whether aliases should replace real names.
     * @param {boolean} hasPrivateInfoRight - Whether the current user may export real names.
     * @param {Object<number, string>} userMapping - Map of user IDs to generated aliases.
     * @returns {string} The display name to write into the export.
     */
    function getDisplayName(user, shouldGenerateAliases, hasPrivateInfoRight, userMapping) {
        if (shouldGenerateAliases) return userMapping[user.id];
        if (hasPrivateInfoRight) return `${user.firstName} ${user.lastName}`.trim();
        return user.userName;
    }

    /**
     * Exports assessment results for the selected users as a ZIP archive.
     * Each selected user gets one or more hash-named folders containing
     * either JSON or CSV score files depending on the requested format.
     *
     * @param {Object} server - The server instance providing database models and Sequelize operators.
     * @param {number|string} projectId - The project whose grades should be exported.
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
        archive
    ) {
        const { Op } = server.db.Sequelize;
        const gradeRows = await server.db.models.document_data.findAll({
            where: {
                key: "assessment_result",
                deleted: false,
                studySessionId: { [Op.ne]: null }
            },
            include: [{
                model: server.db.models.document,
                as: "document",
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
            order: [["studySessionId", "ASC"], ["studyStepId", "ASC"], ["createdAt", "ASC"]]
        });

        const sessionIds = [...new Set(gradeRows.map((row) => row.studySessionId).filter(Boolean))];
        const studySessions = sessionIds.length > 0
            ? await server.db.models.study_session.findAll({
                where: { id: { [Op.in]: sessionIds }, deleted: false },
                raw: true
            })
            : [];
        const sessionsById = new Map(studySessions.map((session) => [session.id, session]));

        const studyIds = [...new Set(studySessions.map((session) => session.studyId).filter(Boolean))];
        const studies = studyIds.length > 0
            ? await server.db.models.study.findAll({
                where: { id: { [Op.in]: studyIds }, deleted: false },
                raw: true
            })
            : [];
        const studiesById = new Map(studies.map((study) => [study.id, study]));

        const studyStepIds = [...new Set(gradeRows.map((row) => row.studyStepId).filter(Boolean))];
        const studySteps = studyStepIds.length > 0
            ? await server.db.models.study_step.findAll({
                where: { id: { [Op.in]: studyStepIds }, deleted: false },
                raw: true
            })
            : [];
        const studyStepsById = new Map(studySteps.map((studyStep) => [studyStep.id, studyStep]));

        const configurationIds = [...new Set(
            studySteps
                .map((studyStep) => studyStep.configuration)
                .filter((cfg) => cfg && typeof cfg === "object")
                .map((cfg) => cfg.settings?.configurationId ?? cfg.configurationId)
                .filter((id) => id != null)
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id))
        )];
        const configurations = configurationIds.length > 0
            ? await server.db.models.configuration.findAll({
                where: { id: { [Op.in]: configurationIds }, deleted: false },
                raw: true
            })
            : [];
        const configurationsById = new Map(configurations.map((configuration) => [configuration.id, configuration]));

        const relatedUserIds = [...new Set([
            ...users.map((user) => user.id),
            ...studySessions.map((session) => session.userId),
            ...studies.map((study) => study.userId)
        ].filter(Boolean))];
        const relatedUsers = relatedUserIds.length > 0
            ? await server.db.models.user.findAll({ where: { id: { [Op.in]: relatedUserIds } }, raw: true })
            : [];
        const usersById = new Map(relatedUsers.map((user) => [user.id, user]));

        const recordsByUser = new Map();
        for (const row of gradeRows) {
            const document = row.document;
            const ownerUser = usersById.get(document.userId);
            if (!ownerUser) continue;
            const session = sessionsById.get(row.studySessionId);
            const reviewerUser = session ? usersById.get(session.userId) : null;
            const study = session ? studiesById.get(session.studyId) : null;
            const graderUser = study ? usersById.get(study.userId) : null;
            const studyStep = studyStepsById.get(row.studyStepId);
            const submission = document.submission;

            const scoreObject = row.value || {};
            const assessmentState = typeof scoreObject === "string" ? parseAssessmentState(scoreObject) : scoreObject;
            const flatScores = buildScoresFromState(assessmentState);
            const assessmentConfig = resolveAssessmentConfigurationContent(
                studyStep?.configuration,
                configurationsById
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
                sessionHash: session?.hash ?? null,
                studyOwner: graderUser ? `${graderUser.firstName} ${graderUser.lastName}`.trim() : null,
                sessionOwner: reviewerUser ? `${reviewerUser.firstName} ${reviewerUser.lastName}`.trim() : null,
                author: ownerUser ? `${ownerUser.firstName} ${ownerUser.lastName}`.trim() : null,
                scores: scoreObject,
                totalPoints,
                createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
                sourceKey: "assessment_result"
            };

            if (!recordsByUser.has(ownerUser.id)) recordsByUser.set(ownerUser.id, []);
            recordsByUser.get(ownerUser.id).push(record);
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

        for (const user of users) {
            const records = (recordsByUser.get(user.id) || []).sort((a, b) => {
                const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return (
                    (a.studySessionId || 0) - (b.studySessionId || 0) ||
                    (a.studyStepId || 0) - (b.studyStepId || 0) ||
                    createdA - createdB
                );
            });

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
                    const csvRows = exportedRecords.map((record) => {
                        const flatScores = flattenObject(record.scores, "scores");
                        return {
                            projectId: record.projectId,
                            userId: record.userId,
                            userExtId: record.userExtId,
                            userName: record.userName,
                            displayName: record.displayName,
                            submissionId: record.submissionId,
                            submissionExtId: record.submissionExtId,
                            studySessionId: record.studySessionId,
                            studyStepId: record.studyStepId,
                            studyOwner: record.studyOwner,
                            sessionOwner: record.sessionOwner,
                            author: record.author,
                            totalPoints: record.totalPoints,
                            createdAt: record.createdAt,
                            sourceKey: record.sourceKey,
                            ...flatScores
                        };
                    });
                    archive.append(Papa.unparse(csvRows), { name: `${hashFolder}/scores.csv` });
                } else {
                    archive.append(JSON.stringify(exportedRecords, null, 2), { name: `${hashFolder}/scores.json` });
                }
            }
        }
    }

    /**
     * Calculates the version number of a submission by traversing backwards 
     * through the chain of previous submissions.
     * @param {Object} submission - The current submission object to start from.
     * @param {Map<number|string, Object>} submissionMap - A Map containing all related 
     * submissions for quick lookup by ID.
     * @returns {number} - The calculated version number (starting at 1 for the original).
     */
    function calculateSubmissionVersion(submission, submissionMap) {
        let version = 1;
        let currentSub = submission;
        while (currentSub && currentSub.previousSubmissionId) {
            const prevSub = submissionMap.get(currentSub.previousSubmissionId);
            if (!prevSub) break;
            version++;
            currentSub = prevSub;
        }
        return version;
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
            hash: doc.hash,
            type: doc.type,
            userId: doc.userId,
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

                if (shouldExcludeNonConsentingAnnotations) {
                    const allUserIds = [...new Set([
                        ...annotations.map(a => a.userId),
                        ...comments.map(c => c.userId),
                    ].filter(Boolean))];
                    const annotationUsers = await server.db.models.user.findAll({
                        where: { id: allUserIds },
                        attributes: ['id', 'acceptDataSharing'],
                        raw: true,
                    });
                    const consentedUserIds =  new Set(
                        annotationsUsers.filter(u => u.acceptDataSharing).map(u => u.id)
                    );
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

                const pdfPath = path.join(storageDir, `${doc.hash}.pdf`);
                if (fs.existsSync(pdfPath)) {
                    archive.file(pdfPath, { name: `${docFolder}/document.pdf` });
                } else {
                    console.warn(`[DocumentExport] PDF not found for document ${doc.hash}`);
                }
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
                    const editorUsers = await server.db.models.user.findAll({
                        where: { id: editorUserIds },
                        attributes: ['id', 'acceptDataSharing'],
                        raw: true,
                    });
                    const consentedUserIds = new Set(
                        editorUsers.filter(u => u.acceptDataSharing).map(u => u.id)
                    );
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
                const zipPath = path.join(storageDir, `${doc.hash}.zip`);
                if (fs.existsSync(zipPath)) {
                    archive.file(zipPath, { name: `${docFolder}/document.zip` });
                } else {
                    console.warn(`[DocumentExport] ZIP not found for document ${doc.hash}`);
                }
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
    async function processDocumentBasedExport(server, projectId, userIds, documentTypes, shouldExcludeNonConsentingEdits, shouldExcludeNonConsentingAnnotations, baseFolderName, archive) {
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

    function sortSteps(items, prevKey) {
        const sorted = [];
        let current = items.find(item => item[prevKey] === null);
        while (current) {
            sorted.push(current);
            current = items.find(item => item[prevKey] === current.id);
        }
        return sorted;
    }

    async function processStudyBasedExport(server, projectId, userIds, workflowIds, shouldIncludeEmptyStudies, shouldExcludeNonConsentingEdits, shouldExcludeNonConsentingAnnotations, baseFolderName, archive) {
        const studyWhere = { userId: userIds, projectId, deleted: false };
        if (workflowIds.length > 0) studyWhere.workflowId = workflowIds;

        const studies = await server.db.models.study.findAll({ where: studyWhere });

        if (studies.length === 0) {
            console.warn(`[StudyExport] No studies found for selected users in project ${projectId}`);
            return;
        }

        for (const study of studies) {
            const studyFolder = `${baseFolderName}/${study.hash}`;

            const allSteps = await server.db.models.study_step.findAll({
                where: { studyId: study.id, deleted: false }
            });
            const sortedSteps = sortSteps(allSteps, 'studyStepPrevious');

            const sessions = await server.db.models.study_session.findAll({
                where: { studyId: study.id, deleted: false },
                raw: true,
            });

            if (!shouldIncludeEmptyStudies && sessions.length === 0) continue;

            const studyMeta = {
                id: study.id,
                name: study.name,
                userId: study.userId,
                workflowId: study.workflowId,
                sessions: sessions.map(session => ({
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

            for (const session of sessions) {
                const sessionFolder = `${studyFolder}/${session.hash}`;

                for (let i = 0; i < sortedSteps.length; i++) {
                    const step = sortedSteps[i];
                    const stepFolder = `${sessionFolder}/step_${i + 1}`;

                    switch (step.stepType) {
                        case 1: { // Annotator
                            let annotations = await server.db.models.annotation.findAll({
                                where: { documentId: step.documentId, studySessionId: session.id, studyStepId: step.id, deleted: false },
                                raw: true,
                            });

                            let comments = await server.db.models.comment.findAll({
                                where: { documentId: step.documentId, studySessionId: session.id, studyStepId: step.id, deleted: false },
                                raw: true,
                            });

                            if (shouldExcludeNonConsentingAnnotations) {
                                const allUserIds = [...new Set([
                                    ...annotations.map(a => a.userId),
                                    ...comments.map(c => c.userId)
                                ].filter(Boolean))];
                                const consentedUsers = await server.db.models.user.findAll({
                                    where: { id: allUserIds },
                                    attributes: ['id', 'acceptDataSharing'],
                                    raw: true,
                                });
                                const consentedIds = new Set(consentedUsers.filter(u => u.acceptDataSharing).map(u => u.id));
                                annotations = annotations.filter(a => !a.userId || consentedIds.has(a.userId));
                                comments = comments.filter(c => !c.userId || consentedIds.has(c.userId));
                            }

                            if (annotations.length > 0) {
                                archive.append(JSON.stringify(annotations, null, 2), { name: `${stepFolder}/annotations.json` });
                            }

                            if (comments.length > 0) {
                                const commentVotes = await server.db.models.comment_vote.findAll({
                                    where: { commentId: comments.map(c => c.id), deleted: false },
                                    raw: true,
                                });
                                archive.append(JSON.stringify(
                                    comments.map(c => ({ ...c, votes: commentVotes.filter(v => v.commentId === c.id) })),
                                    null, 2
                                ), { name: `${stepFolder}/comments.json` });
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
                                const editorUsers = await server.db.models.user.findAll({
                                    where: { id: editorUserIds },
                                    attributes: ['id', 'acceptDataSharing'],
                                    raw: true,
                                });
                                const consentedIds = new Set(editorUsers.filter(u => u.acceptDataSharing).map(u => u.id));
                                edits = edits.filter(e => !e.userId || consentedIds.has(e.userId));
                            }

                            if (edits.length > 0) {
                                const delta = dbToDelta(edits);
                                const text = deltaToPlainText(delta);
                                if (text.trim()) {
                                    archive.append(JSON.stringify(edits, null, 2), { name: `${stepFolder}/edits.json` });
                                    archive.append(text,                           { name: `${stepFolder}/text.txt` });
                                    archive.append(deltaToHtml(delta),             { name: `${stepFolder}/html.html` });
                                }
                            }

                            const documentData = await server.db.models.document_data.findAll({
                                where: { documentId: step.documentId, studySessionId: session.id, studyStepId: step.id, deleted: false },
                                raw: true,
                            });
                            if (documentData.length > 0) {
                                archive.append(JSON.stringify(documentData, null, 2), { name: `${stepFolder}/document_data.json` });
                            }
                            break;
                        }
                    }
                }
            }
        }
    }
};
