const Socket = require("../Socket.js");
const {v4: uuidv4} = require("uuid");
const _ = require("lodash");
const {Op} = require("sequelize");
const {getEmailContent} = require("../../utils/helper/email");
const TranslatableError = require("../../utils/TranslatableError");
const {canOf} = require("../utils/restHelpers");
const {buildRoleBulkCsvRows} = require("../../utils/helper/roleBulkCsv.js");

/**
 * Assignments (the `assignment` table: an assignment collects submissions) for
 * /rest/v1/assignments only. Not the review assignments below, which create review studies.
 * The dashboard edits these through the generic table socket (appDataUpdate on assignment and
 * assignment_share in AssignmentModal.vue and Assignments.vue).
 */

const ASSIGNMENTS_VIEW_ALL = 'frontend.dashboard.assignments.viewAll';
const ASSIGNMENTS_EDIT_ALL = 'frontend.dashboard.assignments.edit';
const ASSIGNMENT_WRITABLE_FIELDS = [
    'name', 'description', 'projectId', 'start', 'end', 'maxRevisions', 'validationConfigurationId',
    'allowReUpload', 'notifyOnSubmissionUpload', 'submissionWarning',
];
const ASSIGNMENT_PUBLIC_FIELDS = ['id', 'userId', ...ASSIGNMENT_WRITABLE_FIELDS, 'closed', 'createdAt', 'updatedAt'];

/** Share rows of several assignments in one query, as {roles, users} per assignment id. */
async function sharesByAssignment(models, assignmentIds, transaction) {
    const rows = assignmentIds.length === 0 ? [] : await models['assignment_share'].findAll({
        where: {assignmentId: assignmentIds, deleted: {[Op.not]: true}},
        attributes: ['assignmentId', 'roleId', 'userId'],
        raw: true,
        transaction,
    });
    const shares = new Map(assignmentIds.map((id) => [id, {roles: [], users: []}]));
    for (const row of rows) {
        const entry = shares.get(row.assignmentId);
        if (row.roleId) {
            entry.roles.push(row.roleId);
        }
        if (row.userId) {
            entry.users.push(row.userId);
        }
    }
    return shares;
}

function assignmentWithShares(row, shares) {
    const plain = typeof row.get === 'function' ? row.get({plain: true}) : row;
    const assignment = Object.fromEntries(ASSIGNMENT_PUBLIC_FIELDS.map((key) => [key, plain[key] ?? null]));
    assignment.shareWith = shares.get(plain.id) || {roles: [], users: []};
    return assignment;
}

async function publicAssignment(models, row, transaction) {
    const plain = typeof row.get === 'function' ? row.get({plain: true}) : row;
    return assignmentWithShares(plain, await sharesByAssignment(models, [plain.id], transaction));
}

/**
 * Whether the caller may see one assignment: own, shared with them by user or role, or viewAll.
 */
async function canSeeAssignment(models, userId, assignment, can) {
    if (assignment.userId === userId || await can(ASSIGNMENTS_VIEW_ALL)) {
        return true;
    }
    const filter = await models['assignment'].getUserFilter(userId);
    return Boolean(filter.shared && filter.shared.id[Op.in].includes(assignment.id));
}

async function loadAssignmentForChange(options, userId, id) {
    const assignment = await options.models['assignment'].getById(id, {transaction: options.transaction});
    if (!assignment) {
        return null;
    }
    if (assignment.userId !== userId && !(await canOf(options)(ASSIGNMENTS_EDIT_ALL))) {
        throw new TranslatableError('errors.rest.assignmentNoAccess');
    }
    return assignment;
}

/**
 * Turn {roles: [id or name], users: [id]} into role ids and user ids, checking each exists.
 */
async function resolveShares(models, shareWith, transaction) {
    const roleRows = await models['user_role'].findAll({attributes: ['id', 'name'], raw: true, transaction});
    const roleIds = [];
    for (const key of shareWith.roles || []) {
        const role = roleRows.find((row) => row.id === key || row.name === key);
        if (!role) {
            throw new TranslatableError('errors.rest.roleNotFound', {role: key});
        }
        roleIds.push(role.id);
    }
    const userIds = [...new Set(shareWith.users || [])];
    if (userIds.length > 0) {
        const found = await models['user'].findAll({where: {id: userIds, deleted: false}, attributes: ['id'], raw: true, transaction});
        for (const id of userIds) {
            if (!found.some((row) => row.id === id)) {
                throw new TranslatableError('errors.rest.reviewerNotFound', {id});
            }
        }
    }
    return {roleIds: [...new Set(roleIds)], userIds};
}

/**
 * Make the share rows of an assignment match the given roles and users. Mirrors the share step
 * of AssignmentModal.vue (assignment_share rows with a roleId or a userId).
 */
async function replaceShares(models, assignmentId, shareWith, transaction) {
    const {roleIds, userIds} = await resolveShares(models, shareWith, transaction);
    const existing = await models['assignment_share'].findAll({
        where: {assignmentId, deleted: {[Op.not]: true}},
        raw: true,
        transaction,
    });
    for (const row of existing) {
        const keep = row.roleId ? roleIds.includes(row.roleId) : userIds.includes(row.userId);
        if (!keep) {
            await models['assignment_share'].deleteById(row.id, {transaction});
        }
    }
    for (const roleId of roleIds.filter((id) => !existing.some((row) => row.roleId === id))) {
        await models['assignment_share'].add({assignmentId, roleId, userId: null}, {transaction});
    }
    for (const userId of userIds.filter((id) => !existing.some((row) => row.userId === id))) {
        await models['assignment_share'].add({assignmentId, userId, roleId: null}, {transaction});
    }
}

/**
 * Project and validation configuration of an assignment must exist; the project must be usable.
 */
async function checkAssignmentReferences(models, userId, fields, transaction) {
    const {userCanUseProject} = require('./project');
    if (fields.projectId != null && !(await userCanUseProject(models, userId, fields.projectId))) {
        throw new TranslatableError('errors.rest.invalidProjectId');
    }
    if (fields.validationConfigurationId != null) {
        const configuration = await models['configuration'].getById(fields.validationConfigurationId, {transaction});
        if (!configuration || configuration.type !== 1) {
            throw new TranslatableError('errors.rest.invalidValidationConfiguration');
        }
    }
}

/**
 * Own assignments, those shared with the caller, or all with viewAll on the token.
 * Mirrors the Assignments dashboard list (assignment table with Assignment.getUserFilter).
 */
