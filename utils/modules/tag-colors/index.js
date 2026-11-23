/**
 * Highlight colors for tags, shared by the annotator (frontend) and the PDF export (backend),
 * so exported highlights match what users see while annotating.
 *
 * @author Mélissa Loew
 */

/** Hex color (without "#") for each tag colorCode. */
const TAG_COLORS = {
    success: "009933",
    danger: "e05f5f",
    info: "5fe0df",
    dark: "c8c8c8",
    warning: "eed042",
    secondary: "4290ee",
};

module.exports = {
    TAG_COLORS,
};
