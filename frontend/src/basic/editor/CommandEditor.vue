<template>
  <div class="border rounded-1">
    <div class="input-group mt-2">
      <button
        class="btn"
        :class="configEditor.allowActionChange ? 'dropdown-toggle btn-primary' : 'btn-dark'"
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
    <div class="border-start border-end border-bottom px-2">
      <span class="text-secondary fst-italic">Payload</span>
      <JsonEditor
        v-model:content="payload"
        start-edit-mode
      />
    </div>
    <div class="mt-2 mb-2 border text-muted">
      <div v-if="history.length > 0">
        <div
          v-for="i in history.slice(0, showHistory ? history.length : configEditor.defaultShowCount)"
          :key="i.time"
        >
          <CommandMessage
            :time-string="i.time"
            :incoming="i.incoming"
            :service="i.data.service"
            :data="i.data"
          />
        </div>
      </div>
      <div
        v-else
        class="text-center text-secondary fst-italic"
      >
        <span>
          No messages sent/received
        </span>
      </div>
      <div
        v-if="history.length > 0 && history.length > configEditor.defaultShowCount"
        class="w-100 text-center bg-light"
        :title="`${showHistory ? 'Hide' : 'Show'} more`"
        @click="showHistory=!showHistory"
      >
        <LoadIcon
          :icon-name="`caret-${showHistory ? 'up' : 'down'}`"
          :size="12"
        />
      </div>
    </div>
  </div>
</template>

<script>
import JsonEditor from "./JsonEditor.vue";
import CommandMessage from "./CommandMessage.vue"
import LoadIcon from "@/basic/icons/LoadIcon.vue";
import {overrideObjectAttributes} from "@/assets/utils";

export default {
  name: "CommandEditor",
  components: {JsonEditor, CommandMessage, LoadIcon},
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
    initPayload: {
      type: Object,
      required: false,
      default: null
    }
  },
  data() {
    return {
      payload: {},
      configEditor: {
        action: "REQ",
        allowActionChange: true,
        command: null,
        allowCommandChange: true,
        allowServiceChange: true,
        defaultShowCount: 5
      },
      sending: false,
      history: [],
      showHistory: false
    }
  },
  sockets: {
    serviceRefresh: function (data) {
      console.log("SERVICE REFRESH ==", data);
      if (data && data.service === this.service) {
        this.history.unshift({time: Date.now(), incoming: true, data: data});
      }

      // by default deactivate sending state
      this.sending = false;
    },
  },
  computed: {
    serviceCmds() {
      return this.$store.getters["service/getCmdTypes"](this.service);
    },
    serviceResTypes() {
      return this.$store.getters["service/getResponseTypes"](this.service);
    },
    services() {
      return this.$store.getters["service/getServices"]();
    },
  },
  beforeMount() {
    if (this.config) {
      this.configEditor = overrideObjectAttributes(this.configEditor, this.config);
    }
    if(this.initPayload){
      this.payload = this.initPayload;
    }
  },
  methods: {
    setPayload(payload){
      this.payload = payload;
    },
    send() {
      this.sending = true;

      const messageType = this.configEditor.action === "REQ" ? "serviceRequest" : "serviceCommand";
      let message = {service: this.service, data: this.payload};

      if (messageType === "serviceCommand") {
        message.command = this.configEditor.command;
      }

      this.history.unshift({
        time: Date.now(),
        incoming: false,
        data: message
      });

      this.$socket.emit(messageType, message);

      setTimeout(() => {
            if (this.sending) {
              this.eventBus.emit('toast', {
                message: "Received no message from server within 5s.",
                variant: "warning",
                delay: 3000
              });
            }
            this.sending = false
          }, 5000
      );
    },
  }
}
</script>

<style scoped>

</style>