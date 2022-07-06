<template>
  <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <div class="row flex-shrink-0">
      <div class="col">
        <TopBar id="topbar"></TopBar>
      </div>
    </div>
    <div class="row flex-grow-1 top-padding overflow-hidden" >
      <div class="col border mh-100" style="overflow-y: scroll;">
        <PDFViewer  :document_id="document_id" ref="pdfViewer" ></PDFViewer>
        <!--<Adder :document_id="document_id"></Adder>-->
      </div>
    <div class="col border mh-100 col-sm-2 g-0" style="overflow-y: scroll;">
      <Sidebar :document_id="document_id" :scrollTo="scrollTo" />
     </div>
    </div>


  </div>

  <!--
  <b-container fluid id="annotator" class="overflow-hidden">
    <b-row align-v="stretch">
      <b-col id="docview" class="overflow-scroll">
        <PDFViewer  :document_id="document_id" ref="pdfViewer" ></PDFViewer>
        <Adder :document_id="document_id"></Adder> Test
      </b-col>
      <b-col id="sidebar" cols="sm-auto" class="overflow-scroll">
        <Sidebar :document_id="document_id" :scrollTo="scrollTo" /> Test2
      </b-col>
    </b-row>
  </b-container>
  -->

</template>

<script>
/* Annotator.vue - annotation view

This parent component provides the annotation view, which
currently consists of the PDF viewer.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import PDFViewer from "./pdfViewer/PDFViewer.vue";
import Adder from "./pdfViewer/Adder.vue";
import TopBar from "./topbar/TopBar.vue"
import Sidebar from "./sidebar/Sidebar.vue";
import {offsetRelativeTo, scrollElement} from "../../../assets/anchoring/scroll";
import {isInPlaceholder} from "../../../assets/anchoring/placeholder";
import {resolveAnchor} from "../../../assets/anchoring/resolveAnchor";


export default {
  name: "Annotater2",
  components: {Adder, PDFViewer, Sidebar, TopBar},
  props: ['document_id'],
  data() {
    return {
    }
  },
  methods: {
    async scrollTo(annotationId) {
      const annotation = this.$store.getters['anno/getAnnotation'](annotationId)

      if ("anchors" in annotation) {
        const anchor = annotation.anchors[0]
        const range = resolveAnchor(anchor);
        if (!range) {
          return;
        }

        // Emit a custom event that the host page can respond to. This is useful,
        // for example, if the highlighted content is contained in a collapsible
        // section of the page that needs to be un-collapsed.
        const event = new CustomEvent('scrolltorange', {
          bubbles: true,
          cancelable: true,
          detail: range,
        });
        const defaultNotPrevented = this.$refs.pdfViewer.pdfContainer.dispatchEvent(event);

        if (defaultNotPrevented) {
          const inPlaceholder = this.anchorIsInPlaceholder(anchor);
          const offset = this._anchorOffset(anchor);
          if (offset === null) {
            return;
          }

          // nb. We only compute the scroll offset once at the start of scrolling.
          // This is important as the highlight may be removed from the document during
          // the scroll due to a page transitioning from rendered <-> un-rendered.
          await scrollElement(document.querySelector('#viewerContainer'), offset);

          if (inPlaceholder) {
            const anchor = await this._waitForAnnotationToBeAnchored(
                annotation,
                3000
            );
            if (!anchor) {
              return;
            }
            const offset = this._anchorOffset(anchor);
            if (offset === null) {
              return;
            }
            await scrollElement(document.querySelector('#viewerContainer'), offset);
          }
        }
      }
    },
    anchorIsInPlaceholder(anchor) {
      const highlight = anchor.highlights?.[0];
      return highlight && isInPlaceholder(highlight);
    },
    _anchorOffset(anchor) {
      if (!anchor.highlights) {
        // This anchor was not resolved to a location in the document.
        return null;
      }
      const highlight = anchor.highlights[0];
      return offsetRelativeTo(highlight, document.querySelector('#viewerContainer'));
    },
    async _waitForAnnotationToBeAnchored(annotation, maxWait) {
      const start = Date.now();
      let anchor;
      do {
        // nb. Re-anchoring might result in a different anchor object for the
        // same annotation.
        anchor = this.annotator.anchors.find(a => a.annotation === annotation);
        if (!anchor || this.anchorIsInPlaceholder(anchor)) {
          anchor = null;

          // If no anchor was found, wait a bit longer and check again to see if
          // re-anchoring completed.
          await delay(20);
        }
      } while (!anchor && Date.now() - start < maxWait);
      return anchor ?? null;
    }
  }
}
</script>

<style scoped>
.top-padding {
  padding-top: 52.5px;
}
#sidebar {
  position: relative;
  overflow-y: scroll;
  padding: 0;
  max-width: 300px;
  min-width: 300px;
}

</style>