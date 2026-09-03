/**
 * pdf.js builds one text-layer <span> per PDF text run, which is usually one
 * rendered line - there is no space character between the last word of a
 * wrapped line and the first word of the next, so native browser find can't
 * match a phrase that spans a line break, and neither can any plain-text
 * extraction built the same way. True whenever a joining space belongs after
 * this item: it ends a line, has content, and doesn't end on a hyphenated
 * word split.
 *
 * @param {object} item - a pdf.js text content item
 * @returns {boolean}
 */
export function endsWrappedLine(item) {
  return Boolean(item.hasEOL && item.str && !item.str.trimEnd().endsWith('-'));
}

/**
 * Appends a real (invisible, since the text layer is transparent) space to
 * every text-layer span that ends a wrapped line, so the DOM text stays
 * continuous across line breaks for native find. Must use the same
 * `endsWrappedLine` rule as `joinTextItems` below - the two are read by
 * different parts of annotation anchoring (DOM-walked vs. plain-text offsets)
 * and have to agree on where line-wrap spaces are inserted, or stored
 * annotation positions drift against the live DOM.
 *
 * @param {object} textContent - result of PDFPageProxy#getTextContent()
 * @param {import('pdfjs-dist').TextLayer} textLayerRenderTask - the TextLayer
 *   instance whose render() has already resolved
 * @returns {void}
 */
export function joinWrappedLines(textContent, textLayerRenderTask) {
  const items = textContent.items.filter(item => item.str !== undefined);
  const textDivs = textLayerRenderTask.textDivs;

  items.forEach((item, i) => {
    if (endsWrappedLine(item) && textDivs[i]) {
      textDivs[i].append(' ');
    }
  });
}

/**
 * Concatenates text content items into the page's plain-text representation
 * used for annotation-anchoring offsets, inserting the same line-wrap spaces
 * as `joinWrappedLines` so DOM-walked and plain-text character offsets stay
 * in agreement.
 *
 * @param {object[]} items - textContent.items from PDFPageProxy#getTextContent()
 * @returns {string}
 */
export function joinTextItems(items) {
  return items
    .filter(item => item.str !== undefined)
    .map(item => item.str + (endsWrappedLine(item) ? ' ' : ''))
    .join('');
}
