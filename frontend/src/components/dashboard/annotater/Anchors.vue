<template>
</template>

<script>
import {isNodeInRange} from "../../../assets/anchoring/range-util";
import {isInPlaceholder} from "../../../assets/anchoring/placeholder";

export default {
  name: "Anchors",
  props: ['document_id'],
  data: function() {
    return {
    }
  },
  mounted() {
    this.anchors.map(this.highlight);
  },
  computed: {
    anchors() { return this.$store.getters['anno/getAnchors'](this.document_id) },
  },
  watch: {
    anchors (newVal, oldVal) {
      //TODO this same concept need to be done at adding annotation in Annotater.vue
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
        const range = this.resolveAnchor(anchor);
        if (!range) {
          return;
        }

        const highlights = /** @type {AnnotationHighlight[]} */ (
          this.highlightRange(range)
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
    highlightRange(range) {
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
        const highlightEl = document.createElement('span');
        highlightEl.className = "highlight";

        const parent = /** @type {Node} */ (nodes[0].parentNode);
        parent.replaceChild(highlightEl, nodes[0]);
        nodes.forEach(node => highlightEl.appendChild(node));

        highlights.push(highlightEl);
      });

      return highlights;

    },
    resolveAnchor(anchor) {
      if (!anchor.range) {
        return null;
      }
      try {
        return anchor.range.toRange();
      } catch {
        return null;
      }
    },
    replaceWith(node, replacements) {
      const parent = /** @type {Node} */ (node.parentNode);
      replacements.forEach(r => parent.insertBefore(r, node));
      node.remove();
    },
    removeHighlights(highlights) {
      for (let h of highlights) {
        if (h.parentNode) {
          const children = Array.from(h.childNodes);
          this.replaceWith(h, children);
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

<style scoped>
  .highlight {
    position: absolute;
    width: 1px;
    height: 1px;
    white-space: nowrap;
    clip: rect(0 0 0 0);
    overflow: hidden;
    background: rgba(0,0,255,.2);
    cursor: pointer;
  }
 .is-transparent {
    background-color: transparent !important;
  }
  .svg-highlight {
    fill: rgba(255,255,60,.4);
  }
 .is-opaque {
    fill: yellow;
  }
  .is-focused {
    fill: rgba(255,255,240,.4);
  }




</style>