<template>
  <select ref="tags"
          :disabled="disabled"
          :placeholder="placeholder"
          allowClear="true"
          class="form-select"
          data-allow-new="false"
          multiple name="tags_new[]">
      <option disabled hidden selected value="">Choose a tag...</option>




      <option v-for="t in assignableTags" :key="t.id" :value="t.id" selected="true"
              v-bind:data-badge-style="t.colorCode">{{ t.name }}
      </option>
      <option
          v-for="t in tags.filter(tag => tagsIdsUsed.includes(tag.id)).filter(tag => !assignableTags.map(at => at.id).includes(tag.id))"
          :key="t.id" :data-badge-style="t.colorCode" :value="t.id" selected="true">{{ t.name }}
      </option>
    </select>
</template>

<script>
import Tags from "bootstrap5-tags/tags.js";

export default {
  name: "TagSelector",
  props: {
    tags: {
      type: Array,
      required: true,
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    placeholder: {
      type: String,
      required: false,
      default: "",
    },
  },
  mounted() {
    //todo maybe use css sel
    Tags.init(this.$refs.tags.$el);
    this.$refs.tags.dispatchEvent(new KeyboardEvent("keydown", {"keyCode": 13}));
  },
  computed: {
    annoTags: {
      get() {
        return this.tags.sort();
      },
      set(value) {
        this.tags = value.sort();
      }
    },
  }
}
</script>

<style scoped>

</style>