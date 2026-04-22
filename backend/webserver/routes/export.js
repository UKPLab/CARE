const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { faker } = require('@faker-js/faker');
const JSZip = require('jszip');
const { deriveUserSeed } = require('../auth/utils');
const Papa = require('papaparse');

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
        const { projectId, exportType, generateAliases, fakerSeed, gradeFormat } = req.body;
        let { userIds = [] } = req.body;
        const shouldGenerateAliases = String(generateAliases) === 'true';

        try {
            userIds = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;
            if (!Array.isArray(userIds)) userIds = [];
        } catch (e) {
            console.warn("Could not parse userIds:", userIds);
            userIds = [];
        }

        try {
            // check if the project is valid
            const projectCheck = await server.db.models.project.findOne({ where: { id: projectId } });
            if (!projectCheck) {
                console.warn(`${projectId} does not exist.`);
                return res.status(403).send("The selected project does not exist.");
            }

            const users = await server.db.models.user.findAll({ where: { id: userIds } });

            if (userIds.length === 0) {
                console.warn(`Export aborted: No authorized users to export.`);
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

            // process based on type
            switch (exportType) {
                case 'submissions': 
                    await processSubmissionsExport(
                        server,
                        projectId,
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
                        projectId,
                        userIds,
                        users,
                        shouldGenerateAliases,
                        hasPrivateInfoRight,
                        userMapping,
                        normalizedGradeFormat,
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
        const storageDir = path.join(__dirname, "..", "..", "..", "files");

        for (const submission of submissions) {
            const student = users.find(u => u.id === submission.userId);
            if (!student) continue;

            const validationRules = configMap.get(submission.validationConfigurationId);
            let folderName = shouldGenerateAliases ? userMapping[student.id] : (hasPrivateInfoRight ? `${student.firstName} ${student.lastName}` : `${student.userName}`);

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
                        const realName = `${student.firstName} ${student.lastName}`;
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

    function sanitizePathSegment(value) {
        return String(value || "unknown")
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
            .replace(/\s+/g, " ")
            .trim();
    }

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

    function getDisplayName(user, shouldGenerateAliases, hasPrivateInfoRight, userMapping) {
        if (shouldGenerateAliases) return userMapping[user.id];
        if (hasPrivateInfoRight) return `${user.firstName} ${user.lastName}`.trim();
        return user.userName;
    }

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

        const relatedUserIds = [...new Set([
            ...users.map((user) => user.id),
            ...studySessions.map((session) => session.userId),
            ...studies.map((study) => study.userId)
        ].filter(Boolean))];
        const relatedUsers = relatedUserIds.length > 0
            ? await server.db.models.user.findAll({ where: { id: { [Op.in]: relatedUserIds } }, raw: true })
            : [];
        const usersById = new Map(relatedUsers.map((user) => [user.id, user]));

        const roleMatches = relatedUserIds.length > 0
            ? await server.db.models.user_role_matching.findAll({
                where: { userId: { [Op.in]: relatedUserIds } },
                raw: true
            })
            : [];
        const roleIds = [...new Set(roleMatches.map((match) => match.userRoleId))];
        const roles = roleIds.length > 0
            ? await server.db.models.user_role.findAll({
                where: { id: { [Op.in]: roleIds } },
                attributes: ["id", "name"],
                raw: true
            })
            : [];
        const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
        const rolesByUserId = new Map();
        for (const match of roleMatches) {
            const roleName = roleNameById.get(match.userRoleId);
            if (!roleName) continue;
            if (!rolesByUserId.has(match.userId)) rolesByUserId.set(match.userId, []);
            rolesByUserId.get(match.userId).push(roleName);
        }

        const recordsByUser = new Map();
        for (const row of gradeRows) {
            const document = row.document;
            const ownerUser = usersById.get(document.userId);
            if (!ownerUser) continue;
            const session = sessionsById.get(row.studySessionId);
            const reviewerUser = session ? usersById.get(session.userId) : null;
            const study = session ? studiesById.get(session.studyId) : null;
            const graderUser = study ? usersById.get(study.userId) : null;
            const submission = document.submission;

            const scoreObject = row.value || {};
            const totalPoints =
                typeof scoreObject.total === "number"
                    ? scoreObject.total
                    : (typeof scoreObject.achieved_points === "number" ? scoreObject.achieved_points : null);

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
                roles: rolesByUserId.get(study?.userId) || [],
                grader: graderUser ? `${graderUser.firstName} ${graderUser.lastName}`.trim() : null,
                reviewer: reviewerUser ? `${reviewerUser.firstName} ${reviewerUser.lastName}`.trim() : null,
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
            const safeBase = sanitizePathSegment(raw);
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
                            roles: record.roles.join("|"),
                            grader: record.grader,
                            reviewer: record.reviewer,
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
};