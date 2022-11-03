/* Handle all annotation through websocket

Loading the document through websocket

Author: Dennis Zyska (zyska@ukp.informatik....), Nils Dycke (dycke@ukp...)
Source: --
*/
const {
    add: addAnnotation,
    deleteAnno: deleteAnnotation,
    updateAnno: updateAnnotation,
    loadByDocument: loadByDocument,
    toFrontendRepresentationAnno: toFrontendRepresentationAnno,
    toFrontendRepresentationComm: toFrontendRepresentationComm
} = require('../../db/methods/annotation.js')
const logger = require("../../utils/logger.js")("sockets/annotation");
const ObjectsToCsv = require('objects-to-csv');
const {mergeAnnosAndComments} = require("../../db/methods/annotation");
const {getByIds} = require("../../db/methods/tag");
const {sendTagsUpdate} = require("./utils/tag");
const {get: getTagset} = require("../../db/methods/tag_set");

//TODO adding rooms for document

exports = module.exports = function (io) {
    io.on("connection", (socket) => {
        socket.on("addAnnotation", async (data) => {
            try {
                socket.emit("annotationUpdate", await addAnnotation(data, socket.request.session.passport.user.id))
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

        socket.on("updateAnnotation", async (data) => {
            try {
                if (socket.request.session.passport.user.sysrole !== "admin") {
                    const origAnnotation = await getAnnotation(data.id);
                    if (origAnnotation.userId !== socket.request.session.passport.user.id) {
                        socket.emit("toast", {
                            message: "You have no permission to change this annotation",
                            title: "Annotation Not Saved",
                            variant: 'danger'
                        });
                        return;
                    }
                }
                const newAnno = await updateAnnotation(data);

                socket.to("doc:" + newAnno.document).emit("annotationUpdate", newAnno);

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

        socket.on("deleteAnnotation", async (data) => {
            try {
                await deleteAnnotation(data.id);
            } catch (e) {
                logger.info("Error during annotation deletion: " + e, {user: socket.request.session.passport.user.id});

                if (e.name === "InvalidAnnotationParameters") {
                    socket.emit("toast", {
                        message: "Failed to delete annotation",
                        title: e.message,
                        variant: 'danger'
                    });
                } else {
                    socket.emit("toast", {
                        message: "Internal server error. Failed to delete annotation.",
                        title: "Internal server error",
                        variant: 'danger'
                    });
                }
            }
        });

        socket.on("loadAnnotations", async (data) => {
            let res;
            try {
                res = await loadByDocument(data.id);
            } catch (e) {
                logger.info("Error during loading of annotations: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to load annotations.",
                    title: "Internal server error",
                    variant: 'danger'
                });
                return;
            }

            const annos = res[0];
            const comments = res[1];

            const tags = [...new Set([].concat(...annos.map(a => JSON.parse(a.tags))))];
            await sendTagsUpdate(socket, await getByIds(tags))


            const mappedAnnos = await Promise.all(annos.map(async x => await toFrontendRepresentationAnno(x)));
            let mappedComments = Object();
            for (const c in comments) {
                if (comments[c].length > 0) {
                    mappedComments[c] = await toFrontendRepresentationComm(comments[c]);
                }
            }

            socket.emit("loadAnnotations", {"annotations": mappedAnnos, "comments": mappedComments});
        });

        socket.on("exportAnnotations", async (data) => {
            if (Array.isArray(data)) {
                const annosWithComments = await Promise.all(data.map(async docid => {
                    try {
                        const doc = await loadByDocument(docid);
                        // check for permission
                        if (socket.request.session.passport.user.sysrole !== "admin" && !doc.owner === socket.request.session.passport.user.id) {
                            return null;
                        } else {
                            return doc;
                        }
                    } catch (e) {
                        logger.info("Error during loading of annotations: " + e, {
                            docid: docid,
                            user: socket.request.session.passport.user.id
                        });

                        socket.emit("toast", {
                            message: "Internal server error. Failed to export annotations.",
                            title: "Internal server error",
                            variant: 'danger'
                        });
                    }
                }));

                const mappedAnnos = await mergeAnnosAndComments(annosWithComments.filter(x => x !== null))

                const csvStr = await Promise.all(mappedAnnos.map(async annosPerDoc => {
                    const csv = new ObjectsToCsv(annosPerDoc);
                    return await csv.toString(true, true);
                }));

                socket.emit("exportedAnnotations", {success: true, csvs: csvStr, docids: data});
            } else {
                logger.info("Invalid parameter for exportAnnotations. Has to be an array of doc-ids: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to export annotations.",
                    title: "Internal server error",
                    variant: 'danger'
                });
            }
        });
    });


}