async function listAssignments({userId}, options) {
    const models = options.models;
    let where = {deleted: false};
    if (!(await canOf(options)(ASSIGNMENTS_VIEW_ALL))) {
        const filter = await models['assignment'].getUserFilter(userId);
        where = {deleted: false, [Op.or]: [filter.owned, ...(filter.shared ? [filter.shared] : [])]};
    }
    const rows = await models['assignment'].findAll({where, order: [['id', 'ASC']], raw: true});
    const shares = await sharesByAssignment(models, rows.map((row) => row.id));
    return rows.map((row) => assignmentWithShares(row, shares));
}

async function getAssignment({userId, id}, options) {
    const assignment = await options.models['assignment'].getById(id);
    if (!assignment) {
        return null;
    }
    if (!(await canSeeAssignment(options.models, userId, assignment, canOf(options)))) {
        throw new TranslatableError('errors.rest.assignmentNoAccess');
    }
    return publicAssignment(options.models, assignment);
}

/**
 * Mirrors AssignmentModal.vue save (appDataUpdate on assignment, then assignment_share).
 * Differs: the owner is always the token's user; project and configuration are checked.
 */
async function addAssignment({userId, fields, shareWith}, options) {
    const models = options.models;
    // The dashboard creates an assignment inside the current project; REST uses the same default.
    if (fields.projectId === undefined) {
        const {defaultProjectFor} = require('./project');
        fields = {...fields, projectId: await defaultProjectFor(models, userId)};
    }
    await checkAssignmentReferences(models, userId, fields, options.transaction);
    const assignment = await models['assignment'].add({...fields, userId}, {transaction: options.transaction});
    if (shareWith) {
        await replaceShares(models, assignment.id, shareWith, options.transaction);
    }
    return publicAssignment(models, assignment, options.transaction);
}

/**
 * Change fields and, when given, the whole share list. Own assignments, or any with
 * assignments.edit on the token. Mirrors AssignmentModal.vue edit.
 */
async function updateAssignment({userId, id, fields, shareWith}, options) {
    const models = options.models;
    const assignment = await loadAssignmentForChange(options, userId, id);
    if (!assignment) {
        return null;
    }
    await checkAssignmentReferences(models, userId, fields, options.transaction);
    if (Object.keys(fields).length > 0) {
        await models['assignment'].updateById(assignment.id, fields, {transaction: options.transaction});
    }
    if (shareWith) {
        await replaceShares(models, assignment.id, shareWith, options.transaction);
    }
    return publicAssignment(models, await models['assignment'].getById(assignment.id, {transaction: options.transaction}), options.transaction);
}

/**
 * Close an assignment: no more uploads. Mirrors the close action in Assignments.vue.
 */
async function closeAssignment({userId, id}, options) {
    const assignment = await loadAssignmentForChange(options, userId, id);
    if (!assignment) {
        return null;
    }
    if (assignment.closed) {
        throw new TranslatableError('errors.rest.assignmentAlreadyClosed');
    }
    const updated = await options.models['assignment'].updateById(assignment.id, {closed: new Date()}, {transaction: options.transaction});
    return publicAssignment(options.models, updated, options.transaction);
}

/**
 * Soft-delete an assignment that has no submissions, so no student work loses its assignment.
 * Mirrors the delete action in Assignments.vue. Differs: refused while submissions exist.
 */
async function deleteAssignment({userId, id}, options) {
    const models = options.models;
    const assignment = await loadAssignmentForChange(options, userId, id);
    if (!assignment) {
        return null;
    }
    const submissions = await models['submission'].count({where: {assignmentId: assignment.id, deleted: false}, transaction: options.transaction});
    if (submissions > 0) {
        throw new TranslatableError('errors.rest.assignmentHasSubmissions');
    }
    await models['assignment'].deleteById(assignment.id, {transaction: options.transaction});
    return true;
}

/**
 * Review-assignment actions for /rest/v1/review-assignments only. The socket methods below do not call these.
 * Callers pass ids. Every row (template, items, reviewers, study) is loaded and access-checked here,
 * so a request body can never supply study fields or act as another user.
 */

const ASSIGNMENT_TYPES = ['document', 'submission', 'study_session'];
const ASSIGNMENT_MODES = ['everyReviewer', 'byRole', 'byCount', 'sessionOwner'];
const ITEM_MODEL = {document: 'document', submission: 'submission', study_session: 'study_session'};

async function loadTemplateForAssignment(models, userId, templateId, transaction, can) {
    const {userCanViewStudy} = require('./study');
    const template = await models['study'].getById(templateId, {transaction});
    if (!template) {
        throw new TranslatableError('errors.rest.templateNotFound');
    }
    if (!(await userCanViewStudy(can, userId, template))) {
        throw new TranslatableError('errors.rest.studyNoAccess');
    }
    if (!template.template) {
        throw new TranslatableError('errors.rest.notAStudyTemplate');
    }
    return template;
}

/**
 * Load the documents, submissions, or study sessions to assign. Same visibility as the Assignments view.
 */
async function loadAssignmentItems(models, userId, type, itemIds, transaction, can) {
    const {userHasDocumentAccess} = require('./document');
    const {userCanViewStudy} = require('./study');
    const seeAll = await can(ASSIGNMENTS_VIEW_ALL);
    // One query for all items; the checks below still go in the order the caller sent them.
    const rows = await models[ITEM_MODEL[type]].findAll({where: {id: itemIds, deleted: false}, raw: true, transaction});
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = [];
    for (const id of itemIds) {
        const item = byId.get(id);
        if (!item) {
            throw new TranslatableError('errors.rest.assignmentItemNotFound', {id});
        }
        let allowed = seeAll;
        if (!allowed && type === 'document') {
            allowed = await userHasDocumentAccess(models, userId, item.id, can);
        } else if (!allowed && type === 'submission') {
            allowed = item.userId === userId;
        } else if (!allowed) {
            const study = await models['study'].getById(item.studyId, {transaction});
            allowed = await userCanViewStudy(can, userId, study);
        }
        if (!allowed) {
            throw new TranslatableError('errors.rest.assignmentItemNoAccess', {id});
        }
        items.push(item);
    }
    return items;
}

async function loadReviewers(models, reviewerIds, transaction) {
    if (reviewerIds.length === 0) {
        return [];
    }
    const users = await models['user'].findAll({
        where: {id: reviewerIds, deleted: false},
        attributes: ['id', 'firstName', 'lastName'],
        raw: true,
        transaction,
    });
    for (const id of reviewerIds) {
        if (!users.some((user) => user.id === id)) {
            throw new TranslatableError('errors.rest.reviewerNotFound', {id});
        }
    }
    return users;
}

