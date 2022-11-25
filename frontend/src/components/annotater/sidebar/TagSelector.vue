<template>
  <div>
    <select ref="tags"
            v-model="tags"
            v-bind:disabled="disabled"
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
import {watch} from "vue";

export default {
  name: "TagSelector",
  emits: ['update:modelValue'],
  props: {
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    modelValue: {
      type: String,
      required: true,
    }
  },
  /*setup(props) {
    watch(() => props.disabled, (newValue) => {
      this.tags_element.resetState();
    })
  },*/
  data: function () {
    return {
      tags_element: null,
    }
  },
  mounted() {
    this.tags_element = new Tags(this.$refs.tags);
    this.tags_element.resetState();
    this.$refs.tags.dispatchEvent(new KeyboardEvent("keydown", {"keyCode": 13}));
  },
  watch: {
    disabled2(val, value) {
      this.$nextTick(() => {
        this.tags_element.resetState()
      })

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
        this.$emit('update:modelValue', value)
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