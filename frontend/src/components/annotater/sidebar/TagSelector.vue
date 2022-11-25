<template>
  <div class="tags">
    <select ref="tags"
            v-model="tags"
            :disabled="disabled"
            :placeholder="placeholder"
            allowClear="true"
            class="form-select selector"
            data-allow-new="true"
            multiple
            name="tags_new[]">
      <option disabled hidden selected value="">Choose a tag...</option>
      <option v-for="t in tags" :value="t"
            >
        {{ t }}
      </option>
    </select>
    <div class="invalid-feedback">Please select a valid tag.</div>
  </div>
</template>

<script>
import Tags from "bootstrap5-tags/tags.js";

export default {
  name: "TagSelector",
  emits: ['update:value'],
  props: {
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    value: {
      type: Array,
      required: true
    }
  },
  mounted() {
    Tags.init(this.$refs.tags.$el);
    this.$refs.tags.dispatchEvent(new KeyboardEvent("keydown", {"keyCode": 13}));
  },
  computed: {
    tags: {
      get() {
        return this.value
      },
      set(value) {
        this.$emit('update:value', value)
      }
    },
    all_tags() {
      return this.$store.getters["tag/getAllTags"](false);
    },
    placeholder() {
      if (!this.disabled) {
        return "Add tag..."
      }
      if (this.tags == null || this.tags.length === 0) {
        return "No Tags";
      }
      return "";
    },
    assignableTags() {
      return this.$store.getters["tag/getTags"](this.defaultTagSet);
    },
    tagsIdsUsed() {
      return [...new Set(this.tags)]
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
  border: 0;
}
</style>