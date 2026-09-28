/**
 * Build HTML preview for template placeholders using DB example strings only.
 * Replaces ~key~ and ~key[N]~ tokens in Quill output HTML with example text.
 *
 * @author Mohammad Elwan
 */

import { applyPlaceholderReplacements } from "placeholder-tokens";

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

/**
 * Replace placeholder tokens in Quill HTML with escaped placeholderExample values.
 *
 * @param {string} editorRootInnerHtml - Quill root innerHTML
 * @param {Object[]} placeholders - Rows with id (base key) and example
 * @param {Object} [options] - Options
 * @param {boolean} [options.bracketOnly] - When true, ignore legacy ~key~ tokens (default: false)
 * @returns {string} Preview HTML with example text substituted for known tokens
 */
export function buildExamplePreviewHtml(editorRootInnerHtml, placeholders, options = {}) {
  if (!editorRootInnerHtml || !Array.isArray(placeholders) || placeholders.length === 0) {
    return editorRootInnerHtml || "";
  }

  const { bracketOnly = false } = options;
  const examplesByKey = Object.fromEntries(
    placeholders.map((ph) => [ph.id, ph.example])
  );

  return applyPlaceholderReplacements(editorRootInnerHtml, (baseKey, index) => {
    if (bracketOnly && index == null) {
      return undefined;
    }
    if (!baseKey || !Object.prototype.hasOwnProperty.call(examplesByKey, baseKey)) {
      return undefined;
    }
    return escapeHtmlForPreview(examplesByKey[baseKey]);
  });
}
