const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {setTimeout: delay} = require('node:timers/promises');

test('reconnections reuse file streams and listeners without mixing user or database context', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'care-logger-'));
    process.env.LOGGING_PATH = directory;
    process.env.LOGGING_LEVEL = 'info';
    process.env.DISABLE_LOGGING = 'false';
    const createLogger = require('../utils/logger');
    const winston = require('winston');
    const rows = [];
    const otherRows = [];
    const database = records => ({models: {log: {
        createLog: async info => records.push(info)
    }}});
    const db = database(rows);
    const first = createLogger('Socket/First', db).child({userId: 1});
    const other = createLogger('Socket/Other', database(otherRows)).child({userId: 3});
    const global = createLogger('Global');
    const parents = [Object.getPrototypeOf(Object.getPrototypeOf(first)),
        Object.getPrototypeOf(Object.getPrototypeOf(other)), Object.getPrototypeOf(global)];
    const files = first.transports.filter(t => t instanceof winston.transports.DailyRotateFile);
    for (const parent of parents) {
        parent.transports.filter(t => t instanceof winston.transports.Console)
            .forEach(t => { t.silent = true; });
    }
    try {
        assert.equal(files.length, 3);
        for (const logger of [other, global]) {
            assert.deepEqual(logger.transports.filter(t => t instanceof winston.transports.DailyRotateFile), files);
        }
        const listenerCounts = () => [...parents, ...files].map(emitter =>
            emitter.eventNames().map(event => [event, emitter.listenerCount(event)]));
        const before = listenerCounts();
        for (let i = 0; i < 2000; i++) {
            const socketLogger = createLogger('Socket/Reconnect', db).child({userId: i});
            assert.deepEqual(socketLogger.transports, first.transports);
        }
        assert.deepEqual(listenerCounts(), before);

        const second = createLogger('Socket/Second', db).child({userId: 2});
        first.info('first');
        second.info('second');
        first.info('first again');
        other.info('other');
        global.info('global');
        let entries = [];
        for (let attempt = 0; attempt < 100; attempt++) {
            const filename = fs.readdirSync(directory).find(name => /^complete-.*\.log$/.test(name));
            const contents = filename ? fs.readFileSync(path.join(directory, filename), 'utf8').trim() : '';
            entries = contents ? contents.split('\n').map(line => JSON.parse(line)) : [];
            if (entries.length === 5 && rows.length === 3 && otherRows.length === 1) break;
            await delay(10);
        }
        assert.equal(entries.length, 5);
        assert.deepEqual(rows.map(({service, userId}) => [service, userId]),
            [['Socket/First', 1], ['Socket/Second', 2], ['Socket/First', 1]]);
        assert.deepEqual(otherRows.map(({service, userId}) => [service, userId]), [['Socket/Other', 3]]);
        assert.equal(entries.find(entry => entry.message === 'second').userId, 2);
        assert.equal(entries.find(entry => entry.message === 'first again').userId, 1);
    } finally {
        for (const parent of parents) parent.close();
        await delay(30);
        fs.rmSync(directory, {recursive: true, force: true});
    }
});
