<template>
  <Loader
      v-if="documentId && documentId === 0"
      :loading="true"
      class="pageLoader"
  />
  <span v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
      <div class="d-flex flex-grow-1 overflow-hidden top-padding">
        <AnnotatorViewport :anchors="anchors" @copy="onCopy" @loaded="pdf = $event"/>
        <AnnotationScrollMarkers :pdf="pdf"/>
        <BasicSidebar
            v-if="!sidebarDisabled"
            ref="basicSidebar"
            :active-side-bar="activeSidebar || ($slots.additionalSidebars ? 'additionalSidebars' : 'annotations')"
            :is-tab-shown="isSidebarTabShown"
            :is-tab-current="isSidebarTabCurrent"
            :is-shown="isShown"  
            :sidebar-configs="sidebarConfigs"
            :show-toggle-button="true"
            :max-sidebar-width="maxSidebarWidth"
            :min-sidebar-width="minSidebarWidth"
            @copy="onCopy"
            @sidebar-action="handleButtonAction"
        >
          <template #annotations>
            <SidebarTemplate icon="pencil-square" :number="stepNumber" :title="$t('annotator.annotations')" :buttons="sidebarButtons">
              <template #content>
                <!-- In a study step that can look back, the step's own tab says so -->
                <CurrentStepNote v-if="stepNumber"/>
                <AnnotationSidebar
                  ref="sidebar"
                  @new-anno-card="changeSideBarView"
                  @scroll-to-comment="scrollToComment"
                />
              </template>
            </SidebarTemplate>
          </template>
          <!-- Pass through all additional slots directly to BasicSidebar -->
          <template v-for="(slot, slotName) in $slots" :key="slotName" #[slotName]>
            <slot v-if="slotName !== 'default'" :name="slotName"/>
          </template>
        </BasicSidebar>
      </div>
    </div>
  </span>
</template>

<script>
/** Annotator Component
 *
 * This parent component provides the annotation view, which
 * currently consists of all elements of the annotator.
 *
 * @author Dennis Zyska, Marina Sakharova
 */
import AnnotatorViewport from "./AnnotatorViewport.vue";
import AnnotationScrollMarkers from "./pdfViewer/AnnotationScrollMarkers.vue";
import AnnotationSidebar from "./sidebar/Sidebar.vue";
import BasicSidebar from "@/basic/Sidebar.vue";
import Loader from "@/basic/Loading.vue";
import {mapMutations} from "vuex";
import {computed} from "vue";
import {exportAnnotationsAndComments} from "@/assets/data";
import {downloadObjectsAs, resolveApiMessage} from "@/assets/utils";
import SidebarTemplate from "@/basic/sidebar/SidebarTemplate.vue";
import CurrentStepNote from "@/components/study/CurrentStepNote.vue";
import {isCurrentStepTab, isLookBackTabShown, lookBackPaneProps} from "@/components/study/helpers/lookBack.js";

