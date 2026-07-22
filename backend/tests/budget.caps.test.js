/**
 * Gating tests for AI budget caps (webserver/services/ai/budget.beginRequest).
 *
 * These seed ai_log rows with hand-chosen costs directly in the DB, then call the
 * real beginRequest and assert allowed / denied. No LLM is involved, so the numbers
 * are deterministic. Each cap kind gets an "under the limit" (allowed) and an
 * "at the limit" (denied) case, plus attribution traps proving a cap does not count
 * spend it should ignore.
 *
 * @author Mohammed Rawhani
 */

// uuid v14 is ESM-only and Jest's module loader can't parse it. Sequelize only
// calls uuid.v1 / uuid.v4 to generate default ids, so stub them with Node's
// built-in crypto for this test run. Contained entirely in this file.
jest.mock("uuid", () => {
    const { randomUUID } = require("crypto");
    return { v1: randomUUID, v4: randomUUID };
});

const db = require("../db");
const budget = require("../webserver/services/ai/budget");

// budget.js reaches the DB through service.server.db and logs through service.logger.
const service = {
    server: { db },
    logger: { info() {}, warn() {}, error() {} },
};

let owner;  // owns the models/hooks/studies under test
let other;  // a second real user, for user/owner attribution traps

let seq = 0;
const uniq = (prefix) => `${prefix}-${seq++}`;

// --- seed helpers -----------------------------------------------------------

function makeModel({ userId, freeModel = false, enabled = true }) {
    return db.models.ai_model.create({
        userId, name: uniq("model"), model: "test-model",
        enabled, freeModel, deleted: false,
    });
}

async function makeHook({ userId, enabled = true }) {
    const template = await db.models.template.create({
        name: uniq("tpl"), description: "cap-test", userId, public: false, type: 0,
    });
    return db.models.ai_hook.create({
        userId, name: uniq("hook"), templateId: template.id,
        outputMode: 0, enabled, deleted: false,
    });
}

// hooks:false — study/study_session afterCreate hooks build steps and expect a
// full request context we don't have; the tests only need the bare rows.
function makeStudy(userId) {
    return db.models.study.create({
        userId, name: uniq("study"), hash: uniq("study-hash"), deleted: false,
    }, { hooks: false });
}

function makeSession({ studyId, userId }) {
    return db.models.study_session.create({
        studyId, userId, hash: uniq("session-hash"), public: false, deleted: false,
    }, { hooks: false });
}

function seedLog({ userId, aiModelId = null, aiHookId = null, studySessionId = null, costs, status = "completed" }) {
    return db.models.ai_log.create({
        userId, aiModelId, aiHookId, studySessionId,
        costs, status, requestId: uniq("req"), deleted: false,
    });
}

function seedCap(fields) {
    return db.models.ai_budget.create({ deleted: false, limitType: 0, ...fields });
}

function begin(request) {
    return budget.beginRequest(service, { requestId: uniq("begin"), ...request });
}

// A share must be non-deleted and not yet expired for the budget code to find it.
const TOMORROW = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

function shareModelWith({ aiModelId, userId }) {
    return db.models.ai_model_share.create({
        aiModelId, userId, expiryDate: TOMORROW(), deleted: false,
    });
}

function shareHookWith({ aiHookId, userId }) {
    return db.models.ai_hook_share.create({
        aiHookId, userId, expiryDate: TOMORROW(), deleted: false,
    });
}

// A study_step needs a workflow_step, which needs a workflow. hooks:false skips
// the afterCreate business logic on workflow/study_step; we only need the rows.
async function makeStep(study) {
    const workflow = await db.models.workflow.create(
        { name: uniq("wf"), deleted: false }, { hooks: false });
    const wfStep = await db.models.workflow_step.create(
        { workflowId: workflow.id, stepType: 0, allowBackward: false, deleted: false });
    return db.models.study_step.create(
        { studyId: study.id, workflowStepId: wfStep.id, stepType: 0, allowBackward: false, deleted: false },
        { hooks: false });
}

// --- lifecycle --------------------------------------------------------------

beforeAll(async () => {
    // Any two distinct real users work; the migration always seeds at least two.
    const users = await db.models.user.findAll({ order: [["id", "ASC"]], limit: 2 });
    expect(users.length).toBeGreaterThanOrEqual(2);
    [owner, other] = users;
});

