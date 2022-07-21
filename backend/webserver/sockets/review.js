const logger = require("../../utils/logger.js")( "sockets/review");
const {
    add, get
} = require("../../db/methods/review.js");
const {loadByUser: loadDocs} = require("../../db/methods/document");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        socket.on("startReview", async (data) => {

            logger.info("Start Review Process for document: " + data.document_id, {user: socket.request.session.passport.user.id})

            const hash = await add(data.document_id, socket.request.session.passport.user.id);
            if (hash !== null) {
                socket.emit("reviewProcessStarted", {success: true, reviewHash: hash});
            } else {
                socket.emit("reviewProcessStarted", {success: false});
            }
        });

        socket.on("getReview", async (data) => {
            try {
                review = await get(data.review_id);
                if (review.startBy === socket.request.session.passport.user.id ||
                review.decisionBy === socket.request.session.passport.user.id) {
                    if(!review.submitted) {
                       socket.emit("reviewData", {success: true, document_id: review.document});
                    } else {
                      socket.emit("reviewData", {success: false, message: "This review is already submitted!"});
                    }
                } else {
                    socket.emit("reviewData", {success: false, message: "You dont have access to this review!"});
                }
            } catch(e) {
                socket.emit("reviewData", {success: false, message: "Problems with loading review data from database!"});
            }


        });

        socket.on("reviewSubmit", async (data) => {
            logger.info("Review submitted", {user: socket.request.session.passport.user.id})
            socket.emit("reviewSubmitted", {success: false});
            //TODO change database with updated data
        });

        socket.on("decisionSubmit", async (data) => {
            logger.info("Decision submitted", {user: socket.request.session.passport.user.id})
            console.log(data);
            socket.emit("decisionSubmitted", {success: false});
            // TODO change database with updated data
        });


    });
}