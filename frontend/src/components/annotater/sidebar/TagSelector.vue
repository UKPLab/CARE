<template>
  <div class="tags">
    <select v-bind:id="'tags-'+ comment_id" ref="tags"
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
    comment_id: {
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
    comment() {
      return this.$store.getters["comment/getComment"](this.comment_id);
    },
    annoTags: {
      get() {
        return this.comment.tags.sort();
      },
      set(value) {
        this.comment.tags = value.sort();
      }
    },
    placeholder() {
      if (this.comment.draft) {
        return "Add tag..."
      }
      if (this.comment.tags == null || this.comment.tags.length === 0) {
        return "No Tags";
      }
      return "";
    },
    assignableTags() {
      return this.$store.getters["tag/getTags"](this.defaultTagSet);
    },
    tagsIdsUsed() {
      return [...new Set(this.comment.tags)]
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