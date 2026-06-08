/**
 * Build HTML preview for template placeholders using DB example strings only.
 * Replaces literal ~key~ tokens in Quill output HTML with example text.
 *
 * @author Mohammad Elwan
 */

/**
 * Map API rows to the minimal shape needed for example preview substitution.
 */
export function mapPlaceholderPreviewRows(apiRows) {
  return (apiRows || []).map((ph) => ({
    id: ph.placeholderKey,
    text: `~${ph.placeholderKey}~`,
    example: ph.placeholderExample != null ? ph.placeholderExample : "",
  }));
}

/**
 * Escape text for safe insertion as HTML text nodes / innerHTML fragments.
 */
export function escapeHtmlForPreview(value) {
  if (value === undefined || value === null) {
    return "";
  }
  let raw;
  if (typeof value === "object") {
    try {
      raw = JSON.stringify(value);
    } catch (_error) {
      raw = "";
    }
  } else {
    raw = String(value);
  }
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace ~placeholderKey~ in Quill HTML with escaped placeholderExample values.
 */
export function buildExamplePreviewHtml(editorRootInnerHtml, placeholders) {
  if (!editorRootInnerHtml || !Array.isArray(placeholders) || placeholders.length === 0) {
    return editorRootInnerHtml || "";
  }

  const sorted = [...placeholders].sort((a, b) => (b.text || "").length - (a.text || "").length);

  let html = editorRootInnerHtml;
  for (const ph of sorted) {
    const token = ph.text;
    if (!token) {
      continue;
    }
    const replacement = escapeHtmlForPreview(ph.example);
    const re = new RegExp(escapeRegex(token), "g");
    html = html.replace(re, replacement);
  }
  return html;
}
