import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { collectReports, reportsCsv, reportsArchive } from '../src/assets/problemReportExport.js';

test('CSV export fetches every cursor page', async () => {
    const calls = [];
    const reports = await collectReports(async ({ beforeId, limit }) => {
        calls.push({ beforeId, limit });
        return beforeId === null
            ? { rows: Array.from({ length: 100 }, (_, i) => ({ id: 101 - i })), nextCursor: 2 }
            : { rows: [{ id: 1 }], nextCursor: null };
    });
    assert.equal(reports.length, 101);
    assert.deepEqual(calls, [{ beforeId: null, limit: 100 }, { beforeId: 2, limit: 100 }]);
});

test('new reports between export pages do not omit or duplicate original reports', async () => {
    const original = Array.from({ length: 200 }, (_, i) => ({ id: 200 - i }));
    const stored = [...original];
    const reports = await collectReports(async ({ beforeId, limit }) => {
        if (beforeId !== null) stored.unshift({ id: 201 });
        const matching = stored.filter((row) => beforeId === null || row.id < beforeId);
        const rows = matching.slice(0, limit);
        return { rows, nextCursor: matching.length > limit ? rows.at(-1).id : null };
    });
    assert.deepEqual(reports, original);
});

test('failed pages reject the export instead of returning a partial file', async () => {
    await assert.rejects(collectReports(async ({ beforeId }) => {
        if (beforeId !== null) throw new Error('Access denied');
        return { rows: [{ id: 2 }], nextCursor: 2 };
    }), /Access denied/);
});

test('CSV keeps headers for an empty list and preserves full quoted descriptions safely', () => {
    const t = (key) => key;
    assert.equal(Papa.parse(reportsCsv([], t)).data[0].length, 11);
    const description = 'A long report, with "quotes"\nand new lines. '.repeat(10);
    const rows = Papa.parse(reportsCsv([
        { id: 1, description, blocked: false, attachments: [{ id: 1 }] },
        { id: 2, description: '=HYPERLINK("https://example.com")', creator_name: '+formula' },
    ], t)).data;
    assert.equal(rows[1][8], description);
    assert.equal(rows[1][5], 'problemReport.form.no');
    assert.equal(rows[1][9], '1');
    assert.equal(rows[2][3], "'+formula");
    assert.equal(rows[2][8], "'=HYPERLINK(\"https://example.com\")");
});


test('archive attachment paths exactly match CSV, including duplicate and unsafe names', async () => {
    const reports = [
        { id: 42, description: 'Report', attachments: [
            { id: 'a', name: '../../screenshot.png' },
            { id: 'b', name: '../../screenshot.png' },
        ] },
        { id: 43, attachments: [{ id: 'c', name: '../../screenshot.png' }] },
    ];
    const calls = [];
    const archive = await reportsArchive(reports, (key) => key, async (request) => {
        calls.push(request);
        return { file: new TextEncoder().encode(request.attachmentId) };
    });
    const zip = await JSZip.loadAsync(archive);
    const csv = await zip.file('problem-reports.csv').async('string');
    const rows = Papa.parse(csv, { header: true }).data;
    const paths = rows.flatMap((row) => row['problemReport.admin.attachmentFiles'].split('\n'));
    assert.equal(new Set(paths).size, 3);
    assert.ok(paths.every((path) => !path.split('/').includes('..')));
    for (const [index, path] of paths.entries()) {
        assert.equal(await zip.file(path).async('string'), ['a', 'b', 'c'][index]);
    }
    assert.deepEqual(calls, [
        { reportId: 42, attachmentId: 'a' }, { reportId: 42, attachmentId: 'b' },
        { reportId: 43, attachmentId: 'c' },
    ]);
});

test('attachment failures reject the archive instead of silently omitting a file', async () => {
    await assert.rejects(reportsArchive([{ id: 1, attachments: [{ id: 'a', name: 'x.png' }] }],
        (key) => key, async () => { throw new Error('Attachment missing'); }), /Attachment missing/);
});