/**
 * Resolve { roleIdOrName: reviewsPerUser } to the users of each role.
 * Listing a role's users needs the same right the dashboard user list needs.
 */
async function loadRoleGroups(models, roles, reviewerIds, transaction, can) {
    const allRoles = await models['user_role'].findAll({attributes: ['id', 'name'], raw: true, transaction});
    const groups = [];
    for (const [key, needed] of Object.entries(roles)) {
        if (needed === 0) {
            continue;
        }
        const role = allRoles.find((row) => String(row.id) === key || row.name === key);
        if (!role) {
            throw new TranslatableError('errors.rest.roleNotFound', {role: key});
        }
        const mayList = await can(`backend.socket.user.getUsers.${role.name}`)
            || await can('backend.socket.user.getUsers.all');
        if (!mayList) {
            throw new TranslatableError('errors.rest.roleNoAccess', {role: role.name});
        }
        const matches = await models['user_role_matching'].findAll({
            where: {userRoleId: role.id, deleted: false},
            attributes: ['userId'],
            raw: true,
            transaction,
        });
        let memberIds = [...new Set(matches.map((row) => row.userId))];
        if (reviewerIds.length > 0) {
            memberIds = memberIds.filter((id) => reviewerIds.includes(id));
        }
        const users = memberIds.length === 0 ? [] : await models['user'].findAll({
            where: {id: memberIds, deleted: false},
            attributes: ['id', 'firstName', 'lastName'],
            raw: true,
            transaction,
        });
        groups.push({roleName: role.name, needed, users});
    }
    return groups;
}

/**
 * Every user of each role reviews `needed` items. Nobody reviews their own item, and items are
 * filled evenly. Same rules as assignmentCreateBulk in role mode.
 * @returns {Array<{item: Object, reviewerIds: number[]}>}
 * Mirrors the role mode of AssignmentSocket.createAssignmentBulk. Rewritten: same rules, different code.
 */
function planByRole(items, groups) {
    const itemById = Object.fromEntries(items.map((item) => [item.id, item]));
    const counter = Object.fromEntries(items.map((item) => [item.id, 0]));
    const reviewersByItem = {};

    for (const {roleName, needed, users} of groups) {
        const queue = _.shuffle(users);
        if (queue.length === 0) {
            throw new TranslatableError('errors.assignment.noUsersFoundForRole', {roleName});
        }
        if (needed > items.length) {
            throw new TranslatableError('errors.assignment.notEnoughDocumentsForRole', {roleName});
        }
        for (const user of queue) {
            if (items.filter((item) => item.userId !== user.id).length < needed) {
                throw new TranslatableError('errors.assignment.notEnoughDocumentsForReviewer', {
                    reviewerName: `${user.firstName} ${user.lastName}`,
                });
            }
        }

        const assigned = {};
        const fits = (item, user) => item.userId !== user.id && !assigned[user.id].includes(item.id);
        for (const user of queue) {
            assigned[user.id] = [];
            while (assigned[user.id].length < needed) {
                const minCount = Math.min(...Object.values(counter));
                const next = items.find((item) => counter[item.id] === minCount && fits(item, user));
                if (next) {
                    assigned[user.id].push(next.id);
                    counter[next.id]++;
                    continue;
                }
                // No least-reviewed item fits this user. Take a fitting item from an earlier user
                // and give that user a least-reviewed item instead.
                let swapped = false;
                for (const other of queue) {
                    if (other.id === user.id || !assigned[other.id]) {
                        continue;
                    }
                    const takeId = assigned[other.id].find((id) => fits(itemById[id], user));
                    if (takeId === undefined) {
                        continue;
                    }
                    const replacement = items.find((item) =>
                        counter[item.id] === minCount && item.id !== takeId && fits(item, other));
                    if (!replacement) {
                        continue;
                    }
                    assigned[other.id] = assigned[other.id].filter((id) => id !== takeId);
                    assigned[other.id].push(replacement.id);
                    assigned[user.id].push(takeId);
                    counter[replacement.id]++;
                    swapped = true;
                    break;
                }
                if (!swapped) {
                    throw new TranslatableError('errors.assignment.unableToAssignEnoughDocuments', {
                        reviewerName: `${user.firstName} ${user.lastName}`,
                        roleName,
                    });
                }
            }
        }
        for (const [reviewerId, itemIds] of Object.entries(assigned)) {
            for (const itemId of itemIds) {
                (reviewersByItem[itemId] ||= []).push(Number(reviewerId));
            }
        }
    }
    return Object.entries(reviewersByItem).map(([itemId, reviewerIds]) => ({item: itemById[itemId], reviewerIds}));
}

/**
 * Each item goes to exactly one reviewer. `counts` is how many items each reviewer takes.
 * Nobody reviews their own item. Same rules as assignmentCreateBulk in reviewer mode.
 * @returns {Array<{item: Object, reviewerIds: number[]}>}
 * Mirrors the reviewer mode of AssignmentSocket.createAssignmentBulk. Rewritten: same rules, different code.
 */
function planByReviewer(items, counts) {
    const remaining = {...counts};
    const taken = Object.fromEntries(Object.keys(counts).map((id) => [id, []]));

    for (const item of items) {
        const free = Object.keys(remaining).find((id) => remaining[id] > 0 && item.userId !== Number(id));
        if (free !== undefined) {
            taken[free].push(item);
            remaining[free]--;
            continue;
        }
        // Only the item's owner has room left. Hand the item to another reviewer and give the owner
        // one of that reviewer's items in exchange.
        const owner = String(item.userId);
        let swapped = false;
        if (remaining[owner] > 0) {
            for (const other of Object.keys(taken)) {
                const give = other === owner ? undefined : taken[other].find((held) => held.userId !== item.userId);
                if (give === undefined) {
                    continue;
                }
                taken[other] = taken[other].filter((held) => held !== give);
                taken[other].push(item);
                taken[owner].push(give);
                remaining[owner]--;
                swapped = true;
                break;
            }
        }
        if (!swapped) {
            throw new TranslatableError('errors.assignment.couldNotAssignReviewers');
        }
    }
    return Object.entries(taken).flatMap(([reviewerId, held]) =>
        held.map((item) => ({item, reviewerIds: [Number(reviewerId)]})));
}

/**
 * Add the item's id to every template marker in a study step configuration.
 */
