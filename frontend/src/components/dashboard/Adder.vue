<template>
  <div v-show="isVisible" id="adder">
    <BIconPlusSquare @click="annotate" />
  </div>
</template>

<script>
import { BIconPlusSquare } from 'bootstrap-icons-vue';
import { TextRange } from "../../assets/anchoring/text-range";
import { describe } from "../../assets/anchoring/anchoring"
import {mapMutations} from "vuex";
import {Annotation} from "../../data/annotation.js";
import { uuid } from 'vue-uuid';

export default {
  name: "Adder",
  components: { BIconPlusSquare },
  data() {
    return {
      _width: 0,
      _height: 0,
      isVisible: false,
      selectedRanges: [],
      _pendingCallback: null,
    }
  },
  created() {
    document.body.addEventListener('mouseup',this.checkSelection);
  },
  beforeUnmount() {
    document.body.removeEventListener('mouseup', this.checkSelection);
  },
  mounted() {
    this.init();
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
    async annotate() {
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
      };

      //this.$emit("addAnnotation", annotation);
      this.addAnnotation(new Annotation(uuid.v4(), target[0].selector[1].exact, target[0].selector[1].exact,annotation));

      this.isVisible = false;
      document.getSelection()?.removeAllRanges();

    },
    init() {
      const adder = /** @type {Element} */ (document.getElementById("adder"));
      this._width = adder.getBoundingClientRect().width;
      this._height = adder.getBoundingClientRect().height;
    },
    _onSelection(event) {
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
    },
    _onClearSelection() {
      this.isVisible = false;
      this.selectedRanges = [];
    },
    show(x, y) {
      // calculate position
      x += 10;
      y -= 40;
      y -= this._height;

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

      this.isVisible = true;
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
  }
}
</script>

<style scoped>
  #adder {
      border: 1px solid black;
      position: absolute;
      top: 0;
      left: 0;
      padding: 2px;
      background-color: white;
  }
</style>