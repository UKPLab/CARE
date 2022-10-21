/* Handle reviews through websocket

Author: Nils Dycke (dycke@ukp.informatik....)
Source: --
*/
const logger = require("../../utils/logger.js")("sockets/review");
const {
    add, get, update, getByUser, getAll, toReadable, getMetaByUser
} = require("../../db/methods/review.js");
const {
    add: addDoc,
    getDoc: getDoc,
    loadByUser: loadDocs
} = require("../../db/methods/document.js");
const {
    add: addAnnotation,
    getAnnoFromDocRaw: getAnnoFromDocRaw,
    addRaw: addRawAnnotation,
    addRawComment: addRawComment,
    deleteAnno: deleteAnnotation,
    updateAnno: updateAnnotation,
    loadByDocument: loadByDocument,
} = require('../../db/methods/annotation.js');
const fs = require("fs");
const path = require("path");
const {v4: uuidv4} = require("uuid");
const PDF_PATH = `${__dirname}/../../../files`;

exports = module.exports = function (io) {
    io.on("connection", (socket) => {


        const update_all_reviews = async user => {
            if (user.sysrole === "admin") {
                try {
                    const reviews = await getAll();
                    const mappedReviews = await Promise.all(reviews.map(async x => await toReadable(x)));

                    socket.emit("reviewDataAll", {success: true, reviews: mappedReviews});
                } catch (e) {
                    socket.emit("reviewDataAll", {success: false, message: "Failed to retrieve all review data"});
                    logger.error("DB error while loading all reviews from database", {user: user.id})
                }
            } else {
                socket.emit("reviewDataAll", {success: false, message: "User rights and argument mismatch"});
                logger.error("User right and request parameter mismatch", {user: user.id});
            }
        }

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
                        if (review.accepted === null) {
                            socket.emit("reviewData", {success: true, document_id: review.document});
                        } else {
                            socket.emit("reviewData", {
                                success: false,
                                message: "The decision process for this review is already over!"
                            });
                            logger.error("Review already submitted error: " + JSON.stringify(data), {user: socket.request.session.passport.user.id});
                        }
                    } else {
                        socket.emit("reviewData", {
                            success: false,
                            message: "You dont have access to this decision process!"
                        });
                        logger.error("Access Denied on review: " + JSON.stringify(data), {user: socket.request.session.passport.user.id});
                    }
                } else { // view for review process
                    if (review.startBy === socket.request.session.passport.user.id) {
                        if (!review.submitted) {
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
            } catch (e) {
                socket.emit("reviewData", {
                    success: false,
                    message: "Problems with loading review data from database!"
                });
            }
        });

        socket.on("getAllReviews", async (data) => {
            await update_all_reviews(socket.request.session.passport.user);
        });

        socket.on("getReviews", async (data) => {
            try {
                const reviews = await getByUser(socket.request.session.passport.user.id);
                const mappedReviews = await Promise.all(reviews.map(async x => await toReadable(x)));

                socket.emit("reviewDataUser", {success: true, reviews: mappedReviews});
            } catch (e) {
                socket.emit("reviewDataUser", {
                    success: false,
                    message: "Failed to retrieve review data for this user"
                });
                logger.error("DB error while loading reviews by user from database" + JSON.stringify(data), {user: socket.request.session.passport.user.id})
            }
        });

        socket.on("getMetaReviews", async (data) => {
            try {
                const metaReviews = await getMetaByUser(socket.request.session.passport.user.id);
                const mappedReviews = await Promise.all(metaReviews.map(async x => await toReadable(x)));

                socket.emit("metaReviewDataUser", {success: true, reviews: mappedReviews});
            } catch (e) {
                socket.emit("metaReviewDataUser", {
                    success: false,
                    message: "Failed to retrieve review data for this user"
                });
                logger.error("DB error while loading meta reviews by user from database" + JSON.stringify(data), {user: socket.request.session.passport.user.id})
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

        socket.on("editorAssign", async (data) => {
            logger.info("Editor assignment", {user: socket.request.session.passport.user.id});

            let newData = {
                decisionBy: data.editor_id
            }
            socket.emit("editorAssigned", {success: await update(data.review_id, newData)});
        });

        socket.on("copyReview", async (data) => {

            logger.info("Copy Review: " + data.hash, {user: socket.request.session.passport.user.id});

            // Copy Document
            let doc_old = await getDoc(data.document);
            let doc_new = await addDoc(doc_old.name, socket.request.session.passport.user.id);
            const target = path.join(PDF_PATH, `${doc_new.hash}.pdf`);
            const source = path.join(PDF_PATH, `${data.document}.pdf`);
            fs.copyFileSync(source, target);

            // Copy Review
            let review_old = await get(data.hash);
            let review_new = await add(doc_new.hash, socket.request.session.passport.user.id);

            await update(review_new, {
                startBy: review_old.startBy,
                submitAt: review_old.submitAt,
                submitted: review_old.submitted
            });

            // Copy annotations & comments
            try {
                let annotations = await getAnnoFromDocRaw(doc_old.hash);
                for (const anno of annotations) {

                    let new_hash = uuidv4();

                    let annotation = {
                        hash: new_hash,
                        creator: anno.creator,
                        text: anno.text,
                        tags: anno.tags,
                        document: doc_new.hash,
                        selectors: anno.selectors,
                        draft: anno.draft,
                        deleted: anno.deleted,
                        deleteAt: anno.deletedAt,
                    }

                    await addRawAnnotation(annotation);
                    for (const comment of anno.comments) {
                        let new_comment = {
                            hash: uuidv4(),
                            creator: comment.creator,
                            text: comment.text,
                            referenceAnnotation: new_hash,
                            deleted: comment.deleted,
                            deletedAt: comment.deletedAt
                        }
                        await addRawComment(new_comment);
                    }


                }
            } catch (e) {
                //TODO send error to database instead of console.log
                console.log(e);
            }

            await update_all_reviews(socket.request.session.passport.user);

        });

    });
}