function fillTemplateMarkers(config, context) {
    if (Array.isArray(config)) {
        return config.map((entry) => fillTemplateMarkers(entry, context));
    }
    if (!config || typeof config !== 'object') {
        return config;
    }
    const result = {};
    for (const [key, value] of Object.entries(config)) {
        if (!value || !value.isTemplate) {
            result[key] = fillTemplateMarkers(value, context);
        } else if (context.assignmentType === 'submission') {
            result[key] = {...value, submissionId: context.submissionId};
        } else if (context.assignmentType === 'document') {
            result[key] = {...value, documentId: context.documentId};
        } else {
            result[key] = {
                ...value,
                ...(context.submissionId && {submissionId: context.submissionId}),
                ...(context.documentId && {documentId: context.documentId}),
            };
        }
    }
    return result;
}

/**
 * The PDF a submission is reviewed on: the one named in its validation configuration, else the first.
 */
async function primaryDocumentId(models, submission, transaction) {
    const docs = await models['document'].findAll({
        where: {submissionId: submission.id, deleted: false, type: 0},
        order: [['id', 'ASC']],
        raw: true,
        transaction,
    });
    if (docs.length === 0) {
        return null;
    }
    const configuration = submission.validationConfigurationId
        ? await models['configuration'].getById(submission.validationConfigurationId, {transaction})
        : null;
    const primaryId = configuration?.content?.primaryDocument ?? configuration?.primaryDocument;
    return (docs.find((doc) => doc.id === primaryId) || docs[0]).id;
}

/**
 * Copy a study session's documents for a follow-up study, one entry per mapped workflow step.
 * Same steps as AssignmentSocket.duplicate, for one session.
 * Mirrors AssignmentSocket.duplicate, for one session.
 */
async function duplicateSessionDocuments(models, userId, studySession, workflowMapping, transaction) {
    const documents = [];
    let previousSubmissionId = null;
    for (const [sourceWorkflowStepId, targetWorkflowStepId] of Object.entries(workflowMapping)) {
        if (targetWorkflowStepId === 'previousSubmission') {
            if (previousSubmissionId === null) {
                throw new TranslatableError('errors.assignment.firstStepNotSubmission');
            }
            const original = await models['submission'].findOne({where: {id: previousSubmissionId}, transaction});
            const root = await models['submission'].getRootSubmission(original);
            const latest = await models['submission'].findOne({where: {previousSubmissionId: root?.id}, transaction});
            if (!latest) {
                throw new TranslatableError('errors.assignment.latestSubmissionNotFound');
            }
            const document = await models['document'].findOne({where: {submissionId: latest.id, type: 0}, transaction});
            if (!document) {
                throw new TranslatableError('errors.assignment.latestSubmissionNotFound');
            }
            documents.push({
                documentId: document.id,
                workflowStepId: Number(sourceWorkflowStepId),
                submissionId: document.submissionId || null,
            });
            continue;
        }

        const sourceStep = await models['study_step'].findOne({
            where: {workflowStepId: targetWorkflowStepId, studyId: studySession.studyId},
            transaction,
        });
        const original = sourceStep && await models['document'].getById(sourceStep.documentId, {transaction});
        if (!original) {
            throw new TranslatableError('errors.rest.invalidWorkflowMapping');
        }
        previousSubmissionId = original.submissionId;
        const scope = [
            {studySessionId: null, studyStepId: null},
            {studySessionId: studySession.id, studyStepId: sourceStep.id},
        ];
        let copy;
        if (original.submissionId) {
            const result = await models['submission'].copySubmission(
                original.submissionId, userId, {hideInFrontend: true}, {}, scope, {transaction});
            copy = result.copiedDocuments.find((doc) => doc.parentDocumentId === original.id);
        } else {
            copy = await models['document'].duplicateDocument(original.id, {}, scope, {transaction});
        }
        documents.push({
            documentId: copy.id,
            workflowStepId: Number(sourceWorkflowStepId),
            submissionId: copy.submissionId || null,
        });
    }
    return documents;
}

/**
 * The document for each workflow step of one item. Documents and submissions go on the first step.
 */
async function itemStepDocuments(models, userId, type, item, workflowSteps, workflowMapping, transaction) {
    if (type === 'study_session') {
        return duplicateSessionDocuments(models, userId, item, workflowMapping, transaction);
    }
    const firstDocumentId = type === 'submission'
        ? await primaryDocumentId(models, item, transaction)
        : item.id;
    return workflowSteps.map((step, index) => ({
        documentId: index === 0 ? firstDocumentId : null,
        workflowStepId: step.id,
    }));
}

/**
 * Create one review study for one item from the template. Same result as AssignmentSocket.createAssignment.
 * Mirrors AssignmentSocket.createAssignment. Differs: template loaded by id instead of sent by the client.
 */
async function createAssignmentStudy({userId, template, templateSteps, workflowSteps, type, item, documents, reviewerCount}, options) {
    const models = options.models;
    const workflowStepById = Object.fromEntries(workflowSteps.map((step) => [step.id, step]));
    const stepDocuments = [];
    for (const step of templateSteps) {
        if (!step.workflowStepId) {
            continue;
        }
        const override = documents.find((doc) => doc.workflowStepId === step.workflowStepId) || null;
        let documentId = override?.documentId ?? step.documentId;
        if (override?.documentId == null) {
            // A step that shows another step's document inherits that step's template document.
            const reference = workflowStepById[step.workflowStepId]?.workflowStepDocument;
            const referenced = reference != null && templateSteps.find((other) => other.workflowStepId === reference);
            if (referenced && referenced.documentId != null) {
                documentId = referenced.documentId;
            }
        }
        const context = {assignmentType: type, submissionId: null, documentId: null};
        if (type === 'study_session') {
            context.submissionId = override?.submissionId || null;
            context.documentId = documentId || null;
        } else if (type === 'submission') {
            context.submissionId = item.id;
        } else {
            context.documentId = item.id;
        }
        stepDocuments.push({
            id: step.workflowStepId,
            documentId,
            configuration: fillTemplateMarkers(step.configuration, context),
        });
    }

    const newStudy = {
        ...template,
        createdByUserId: userId,
        userId: item.userId,
        template: false,
        id: undefined,
        hash: undefined,
        closed: undefined,
        userIdClosed: undefined,
        parentStudyId: type === 'study_session' ? item.studyId : null,
        limitSessions: reviewerCount,
        limitSessionsPerUser: 1,
        resumable: true,
        stepDocuments,
    };
    return models['study'].add(newStudy, {
        transaction: options.transaction,
        context: newStudy,
        doNotDuplicate: type === 'study_session',
    });
}

/**
 * One study session per reviewer. Raises the study's session limit when it would be exceeded.
 * Mirrors AssignmentSocket.addReviewer (assignmentAdd). Differs: a null limit stays unlimited.
 */
