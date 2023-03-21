<template>
  <div v-if="validConfig">
    <h3>
      {{ config.name }}
    </h3>
    <div class="container py-1 px-0">
      <div class="row mb-3">
        <div class="col">
          <span class="fs-6 fw-light">{{ config.description }}</span>
        </div>
      </div>
      <div class="row gy-2">
        <div class="container py-2">
          <div class="row mb-2 px-2">
            <div class="col">
              <div class="row mb-2 justify-content-center">
                <span class="fs-6 badge bg-success w-25">Input</span>
              </div>
              <div class="row justify-content-center">
                <JsonEditor :model-value="config.input.example"/>
              </div>
            </div>
            <div class="col">
              <div class="row mb-2 justify-content-center">
                <span class="fs-6 badge bg-danger w-25">Output</span>
              </div>
              <div class="row justify-content-center">
                <JsonEditor :model-value="config.output.example"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <hr>
    <div class="list-group-flush">
      <li class="list-group-item">
        <span class="fs-6 fw-bold">Input</span>
        <div class="p-3">
          <JsonEditor :model-value="config.input"/>
        </div>

      </li>
      <li class="list-group-item">
        <span class="fs-6 fw-bold">Output</span>
        <div class="p-3">
          <JsonEditor :model-value="config.output"/>
        </div>
      </li>
      <li v-for="f in nonStandardFields" class="list-group-item">
        <span class="fs-6 fw-bold">{{ f  }}</span>
        <div class="p-3">
          <JsonEditor :model-value="config[f]"/>
        </div>
      </li>
    </div>
  </div>
  <div v-else>
    <span class="text-danger">
      The provided service is invalid. Please consult with the service provider.
    </span>
  </div>
</template>

<script>
import {validateServiceConfig} from "@/assets/data";
import JsonEditor from "@/basic/editor/JsonEditor.vue";

/* SkillListing.vue - characterizing a skill config

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
export default {
  name: "SkillListing",
  components: {
    JsonEditor
  },
  props: {
    'config': {
      type: Object,
      required: true
    },
  },
  data() {
    return {
      standardFields: ['name', 'description', 'input', 'output'],
    }
  },
  computed: {
    validConfig() {
      if (this.config) {
        return validateServiceConfig(this.config);
      }
      return true;
    },
    nonStandardFields() {
      return Object.getOwnPropertyNames(this.config).filter(f => !this.standardFields.includes(f));
    }
  },
}
</script>

<style scoped>
.list-group-flush div {
  width: 100%;
  padding-bottom: 1rem
}
</style>