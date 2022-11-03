<template>
</template>

<script>
/* Highlights.vue - highlights of the annotation in pdf document

This component creates the highlights of all the annotations inside the pdf document

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import {isNodeInRange} from "../../../assets/anchoring/range-util";
import {isInPlaceholder} from "../../../assets/anchoring/placeholder";
import {resolveAnchor} from "../../../assets/anchoring/resolveAnchor";

export default {
  name: "Highlights",
  props: ['document_id', 'page_id'],
  data: function () {
    return {}
  },
  mounted() {
    this.anchors.map(this.highlight);
  },
  computed: {
    anchors() {
      return this.$store.getters['anno/getAnchors'](this.document_id, this.page_id)
    },
    tagToColorMap() {
      let tags = this.$store.getters['tag/getAllTags'](false);

      if (tags === null || tags === undefined) {
        tags = []; //will default to the undefined color for all
      }

      //TODO when actual color codes are stored, use these. For now convert badge types to colors
      return tid => {
        const t = tags.find(t => t.id === tid);

        if (t === undefined) {
          return "efea7b";
        }

        switch (t.colorCode) {
          case "success":
            return "009933";
          case "danger":
            return "e05f5f";
          case "info":
            return "5fe0df";
          case "dark":
            return "c8c8c8";
          case "warning":
            return "eed042";
          case "secondary":
            return "4290ee";
          default:
            return "4c86f7";
        }
      }
    },
  },
  watch: {
    anchors(newVal, oldVal) {
      //Remove highlights of deleted anchors
      oldVal.filter(anchor => !newVal.includes(anchor))
          .forEach(anchors => anchors.filter(anchor => "highlights" in anchor)
              .forEach(anchor => this.removeHighlights(anchor.highlights)))

      newVal.filter(anchor => !oldVal.includes(anchor))
          .map(this.highlight)
    }
  },
  methods: {
    highlight(anchors) {
      const highlight_it = anchor => {
        const range = resolveAnchor(anchor);

        if (!range) {
          return;
        }

        const highlights = /** @type {AnnotationHighlight[]} */ (
            this.highlightRange(anchor, range)
        );

        highlights.forEach(h => {
          h._annotation = anchor.annotation;
        });
        anchor.highlights = highlights;

        /*if (this._focusedAnnotations.has(anchor.annotation.$tag)) {
          setHighlightsFocused(highlights, true);
        }*/
      };

      for (let anchor of anchors) {
        highlight_it(anchor);
      }

    },
    update_highlights(anchors) {
      anchors.filter(a => a.highlights !== null && a.highlights !== undefined)
          .forEach(a => this.removeHighlights(a.highlights));
      this.highlight(anchors);
    },
    highlightRange(anchor, range) {
      const textNodes = this.wholeTextNodesInRange(range);

      // Check if this range refers to a placeholder for not-yet-rendered content in
      // a PDF. These highlights should be invisible.
      const inPlaceholder = textNodes.length > 0 && isInPlaceholder(textNodes[0]);

      // Group text nodes into spans of adjacent nodes. If a group of text nodes are
      // adjacent, we only need to create one highlight element for the group.
      let textNodeSpans = /** @type {Text[][]} */ ([]);
      let prevNode = /** @type {Node|null} */ (null);
      let currentSpan = null;

      textNodes.forEach(node => {
        if (prevNode && prevNode.nextSibling === node) {
          currentSpan.push(node);
        } else {
          currentSpan = [node];
          textNodeSpans.push(currentSpan);
        }
        prevNode = node;
      });

      // Filter out text node spans that consist only of white space. This avoids
      // inserting highlight elements in places that can only contain a restricted
      // subset of nodes such as table rows and lists.
      const whitespace = /^\s*$/;
      textNodeSpans = textNodeSpans.filter(span =>
          // Check for at least one text node with non-space content.
          span.some(node => !whitespace.test(node.data))
      );

      // Wrap each text node span with a `<hypothesis-highlight>` element.
      const highlights = /** @type {HighlightElement[]} */ ([]);
      textNodeSpans.forEach(nodes => {
        // A custom element name is used here rather than `<span>` to reduce the
        // likelihood of highlights being hidden by page styling.

        /** @type {HighlightElement} */
        const highlightEl = document.createElement('highlight');
        highlightEl.className = "highlight";

        highlightEl.addEventListener('click', () => {
          this.eventBus.emit('sidebarScroll', anchor.annotation.id);
        });

        const parent = /** @type {Node} */ (nodes[0].parentNode);
        parent.replaceChild(highlightEl, nodes[0]);
        nodes.forEach(node => highlightEl.appendChild(node));

        highlights.push(highlightEl);
      });

      if (!inPlaceholder) {
        this.drawHighlightsAbovePdfCanvas(highlights, anchor);
      }

      return highlights;

    },
    setSVGHighlightColor(anchor, highlightEl) {
      if (!anchor.annotation || !anchor.annotation.tags) {
        return;
      }

      // load tags
      const tags = anchor.annotation.tags;

      if (tags.length === 0) {
        highlightEl.style.fill = "#" + this.tagToColorMap(null);
      } else {
        // set style depending on first tag
        highlightEl.style.fill = "#" + this.tagToColorMap(tags[0]);
      }

      highlightEl.style.opacity = 0.6;
    },
    drawHighlightsAbovePdfCanvas(highlightEls, anchor) {
      if (highlightEls.length === 0) {
        return;
      }

      // Get the <canvas> for the PDF page containing the highlight. We assume all
      // the highlights are on the same page.
      const pageEl = highlightEls[0].closest('.pageContainer');
      if (!pageEl) {
        return null;
      }

      const canvasEl = pageEl.querySelector('.canvasWrapper > canvas');
      if (!canvasEl || !canvasEl.parentElement) {
        return;
      }

      /** @type {SVGElement|null} */
      let svgHighlightLayer = canvasEl.parentElement.querySelector(
          '.hypothesis-highlight-layer'
      );

      const isCssBlendSupported = CSS.supports('mix-blend-mode', 'multiply');

      if (!svgHighlightLayer) {
        // Create SVG layer. This must be in the same stacking context as
        // the canvas so that CSS `mix-blend-mode` can be used to control how SVG
        // content blends with the canvas below.
        svgHighlightLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgHighlightLayer.setAttribute('class', 'highlight-layer');
        canvasEl.parentElement.appendChild(svgHighlightLayer);

        // Overlay SVG layer above canvas.
        canvasEl.parentElement.style.position = 'relative';

        const svgStyle = svgHighlightLayer.style;
        svgStyle.position = 'absolute';
        svgStyle.left = '0';
        svgStyle.top = '0';
        svgStyle.width = '100%';
        svgStyle.height = '100%';

        if (isCssBlendSupported) {
          // Use multiply blending so that highlights drawn on top of text darken it
          // rather than making it lighter. This improves contrast and thus readability
          // of highlighted text, especially for overlapping highlights.
          //
          // This choice optimizes for the common case of dark text on a light background.
          svgStyle.mixBlendMode = 'multiply';
        } else {
          // For older browsers (eg. Edge < 79) we draw all the highlights as
          // opaque and then make the entire highlight layer transparent. This means
          // that there is no visual indication of whether text has one or multiple
          // highlights, but it preserves readability.
          svgStyle.opacity = '0.3';
        }
      }

      const canvasRect = canvasEl.getBoundingClientRect();
      const highlightRects = highlightEls.map(highlightEl => {
        const highlightRect = highlightEl.getBoundingClientRect();

        // Create SVG element for the current highlight element.
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', (highlightRect.left - canvasRect.left).toString());
        rect.setAttribute('y', (highlightRect.top - canvasRect.top).toString());
        rect.setAttribute('width', highlightRect.width.toString());
        rect.setAttribute('height', highlightRect.height.toString());

        if (isCssBlendSupported) {
          rect.setAttribute('class', 'svg-highlight');
        } else {
          rect.setAttribute('class', 'svg-highlight is-opaque');
        }

        // Make the highlight in the text layer transparent.
        highlightEl.classList.add('is-transparent');

        // Associate SVG element with highlight for use by `setHighlightsFocusedhlights`.
        highlightEl.svgHighlight = rect;

        this.setSVGHighlightColor(anchor, highlightEl.svgHighlight);

        return rect;
      });

      svgHighlightLayer.append(...highlightRects);
    },
    removeAllHighlights(root) {
      const highlights = Array.from(root.querySelectorAll('highlight'));
      this.removeHighlights(highlights);
    },
    removeHighlights(highlights) {
      for (let h of highlights) {
        if (h.parentNode) {
          const children = Array.from(h.childNodes);
          const parent = /** @type {Node} */ (h.parentNode);
          children.forEach(r => parent.insertBefore(r, h));
          h.remove();
        }

        if (h.svgHighlight) {
          h.svgHighlight.remove();
        }
      }
    },
    /**
     * Return text nodes which are entirely inside `range`.
     *
     * If a range starts or ends part-way through a text node, the node is split
     * and the part inside the range is returned.
     *
     * @param {Range} range
     * @return {Text[]}
     */
    wholeTextNodesInRange(range) {
      if (range.collapsed) {
        // Exit early for an empty range to avoid an edge case that breaks the algorithm
        // below. Splitting a text node at the start of an empty range can leave the
        // range ending in the left part rather than the right part.
        return [];
      }

      /** @type {Node|null} */
      let root = range.commonAncestorContainer;
      if (root.nodeType !== Node.ELEMENT_NODE) {
        // If the common ancestor is not an element, set it to the parent element to
        // ensure that the loop below visits any text nodes generated by splitting
        // the common ancestor.
        //
        // Note that `parentElement` may be `null`.
        root = root.parentElement;
      }
      if (!root) {
        // If there is no root element then we won't be able to insert highlights,
        // so exit here.
        return [];
      }

      const textNodes = [];
      const nodeIter = /** @type {Document} */ (
          root.ownerDocument
      ).createNodeIterator(
          root,
          NodeFilter.SHOW_TEXT // Only return `Text` nodes.
      );
      let node;
      while ((node = nodeIter.nextNode())) {
        if (!isNodeInRange(range, node)) {
          continue;
        }
        let text = /** @type {Text} */ (node);

        if (text === range.startContainer && range.startOffset > 0) {
          // Split `text` where the range starts. The split will create a new `Text`
          // node which will be in the range and will be visited in the next loop iteration.
          text.splitText(range.startOffset);
          continue;
        }

        if (text === range.endContainer && range.endOffset < text.data.length) {
          // Split `text` where the range ends, leaving it as the part in the range.
          text.splitText(range.endOffset);
        }

        textNodes.push(text);
      }

      return textNodes;
    }
  }
}
</script>

<style>
.svg-highlight {
  fill: transparent;
}

.svg-highlight {
  fill: rgba(255, 255, 60, 0.4);
}

.svg-highlight.is-opaque {
  fill: yellow;
}

.svg-highlight.is-focused {
  opacity: 1 !important;
}

.highlight {
  cursor: pointer;
}

.highlight.is-transparent {
  background-color: transparent;
}

.highlight::before {
  position: absolute;
  width: 1px;
  height: 1px;
  white-space: nowrap;
  clip: rect(0 0 0 0);
  overflow: hidden;
  content: ' annotation start ';
}

.highlight::after {
  position: absolute;
  width: 1px;
  height: 1px;
  white-space: nowrap;
  clip: rect(0 0 0 0);
  overflow: hidden;
  content: ' annotation end ';
}

.highlight.highlight {
  background-color: rgba(51, 54, 75, 0.4);
}

.highlight.highlight.is-transparent {
  background-color: transparent;
}

.highlight.highlight.highlight {
  background-color: transparent;
}

.highlight.highlight.highlight-focus {
  background-color: rgba(156, 230, 255, 0.5) !important;
}

.highlight.highlight.highlight-focus.highlight {
  background-color: transparent !important;
}
</style>