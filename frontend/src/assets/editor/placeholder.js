import Quill from "quill";

/**
 * Extract placeholders from given text.
 * @param {*} docText text which needs to be parsed
 * @param {*} pattern pattern to be matched
 * @returns results
 */
export function extractPlaceholder(docText, pattern) {
    const results = [];    
    let match;

    while ((match = pattern.exec(docText)) !== null) {
        const index = match.index;
        const text = match[0];

        // Get all text before the placeholder
        const fullBeforeText = docText.slice(0, index).trim();
        const previewBefore = fullBeforeText.length > 100
            ? fullBeforeText.slice(0, 100) + "..."
            : fullBeforeText;

        // Get all text after the placeholder
        const fullAfterText = docText.slice(index + text.length).trim();
        const previewAfter = fullAfterText.length > 100
            ? fullAfterText.slice(0, 100) + "..."
            : fullAfterText;

        results.push({ text, previewBefore, previewAfter });
    }

    return results;
  }
  