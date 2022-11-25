/* Handle all annotation through websocket

Loading the document through websocket

Author: Dennis Zyska (zyska@ukp.informatik....), Nils Dycke (dycke@ukp...)
Source: --
*/
const {
    add: addAnnotation,
    update: updateAnnotation,
    get: getAnnotation,
    loadByDocument: loadByDocument,
    formatForExport: formatForExport
} = require('../../db/methods/annotation.js')
const logger = require("../../utils/logger.js")("sockets/annotation");
const ObjectsToCsv = require('objects-to-csv');
const {getByIds} = require("../../db/methods/tag");
const {sendTagsUpdate} = require("./utils/tag");
const {get: getTagset} = require("../../db/methods/tag_set");
const {
    updateCreatorName
} = require("./utils/user.js")
const {loadCommentsByAnnotation, addComment, deleteChildCommentsByAnnotation} = require("./utils/comment");
const {checkDocumentAccess} = require("./utils/user");

exports = module.exports = function (io) {


    io.on("connection", (socket) => {
        socket.on("addAnnotation", async (data) => {
            try {
                const annotation = await updateCreatorName(await addAnnotation(data, socket.request.session.passport.user.id))
                await addComment(socket, annotation[0].document, annotation[0].id);

                socket.emit("annotationUpdate", annotation)
            } catch (e) {
                logger.error("Could not add annotation and/or comment to database. Error: " + e, {user: socket.request.session.passport.user.id});

                if (e.name === "InvalidAnnotationParameters") {
                    socket.emit("toast", {
                        message: "Annotation was not created",
                        title: e.message,
                        variant: 'danger'
                    });
                } else {
                    socket.emit("toast", {
                        message: "Internal server error. Failed to create annotation.",
                        title: "Internal server error",
                        variant: 'danger'
                    });
                }
            }
        });

        socket.on("getAnnotation", async (data) => {
            try {
                const anno = await getAnnotation(data.id);

                if (socket.request.session.passport.user.sysrole !== "admin") {

                    if (anno.creator !== socket.request.session.passport.user.id
                    && !checkDocumentAccess(data.document_id, socket.request.session.passport.user.id)
                    ) {
                        socket.emit("toast", {
                            message: "You have no permission to change this annotation",
                            title: "Annotation Not Saved",
                            variant: 'danger'
                        });
                        return;
                    }
                }

                await loadCommentsByAnnotation(socket, anno.id);
                socket.emit("annotationUpdate", await updateCreatorName(anno));

            } catch (e) {
                logger.error("Could not get annotation and/or comment in database. Error: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to update annotation.",
                    title: "Internal server error",
                    variant: 'danger'
                });
            }
        });

        socket.on("updateAnnotation", async (data) => {
            try {
                if (socket.request.session.passport.user.sysrole !== "admin") {
                    const origAnnotation = await getAnnotation(data.id);
                    if (origAnnotation.creator !== socket.request.session.passport.user.id) {
                        socket.emit("toast", {
                            message: "You have no permission to change this annotation",
                            title: "Annotation Not Saved",
                            variant: 'danger'
                        });
                        return;
                    }
                }
                const newAnno = await updateAnnotation(data);
                console.log(newAnno);
                if (newAnno[1].deleted) {
                    await deleteChildCommentsByAnnotation(io, socket, newAnno[1].id);
                }

                io.to("doc:" + newAnno[1].document).emit("annotationUpdate", await updateCreatorName(newAnno[1].get({plain: true})));

            } catch (e) {
                logger.error("Could not update annotation and/or comment in database. Error: " + e, {user: socket.request.session.passport.user.id});

                if (e.name === "InvalidAnnotationParameters" || e.name === "InvalidCommentParameters") {
                    socket.emit("toast", {
                        message: "Failed to update annotation",
                        title: e.message,
                        variant: 'danger'
                    });
                } else {
                    socket.emit("toast", {
                        message: "Internal server error. Failed to update annotation.",
                        title: "Internal server error",
                        variant: 'danger'
                    });
                }
            }
        });

        socket.on("loadAnnotations", async (data) => {
            try {
                console.log(await updateCreatorName(await loadByDocument(data.id)));

                socket.emit("annotationUpdate", await updateCreatorName(await loadByDocument(data.id)));
            } catch (e) {
                logger.info("Error during loading of annotations: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to load annotations.",
                    title: "Internal server error",
                    variant: 'danger'
                });
            }
        });

        socket.on("exportByDocument", async (data) => {
            let annotations;
            try {
               annotations = await loadByDocument(data.document_id);
            } catch (e) {
                logger.info("Error during loading of annotations: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to load annotations.",
                    title: "Internal server error",
                    variant: 'danger'
                });
                socket.emit("exportedAnnotations", {"success": false, "document_id": data.document_id});

                return;
            }

            socket.emit("exportedAnnotations", {
                "success": true,
                "document_id": data.document_id,
                "objs": await Promise.all(annotations.map(async (a) => await formatForExport(a)))
            });
        });
    });
}