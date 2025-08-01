/**
 * Get the start and end positions of exact text within whole text, along with prefix and suffix
 * @param {string} exactText - The text to find positions for
 * @param {string} wholeText - The complete text to search within
 * @returns {{start: number, end: number, prefix: string, suffix: string}} Object containing start, end, prefix and suffix
 * @throws {Error} If exact text is not found in whole text
 */
function getTextPositions(exactText, wholeText) {
    const start = wholeText.indexOf(exactText);
    if (start === -1) {
        throw new Error('Exact text not found in whole text');
    }

    const end = start + exactText.length;

    // Use the same context length calculation as in anchoring types
    const contextLen = 32;
    const prefix = wholeText.slice(Math.max(0, start - contextLen), start);
    const suffix = wholeText.slice(end, Math.min(wholeText.length, end + contextLen));

    return { start, end, prefix, suffix };
}

module.exports = {
    getTextPositions,
};