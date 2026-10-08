<template>
  <div v-if="editingTag && annotationId" class="d-flex align-items-center">
    <select
        v-model="selectedTag"
        class="form-select form-select-md"
        :style="{
          display: 'inline-block',
          borderLeft: '4px solid #' + color,
          height: '38px',
          fontSize: 'small',
          fontStyle: 'italic'
        }"
    >
      <option  v-for="tag in tagSetTags" :key="tag.id" :value="tag.id">
        {{ tag.name }}
      </option>
    </select>
    <SidebarButton
            :loading="false"
            :props="{ commentId }"
            icon="x-square"
            :title="$t('common.cancel')"
            @click="$emit('update:editingTag', false)"
    />
  </div>
  <div
      v-else-if="annotationId && !editingTag"
      :style="'border-color:#' + color"
      :title="tagName"
      class="blockquote card-text annoBlockquote"
      data-placement="top"
      data-toogle="tooltip"
      @click="scrollTo(annotationId)"
  >
    <b>{{ tagName }}:</b> {{ truncatedText(annotation.text) }}
  </div>
</template>

<script>
import SidebarButton from "./Button.vue";
import { resolveApiMessage } from "@/assets/utils";

/** Annotation tag view/edit
 *
 * Displays the tags assigned to an annotation and allows adding or removing multiple tags.
 * Toggled externally through the exposed toggleEditTag() method
 * via $refs.annotationTag.toggleEditTag().
 *
 * @author Nils Dycke, Dennis Zyska
 *
 */
export default {
  name: "AnnotationTag",
  subscribeTable: ['tag', 'tag_set'],
  components: {SidebarButton},
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  props: {
    'annotationId': {
      type: Number,
      required: false,
      default: null,
    },
    'commentId': {
      type: Number,
      required: true,
    },
    'editingTag': {
      type: Boolean,
      required: true,
    },
    'selectedTagId': {
      type: Number,
      required: false,
      default: null,
    },
  },
  emits: ['update:editingTag', 'update:selectedTagId'],
  computed: {
    selectedTag: {
      get() {
        return this.selectedTagId;
      },
      // The selectedTagId prop only updates after the parent re-renders, so save with the new value directly
      set(tagId) {
        this.$emit('update:selectedTagId', tagId);
        this.saveTagChange(tagId);
      },
    },
    annotation() {
      return this.$store.getters['table/annotation/get'](this.annotationId);
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
    tagSetTags() {
      if ( this.study && this.study.tagSetId) {
        return this.$store.getters["table/tag/getFiltered"](e => e.tagSetId === this.study.tagSetId && !e.deleted);
      }
      else{
        const defaultTag = parseInt(this.$store.getters["settings/getValue"]("tags.tagSet.default"));
        const currentlySelectedTagId = this.annotation ? this.annotation.tagId : null; //this is important because the current tag on the Id could be added by another user
        return this.$store.getters['table/tag/getFiltered'](t => t.tagSetId === defaultTag || t.id === currentlySelectedTagId) || [];
      }
    },
    color() {
      if (this.annotationId)
        return this.getColor(this.annotation.tagId);
      return null;
    },
    tagName() {
      if (this.annotationId) {
        const tag = this.$store.getters['table/tag/get'](this.annotation.tagId);
        if (tag)
          return tag.name;
      }
      return null;
    },
  },
  methods: {
    getColor(tagId) {
      if (tagId) {
        const tag = this.$store.getters['table/tag/get'](tagId);
        if (tag) {
          switch (tag.colorCode) {
            case "success":
              return "009933";
            case "danger":
              return "e05f5f";
            case "info":
              return "5fe0df";
            case "dark":
              return "c8c8c8";
            case "warning":
              return "eed042";
            case "secondary":
              return "4290ee";
            default:
              return "4c86f7";
          }
        } else {
          return "efea7b";
        }
      }
    },
    truncatedText(text) {
      const thresh = 150;
      const len = text.length;

      if (len > thresh) {
        const overflow = len - thresh - " ... ".length;
        const center = Math.floor(len / 2);
        const cutoff_l = center - Math.floor(overflow / 2);
        const cutoff_r = center + Math.floor(overflow / 2) + overflow % 2;

        return text.slice(0, cutoff_l) + " ... " + text.slice(cutoff_r);
      } else {
        return text;
      }
    },
    scrollTo(annotationId) {
      this.eventBus.emit('pdfScroll', annotationId);
    },
    toggleEditTag() {
      const editingTag = !this.editingTag;
      this.$emit('update:editingTag', editingTag);
      if (editingTag) {
        this.$emit('update:selectedTagId', this.annotation.tagId);
      } else {
        this.$emit('update:selectedTagId', null);
      }
      this.$nextTick(() => {
        // Focus the select for better UX
        const select = this.$el.querySelector('select[autofocus]');
        if (select) select.focus();
      });
    },
    saveTagChange(tagId) {
      if (tagId !== this.annotation.tagId) {
        this.$socket.emit('annotationUpdate', {
          annotationId: this.annotation.id,
          tagId: tagId,
        }, (res) => {
          if (!res.success) {
            this.eventBus.emit("toast", {
              title: this.$t('errors.tags.tagUpdateFailed'),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
        });
      }
      this.$emit('update:editingTag', false);
    },
  }
}
</script>

<style>
.blockquote {
  padding-left: 1em;
  padding-right: 1em;
  font-style: italic;
  --tw-border-opacity: 1;
  border-color: rgba(209, 213, 219, var(--tw-border-opacity));
  border-sizing: border-box;
  border-style: solid;
  border-left-width: 4px;
  font-size: small;
  border-right-width: 0;
  border-top-width: 0;
  border-bottom-width: 0;
  cursor: pointer;
}

.annoBlockquote:hover {
  color: var(--bs-body-color, #000000);
}
</style>
