const {startRestTransaction, restChangeBatch} = require('../webserver/utils/restBroadcast');
const {runWrite} = require('../webserver/routes/rest/routeHelpers');
const Socket = require('../webserver/Socket.js');
const TranslatableError = require('../utils/TranslatableError');

/**
 * REST transactions run their after-commit steps (file renames, emails, dashboard refresh) only when
 * COMMIT really succeeded. Sequelize itself runs afterCommit hooks even when COMMIT fails.
 * No database: the transaction is a stand-in whose commit succeeds or fails on demand.
 */
describe('REST transactions', () => {
    /**
     * A server stand-in whose transaction commit succeeds or fails on demand.
     *
     * @param {Error} [commitError] the error COMMIT throws; none for a successful commit
     * @returns {Object} the server, with `logged` collecting the logged errors
     */
    function fakeServer(commitError) {
        const logged = [];
        return {
            logged,
            logger: {error: (message) => logged.push(message)},
            db: {
                sequelize: {
                    transaction: async () => ({
                        changes: [{id: 1}],
                        commit: async () => {
                            if (commitError) {
                                throw commitError;
                            }
                        },
                        afterCommit: () => {
                            throw new Error('the library hook must not be used');
                        },
                    }),
                },
            },
        };
    }

    test('a failed COMMIT runs no after-commit step and is not marked committed', async () => {
        const transaction = await startRestTransaction(fakeServer(new Error('connection lost')), 1);
        const ran = [];
        transaction.afterCommit(() => ran.push('rename'));
        await expect(transaction.commit()).rejects.toThrow('connection lost');
        expect(ran).toEqual([]);
        expect(transaction.restCommitted).toBeUndefined();
    });

    test('a successful COMMIT runs the steps in order and is marked committed', async () => {
        const transaction = await startRestTransaction(fakeServer(null), 1);
        const ran = [];
        transaction.afterCommit(() => ran.push('first'));
        transaction.afterCommit(async () => ran.push('second'));
        await transaction.commit();
        expect(ran).toEqual(['first', 'second']);
        expect(transaction.restCommitted).toBe(true);
    });

    test('a step that throws after COMMIT rejects commit() with the transaction marked committed', async () => {
        const transaction = await startRestTransaction(fakeServer(null), 1);
        transaction.afterCommit(() => {
            throw new Error('rename failed');
        });
        await expect(transaction.commit()).rejects.toThrow('rename failed');
        expect(transaction.restCommitted).toBe(true);
    });

    test('bulk batch transactions follow the same rule: a failed COMMIT rejects, a good one broadcasts quietly', async () => {
        const failing = restChangeBatch(fakeServer(new Error('commit failed')), 1);
        const failed = await failing.start();
        await expect(failed.commit()).rejects.toThrow('commit failed');

        const server = fakeServer(null);
        const batch = restChangeBatch(server, 1);
        const committed = await batch.start();
        await committed.commit();
        // Without server.io the broadcast does nothing; the point is that it does not throw.
        await batch.broadcast();
        expect(server.logged).toEqual([]);
    });

    test('a bulk batch broadcasts only the changes of items whose COMMIT succeeded', async () => {
        const spy = jest.spyOn(Socket, 'broadcastChangesWithoutSocket').mockResolvedValue();
        try {
            const outcomes = [new Error('commit failed'), null];
            const server = {
                io: {},
                logger: {error: () => {}},
                db: {sequelize: {transaction: async () => {
                    const error = outcomes.shift();
                    return {
                        changes: [{id: error ? 'failed item' : 'committed item'}],
                        commit: async () => {
                            if (error) {
                                throw error;
                            }
                        },
                    };
                }}},
            };
            const batch = restChangeBatch(server, 1);
            await expect((await batch.start()).commit()).rejects.toThrow('commit failed');
            await (await batch.start()).commit();
            await batch.broadcast();
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][2].changes).toEqual([{id: 'committed item'}]);
        } finally {
            spy.mockRestore();
        }
    });

    describe('runWrite', () => {
        function fakeRes() {
            return {
                statusCode: 200,
                body: undefined,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(body) {
                    this.body = body;
                    return this;
                },
            };
        }
        const req = {apiUserId: 1, apiToken: {id: 1}, apiAccess: {rights: new Set()}};

        test('a failed COMMIT cleans up written files and answers 500', async () => {
            const res = fakeRes();
            const onRollback = jest.fn();
            await runWrite(fakeServer(new Error('connection lost')), {...req}, res,
                {label: 'test write', writtenFiles: [], onRollback}, async () => ({ok: true}));
            expect(onRollback).toHaveBeenCalledTimes(1);
            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({message: 'errors.server.unknownError'});
        });

        test('a step that fails after a good COMMIT keeps the files and answers 500 with its key', async () => {
            const res = fakeRes();
            const onRollback = jest.fn();
            await runWrite(fakeServer(null), {...req}, res, {label: 'test write', writtenFiles: [], onRollback},
                async (options) => {
                    options.transaction.afterCommit(() => {
                        throw new TranslatableError('errors.rest.replacePromoteFailed', {documentId: 7});
                    });
                    return {ok: true};
                });
            expect(onRollback).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({message: 'errors.rest.replacePromoteFailed', params: {documentId: 7}});
        });
    });
});
