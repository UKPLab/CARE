<template>
  <div class="container border border-1 rounded-3 h-100">
    <div class="row mb-2 py-3">
      <div class="col p-1">
        <LoadIcon :icon-name="iconShown" />
        <span class="px-1 fs-5 fw-light">{{ name }}</span>
      </div>
    </div>
    <div class="row justify-content-center">
      <div class="col">
        <JsonEditor v-model:content="currentData" readonly/>
      </div>
    </div>
  </div>
</template>

<script>
import JsonEditor from "@/basic/editor/JsonEditor.vue";
import LoadIcon from "@/basic/Icon.vue";
import deepEqual from "deep-equal";

/* SkillItem.vue - a single entry in the skill listing

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
export default {
  name: "SkillItem",
  components: {LoadIcon, JsonEditor},
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      required: false,
      default: null
    }
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: null,
    }
  },
  computed: {
    iconShown() {
      if(this.icon !== null){
        return this.icon;
      } else {
        return Array.isArray(this.currentData) ? "list" : "box";
      }
    }
  },
  watch: {
    currentData: {
      handler() {
        if (!deepEqual(this.currentData, this.modelValue)) {
          this.$emit("update:modelValue", this.currentData);
        }
      }, deep: true
    },
    modelValue: {
      handler() {
        this.currentData = this.modelValue;
      }, deep: true
    }
  },
  beforeMount() {
    this.currentData = this.modelValue;
  }
}
</script>

<style scoped>

</style>