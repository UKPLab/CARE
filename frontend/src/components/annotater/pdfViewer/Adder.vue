<template>
  <div id="adder" :style="{visibility: isVisible ? 'visible':'hidden'}">
    <div class="btn-group">
      <button v-for="t in assignableTags"
              :key="t.name"
              class="btn"
              data-placement="top"
              data-toggle="tooltip"
              v-bind:title="t.description"
              v-bind:class="`btn-${t.colorCode}`"
              @click="annotate(t)">
        {{ t.name }}
      </button>
    </div>
  </div>
</template>

<script>
/* Adder.vue - add new annotations

This components handles the range selector and the button to add new annotations.

Author: Dennis Zyska (zyska@ukp...)
Co-author: Nils Dycke (dycke@ukp...)
Source: -
*/
import {TextPosition, TextRange} from "../../../assets/anchoring/text-range";
import {TextQuoteAnchor} from '../../../assets/anchoring/types';
import {mapMutations} from "vuex";

export default {
  name: "Adder",
  components: {},
  props: ['document_id', 'pdf'],
  data() {
    return {
      _fadeOutBox: [],
      isVisible: false,
      selectedRanges: [],
      _pendingCallback: null,
    }
  },
  created() {
    document.body.addEventListener('mouseup', this.checkSelection);
  },
  beforeUnmount() {
    document.body.removeEventListener('mouseup', this.checkSelection);
  },
  computed: {
    defaultTagSet() {
      return parseInt(this.$store.getters["settings/getValue"]("tags.tagSet.default"));
    },
    assignableTags() {
      return this.$store.getters["tag/getTags"](this.defaultTagSet);
    },

  },
  methods: {
    ...mapMutations({addAnnotation: "anno/ADD_ANNOTATION"}),

    checkSelection(event) {
      // cancel pending callbacks
      if (this._pendingCallback) {
        clearTimeout(this._pendingCallback);
        this._pendingCallback = null;
      }

      // delay for having the right data
      this._pendingCallback = setTimeout(() => {
        this._onSelection(event);
      }, 10);
    },
    async annotate(tag) {
      const ranges = this.selectedRanges;
      this.selectedRanges = [];

      const rangeSelectors = await Promise.all(
          ranges.map(range => this.describe(document.getElementById('pdfContainer'), range))
      );
      const target = rangeSelectors.map(selectors => ({
        // In the Hypothesis API the field containing the selectors is called
        // `selector`, despite being a list.
        selector: selectors,
      }));

      this.$socket.emit('addAnnotation', {
        documentId: this.document_id,
        selectors: {target},
        tag: tag.id
      });

      this.isVisible = false;
      document.getSelection()?.removeAllRanges();
    },
    async _onSelection(event) {
      if (this.assignableTags.length === 0) {
        this.eventBus.emit('toast', {
          title: "Empty Tagset",
          message: "No tagset or an empty tagset have been selected. Cannot make annotations.",
          variant: "danger"
        });

        this._onClearSelection();
        return;
      }

      // get selection
      const selection = /** @type {Selection} */ (document.getSelection());
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        // selection doesn't contain any text
        this._onClearSelection();
        return;
      }

      // get range of selection
      const range = selection.getRangeAt(0);
      if (range.collapsed) {
        this._onClearSelection();
        return;
      }

      // check if text exists at all
      try {
        this.getTextLayerForRange(range);
      } catch {
        this._onClearSelection();
        return;
      }

      this.selectedRanges = [range];

      this.show(event.clientX, event.clientY);
      this.$socket.emit("stats", {
        action: "onTextSelect",
        data: {document_id: this.document_id, eventClientX: event.clientX, eventClientY: event.clientY}
      });

    },
    _onClearSelection() {
      this.isVisible = false;
      this.selectedRanges = [];
    },
    show(x, y) {

      // get size of the box
      const adder = /** @type {Element} */ (document.getElementById("adder"));
      const width = adder.getBoundingClientRect().width;
      const height = adder.getBoundingClientRect().height;

      // calculate position of adder
      x = x + 10;
      y = y - (40 + height);

      // get max z index
      const maxZIndex = Math.max(
          ...Array.from(document.querySelectorAll('body *'), el =>
              parseFloat(window.getComputedStyle(el).zIndex),
          ).filter(zIndex => !Number.isNaN(zIndex)),
          0,
      );

      // move to position
      Object.assign(document.getElementById("adder").style, {
        left: x.toString() + 'px',
        top: y.toString() + 'px',
        zIndex: maxZIndex + 1,
      });

      // generate fadeOut Box where the adder is faded out when the mouse is outside of the box
      // parameter: min_x, min_y, max_x, max_y
      const additional_size_of_box = 50;
      this._fadeOutBox = [
        x - additional_size_of_box,
        y - additional_size_of_box,
        x + width + additional_size_of_box,
        y + height + additional_size_of_box + 40
      ]

      document.body.addEventListener('mousemove', this.fadeOut);

      this.isVisible = true;
    },
    fadeOut(event) {
      if (event.clientX < this._fadeOutBox[0] || event.clientX > this._fadeOutBox[2]
          || event.clientY < this._fadeOutBox[1] || event.clientY > this._fadeOutBox[3]) {
        document.body.removeEventListener('mousemove', this.fadeOut);
        this.isVisible = false;
      }
    },
    getNodeTextLayer(node) {
      const el = 'closest' in node ? node : node.parentElement;
      return el?.closest('.textLayer') ?? null;
    },
    getTextLayerForRange(range) {
      if ("classList" in range.endContainer && range.endContainer.classList.contains("canvasWrapper")) {
        throw new Error('I\'m afraid we are not on the same page');
      }
      // "Shrink" the range so that the start and endpoints are at offsets within
      // text nodes rather than any containing nodes.
      try {
        range = TextRange.fromRange(range).toRange();
      } catch {
        throw new Error('Selection does not contain text');
      }

      const startTextLayer = this.getNodeTextLayer(range.startContainer);
      const endTextLayer = this.getNodeTextLayer(range.endContainer);

      if (!startTextLayer || !endTextLayer) {
        throw new Error('Selection is outside page text');
      }

      if (startTextLayer !== endTextLayer) {
        throw new Error('Selecting across page breaks is not supported');
      }
      const pageStart = parseInt(startTextLayer.id.match("[0-9]+")[0]);

      return [range, startTextLayer, pageStart];


    },
    /**
     * Convert a DOM Range object into a set of selectors.
     *
     * Converts a DOM `Range` object into a `[position, quote]` tuple of selectors
     * which can be saved with an annotation and later passed to `anchor` to
     * convert the selectors back to a `Range`.
     *
     * @param {HTMLElement} root - The root element
     * @param {Range} range
     * @return {Promise<Selector[]>}
     */ async describe(root, range) {

      const [textRange, textLayer, page] = this.getTextLayerForRange(range);

      const startPos = TextPosition.fromPoint(
          textRange.startContainer,
          textRange.startOffset
      ).relativeTo(textLayer);

      const endPos = TextPosition.fromPoint(
          textRange.endContainer,
          textRange.endOffset
      ).relativeTo(textLayer);

      const startPageIndex = this.getSiblingIndex(
          /** @type {Node} */ (textLayer.parentNode)
      );
      const pageOffset = await this.getPageOffset(startPageIndex);

      /** @type {TextPositionSelector} */
      const position = {
        type: 'TextPositionSelector',
        start: pageOffset + startPos.offset,
        end: pageOffset + endPos.offset,
      };

      const quote = TextQuoteAnchor.fromRange(root, textRange).toSelector();
      const pageSelector = {
        type: 'PagePositionSelector',
        number: page,
      }

      return [position, quote, pageSelector];
    },
    getSiblingIndex(node) {
      let index = 0;
      while (node.previousSibling) {
        ++index;
        node = node.previousSibling;
      }
      return index;
    },
    async getPageOffset(pageIndex) {
      let offset = 0;
      for (let i = 0; i < pageIndex; i++) {
        const text = await this.pdf.getPageTextContent(i);
        offset += text.length;
      }
      return offset;
    },

  }
}
</script>

<style scoped>
#adder {
  border-radius: 5px;
  box-shadow: 2px 3px #CCCCCC;
  position: absolute;
  top: 0;
  left: 0;
  padding: 2px;
  background-color: white;
}
</style>