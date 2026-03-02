const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

module.exports = function (server) {

    server.app.post('/export/project/stream', async function (req, res) {

        const currentUserId = req.user ? req.user.id : null;
        if (!currentUserId) {
            return res.status(401).send("Log in required");
        }

        try {
            const currentUser = await server.db.models.user.findByPk(currentUserId);
            if (!currentUser) return res.status(401).send("User not found");

            const { projectId, exportType, userIds = [] } = req.body;
            
            let parsedUserIds = Array.isArray(userIds) ? userIds : [];

            let isAdmin = false;
            try {
                const roleIds = await server.db.models["user_role_matching"].getUserRolesById(currentUserId);
                isAdmin = await server.db.models["user_role_matching"].isAdminInUserRoles(roleIds);
            } catch (error) {
                console.warn(`Could not check admin status for user ${userId}:`, error);
            }
            if (!isAdmin) {
                parsedUserIds = [currentUserId];
            }

            const projectCheck = await server.db.models.project.findOne({
                where: {
                    id: projectId
                }
            });

            if (!projectCheck) {
                console.warn(`User ${userId} tried to export Project ${projectId} without access.`);
                return res.status(403).send("Forbidden: You do not have access to this project.");
            }

            const filename = `${exportType}_${new Date().getTime()}.zip`;
            res.attachment(filename);
            
            res.set('Access-Control-Expose-Headers', 'Content-Disposition');

            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('error', function(err) {
                console.error("Archiver Error:", err);
                if (!res.headersSent) res.status(500).send({error: err.message});
            });

            archive.pipe(res);

            switch (exportType) {
                case 'submissions': { 
                    const users = await server.db.models['user'].findAll({
                        where: { id: parsedUserIds }
                    });

                    const allowedUsers = users.filter(u => 
                        u.acceptDataSharing === true || u.id === userId
                    );

                    const allowedUserIds = allowedUsers.map(u => u.id);

                    if (allowedUserIds.length === 0) {
                        console.warn(`Export aborted: None of the requested users have accepted data sharing.`);
                        archive.append('No users matched the criteria or consented to data sharing.', { name: 'export_info.txt' });
                        break; 
                    }

                    const docs = await server.db.models['document'].findAll({
                        where: { 
                            projectId, 
                            userId: allowedUserIds, 
                            submissionId: { [server.db.Sequelize.Op.ne]: null }
                        },
                    });

                    const extensionMap = {
                        0: ".pdf",
                        1: ".html",
                        4: ".zip"
                    };

                    for (const doc of docs) {
                        const student = allowedUsers.find(u => u.id === doc.userId);
                        if (student) {
                            const folderName = `${student.firstName} ${student.lastName}`;
                            const storageDir = path.join(__dirname, "..", "..", "..", "files");
                            const extension = extensionMap[doc.type] || "";
                            const filePath = path.join(storageDir, `${doc.hash}${extension}`);

                            if (fs.existsSync(filePath)) {
                                const fileName = `${doc.name}${extension}`;
                                archive.file(filePath, { name: `${folderName}/${fileName}` });
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