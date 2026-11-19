import Papa from "papaparse";
import JSZip from "jszip";
import { choiceLabel } from "./problemReport.js";

/**
 * Fetch reports in descending ID order without shifting offsets during new submissions.
 * @param {Function} fetchPage Fetches {rows, nextCursor} for {beforeId, limit}.
 * @returns {Promise<Object[]>} Reports present along the cursor traversal.
 * @throws {Error} When any page request fails.
 */
export async function collectReports(fetchPage) {
    const limit = 100;
    const reports = [];
    let beforeId = null;
    do {
        const result = await fetchPage({ beforeId, limit });
        reports.push(...result.rows);
        beforeId = result.nextCursor;
    } while (beforeId !== null);
    return reports;
}

/**
 * @param {Object} report Owning report.
 * @param {Object} attachment Attachment with its server-normalized name.
 * @param {number} index Zero-based position within the report.
 * @returns {string} Unique relative ZIP path also used in the CSV.
 */
function attachmentPath(report, attachment, index) {
    const name = (attachment.name || "attachment").replace(/[^\p{L}\p{N}._-]/gu, "_").replace(/^\.+/, "_");
    return `attachments/report-${report.id}/${index + 1}-${name}`;
}

/**
 * Keep the CSV and its referenced attachments together in one archive.
 * @param {Object[]} reports Reports to export.
 * @param {Function} t Translation function.
 * @param {Function} fetchAttachment Fetches binary file data by report/attachment ID.
 * @returns {Promise<Uint8Array>} ZIP bytes.
 * @throws {Error} When an attachment cannot be downloaded or archived.
 */
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

/**
 * Export list fields with full descriptions and spreadsheet-safe CSV quoting.
 * @param {Object[]} reports Reports to export.
 * @param {Function} t Translation function.
 * @returns {string} CSV with headers, including attachment paths.
 */
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