export default {
  name: "AnnotatorView",
  subscribeTable: ['tag', 'tag_set', 'user_environment', 'study', 'study_session', 'comment', 'annotation', 'configuration'],
  components: {
    SidebarTemplate,
    CurrentStepNote,
    AnnotatorViewport,
    AnnotationScrollMarkers,
    AnnotationSidebar,
    Loader,
    BasicSidebar,
  },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      readOnly: computed(() => this.readOnly || this.forceReadOnly),
      studyStepId: computed(() => this.studyStepId),
      isStepShown: computed(() => this.isShown),
      showAllDocumentAnnotations: computed(() => this.showDefaultAllAnnotations),
    }
  },
  inject: {
    studySessionId: {default: null},
    readOnly: {default: false},
    currentStudyStep: {default: null},
    acceptStats: {default: () => false},
  },
  props: {
    isShown: {type: Boolean, required: false, default: true},
    sidebarDisabled: {type: Boolean, required: false, default: false},
    // In a study step that can look back: the step's number, shown on its own sidebar tab like on the earlier ones
    stepNumber: {type: Number, required: false, default: null},
    ...lookBackPaneProps,
    documentId: {type: Number, required: false, default: 0},
    studyStepId: {type: Number, required: false, default: null},
  },
  emits: ['update:data'],
  data() {
    return {
      pdf: null,
      downloading: false,
      maxSidebarWidth: 600,
      minSidebarWidth: 250,
    }
  },
  computed: {
    showDefaultAllAnnotations(){
      // From this Annotator's own step, which is not the current step when an earlier step is shown
      return this.$store.getters["table/study_step/get"](this.studyStepId)?.configuration?.settings?.showAllDocumentAnnotations ?? false;
    },
    anchors() {
      return this.annotations.filter(a => a.anchors !== null).flatMap(a => a.anchors).filter(a => a !== undefined);
    },
    showAll() {
      const showAllComments = this.$store.getters['settings/getValue']("annotator.showAllComments");
      return (showAllComments !== undefined && showAllComments);
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
    },
    // check if the setting is on or off
    downloadBeforeStudyClosingAllowed() {
      return this.$store.getters["settings/getValue"]("annotator.download.enabledBeforeStudyClosing") === "true"
    },
    openSessionIds() {
      return this.$store.getters["table/study_session/getAll"].filter(
          session => {
            const study = this.$store.getters["table/study/get"](session.studyId);
            return study && study.closed === null;
          }
      ).map(session => session.id);
    },
    annotations() {
      const annotations = this.$store.getters["table/annotation/getByKey"]('documentId', this.documentId).sort((a, b) => {
        const a_noanchor = a.anchors === null || a.anchors.length === 0;
        const b_noanchor = b.anchors === null || b.anchors.length === 0;

        if (a_noanchor || b_noanchor) {
          return a_noanchor === b_noanchor ? 0 : (a_noanchor ? -1 : 1);
        }

        return (a.anchors[0].target.selector[0].start - b.anchors[0].target.selector[0].start);
      });
      return this.inScope(annotations);
    },
    comments() {
      const comments = this.$store.getters["table/comment/getFiltered"](c =>
          c.documentId === this.documentId
      );
      return this.inScope(comments);
    },
    sidebarButtons() {
      const buttons = [];

      // Study Comments Toggle Button
      if (this.studySessionId === null && this.numStudyComments > 0) {
        buttons.push({
          id: 'toggle-study-comments',
          icon: this.showAll ? 'eye-fill' : 'eye-slash-fill',
          title: this.showAll ? this.$t('annotator.hideStudyComments') : this.$t('annotator.showStudyComments'),
          action: 'toggleStudyComments'
        });
      }

      // NLP Toggle Button
      if (this.nlpEnabled) {
        buttons.push({
          id: 'toggle-nlp',
          icon: 'robot',
          title: this.nlpActive ? this.$t('annotator.deactivateNlpSupport') : this.$t('annotator.activateNlpSupport'),
          color: this.nlpActive ? 'var(--care-nlp-active)' : 'var(--care-nlp-idle)',
          action: 'toggleNlp'
        });
      }

      // Download Button
      if (this.studySessionId && this.studySessionId !== 0) {
        const canDownload = this.annotations.length + this.comments.length > 0 &&
            !this.downloading && this.downloadBeforeStudyClosingAllowed;
        buttons.push({
          id: 'download-annotations',
          icon: 'download',
          title: this.$t('annotator.downloadAnnotations'),
          disabled: !canDownload,
          action: 'downloadAnnotations'
        });
      }

      return buttons;
    },
  },
  watch: {
    studySessionId: "loadDocumentData",
    studyStepId: "loadDocumentData",
    annotations: {handler: "emitData", deep: true},
    comments: {handler: "emitData", deep: true},
  },
  mounted() {
    this.load();
  },
  beforeUnmount() {
    // Leave the room for document updates
    this.$socket.emit("collabUnsubscribe", {documentId: this.documentId});
  },
  methods: {
    /**
     * Keeps annotations or comments of the current study session (or, with showAllDocumentAnnotations, those made
     * outside of studies); outside a study, hides those of still open studies unless their download is allowed.
     * @param {Array<Object>} items - annotations or comments of the document
     * @returns {Array<Object>}
     */
    inScope(items) {
      if (this.studySessionId === null && !(this.downloadBeforeStudyClosingAllowed)) {
        return items.filter(item => !this.openSessionIds.includes(item.studySessionId));
      }
      return !this.showAllDocumentAnnotations
          ? items.filter(item => item.studySessionId === this.studySessionId)
          : items.filter(item => item.studySessionId === null && item.studyStepId === null);
    },
    emitData() {
      this.$emit('update:data', {annotations: this.annotations, comments: this.comments});
    },
    // Methods, not props, so the sidebar gets the same function every time and does not re-render for nothing
    isSidebarTabShown(slotName) {
      return isLookBackTabShown(slotName, this.lookBackTabs, this.shownLookBackStepId, this.ownTabsHidden);
    },
    isSidebarTabCurrent(slotName) {
      return isCurrentStepTab(slotName, this.lookBackTabs);
    },
    scrollToComment(offset) {
      this.$refs.basicSidebar.scrollTo(offset);
    },
    changeSideBarView() {
      if (this.$refs.basicSidebar) {
        this.$refs.basicSidebar.changeView('annotations');
      }
    },
    handleButtonAction({action}) {
      if (['toggleStudyComments', 'toggleNlp', 'downloadAnnotations'].includes(action)) {
        this[action]();
      } else {
        console.warn('Unknown sidebar button action:', action);
      }
    },
    toggleStudyComments() {
      this.setSetting({key: 'annotator.showAllComments', value: !this.showAll});
    },
    ...mapMutations({
      setSetting: "settings/set",
    }),
    toggleNlp() {
      const value = !this.nlpActive;
      this.setSetting({key: 'annotator.nlp.activated', value});
      this.$socket.emit('appSettingSet', {key: 'annotator.nlp.activated', value});
    },
    loadDocumentData() {
      this.$socket.emit("documentGetData", {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId
      });
    },
    load() {
      this.loadDocumentData();

      // Join Room for document updates
      this.$socket.emit("documentSubscribe", {documentId: this.documentId}, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('annotator.documentSubscribeError'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });

      // check for available nlp support (for now hard-coded sentiment analysis)
      if (this.nlpEnabled) {
        this.$socket.emit("serviceCommand", {
          service: "NLPService",
          command: "skillGetConfig",
          data: {name: "sentiment_classification"}
        });
      }
    },
    downloadAnnotations() {
      const annotations = this.annotations.filter(a => a.studySessionId === this.studySessionId);
      const content = exportAnnotationsAndComments(annotations, this.comments,
          (tagId) => this.$store.getters["table/tag/get"](tagId).name);
      downloadObjectsAs(content, `annotations_${this.documentId}_${Date.now()}`, "json");
    },
    onCopy() {
      const selection = window.getSelection();
      const copiedText = selection ? selection.toString() : '';

      if (this.acceptStats && copiedText.trim() !== '') {
        this.$socket.emit("stats", {
          action: "textCopied",
          data: {
            ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep?.id} : {}),
            from: "annotator",
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            copiedText: copiedText,
          }
        });
      }
    }
  }
}
</script>