async function addReviewerSessions(study, reviewerIds, options, {fresh = false} = {}) {
    const models = options.models;
    const transaction = options.transaction;
    // 0 and null both mean unlimited, as in the session model's check. A study created in this
    // request was made with room for exactly these reviewers, so it needs no count.
    if (!fresh && study.limitSessions > 0) {
        const existing = await models['study_session'].count({where: {studyId: study.id}, transaction});
        if (existing + reviewerIds.length > study.limitSessions) {
            await models['study'].updateById(study.id, {limitSessions: existing + reviewerIds.length}, {transaction});
        }
    }
    const sessions = [];
    for (const reviewerId of reviewerIds) {
        sessions.push(await models['study_session'].add({studyId: study.id, userId: reviewerId}, {transaction}));
    }
    return sessions;
}

/**
 * Mirrors AssignmentSocket.sendAssignmentEmail.
 */
async function sendAssignmentEmail(session, study, type, options) {
    const models = options.models;
    const user = await models['user'].getById(session.userId);
    if (!user || !user.email) {
        options.logger.warn(`Cannot send assignment email: user ${session.userId} has no email`);
        return;
    }
    const baseUrl = await models['setting'].get('system.baseUrl') || 'localhost:3000';
    const content = await getEmailContent('email.template.assignment', 'assignment', {
        userId: session.userId,
        creatorId: study.userId,
        studyId: study.id,
        studySessionId: session.id,
        studySessionHash: session.hash,
        baseUrl,
        link: `http://${baseUrl}/session/${session.hash}`,
        assignmentType: type,
        assignmentName: study.name,
    }, models, options.logger);
    await options.server.sendMail(user.email, content.subject, content.body, {isHtml: content.isHtml});
}

function assignmentResult(study, itemId, sessions) {
    return {
        id: study.id,
        hash: study.hash,
        name: study.name,
        itemId,
        sessions: sessions.map((session) => ({id: session.id, hash: session.hash, userId: session.userId})),
    };
}

/**
 * Create review assignments, or add reviewers to an existing study. One function for what the
 * dashboard does with assignmentCreateSingle, assignmentCreateBulk, and assignmentAdd.
 *
 * With `studyId`: add one session per reviewer to that study.
 * With `templateId`: create one study per item from the template, then add the reviewer sessions.
 *   mode 'everyReviewer' every item is reviewed by every reviewer (one item is the single assignment)
 *   mode 'byRole'        every user of each role reviews `roles[role]` items
 *   mode 'byCount'       each item goes to one reviewer, `counts[userId]` items per reviewer
 *   mode 'sessionOwner'  each study session goes back to its own user (type 'study_session' only)
 * The route turns the request's lists into the maps `roles` {roleNameOrId: items} and
 * `counts` {userId: items}.
 * With `dryRun` nothing is written and the planned distribution is returned.
 *
 * @param {Object} data
 * @param {number} data.userId acting user, from the token
 * @param {Object} options needs transaction, models, logger, server
 * @returns {Promise<{dryRun: boolean, plan?: Array, studies?: Array}>}
 * Mirrors AssignmentSocket.createAssignmentSingle, createAssignmentBulk and addReviewer (assignmentCreateSingle, assignmentCreateBulk, assignmentAdd). Differs: ids only, rows loaded and checked here.
 */
