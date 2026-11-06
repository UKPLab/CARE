const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Papa = require('papaparse');
const { createCsvStore } = require('../db/statsCsv');
const { KEYS, validateSettings, loadSettings } = require('../db/statsSettings');
const stats = require('../db/stats');
let directory;
const logger = { error: jest.fn() };
const snap = { counts: { active: 2 }, oldestActive: [{ query: 'SELECT "a",\n b' }],
    sequelizePool: null, dbStats: {}, locks: {}, collectedAt: '2026-11-06T23:59:59.000Z' };
beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'care-pg-stats-'));
    logger.error.mockClear();
});
afterEach(async () => {
    await stats.stop();
    jest.useRealTimers();
    delete process.env.PG_STATS_CSV_PATH;
    await fs.rm(directory, { recursive: true, force: true });
});
function store() { return createCsvStore(path.join(directory, 'pg-performance.csv')); }

test('rollover, concurrent appends and restart preserve one header and escaped JSON cells', async () => {
    const writer = store();
    await Promise.all(Array.from({ length: 5 }, () => writer.write(snap, 100000, new Date('2026-11-06T23:59:59Z'))));
    await store().write(snap, 100000, new Date('2026-11-06T23:59:59Z'));
    await writer.write(snap, 100000, new Date('2026-11-07T00:00:00Z'));
    const rows = Papa.parse(await fs.readFile(path.join(directory, 'pg-performance-2026-11-06.csv'), 'utf8'), { header: true, skipEmptyLines: true });
    expect(rows.errors).toEqual([]);
    expect(rows.data).toHaveLength(6);
    expect(JSON.parse(rows.data[0].oldestActive)).toEqual(snap.oldestActive);
    expect(rows.data[0].sequelizePool).toBe('');
    const nextDay = Papa.parse(await fs.readFile(path.join(directory, 'pg-performance-2026-11-07.csv'), 'utf8'), { header: true, skipEmptyLines: true });
    expect(nextDay.data).toHaveLength(1);
});

test('deletion defaults off; cleanup preserves cutoff, current, future, malformed and unrelated files', async () => {
    const names = ['pg-performance-2026-10-06.csv', 'pg-performance-2026-10-07.csv',
        'pg-performance-2026-11-06.csv', 'pg-performance-2026-12-01.csv',
        'pg-performance-2026-02-30.csv', 'other-2020-01-01.csv', 'pg-performance.csv',
        'pg-performance-2020-01-01.csv.bak'];
    await Promise.all(names.map(name => fs.writeFile(path.join(directory, name), 'data')));
    await fs.mkdir(path.join(directory, 'pg-performance-2020-01-01.csv'));
    await fs.symlink(path.join(directory, 'other-2020-01-01.csv'), path.join(directory, 'pg-performance-2020-01-02.csv'));
    const writer = store();
    await writer.cleanup({ retentionDays: 30 }, logger, new Date('2026-11-06T12:00:00Z'));
    expect(await fs.readdir(directory)).toHaveLength(10);
    await writer.cleanup({ autoDelete: true, retentionDays: 30 }, logger, new Date('2026-11-06T12:00:00Z'));
    expect(await fs.readdir(directory)).toEqual(expect.arrayContaining(names.slice(1)));
    expect(await fs.readdir(directory)).not.toContain(names[0]);
    expect(await fs.readdir(directory)).toHaveLength(9);
});

test('failed append does not poison later writes', async () => {
    const base = path.join(directory, 'missing', 'pg.csv');
    const writer = createCsvStore(base);
    await fs.writeFile(path.dirname(base), 'blocking directory');
    await expect(writer.write(snap, 100)).rejects.toThrow();
    await fs.unlink(path.dirname(base));
    await expect(writer.write(snap, 100)).resolves.toBeUndefined();
});

test.each(['0', '-1', '1.5', 'Infinity', '2147484', '', '1x'])('rejects invalid interval %s', value => {
    expect(() => validateSettings([{ key: KEYS[0], value }])).toThrow();
});
test('validates retention and boolean, and falls back when settings are missing', async () => {
    expect(() => validateSettings([{ key: KEYS[2], value: '0' }])).toThrow();
    expect(() => validateSettings([{ key: KEYS[2], value: '36501' }])).toThrow();
    expect(() => validateSettings([{ key: KEYS[1], value: 'yes' }])).toThrow();
    expect(await loadSettings({ models: { setting: { findAll: async () => [] } } }, 25000))
        .toEqual({ intervalMs: 25000, autoDelete: false, retentionDays: 30 });
});

