/* Handle reviews through websocket

Author: Nils Dycke (dycke@ukp.informatik....), Dennis Zyska (zyska@ukp...)
Source: --
*/
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

const Socket = require("../Socket.js");

module.exports = class ReviewSocket extends Socket {

    async updateAllReviews() {
        if (this.isAdmin()) {
            try {
                const reviews = await getAll();
                const mappedReviews = await Promise.all(reviews.map(async x => await toReadable(x)));

                this.socket.emit("reviewDataAll", {success: true, reviews: mappedReviews});
            } catch (e) {
                this.socket.emit("reviewDataAll", {success: false, message: "Failed to retrieve all review data"});
                this.logger.error("DB error while loading all reviews from database")
            }
        } else {
            this.socket.emit("reviewDataAll", {success: false, message: "User rights and argument mismatch"});
            this.logger.error("User right and request parameter mismatch");
        }
    }


    init() {

        this.socket.on("startReview", async (data) => {
            this.logger.info("Start Review Process for document: " + data.document_id);

            const hash = await add(data.document_id, this.user_id);
            if (hash !== null) {
                this.socket.emit("reviewProcessStarted", {success: true, reviewHash: hash});
            } else {
                this.socket.emit("reviewProcessStarted", {success: false});
            }
        });

        this.socket.on("getReview", async (data) => {
            try {
                let review = await get(data.review_id);
                if (data.decision) { // view for acceptance decision
                    if (review.decisionBy === this.user_id) {
                        if (review.accepted === null) {
                            this.socket.emit("reviewData", {success: true, document_id: review.document});
                        } else {
                            this.socket.emit("reviewData", {
                                success: false,
                                message: "The decision process for this review is already over!"
                            });
                            this.logger.error("Review already submitted error: " + JSON.stringify(data));
                        }
                    } else {
                        this.socket.emit("reviewData", {
                            success: false,
                            message: "You dont have access to this decision process!"
                        });
                        this.logger.error("Access Denied on review: " + JSON.stringify(data));
                    }
                } else { // view for review process
                    if (review.startBy === this.user_id) {
                        if (!review.submitted) {
                            this.socket.emit("reviewData", {success: true, document_id: review.document});
                        } else {
                            this.socket.emit("reviewData", {
                                success: false,
                                message: "This review is already submitted!"
                            });
                            this.logger.error("Review already submitted error: " + JSON.stringify(data));
                        }
                    } else {
                        this.socket.emit("reviewData", {
                            success: false,
                            message: "You dont have access to this review!"
                        });
                        this.logger.error("Access Denied on review: " + JSON.stringify(data));
                    }

                }
            } catch (e) {
                this.socket.emit("reviewData", {
                    success: false,
                    message: "Problems with loading review data from database!"
                });
            }
        });

        this.socket.on("getAllReviews", async (data) => {
            await this.updateAllReviews();
        });

        this.socket.on("getReviews", async (data) => {
            try {
                const reviews = await getByUser(this.user_id);
                const mappedReviews = await Promise.all(reviews.map(async x => await toReadable(x)));

                this.socket.emit("reviewDataUser", {success: true, reviews: mappedReviews});
            } catch (e) {
                this.socket.emit("reviewDataUser", {
                    success: false,
                    message: "Failed to retrieve review data for this user"
                });
                this.logger.error("DB error while loading reviews by user from database" + JSON.stringify(data));
            }
        });

        this.socket.on("getMetaReviews", async (data) => {
            try {
                const metaReviews = await getMetaByUser(this.user_id);
                const mappedReviews = await Promise.all(metaReviews.map(async x => await toReadable(x)));

                this.socket.emit("metaReviewDataUser", {success: true, reviews: mappedReviews});
            } catch (e) {
                this.socket.emit("metaReviewDataUser", {
                    success: false,
                    message: "Failed to retrieve review data for this user"
                });
                this.logger.error("DB error while loading meta reviews by user from database" + JSON.stringify(data));
            }
        });

        this.socket.on("reviewSubmit", async (data) => {
            this.logger.info("Review submitted");
            let newData = {
                submitted: true,
                submitAt: new Date(),
            }
            this.socket.emit("reviewSubmitted", {success: await update(data.review_id, newData)});
        });

        this.socket.on("decisionSubmit", async (data) => {
            this.logger.info("Decision submitted",);
            let newData = {
                decisionAt: new Date(),
                decisionReason: data.reason,
                accepted: data.accept,
            }
            this.socket.emit("decisionSubmitted", {success: await update(data.review_id, newData)});
        });

        this.socket.on("editorAssign", async (data) => {
            this.logger.info("Editor assignment");

            let newData = {
                decisionBy: data.editor_id
            }
            this.socket.emit("editorAssigned", {success: await update(data.review_id, newData)});
        });

        this.socket.on("copyReview", async (data) => {

            this.logger.info("Copy Review: " + data.hash);

            // Copy Document
            let doc_old = await getDoc(data.document);
            let doc_new = await addDoc(doc_old.name, this.user_id);
            const target = path.join(PDF_PATH, `${doc_new.hash}.pdf`);
            const source = path.join(PDF_PATH, `${data.document}.pdf`);
            fs.copyFileSync(source, target);

            // Copy Review
            let review_old = await get(data.hash);
            let review_new = await add(doc_new.hash, this.user_id);

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

            await this.updateAllReviews();

        });

    }
}