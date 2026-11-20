<template>
  <PDFSelectionMenu
      ref="menu"
      :visible="isVisible"
      :read-only="readOnly"
      :has-ai-chat="hasAiChat"
      :document-id="documentId"
      :study-session-id="studySessionId"
      :study-step-id="studyStepId"
      :tag-set-id="tagSetId"
      :tags="assignableTags"
      @ask-ai="askAi"
      @select="annotate"
  />
</template>

<script>
/**
 * Add new annotations
 *
 * This components handles the range selector and the button to add new annotations.
 *
 * @author Dennis Zyska, Nils Dycke, Jannik Holmer
 */
import {getPDFTextLayerForRange, describePDFRange} from "@/assets/pdfViewer/anchor.js";
import { resolveApiMessage } from "@/assets/utils";
import PDFSelectionMenu from "./PDFSelectionMenu.vue";

export default {
  name: "PDFAdder",
  components: { PDFSelectionMenu },
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
    currentStudyStep: {
      type: Object,
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
  props: {
    readOnly: {type: Boolean, required: false, default: false},
  },
  data() {
    return {
      isVisible: false,
      selectedRanges: [],
      previousRanges: [],
      pendingCallback: null,
      dragThreshold: 5,
      isDoubleClick: false,
      startX: 0, 
      startY: 0,
    }
  },
  computed: {
    defaultTagSet() {
      return parseInt(this.$store.getters["settings/getValue"]("tags.tagSet.default"));
    },
    assignableTags() {
        return this.$store.getters["table/tag/getFiltered"](e => e.tagSetId === this.tagSetId && !e.deleted);
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
    tagSetId() {
      if (this.study?.tagSetId) {
        return this.study.tagSetId;
      } else {
        return this.defaultTagSet;
      }
    },

    anonymize() {
      if (!this.study) {
        return false;
      }
      return this.study.anonymize;
    },
    hasAiChat() {
      const services = this.currentStudyStep?.configuration?.services || [];
      return services.some((service) => service.type === "aiChat");
    }

  },
  watch: {
    readOnly(readOnly) {
      this._onClearSelection();
      if (!readOnly) this.$nextTick(this.checkOverflow);
    },
  },
  created() {
    document.body.addEventListener('mouseup', this.checkSelection);
    document.body.addEventListener('dblclick', this.doubleClickHandler);
    document.body.addEventListener('mousedown', this.positionTracker);
  },
  mounted() {
    // check if the tagsets will make the adder overflow 
    this.checkOverflow();
    document.body.addEventListener('resize', this.checkOverflow);
  },
  beforeUnmount() {
    clearTimeout(this.pendingCallback);
    document.body.removeEventListener('mouseup', this.checkSelection);
    document.body.removeEventListener('dblclick', this.doubleClickHandler);
    document.body.removeEventListener('mousedown', this.positionTracker);
    document.body.removeEventListener('resize', this.checkOverflow);
  },
  methods: {
    checkOverflow() { this.$refs.menu?.checkOverflow(); },
    show(x, y) { this.$refs.menu?.show(x, y); this.isVisible = true; },
    getTextLayerForRange(range) { return getPDFTextLayerForRange(range, this.$el.closest(".has-transparent-text-layer")); },
    describe(root, range) { return describePDFRange(this.pdf, root, range, this.$el.closest(".has-transparent-text-layer")); },
    doubleClickHandler() {
      this.isDoubleClick = true;
    },
    positionTracker(event) {
      //tracks the start position when the user presses down left click and possibly starts a selection
      if (event.button === 0) {
        this.isDoubleClick =false;
        this.startX = event.clientX;
        this.startY = event.clientY;
      }
    },
    checkSelection(event) {
      // stop any default behavior like the Edge built-in mini-menu 
      // which can visually block our Annotations Adder
      if (!this.readOnly) this.stopDefaultOnSelection(event);

      // cancel pending callbacks
      if (this.pendingCallback) {
        clearTimeout(this.pendingCallback);
        this.pendingCallback = null;
      }

      const context = this.studyContext();
      // delay for having the right data
      this.pendingCallback = setTimeout(() => {        
        this._onSelection(event, context);
      }, 10);
    },
    stopDefaultOnSelection(event) {
      // check if the mouseup event came from a left click 
      // and if something has been selected 
      const isLeftClick = event.button === 0;
      const selection = document.getSelection();
      if (!this.$el.closest(".has-transparent-text-layer")?.contains(selection?.anchorNode)) return;

      //if not a doubleClick, check if the distance the selection was dragged
      let distanceMoved = 0;
      if (!this.isDoubleClick) {
        distanceMoved = Math.sqrt(Math.pow(event.clientX - this.startX, 2 ) + Math.pow(event.clientY - this.startY, 2));
      }

      //decide if it is a selection and then block the default behavior
      //clear the selection on left click without dragging or double clicking  
      const isSelection = (selection && (this.isDoubleClick || distanceMoved > this.dragThreshold))
      if (isLeftClick && isSelection) {
        event.preventDefault();
      }
    },
    async annotate(tag) {
      const ranges = this.selectedRanges;
      this.selectedRanges = [];

      const rangeSelectors = await Promise.all(
          ranges.map(range => this.describe(document.getElementById('pdfContainer-' + this.documentId), range))
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
            title: this.$t('errors.annotator.annotationUpdateFailed'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });

      this.isVisible = false;
      document.getSelection()?.removeAllRanges();
    },
    /**
     * Emits the current selection to this study step's AI chat.
     *
     * @returns {Promise<void>}
     */
    async askAi() {
      const text = this.selectedRanges.map((range) => range.toString()).join(" ").trim();
      if (!text) return;
      const quote = {
        text,
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
      };
      this.eventBus.emit("aiChatQuote", quote);
      this.eventBus.emit("toast", {
        title: this.$t("ai.chat.quotedTitle"),
        message: this.$t("ai.chat.quotedMessage"),
        variant: "success",
      });
      this._onClearSelection();
      document.getSelection()?.removeAllRanges();
    },
    async _onSelection(event, context = this.studyContext()) {
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
      } catch (_error) {
        this._onClearSelection();
        return;
      }

      if (!this.readOnly && this.assignableTags.length === 0) {
        this.eventBus.emit('toast', {
          title: this.$t('errors.tags.emptyTagset.title'),
          message: this.$t('errors.tags.emptyTagset.message'),
          variant: "danger"
        });

        this._onClearSelection();
        return;
      }

      this.selectedRanges = [range];
      if (!this.readOnly && (!this.isVisible || !this.areRangesEqual(this.selectedRanges[0], this.previousRanges[0]))) {
        this.show(event.clientX, event.clientY);
      }
      this.previousRanges = [range];
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "onTextSelect",
          data: {
            ...context,
            eventClientX: event.clientX, eventClientY: event.clientY,
            text: range.toString(),
          }
        });
      }

    },
    /** Captures the study context before the selection delay. */
    studyContext() {
      return {
        documentId: this.documentId, studySessionId: this.studySessionId, studyStepId: this.studyStepId,
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
      };
    },
    areRangesEqual(range1, range2) {
      return (
        range1.startContainer === range2.startContainer &&
        range1.startOffset === range2.startOffset &&
        range1.endContainer === range2.endContainer &&
        range1.endOffset === range2.endOffset
      );
    },
    _onClearSelection() {
      this.isVisible = false;
      this.selectedRanges = [];
    },
  }
}
</script>
