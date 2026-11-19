import Papa from "papaparse";
import JSZip from "jszip";
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

function attachmentPath(report, attachment, index) {
    const name = (attachment.name || "attachment").replace(/[^\p{L}\p{N}._-]/gu, "_").replace(/^\.+/, "_");
    return `attachments/report-${report.id}/${index + 1}-${name}`;
}

/** Keep the CSV and its referenced attachments together in one archive. */
export async function reportsArchive(reports, t, fetchAttachment) {
    const zip = new JSZip();
    zip.file("problem-reports.csv", "\uFEFF" + reportsCsv(reports, t));
    for (const report of reports) {
        for (const [index, attachment] of (report.attachments || []).entries()) {
            const data = await fetchAttachment({ reportId: report.id, attachmentId: attachment.id });
            zip.file(attachmentPath(report, attachment, index), data.file);
        }
    }
    return zip.generateAsync({ type: "uint8array" });
}

/** Export list fields with full descriptions and spreadsheet-safe CSV quoting. */
export function reportsCsv(reports, t) {
    const fields = [
        t('problemReport.admin.columns.id'), t('problemReport.summary.reportedAt'),
        t('problemReport.summary.submittedAt'), t('problemReport.admin.columns.reporter'),
        t('problemReport.summary.problemTypes'), t('problemReport.summary.blocked'),
        t('problemReport.summary.frequency'), t('problemReport.summary.page'),
        t('problemReport.summary.description'), t('problemReport.summary.attachments'),
        t('problemReport.admin.attachmentFiles'),
    ];
    const data = reports.map((report) => [
        report.id, report.context?.reportedAt || report.createdAt, report.createdAt,
        report.creator_name || report.userId,
        (report.problemTypes || []).map((type) => choiceLabel(t, "problemTypes", type)).join(", "),
        report.blocked === null || report.blocked === undefined ? "" : t(report.blocked ? 'problemReport.form.yes' : 'problemReport.form.no'),
        report.frequency ? choiceLabel(t, "frequencies", report.frequency) : "",
        report.context?.page || "", report.description, (report.attachments || []).length,
        (report.attachments || []).map((attachment, index) => attachmentPath(report, attachment, index)).join("\n"),
    ]);
    return Papa.unparse({ fields, data }, { escapeFormulae: true });
}
