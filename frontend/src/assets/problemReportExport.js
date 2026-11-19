import Papa from "papaparse";
import { choiceLabel } from "./problemReport.js";

/** Fetch every page through the existing administrator-only report endpoint. */
export async function collectReports(fetchPage) {
    const limit = 100;
    const reports = new Map();
    let count;
    for (let page = 0; count === undefined || page * limit < count; page++) {
        const result = await fetchPage({ page, limit });
        count ??= result.count;
        if (!result.rows.length) break;
        for (const report of result.rows) reports.set(report.id, report);
    }
    return [...reports.values()];
}

/** Export list fields with full descriptions and spreadsheet-safe CSV quoting. */
export function reportsCsv(reports, t) {
    const fields = [
        t('problemReport.admin.columns.id'), t('problemReport.summary.reportedAt'),
        t('problemReport.summary.submittedAt'), t('problemReport.admin.columns.reporter'),
        t('problemReport.summary.problemTypes'), t('problemReport.summary.blocked'),
        t('problemReport.summary.frequency'), t('problemReport.summary.page'),
        t('problemReport.summary.description'), t('problemReport.summary.attachments'),
    ];
    const data = reports.map((report) => [
        report.id, report.context?.reportedAt || report.createdAt, report.createdAt,
        report.creator_name || report.userId,
        (report.problemTypes || []).map((type) => choiceLabel(t, "problemTypes", type)).join(", "),
        report.blocked === null || report.blocked === undefined ? "" : t(report.blocked ? 'problemReport.form.yes' : 'problemReport.form.no'),
        report.frequency ? choiceLabel(t, "frequencies", report.frequency) : "",
        report.context?.page || "", report.description, (report.attachments || []).length,
    ]);
    return Papa.unparse({ fields, data }, { escapeFormulae: true });
}
