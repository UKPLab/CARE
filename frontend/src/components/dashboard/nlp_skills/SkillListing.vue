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
        <div class="container">
          <div class="row mb-2">
            <div class="col">
              <span class="fs-6 fw-bold">Example</span>
            </div>
          </div>
          <div class="row mb-2 px-2">
            <div class="col">
              <span class="fs-6 badge bg-success">Input</span>
            </div>
            <div class="col">
              <code> {{ config.input.example }} </code>
            </div>
          </div>
          <div class="row mb-2 px-2">
            <div class="col">
              <span class="fs-6 badge bg-danger">Output</span>
            </div>
            <div class="col">
              <code> {{ config.output.example}} </code>
            </div>
          </div>
        </div>
      </div>
    </div>
    <hr>
    <div class="list-group-flush">
      <div>
        <Card
            title="Input"
        >
          <template #body>

          </template>
        </Card>
      </div>
      <div>
        <Card
            title="Output"
            collapsable
        />
      </div>
      <hr>
      <div>
        <Card
            v-for="field in nonStandardFields"
            :key="field"
            :title="field"
            collapsable
        >
          ...
        </Card>
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
import Card from "@/basic/Card.vue";

/* SkillListing.vue - characterizing a skill config

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
export default {
  name: "SkillListing",
  components: {Card},
  props: {
    'config': {
      type: Object,
      required: true
    },
  },
  data() {
    return {
      standardFields: ['name', 'description', 'input', 'output']
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
  }
}
</script>

<style scoped>
.list-group-flush div {
  width: 100%;
  padding-bottom: 1rem
}
</style>