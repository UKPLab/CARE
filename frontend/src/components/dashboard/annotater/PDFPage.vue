<template>

</template>

<script>
export default {
  name: "PDFPage",
  props: ['page', 'scale'],

  render(h) {
    const {canvasAttrs: attrs} = this;
    return h('canvas', {attrs});
  },
  created() {
    // PDFPageProxy#getViewport
    // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
    this.viewport = this.page.getViewport(this.scale);
  },

  computed: {
    canvasAttrs() {
      let {width, height} = this.viewport;
      [width, height] = [width, height].map(dim => Math.ceil(dim));

      const style = this.canvasStyle;

      return {
        width,
        height,
        style,
        class: 'pdf-page',
      };
    },

    canvasStyle() {
      const {width: actualSizeWidth, height: actualSizeHeight} = this.actualSizeViewport;
      const pixelRatio = window.devicePixelRatio || 1;
      const [pixelWidth, pixelHeight] = [actualSizeWidth, actualSizeHeight]
          .map(dim => Math.ceil(dim / pixelRatio));
      return `width: ${pixelWidth}px; height: ${pixelHeight}px;`
    },

    actualSizeViewport() {
      return this.viewport.clone({scale: this.scale});
    },
    //...
  },
  mounted() {
    this.drawPage();
  },

  methods: {
    drawPage() {
      if (this.renderTask) return;

      const {viewport} = this;
      const canvasContext = this.$el.getContext('2d');
      const renderContext = {canvasContext, viewport};

      // PDFPageProxy#render
      // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
      this.renderTask = this.page.render(renderContext);
      this.renderTask.
        then(() => this.$emit('rendered', this.page));
    },
    // ...
  },
  beforeDestroy() {
    this.destroyPage(this.page);
  },

  methods: {
    drawPage() {
      // ...
      this.renderTask.
        then(/* */).
        catch(this.destroyRenderTask);
    },

    destroyPage(page) {
      if (!page) return;

      // PDFPageProxy#_destroy
      // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
      page._destroy();

      // RenderTask#cancel
      // https://mozilla.github.io/pdf.js/api/draft/RenderTask.html
      if (this.renderTask) this.renderTask.cancel();
    },

    destroyRenderTask() {
      if (!this.renderTask) return;

      // RenderTask#cancel
      // https://mozilla.github.io/pdf.js/api/draft/RenderTask.html
      this.renderTask.cancel();
      delete this.renderTask;
    },
  },

  watch: {
    page(page, oldPage) {
      this.destroyPage(oldPage);
    },
  },
}


</script>

<style scoped>

</style>