test('changed interval reschedules collection without restart and stop cancels timers', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-11-06T10:00:00Z'));
    process.env.PG_STATS_CSV_PATH = path.join(directory, 'pg.csv');
    let interval = '100';
    const db = { query: jest.fn(async () => [[]]), models: { setting: {
        findAll: jest.fn(async () => [{ key: KEYS[0], value: interval }]),
    } } };
    await stats.start(db, logger);
    expect(db.query).toHaveBeenCalledTimes(5);
    interval = '2';
    await stats.refresh();
    await jest.advanceTimersByTimeAsync(1999);
    expect(db.query).toHaveBeenCalledTimes(5);
    await jest.advanceTimersByTimeAsync(1);
    await stats.stop();
    expect(db.query).toHaveBeenCalledTimes(10);
    expect(jest.getTimerCount()).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
});

test('startup cleanup uses saved retention; disabling deletion preserves files', async () => {
    process.env.PG_STATS_CSV_PATH = path.join(directory, 'pg.csv');
    const oldFile = path.join(directory, 'pg-2000-01-01.csv');
    await fs.writeFile(oldFile, 'old');
    let enabled = 'true';
    const db = { query: async () => [[]], models: { setting: {
        findAll: async () => [{ key: KEYS[1], value: enabled }],
    } } };
    await stats.start(db, logger);
    await expect(fs.stat(oldFile)).rejects.toMatchObject({ code: 'ENOENT' });
    enabled = 'false';
    await fs.writeFile(oldFile, 'old');
    await stats.refresh();
    expect((await fs.stat(oldFile)).isFile()).toBe(true);
});

test('daily cleanup runs at UTC midnight even with a collection interval longer than a day', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-11-06T23:59:59Z'));
    process.env.PG_STATS_CSV_PATH = path.join(directory, 'pg.csv');
    const boundaryFile = path.join(directory, 'pg-2026-10-07.csv');
    await fs.writeFile(boundaryFile, 'boundary');
    const db = { query: async () => [[]], models: { setting: {
        findAll: async () => [{ key: KEYS[0], value: '172800' }, { key: KEYS[1], value: 'true' }],
    } } };
    await stats.start(db, logger);
    expect((await fs.stat(boundaryFile)).isFile()).toBe(true);
    const unlink = fs.unlink.bind(fs);
    let notify;
    const deleted = new Promise(resolve => { notify = resolve; });
    const cleanup = jest.spyOn(fs, 'unlink').mockImplementation(async file => {
        const result = await unlink(file);
        if (file === boundaryFile) notify();
        return result;
    });
    await jest.advanceTimersByTimeAsync(1000);
    await deleted;
    // Drain the same queue via refresh before checking the filesystem.
    await stats.refresh();
    expect(cleanup).toHaveBeenCalledWith(boundaryFile);
    await expect(fs.stat(boundaryFile)).rejects.toMatchObject({ code: 'ENOENT' });
    cleanup.mockRestore();
});

test('read failure disables deletion while collection continues', async () => {
    process.env.PG_STATS_CSV_PATH = path.join(directory, 'pg.csv');
    const db = { query: jest.fn(async () => [[]]), models: { setting: {
        findAll: async () => { throw new Error('database unavailable'); },
    } } };
    const oldFile = path.join(directory, 'pg-2000-01-01.csv');
    await fs.writeFile(oldFile, 'old');
    await stats.start(db, logger);
    expect(db.query).toHaveBeenCalledTimes(5);
    expect((await fs.stat(oldFile)).isFile()).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('database unavailable'));
});

test('cleanup reports an unlink failure and continues with other old files', async () => {
    const first = path.join(directory, 'pg-performance-2000-01-01.csv');
    const second = path.join(directory, 'pg-performance-2000-01-02.csv');
    await fs.writeFile(first, 'old');
    await fs.writeFile(second, 'old');
    const unlink = fs.unlink.bind(fs);
    const mock = jest.spyOn(fs, 'unlink').mockImplementation(file => {
        if (file === first) return Promise.reject(Object.assign(new Error('permission denied'), { code: 'EACCES' }));
        return unlink(file);
    });
    try {
        await store().cleanup({ autoDelete: true, retentionDays: 30 }, logger);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('permission denied'));
        await expect(fs.stat(second)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { mock.mockRestore(); }
});

test('migration creates admin-only defaults and removes only its own keys on rollback', async () => {
    const migration = require('../db/migrations/20261106120000-add-pg-stats-settings');
    const qi = { bulkInsert: jest.fn(), bulkDelete: jest.fn() };
    await migration.up(qi);
    const rows = qi.bulkInsert.mock.calls[0][1];
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.onlyAdmin && !row.allowUserOverride)).toBe(true);
    expect(rows.find(row => row.key === KEYS[1]).value).toBe('false');
    expect(rows.find(row => row.key === KEYS[2]).value).toBe('30');
    await migration.down(qi);
    expect(qi.bulkDelete).toHaveBeenCalledWith('setting', { key: KEYS });
});