// Wipe every table these tests touch, child-before-parent to respect FKs.
// ai_budget goes early because it points at almost everything below it.
afterEach(async () => {
    const tables = [
        "ai_log", "ai_budget", "ai_model_share", "ai_hook_share",
        "study_step", "study_session", "study",
        "workflow_step", "workflow", "ai_hook", "ai_model", "template",
    ];
    for (const m of tables) {
        await db.models[m].destroy({ where: {}, force: true });
    }
});

afterAll(async () => {
    await db.sequelize.close();
});

// ---------------------------------------------------------------------------
// Model total cap
// ---------------------------------------------------------------------------
describe("model total cap", () => {
    test("allowed when spend is under the limit", async () => {
        const model = await makeModel({ userId: owner.id });
        await seedCap({ userId: owner.id, modelId: model.id, costLimit: 10 });
        await seedLog({ userId: owner.id, aiModelId: model.id, costs: 9.99 });

        const res = await begin({ userId: owner.id, aiModelId: model.id });
        expect(res.allowed).toBe(true);
    });

    test("denied when spend is exactly at the limit", async () => {
        const model = await makeModel({ userId: owner.id });
        await seedCap({ userId: owner.id, modelId: model.id, costLimit: 10 });
        await seedLog({ userId: owner.id, aiModelId: model.id, costs: 10 });

        const res = await begin({ userId: owner.id, aiModelId: model.id });
        expect(res.allowed).toBe(false);
    });

    test("trap: spend on a different model does not count", async () => {
        const model = await makeModel({ userId: owner.id });
        const otherModel = await makeModel({ userId: owner.id });
        await seedCap({ userId: owner.id, modelId: model.id, costLimit: 10 });
        await seedLog({ userId: owner.id, aiModelId: otherModel.id, costs: 100 });

        const res = await begin({ userId: owner.id, aiModelId: model.id });
        expect(res.allowed).toBe(true);
    });

    test("trap: failed requests do not count, completed ones do", async () => {
        const model = await makeModel({ userId: owner.id });
        await seedCap({ userId: owner.id, modelId: model.id, costLimit: 10 });
        // 100 of spend, but only on failed rows -> ignored by the sum.
        await seedLog({ userId: owner.id, aiModelId: model.id, costs: 100, status: "failed" });

        const res = await begin({ userId: owner.id, aiModelId: model.id });
        expect(res.allowed).toBe(true);
    });

    test("free model bypasses the cap even when over the limit", async () => {
        const model = await makeModel({ userId: owner.id, freeModel: true });
        await seedCap({ userId: owner.id, modelId: model.id, costLimit: 10 });
        await seedLog({ userId: owner.id, aiModelId: model.id, costs: 999 });

        const res = await begin({ userId: owner.id, aiModelId: model.id });
        expect(res.allowed).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Study caps (TOTAL / PER_SESSION / PER_USER)
// ---------------------------------------------------------------------------
describe("study caps", () => {
    // Inside a study, access rides on the study owner; the participant may differ.
    async function studySetup() {
        const model = await makeModel({ userId: owner.id });
        const study = await makeStudy(owner.id);
        return { model, study };
    }

    test("TOTAL: denied at the limit, counting all users in the study", async () => {
        const { model, study } = await studySetup();
        const session = await makeSession({ studyId: study.id, userId: other.id });
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 0, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, studySessionId: session.id, costs: 10 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: session.id,
        });
        expect(res.allowed).toBe(false);
    });

    test("TOTAL trap: spend in a different study does not count", async () => {
        const { model, study } = await studySetup();
        const otherStudy = await makeStudy(owner.id);
        const otherSession = await makeSession({ studyId: otherStudy.id, userId: other.id });
        const session = await makeSession({ studyId: study.id, userId: other.id });
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 0, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, studySessionId: otherSession.id, costs: 100 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: session.id,
        });
        expect(res.allowed).toBe(true);
    });

    test("PER_SESSION: this session's spend blocks; another session's does not", async () => {
        const { model, study } = await studySetup();
        const sessionA = await makeSession({ studyId: study.id, userId: other.id });
        const sessionB = await makeSession({ studyId: study.id, userId: other.id });
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 1, costLimit: 10 });
        // All spend is in session B; a request in session A must still be allowed.
        await seedLog({ userId: other.id, aiModelId: model.id, studySessionId: sessionB.id, costs: 100 });

        const allowedInA = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: sessionA.id,
        });
        expect(allowedInA.allowed).toBe(true);
    });

    test("PER_SESSION: denied at the limit within the same session", async () => {
        const { model, study } = await studySetup();
        const session = await makeSession({ studyId: study.id, userId: other.id });
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 1, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, studySessionId: session.id, costs: 10 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: session.id,
        });
        expect(res.allowed).toBe(false);
    });

    test("PER_USER: this user's spend blocks; another user's does not", async () => {
        const { model, study } = await studySetup();
        const guestSession = await makeSession({ studyId: study.id, userId: other.id });
        const ownerSession = await makeSession({ studyId: study.id, userId: owner.id });
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 2, costLimit: 10 });
        // Only the owner has spent; the guest's per-user total is still 0.
        await seedLog({ userId: owner.id, aiModelId: model.id, studySessionId: ownerSession.id, costs: 100 });

        const guestAllowed = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: guestSession.id,
        });
        expect(guestAllowed.allowed).toBe(true);
    });

    test("PER_USER: denied at the limit for the same user", async () => {
        const { model, study } = await studySetup();
        const session = await makeSession({ studyId: study.id, userId: other.id });
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 2, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, studySessionId: session.id, costs: 10 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: session.id,
        });
        expect(res.allowed).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Hook access gate (independent of model access)
