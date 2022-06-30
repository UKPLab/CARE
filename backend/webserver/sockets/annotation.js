const { v4 } = require('uuid');

let annotations = [];

exports = module.exports = function(io) {

    io.on("connection", (socket) => {
        socket.on("addAnnotation", (data) => {
            annotations.push(data);
            socket.emit("newAnnotation",
                {
                    uid: socket.request.session.passport.user.uid,
                    annotation: data.annotation,
                    document_id: data.document_id,
                    id: v4(),
                }
            );
        });
    });


}