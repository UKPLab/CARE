<template>
  <div class="container border border-1 rounded-3 h-100">
    <div class="row mb-2 py-3">
      <div class="col p-1">
        <LoadIcon :icon-name="icon" />
        <span class="px-1 fs-5 fw-light">{{ name }}</span>
      </div>
    </div>
    <div class="row justify-content-center">
      <div class="col">
        <JsonEditor :model-value="jsonData" />
      </div>
    </div>
  </div>
</template>

<script>
import JsonEditor from "@/basic/editor/JsonEditor.vue";
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "SkillItem",
  components: {LoadIcon, JsonEditor},
  props: {
    jsonData: {
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
  computed: {
    iconShown() {
      if(this.icon){
        return this.icon;
      } else {
        return Array.isArray(this.jsonData) ? "list" : "box";
      }
    }
  }
}
</script>

<style scoped>

</style>