<template>
  <div id="adder">
    <div v-show="isVisible">
      <button type="button" class="btn btn-primary" @click="onAnnotate">
        <BIconPlusSquare />
      </button>
      <button type="button" class="btn btn-primary" @click="onHighlight">
        <BIconPlusSquare />
      </button>
    </div>
  </div>
</template>

<script>
/*
  Source of most of the code: Hypothesis Client ./client/src/annotator/adder.js
 */

import { BIconPlusSquare } from 'bootstrap-icons-vue';
import {SelectionObserver} from "../../../../frameworks/hypothesis/client/src/annotator/selection-observer";
import * as rangeUtil from "../../../../frameworks/hypothesis/client/src/annotator/range-util";
import {TextPosition, TextRange} from "../../../../frameworks/hypothesis/client/src/annotator/anchoring/text-range";
import {generateHexString} from "../../../../frameworks/hypothesis/client/src/shared/random";
import {TextQuoteAnchor} from "../../../../frameworks/hypothesis/client/src/annotator/anchoring/types";
import { describe } from "../../assets/anchoring/anchoring"
import {highlightRange, setHighlightsFocused} from "../../../../frameworks/hypothesis/client/src/annotator/highlighter";

export default {
  name: "Adder",
  components: { BIconPlusSquare },
  data() {
    return {
      _width: 0,
      _height: 0,
      isVisible: false,
      _selectionObserver: null,
      annotationsForSelection: [],
      selectedRanges: [],
    }
  },
  mounted() {
    this.init();
  },
  methods: {


    async createAnnotation({ highlight = false } = {}) {
    const ranges = this.selectedRanges;
    this.selectedRanges = [];

    const rangeSelectors = await Promise.all(
      ranges.map(range => describe(document.body, range))
    );
    const target = rangeSelectors.map(selectors => ({
      // In the Hypothesis API the field containing the selectors is called
      // `selector`, despite being a list.
      selector: selectors,
    }));

    /** @type {AnnotationData} */
    const annotation = {
      target,
      $highlight: highlight,
      $tag: 'a:' + generateHexString(8),
    };

    //this.anchor(annotation);

    this.hide();

    console.log(annotation);

    return annotation;
  },
    async anchor(annotation) {
    /**
     * Resolve an annotation's selectors to a concrete range.
     *
     * @param {Target} target
     * @return {Promise<Anchor>}
     */
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
        const range = await this._integration.anchor(
          this.element,
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
      const range = resolveAnchor(anchor);
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

    this._updateAnchors(this.anchors.concat(anchors), true /* notify */);

    // Let other frames (eg. the sidebar) know about the new annotation.
    this._sidebarRPC.call('syncAnchoringStatus', annotation);

    return anchors;
  },
    onAnnotate() {
      this.createAnnotation();
    },
    onShowAnnotations() {
       console.log("adder onShowAnnotations()")
    },
    onHighlight() {
       console.log("adder onHighlight()")
      this.$emit("highlight");
    },
    init() {
      const adder = /** @type {Element} */ (document.getElementById("adder"));
      this._width = adder.getBoundingClientRect().width;
      this._height = adder.getBoundingClientRect().height;

      this._selectionObserver = new SelectionObserver(range => {
        if (range) {
          this._onSelection(range);
        } else {
          this._onClearSelection();
        }
      });
    },
    _onSelection(range) {

      console.log(range);

      if (!this.canAnnotate(range)) {
        this._onClearSelection();
        return;
      }

      const selection = /** @type {Selection} */ (document.getSelection());
      const isBackwards = rangeUtil.isSelectionBackwards(selection);
      const focusRect = rangeUtil.selectionFocusRect(selection);
      if (!focusRect) {
        // The selected range does not contain any text
        this._onClearSelection();
        return;
      }

      this.selectedRanges = [range];
      console.log(this.selectedRanges);

      this.show(focusRect, isBackwards);
    },
    canAnnotate(range) {
      try {
        this.getTextLayerForRange(range);
        return true;
      } catch {
        return false;
      }
    },
    getNodeTextLayer(node) {
      const el = 'closest' in node ? node : node.parentElement;
      return el?.closest('.textLayer') ?? null;
    },
    getTextLayerForRange(range) {
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

      return [range, startTextLayer];
    },

    _onClearSelection() {
      this.hide();
      this.selectedRanges = [];
    },
    hide() {
      this.isVisible = false;
      Object.assign(document.getElementById("adder").style, {
        top: 0,
        left: 0,
      });
    },
    show(selectionRect, isRTLselection) {
      const { left, top } = this._calculateTarget(
        selectionRect,
        isRTLselection
      );
      this._showAt(left, top);

      this.isVisible = true;
    },
    _calculateTarget(selectionRect, isRTLselection) {
      let top;
      let left;

      if (isRTLselection) {
          left = selectionRect.left - this._width / 2 + selectionRect.width;
      } else {
        left =
          selectionRect.left + selectionRect.width - this._width / 2 - selectionRect.width;
      }

      top = selectionRect.top - this._height;

      // Constrain the adder to the viewport.
      left = Math.max(left, 0);
      left = Math.min(left, window.innerWidth - this._width);

      top = Math.max(top, 0);
      top = Math.min(top, window.innerHeight - this._height);

      return { top, left };

    },
    toPx(pixels) {
      return pixels.toString() + 'px';
    },
    _showAt(left, top) {
      // Translate the (left, top) viewport coordinates into positions relative to
      // the adder's nearest positioned ancestor (NPA).
      //
      // Typically the adder is a child of the `<body>` and the NPA is the root
      // `<html>` element. However page styling may make the `<body>` positioned.
      // See https://github.com/hypothesis/client/issues/487.
      const positionedAncestor = this.nearestPositionedAncestor(document.getElementById("adder"));
      const parentRect = positionedAncestor.getBoundingClientRect();

      const maxZIndex = Math.max(
        ...Array.from(document.querySelectorAll('body *'), el =>
          parseFloat(window.getComputedStyle(el).zIndex),
        ).filter(zIndex => !Number.isNaN(zIndex)),
        0,
      );

      Object.assign(document.getElementById("adder").style, {
        left: this.toPx(left - parentRect.left),
        top: this.toPx(top - parentRect.top),
        zIndex: maxZIndex + 1,
      });
    },
    nearestPositionedAncestor(el) {
      let parentEl = /** @type {Element} */ (el.parentElement);
      while (parentEl.parentElement) {
        if (getComputedStyle(parentEl).position !== 'static') {
          break;
        }
        parentEl = parentEl.parentElement;
      }
      return parentEl;
    }
  }
}
</script>

<style scoped>
  #adder {
      position: absolute;
      top: 0;
      left: 0;
  }
</style>