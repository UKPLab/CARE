const Socket = require("../Socket.js");
const {v4: uuidv4} = require("uuid");
const _ = require("lodash");

/**
 * Handle user through websocket
 *
 * @author Dennis Zyska, Alexander Bürkle
 * @type {AssignmentSocket}
 * @class AssignmentSocket
 */
class AssignmentSocket extends Socket {

    /**
     * Assigns a peer review task to a list of reviewers based on a given template.
     * 
     * Constructs a study from the provided template and assignment data, assigns it to the specified user,
     * and links it to the given documents. Reviewers are then associated with the study.
     * 
     * @socketEvent assignmentCreate
     * @param {Object} data The data for assigning peer reviews.
     * @param {Object} data.assignment The assignment object containing details of the assignment.
     * @param {Array} data.reviewers An array of reviewer IDs who will be assigned to the peer review.
     * @param {Object} data.template The template object containing the configuration for the peer review.
     * @param {Array} data.documents The documents to be reviewed.
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @returns {Promise<void>} A promise that resolves when the peer review has been assigned.
     */
    async createAssignment(data, options) {

        const templateStudySteps = await this.models['study_step'].getAllByKey("studyId", data['template'].id);
        
        const stepDocuments = [];
        for (const step of templateStudySteps) {
            if (step.workflowStepId) {
                const documentOverride = data['documents'].find(doc => doc.id === step.workflowStepId);
                stepDocuments.push({
                    id: step.workflowStepId,
                    documentId: documentOverride ? documentOverride.documentId : step.documentId,
                    configuration: step.configuration
                });
            }
        }

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
            stepDocuments: stepDocuments
        }

        const study = await this.models["study"].add(new_study, {transaction: options.transaction, context: new_study});

        await this.addReviewer({
            studyId: study.id, reviewer: data["reviewer"]
        }, options);

    }

    /**
     * Adds new sessions to a study.
     * 
     * If the number of reviewers being added exceeds the current session limit of the study,
     * the session limit is updated accordingly. Each reviewer is added as a new `study_session`.
     * 
     * @socketEvent assignmentAdd
     * @param {Object} data The data for adding reviewers.
     * @param {number} data.studyId The ID of the study to which reviewers are to be added.
     * @param {Array<number>} data.reviewer An array of user IDs representing the reviewers to be added.
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @returns {Promise<void>} A promise that resolves when the reviewers have been added to the study.
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
     * 
     * Two assignment modes are supported:
     * - `"role"`: reviewers are grouped by their roles, and documents are assigned to users in each role.
     * - `"reviewer"`: reviewers are explicitly selected, and assignments are distributed to them directly.
     * 
     * 
     * In both cases, the function ensures:
     * - A reviewer never reviews their own document.
     * - Fair distribution of review tasks.
     * - A fallback swapping mechanism is used if optimal assignment fails.
     * 
     * @socketEvent assignmentCreateBulk
     * @param data The data for creating assignments.
     * @param {Object} data.template The template to be used for the assignments.
     * @param {Array<Object>} data.selectedReviewer An array of reviewer objects to be assigned to the assignments.
     * @param {Array<Object>} data.selectedAssignments An array of assignment objects to be reviewed.
     * @param {String} data.mode The mode of the assignment creation (i.e, role or reviewer)
     * @param {Array<Array>} data.documents List of document assignments
     * @param {Object} data.roleSelection If the mode is role, the role selection object
     * @param {Object} data.reviewerSelection If the mode is reviewer, the reviewer selection object
     * @param options holds the managed transaction of the database (see createSocket function), passed down to the individual assignment creation step.
     * @returns {Promise<void>} A promise that resolves with an object detailing the final assignment distribution.
     * @throws {Error} Throws an error under several conditions:
     *  If an invalid `data.mode` is provided,
     *  In 'role' mode: if no users are found for a selected role,
     *  In 'role' mode: if there are not enough unique documents to satisfy the assignment requirements for a role or a specific user,
     *  In 'role' mode: if the algorithm is unable to find a valid assignment for a user, even after attempting to swap,
     *  In 'reviewer' mode: if the algorithm cannot assign all reviewers after attempting to swap,
     *  If the underlying `this.createAssignment` method fails.
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

            return finalAssignments;

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

            return finalAssignments;

        } else {
            throw new Error("Invalid mode provided for assignment creation.");
        }

    }

    /**
     * Retrieve all the assignments a course has.
     * 
     * @socketEvent assignmentGetInfo
     * @param {Object} data The data required for getting the relevant assignment info.
     * @param {Object} data.options The options object containing the API key and URL of the Moodle instance.
     * @param {number} data.options.courseID The ID of the course to fetch users from.
     * @param {string} data.options.apiKey The API token for the Moodle instance
     * @param {string} data.options.apiUrl The URL of the Moodle instance.
     * @returns {Promise<ArrayLike<T>>} A promise that resolves with an array of assignment objects from Moodle.
     */
    async getAssignmentInfoFromCourse(data) {
        return await this.server.rpcs["MoodleRPC"].getAssignmentInfoFromCourse(
            {
                options: {
                    courseID: Number(data.options.courseID),
                    apiKey: data.options.apiKey,
                    apiUrl: data.options.apiUrl,
                }
            }
        );
    }

    init() {

        this.createSocket("assignmentCreate", this.createAssignment, {}, true);
        this.createSocket("assignmentCreateBulk", this.createAssignmentBulk, {}, true);
        this.createSocket("assignmentAdd", this.addReviewer, {}, true);
        this.createSocket("assignmentGetInfo", this.getAssignmentInfoFromCourse, {}, false);
    }
};

module.exports = AssignmentSocket;