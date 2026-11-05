const {randomUUID} = require("crypto");
const Server = require("../webserver/Server.js");
const Socket = require("../webserver/Socket.js");
const DocumentSocket = require("../webserver/sockets/document.js");
const {dbToDelta, deltaToPlainText} = require("editor-delta-conversion");
const {getSocketClient} = require("./utils.js");

const deferred = () => {
    const d = {};
    d.promise = new Promise((resolve, reject) => {
        d.resolve = resolve;
        d.reject = reject;
    });
    return d;
};

// Lets every already runnable promise chain finish. No timers: what is gated stays gated.
const flush = async () => {
    for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setImmediate(resolve));
    }
};

const insert = (text, offset) => ({operationType: 0, offset, span: 0, text});

const plainText = (rows) => deltaToPlainText(dbToDelta(rows));

/**
 * Runs the actual DocumentSocket.init(), createSocket and editDocument with the database replaced by a controllable
 * in-memory one, so that every interleaving is forced by gates instead of by timing.
 */
function createBackend() {
    const backend = {
        trace: [],
        lastRowId: 0,
        committed: [],
        transactions: 0,
        maxCalls: [],
        afterCommitRuns: [],
        documentQueues: new Map(),
        documentTimestamps: new Map(),
        gates: {}, // e.g. "acquire:1" or "commit:1" -> promise the step waits for
        failures: {}, // e.g. "persist:1" -> error the step fails with
    };

    const step = async (name) => {
        backend.trace.push(name);
        if (backend.gates[name]) {
            await backend.gates[name].promise;
        }
        if (backend.failures[name]) {
            throw backend.failures[name];
        }
    };

    backend.db = {
        sequelize: {
            async transaction() {
                const id = ++backend.transactions;
                await step(`acquire:${id}`);
                const hooks = [];
                return {
                    id,
                    staged: [],
                    finished: undefined,
                    afterCommit: (fn) => hooks.push(fn),
                    // As in Sequelize 6.37.8: the hooks run in a finally, so also if the COMMIT failed, and a finished
                    // transaction cannot be rolled back anymore
                    async commit() {
                        try {
                            await step(`commit:${id}`);
                            backend.committed.push(...this.staged);
                            backend.trace.push(`committed:${id}`);
                        } finally {
                            this.finished = "commit";
                            backend.afterCommitRuns.push(id);
                            for (const hook of hooks) {
                                await hook(this);
                            }
                        }
                    },
                    async rollback() {
                        if (this.finished) {
                            throw new Error(`Transaction cannot be rolled back, it has been finished with state: ${this.finished}`);
                        }
                        backend.trace.push(`rollback:${id}`);
                    },
                };
            },
        },
    };

    backend.models = {
        document_edit: {
            // As in Sequelize: a Date, or null without any matching row. Rows of open transactions are not visible.
            async max(field, {where, transaction}) {
                expect(field).toBe("createdAt");
                expect(transaction).toBeDefined();
                backend.maxCalls.push(where);
                await step(`max:${transaction.id}`);
                const times = backend.persistedFor(where).map((row) => new Date(row.createdAt).getTime());
                return times.length ? new Date(Math.max(...times)) : null;
            },
            async bulkCreate(edits, {transaction}) {
                backend.trace.push(`read:${plainText([...backend.seed(edits[0]), ...backend.committedFor(edits[0])])}`);
                await step(`persist:${transaction.id}`);
                // Sequelize only sets createdAt for rows without one, and to the same time for the whole message.
                // Here, all messages get the same millisecond unless they bring their own time.
                const rows = edits.map((edit, idx) => ({
                    ...edit,
                    id: ++backend.lastRowId,
                    order: edit.order || idx + 1,
                    createdAt: edit.createdAt || new Date(1000),
                }));
                transaction.staged.push(...rows);
                return rows.map((row) => ({get: () => ({...row})}));
            },
        },
    };

    const sameContext = (a, b) => a.documentId === b.documentId
        && a.studySessionId === b.studySessionId
        && a.studyStepId === b.studyStepId;
    backend.seed = (ctx) => [{...ctx, operationType: 0, offset: 0, span: 0, text: "ab", createdAt: new Date(0), order: 1}];
    backend.committedFor = (ctx) => backend.committed.filter((row) => sameContext(row, ctx));
    backend.persistedFor = (ctx) => [...backend.seed(ctx), ...backend.committedFor(ctx)];
    /** What a restart of the process loses, unlike the persisted rows. */
    backend.restart = () => {
        backend.documentQueues.clear();
        backend.documentTimestamps.clear();
    };
    backend.timesOf = (ctx) => backend.committedFor({studySessionId: null, studyStepId: null, ...ctx})
        .map((row) => row.createdAt.getTime());
    backend.text = (documentId, studySessionId = null, studyStepId = null) => {
        const ctx = {documentId, studySessionId, studyStepId};
        return plainText([...backend.seed(ctx), ...backend.committedFor(ctx)]);
    };

    backend.gate = (name) => {
        backend.gates[name] = deferred();
        return backend.gates[name];
    };

    /** A new connection: its own DocumentSocket instance on the same server. */
    backend.connect = (socketId = "socket-1") => {
        const handlers = {};
        const documentSocket = Object.create(DocumentSocket.prototype);
        documentSocket.userId = 1;
        documentSocket.logger = {debug() {}, info() {}, warn() {}, error: jest.fn()};
        documentSocket.transactionMonitor = {start() {}, finish() {}};
        documentSocket.socket = {id: socketId, on: (name, fn) => (handlers[name] = fn)};
        documentSocket.broadcastTransactionChanges = () => {};
        documentSocket.emitDoc = async (documentId, event, data) => {
            const name = `broadcast:${data[0].text}`;
            backend.trace.push(name);
            if (backend.gates[name]) {
                await backend.gates[name].promise;
            }
            if (backend.failures[name]) {
                throw backend.failures[name];
            }
            backend.trace.push(`${name}:sent`);
        };
        documentSocket.models = backend.models;
        documentSocket.server = {
            db: backend.db,
            documentQueues: backend.documentQueues,
            documentTimestamps: backend.documentTimestamps,
        };
        documentSocket.init();

        return {
            documentSocket,
            handlers,
            /** Delivers an event synchronously, as socket.io does on reception. */
            edit(payload) {
                const ack = deferred();
                const done = handlers.documentEdit(payload, ack.resolve);
                return {ack: ack.promise, done};
            },
        };
    };

    return backend;
}

