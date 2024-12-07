const Socket = require("../Socket.js");
const {v4: uuidv4} = require("uuid");
const _ = require("lodash");

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
                const [documentUserIds, matchedUsers, users, roleIdMap] = await Promise.all([this.models["document"].findAll({
                    where: {readyForReview: true}, attributes: ["userId", "id", "name"], raw: true,
                }), this.models["user_role_matching"].findAll({
                    attributes: ["userId", "userRoleId"], raw: true,
                }), this.models["user"].findAll({
                    attributes: {exclude: ["passwordHash", "salt"]}, raw: true,
                }), this.models["user_role"].findAll({
                    attributes: ["id", "name"], raw: true,
                })]);

                const idToNameMap = new Map(roleIdMap.map(({id, name}) => [id, name]));
                const matchedUserMap = new Map(matchedUsers.map(({userId, userRoleId}) => [userId, userRoleId]));

                const userInfos = users.map(user => {
                    const documents = documentUserIds.filter(doc => doc.userId === user.id);
                    const roleName = idToNameMap.get(matchedUserMap.get(user.id)) || null;

                    return {
                        ...user, documents, numberAssignments: documents.length, role: roleName,
                    };
                });

                this.socket.emit("assignmentUserInfos", {
                    success: true, userInfos,
                });

            } else {
                throw new Error("You are not authorized to access this information. Please log in as an admin.");
            }
        } catch (error) {
            this.logger.error(error);
            this.socket.emit("assignmentUserInfos", {
                success: false, message: error.message
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
    async assignPeerReviews(data, options) {
        const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);
        const assignmentTracker = new Map();

        data.assignments.forEach((assignment) => {
            const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
            assignmentTracker.set(uniqueAssignmentKey, new Map(Object.keys(data.reviewsPerRole).map(role => [role, []])));
        });

        const reviewersByRole = data.reviewers.reduce((acc, reviewer) => {
            const role = reviewer.role;
            if (!acc[role]) acc[role] = [];
            acc[role].push(reviewer);
            return acc;
        }, {});

        data.assignments.forEach((assignment) => {
            const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
            for (const [role, numReviewersStr] of Object.entries(data.reviewsPerRole)) {
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
        const result = data.assignments.map((assignment) => {
            const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
            const assignedReviewers = [];

            for (const [role, reviewers] of assignmentTracker.get(uniqueAssignmentKey)) {
                assignedReviewers.push(...reviewers);
            }

            return {
                ...assignment, assignedReviewers,
            };
        });

        const template = data.template

        for (const assignment of result) {
            await this.createAssignment({
                assignment,
                reviewers: assignment.assignedReviewers,
                template,
                documents: [assignment.documentName]
            }, options);
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
            userId: data["assignment"]['userId'],
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

        await this.addReviewer({
            studyId: study.id, reviewer: data["reviewer"]
        }, options);

    }

    /**
     * Adds new sessions to a study.
     *
     * @param {Object} data - The data for adding reviewers.
     * @param {number} data.studyId - The ID of the study to which reviewers are to be added.
     * @param {Array<number>} data.reviewer - An array of user IDs representing the reviewers to be added.
     * @param {Object} options - The options for transaction data
     * @returns {Promise<void>} - A promise that resolves when the reviewers have been added to the study.
     */
    async addReviewer(data, options) {

        // update current session count
        const currentStudy = await this.models["study"].getById(data['studyId'], {transaction: options.transaction});
        if (currentStudy.limitSessions !== 0) {
            const currentSessionCount = await this.models["study_session"].count({
                where: {studyId: currentStudy.id}, raw: true,
            }, {transaction: options.transaction});
            const newSessionLimit = currentSessionCount + data["reviewer"].length;
            if (newSessionLimit > currentStudy.limitSessions) {
                await this.models["study"].updateById(currentStudy.id, {
                    limitSessions: newSessionLimit
                }, {transaction: options.transaction});
            }
        }

        await Promise.all(data['reviewer'].map(reviewer => {
            return this.models["study_session"].add({
                studyId: data['studyId'], userId: reviewer['id'],
            }, {transaction: options.transaction});
        }));

    }

    /**
     * Creates multiple assignments based on the provided data.
     * @param data - The data for creating assignments.
     * @param {Object} data.template - The template to be used for the assignments.
     * @param {Array<Object>} data.selectedReviewer - An array of reviewer objects to be assigned to the assignments.
     * @param {Array<Object>} data.selectedAssignments - An array of assignment objects to be reviewed.
     * @param {String} data.mode - The mode of the assignment creation (i.e, role or reviewer)
     * @param {Array<Array>} data.documents - List of document assignments
     * @param {Object} data.roleSelection - If the mode is role, the role selection object
     * @param {Object} data.reviewerSelection - If the mode is reviewer, the reviewer selection object
     * @param options
     * @returns {Promise<void>}
     */
    async createAssignmentBulk(data, options) {

        // first shuffle the assignments, we use the Fisher-Yates shuffle algorithm from lodash
        // we also need to make sure that the documents array is shuffled in the same way
        const shuffledAssignments = _.shuffle(data.selectedAssignments.map((assignment, index) => ({
            ...assignment, document: data.documents[index]
        })));

        if (data.mode === "role") {
            const roleSelection = Object.entries(data.roleSelection)
                .filter(([_, assignments]) => Number(assignments) !== 0) // remove roles with no assignments
                .reduce((acc, [roleId, assignments]) => {
                    acc[roleId] = {};
                    acc[roleId]['roleId'] = Number(roleId);
                    acc[roleId]['neededAssignments'] = assignments;
                    acc[roleId]['assignments'] = {};
                    acc[roleId]['users'] = data.selectedReviewer.filter((reviewer) => reviewer.roles.includes(Number(roleId)));
                    return acc;
                }, {});

            const assignmentCounter = shuffledAssignments.reduce((acc, assignment) => {
                acc[assignment.id] = 0;
                return acc;
            }, {});

            // role based assignment means we start with the role
            for (const key in roleSelection) {
                const {roleId, neededAssignments, users} = roleSelection[key];

                // create a shuffle copy of the users array for each role
                let userQueue = _.shuffle(users);
                if (userQueue.length === 0) {
                    throw new Error(`No users found for role ${data['roles'].find((role) => role.id === roleId).name}. Please add users to the role.`);
                }

                // check if there are enough assignment for each user, that are not from the user itself
                if (neededAssignments > shuffledAssignments.length) {
                    throw new Error(`Not enough documents to review for role ${data['roles'].find((role) => role.id === roleId).name}. Please add more documents.`);
                }

                for (const user of userQueue) {
                    if (shuffledAssignments.filter((assignment) => assignment.userId !== user.id).length < neededAssignments) {
                        throw new Error(`Not enough documents to review for ${user.firstName} ${user.lastName}. Please add more documents.`);
                    }
                }

                for (const user of userQueue) {
                    roleSelection[roleId]['assignments'][user.id] = [];
                    console.log(1)
                    while (roleSelection[roleId]['assignments'][user.id].length < neededAssignments) {
                        // first find a suitable assignment
                        const minCount = Math.min(...Object.values(assignmentCounter));
                        const newAssignment = shuffledAssignments.find(
                            (assignment) =>
                                assignmentCounter[assignment.id] === minCount && // select the assignment with the lowest amount of users assigned
                                assignment.userId !== user.id && // make sure the user is not the owner of the document
                                roleSelection[roleId]['assignments'][user.id].indexOf(assignment.id) === -1 // make sure the user is not already assigned to the document
                        );
                        if (newAssignment) {
                            roleSelection[roleId]['assignments'][user.id].push(newAssignment.id);
                            assignmentCounter[newAssignment.id]++;
                        } else {
                            let swapped = false;
                            for (const otherUser of userQueue) {
                                // if it is the same user, skip
                                if (otherUser.id === user.id) {
                                    continue;
                                }
                                // get all assignments for the other user
                                const otherAssignments = roleSelection[roleId]['assignments'][otherUser.id];
                                if (!otherAssignments) { // not initialized yet
                                    continue;
                                }
                                const swappableAssignment = otherAssignments.find((assignedId) => {
                                    const assignment = shuffledAssignments.find((a) => a.id === assignedId);
                                    return (assignment.userId !== user.id // make sure the user is not the owner of the document
                                        && roleSelection[roleId]['assignments'][user.id].indexOf(assignment.id) === -1 // make sure the user is not already assigned to the document
                                    );
                                });
                                if (swappableAssignment) {

                                    // check if a new assignment is suitable for the other user
                                    const otherUserNewAssignment = shuffledAssignments.find(
                                        (assignment) =>
                                            assignmentCounter[assignment.id] === minCount && // Lowest count
                                            assignment.userId !== otherUser.id && // Not owned by the other user
                                            !roleSelection[roleId]['assignments'][otherUser.id].includes(assignment.id) && // Not already assigned
                                            assignment.id !== swappableAssignment // Avoid selecting the same document being swapped
                                    );
                                    if (otherUserNewAssignment) { // perform the swap

                                        // remove the swappable assignment from the other user and add it to the current user
                                        roleSelection[roleId]['assignments'][otherUser.id] = otherAssignments.filter(
                                            (assignedId) => assignedId !== swappableAssignment.id
                                        );

                                        // instead adding the other user's new assignment
                                        roleSelection[roleId]['assignments'][otherUser.id].push(otherUserNewAssignment.id);

                                        // add the swappable assignment to the current user
                                        roleSelection[roleId]['assignments'][user.id].push(swappableAssignment.id);

                                        // update the counters
                                        assignmentCounter[otherUserNewAssignment.id]++;

                                        swapped = true;
                                        break;

                                    }

                                }

                            }

                            if (!swapped) {
                                throw new Error(`Unable to assign enough documents for ${user.firstName} ${user.lastName} in role ${data['roles'].find((role) => role.id === roleId).name}`);
                            }
                        }

                    }
                }
            }

            // create the final assignments
            const finalAssignments = {};
            for (const roleId of Object.keys(roleSelection)) {
                const roleAssignments = roleSelection[roleId]['assignments'];

                for (const [reviewerId, assignments] of Object.entries(roleAssignments)) {
                    for (const assignmentId of assignments) {
                        if (!finalAssignments[assignmentId]) {
                            finalAssignments[assignmentId] = [];
                        }
                        finalAssignments[assignmentId].push(reviewerId);
                    }
                }
            }

            for (const [assignmentId, reviewerIds] of Object.entries(finalAssignments)) {
                const assignment = shuffledAssignments.find((a) => a.id === Number(assignmentId));
                const reviewers = reviewerIds.map((reviewerId) => data.selectedReviewer.find((reviewer) => reviewer.id === Number(reviewerId)));
                await this.createAssignment({
                    assignment: assignment,
                    reviewer: reviewers,
                    template: data.template,
                    documents: assignment["document"]
                }, options);
            }

        } else if (data.mode === "reviewer") {
            const finalAssignments = {};

            // initialize the finalAssignments object with empty arrays for each reviewer
            data.selectedReviewer
                .forEach((reviewer) => {
                    finalAssignments
                        [reviewer.id] = [];
                });

            // transform the reviewerSelection (as we get String values from the frontend)
            const reviewerSelection = Object.entries(data.reviewerSelection)
                .filter(([_, assignments]) => Number(assignments) !== 0) // remove reviewers with no assignments
                .reduce((acc, [reviewerId, assignments]) => {
                    acc[reviewerId] = Number(assignments);
                    return acc;
                }, {});

            // distribute the assignments to the reviewers
            for (let assignment of shuffledAssignments) {
                let assigned = false;

                for (let reviewer of Object.keys(reviewerSelection)) {
                    // check if the reviewer still has assignments to review AND if it is not a document from himself
                    if (reviewerSelection[reviewer] > 0 && assignment.userId !== Number(reviewer)) {
                        finalAssignments[reviewer].push(assignment);
                        reviewerSelection[reviewer]--;
                        assigned = true;
                        break;
                    }
                }

                // if no reviewer is available anymore, try to swap with someone
                if (!assigned) {
                    let swapped = false;

                    for (let i = 0; i < 10; i++) {
                        // get a random reviewer
                        const randomReviewer = _.sample(Object.keys(reviewerSelection));

                        // check if the random reviewer is not the assignment owner and has already assignments to review
                        if (randomReviewer !== assignment.userId && finalAssignments[randomReviewer].length > 0) {

                            // get random assignment of the already assigned documents
                            const randomAssignment = _.sample(finalAssignments[randomReviewer]);

                            // add the old assignment to the current reviewer, but make sure it is not from him
                            if (randomAssignment.userId !== assignment.userId) {

                                // delete the "old" random assignment and add the new assignment
                                finalAssignments[randomReviewer] = finalAssignments[randomReviewer].filter(a => a !== randomAssignment);
                                finalAssignments[randomReviewer].push(assignment);

                                // add the old assignment to the new reviewer
                                finalAssignments[assignment.userId].push(randomAssignment);
                                swapped = true;
                                break;
                            }

                        }

                    }

                    if (!swapped) {
                        throw new Error("Could not assign all reviewers. Please try again.");
                    }
                }
            }

            // create the final assignments
            for (const [reviewerId, assignments] of Object.entries(finalAssignments)) {
                for (const assignment of assignments) {
                    await this.createAssignment({
                        assignment: assignment,
                        reviewer: [data.selectedReviewer.find((reviewer) => reviewer.id === Number(reviewerId))],
                        template: data.template,
                        documents: assignment["document"]
                    }, options);
                }
            }

        } else {
            throw new Error("Invalid mode provided for assignment creation.");
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

        await Promise.all(assignmentsWithReviewers.map(assignment => this.assignPeerReview(assignment, Array.of(assignment.reviewer), data.template, data.createdByUserId)));
    }

    init() {

        this.createSocket("assignmentCreate", this.createAssignment, {}, true);
        this.createSocket("assignmentCreateBulk", this.createAssignmentBulk, {}, true);
        this.createSocket("assignmentAdd", this.addReviewer, {}, true);


        this.createSocket("assignmentGetAssignmentInfosFromUser", this.getAssignmentInfosFromUser, {}, true);

        this.createSocket("assignmentAssignHiwis", this.assignHiwis, {}, true);

        this.createSocket("assignmentAssignPeerReviews", this.assignPeerReviews, {}, true);



    }
};
