const { add:addAnnotation, deleteAnno:deleteAnnotation, updateAnno:updateAnnotation, loadByDocument:loadByDocument, toFrontendRepresentationAnno:toFrontendRepresentationAnno, toFrontendRepresentationComm: toFrontendRepresentationComm } = require('../../db/methods/annotation.js')

exports = module.exports = function(io) {
    io.on("connection", (socket) => {
        socket.on("addAnnotation", async (data) => {
            try {
                await addAnnotation(data);

                socket.emit("newAnnotation",
                {
                    uid: socket.request.session.passport.user.uid,
                    annotation: data.annotation,
                    document_id: data.document_id,
                    annotation_id: data.annotation_id
                }
                );
            } catch (e){
                socket.emit("newAnnotationError", {
                    uid: socket.request.session.passport.user.uid,
                    annotation_id: data.annotation_id,
                    cause: "SELECTION_LENGTH"
                });
            }
        });

        socket.on("updateAnnotation", (data) => {
            const newSelector = null ? data.newSelector === undefined : data.newSelector;
            const newText = null ?  data.newText === undefined : data.newText;
            const newTags = null ?  data.newTags === undefined : data.newTags;
            const newComment = null ? data.newComment === undefined : data.newComment;

            updateAnnotation(data.annotation_id, newSelector, newText, newComment, newTags);
        });

        socket.on("deleteAnnotation", (data) => {
            deleteAnnotation(data.id);
        });

        socket.on("loadAnnotations", async (data) => {
            const [annos, comments] = await loadByDocument(data.id);

            const mappedAnnos = annos.map(x => toFrontendRepresentationAnno(x));
            let mappedComments = Object();
            for(const c in comments){
                if(comments[c].length > 0) {
                    mappedComments[c] = toFrontendRepresentationComm(comments[c]);
                }
            }

            socket.emit("loadAnnotations", { "annotations": mappedAnnos, "comments": mappedComments });
        });
    });


}