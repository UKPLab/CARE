<template>
    <PDFToolbar
      :id="'pdfToolbar-' + documentId"
      v-model="toolbarVisible"
      :zoom-form-data="zoomFormData"
      :pdf-dark-mode="pdfDarkMode"
      @toggle-pdf-theme="togglePdfTheme"
      @update:zoom-form-data="zoomFormData = $event"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @reset="resetZoom"
    />
</template>

<script>
import PDFToolbar from "./PDFToolbar.vue";

/** Owns PDF toolbar zoom state and the reader's persisted theme selection. */
export default {
  name: "PDFViewControls",
  components: {PDFToolbar},
  props: {
    modelValue: {type: Number, default: 1},
    pdfDarkMode: {type: Boolean, required: true},
    documentId: {type: Number, required: true},
  },
  emits: ['update:modelValue', 'update:pdfDarkMode'],
  data() { return {originalScale: null,
DEFAULT_SCALE: 1.0,
MIN_SCALE: 0.25,
MAX_SCALE: 10.0,
DEFAULT_SCALE_DELTA: 1.1,
toolbarVisible: false,
zoomFormData: {
        zoom: 1.0,
      }}; },
  computed: {
    appTheme() {
      return this.$store.getters["settings/getValue"]("app.theme.mode");
    },
    scale: {
      get() { return this.modelValue; },
      set(value) { this.$emit('update:modelValue', value); },
    },
  },
  watch: {
appTheme(newVal, oldVal) {
      if (oldVal === undefined) return;
      this.$emit('update:pdfDarkMode', newVal === "dark");
      localStorage.removeItem("care.pdfDark");
    },
zoomFormData: {
      handler(newZoom) {
        if (this.scale !== newZoom.zoom) {
          this.scale = newZoom.zoom;
        }
      },
      deep: true,
    },
scale(newScale) {
      // Keep form data in sync with scale
      if (this.zoomFormData.zoom !== newScale) {
        this.zoomFormData.zoom = newScale;
      }
    }
  },
  mounted() { this.originalScale = this.scale; this.zoomFormData.zoom = this.scale; },
  methods: {
togglePdfTheme() {
      const dark = !this.pdfDarkMode;
      this.$emit('update:pdfDarkMode', dark);
      localStorage.setItem("care.pdfDark", dark);
    },
zoomIn() {
      let newScale = this.scale * this.DEFAULT_SCALE_DELTA;
      this.scale = Math.min(this.MAX_SCALE, Math.round(newScale * 10) / 10);
    },
zoomOut() {
      let newScale = this.scale / this.DEFAULT_SCALE_DELTA;
      this.scale = Math.max(this.MIN_SCALE, Math.round(newScale * 10) / 10);
    },
resetZoom() {
      this.scale = this.originalScale || this.DEFAULT_SCALE;
    }
  },
};
</script>