async function createReviewAssignments(data, options) {
    const models = options.models;
    const transaction = options.transaction;
    const {userId, type = 'document', mode = 'everyReviewer', notify = false, dryRun = false} = data;
    const reviewerIds = [...new Set(data.reviewerIds || [])];
    // Rights come from the API token, never from the owner alone.
    const can = canOf(options);

    if (data.studyId != null) {
        const {userCanViewStudy} = require('./study');
        const study = await models['study'].getById(data.studyId, {transaction});
        if (!study) {
            throw new TranslatableError('errors.rest.studyNotFound');
        }
        if (!(await userCanViewStudy(can, userId, study))) {
            throw new TranslatableError('errors.rest.studyNoAccess');
        }
        if (study.template || study.closed) {
            throw new TranslatableError('errors.rest.studyNotEditable');
        }
        await loadReviewers(models, reviewerIds, transaction);
        if (dryRun) {
            return {dryRun: true, plan: [{studyId: study.id, reviewerIds}]};
        }
        const sessions = await addReviewerSessions(study, reviewerIds, options);
        if (notify) {
            // Not returned, so the answer does not wait for mail delivery. Failures are logged.
            transaction.afterCommit(() => {
                (async () => {
                    for (const session of sessions) {
                        await sendAssignmentEmail(session, study, 'document', options)
                            .catch((error) => options.logger.error('Failed to send assignment email: ' + error));
                    }
                })();
            });
        }
        return {dryRun: false, studies: [assignmentResult(study, null, sessions)]};
    }

    if (!ASSIGNMENT_TYPES.includes(type) || !ASSIGNMENT_MODES.includes(mode)
        || (mode === 'sessionOwner' && type !== 'study_session')) {
        throw new TranslatableError('errors.assignment.invalidMode');
    }
    const template = await loadTemplateForAssignment(models, userId, data.templateId, transaction, can);
    const items = _.shuffle(await loadAssignmentItems(models, userId, type, [...new Set(data.itemIds)], transaction, can));

    let plan;
    if (mode === 'byRole') {
        plan = planByRole(items, await loadRoleGroups(models, data.roles, reviewerIds, transaction, can));
    } else if (mode === 'byCount') {
        await loadReviewers(models, Object.keys(data.counts).map(Number), transaction);
        plan = planByReviewer(items, data.counts);
    } else if (mode === 'sessionOwner') {
        plan = items.map((item) => ({item, reviewerIds: [item.userId]}));
    } else {
        await loadReviewers(models, reviewerIds, transaction);
        plan = items.map((item) => ({item, reviewerIds}));
    }
    if (dryRun) {
        return {
            dryRun: true,
            plan: plan.map((entry) => ({itemId: entry.item.id, reviewerIds: entry.reviewerIds})),
        };
    }

    const templateSteps = await models['study_step'].getAllByKey('studyId', template.id) || [];
    const workflowSteps = await models['workflow_step'].getSortedWorkflowSteps(template.workflowId);
    const created = [];
    for (const {item, reviewerIds: itemReviewerIds} of plan) {
        const documents = await itemStepDocuments(
            models, userId, type, item, workflowSteps, data.workflowMapping, transaction);
        const study = await createAssignmentStudy({
            userId, template, templateSteps, workflowSteps, type, item, documents,
            reviewerCount: itemReviewerIds.length,
        }, options);
        const sessions = await addReviewerSessions(study, itemReviewerIds, options, {fresh: true});
        created.push({study, itemId: item.id, sessions});
    }
    if (notify) {
        // Not returned, so the answer does not wait for mail delivery. Failures are logged.
        transaction.afterCommit(() => {
            (async () => {
                for (const {study, sessions} of created) {
                    for (const session of sessions) {
                        await sendAssignmentEmail(session, study, type, options)
                            .catch((error) => options.logger.error('Failed to send assignment email: ' + error));
                    }
                }
            })();
        });
    }
    return {
        dryRun: false,
        studies: created.map(({study, itemId, sessions}) => assignmentResult(study, itemId, sessions)),
    };
}

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
        const documentOverrides = data.assignmentType === "submission"
            ? await this.submissionStepDocuments(data["assignment"]?.id, workflowSteps, options)
            : (data["documents"] || []);

        const stepDocuments = [];
        for (const step of templateStudySteps) {
            if (step.workflowStepId) {
                const stepDocument = documentOverrides.find(doc => doc.workflowStepId === step.workflowStepId) || null;
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
                        documentId: stepDocumentId || null
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
     * Document override for one submission assignment.
     * Puts the viewer's visible PDF of that submission (type 0, not deleted, lowest id)
     * on the first workflow step. An empty result leaves the template document in place.
     * @param {number} submissionId
     * @param {Array<Object>} workflowSteps workflow steps; the override uses the first element
     * @param {Object} [options]
     * @param {import("sequelize").Transaction} [options.transaction]
     * @returns {Promise<Array<{workflowStepId: number, documentId: number}>>} empty when no PDF is found
     */
    async submissionStepDocuments(submissionId, workflowSteps, options = {}) {
        const firstStep = workflowSteps[0];
        if (!submissionId || !firstStep) {
            return [];
        }
        // Row scope is the document ACL for this viewer, plus the submission PDF filter.
        const acl = await this.getReadFilter(
            this.userId, {submissionId, type: 0, deleted: false}, {}, "document", this.rolesUpdatedAt
        );
        if (!acl.accessAllowed) {
            return [];
        }
        const document = await this.models["document"].findOne({
            where: acl.filter,
            attributes: ["id"],
            order: [["id", "ASC"]],
            raw: true,
            transaction: options.transaction,
        });
        return document ? [{workflowStepId: firstStep.id, documentId: document.id}] : [];
    }

    /**
     * Socket entry point for adding reviewers to an existing study.
     * Verifies the caller may manage the target study before delegating to addReviewer,
     * which is also called internally by createAssignment for a study it just created.
     *
     * @socketEvent assignmentAdd
     * @param {Object} data The data for adding reviewers
     * @param {number} data.studyId The ID of the study to which reviewers are to be added
     * @param {Array<Object>} data.reviewer Reviewers to add
     * @param {Object} options holds the managed transaction of the database
     * @returns {Promise<void>} Resolves once reviewers have been added
     * @throws {TranslatableError} If the study does not exist or the caller may not manage it
     */
    async addReviewerRequest(data, options) {
        const study = await this.models["study"].getById(data['studyId'], {transaction: options.transaction});
        if (!study) {
            throw new TranslatableError("errors.studies.studyNotFound");
        }
        if (!(await this.checkUserAccess(study.userId))) {
            throw new TranslatableError("errors.studies.noPermissionManageStudies");
        }
        return await this.addReviewer(data, options);
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
     * Resolve query-scoped session / submission / reviewer selections into the row arrays
     * @param {Object} data
     * @param {Object} [options]
     * @param {import("sequelize").Transaction} [options.transaction] set by assignmentCreateBulk; the preview socket omits it
     * @returns {Promise<{selectedAssignments: Array, selectedReviewer: Array}>}
     */
    async resolveBulkAssignmentSelections(data, options = {}) {
        const transaction = options.transaction || null;
        if (!(await this.hasAccess("frontend.dashboard.studies.addBulkAssignments"))) {
            throw new TranslatableError("errors.permission.noPermissionToAccesData");
        }

        let selectedAssignments = Array.isArray(data.selectedAssignments) ? data.selectedAssignments : [];
        let selectedReviewer = Array.isArray(data.selectedReviewer) ? data.selectedReviewer : [];

        if (data.assignmentType === "study_session" && data.assignmentSelection) {
            const sessionIds = await this.resolveSelectionIds("study_session", data.assignmentSelection, transaction);
            if (sessionIds.length === 0) {
                throw new TranslatableError("errors.assignment.selectedNotResolved", {assignmentId: "none"});
            }
            const sessions = await this.models["study_session"].findActiveByIds(sessionIds, {transaction});
            const enriched = await this.enrichQueryTableItems(
                "study_session", sessions, this.userId, this.rolesUpdatedAt, transaction
            );
            const newStudyOwner = data.newStudyOwner === "study_owner" ? "study_owner" : "session_owner";
            selectedAssignments = enriched.map((session) => ({
                id: session.id,
                studyId: session.studyId,
                userId: newStudyOwner === "study_owner"
                    ? Number(session.studyUserId)
                    : Number(session.userId),
                sessionUserId: Number(session.userId),
                firstName: session.firstName || "",
                lastName: session.lastName || "",
                completeUserName: session.completeUserName || "",
            }));
        }

        if (data.assignmentType === "submission") {
            // Submissions come only from the BackendTable selection; client rows are not trusted.
            if (!data.assignmentSelection) {
                throw new TranslatableError("errors.assignment.selectedNotResolved", {assignmentId: "none"});
            }
            const submissionIds = await this.resolveSelectionIds("submission", data.assignmentSelection, transaction);
            if (submissionIds.length === 0) {
                throw new TranslatableError("errors.assignment.selectedNotResolved", {assignmentId: "none"});
            }
            const submissions = await this.models["submission"].findAll({
                where: {id: {[Op.in]: submissionIds}, deleted: false},
                attributes: ["id", "userId", "name"],
                order: [["id", "ASC"]],
                raw: true,
                ...(transaction ? {transaction} : {}),
            });
            // Owner names for the role-mode CSV, gated like the picker (userPublicInfo / userPrivateInfo)
            const enriched = await this.enrichQueryTableItems(
                "submission", submissions, this.userId, this.rolesUpdatedAt, transaction
            );
            selectedAssignments = enriched.map((submission) => ({
                id: submission.id,
                userId: submission.userId,
                name: submission.name,
                userName: submission.userName || "",
                firstName: submission.firstName || "",
                lastName: submission.lastName || "",
            }));
        }

        if (data.reviewerQuerySelection) {
            const userIds = await this.resolveSelectionIds("user", data.reviewerQuerySelection, transaction);
            if (userIds.length === 0) {
                throw new TranslatableError("errors.assignment.selectedNotResolved", {assignmentId: "reviewer"});
            }
            // Return only the columns the distribution step + CSV need
            const canSeePrivateInfo = await this.hasAccess("frontend.dashboard.studies.view.userPrivateInfo");
            const reviewerAttributes = canSeePrivateInfo
                ? ["id", "userName", "firstName", "lastName"]
                : ["id", "userName"];
            selectedReviewer = await this.models["user"].getAll({
                where: {id: {[Op.in]: userIds}, deleted: false},
                attributes: reviewerAttributes,
                ...(transaction ? {transaction} : {}),
            });
        }

        return {selectedAssignments, selectedReviewer};
    }

    /**
     * Load resolved assignment + reviewer rows for Distribution
     * @socketEvent assignmentBulkResolveSelection
     */
    async resolveBulkSelectionForClient(data) {
        return this.resolveBulkAssignmentSelections(data);
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
        const resolved = await this.resolveBulkAssignmentSelections(data, options);
        data.selectedAssignments = resolved.selectedAssignments;
        data.selectedReviewer = resolved.selectedReviewer;

        // first shuffle the assignments, we use the Fisher-Yates shuffle algorithm from lodash
        // we also need to make sure that the documents array is shuffled in the same way
        if(data.assignmentType === "study_session"){  
            data["documents"] = await this.duplicate(data, options);
        };
       
        const shuffledAssignments = _.shuffle(data.selectedAssignments.map((assignment, index) => ({
            // Submissions have no client step list; createAssignment picks their PDF.
            ...assignment, document: data.documents?.[index] ?? null
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
                    throw new TranslatableError( "errors.assignment.noUsersFoundForRole", {roleName: data['roles'].find((role) => role.id === roleId).name});
                }

                // check if there are enough assignment for each user, that are not from the user itself
                if (neededAssignments > shuffledAssignments.length) {
                    throw new TranslatableError( "errors.assignment.notEnoughDocumentsForRole", {roleName: data['roles'].find((role) => role.id === roleId).name});
                }

                for (const user of userQueue) {
                    if (shuffledAssignments.filter((assignment) => assignment.userId !== user.id).length < neededAssignments) {
                        throw new TranslatableError( "errors.assignment.notEnoughDocumentsForReviewer", {reviewerName: `${user.firstName} ${user.lastName}`});
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
                                            (assignedId) => assignedId !== swappableAssignment
                                        );

                                        // instead adding the other user's new assignment
                                        roleSelection[roleId]['assignments'][otherUser.id].push(otherUserNewAssignment.id);

                                        // add the swappable assignment to the current user
                                        roleSelection[roleId]['assignments'][user.id].push(swappableAssignment);

                                        // update the counters
                                        assignmentCounter[otherUserNewAssignment.id]++;

                                        swapped = true;
                                        break;

                                    }

                                }

                            }

                            if (!swapped) {
                                throw new TranslatableError( "errors.assignment.unableToAssignEnoughDocuments", {
                                    reviewerName: `${user.firstName} ${user.lastName}`,
                                    roleName: data['roles'].find((role) => role.id === roleId).name,
                                });
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
                const assignment = shuffledAssignments.find(
                    (a) => String(a.id) === String(assignmentId)
                );
                if (!assignment) {
                    throw new TranslatableError("errors.assignment.selectedNotResolved", {assignmentId});
                }
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

            return {
                distribution: finalAssignments,
                csvRows: buildRoleBulkCsvRows(
                    finalAssignments, data.selectedAssignments, data.selectedReviewer
                ),
            };

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
                        throw new TranslatableError("errors.assignment.couldNotAssignReviewers");
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
                    throw new TranslatableError( "errors.assignment.studySessionOwnerNotSelectedReviewer", {reviewerId});
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
                    const assignment = shuffledAssignments.find(
                        (a) => String(a.id) === String(assignmentId)
                    );
                    if (!assignment) {
                        throw new TranslatableError("errors.assignment.selectedNotResolved", {assignmentId});
                    }
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
            throw new TranslatableError("errors.assignment.invalidMode");
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
            if (value?.isTemplate) {
                switch (context.assignmentType) {
                    case 'submission':
                        result[key] = { ...value, submissionId: context.submissionId, documentId: context.documentId };
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
     * Check whether the current user can read an assignment.
     * @param {number} assignmentId The assignment to check
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @returns {Promise<boolean>} True if the assignment exists and is readable
     */
    async canReadAssignment(assignmentId, options) {
        const access = await this.getReadFilter(
            this.userId, { id: assignmentId, deleted: false }, {}, "assignment", this.rolesUpdatedAt
        );
        return access.accessAllowed && !!await this.models.assignment.findOne({
            where: access.filter, transaction: options.transaction
        });
    }

    /**
     * Load the submissions whose documents are used in the study steps of a study session.
     * @param {Object} studySession The selected study session
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @returns {Promise<Map<number, Object>|null>} Submissions by id, or null if the session is not readable
     */
    async getSessionInputSubmissions(studySession, options) {
        const sessionAccess = await this.getReadFilter(
            this.userId, { id: studySession.id, deleted: false }, {}, "study_session", this.rolesUpdatedAt
        );
        const selectedSession = sessionAccess.accessAllowed && await this.models.study_session.findOne({
            where: sessionAccess.filter, transaction: options.transaction
        });
        if (!selectedSession) return null;

        const steps = await this.models.study_step.findAll({
            where: { studyId: selectedSession.studyId, deleted: false },
            transaction: options.transaction
        });
        const documentIds = steps.map(step => step.documentId).filter(Boolean);
        const documents = documentIds.length ? await this.models.document.findAll({
            where: { id: documentIds, deleted: false },
            transaction: options.transaction
        }) : [];
        const submissionIds = documents.map(document => document.submissionId).filter(Boolean);
        const submissions = submissionIds.length ? await this.models.submission.findAll({
            where: { id: submissionIds, deleted: false },
            transaction: options.transaction
        }) : [];
        return new Map(submissions.map(submission => [submission.id, submission]));
    }

    /**
     * Resolve an assignment placeholder of the workflow mapping for one selected study session.
     * Uses the session's input submission of that assignment if there is exactly one, otherwise the
     * latest root submission of the session's single input author.
     * @param {Object} studySession The selected study session
     * @param {string} sourceType "submission" (needs a ZIP document) or "document" (needs a PDF document)
     * @param {number} assignmentId The assignment chosen in the workflow mapping
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @param {Object} cache Lookups shared within one duplicate() call ({assignments: Map, sessions: Map})
     * @returns {Promise<{documentId: number|null, submissionId: number}>} The PDF document (if any) and the submission
     * @throws {TranslatableError} errors.assignment.selectedNotResolved if the assignment or session is not readable
     * or no unique submission with the required document type is found
     */
    async resolveAssignmentSource(studySession, sourceType, assignmentId, options, cache) {
        const unresolved = () => new TranslatableError(
            "errors.assignment.selectedNotResolved", { assignmentId }
        );
        if (!cache.assignments.has(assignmentId)) {
            cache.assignments.set(assignmentId, await this.canReadAssignment(assignmentId, options));
        }
        if (!cache.assignments.get(assignmentId)) throw unresolved();

        if (!cache.sessions.has(studySession.id)) {
            cache.sessions.set(studySession.id, await this.getSessionInputSubmissions(studySession, options));
        }
        const submissions = cache.sessions.get(studySession.id);
        if (!submissions) throw unresolved();

        const matching = [...submissions.values()].filter(item => item.assignmentId === assignmentId);
        let submission;
        if (matching.length === 1) {
            submission = matching[0];
        } else if (matching.length > 1) {
            // A placeholder must never silently pick between multiple session inputs.
            throw unresolved();
        } else {
            const authors = [...new Set([...submissions.values()].map(item => item.userId))];
            if (authors.length !== 1) throw unresolved();
            submission = await this.models.submission.findOne({
                where: {
                    assignmentId, userId: authors[0], parentSubmissionId: null, deleted: false
                },
                order: [["createdAt", "DESC"], ["id", "DESC"]],
                transaction: options.transaction
            });
        }
        if (!submission) throw unresolved();

        const documents = await this.models.document.findAll({
            where: { submissionId: submission.id, deleted: false },
            order: [["id", "ASC"]],
            transaction: options.transaction
        });
        const { DOC_TYPE_PDF, DOC_TYPE_ZIP } = this.models.document.docTypes;
        const pdf = documents.find(document => document.type === DOC_TYPE_PDF);
        if (sourceType === "document" && !pdf) throw unresolved();
        if (sourceType === "submission" && !documents.some(document => document.type === DOC_TYPE_ZIP)) {
            throw unresolved();
        }
        // The annotator uses the PDF; ZIP input is addressed through submissionId in config.
        return { documentId: pdf?.id || null, submissionId: submission.id };
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
        const sourceCache = { assignments: new Map(), sessions: new Map() };
        for (const studySession of data.selectedAssignments) {
            const currentDocuments = [];
            let previousSubmissionId = null;
            for (const [sourceWorkflowStepId, targetWorkflowStepId] of Object.entries(data.workflowMapping)) {
                const assignmentSource = typeof targetWorkflowStepId === 'string'
                    ? /^(submission|document):assignment:([1-9]\d*)$/.exec(targetWorkflowStepId)
                    : null;
                if (assignmentSource) {
                    const source = await this.resolveAssignmentSource(
                        studySession, assignmentSource[1], Number(assignmentSource[2]), options, sourceCache
                    );
                    previousSubmissionId = source.submissionId;
                    currentDocuments.push({ ...source, workflowStepId: Number(sourceWorkflowStepId) });
                    continue;
                }
                if (targetWorkflowStepId !== 'previousSubmission' &&
                    !/^[1-9]\d*$/.test(String(targetWorkflowStepId))) {
                    throw new TranslatableError("errors.assignment.invalidWorkflowMapping");
                }
                if( targetWorkflowStepId === 'previousSubmission'){
                    // Get the original submission first
                    if(previousSubmissionId === null){
                        throw new TranslatableError("errors.assignment.firstStepNotSubmission");
                    }    
                    let originalSubmission = await this.models['submission'].findOne(
                        { where: { id: previousSubmissionId } }, 
                        { transaction: options.transaction }
                    );
                    
                    // Follow the parent chain to find the root submission
                    if (!originalSubmission) {
                        throw new TranslatableError("errors.assignment.latestSubmissionNotFound");
                    }
                    originalSubmission = await this.models['submission'].getRootSubmission(originalSubmission);
                    if (!originalSubmission) {
                        throw new TranslatableError("errors.assignment.latestSubmissionNotFound");
                    }
                    
                    // Now find the submission that has previousSubmissionId pointing to this root
                    const latestSubmission = await this.models['submission'].findOne(
                        { where: { previousSubmissionId: originalSubmission?.id } }, 
                        { transaction: options.transaction }
                    );
                    //get document based on validation file for now getting pdf
                    if(!latestSubmission){
                        throw new TranslatableError("errors.assignment.latestSubmissionNotFound");
                    }
                    const document = await this.models['document'].findOne(
                        { where: { submissionId: latestSubmission.id, type: 0} },
                        { transaction: options.transaction }
                    );
                    
                    if (!document) {
                        throw new TranslatableError("errors.assignment.latestSubmissionNotFound");
                    }
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
                if (!sourceStudyStep || !sourceStudyStep.documentId) {
                    throw new TranslatableError("errors.assignment.firstStepNotSubmission");
                }
                
                const originalDocument = await this.models['document'].getById(
                    sourceStudyStep.documentId, 
                    { transaction: options.transaction }
                );
                if (!originalDocument) {
                    throw new TranslatableError("errors.assignment.firstStepNotSubmission");
                }
                
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
        this.createSocket("assignmentBulkResolveSelection", this.resolveBulkSelectionForClient, {}, false);
        this.createSocket("assignmentAdd", this.addReviewerRequest, {}, true);
        this.createSocket("assignmentGetInfo", this.getAssignmentInfoFromCourse, {}, false);
    }
};

module.exports = AssignmentSocket;
module.exports.createReviewAssignments = createReviewAssignments;
module.exports.planByRole = planByRole;
module.exports.planByReviewer = planByReviewer;
module.exports.ASSIGNMENT_TYPES = ASSIGNMENT_TYPES;
module.exports.ASSIGNMENT_MODES = ASSIGNMENT_MODES;
module.exports.ASSIGNMENT_WRITABLE_FIELDS = ASSIGNMENT_WRITABLE_FIELDS;
module.exports.listAssignments = listAssignments;
module.exports.getAssignment = getAssignment;
module.exports.canSeeAssignment = canSeeAssignment;
module.exports.addAssignment = addAssignment;
module.exports.updateAssignment = updateAssignment;
module.exports.closeAssignment = closeAssignment;
module.exports.deleteAssignment = deleteAssignment;
