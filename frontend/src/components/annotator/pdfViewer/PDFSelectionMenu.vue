<template>

  <div
    v-show="!readOnly"
    id="adder"
    ref="adder"
    :style="{visibility: visible ? 'visible':'hidden'}"
    :class="{ 'is-extended': isExtended }"
  >
    <BasicButton
      v-if="hasAiChat"
      class="adder-ask-ai btn btn-sm btn-outline-primary w-100"
      icon="chat-quote"
      :text="$t('ai.chat.askAi')"
      :tooltip="$t('ai.chat.quoteSelection')"
      @click="$emit('ask-ai')"
    />
    <div
      v-if="isExtended"
      class="menu-search-bar">
      <input
        v-model="searchTerm"
        type="text"
        :placeholder="$t('editor.annotator.searchTags')"
        class="form-control"
        @mouseup.stop
      />
    </div> 
    <div 
      ref="adderWrapper"
      class="scrollable-menu-wrapper"
      :class="{ 'is-extended': isExtended }"
    >
      <div
        class="btn-group-vertical" 
        @click.stop
      >
        <BasicButton
          v-for="t in filteredTags"
          :key="t.name"
          :class="`btn-${t.colorCode} text-truncate`"
          :title="t.description"
          :text="t.name"
          data-placement="top"
          data-toggle="tooltip"
          @click="selectTag(t)"
        />
      </div>
    </div>
    <BasicButton
      v-if="shouldShowExtender"
      class="expand-btn"
      icon="three-dots"
      :title="$t('editor.annotator.expandAdder')"
      @click="isExtended=true"
    />
  </div>

</template>

<script>
import BasicButton from "@/basic/Button.vue";

