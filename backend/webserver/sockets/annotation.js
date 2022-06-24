const { v4 } = require('uuid');

let annotations = [];

exports = module.exports = function(io) {
    console.log("init websocket");

    io.on("connection", (socket) => {
        socket.on("addAnnotation", (data) => {
            annotations.push(data);
            console.log(socket.request.session.passport.user);
            console.log(data);
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