<template>
  <div
      id="adder"
      :style="{visibility: isVisible ? 'visible':'hidden'}"
  >
    <div class="btn-group">
      <button
          v-for="t in assignableTags"
          :key="t.name"
          :class="`btn-${t.colorCode}`"
          :title="t.description"
          class="btn"
          data-placement="top"
          data-toggle="tooltip"
          @click="annotate(t)"
      >
        {{ t.name }}
      </button>
    </div>
  </div>
</template>

<script>
/**
 * Add new annotations
 *
 * This components handles the range selector and the button to add new annotations.
 *
 * @author Dennis Zyska, Nils Dycke
 */
import {TextPosition, TextRange} from "@/assets/anchoring/text-range";
import {TextQuoteAnchor} from '@/assets/anchoring/types';

export default {
  name: "PDFAdder",
  inject: {
    documentId: {
      type: Number,
      required: true,
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
    pdf: {
      type: Object,
      required: true,
    },
    acceptStats: {
      default: () => false
    },
  },
  data() {
    return {
      fadeOutBox: [],
      isVisible: false,
      selectedRanges: [],
      pendingCallback: null,
    }
  },
  computed: {
    defaultTagSet() {
      return parseInt(this.$store.getters["settings/getValue"]("tags.tagSet.default"));
    },
    assignableTags() {
      if (this.defaultTagSet) {
        return this.$store.getters["table/tag/getFiltered"](e => e.tagSetId === this.defaultTagSet && !e.deleted);
      } else {
        return []
      }

    },
    studySession() {
      return this.$store.getters["table/study_session/get"](this.studySessionId);
    },
    study() {
      if (!this.studySession) {
        return null;
      }
      return this.$store.getters["table/study/get"](this.studySession.studyId);
    },
    anonymize() {
      if (!this.study) {
        return false;
      }
      return this.study.anonymize;
    }

  },
  created() {
    document.body.addEventListener('mouseup', this.checkSelection);
  },
  beforeUnmount() {
    document.body.removeEventListener('mouseup', this.checkSelection);
  },
  methods: {
    checkSelection(event) {
      // cancel pending callbacks
      if (this.pendingCallback) {
        clearTimeout(this.pendingCallback);
        this.pendingCallback = null;
      }

      // delay for having the right data
      this.pendingCallback = setTimeout(() => {
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

      this.$socket.emit('annotationUpdate', {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        selectors: {target},
        tagId: tag.id,
        anonymous: this.anonymize,
      }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: "Annotation Update Failed",
            message: res.message,
            variant: "danger",
          });
        }
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
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "onTextSelect",
          data: {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            eventClientX: event.clientX, eventClientY: event.clientY
          }
        });
      }

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
      this.fadeOutBox = [
        x - additional_size_of_box,
        y - additional_size_of_box,
        x + width + additional_size_of_box,
        y + height + additional_size_of_box + 40
      ]

      document.body.addEventListener('mousemove', this.fadeOut);

      this.isVisible = true;
    },
    fadeOut(event) {
      if (event.clientX < this.fadeOutBox[0] || event.clientX > this.fadeOutBox[2]
          || event.clientY < this.fadeOutBox[1] || event.clientY > this.fadeOutBox[3]) {
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

      const pageOffset = await this.getPageOffset(page - 1);

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