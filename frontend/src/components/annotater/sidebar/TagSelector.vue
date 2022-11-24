<template>
  <select ref="tags" v-bind:id="'annotationTags-'+annotation.id"
          v-model="annoTags"
          allowClear="true"
          class="form-select tags"
          data-allow-new="false"
          multiple
          name="tags_new[]"
          :placeholder="placeholder"
          :disabled="disabled">
    <option disabled hidden selected value="">Choose a tag...</option>
    <option v-for="t in assignableTags" :key="t.id" v-bind:data-badge-style="t.colorCode" selected="true"
            :value="t.id">{{ t.name }}
    </option>
    <option
        v-for="t in tags.filter(tag => tagsIdsUsed.includes(tag.id)).filter(tag => !assignableTags.map(at => at.id).includes(tag.id))"
        :key="t.id" selected="true" :data-badge-style="t.colorCode" :value="t.id">{{ t.name }}
    </option>
  </select>
  <div class="invalid-feedback">Please select a valid tag.</div>
</template>

<script>
import Tags from "bootstrap5-tags/tags.js";

export default {
  name: "TagSelector",
  props: ["disabled", "annotation"],
  mounted() {
    //todo maybe use css sel
    Tags.init(this.$refs.tags.$el);
    this.$refs.tags.dispatchEvent(new KeyboardEvent("keydown", {"keyCode": 13}));
  },
  computed: {
    tags() {
      return this.$store.getters["tag/getAllTags"](false);
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
.tags div {
  padding-left: 0;
  padding-right: 0;
  border: none;
  background-color: transparent;
}
</style>