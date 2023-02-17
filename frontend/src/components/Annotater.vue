<template>
  <Loader v-if="documentId === 0" :loading="true" class="pageLoader"/>
  <span v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <div id="viewerContainer" ref="viewer" class="col border mh-100 justify-content-center p-3"
             style="overflow-y: scroll;">
          <PDFViewer ref="pdfViewer" :document-id="documentId" :readonly="readonly" :study-session-id="studySessionId"
                     class="rounded border border-1 shadow-sm"
                     style="margin:auto"></PDFViewer>
        </div>
        <div id="sidebarContainer" class="col border mh-100  col-sm-auto g-0" style="overflow-y: scroll;">
          <Sidebar :document-id="documentId" :readonly="readonly" :study-session-id="studySessionId"/>
        </div>
      </div>
    </div>

    <Teleport to="#topBarNavItems">
      <li class="nav-item">
        <button v-if="studySessionId === null && numStudyComments > 0" :title="showAll ?  'Hide study comments' : 'Show study comments'"
                class="btn rounded-circle" type="button"
                @click="setSetting({key: 'annotator.showAllComments', value: !showAll})">
          <span class="position-relative translate-middle top-100 start-100 fs-10 fw-light">
            {{ numStudyComments}}
          </span>
          <span>
            <LoadIcon :icon-name="showAll ?  'eye-slash-fill' : 'eye-fill'" :size="18"></LoadIcon>
          </span>
        </button>
      </li>
      <li class="nav-item">
        <button v-if="nlpEnabled" :title="nlpActive ?  'Deactivate NLP support' : 'Activate NLP support'"
                class="btn rounded-circle" type="button"
                @click="toggleNlp">
          <LoadIcon :color="(!nlpActive) ?'#777777':'#097969'" :size="18"
                    icon-name="robot"></LoadIcon>
        </button>
      </li>
      <ExpandMenu class="nav-item"></ExpandMenu>
    </Teleport>

    <Teleport to="#topBarExtendMenuItems">
      <li><a :class="annotations.length + comments.length > 0 && !downloading ? '' : 'disabled'"
             class="dropdown-item" href="#" @click="downloadAnnotations('json')">Download
        Annotations</a></li>
    </Teleport>

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
      </form>
    </Teleport>

    <ExportAnnos ref="export"></ExportAnnos>
  </span>
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
import Loader from "@/basic/Loader.vue";
import ExportAnnos from "@/basic/download/ExportAnnos.vue"
import IconBoostrap from "../icons/IconBootstrap.vue";
import {offsetRelativeTo, scrollElement} from "@/assets/anchoring/scroll";
import {isInPlaceholder} from "@/assets/anchoring/placeholder";
import {resolveAnchor} from "@/assets/anchoring/resolveAnchor";
import debounce from 'lodash.debounce';
import LoadIcon from "@/icons/LoadIcon.vue";
import ExpandMenu from "./navigation/ExpandMenu.vue";
import {mapMutations} from "vuex";


export default {
  name: "Annotater",
  components: {
    LoadIcon,
    PDFViewer,
    ExpandMenu,
    Sidebar,
    Loader,
    ExportAnnos,
    IconBoostrap
  },
  props: {
    'documentId': {
      type: Number,
      required: true
    },
    'review_id': {
      type: String,
      required: false,
      default: null
    },
    'studySessionId': {
      type: Number,
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
      downloading: false,
      logScroll: debounce(function () {
        this.$socket.emit("stats", {
          action: "annotatorScrollActivity",
          data: {
            documentId: this.documentId,
            scrollTop: this.$refs.viewer.scrollTop,
            scrollHeight: this.$refs.viewer.scrollHeight
          }
        })
      }, 500)
    }
  },
  watch: {
    studySessionId(newVal, oldVal) {
      if (oldVal !== newVal) {
        this.$socket.emit("documentGetData", {documentId: this.documentId, studySessionId: this.studySessionId});
      }
    }
  },
  computed: {
    anchors() {
      return [].concat(this.$store.getters['anno/getAnchorsFlat'](this.documentId))
    },
    showAll() {
      const showAllComments = this.$store.getters['settings/getValue']("annotator.showAllComments");
      return (showAllComments !== undefined && showAllComments);
    },
    annotations() {
      return this.$store.getters["anno/getAnnotations"](this.documentId);
    },
    comments() {
      return this.$store.getters["comment/getDocumentComments"](this.documentId);
    },
    nlpActive() {
      const nlpActive = this.$store.getters["settings/getValue"]("annotator.nlp.activated");
      return (nlpActive === true || nlpActive === "true");
    },
    nlpEnabled() {
      return this.$store.getters["settings/getValue"]('service.nlp.enabled') === "true";
    },
    numStudyComments() {
      return this.comments.filter(c => c.studySessionId).length;
    }
  },
  mounted() {
    this.eventBus.on('pdfScroll', (anno_id) => {
      this.scrollTo(anno_id);
      this.$socket.emit("stats", {
        action: "pdfScroll",
        data: {review_id: this.review_id, documentId: this.documentId, anno_id: anno_id}
      });
    });

    // get tagsets
    this.$socket.emit("tagSetGetAll");
    this.$socket.emit("tagGetAll");

    // init component
    this.load();

    // scrolling
    this.$refs.viewer.addEventListener("scroll", this.scrollActivity);
  },
  beforeUnmount() {
    // Leave the room for document updates
    this.$socket.emit("collabUnsubscribe", {documentId: this.documentId});
    this.$refs.viewer.removeEventListener("scroll", this.scrollActivity);
  },
  methods: {
    ...mapMutations({
      setSetting: "settings/set",
    }),
    decisionSubmit(decision) {
      this.$refs.decisionSubmit.open(decision);
    },
    toggleNlp() {
      const newNlpActive = !this.nlpActive;
      this.setSetting({key: "annotator.nlp.activated", value: newNlpActive});
      this.$socket.emit("settingSet", {key: "annotator.nlp.activated", value: newNlpActive});
    },
    scrollActivity() {
      this.logScroll();
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
      if (this.studySessionId === null || (this.studySessionId && this.studySessionId !== 0)) {
        this.$socket.emit("documentGetData", {documentId: this.documentId, studySessionId: this.studySessionId});
      }

      // Join Room for document updates
      this.$socket.emit("documentSubscribe", {documentId: this.documentId});

      // check for available nlp support (for now hard-coded sentiment analysis)
      if (this.nlpEnabled) {
        this.$socket.emit("serviceCommand", {
          service: "NLPService",
          command: "skillGetConfig",
          data: {name: "sentiment_classification"}
        });
      }
    },
    downloadAnnotations(outputType) {
      this.$refs.export.requestExport([this.documentId], outputType, true);
    }
  }
}
</script>

<style scoped>

#sidebarContainer {
  position: relative;
  padding: 0;
  max-width: 400px;
  min-width: 400px;
}

IconBoostrap[disabled] {
  background-color: darkgrey;
}

</style>
