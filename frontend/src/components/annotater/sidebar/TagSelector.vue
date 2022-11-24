<template>
  <div class="tags">
    <select v-bind:id="'annotationTags-'+annotation_id" ref="tags"
            v-model="annoTags"
            :disabled="disabled"
            :placeholder="placeholder"
            allowClear="true"
            class="form-select selector"
            data-allow-new="false"
            multiple
            name="tags_new[]">
      <option disabled hidden selected value="">Choose a tag...</option>
      <option v-for="t in assignableTags" :key="t.id" :value="t.id" selected="true"
              v-bind:data-badge-style="t.colorCode">{{ t.name }}
      </option>
      <option
          v-for="t in tags.filter(tag => tagsIdsUsed.includes(tag.id)).filter(tag => !assignableTags.map(at => at.id).includes(tag.id))"
          :key="t.id" :data-badge-style="t.colorCode" :value="t.id" selected="true">{{ t.name }}
      </option>
    </select>
    <div class="invalid-feedback">Please select a valid tag.</div>
  </div>
</template>

<script>
import Tags from "bootstrap5-tags/tags.js";

export default {
  name: "TagSelector",
  props: {
    annotation_id: {
      type: Number,
      required: false,
      default: null,
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  mounted() {
    //todo maybe use css sel
    Tags.init(this.$refs.tags.$el);
    this.$refs.tags.dispatchEvent(new KeyboardEvent("keydown", {"keyCode": 13}));
  },
  computed: {
    tags() {
      return this.$store.getters["tag/getAllTags"](false);
    },
    id() {
      if (this.annotation_id) {
        return this.annotation_id;
      } else if (this.comment_id) {
        return this.comment_id;
      }
    },
    annotation() {
      return this.$store.getters["anno/getAnnotation"](this.annotation_id);
    },
    annoTags: {
      get() {
        return this.annotation.tags.sort();
      },
      set(value) {
        this.annotation.tags = value.sort();
      }
    },
    placeholder() {
      if (this.annotation.draft) {
        return "Add tag..."
      }
      if (this.annotation.tags == null || this.annotation.tags.length === 0) {
        return "No Tags";
      }
      return "";
    },
    assignableTags() {
      return this.$store.getters["tag/getTags"](this.defaultTagSet);
    },
    tagsIdsUsed() {
      return [...new Set(this.annotation.tags)]
    },
    defaultTagSet() {
      return parseInt(this.$store.getters["settings/getValue"]("tags.tagSet.default"));
    },
  }
}
</script>

<style scoped>
.tags {
  padding-left: 0;
  padding-right: 0;
  border: none;
  background-color: transparent;
}
.selector {
  border:0;
}
</style>