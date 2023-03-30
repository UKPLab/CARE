<template>
  <div class="border rounded-1">
    <div class="input-group mt-2">
      <button
        class="btn btn-primary"
        :class="configEditor.allowActionChange ? 'dropdown-toggle' : ''"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        :disabled="!configEditor.allowActionChange"
      >
        {{ configEditor.action }}
      </button>
      <ul
        v-if="configEditor.allowActionChange"
        class="dropdown-menu"
      >
        <li>
          <a
            class="dropdown-item"
            title="Send a request"
            @click="configEditor.action = 'REQ'"
          >REQ</a>
        </li>
        <li>
          <a
            class="dropdown-item"
            title="Send a command"
            @click="configEditor.action = 'CMD'"
          >CMD</a>
        </li>
      </ul>
      <input
        v-if="configEditor.action === 'CMD'"
        class="form-control"
        :class="configEditor.allowCommandChange ? 'dropdown-toggle' : ''"
        type="text"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        :disabled="!configEditor.allowCommandChange"
        :value="configEditor.command"
        title="the command to send"
      >
      <ul
        v-if="configEditor.action === 'CMD' && configEditor.allowCommandChange"
        class="dropdown-menu"
      >
        <li
          v-for="c in serviceCmds"
          :key="c"
        >
          <a
            class="dropdown-item"
            :title="c"
            @click="configEditor.command = c"
          > {{ c }} </a>
        </li>
      </ul>
      <input
        class="form-control"
        :class="configEditor.allowServiceChange ? 'dropdown-toggle' : ''"
        type="text"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        :disabled="!configEditor.allowServiceChange"
        :value="service"
        title="the service to contact"
      >
      <ul
        v-if="configEditor.allowServiceChange"
        class="dropdown-menu"
      >
        <li
          v-for="s in services"
          :key="s"
        >
          <a
            class="dropdown-item"
            :title="s"
            @click="service = s"
          > {{ s }} </a>
        </li>
      </ul>
      <button
        class="btn btn-primary"
        type="button"
        :title="sending ? 'Waiting for response' : 'Send'"
        :disabled="sending"
        @click="send"
      >
        <LoadIcon
          v-if="!sending"
          icon-name="send-exclamation"
          :size="16"
        />
        <div
          v-else
          class="spinner-border spinner-border-sm"
        />
      </button>
    </div>
    <div class="mb-3 border-start border-end border-bottom px-2">
      <span class="fw-light">Payload</span>
      <JsonEditor
        v-model:content="content"
        start-edit-mode
      />
    </div>
    <div class="mb-2 border text-muted">
      Response
    </div>
    <div class="mb-2 border text-muted">
      Log
    </div>
  </div>
</template>

<script>
import JsonEditor from "./JsonEditor.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import {overrideObjectAttributes} from "@/assets/utils";

export default {
  name: "CommandEditor",
  components: {JsonEditor, LoadIcon},
  props: {
    config: {
      type: Object,
      required: false,
      default: {}
    },
    service: {
      type: String,
      required: true
    },
  },
  data() {
    return {
      content: {},
      configEditor: {
        action: "REQ",
        allowActionChange: true,
        command: null,
        allowCommandChange: true,
        allowServiceChange: true
      },
      sending: false
    }
  },
  computed: {
    serviceCmds() {
      return this.$store.getters["service/getCmdTypes"](this.service);
    },
    services() {
      return this.$store.getters["service/getServices"]();
    }
  },
  beforeMount() {
    if (this.config) {
      this.configEditor = overrideObjectAttributes(this.configEditor, this.config);
    }
  },
  methods: {
    send() {
      this.sending = true;
    },
    changeAction(newAction) {
      this.configEditor.action = newAction;
    }
  }
}
</script>

<style scoped>

</style>