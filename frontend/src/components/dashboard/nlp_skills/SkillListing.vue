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
      <div class="row g-3">
        <div class="col p-3">
          <div class="container border border-1 rounded-3 h-100">
            <div class="row mb-2 py-3">
              <div class="col justify-content-center">
                <span class="fs-6 badge bg-success">Input</span>
              </div>
            </div>
            <div class="row justify-content-center">
              <div class="col">
                <JsonEditor :model-value="config.input.example" />
              </div>
            </div>
          </div>
        </div>
        <div class="col p-3">
          <div class="container border border-1 rounded-3 h-100">
            <div class="row mb-2 py-3">
              <div class="col justify-content-center">
                <span class="fs-6 badge bg-primary">Output</span>
              </div>
            </div>
            <div class="row justify-content-center">
              <div class="col">
                <JsonEditor :model-value="config.output.example" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <hr>
    <div class="overflow-auto" style="max-height:30vh">
      <div
        v-for="[f, i] in [['input','box-arrow-in-right'], ['output', 'box-arrow-right']]"
        :key="f"
        class="py-1"
      >
        <SkillItem
          :json-data="config[f]"
          :name="f"
          :icon="i"
        />
      </div>
      <div
        v-for="f in nonStandardFields"
        :key="f"
        class="py-1"
      >
        <SkillItem
          :json-data="config[f]"
          :name="f"
          :icon="i"
        />
      </div>
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
import SkillItem from "@/components/dashboard/nlp_skills/SkillItem.vue";

/* SkillListing.vue - characterizing a skill config

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
export default {
  name: "SkillListing",
  components: {
    JsonEditor,
    SkillItem
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