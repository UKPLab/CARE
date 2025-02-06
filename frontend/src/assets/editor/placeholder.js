import Quill from "quill";

/**
 * Extract placeholders from a document.
 * @param {*} document 
 * @param {*} regex 
 * @returns results
 */
export function extractPlaceholder(documentText, regex) {
    const { deltas } = documentText || {};
    const results = [];

    if (deltas) {
        let quill = new Quill(document.createElement('div'));
        quill.setContents(deltas);
        const content = quill.getText();    
        
        let match;
    
        while ((match = regex.exec(content)) !== null) {
        const index = match.index;
        const text = match[0];
    
        // Get all text before the placeholder
        const fullBeforeText = content.slice(0, index).trim();
        const previewBefore = fullBeforeText.length > 100
            ? fullBeforeText.slice(0, 100) + "..."
            : fullBeforeText;
    
        // Get all text after the placeholder
        const fullAfterText = content.slice(index + text.length).trim();
        const previewAfter = fullAfterText.length > 100
            ? fullAfterText.slice(0, 100) + "..."
            : fullAfterText;
    
        results.push({ text, previewBefore, previewAfter });
        }
    }
  
    return results;
  }
  