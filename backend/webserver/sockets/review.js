const logger = require("../../utils/logger.js")( "sockets/review");
const {
    add, get, update
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
                if (data.decision) { // view for acceptance decision
                    if (review.decisionBy === socket.request.session.passport.user.id) {
                        if(review.accepted === null) {
                            socket.emit("reviewData", {success: true, document_id: review.document});
                        } else {
                            socket.emit("reviewData", {success: false, message: "The decision process for this review is already over!"});
                            logger.error("Review already submitted error: " + JSON.stringify(data), {user: socket.request.session.passport.user.id});
                        }
                    } else {
                        socket.emit("reviewData", {success: false, message: "You dont have access to this decision process!"});
                        logger.error("Access Denied on review: " + JSON.stringify(data), {user: socket.request.session.passport.user.id});
                    }
                } else { // view for review process
                    if (review.startBy === socket.request.session.passport.user.id) {
                        if(!review.submitted) {
                            socket.emit("reviewData", {success: true, document_id: review.document});
                        } else {
                            socket.emit("reviewData", {success: false, message: "This review is already submitted!"});
                            logger.error("Review already submitted error: " + JSON.stringify(data), {user: socket.request.session.passport.user.id});
                        }
                    } else {
                        socket.emit("reviewData", {success: false, message: "You dont have access to this review!"});
                        logger.error("Access Denied on review: " + JSON.stringify(data), {user: socket.request.session.passport.user.id});
                    }

                }
            } catch(e) {
                socket.emit("reviewData", {success: false, message: "Problems with loading review data from database!"});
            }


        });

        socket.on("reviewSubmit", async (data) => {
            logger.info("Review submitted", {user: socket.request.session.passport.user.id})
            let newData = {
                submitted: true,
                submitAt: new Date(),
            }
            socket.emit("reviewSubmitted", {success: await update(data.review_id, newData)});
        });

        socket.on("decisionSubmit", async (data) => {
            logger.info("Decision submitted", {user: socket.request.session.passport.user.id})
            let newData = {
                decisionAt: new Date(),
                decisionReason: data.reason,
                accepted: data.accept,
            }
            socket.emit("decisionSubmitted", {success: await update(data.review_id, newData)});
        });


    });
}