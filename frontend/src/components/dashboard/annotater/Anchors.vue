<template>

</template>

<script>
import {
  highlightRange, removeHighlights,
  setHighlightsFocused
} from "../../../../../frameworks/hypothesis/client/src/annotator/highlighter";

export default {
  name: "Anchors",
  props: ['document_id'],
  computed: {
    anchors() { return this.$store.getters['anno/getAnchors'](this.document_id) },
  },
  watch: {
    anchors (newVal, oldVal) {
      //Remove highlights of deleted anchors
      oldVal.filter(anchor => !newVal.includes(anchor))
          .filter(anchor => 'highlights' in anchor)
          .map(anchor => removeHighlights(anchor.highlights))

      newVal.filter(anchor => !oldVal.includes(anchor))
          .map(this.highlight)

    }
  },
  methods: {
    highlight(anchors) {

      console.log("Highlight");
      console.log(anchors);


      const highlight_it = anchor => {
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

      /*if (this._focusedAnnotations.has(anchor.annotation.$tag)) {
        setHighlightsFocused(highlights, true);
      }*/
    };

      for (let anchor of anchors) {
      highlight_it(anchor);
    }

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
    }
  }
}
</script>

<style scoped>

</style>