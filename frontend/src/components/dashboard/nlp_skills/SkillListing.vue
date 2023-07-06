<template>
  <div v-if="validConfig">
    <div class="btn-group btn-group-sm position-absolute top-0 end-0 px-3 py-3">
      <button
          class="btn btn-outline-secondary"
          type="button"
          title="Copy config"
          @click="copyConfig"
      >
        <LoadIcon
            icon-name="clipboard"
            :size="16"
        />
      </button>
      <button
        class="btn btn-outline-secondary"
        type="button"
        title="Download config"
        @click="downloadConfig"
      >
        <LoadIcon
          icon-name="cloud-arrow-down"
          :size="16"
        />
      </button>
      <button
        class="btn btn-outline-secondary"
        :class="commandEditorActive ? 'active' : ''"
        :aria-pressed="commandEditorActive"
        type="button"
        title="Send command"
        @click="commandEditorActive=!commandEditorActive"
      >
        <LoadIcon
          icon-name="send"
          :size="16"
        />
      </button>
    </div>
    <h3>
      {{ currentData.name }}
    </h3>
    <div class="container py-1 px-0">
      <div class="row mb-3">
        <div class="col">
          <span class="fs-6 fw-light">{{ currentData.description }}</span>
        </div>
      </div>
      <div v-if="commandEditorActive" class="row p-2">
        <CommandEditor :config="commandEditorConfig" service="NLPService" :init-payload="exampleRequest"></CommandEditor>
      </div>
      <div class="row py-2">
        <span class="fs-5">
          Example
        </span>
      </div>
      <div class="row">
        <div class="col py-3">
          <div class="container border border-1 rounded-3 h-100">
            <div class="row mb-2 py-3">
              <div class="col justify-content-center">
                <span class="fs-6 badge bg-success">Input</span>
              </div>
            </div>
            <div class="row justify-content-center">
              <div class="col">
                <JsonEditor :content="currentData.input.example" readonly/>
              </div>
            </div>
          </div>
        </div>
        <div class="col py-3">
          <div class="container border border-1 rounded-3 h-100">
            <div class="row mb-2 py-3">
              <div class="col justify-content-center">
                <span class="fs-6 badge bg-primary">Output</span>
              </div>
            </div>
            <div class="row justify-content-center">
              <div class="col">
                <JsonEditor :content="currentData.output.example" readonly />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <hr>
    <span class="fs-5">
      Config
    </span>
    <div
        class="overflow-auto py-2"
        style="max-height:30vh"
    >
      <div
          v-for="[f, i] in [['input','box-arrow-in-right'], ['output', 'box-arrow-right']]"
          :key="f"
          class="py-1"
      >
        <SkillItem
            v-model="currentData[f]"
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
            v-model="currentData[f]"
            :name="f"
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
import LoadIcon from "@/basic/Icon.vue";
import {downloadObjectsAs} from "@/assets/utils";
import CommandEditor from "@/basic/editor/CommandEditor.vue";
import {v4 as uuidv4} from "uuid";
import deepEqual from "deep-equal";

/* SkillListing.vue - characterizing a skill config

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
export default {
  name: "SkillListing",
  components: {
    CommandEditor,
    JsonEditor,
    SkillItem,
    LoadIcon
  },
  props: {
    modelValue: {
      type: Object,
      required: true
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      standardFields: ['name', 'description', 'input', 'output'],
      commandEditorActive: false,
      commandEditorConfig: {
        action: "REQ",
        allowActionChange: false,
        command: null,
        allowCommandChange: false,
        allowServiceChange: false,
        defaultShowCount: 5
      },
      currentData: null
    }
  },
  computed: {
    validConfig() {
      if (this.currentData) {
        return validateServiceConfig(this.currentData);
      }
      return true;
    },
    nonStandardFields() {
      return Object.getOwnPropertyNames(this.currentData).filter(f => !this.standardFields.includes(f));
    },
    exampleRequest() {
      if(this.validConfig){
        return {
           id: uuidv4(),
           name: this.currentData.name,
           data: this.currentData.input.example
        }
      }

      return {};
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
  },
  methods: {
    async copyConfig() {
      if (this.currentData) {
        try {
          await navigator.clipboard.writeText(JSON.stringify(this.currentData, null, 2));
          this.eventBus.emit('toast', {
            title: "Config copied",
            message: "Skill configuration copied to clipboard!",
            variant: "success"
          });
        } catch ($e) {
          this.eventBus.emit('toast', {
            title: "Config not copied",
            message: "Could not copy skill configuration to clipboard!",
            variant: "danger"
          });
        }
      } else {
        this.eventBus.emit('toast', {
          title: "Config not copied",
          message: "Configuration not loaded or empty, cannot copy.",
          variant: "danger"
        });
      }
    },
    downloadConfig() {
      if (this.currentData && this.currentData.name) {
        downloadObjectsAs(this.currentData, `${this.currentData.name}`, "json");

        this.eventBus.emit('toast', {
          title: "Download Success",
          message: `Downloaded ${this.currentData.name} configuration`,
          variant: "success"
        });
      } else {
        this.eventBus.emit('toast', {
          title: "Download Failed",
          message: `Failed to download skill config, as it is no loaded`,
          variant: "danger"
        });
      }
    },
    changeSkillSetting(newVal){
      console.log("deactivating a skill");
      //todo send emit
    },
    reset() {
      this.commandEditorActive = false;
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