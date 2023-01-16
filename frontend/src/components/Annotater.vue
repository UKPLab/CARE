<template>
  <div v-if="document_id !== null" class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
      <div class="col border mh-100 justify-content-center p-3" style="overflow-y: scroll;" id="viewerContainer">
        <PDFViewer :document_id="document_id" :readonly="readonly" ref="pdfViewer" style="margin:auto"
                   class="rounded border border-1 shadow-sm"></PDFViewer>
      </div>
      <div class="col border mh-100  col-sm-auto g-0" style="overflow-y: scroll;" id="sidebarContainer">
        <Sidebar :document_id="document_id" :readonly="readonly"/>
      </div>
    </div>
  </div>

  <Teleport to="#topbarCustomPlaceholder">
    <form class="hstack gap-3 container-fluid justify-content-center">
      <button v-if="review" class="btn btn-outline-success me-2" type="button"
              v-on:click="this.$refs.reviewSubmit.open()">Submit Review
      </button>
      <button v-if="approve" class="btn btn-outline-dark me-2" type="button" v-on:click="this.$refs.report.open()">
        Report
      </button>
      <button v-if="approve" class="btn btn-outline-success me-2" type="button" v-on:click="decisionSubmit(true)">
        Accept
      </button>
      <button v-if="approve" class="btn btn-outline-danger me-2" type="button" v-on:click="decisionSubmit(false)">
        Reject
      </button>
      <button :class="annotations.length  + comments.length > 0 && !downloading ? '' : 'disabled'"
                    class="btn btn-outline-secondary"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded="false"
                    @click="downloadAnnotations('txt')"
                    >
              Download Annotations
      </button>
      <div class="form-check form-switch">
        <input class="form-check-input" type="checkbox" role="switch" :checked="nlp_support" :disabled="!nlp_available" @input="changeNlpSetting()">
        <IconBoostrap name="robot" :disabled="!nlp_support || !nlp_available"/>
     </div>
    </form>
  </Teleport>

  <ReviewSubmit v-if="review" ref="reviewSubmit" :review_id="review_id" :document_id="document_id"></ReviewSubmit>
  <Report v-if="approve" ref="report" :review_id="review_id" :document_id="document_id"
          @decisionSubmit="decisionSubmit"></Report>
  <DecisionSubmit v-if="approve" ref="decisionSubmit" :review_id="review_id"
                  :document_id="document_id"></DecisionSubmit>
  <Export ref="export"></Export>
</template>

<script>
/* Annotator.vue - annotation view

This parent component provides the annotation view, which
currently consists of all elements of the annotator.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import PDFViewer from "./annotater/pdfViewer/PDFViewer.vue";
import Sidebar from "./annotater/sidebar/Sidebar.vue";
import ReviewSubmit from "./annotater/modals/ReviewSubmit.vue"
import Report from "./annotater/modals/Report.vue"
import Loader from "./basic/Loader.vue";
import DecisionSubmit from "./annotater/modals/DecisionSubmit.vue"
import Export from "./basic/Export.vue"
import IconBoostrap from "../icons/IconBootstrap.vue";
import {offsetRelativeTo, scrollElement} from "../assets/anchoring/scroll";
import {isInPlaceholder} from "../assets/anchoring/placeholder";
import {resolveAnchor} from "../assets/anchoring/resolveAnchor";

export default {
  name: "Annotater",
  components: {PDFViewer, Sidebar, ReviewSubmit, Report, DecisionSubmit, Loader, Export, IconBoostrap},
  props: {
    'document_hash': {
      type: String,
      required: true,
    },
    'review_id': {
      type: String,
      required: false,
      default: null
    },
    'readonly': {
      type: Boolean,
      required: false,
      default: false,
    },
    approve: {
      type: Boolean,
      required: false,
      default: false,
    },
    review: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      downloading: false
    }
  },
  computed: {
    anchors() {
      return [].concat(this.$store.getters['anno/getAnchorsFlat'](this.document_id))
    },
    annotations() {
      return this.$store.getters["anno/getAnnotations"](this.document_id);
    },
    comments() {
      return this.$store.getters["comment/getDocumentComments"](this.document_id);
    },
    document_id() {
      return this.$store.getters["user/getDocumentId"](this.document_hash);
    },
    nlp_support() {
      return this.$store.getters["settings/getValue"]("annotator.nlp.activated") === "true";
    },
    nlp_available() {
      return this.$store.getters["nlp/getSkillConfig"]("sentiment_classification") !== null;
    }
  },
  mounted() {
    this.eventBus.on('pdfScroll', (anno_id) => {
      this.scrollTo(anno_id);
      this.$socket.emit("stats", {
        action: "pdfScroll",
        data: {review_id: this.review_id, document_id: this.document_id, anno_id: anno_id}
      });
    });
    this.load();
  },
  unmounted() {
    // Leave the room for document updates
    this.$socket.emit("unsubscribe:document", {doc: this.document_id});
  },
  sockets: {
    connect: function () {
      this.load();
    },
  },
  methods: {
    decisionSubmit(decision) {
      this.$refs.decisionSubmit.open(decision);
    },
    changeNlpSetting(){
      //todo add update logic of settings in store (after merge)
    },
    async scrollTo(annotationId) {
      const annotation = this.$store.getters['anno/getAnnotation'](annotationId)

      if ("anchors" in annotation) {
        const anchor = annotation.anchors[0]
        const range = resolveAnchor(anchor);
        if (!range) {
          return;
        }

        const inPlaceholder = this.anchorIsInPlaceholder(anchor);
        let offset = this._anchorOffset(anchor);
        if (offset === null) {
          return;
        }

        const scrollContainer = document.getElementById('viewerContainer');
        // Correct offset since we have a fixed top
        offset -= 52.5; // see css class padding-top


        // nb. We only compute the scroll offset once at the start of scrolling.
        // This is important as the highlight may be removed from the document during
        // the scroll due to a page transitioning from rendered <-> un-rendered.
        await scrollElement(scrollContainer, offset);

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
          await scrollElement(scrollContainer, offset);
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
        anchor = this.anchors.find(a => a.annotation === annotation);
        if (!anchor || this.anchorIsInPlaceholder(anchor)) {
          anchor = null;

          // If no anchor was found, wait a bit longer and check again to see if
          // re-anchoring completed.
          await this.delay(20);
        }
      } while (!anchor && Date.now() - start < maxWait);
      return anchor ?? null;
    },
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    load() {
      // TODO data should loaded in app for basic settings
      this.$socket.emit("getTagSets");
      this.$socket.emit("getTags");
      this.$socket.emit("getSettings");

      // Join Room for document updates
      this.$socket.emit("subscribe:document", {doc: this.document_id});

      // check for available nlp support (for now hard-coded sentiment analysis)
      if(!this.nlp_available) {
        this.$socket.emit("nlp_skillGetConfig", {name: "sentiment_classification"});
      }
    },
    downloadAnnotations(outputType) {
      this.$refs.export.requestExport([this.document_id], outputType, true);
    }
  }
}
</script>

<style scoped>

#sidebarContainer {
  position: relative;
  padding: 0;
  max-width: 300px;
  min-width: 300px;
}

IconBoostrap:disabled {
  color: lightgrey;
}

</style>
