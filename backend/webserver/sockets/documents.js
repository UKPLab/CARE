const { add:addDoc, deleteDoc:deleteDoc, rename:renameDoc, loadByUser:loadDocs } = require("../../db/methods/document.js");
const fs = require("fs");
const path = require("path");

const PDF_PATH = `${__dirname}/../../../files`;

exports = module.exports = function(io) {

    //TODO: throw messages which should be displayed on the frontend
    // emit with defined type

    io.on("connection", (socket) => {
        if (!socket.request.session.passport) {
            socket.emit("logout"); //force logout on client side
            socket.disconnect();
        }

        const update_documents = user_id => {
            loadDocs(user_id)
                .then((rows) => {
                    socket.emit("update_docs", {"docs": rows, "status": "OK"});
                })
                .catch((err) => {
                    console.log(err);
                    socket.emit("update_docs", {"docs": [], "status": "FAIL"});
                });
        }

        socket.on("docs_get", (data) => {
            update_documents(socket.request.session.passport.user.id);
        });

        socket.on("doc_delete", (data) => {
            // TODO check if user can delete this document?
            console.log(data);
            deleteDoc(data.docId)
                .then(() => update_documents(socket.request.session.passport.user.id))
                .catch((err) => socket.emit("error", {err}));
        });

        socket.on("doc_rename", (data) => {
            // TODO check if user can rename this document?
           renameDoc(data.docId, data.newName)
               .then(() => update_documents(socket.request.session.passport.user.id))
               .catch((err) => socket.emit("error", {err}));
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
                        socket.emit("result", {message: err ? "failure on upload" : "success on upload", id: pdf_id})
                    });

                    //Update Document list
                    update_documents(socket.request.session.passport.user.id)
                })
                .catch((err) => {
                    console.log("Upload error");
                    socket.emit("error", {err});
                });
        });

        socket.on("pdf_get", (data) => {
            const pdf = fs.readFileSync(`${PDF_PATH}/${data.document_id}.pdf`);
            socket.emit("pdf", {file: pdf});
        });
        
    });


}