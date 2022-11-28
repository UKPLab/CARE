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
const logger = require("../../utils/logger.js")("sockets/documents");

const PDF_PATH = `${__dirname}/../../../files`;

exports = module.exports = function (io) {

    io.on("connection", (socket) => {


        const update_documents = async user_id => {
            let rows;
            try {
                rows = await loadDocs(user_id);
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
                socket.emit("update_docs", {"docs": [], "status": "FAIL"});
                return;
            }

            socket.emit("update_docs", {"docs": rows, "status": "OK"});
        }

        socket.on("docs_get", async (data) => {
            await update_documents(socket.request.session.passport.user.id);
        });

        socket.on("doc_delete", async (data) => {
            // TODO: Security Check - check if user can delete this document?
            try {
                await deleteDoc(data.docId)
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
                return;
            }

            await update_documents(socket.request.session.passport.user.id);
        });

        socket.on("doc_rename", async (data) => {
            // TODO check if user can rename this document?
            try {
                await renameDoc(data.docId, data.newName);
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
                return;
            }

            await update_documents(socket.request.session.passport.user.id);
        });

        socket.on("doc_upload", async (data) => {
            //Make sure upload directory exists
            fs.mkdirSync(PDF_PATH, {recursive: true});

            // Add document to database
            const name = data.name.replace(/.pdf$/, '');
            let doc;
            try {
                doc = await addDoc(name, socket.request.session.passport.user.id);
            } catch (err) {
                logger.error("Upload error: " + err, {user: socket.request.session.passport.user.id});
                socket.emit("upload_result", {success: false});
                return;
            }

            const pdf_id = doc.hash;
            const target = path.join(PDF_PATH, `${pdf_id}.pdf`);

            fs.writeFile(target, data.file, (err) => {
                socket.emit("upload_result", {success: err ? false : true, id: pdf_id})
            });

            //Update Document list
            update_documents(socket.request.session.passport.user.id)
        });

        socket.on("pdf_get", (data) => {
            try {
                const pdf = fs.readFileSync(`${PDF_PATH}/${data.document_id}.pdf`);
                socket.emit("pdf", {file: pdf});
            } catch (e) {
                logger.error(e, {user: socket.request.session.passport.user.id});
                socket.emit("toast", {
                    message: "Error while loading pdf file!",
                    title: "PDF Error",
                    variant: 'danger'
                });
            }
        });
    });
}