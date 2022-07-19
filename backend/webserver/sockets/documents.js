/* Handle all document through websocket

Loading the document through websocket

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/
const {
    add: addDoc,
    deleteDoc: deleteDoc,
    rename: renameDoc,
    loadByUser: loadDocs
} = require("../../db/methods/document.js");
const fs = require("fs");
const path = require("path");
const logger = require("../../utils/logger.js")( "sockets/documents");

const PDF_PATH = `${__dirname}/../../../files`;

exports = module.exports = function (io) {

    io.on("connection", (socket) => {

        const update_documents = user_id => {
            loadDocs(user_id)
                .then((rows) => {
                    socket.emit("update_docs", {"docs": rows, "status": "OK"});
                })
                .catch((err) => {
                    logger.error(err, {user: socket.request.session.passport.user.id});
                    socket.emit("update_docs", {"docs": [], "status": "FAIL"});
                });
        }

        socket.on("docs_get", (data) => {
            update_documents(socket.request.session.passport.user.id);
        });

        socket.on("doc_delete", (data) => {
            // TODO: Security Check - check if user can delete this document?
            deleteDoc(data.docId)
                .then(() => update_documents(socket.request.session.passport.user.id))
                .catch((err) => {
                    logger.error(err, {user: socket.request.session.passport.user.id});
                    socket.emit("error", {err})
                });
        });

        socket.on("doc_rename", (data) => {
            // TODO check if user can rename this document?
            renameDoc(data.docId, data.newName)
                .then(() => update_documents(socket.request.session.passport.user.id))
                .catch((err) => {
                    logger.error(err, {user: socket.request.session.passport.user.id});
                    socket.emit("error", {err})
                });
        });

        socket.on("doc_upload", (data) => {
            //Make sure upload directory exists
            fs.mkdirSync(PDF_PATH, {recursive: true});

            // Add document to database
            const name = data.name.replace(/.pdf$/, '');
            addDoc(name, socket.request.session.passport.user.id)
                .then((doc) => {
                    const pdf_id = doc.hash;
                    const target = path.join(PDF_PATH, `${pdf_id}.pdf`);

                    fs.writeFile(target, data.file, (err) => {
                        socket.emit("upload_result", {success: err ? false : true, id: pdf_id})
                    });

                    //Update Document list
                    update_documents(socket.request.session.passport.user.id)
                })
                .catch((err) => {
                    logger.error("Upload error: " + err, {user: socket.request.session.passport.user.id});
                    socket.emit("upload_result", {success: false});
                });
        });

        socket.on("pdf_get", (data) => {
            try {
                const pdf = fs.readFileSync(`${PDF_PATH}/${data.document_id}.pdf`);
                socket.emit("pdf", {file: pdf});
            } catch(e) {
                logger.error(err, {user: socket.request.session.passport.user.id});
                socket.emit("toast", {
                        message: "Error while loading pdf file!",
                        title: "PDF Error",
                        variant: 'danger'
                    });
            }
        });

    });


}