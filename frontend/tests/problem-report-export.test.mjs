import test from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { collectReports, reportsCsv } from '../src/assets/problemReportExport.js';

test('CSV export fetches reports beyond the visible page', async () => {
    const calls = [];
    const reports = await collectReports(async ({ page, limit }) => {
        calls.push({ page, limit });
        return { count: 101, rows: Array.from({ length: page === 0 ? 100 : 1 }, (_, i) => ({ id: page * 100 + i })) };
    });
    assert.equal(reports.length, 101);
    assert.deepEqual(calls, [{ page: 0, limit: 100 }, { page: 1, limit: 100 }]);
});

test('failed pages reject the export instead of returning a partial file', async () => {
    await assert.rejects(collectReports(async ({ page }) => {
        if (page) throw new Error('Access denied');
        return { count: 101, rows: [{ id: 1 }] };
    }), /Access denied/);
});

test('CSV keeps headers for an empty list and preserves full quoted descriptions safely', () => {
    const t = (key) => key;
    assert.equal(Papa.parse(reportsCsv([], t)).data[0].length, 10);
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
