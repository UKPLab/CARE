const Socket = require("../Socket.js");
const {v4: uuidv4} = require("uuid");

/**
 * Handle user through websocket
 *
 * @author Alexander Bürkle
 * @type {AssignmentSocket}
 */
module.exports = class AssignmentSocket extends Socket {
    /**
     * Retrieves assignment information for users and emits the data through a socket.
     *
     * This function fetches data from multiple models including documents, user-role matching, users, and user roles.
     * It then processes this data to create a comprehensive list of user information, including their documents,
     * number of assignments, and role names. The resulting data is emitted through a socket event.
     *
     * @async
     * @function getAssignmentInfosFromUser
     * @returns {Promise<void>} Emits the user information through a socket event.
     * @throws Will emit an error message through the socket if any error occurs during data retrieval or processing.
     */
    async getAssignmentInfosFromUser() {
        try {
            if (await this.isAdmin()) {
                const [documentUserIds, matchedUsers, users, roleIdMap] = await Promise.all([
                    this.models["document"].findAll({
                        where: {readyForReview: true},
                        attributes: ["userId", "id", "name"],
                        raw: true,
                    }),
                    this.models["user_role_matching"].findAll({
                        attributes: ["userId", "userRoleId"],
                        raw: true,
                    }),
                    this.models["user"].findAll({
                        attributes: {exclude: ["passwordHash", "salt"]},
                        raw: true,
                    }),
                    this.models["user_role"].findAll({
                        attributes: ["id", "name"],
                        raw: true,
                    })
                ]);

                const idToNameMap = new Map(roleIdMap.map(({id, name}) => [id, name]));
                const matchedUserMap = new Map(matchedUsers.map(({userId, userRoleId}) => [userId, userRoleId]));

                const userInfos = users.map(user => {
                    const documents = documentUserIds.filter(doc => doc.userId === user.id);
                    const roleName = idToNameMap.get(matchedUserMap.get(user.id)) || null;

                    return {
                        ...user,
                        documents,
                        numberAssignments: documents.length,
                        role: roleName,
                    };
                });

                this.socket.emit("assignmentUserInfos", {
                    success: true,
                    userInfos,
                });

            } else {
                throw new Error("You are not authorized to access this information. Please log in as an admin.");
            }
        } catch (error) {
            this.logger.error(error);
            this.socket.emit("assignmentUserInfos", {
                success: false,
                message: error.message
            });
        }
    }


    /**
     * Assigns peer reviews to assignments based on the specified number of reviewers per role.
     *
     * @param {Array<Object>} assignments - The list of assignments to be reviewed. Each assignment should have a `userId` and `documentName`.
     * @param {Array<Object>} reviewers - The list of reviewers available for assignments. Each reviewer should have an `id` and `role`.
     * @param {Object} reviewsPerRole - An object specifying the number of reviewers needed per role. Keys are role names and values are the number of reviewers.
     * @param {Object} template - A template object containing properties for creating study sessions.
     *
     * @returns {Array<Object>} - The list of assignments with their assigned reviewers grouped by role.
     */
    async assignPeerReviews(assignments, reviewers, reviewsPerRole, template, createdByUserId) {
        const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);
        const assignmentTracker = new Map();

        assignments.forEach((assignment) => {
            const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
            assignmentTracker.set(uniqueAssignmentKey, new Map(Object.keys(reviewsPerRole).map(role => [role, []])));
        });

        const reviewersByRole = reviewers.reduce((acc, reviewer) => {
            const role = reviewer.role;
            if (!acc[role]) acc[role] = [];
            acc[role].push(reviewer);
            return acc;
        }, {});

        assignments.forEach((assignment) => {
            const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
            for (const [role, numReviewersStr] of Object.entries(reviewsPerRole)) {
                const numReviewersNeeded = parseInt(numReviewersStr, 10);

                if (numReviewersNeeded === 0) continue;

                const availableReviewers = reviewersByRole[role] || [];
                const shuffledReviewers = shuffleArray(availableReviewers);
                let assignedReviewersCount = assignmentTracker.get(uniqueAssignmentKey).get(role).length;

                for (const reviewer of shuffledReviewers) {
                    if (assignment.userId !== reviewer.id && !assignmentTracker.get(uniqueAssignmentKey).get(role).includes(reviewer.id)) {
                        if (assignedReviewersCount < numReviewersNeeded) {
                            assignmentTracker.get(uniqueAssignmentKey).get(role).push(reviewer.id);
                            assignedReviewersCount++;
                        }
                    }
                    if (assignedReviewersCount >= numReviewersNeeded) break;
                }
            }
        });
        const result = assignments.map((assignment) => {
            const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
            const assignedReviewers = [];

            for (const [role, reviewers] of assignmentTracker.get(uniqueAssignmentKey)) {
                assignedReviewers.push(...reviewers);
            }

            return {
                ...assignment,
                assignedReviewers,
            };
        });

        for (const assignment of result) {
            await this.assignPeerReview(
                assignment,
                assignment.assignedReviewers,
                template,
                createdByUserId
            );
        }


        return result;

    }

    /**
     * Assigns a peer review task to a list of reviewers based on a given template.
     *
     * @param {Object} data - The data for assigning peer reviews.
     * @param {Object} data.assignment - The assignment object containing details of the assignment.
     * @param {Array} data.reviewers - An array of reviewer IDs who will be assigned to the peer review.
     * @param {Object} data.template - The template object containing the configuration for the peer review.
     * @param {Array} data.documents - The documents to be reviewed.
     * @param {Object} options - The option for transaction data.
     * @returns {Promise<void>} A promise that resolves when the peer review has been assigned.
     * @throws Error Will throw an error if the assignment cannot be created.
     */
    async createAssignment(data, options) {

        const new_study = {
            ...data['template'],
            createdByUserId: this.userId,
            userId: data["assignments"][0]['userId'],
            template: false,
            id: undefined,
            hash: undefined,
            closed: undefined,
            userIdClosed: undefined,
            limitSessions: data["reviewer"].length,
            limitSessionsPerUser: 1,
            resumable: true,
            stepDocuments: data['documents']
        }

        const study = await this.models["study"].add(new_study, {transaction: options.transaction, context: new_study});

        options.transaction.afterCommit(() => {
            this.emit("studyRefresh", study);
        });

        await this.addReviewer({
            studyId: study.id,
            reviewer: data["reviewer"]
        }, options);

    }

    /**
     * Adds new sessions to a study.
     *
     * @param {Object} data - The data for adding reviewers.
     * @param {number} data.studyId - The ID of the study to which reviewers are to be added.
     * @param {Array<number>} data.reviewer - An array of user IDs representing the reviewers to be added.
     * @param {Object} options - The options for transaction data
     * @returns {Promise<void>} - A promise that resolves when the reviewers have been added.
     */
    async addReviewer(data, options) {

        // update current session count
        const currentStudy = await this.models["study"].getById(data['studyId'], {transaction: options.transaction});
        if (currentStudy.limitSessions !== 0) {
            const currentSessionCount = await this.models["study_session"].count({
                where: {studyId: currentStudy.id},
                raw: true,
            }, {transaction: options.transaction});
            const newSessionLimit = currentSessionCount + data["reviewer"].length;
            if (newSessionLimit > currentStudy.limitSessions) {
                await this.models["study"].updateById(currentStudy.id, {
                    limitSessions: newSessionLimit
                }, {transaction: options.transaction});
            }
        }

        const createdSessions = await Promise.all(data['reviewer'].map(reviewer => {
            return this.models["study_session"].add({
                studyId: data['studyId'],
                userId: reviewer['id'],
            }, {transaction: options.transaction});
        }));

        options.transaction.afterCommit(() => {
            for (const session of createdSessions) {
                this.emit("study_sessionRefresh", session);
            }
        });

    }

    /**
     * Asynchronously removes sessions from a study and deletes their associated sessions.
     *
     * @param {number} study - The ID of the study from which reviewers are to be removed.
     * @param {Array<number>} deletedReviewers - An array of user IDs representing the reviewers to be removed.
     * @returns {Promise<void>} - A promise that resolves when the reviewers and their sessions have been removed.
     */
    async removeReviewer(study, deletedReviewers) {
        const sessions = await this.models["study_session"].getAllByKey("studyId", study);
        const filteredSessions = sessions.filter(session => deletedReviewers.includes(session.userId));
        const deletedSession = await Promise.all(filteredSessions.map(session => {
            return this.models["study_session"].deleteById(session.id)
        }))

        for (const session of deletedSession) {
            this.emit("study_sessionRefresh", session);
        }
    }

    /**
     * Assigns reviewers (Hiwis) to assignments based on the provided data.
     *
     * @param {Object} data - The data for assigning reviewers.
     * @param {Object} data.reviewers - An object where keys are reviewer IDs and values are the number of assignments they should review.
     * @param {Array} data.assignments - An array of assignment objects to be reviewed.
     * @param {string} data.template - The template to be used for the peer review.
     * @param {string} data.createdByUserId - The ID of the user who created the assignments.
     * @returns {Promise<void>} A promise that resolves when all assignments have been assigned reviewers.
     */
    async assignHiwis(data) {
        let reviewersPool = [];
        for (const [reviewerId, count] of Object.entries(data.reviewers)) {
            const numericCount = Number(count); // Convert count to a number
            if (numericCount > 0) {
                reviewersPool = reviewersPool.concat(Array(numericCount).fill(Number(reviewerId)));
            }
        }
        const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);
        reviewersPool = shuffleArray(reviewersPool);


        const assignmentsWithReviewers = data.assignments.map((assignment, index) => {
            const reviewer = reviewersPool[index % reviewersPool.length];
            return {...assignment, reviewer}; // Assign a reviewer to the assignment
        });

        await Promise.all(
            assignmentsWithReviewers.map(assignment =>
                this.assignPeerReview(
                    assignment,
                    Array.of(assignment.reviewer),
                    data.template,
                    data.createdByUserId
                )
            )
        );
    }

    init() {

        this.createSocket("assignmentCreate", this.createAssignment, {}, true);

        this.socket.on("assignmentGetAssignmentInfosFromUser", async () => {
            try {
                this.getAssignmentInfosFromUser();
            } catch (error) {
                this.logger.error(error);
            }
        });

        this.socket.on("assignmentAssignHiwis", async (data) => {

            try {
                this.assignHiwis(data);
                this.socket.emit("peerReview", {
                    success: true,
                    reviews,
                });
            } catch (error) {
                this.socket.emit("peerReview", {
                    success: false,
                    message: error.message,
                });
                this.logger.error(error);
            }
        });

        this.socket.on("assignmentPeerReviews", async (data) => {
            try {
                const reviews = await this.assignPeerReviews(data.assignments, data.reviewers, data.reviewsPerRole, data.template, data.createdByUserId);
                this.socket.emit("peerReview", {
                    success: true,
                    reviews,
                });
            } catch (error) {
                this.socket.emit("peerReview", {
                    success: false,
                    message: error.message,
                });
                this.logger.error(error);
            }
        });

        this.socket.on("assignmentEditReviewer", async (data) => {
            try {
                const addedReviewers = await this.addReviewer(data.studyId, data.newReviewers.map(reviewer => reviewer.id));
                const deletedReviewers = await this.removeReviewer(data.studyId, data.deletedReviewers);
                this.socket.emit("peerReview", {
                    success: true,
                    addedReviewers,
                    deletedReviewers,
                });
            } catch (error) {
                this.socket.emit("peerReview", {
                    success: false,
                    message: error.message,
                });
                this.logger.error(error, !"Error editing reviewer");
            }
        });


    }
};