// ---------------------------------------------------------------------------
describe("hook access gate", () => {
    test("allowed when the requester owns the hook", async () => {
        const model = await makeModel({ userId: owner.id });
        const hook = await makeHook({ userId: owner.id });

        const res = await begin({ userId: owner.id, aiModelId: model.id, aiHookId: hook.id });
        expect(res.allowed).toBe(true);
    });

    test("denied when the requester has model access but not hook access", async () => {
        // owner owns the model (so the model check passes) but the hook belongs to
        // 'other' and was never shared with owner -> the hook gate must deny.
        const model = await makeModel({ userId: owner.id });
        const foreignHook = await makeHook({ userId: other.id });

        const res = await begin({ userId: owner.id, aiModelId: model.id, aiHookId: foreignHook.id });
        expect(res.allowed).toBe(false);
        expect(res.reason).toMatch(/access to this AI hook/i);
    });
});

// ---------------------------------------------------------------------------
// Hook total cap — counts hook usage across ALL users and ALL models
// ---------------------------------------------------------------------------
describe("hook total cap", () => {
    test("counts spend from every user (all students), not just the requester", async () => {
        const model = await makeModel({ userId: owner.id });
        const hook = await makeHook({ userId: owner.id });
        await seedCap({ userId: owner.id, hookId: hook.id, costLimit: 10 });
        // owner and other each spent 5 on the hook -> 10 total, hitting the cap.
        await seedLog({ userId: owner.id, aiModelId: model.id, aiHookId: hook.id, costs: 5 });
        await seedLog({ userId: other.id, aiModelId: model.id, aiHookId: hook.id, costs: 5 });

        const res = await begin({ userId: owner.id, aiModelId: model.id, aiHookId: hook.id });
        expect(res.allowed).toBe(false);
    });

    test("counts the hook's spend regardless of which model ran it", async () => {
        const modelA = await makeModel({ userId: owner.id });
        const modelB = await makeModel({ userId: owner.id });
        const hook = await makeHook({ userId: owner.id });
        await seedCap({ userId: owner.id, hookId: hook.id, costLimit: 10 });
        // Same hook, two different models; the hook cap must sum both.
        await seedLog({ userId: owner.id, aiModelId: modelA.id, aiHookId: hook.id, costs: 6 });
        await seedLog({ userId: owner.id, aiModelId: modelB.id, aiHookId: hook.id, costs: 4 });

        const res = await begin({ userId: owner.id, aiModelId: modelA.id, aiHookId: hook.id });
        expect(res.allowed).toBe(false);
    });

    test("trap: spend on a different hook does not count", async () => {
        const model = await makeModel({ userId: owner.id });
        const hook = await makeHook({ userId: owner.id });
        const otherHook = await makeHook({ userId: owner.id });
        await seedCap({ userId: owner.id, hookId: hook.id, costLimit: 10 });
        await seedLog({ userId: owner.id, aiModelId: model.id, aiHookId: otherHook.id, costs: 100 });

        const res = await begin({ userId: owner.id, aiModelId: model.id, aiHookId: hook.id });
        expect(res.allowed).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Model-share cap — attributed to the grantee (their own + their studies' use)
// ---------------------------------------------------------------------------
describe("model-share cap", () => {
    test("denied at the limit, counting the grantee's own spend", async () => {
        const model = await makeModel({ userId: owner.id });
        const share = await shareModelWith({ aiModelId: model.id, userId: other.id });
        await seedCap({ userId: owner.id, shareId: share.id, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, costs: 10 });

        const res = await begin({ userId: other.id, aiModelId: model.id });
        expect(res.allowed).toBe(false);
    });

    test("trap: the model owner's own spend is not charged to the grantee's cap", async () => {
        const model = await makeModel({ userId: owner.id });
        const share = await shareModelWith({ aiModelId: model.id, userId: other.id });
        await seedCap({ userId: owner.id, shareId: share.id, costLimit: 10 });
        // Owner spent heavily outside any of the grantee's studies -> must not count.
        await seedLog({ userId: owner.id, aiModelId: model.id, costs: 100 });

        const res = await begin({ userId: other.id, aiModelId: model.id });
        expect(res.allowed).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Hook-share cap — same grantee attribution, for a shared hook
// ---------------------------------------------------------------------------
describe("hook-share cap", () => {
    // Grantee needs both model access and hook access to reach the cap check.
    async function shareSetup() {
        const model = await makeModel({ userId: owner.id });
        const hook = await makeHook({ userId: owner.id });
        await shareModelWith({ aiModelId: model.id, userId: other.id });
        const hookShare = await shareHookWith({ aiHookId: hook.id, userId: other.id });
        return { model, hook, hookShare };
    }

    test("denied at the limit, counting the grantee's own hook spend", async () => {
        const { model, hook, hookShare } = await shareSetup();
        await seedCap({ userId: owner.id, hookShareId: hookShare.id, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, aiHookId: hook.id, costs: 10 });

        const res = await begin({ userId: other.id, aiModelId: model.id, aiHookId: hook.id });
        expect(res.allowed).toBe(false);
    });

    test("allowed when under the limit", async () => {
        const { model, hook, hookShare } = await shareSetup();
        await seedCap({ userId: owner.id, hookShareId: hookShare.id, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, aiHookId: hook.id, costs: 9.99 });

        const res = await begin({ userId: other.id, aiModelId: model.id, aiHookId: hook.id });
        expect(res.allowed).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Step-hook caps — a hook capped at one study step (study "steps service" limit)
// ---------------------------------------------------------------------------
describe("step-hook caps", () => {
    async function stepSetup() {
        const model = await makeModel({ userId: owner.id });
        const hook = await makeHook({ userId: owner.id });
        const study = await makeStudy(owner.id);
        const step = await makeStep(study);
        return { model, hook, study, step };
    }

    test("TOTAL: denied at the limit, counting the hook's use across the study", async () => {
        const { model, hook, study, step } = await stepSetup();
        const session = await makeSession({ studyId: study.id, userId: other.id });
        await seedCap({ userId: owner.id, studyStepId: step.id, hookId: hook.id, limitType: 0, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, aiHookId: hook.id, studySessionId: session.id, costs: 10 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, aiHookId: hook.id,
            studyId: study.id, studySessionId: session.id, studyStepId: step.id,
        });
        expect(res.allowed).toBe(false);
    });

    test("TOTAL trap: same hook used outside this study does not count", async () => {
        const { model, hook, study, step } = await stepSetup();
        const session = await makeSession({ studyId: study.id, userId: other.id });
        const otherStudy = await makeStudy(owner.id);
        const otherSession = await makeSession({ studyId: otherStudy.id, userId: other.id });
        await seedCap({ userId: owner.id, studyStepId: step.id, hookId: hook.id, limitType: 0, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, aiHookId: hook.id, studySessionId: otherSession.id, costs: 100 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, aiHookId: hook.id,
            studyId: study.id, studySessionId: session.id, studyStepId: step.id,
        });
        expect(res.allowed).toBe(true);
    });

    test("PER_SESSION: another session's spend does not block this one", async () => {
        const { model, hook, study, step } = await stepSetup();
        const sessionA = await makeSession({ studyId: study.id, userId: other.id });
        const sessionB = await makeSession({ studyId: study.id, userId: other.id });
        await seedCap({ userId: owner.id, studyStepId: step.id, hookId: hook.id, limitType: 1, costLimit: 10 });
        await seedLog({ userId: other.id, aiModelId: model.id, aiHookId: hook.id, studySessionId: sessionB.id, costs: 100 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, aiHookId: hook.id,
            studyId: study.id, studySessionId: sessionA.id, studyStepId: step.id,
        });
        expect(res.allowed).toBe(true);
    });

    test("PER_USER: another user's spend does not block this one", async () => {
        const { model, hook, study, step } = await stepSetup();
        const guestSession = await makeSession({ studyId: study.id, userId: other.id });
        const ownerSession = await makeSession({ studyId: study.id, userId: owner.id });
        await seedCap({ userId: owner.id, studyStepId: step.id, hookId: hook.id, limitType: 2, costLimit: 10 });
        await seedLog({ userId: owner.id, aiModelId: model.id, aiHookId: hook.id, studySessionId: ownerSession.id, costs: 100 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, aiHookId: hook.id,
            studyId: study.id, studySessionId: guestSession.id, studyStepId: step.id,
        });
        expect(res.allowed).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Multiple study caps at once (TOTAL + PER_SESSION + PER_USER on one study)
// beginRequest checks every applicable cap and denies on the first one that is full.
// ---------------------------------------------------------------------------
describe("combined study caps", () => {
    async function studyWithThreeCaps({ total, perSession, perUser }) {
        const model = await makeModel({ userId: owner.id });
        const study = await makeStudy(owner.id);
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 0, costLimit: total });
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 1, costLimit: perSession });
        await seedCap({ userId: owner.id, studyId: study.id, limitType: 2, costLimit: perUser });
        return { model, study };
    }

    test("allowed when spend is under all three caps", async () => {
        const { model, study } = await studyWithThreeCaps({ total: 100, perSession: 100, perUser: 100 });
        const session = await makeSession({ studyId: study.id, userId: other.id });
        await seedLog({ userId: other.id, aiModelId: model.id, studySessionId: session.id, costs: 5 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: session.id,
        });
        expect(res.allowed).toBe(true);
    });

    test("the tightest cap wins: full PER_SESSION blocks even when TOTAL and PER_USER are fine", async () => {
        const { model, study } = await studyWithThreeCaps({ total: 100, perSession: 10, perUser: 100 });
        const session = await makeSession({ studyId: study.id, userId: other.id });
        await seedLog({ userId: other.id, aiModelId: model.id, studySessionId: session.id, costs: 10 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: session.id,
        });
        expect(res.allowed).toBe(false);
    });

    test("TOTAL fires across users even when each user's PER_USER share is fine", async () => {
        const { model, study } = await studyWithThreeCaps({ total: 10, perSession: 100, perUser: 100 });
        const sessionOther = await makeSession({ studyId: study.id, userId: other.id });
        const sessionOwner = await makeSession({ studyId: study.id, userId: owner.id });
        // Two users, 5 each: neither hits PER_USER (100), but together they hit TOTAL (10).
        await seedLog({ userId: other.id, aiModelId: model.id, studySessionId: sessionOther.id, costs: 5 });
        await seedLog({ userId: owner.id, aiModelId: model.id, studySessionId: sessionOwner.id, costs: 5 });

        const res = await begin({
            userId: other.id, aiModelId: model.id, studyId: study.id, studySessionId: sessionOther.id,
        });
        expect(res.allowed).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// resetAt window — spend before the reset timestamp is ignored
// ---------------------------------------------------------------------------
describe("resetAt window", () => {
    const YESTERDAY = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

    test("spend older than resetAt is ignored (cap counts only after the reset)", async () => {
        const model = await makeModel({ userId: owner.id });
        // resetAt is in the future, so a log created now is 'before' it -> excluded.
        await seedCap({ userId: owner.id, modelId: model.id, costLimit: 10, resetAt: TOMORROW() });
        await seedLog({ userId: owner.id, aiModelId: model.id, costs: 100 });

        const res = await begin({ userId: owner.id, aiModelId: model.id });
        expect(res.allowed).toBe(true);
    });

    test("spend after resetAt still counts", async () => {
        const model = await makeModel({ userId: owner.id });
        await seedCap({ userId: owner.id, modelId: model.id, costLimit: 10, resetAt: YESTERDAY() });
        await seedLog({ userId: owner.id, aiModelId: model.id, costs: 10 });

        const res = await begin({ userId: owner.id, aiModelId: model.id });
        expect(res.allowed).toBe(false);
    });
});