const editOf = (text, offset, ctx = {}) => ({
    documentId: 1,
    studySessionId: null,
    studyStepId: null,
    ...ctx,
    ops: [insert(text, offset)],
});

describe("documentEdit ordering (controlled transactions)", () => {
    let consoleLog;

    beforeEach(() => {
        // createSocket logs every handler error
        consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLog.mockRestore();
    });

    test("keeps reception order when the first transaction is acquired last", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const firstAcquire = backend.gate("acquire:1");

        const x = client.edit(editOf("X", 1));
        const y = client.edit(editOf("Y", 2));
        await flush();
        firstAcquire.resolve();
        await Promise.all([x.done, y.done]);

        expect(await x.ack).toEqual({success: true, data: undefined});
        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(backend.text(1)).toBe("aXYb");
    });

    test("does not open the next transaction before the previous one is committed", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const firstAcquire = backend.gate("acquire:1");
        const firstCommit = backend.gate("commit:1");

        const x = client.edit(editOf("X", 1));
        const y = client.edit(editOf("Y", 2));
        await flush();
        expect(backend.transactions).toBe(1);

        firstAcquire.resolve();
        await flush();
        // X is persisted and committing: Y must still not have started
        expect(backend.transactions).toBe(1);
        expect(backend.committed).toEqual([]);

        firstCommit.resolve();
        await Promise.all([x.done, y.done]);

        expect(backend.trace).toEqual([
            "acquire:1", "max:1", "read:ab", "persist:1", "commit:1", "committed:1", "broadcast:X", "broadcast:X:sent",
            "acquire:2", "read:aXb", "persist:2", "commit:2", "committed:2", "broadcast:Y", "broadcast:Y:sent",
        ]);
    });

    test("acknowledges only after the commit and in reception order", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const firstCommit = backend.gate("commit:1");
        const acks = [];

        const x = client.edit(editOf("X", 1));
        const y = client.edit(editOf("Y", 2));
        x.ack.then(() => acks.push("X"));
        y.ack.then(() => acks.push("Y"));
        await flush();
        expect(acks).toEqual([]);

        firstCommit.resolve();
        await Promise.all([x.done, y.done]);
        await flush();
        expect(acks).toEqual(["X", "Y"]);
    });

    test.each([
        ["transaction acquisition", "acquire:1", false],
        ["persistence", "persist:1", true],
        // Sequelize does not allow a rollback after a failed commit, it destroys the connection instead
        ["commit", "commit:1", false],
    ])("a failing %s of the head does not block the next edit", async (_, failingStep, rollsBack) => {
        const backend = createBackend();
        const client = backend.connect();
        backend.failures[failingStep] = new Error("simulated database failure");

        const x = client.edit(editOf("X", 1));
        const y = client.edit(editOf("Y", 1));
        const z = client.edit(editOf("Z", 2));
        await Promise.all([x.done, y.done, z.done]);

        expect(await x.ack).toMatchObject({success: false, key: "errors.server.unexpectedError"});
        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(await z.ack).toEqual({success: true, data: undefined});
        expect(backend.text(1)).toBe("aYZb");
        expect(backend.trace.includes("rollback:1")).toBe(rollsBack);
        expect(backend.trace).not.toContain("broadcast:X");
    });

    test("a failed COMMIT does not broadcast, although Sequelize runs its afterCommit hooks", async () => {
        const backend = createBackend();
        const client = backend.connect();
        backend.failures["commit:1"] = new Error("simulated commit failure");

        const x = client.edit(editOf("X", 1));
        const y = client.edit(editOf("Y", 1));
        await Promise.all([x.done, y.done]);

        expect(backend.afterCommitRuns).toEqual([1, 2]);
        expect(await x.ack).toMatchObject({success: false, key: "errors.server.unexpectedError"});
        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(backend.trace.filter((entry) => entry.startsWith("broadcast:"))).toEqual(["broadcast:Y", "broadcast:Y:sent"]);
        expect(backend.text(1)).toBe("aYb");
    });

    test.each([
        ["an object with a broken toString as document", {documentId: {toString: 1}}],
        ["an object with a broken toString as study session", {studySessionId: {toString: 1}}],
        ["an object with a broken toString as study step", {studyStepId: {toString: 1}}],
        ["an object without any conversion", {documentId: {toString: null, valueOf: null}}],
        ["a plain object", {documentId: {}}],
        ["a plain object as study session", {studySessionId: {a: 1}}],
        ["an array", {documentId: [{toString: 1}]}],
    ])("%s neither throws on reception nor reaches a query, and the next edit succeeds", async (_, context) => {
        const backend = createBackend();
        const client = backend.connect();
        const ack = deferred();

        let done;
        expect(() => {
            done = client.handlers.documentEdit({...editOf("X", 1), ops: [], ...context}, ack.resolve);
        }).not.toThrow();
        const next = client.edit(editOf("Y", 1));
        await Promise.all([done, next.done]);

        expect(await ack.promise).toMatchObject({success: false, key: "errors.server.unexpectedError"});
        expect(await next.ack).toEqual({success: true, data: undefined});
        expect(backend.maxCalls).toEqual([{documentId: 1, studySessionId: null, studyStepId: null}]);
        expect(backend.trace).toContain("rollback:1");
        expect(backend.text(1)).toBe("aYb");
    });

    test("createSocket reports any throwing queue key on the event, outside of the queues", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const handler = jest.fn(async () => {
            throw new Error("rejected by the handler");
        });
        Socket.prototype.createSocket.call(client.documentSocket, "keyedEvent", handler, {}, true, () => {
            throw new Error("no key");
        });

        const ack = deferred();
        let done;
        expect(() => {
            done = client.handlers.keyedEvent({}, ack.resolve);
        }).not.toThrow();
        await done;

        expect(handler).toHaveBeenCalledTimes(1);
        expect(await ack.promise).toMatchObject({success: false});
        expect(backend.documentQueues.size).toBe(0);
    });

    test("malformed data is reported on the event and does not block the next edit", async () => {
        const backend = createBackend();
        const client = backend.connect();

        const ack = deferred();
        const malformed = client.handlers.documentEdit(null, ack.resolve);
        const x = client.edit(editOf("X", 1));
        await Promise.all([malformed, x.done]);

        expect(await ack.promise).toMatchObject({success: false});
        expect(await x.ack).toEqual({success: true, data: undefined});
        expect(backend.trace).toContain("rollback:1");
        expect(backend.text(1)).toBe("aXb");
    });

    test("other spellings of a document context share its queue and are saved under its ids", async () => {
        const backend = createBackend();
        const held = backend.gate("acquire:1");
        const client = backend.connect();

        const x = client.edit(editOf("X", 1, {documentId: 1, studySessionId: 7, studyStepId: 9}));
        const y = client.edit(editOf("Y", 2, {documentId: "01", studySessionId: "07", studyStepId: "009"}));
        await flush();
        expect(backend.transactions).toBe(1);
        held.resolve();
        await Promise.all([x.done, y.done]);

        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(backend.text(1, 7, 9)).toBe("aXYb");
    });

    test.each([
        ["padded document", {documentId: "1 "}],
        ["padded study session", {studySessionId: " 7"}],
        ["boolean document", {documentId: true}],
        ["zero document", {documentId: 0}],
        ["negative document", {documentId: -1}],
        ["fractional study step", {studyStepId: 1.5}],
        ["exponent study session", {studySessionId: "1e3"}],
        ["hexadecimal study step", {studyStepId: "0x10"}],
        ["boolean study session", {studySessionId: true}],
    ])("a %s id is rejected without opening a queue for it", async (_, context) => {
        const backend = createBackend();
        const client = backend.connect();

        const malformed = client.edit(editOf("!", 1, context));
        await malformed.done;

        expect(await malformed.ack).toMatchObject({success: false});
        expect(backend.documentQueues.size).toBe(0);
        expect(backend.committed).toEqual([]);
    });

    test.each([
        ["0", {studySessionId: 0, studyStepId: 0}],
        ["an empty string", {studySessionId: "", studyStepId: ""}],
        ["undefined", {studySessionId: undefined, studyStepId: undefined}],
    ])("%s as study session and step means no session and step", async (_, context) => {
        const backend = createBackend();
        const client = backend.connect();

        const x = client.edit(editOf("X", 1, context));
        await x.done;

        expect(await x.ack).toEqual({success: true, data: undefined});
        expect(backend.text(1)).toBe("aXb");
    });

    test("only the known fields of an operation are saved", async () => {
        const backend = createBackend();
        const client = backend.connect();

        const x = client.edit({
            ...editOf("", 0),
            ops: [{
                ...insert("X", 1),
                attributes: {bold: true},
                documentId: 2,
                studySessionId: 7,
                studyStepId: 9,
                userId: 99,
                order: 99,
                draft: false,
                deleted: true,
                id: 12345,
                createdAt: new Date(0),
                updatedAt: new Date(0),
            }],
        });
        await x.done;

        expect(await x.ack).toEqual({success: true, data: undefined});
        expect(backend.committed).toHaveLength(1);
        const {id, createdAt, userId, ...row} = backend.committed[0];
        expect(id).not.toBe(12345);
        expect(createdAt.getTime()).toBeGreaterThan(0);
        expect(userId).toBe(client.documentSocket.userId);
        expect(row).toEqual({
            draft: true,
            documentId: 1,
            studySessionId: null,
            studyStepId: null,
            order: 1,
            operationType: 0,
            offset: 1,
            span: 0,
            text: "X",
            attributes: {bold: true},
        });
    });

    test.each([
        ["unknown", 7],
        ["null", null],
        ["missing", undefined],
        ["text", "0"],
    ])("an operation with an %s type fails its whole message", async (_, operationType) => {
        const backend = createBackend();
        const client = backend.connect();

        const malformed = client.edit({...editOf("", 0), ops: [insert("X", 1), {...insert("!", 1), operationType}]});
        const y = client.edit(editOf("Y", 1));
        await Promise.all([malformed.done, y.done]);

        expect(await malformed.ack).toMatchObject({success: false});
        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(backend.text(1)).toBe("aYb");
    });

    test.each([
        ["a string", "not-a-function"],
        ["a number", 42],
        ["an object", {not: "a function"}],
        ["null", null],
    ])("%s as acknowledgement neither fails the saved edit nor rejects the listener", async (_, ack) => {
        const backend = createBackend();
        const client = backend.connect();
        const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

        await expect(client.handlers.documentEdit(editOf("X", 1), ack)).resolves.toBeUndefined();
        await expect(client.handlers.documentEdit(null, ack)).resolves.toBeUndefined();
        consoleLog.mockRestore();
        const y = client.edit(editOf("Y", 2));
        await y.done;

        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(backend.trace).not.toContain("rollback:1");
        expect(backend.text(1)).toBe("aXYb");
    });

    test("a non-function acknowledgement does not reject the listener of an event without a queue", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
        const handler = jest.fn(async () => {
            throw new Error("rejected by the handler");
        });
        Socket.prototype.createSocket.call(client.documentSocket, "plainEvent", handler);

        await expect(client.handlers.plainEvent({}, "not-a-function")).resolves.toBeUndefined();
        consoleLog.mockRestore();

        expect(handler).toHaveBeenCalledTimes(1);
    });

    test.each([
        ["document", {documentId: 2}],
        ["study session", {studySessionId: 7}],
        ["study step", {studySessionId: null, studyStepId: 9}],
    ])("a held edit does not block another %s", async (_, otherContext) => {
        const backend = createBackend();
        const client = backend.connect();
        const heldAcquire = backend.gate("acquire:1");

        const held = client.edit(editOf("X", 1));
        const queued = client.edit(editOf("Y", 2));
        const other = client.edit(editOf("O", 1, otherContext));
        await other.done;

        const {documentId = 1, studySessionId = null, studyStepId = null} = otherContext;
        expect(await other.ack).toEqual({success: true, data: undefined});
        expect(backend.text(documentId, studySessionId, studyStepId)).toBe("aOb");
        expect(backend.text(1)).toBe("ab");

        heldAcquire.resolve();
        await Promise.all([held.done, queued.done]);
        expect(backend.text(1)).toBe("aXYb");
    });

    test("edits of different connections to the same document context share one queue", async () => {
        const backend = createBackend();
        const first = backend.connect("socket-1");
        const second = backend.connect("socket-2");
        const firstAcquire = backend.gate("acquire:1");

        const x = first.edit(editOf("X", 1));
        const y = second.edit(editOf("Y", 2));
        await flush();
        expect(backend.transactions).toBe(1);

        firstAcquire.resolve();
        await Promise.all([x.done, y.done]);
        expect(backend.text(1)).toBe("aXYb");
    });

    test("broadcasts stay in commit order and only happen for committed base document edits", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const firstBroadcast = backend.gate("broadcast:X");

        const x = client.edit(editOf("X", 1));
        const y = client.edit(editOf("Y", 2));
        const session = client.edit(editOf("S", 1, {studySessionId: 7}));
        await flush();
        // Y waits for the broadcast of X, the session edit is independent and saved in the database only
        expect(await session.ack).toEqual({success: true, data: undefined});
        expect(backend.trace).not.toContain("broadcast:Y");
        expect(backend.trace).not.toContain("broadcast:S");

        firstBroadcast.resolve();
        await Promise.all([x.done, y.done, session.done]);

        const broadcasts = backend.trace.filter((entry) => entry.startsWith("broadcast:"));
        expect(broadcasts).toEqual(["broadcast:X", "broadcast:X:sent", "broadcast:Y", "broadcast:Y:sent"]);
    });

    test("a failing broadcast does not fail the committed edit or block the next one", async () => {
        const backend = createBackend();
        const client = backend.connect();
        backend.failures["broadcast:X"] = new Error("simulated broadcast failure");

        const x = client.edit(editOf("X", 1));
        const y = client.edit(editOf("Y", 2));
        await Promise.all([x.done, y.done]);

        expect(await x.ack).toEqual({success: true, data: undefined});
        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(backend.trace).not.toContain("rollback:1");
        expect(backend.text(1)).toBe("aXYb");
        expect(client.documentSocket.logger.error).toHaveBeenCalledWith(expect.stringContaining("simulated broadcast failure"));
    });

    test("a failing post-commit hook does not stop the following hooks", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const later = jest.fn();
        Socket.prototype.createSocket.call(client.documentSocket, "hookedEvent", async (data, options) => {
            options.afterSuccessfulCommit(() => {
                throw new Error("simulated hook failure");
            });
            options.afterSuccessfulCommit(later);
        }, {}, true);

        const ack = deferred();
        await client.handlers.hookedEvent({}, ack.resolve);

        expect(later).toHaveBeenCalledTimes(1);
        expect(await ack.promise).toEqual({success: true, data: undefined});
    });

    test("keeps the operation order inside of a message", async () => {
        const backend = createBackend();
        const client = backend.connect();

        const message = client.edit({
            ...editOf("", 0),
            ops: [insert("X", 1), insert("Y", 2)],
        });
        await message.done;

        expect(backend.committed.map((row) => [row.text, row.order])).toEqual([["X", 1], ["Y", 2]]);
        expect(backend.text(1)).toBe("aXYb");
    });

    test("messages saved in the same millisecond do not interleave their operations", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const now = jest.spyOn(Date, "now").mockReturnValue(5000);

        const first = client.edit({...editOf("", 0), ops: [insert("A", 1), insert("B", 2)]});
        const second = client.edit({...editOf("", 0), ops: [insert("C", 3), insert("D", 4)]});
        const other = client.edit({...editOf("", 0, {documentId: 2}), ops: [insert("O", 1)]});
        await Promise.all([first.done, second.done, other.done]);
        now.mockRestore();

        expect(backend.text(1)).toBe("aABCDb");
        const times = backend.committedFor({documentId: 1, studySessionId: null, studyStepId: null})
            .map((row) => row.createdAt.getTime());
        expect(times).toEqual([5000, 5000, 5001, 5001]);
        // Other document contexts have their own time
        expect(backend.committedFor({documentId: 2, studySessionId: null, studyStepId: null})[0].createdAt.getTime()).toBe(5000);
    });

    test("the time of a document context stays increasing if the clock goes backwards", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const now = jest.spyOn(Date, "now").mockReturnValueOnce(5000).mockReturnValueOnce(3000);

        const first = client.edit(editOf("X", 1));
        const second = client.edit(editOf("Y", 2));
        await Promise.all([first.done, second.done]);
        now.mockRestore();

        expect(backend.text(1)).toBe("aXYb");
        const times = backend.committedFor({documentId: 1, studySessionId: null, studyStepId: null})
            .map((row) => row.createdAt.getTime());
        expect(times).toEqual([5000, 5001]);
    });

    test("a persisted edit ahead of the clock sorts first after a restart", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const now = jest.spyOn(Date, "now").mockReturnValue(100000);

        // The clock was ahead when X was saved, and was set back during the restart
        const x = client.edit(editOf("X", 1));
        await x.done;
        backend.restart();
        now.mockReturnValue(40000);
        const y = client.edit(editOf("Y", 2));
        await y.done;
        now.mockRestore();

        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(backend.timesOf({documentId: 1})).toEqual([100000, 100001]);
        expect(backend.text(1)).toBe("aXYb");
    });

    test("the persisted time is read once per context and never for later messages", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const now = jest.spyOn(Date, "now").mockReturnValue(5000);
        const other = {documentId: 1, studySessionId: 7, studyStepId: null};

        // The base document has an edit ahead of the clock. That must not influence the other context.
        backend.committed.push({
            documentId: 1, studySessionId: null, studyStepId: null,
            operationType: 0, offset: 1, span: 0, text: "F", order: 1, createdAt: new Date(90000),
        });
        await Promise.all([
            client.edit(editOf("G", 2)).done,
            client.edit(editOf("H", 3)).done,
            client.edit(editOf("I", 4)).done,
            client.edit(editOf("S", 1, {studySessionId: 7})).done,
            client.edit(editOf("T", 2, {studySessionId: 7})).done,
        ]);
        now.mockRestore();

        expect(backend.maxCalls).toEqual([
            {documentId: 1, studySessionId: null, studyStepId: null},
            {documentId: 1, studySessionId: 7, studyStepId: null},
        ]);
        expect(backend.timesOf({documentId: 1})).toEqual([90000, 90001, 90002, 90003]);
        expect(backend.timesOf(other)).toEqual([5000, 5001]);
        expect(backend.text(1)).toBe("aFGHIb");
        expect(backend.text(1, 7)).toBe("aSTb");
    });

    test("a context without persisted edits uses the clock", async () => {
        const backend = createBackend();
        backend.seed = () => [];
        const client = backend.connect();
        const now = jest.spyOn(Date, "now").mockReturnValue(5000);

        await client.edit(editOf("X", 0)).done;
        await client.edit(editOf("Y", 1)).done;
        now.mockRestore();

        expect(backend.maxCalls).toHaveLength(1);
        expect(backend.timesOf({documentId: 1})).toEqual([5000, 5001]);
        expect(backend.text(1)).toBe("XY");
    });

    test("a rolled back message only leaves a harmless gap in the times", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const now = jest.spyOn(Date, "now").mockReturnValue(5000);
        backend.failures["persist:2"] = new Error("simulated database failure");

        const x = client.edit(editOf("X", 1));
        const failed = client.edit(editOf("!", 1));
        const y = client.edit(editOf("Y", 2));
        await Promise.all([x.done, failed.done, y.done]);
        now.mockRestore();

        expect(await failed.ack).toMatchObject({success: false});
        expect(backend.maxCalls).toHaveLength(1);
        expect(backend.timesOf({documentId: 1})).toEqual([5000, 5002]);
        expect(backend.text(1)).toBe("aXYb");
    });

    test("a failing read of the persisted time fails the message and is retried by the next one", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const now = jest.spyOn(Date, "now").mockReturnValue(5000);
        backend.failures["max:1"] = new Error("simulated database failure");
        backend.committed.push({
            documentId: 1, studySessionId: null, studyStepId: null,
            operationType: 0, offset: 1, span: 0, text: "F", order: 1, createdAt: new Date(90000),
        });

        const failed = client.edit(editOf("!", 1));
        const y = client.edit(editOf("Y", 2));
        await Promise.all([failed.done, y.done]);
        now.mockRestore();

        expect(await failed.ack).toMatchObject({success: false});
        expect(await y.ack).toEqual({success: true, data: undefined});
        expect(backend.trace).toContain("rollback:1");
        expect(backend.maxCalls).toHaveLength(2);
        expect(backend.timesOf({documentId: 1})).toEqual([90000, 90001]);
        expect(backend.text(1)).toBe("aFYb");
    });

    test("a held read of the persisted time holds its context only", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const held = backend.gate("max:1");

        const x = client.edit(editOf("X", 1));
        const y = client.edit(editOf("Y", 2));
        await flush();
        const other = client.edit(editOf("O", 1, {documentId: 2}));
        await other.done;

        expect(await other.ack).toEqual({success: true, data: undefined});
        expect(backend.text(1)).toBe("ab");
        expect(backend.transactions).toBe(2);

        held.resolve();
        await Promise.all([x.done, y.done]);
        expect(backend.text(1)).toBe("aXYb");
    });

    test("events without a queue key stay concurrent and do not use the document queues", async () => {
        const backend = createBackend();
        const client = backend.connect();
        const firstAcquire = backend.gate("acquire:1");
        const handler = jest.fn(async () => "result");
        Socket.prototype.createSocket.call(client.documentSocket, "unqueuedEvent", handler, {}, true);

        const first = client.handlers.unqueuedEvent({}, () => {});
        const second = client.handlers.unqueuedEvent({}, () => {});
        await flush();

        expect(backend.transactions).toBe(2);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(backend.documentQueues.size).toBe(0);

        firstAcquire.resolve();
        await Promise.all([first, second]);
        expect(handler).toHaveBeenCalledTimes(2);
    });
});

