<template>
  <div v-show="!disabled">
    <select
      ref="tags"
      v-model="tags"
      :disabled="disabled"
      :placeholder="placeholder"
      allowClear="true"
      class="form-select selector form-select-sm"
      data-allow-new="true"
      multiple

      name="tags_new[]"
    >
      <option
        disabled
        hidden
        selected
        value=""
      >
        Choose a tag...
      </option>
    </select>
    <div class="invalid-feedback">
      Please select a valid tag.
    </div>
  </div>
  <div v-if="disabled && tags.length > 0">
    <span
      v-for="t in tags"
      class="badge bg-primary"
    >
      {{ t }}
    </span>
  </div>
</template>

<script>
import Tags from "bootstrap5-tags/tags.js";

/* TagSelector.vue - component for selecting tags in an annotation card

This component provides a basic tag selection editor. Supports entering a text an converting
them into tag badges.

Author: Nils Dycke
Co-author: Dennis Zyska
Source: -
*/
export default {
  name: "TagSelector",
  props: {
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    modelValue: {
      type: Array,
      required: true,
    },
    isEditor: {
      type: Boolean,
      required: true
    }
  },
  emits: ['update:modelValue'],
  data: function () {
    return {
      tags_element: null,
    }
  },
  computed: {
    disabled2() {
      return this.disabled;
    },
    tags: {
      get() {
        return this.modelValue
      },
      set(value) {
        if (this.isEditor) {
          this.$emit('update:modelValue', value)
        }
      }
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
  },
  watch: {
    disabled2(val, value) {
      this.$nextTick(() => {
        this.tags_element.resetState()
      })
    },
    tags(val) {
      if (!this.isEditor) {
        this.tags_element.placeholder = "";
        this.tags_element.removeAll();
        val.forEach(v => this.tags_element.addItem(v, v));
      }
    }
  },
  mounted() {
    this.tags_element = new Tags(this.$refs.tags);
    this.tags.forEach(v => this.tags_element.addItem(v, v));
    this.tags_element.resetState();
    this.$refs.tags.dispatchEvent(new KeyboardEvent("keydown", {"keyCode": 13}));
    console.log(this.tags_element);
  }
}
</script>

<style scoped>
#select {
  padding-left: 0;
  padding-right: 0;
  border: none;
  background-color: transparent;
}

.selector {
  border: 0;
}
</style>