const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

module.exports = function (server) {

    server.app.post('/export/project/stream', async function (req, res) {

        const currentUserId = req.user ? req.user.id : null;
        if (!currentUserId) {
            return res.status(401).send("Log in required");
        }
        const currentUser = await server.db.models.user.findByPk(currentUserId);
        if (!currentUser) return res.status(401).send("User not found");

        let isAdmin = false;
        try {
            const roleIds = await server.db.models["user_role_matching"].getUserRolesById(currentUserId);
            isAdmin = await server.db.models["user_role_matching"].isAdminInUserRoles(roleIds);
        } catch (error) {
            console.warn(`Could not check admin status for user ${currentUserId}:`, error);
        }
        if (!isAdmin) {
            parsedUserIds = [currentUserId];
        }

        try {
            const { projectId, exportType, userIds = [] } = req.body;
            let parsedUserIds = [];
            if (userIds) {
                try {
                    parsedUserIds = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;
                    if (!Array.isArray(parsedUserIds)) parsedUserIds = [];
                } catch (e) {
                    console.warn("Could not parse userIds:", userIds);
                    parsedUserIds = [];
                }
            }

            const projectCheck = await server.db.models.project.findOne({
                where: {
                    id: projectId
                }
            });

            if (!projectCheck) {
                console.warn(`User ${currentUserId} tried to export Project ${projectId} without access.`);
                return res.status(403).send("Forbidden: You do not have access to this project.");
            }

            const users = await server.db.models['user'].findAll({
                where: { id: parsedUserIds }
            });

            const allowedUsers = users.filter(u => 
                isAdmin || u.id === currentUserId
            );
            
            const allowedUserIds = allowedUsers.map(u => u.id);
            if (allowedUserIds.length === 0) {
                console.warn(`Export aborted: None of the requested users have accepted data sharing.`);
                return;
            }

            const exportFolderName = `${exportType}_${new Date().getTime()}.zip`;
            res.attachment(exportFolderName);

            const archive = archiver('zip', { zlib: { level: 5 } });

            archive.on('error', function(err) {
                console.error("Archiver Error:", err);
                if (!res.headersSent) res.status(500).send({error: err.message});
            });

            archive.pipe(res);

            switch (exportType) {
                case 'submissions': { 
                    const subs = await server.db.models['submission'].findAll({
                        where: { 
                            projectId, 
                            userId: allowedUserIds, 
                            parentSubmissionId: { [server.db.Sequelize.Op.is]: null }
                        },
                        include: [{
                            model: server.db.models['document'],
                            as: 'documents'
                        }]
                    });

                    const configIds = [...new Set(subs.map(s => s.validationConfigurationId).filter(id => id))];
                    const configs = await server.db.models['configuration'].findAll({
                        where: { id: configIds }
                    });

                    const configMap = new Map(configs.map(c => [c.id, c.content ? c.content.rules : null]));
                    const subMap = new Map(subs.map(d => [d.id, d]));

                    const extensionMap = {
                        0: ".pdf",
                        1: ".html",
                        4: ".zip"
                    };

                    for (const sub of subs) {
                        const student = allowedUsers.find(u => u.id === sub.userId);
                        if (!student) continue;

                        const validationRules = configMap.get(sub.validationConfigurationId);

                        for (const doc of sub.documents) {
                            let version = 1;
                            let currentSub = sub;

                            while(currentSub && currentSub.previousSubmissionId) {
                                const prevSub = subMap.get(currentSub.previousSubmissionId);
                                if (!prevSub) break;
                                version++;
                                currentSub = prevSub;
                            }

                            const folderName = `${student.firstName} ${student.lastName}`;
                            const storageDir = path.join(__dirname, "..", "..", "..", "files");
                            const extension = extensionMap[doc.type] || "";
                            const filePath = path.join(storageDir, `${doc.hash}${extension}`);

                            let exportName = doc.hash;
                            const originalName = doc.originalFilename || `${doc.name}${extension}` || "";

                            if (validationRules && validationRules.requiredFiles) {
                                for (const rule of validationRules.requiredFiles) {
                                    if (rule.exportName && new RegExp(rule.pattern, 'i').test(originalName)) {
                                        exportName = rule.exportName;
                                        break; 
                                    }
                                }
                            }

                            if (fs.existsSync(filePath)) {
                                const fileName = `${exportName}${extension}`;
                                archive.file(filePath, { name: `${exportFolderName}/${folderName}/version_${version}/${fileName}` });
                            } else {
                                console.error(`[NOT FOUND] Looking for: ${doc.hash} at ${filePath}`);
                            }
                        }
                    }
                    break;
                }
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
};