/** Positions and filters the annotation tag menu and remembers which tags were used most recently. */
export default {
  name: 'PDFSelectionMenu',
  components: {BasicButton},
  props: {
    visible: {type: Boolean, default: false},
    readOnly: {type: Boolean, default: false},
    hasAiChat: {type: Boolean, default: false},
    documentId: {type: Number, required: true},
    studySessionId: {type: Number, default: null},
    studyStepId: {type: Number, default: null},
    tagSetId: {type: Number, default: null},
    tags: {type: Array, required: true},
  },
  emits: ['ask-ai', 'select'],
  data() { return {isExtended: false, searchTerm: '', isOverflowing: false, usageHistory: []}; },
  computed: {
    recencySortingOn() {
      return this.$store.getters["settings/getValue"]("tags.recencySortingIsOn") === "true";
    },
    usageHistoryKey() {
      return "UH" + this.tagSetId;
    },
    savedUsageHistory() {
      const userId = this.$store.getters['auth/getUserId'];
      return this.$store.getters['table/user_environment/getAll'].find(
        e => e.userId === userId &&
          e.documentId === this.documentId &&
          e.studySessionId === this.studySessionId &&
          e.studyStepId === this.studyStepId &&
          e.key === this.usageHistoryKey
      ) || null;
    },
    filteredTags() {
      let tagList;
      if(!this.searchTerm.trim()) {
        tagList = this.tags;
      }else {
        const term = this.searchTerm.trim().toLowerCase();
        tagList = this.tags.filter(tag =>
          tag.name.toLowerCase().includes(term)
        );
      }

      // sort tags by recency
      if (this.recencySortingOn) {
          tagList.sort((a,b) => {
          const idxA = this.usageHistory.indexOf(a.name);
          const idxB = this.usageHistory.indexOf(b.name);

          if (idxA === -1 && idxB === -1){
            return 0;
          }
          if (idxA === -1) {
            return 1;
          }
          if (idxB === -1) {
            return -1;
          }
          return idxA - idxB;
        });
      }

      return tagList;
    },
    shouldShowExtender() {
      return !this.isExtended && this.isOverflowing;
    }
  },
  watch: {
    visible(value) { if (!value) this.isExtended = false; },
    readOnly(readOnly, wasReadOnly) {
      if (readOnly && !wasReadOnly && this.recencySortingOn) this.saveUsageHistory();
    },
  },
  mounted() {
    // if available, load usage history of Tagset
    if (this.savedUsageHistory) {
      this.usageHistory = JSON.parse(this.savedUsageHistory.value);
    }
  },
  beforeUnmount() {
    if (!this.readOnly && this.recencySortingOn) {
      this.saveUsageHistory();
    }
  },
  methods: {
    /**
     * Emits the chosen tag; with recency sorting on, moves it to the front of the usage history (max. 20 entries).
     * @param {Object} tag - the chosen tag
     */
    selectTag(tag) {
      if (this.recencySortingOn) {
        const currentIdx = this.usageHistory.indexOf(tag.name);
        if (currentIdx > -1) {
          this.usageHistory.splice(currentIdx, 1);
        }
        this.usageHistory.unshift(tag.name);
        if (this.usageHistory.length > 20) {
          this.usageHistory.pop();
        }
      }
      this.$emit('select', tag);
    },
    saveUsageHistory() {
      const value = JSON.stringify(this.usageHistory);
      this.$socket.emit("appDataUpdate", {
        table: "user_environment",
        data: this.savedUsageHistory ? {id: this.savedUsageHistory.id, value} : {
          userId: this.$store.getters['auth/getUserId'],
          documentId: this.documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          key: this.usageHistoryKey,
          value,
        },
      });
    },
    checkOverflow() {
      const el = this.$refs.adderWrapper;
      this.isOverflowing = el.scrollHeight > el.clientHeight;
    },
    show(x, y) {
      //reset the extended status of the adder and the searchTerm
      this.isExtended = false;
      this.searchTerm = '';
      this.$refs.adderWrapper.scrollTop =0;
      // get size of the box
      const adder = this.$refs.adder;
      const pdfContainerRect = /** @type {Element} */ (document.getElementById("pdfContainer-" + this.documentId)).getBoundingClientRect();
      const pdfToolbarRect = /** @type {Element} */ (document.getElementById("pdfToolbar-" + this.documentId)).getBoundingClientRect();
      const width = adder.getBoundingClientRect().width;
      const height = adder.getBoundingClientRect().height;
      // calculate position of adder: slightly up from the event position
      y = y - height;

      const relativeX = x - pdfContainerRect.left;
      // check if adder will overlap to the right
      if (relativeX + width > pdfContainerRect.width) {
        x = pdfContainerRect.width - width;
      }
      //restrict the adder from being generated too far up
      // or too far left after repositioning because of overlap
      y = Math.max(pdfToolbarRect.bottom, y);
      x = Math.max(0, x);

      // get max z index
      const maxZIndex = Math.max(
          ...Array.from(document.querySelectorAll('body *'), el =>
              parseFloat(window.getComputedStyle(el).zIndex),
          ).filter(zIndex => !Number.isNaN(zIndex)),
          0,
      );

      // move to position
      Object.assign(adder.style, {
        left: x.toString() + 'px',
        top: y.toString() + 'px',
        zIndex: maxZIndex + 1,
      });
    },
  },
};
</script>

<style scoped>

#adder {
  border-radius: 5px;
  box-shadow: 2px 3px #CCCCCC;
  position: absolute;
  top: 0;
  left: 0;
  padding: 2px;
  background-color: white;
  white-space: nowrap;
  width: fit-content;
  max-width: 150px;
}
#adder.is-extended {
  max-width: 250px;
}
.btn-group-vertical {
  width: 100%;
  max-width: inherit;
}
.btn {
  text-align: center;
  max-width: inherit;
}
.scrollable-menu-wrapper {
  max-height: 150px;
  overflow-x: hidden;
  overflow-y: auto;
  max-width: inherit;
  border-radius: 5px;
}
.scrollable-menu-wrapper.is-extended {
  max-height: 250px;
  max-width: inherit;
}
.expand-btn {
  width: 100%;
  background-color: var(--bs-secondary-bg, lightgrey);
  border-radius: 5px;
  padding: 5px;
}
.menu-search-bar {
  width: 100%;
}

</style>
