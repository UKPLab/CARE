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
        const { projectId, exportType, generateAliases, fakerSeed } = req.body;
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
                default:
                    console.warn(`Export type ${exportType} not implemented.`);
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

        const authorRegex = /\\author\s*\{[^}]*\}/g;

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.tex')) {
                let text = await zipEntry.async("string");
                text = text.replace(authorRegex, `\\author{${fakeName}}`);
                text = text.replace(realName.split(" ")[0], fakeName.split(" ")[0]);
                text = text.replace(realName.split(" ")[1], fakeName.split(" ")[1]);
                
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

            users.forEach(u => {
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