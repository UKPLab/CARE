<template>
    <PDFJSViewer :pdf_path="pdf_path"></PDFJSViewer>
    <Adder @addAnnotation="addAnnotation" />
</template>

<script>
/* Annotator.vue - annotation view

This parent component provides the annotation view, which
currently consists of the PDF viewer.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import PDFJSViewer from "./PDFJSViewer.vue";
import Adder from "./Adder.vue";
import {TextRange} from "../../assets/anchoring/text-range";
import { anchor as pdfAnchor } from "../../assets/anchoring/anchoring";
import {
  highlightRange,
  removeHighlights,
  setHighlightsFocused
} from "../../../../frameworks/hypothesis/client/src/annotator/highlighter";

export default {
  name: "Annotater",
  components: {Adder, PDFJSViewer},
  props: ['pdf_path'],
  data() {
    return {
      anchors: [],
      _annotations: /** @type {Set<string>} */ (new Set()),
      _focusedAnnotations: new Set()
    }
  },
  methods: {
    async addAnnotation(annotation) {
      const locate = async target => {
        // Only annotations with an associated quote can currently be anchored.
        // This is because the quote is used to verify anchoring with other selector
        // types.
        if (
          !target.selector ||
          !target.selector.some(s => s.type === 'TextQuoteSelector')
        ) {
          return { annotation, target };
        }

        /** @type {Anchor} */
        let anchor;
        try {
          const range = await pdfAnchor(
            document.body,
            target.selector
          );
          // Convert the `Range` to a `TextRange` which can be converted back to
          // a `Range` later. The `TextRange` representation allows for highlights
          // to be inserted during anchoring other annotations without "breaking"
          // this anchor.
          const textRange = TextRange.fromRange(range);
          anchor = { annotation, target, range: textRange };
        } catch (err) {
          anchor = { annotation, target };
        }
        return anchor;
      };

      /**
     * Highlight the text range that `anchor` refers to.
     *
     * @param {Anchor} anchor
     */
    const highlight = anchor => {
      const range = this.resolveAnchor(anchor);
      if (!range) {
        return;
      }

      const highlights = /** @type {AnnotationHighlight[]} */ (
        highlightRange(range)
      );
      highlights.forEach(h => {
        h._annotation = anchor.annotation;
      });
      anchor.highlights = highlights;

      if (this._focusedAnnotations.has(anchor.annotation.$tag)) {
        setHighlightsFocused(highlights, true);
      }
    };

    // Remove existing anchors for this annotation.
    this.detach(annotation.$tag, false /* notify */);

    this._annotations.add(annotation.$tag);

    // Resolve selectors to ranges and insert highlights.
    if (!annotation.target) {
      annotation.target = [];
    }
    const anchors = await Promise.all(annotation.target.map(locate));

    // If the annotation was removed while anchoring, don't save the anchors.
    if (!this._annotations.has(annotation.$tag)) {
      return [];
    }

    for (let anchor of anchors) {
      highlight(anchor);
    }

    // Set flag indicating whether anchoring succeeded. For each target,
    // anchoring is successful either if there are no selectors (ie. this is a
    // Page Note) or we successfully resolved the selectors to a range.
    annotation.$orphan =
      anchors.length > 0 &&
      anchors.every(anchor => anchor.target.selector && !anchor.range);

    this.anchors = this.anchors.concat(anchors);

     console.log(locate);
     console.log(annotation)

    return anchors;

    },
    /**
   * Remove the anchors and associated highlights for an annotation from the document.
   *
   * @param {string} tag
   * @param {boolean} [notify] - For internal use. Whether to inform the host
   *   frame about the removal of an anchor.
   */
  detach(tag, notify = true) {
    this._annotations.delete(tag);

    /** @type {Anchor[]} */
    const anchors = [];
    for (let anchor of this.anchors) {
      if (anchor.annotation.$tag !== tag) {
        anchors.push(anchor);
      } else if (anchor.highlights) {
        removeHighlights(anchor.highlights);
      }
    }
    this.anchors = anchors;
  },

    /**
 * Resolve an anchor's associated document region to a concrete `Range`.
 *
 * This may fail if anchoring failed or if the document has been mutated since
 * the anchor was created in a way that invalidates the anchor.
 *
 * @param {Anchor} anchor
 * @return {Range|null}
 */
resolveAnchor(anchor) {
  if (!anchor.range) {
    return null;
  }
  try {
    return anchor.range.toRange();
  } catch {
    return null;
  }
}

  }
}
</script>

<style scoped>

</style>