describe("documentEdit ordering (real sockets and database)", () => {
    const PORT = 3112;
    let server;
    let client;
    let serverSocket;
    let user;

    const emitEdit = (payload) => new Promise((resolve) => client.emit("documentEdit", payload, resolve));

    /** Creates a document with the persisted text "ab" */
    const createDocument = async () => {
        const document = await server.db.models["document"].create({
            name: "edit order test",
            hash: randomUUID(),
            userId: user.id,
            type: server.db.models["document"].docTypes.DOC_TYPE_HTML,
        });
        await server.db.models["document_edit"].create({
            documentId: document.id,
            userId: user.id,
            operationType: 0,
            offset: 0,
            span: 0,
            text: "ab",
            order: 1,
            createdAt: new Date(0),
        });
        return document.id;
    };

    const createStudySession = async () => {
        const [[row]] = await server.db.sequelize.query(
            `INSERT INTO study_session (hash, "createdAt", "updatedAt") VALUES (:hash, now(), now()) RETURNING id`,
            {replacements: {hash: randomUUID()}}
        );
        return row.id;
    };

    /** Text as it is reconstructed on reload, from the committed rows of the base document */
    const persistedText = async (documentId) => {
        const edits = await server.db.models["document_edit"].findAll({
            where: {documentId, studySessionId: null, draft: true},
            raw: true,
        });
        return plainText(edits);
    };

    /**
     * Gates the transactions opened by this connection only, so that the background jobs of the server stay unaffected.
     * @returns {{requested: number, firstRequest: Object, commits: Array<Object>, holds: Array<Object>, failures: Array<Error>}}
     */
    const controlTransactions = () => {
        const sequelize = server.db.sequelize;
        const control = {requested: 0, firstRequest: deferred(), commits: [], holds: [], failures: []};
        serverSocket.server = Object.create(server, {
            db: {
                value: Object.create(server.db, {
                    sequelize: {
                        value: {
                            transaction: async () => {
                                const index = control.requested++;
                                control.firstRequest.resolve();
                                const committed = deferred();
                                control.commits[index] = committed;
                                if (control.holds[index]) {
                                    await control.holds[index].promise;
                                }
                                if (control.failures[index]) {
                                    throw control.failures[index];
                                }
                                const t = await sequelize.transaction();
                                t.afterCommit(() => committed.resolve());
                                return t;
                            },
                        },
                    },
                }),
            },
        });
        return control;
    };

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        user = await server.db.models["user"].findOne({where: {email: process.env.GUEST_EMAIL}, raw: true});
    });

    beforeEach(async () => {
        client = await getSocketClient(server, PORT, process.env.GUEST_EMAIL, process.env.GUEST_PWD);
        await new Promise((resolve) => client.once("ready", resolve));
        serverSocket = server.availSockets[client.id]["DocumentSocket"];
    }, 60000); // the first connection to a freshly started server is slow

    afterEach(() => {
        client.close();
    });

    afterAll(async () => {
        await server.stop();
    });

    test("delayed transaction acquisition keeps reception order in the database", async () => {
        const documentId = await createDocument();
        const control = controlTransactions();
        const hold = deferred();
        control.holds[0] = hold;

        const received = deferred();
        serverSocket.socket.onAny((event, data) => {
            if (event === "documentEdit" && data.ops[0].text === "Y") {
                received.resolve();
            }
        });

        const edit = (text, offset) => emitEdit({
            documentId,
            studySessionId: null,
            studyStepId: null,
            ops: [insert(text, offset)],
        });
        const x = edit("X", 1);
        const y = edit("Y", 2);

        await received.promise;
        await flush();
        // Force the adverse order wherever it is possible: X must only continue after Y committed, if Y got that far
        if (control.requested > 1) {
            await control.commits[1].promise;
        }
        hold.resolve();

        expect(await x).toMatchObject({success: true});
        expect(await y).toMatchObject({success: true});
        expect(await persistedText(documentId)).toBe("aXYb");
    });

    test("the next edit reads the committed result of the previous one", async () => {
        const documentId = await createDocument();
        const documentEdit = server.db.models["document_edit"];
        const reads = [];
        serverSocket.models = {
            ...server.db.models,
            document_edit: {
                max: documentEdit.max.bind(documentEdit),
                bulkCreate: async (edits, options) => {
                    // Outside of the transaction of the edit: this is what any other connection sees
                    reads.push(await persistedText(documentId));
                    return documentEdit.bulkCreate(edits, options);
                },
            },
        };

        const edit = (text, offset) => emitEdit({
            documentId,
            studySessionId: null,
            studyStepId: null,
            ops: [insert(text, offset)],
        });
        const acks = await Promise.all([edit("X", 1), edit("Y", 2), edit("Z", 3)]);

        expect(acks.map((ack) => ack.success)).toEqual([true, true, true]);
        expect(reads).toEqual(["ab", "aXb", "aXYb"]);
        expect(await persistedText(documentId)).toBe("aXYZb");
    });

    test("a rolled back edit leaves no rows behind and does not block the next edit", async () => {
        const documentId = await createDocument();
        const base = {documentId, studySessionId: null, studyStepId: null};
        const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

        const [failed, next] = await Promise.all([
            // The second operation is rejected by the database, which has to roll back the first one as well
            emitEdit({...base, ops: [insert("X", 1), insert("!", "not-a-number")]}),
            emitEdit({...base, ops: [insert("Y", 1)]}),
        ]);
        consoleLog.mockRestore();

        expect(failed).toMatchObject({success: false, key: "errors.server.unexpectedError"});
        expect(next).toMatchObject({success: true});
        expect(await persistedText(documentId)).toBe("aYb");
    });

    test("a held edit does not block other documents and study sessions", async () => {
        const documentId = await createDocument();
        const otherDocumentId = await createDocument();
        const sessionId = await createStudySession();
        const otherSessionId = await createStudySession();
        const control = controlTransactions();
        const hold = deferred();
        control.holds[0] = hold;

        const edit = (id, studySessionId, text) => emitEdit({
            documentId: id,
            studySessionId,
            studyStepId: null,
            ops: [insert(text, 1)],
        });
        const held = edit(documentId, sessionId, "H");
        await control.firstRequest.promise;

        expect(await edit(otherDocumentId, null, "D")).toMatchObject({success: true});
        expect(await edit(documentId, otherSessionId, "S")).toMatchObject({success: true});
        expect(await edit(documentId, null, "B")).toMatchObject({success: true});
        expect(await persistedText(otherDocumentId)).toBe("aDb");
        expect(await persistedText(documentId)).toBe("aBb");

        hold.resolve();
        expect(await held).toMatchObject({success: true});

        // Session edits never leak into the base document or into the other session
        const rows = await server.db.models["document_edit"].findAll({
            where: {documentId},
            raw: true,
        });
        const textsOf = (studySessionId) => rows.filter((row) => row.studySessionId === studySessionId).map((row) => row.text);
        expect(textsOf(sessionId)).toEqual(["H"]);
        expect(textsOf(otherSessionId)).toEqual(["S"]);
        expect(textsOf(null).sort()).toEqual(["B", "ab"]);
    });

    test.each([
        ["document", {documentId: {toString: 1}}],
        ["study session", {studySessionId: {toString: 1}}],
        ["study step", {studyStepId: {toString: 1}}],
        ["document as plain object", {documentId: {a: 1}}],
        ["study session as plain object", {studySessionId: {a: 1}}],
        ["study step as array", {studyStepId: [1]}],
    ])("a malformed %s gets a failed acknowledgement and the server keeps working", async (_, context) => {
        const documentId = await createDocument();
        const base = {documentId, studySessionId: null, studyStepId: null};
        const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

        const malformed = await emitEdit({...base, ops: [], ...context});
        consoleLog.mockRestore();

        expect(malformed).toMatchObject({success: false, key: "errors.server.unexpectedError"});
        expect(await emitEdit({...base, ops: [insert("X", 1)]})).toMatchObject({success: true});
        expect(await persistedText(documentId)).toBe("aXb");
    });

    test("null as payload gets a failed acknowledgement and the server keeps working", async () => {
        const documentId = await createDocument();
        const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

        const malformed = await emitEdit(null);
        consoleLog.mockRestore();

        expect(malformed).toMatchObject({success: false, key: "errors.server.unexpectedError"});
        expect(await emitEdit({documentId, studySessionId: null, studyStepId: null, ops: [insert("X", 1)]}))
            .toMatchObject({success: true});
        expect(await persistedText(documentId)).toBe("aXb");
    });

    test("a persisted edit ahead of the clock sorts first after a restart, reading it once", async () => {
        const documentId = await createDocument();
        const documentEdit = server.db.models["document_edit"];
        const future = new Date(Date.now() + 3600000);
        await documentEdit.create({
            documentId, userId: user.id, draft: true, operationType: 0, offset: 1, span: 0, text: "X", order: 1, createdAt: future,
        });
        const base = {documentId, studySessionId: null, studyStepId: null};
        const max = jest.spyOn(documentEdit, "max");

        // This context is new to the process, exactly as every context after a restart
        const acks = await Promise.all([
            emitEdit({...base, ops: [insert("Y", 2)]}),
            emitEdit({...base, ops: [insert("Z", 3)]}),
        ]);
        const maxCalls = max.mock.calls.filter(([, {where}]) => where.documentId === documentId);
        max.mockRestore();

        expect(acks.map((ack) => ack.success)).toEqual([true, true]);
        expect(maxCalls).toHaveLength(1);
        expect(maxCalls[0][1].transaction).toBeDefined();
        expect(await persistedText(documentId)).toBe("aXYZb");

        const times = (await documentEdit.findAll({where: {documentId, text: ["Y", "Z"]}, order: [["id", "ASC"]], raw: true}))
            .map((row) => row.createdAt.getTime());
        expect(times).toEqual([future.getTime() + 1, future.getTime() + 2]);
    });

    test("a context without edits uses the clock, independently of another context ahead of it", async () => {
        const documentId = await createDocument();
        const emptyDocument = await server.db.models["document"].create({
            name: "edit order test",
            hash: randomUUID(),
            userId: user.id,
            type: server.db.models["document"].docTypes.DOC_TYPE_HTML,
        });
        const documentEdit = server.db.models["document_edit"];
        const future = new Date(Date.now() + 3600000);
        await documentEdit.create({
            documentId, userId: user.id, draft: true, operationType: 0, offset: 1, span: 0, text: "X", order: 1, createdAt: future,
        });
        const context = {studySessionId: null, studyStepId: null};
        expect(await emitEdit({documentId, ...context, ops: [insert("Y", 2)]})).toMatchObject({success: true});
        const before = Date.now();

        const ack = await emitEdit({documentId: emptyDocument.id, ...context, ops: [insert("E", 0)]});

        expect(ack).toMatchObject({success: true});
        const [row] = await documentEdit.findAll({where: {documentId: emptyDocument.id}, raw: true});
        expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(row.createdAt.getTime()).toBeLessThan(future.getTime());
    });

    test("a failed COMMIT is reported, broadcasts nothing and does not block the next edit", async () => {
        const documentId = await createDocument();
        const documentEdit = server.db.models["document_edit"];
        const sequelize = server.db.sequelize;
        serverSocket.socket.join("doc:" + documentId);
        const received = [];
        client.on("document_editRefresh", (edits) => received.push(...edits.map((edit) => edit.text)));

        const changes = [];
        const broadcastTransactionChanges = jest.spyOn(serverSocket, "broadcastTransactionChanges")
            .mockImplementation(async (t) => changes.push(t.changes));
        const silenced = ["log", "warn"].map((method) => jest.spyOn(console, method).mockImplementation(() => {}));

        serverSocket.models = {
            ...server.db.models,
            document_edit: {
                max: documentEdit.max.bind(documentEdit),
                bulkCreate: async (edits, options) => {
                    const saved = await documentEdit.bulkCreate(edits, options);
                    if (edits[0].text === "X") {
                        // The connection of the transaction dies right before its COMMIT
                        const pid = options.transaction.connection.processID;
                        await sequelize.query("SELECT pg_terminate_backend(:pid)", {replacements: {pid}});
                        let alive = true;
                        while (alive) {
                            const [rows] = await sequelize.query("SELECT 1 FROM pg_stat_activity WHERE pid = :pid", {replacements: {pid}});
                            alive = rows.length > 0;
                        }
                    }
                    return saved;
                },
            },
        };

        const base = {documentId, studySessionId: null, studyStepId: null};
        const [x, y] = await Promise.all([
            emitEdit({...base, ops: [insert("X", 1)]}),
            emitEdit({...base, ops: [insert("Y", 1)]}),
        ]);
        silenced.forEach((spy) => spy.mockRestore());
        broadcastTransactionChanges.mockRestore();

        expect(x).toMatchObject({success: false, key: "errors.server.unexpectedError"});
        expect(y).toMatchObject({success: true});
        expect(await persistedText(documentId)).toBe("aYb");
        // The refresh of Y is sent before its acknowledgement, and the general broadcast has nothing of bulkCreate
        expect(received).toEqual(["Y"]);
        expect(changes).toEqual([undefined, undefined]);
    }, 30000);

    test("a failing transaction acquisition is reported and does not block the next edit", async () => {
        const documentId = await createDocument();
        const control = controlTransactions();
        control.failures[0] = new Error("simulated acquisition failure");
        const base = {documentId, studySessionId: null, studyStepId: null};
        const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

        const [x, y] = await Promise.all([
            emitEdit({...base, ops: [insert("X", 1)]}),
            emitEdit({...base, ops: [insert("Y", 1)]}),
        ]);
        consoleLog.mockRestore();

        expect(x).toMatchObject({success: false, key: "errors.server.unexpectedError"});
        expect(y).toMatchObject({success: true});
        expect(await persistedText(documentId)).toBe("aYb");
    });

    test("a failing broadcast keeps the committed edit and the following broadcasts", async () => {
        const documentId = await createDocument();
        serverSocket.socket.join("doc:" + documentId);
        const received = [];
        client.on("document_editRefresh", (edits) => received.push(...edits.map((edit) => edit.text)));
        const failure = new Error("simulated broadcast failure");
        const updateCreatorName = jest.spyOn(serverSocket, "updateCreatorName").mockRejectedValueOnce(failure);
        const error = jest.spyOn(serverSocket.logger, "error");

        const base = {documentId, studySessionId: null, studyStepId: null};
        const [x, y] = await Promise.all([
            emitEdit({...base, ops: [insert("X", 1)]}),
            emitEdit({...base, ops: [insert("Y", 2)]}),
        ]);
        const logged = error.mock.calls.map(([message]) => message);
        updateCreatorName.mockRestore();
        error.mockRestore();

        expect(x).toMatchObject({success: true});
        expect(y).toMatchObject({success: true});
        expect(await persistedText(documentId)).toBe("aXYb");
        expect(received).toEqual(["Y"]);
        expect(logged).toContainEqual(expect.stringContaining("simulated broadcast failure"));
    });

    test("more concurrent contexts than database connections finish without a deadlock", async () => {
        const contexts = server.db.sequelize.connectionManager.pool.maxSize + 15;
        const documentIds = await Promise.all(Array.from({length: contexts}, () => createDocument()));

        const edit = (documentId, text, offset) => emitEdit({
            documentId,
            studySessionId: null,
            studyStepId: null,
            ops: [insert(text, offset)],
        });
        const acks = await Promise.all(documentIds.flatMap((id) => [edit(id, "X", 1), edit(id, "Y", 2)]));

        expect(acks.every((ack) => ack.success)).toBe(true);
        expect(await Promise.all(documentIds.map(persistedText))).toEqual(documentIds.map(() => "aXYb"));
    }, 60000);

    test("broadcasts committed base document edits in reception order", async () => {
        const documentId = await createDocument();
        serverSocket.socket.join("doc:" + documentId);
        const received = [];
        client.on("document_editRefresh", (edits) => received.push(...edits.map((edit) => edit.text)));

        const edit = (text, offset) => emitEdit({
            documentId,
            studySessionId: null,
            studyStepId: null,
            ops: [insert(text, offset)],
        });
        await Promise.all([edit("X", 1), edit("Y", 2), edit("Z", 3)]);
        // The refresh of the last edit is sent before its acknowledgement
        expect(received).toEqual(["X", "Y", "Z"]);
    });

    test("operation fields cannot leave the context of the message", async () => {
        const documentId = await createDocument();
        const otherDocumentId = await createDocument();
        const otherSessionId = await createStudySession();

        const ack = await emitEdit({
            documentId,
            studySessionId: null,
            studyStepId: null,
            ops: [{
                ...insert("X", 1),
                documentId: otherDocumentId,
                studySessionId: otherSessionId,
                userId: user.id + 1,
                order: 99,
                draft: false,
                deleted: true,
                id: 2147483000,
                createdAt: new Date(0),
            }],
        });

        expect(ack).toMatchObject({success: true});
        const row = await server.db.models["document_edit"].findOne({where: {text: "X", documentId}, raw: true});
        expect(row).toMatchObject({studySessionId: null, userId: user.id, order: 1, draft: true, deleted: false});
        expect(row.id).not.toBe(2147483000);
        expect(row.createdAt.getTime()).toBeGreaterThan(0);
        expect(await persistedText(documentId)).toBe("aXb");
        expect(await persistedText(otherDocumentId)).toBe("ab");
    });

    test("an operation type the reader cannot apply is not saved", async () => {
        const documentId = await createDocument();
        const base = {documentId, studySessionId: null, studyStepId: null};
        const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

        const acks = await Promise.all([7, null, undefined, "abc"].map((operationType) => emitEdit({
            ...base,
            ops: [{...insert("!", 0), operationType}],
        })));
        consoleLog.mockRestore();

        expect(acks.every((ack) => ack.success === false)).toBe(true);
        expect(await emitEdit({...base, ops: [insert("X", 1)]})).toMatchObject({success: true});
        expect(await persistedText(documentId)).toBe("aXb");
    });

    test("a non-function acknowledgement saves the edit once and the server keeps working", async () => {
        const documentId = await createDocument();
        const base = {documentId, studySessionId: null, studyStepId: null};
        const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

        client.emit("documentEdit", {...base, ops: [insert("X", 1)]}, "not-a-function");
        client.emit("documentEdit", null, 42);

        expect(await emitEdit({...base, ops: [insert("Y", 2)]})).toMatchObject({success: true});
        consoleLog.mockRestore();
        expect(await persistedText(documentId)).toBe("aXYb");
    });

    test("a burst of multi operation messages is reconstructed correctly", async () => {
        const documentId = await createDocument();
        const expected = [];
        const burst = [];
        for (let i = 0; i < 50; i++) {
            const first = String.fromCharCode(0x4e00 + 2 * i);
            const second = String.fromCharCode(0x4e01 + 2 * i);
            expected.push(first, second);
            burst.push(emitEdit({
                documentId,
                studySessionId: null,
                studyStepId: null,
                ops: [insert(first, 1 + 2 * i), insert(second, 2 + 2 * i)],
            }));
        }

        const acks = await Promise.all(burst);

        expect(acks.every((ack) => ack.success)).toBe(true);
        expect(await persistedText(documentId)).toBe(`a${expected.join("")}b`);
    }, 30000);
});
