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
const logger = require("../../utils/logger.js")( "sockets/annotation");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        socket.on("addAnnotation", async (data) => {
            try {
                await addAnnotation(data);

                //TODO fails to push the created comment to the frontend! Fix this or discard the comment from command.
                socket.emit("newAnnotation",
                    {
                        uid: socket.request.session.passport.user.id,
                        annotation: data.annotation,
                        document_id: data.document_id,
                        annotation_id: data.annotation_id,
                        tags: data.tags
                    }
                );
            } catch (e) {
                logger.error("Could not add annotation and/or comment to database. Error: " + e, {user: socket.request.session.passport.user.id});

                if(e.name === "InvalidAnnotationParameters"){
                    socket.emit("toast", {
                        message: "Annotation was not created",
                        title: e.message,
                        variant: 'danger'
                    });
                } else if(e.name === "InvalidCommentParameters") {
                    socket.emit("toast", {
                        message: "Comment on annotation was not created",
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
            const newSelector = null ? data.newSelector === undefined : data.newSelector;
            const newText = null ? data.newText === undefined : data.newText;
            const newTags = null ? data.newTags === undefined : data.newTags;
            const newComment = null ? data.newComment === undefined : data.newComment;

            try {
                await updateAnnotation(data.annotation_id, newSelector, newText, newComment, newTags);
            } catch (e) {
                 logger.error("Could not update annotation and/or comment in database. Error: " + e, {user: socket.request.session.passport.user.id});

                 if(e.name === "InvalidAnnotationParameters" || e.name === "InvalidCommentParameters"){
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

                if(e.name === "InvalidAnnotationParameters"){
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

            const mappedAnnos = annos.map(x => toFrontendRepresentationAnno(x));
            let mappedComments = Object();
            for (const c in comments) {
                if (comments[c].length > 0) {
                    mappedComments[c] = toFrontendRepresentationComm(comments[c]);
                }
            }

            socket.emit("loadAnnotations", {"annotations": mappedAnnos, "comments": mappedComments});
        });
    });


}