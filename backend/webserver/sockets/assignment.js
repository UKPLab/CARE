const Socket = require("../Socket.js");
const {v4: uuidv4} = require("uuid");
const _ = require("lodash");
const {getEmailContent} = require("../../utils/emailHelper");

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
        const workflowSteps = await this.models['workflow_step'].getSortedWorkflowSteps(data['template'].workflowId);
        const workflowStepById = Object.fromEntries(workflowSteps.map((ws) => [ws.id, ws]));

        const stepDocuments = [];
        for (const step of templateStudySteps) {
            if (step.workflowStepId) {
                const stepDocument = data['documents'].find(doc => doc.workflowStepId === step.workflowStepId) || null;
                const hasOverride = stepDocument != null && stepDocument.documentId != null;
                let stepDocumentId = hasOverride ? stepDocument.documentId : step.documentId;
                if (!hasOverride) {
                    const workflowStep = workflowStepById[step.workflowStepId];
                    if (workflowStep && workflowStep.workflowStepDocument != null) {
                        const refStudyStep = templateStudySteps.find((s) => s.workflowStepId === workflowStep.workflowStepDocument);
                        if (refStudyStep && refStudyStep.documentId != null) {
                            stepDocumentId = refStudyStep.documentId;
                        }
                    }
                }

                // Determine assignment type and gather context for template replacement
                let assignmentType, contextData;
                
                if (data.assignmentType === 'study_session') {
                    assignmentType = 'study_session';
                    contextData = {
                        assignmentType: assignmentType,
                        submissionId: stepDocument?.submissionId || null,
                        documentId: stepDocumentId|| null
                    };
                } else if (data.assignmentType === 'submission') {
                    assignmentType = 'submission';
                    contextData = {
                        assignmentType: assignmentType,
                        submissionId: data['assignment']?.id || null,
                        documentId: null
                    };
                } else {
                    assignmentType = 'document';
                    contextData = {
                        assignmentType: assignmentType,
                        submissionId: null,
                        documentId: data['assignment']?.id || null
                    };
                }
                
                const configuration = await this.replaceTemplateValues(
                    step.configuration,
                    contextData,
                    options
                );
                
                stepDocuments.push({
                    id: step.workflowStepId,
                    documentId: stepDocumentId,
                    configuration: configuration
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
            parentStudyId: data.assignmentType === 'study_session' ? data['assignment'].studyId : null,
            limitSessions: data["reviewer"].length,
            limitSessionsPerUser: 1,
            resumable: true,
            stepDocuments: stepDocuments
        }
        // Check if email notifications are enabled
        const enableEmailNotification = data.enableEmailNotification || false;

        const study = await this.models["study"].add(new_study, {
            transaction: options.transaction, 
            context: new_study, 
            doNotDuplicate: data.assignmentType === 'study_session'
        });

        await this.addReviewer({
            studyId: study.id, 
            reviewer: data["reviewer"],
            assignmentType: data.assignmentType || 'document',
            assignmentName: study.name,
            enableEmailNotification: enableEmailNotification
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

        const createdSessions = await Promise.all(data['reviewer'].map(reviewer => {
            return this.models["study_session"].add({
                studyId: data['studyId'], userId: reviewer['id'],
            }, {transaction: options.transaction});
        }));

        // Send assignment notification emails if enabled
        if (data.enableEmailNotification && createdSessions.length > 0) {
            options.transaction.afterCommit(async () => {
                try {
                    for (const session of createdSessions) {
                        await this.sendAssignmentEmail(session, {
                            assignmentType: data.assignmentType || 'document',
                            assignmentName: data.assignmentName || currentStudy.name
                        });
                    }
                } catch (error) {
                    this.server.logger.error(`Failed to send assignment emails:`, error);
                }
            });
        }

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
     * @param {String} data.assignmentType The type of assignment (document, submission, or study_session)
     * @param {Array<Array>} data.documents List of document assignments (for document/submission types)
     * @param {Object} data.workflowMapping Workflow mapping object (for study_session type)
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
        if(data.assignmentType === "study_session"){  
            data["documents"] = await this.duplicate(data, options);
        };
       
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

            const assignmentEntries = Object.entries(finalAssignments);
            const totalAssignments = assignmentEntries.length;
            let currentAssignment = 0;

            for (const [assignmentId, reviewerIds] of assignmentEntries) {
                const assignment = shuffledAssignments.find((a) => a.id === Number(assignmentId));
                const reviewers = reviewerIds.map((reviewerId) => data.selectedReviewer.find((reviewer) => reviewer.id === Number(reviewerId)));
                const assignmentData = {
                    assignment: assignment,
                    reviewer: reviewers,
                    template: data.template,
                    documents: assignment["document"],
                    // Pass through optional properties if they exist
                    ...(data.assignmentType && { assignmentType: data.assignmentType }),
                    ...(data.emailTemplateId && { emailTemplateId: data.emailTemplateId }),
                    enableEmailNotification: data.enableEmailNotification,
                };
                await this.createAssignment(assignmentData, options);

                // Emit progress update
                currentAssignment++;
                if (data.progressId) {
                    this.socket.emit("progressUpdate", {
                        id: data.progressId,
                        current: currentAssignment,
                        total: totalAssignments
                    });
                }
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
            // Count total assignments for progress tracking
            const totalAssignments = Object.values(finalAssignments).reduce((sum, arr) => sum + arr.length, 0);
            let currentAssignment = 0;

            for (const [reviewerId, assignments] of Object.entries(finalAssignments)) {
                for (const assignment of assignments) {
                    const assignmentData = {
                        assignment: assignment,
                        reviewer: [data.selectedReviewer.find((reviewer) => reviewer.id === Number(reviewerId))],
                        template: data.template,
                        documents: assignment["document"],
                        // Pass through optional properties if they exist
                        ...(data.assignmentType && { assignmentType: data.assignmentType }),
                        ...(data.emailTemplateId && { emailTemplateId: data.emailTemplateId }),
                        enableEmailNotification: data.enableEmailNotification,
                    };
                    await this.createAssignment(assignmentData, options);

                    // Emit progress update
                    currentAssignment++;
                    if (data.progressId) {
                        this.socket.emit("progressUpdate", {
                            id: data.progressId,
                            current: currentAssignment,
                            total: totalAssignments
                        });
                    }
                }
            }

            return finalAssignments;

            } else if (data.mode === "session_user") {
            // Session user-based assignment: assign each study session to its original user
            const finalAssignments = {};

            for (const assignment of shuffledAssignments) {
                const studySession = await this.models['study_session'].getById(assignment.id, {transaction: options.transaction});
                const reviewerId = studySession.userId;
                
                // Check if the reviewer exists in selectedReviewer
                const reviewer = data.selectedReviewer.find((r) => r.id === reviewerId);
                if (!reviewer) {
                    throw new Error(`Study session owner (User ID: ${reviewerId}) is not in the selected reviewers list. Please add them to the reviewer selection.`);
                }

                // Initialize array for this reviewer if not exists
                if (!finalAssignments[reviewerId]) {
                    finalAssignments[reviewerId] = [];
                }

                finalAssignments[reviewerId].push(assignment.id);
            }

            // Create the final assignments
            const totalAssignments = Object.values(finalAssignments).reduce((sum, arr) => sum + arr.length, 0);
            let currentAssignment = 0;
            for (const [reviewerId, assignmentIds] of Object.entries(finalAssignments)) {
                for (const assignmentId of assignmentIds) {
                    const assignment = shuffledAssignments.find((a) => a.id === Number(assignmentId));
                    const reviewer = data.selectedReviewer.find((reviewer) => reviewer.id === Number(reviewerId));
                    
                    const assignmentData = {
                        assignment: assignment,
                        reviewer: [reviewer],
                        template: data.template,
                        documents: assignment["document"],
                        // Pass through optional properties if they exist
                        ...(data.assignmentType && { assignmentType: data.assignmentType }),
                    };
                    await this.createAssignment(assignmentData, options);

                    // Emit progress update
                    currentAssignment++;
                    if (data.progressId) {
                        this.socket.emit("progressUpdate", {
                            id: data.progressId,
                            current: currentAssignment,
                            total: totalAssignments
                        });
                    }
                }
            }

            return finalAssignments;

        } else {
            throw new Error("Invalid mode provided for assignment creation.");
        }

    }
    /**
     * Creates a single assignment based on the provided data.
     *
     * @socketEvent assignmentCreateSingle
     * @param {Object} data The data for creating the assignment.
     * @param {Object} data.selectedAssignments The assignment object containing details of the assignment.
     * @param {Object} data.template The template object containing the configuration for the assignment.
     * @param {Array} data.documents The documents to be assigned (for document/submission types).
     * @param {String} data.assignmentType The type of assignment (document, submission, or study_session)
     * @param {Object} data.workflowMapping Workflow mapping object (for study_session type)
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @returns {Promise<void>} A promise that resolves when the assignment has been created.
     * @throws {Error} Throws an error if the underlying `this.createAssignment` method fails.
     */
    async createAssignmentSingle(data, options) {
        data["assignment"] = data.selectedAssignments[0];

        if(data.assignmentType === "study_session"){
            const documents= await this.duplicate(data, options);
            data["documents"] = documents[0];
        };
        return await this.createAssignment(data, options);
    }
    /**
     * Recursively processes template markers in a configuration object and adds appropriate ID properties.
     *
     * This method processes configuration objects, arrays, and nested structures, identifying template
     * markers (objects with `isTemplate === true`) and adding the appropriate ID property based on
     * the assignment type. For submission assignments, it adds `submissionId`; for document assignments,
     * it adds `documentId`. The original template object properties are preserved.
     *
     * @param {Object|Array} config The configuration object or array to process. Can contain nested objects and arrays.
     * @param {Object} context The context object containing assignment information.
     * @param {string} context.assignmentType The type of assignment ('submission' or 'document').
     * @param {number|null} context.documentId The document ID to use when assignmentType is 'document'.
     * @param {number|null} context.submissionId The submission ID to use when assignmentType is 'submission'.
     * @param {Object} options The options object (currently unused but kept for API consistency).
     * @returns {Promise<Object|Array>} A promise that resolves with the configuration object with ID properties added to template markers.
     */
    async replaceTemplateValues(config, context, options) {
        if (Array.isArray(config)) {
            return await Promise.all(config.map(item => this.replaceTemplateValues(item, context, options)));
        }

        if (!config || typeof config !== 'object') {
            return config;
        }

        const result = {};
        for (const [key, value] of Object.entries(config)) {
            if (value.isTemplate) {
                switch (context.assignmentType) {
                    case 'submission':
                        result[key] = { ...value, submissionId: context.submissionId };
                        break;
                    case 'document':
                        result[key] = { ...value, documentId: context.documentId };
                        break;
                    case 'study_session':
                        // Study sessions can have both submissionId and documentId
                        result[key] = { 
                            ...value, 
                            ...(context.submissionId && { submissionId: context.submissionId }),
                            ...(context.documentId && { documentId: context.documentId })
                        };
                        break;
                    default:
                        result[key] = value;
                        break;
                }
                continue;
            }
            if (value) {
                result[key] = await this.replaceTemplateValues(value, context, options);
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * Send assignment notification email using configured template
     * @param {Object} studySession - Study session object
     * @param {Object} assignmentContext - Assignment context data
     * @param {string} assignmentContext.assignmentType - Type of assignment ('document' or 'submission')
     * @param {string} assignmentContext.assignmentName - Name of the assignment
     * @returns {Promise<void>}
     */
    async sendAssignmentEmail(studySession, assignmentContext = {}) {
        const study = await this.models['study'].getById(studySession.studyId);
        if (!study) return;

        // Get reviewer email
        const user = await this.models['user'].getById(studySession.userId);
        if (!user || !user.email) {
            this.server.logger.warn(`Cannot send assignment email: user ${studySession.userId} has no email`);
            return;
        }

        // Get baseUrl from settings
        const baseUrl = await this.models["setting"].get("system.baseUrl") || "localhost:3000";
        const assignmentLink = `http://${baseUrl}/session/${studySession.hash}`;

        // Get email content from template or fallback. Set context.link so ~link~ resolves to /session/ for the reviewer.
        const emailContent = await getEmailContent(
            "email.template.assignment",
            "assignment",
            {
                userId: studySession.userId,
                creatorId: study.userId,
                studyId: study.id,
                studySessionId: studySession.id,
                studySessionHash: studySession.hash,
                baseUrl: baseUrl,
                link: assignmentLink,
                assignmentType: assignmentContext.assignmentType || 'document',
                assignmentName: assignmentContext.assignmentName || study.name
            },
            this.models,
            this.logger
        );

        // Send email
        await this.server.sendMail(
            user.email,
            emailContent.subject,
            emailContent.body,
            { isHtml: emailContent.isHtml }
        );
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

    /**
     * Duplicates documents for study sessions based on the provided data.
     *  * For each selected assignment (study session), documents are duplicated according to the workflow mapping.
     * * If the original document is part of a submission, the entire submission is copied with overrides for context.
     * * If the original document is standalone, it is duplicated directly with the necessary overrides.
     * @param {Object} data The data for duplicating documents.
     * @param {Array} data.selectedAssignments An array of selected assignment objects (study sessions).
     * @param {Object} data.workflowMapping An object mapping source workflow step IDs to target workflow step IDs.
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @returns {Promise<Array>} A promise that resolves with an array of arrays, each containing duplicated document objects for the corresponding study session.
     * @throws {Error} Throws an error if the underlying duplication methods fail.
     */
    
    async duplicate(data, options) {

        const duplicatedDocuments = [];
        for (const studySession of data.selectedAssignments) {
            const currentDocuments = [];
            let previousSubmissionId = null;
            for (const [sourceWorkflowStepId, targetWorkflowStepId] of Object.entries(data.workflowMapping)) {
                if( targetWorkflowStepId === 'previousSubmission'){
                    // Get the original submission first
                    if(previousSubmissionId === null){
                        throw new Error("First step selected does not map to a submission.");
                    }    
                    let originalSubmission = await this.models['submission'].findOne(
                        { where: { id: previousSubmissionId } }, 
                        { transaction: options.transaction }
                    );
                    
                    // Follow the parent chain to find the root submission
                    originalSubmission = await this.models['submission'].getRootSubmission(originalSubmission);
                    
                    // Now find the submission that has previousSubmissionId pointing to this root
                    const latestSubmission = await this.models['submission'].findOne(
                        { where: { previousSubmissionId: originalSubmission?.id } }, 
                        { transaction: options.transaction }
                    );
                    //get document based on validation file for now getting pdf
                    if(!latestSubmission){
                        throw new Error("The latest version of the chosen submission could not be found.");
                    }
                    const document = await this.models['document'].findOne(
                        { where: { submissionId: latestSubmission.id, type: 0} },
                        { transaction: options.transaction }
                    );
                    
                    currentDocuments.push({
                        documentId: document.id,
                        workflowStepId: Number(sourceWorkflowStepId),
                        submissionId: document?.submissionId || null, 
                    });
                }
                else {                
                const sourceStudyStep = await this.models['study_step'].findOne(
                    { where: { workflowStepId: targetWorkflowStepId, studyId: studySession.studyId } }, 
                    { transaction: options.transaction }
                );
                
                const originalDocument = await this.models['document'].getById(
                    sourceStudyStep.documentId, 
                    { transaction: options.transaction }
                );
                
                let duplicatedDocument;
                previousSubmissionId = originalDocument.submissionId;
                
                // Check if document has a submissionId
                if (originalDocument.submissionId) {
                    // Copy the submission with all its documents, passing overrides for context
                    const copyResult = await this.models['submission'].copySubmission(
                        originalDocument.submissionId,
                        this.userId,
                        { hideInFrontend: true }, // Submission overrides
                        {}, // Document overrides
                        [
                            {
                                studySessionId: null,
                                studyStepId: null,
                            },
                            {
                                studySessionId: studySession.id,
                                studyStepId: sourceStudyStep.id,
                            }
                        ],
                        { transaction: options.transaction }
                    );
                    
                    // Use the document mapping to find the correct duplicated document
                    duplicatedDocument = copyResult.copiedDocuments.find(doc => 
                       doc.parentDocumentId === originalDocument.id
                    );
                } else {
                    // No submission - duplicate document directly
                    duplicatedDocument = await this.models['document'].duplicateDocument(
                        originalDocument.id,
                        {},       
                        [
                            {
                                studySessionId: null,
                                studyStepId: null,
                            },
                            {
                                studySessionId: studySession.id,
                                studyStepId: sourceStudyStep.id,
                            }
                        ],
                        { transaction: options.transaction }
                    );
                }

                    currentDocuments.push({
                        documentId: duplicatedDocument.id,
                        workflowStepId: Number(sourceWorkflowStepId),
                        submissionId: duplicatedDocument?.submissionId || null, 
                    });
                }
            }
            duplicatedDocuments.push(currentDocuments);
        }
        return duplicatedDocuments;
    }
    init() {

        this.createSocket("assignmentCreateSingle", this.createAssignmentSingle, {}, true);
        this.createSocket("assignmentCreateBulk", this.createAssignmentBulk, {}, true);
        this.createSocket("assignmentAdd", this.addReviewer, {}, true);
        this.createSocket("assignmentGetInfo", this.getAssignmentInfoFromCourse, {}, false);
    }
};

module.exports = AssignmentSocket;