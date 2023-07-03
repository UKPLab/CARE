<template>
  <div class="border-bottom container">
    <div class="row mt-1 mb-1">
      <div class="col-1">
        <LoadIcon :class="'text-' + (incoming ? 'success' : 'danger')" :icon-name="incoming ? 'arrow-down' : 'arrow-up'" />
      </div>
      <div class="col-2 ms-1">
        <span>{{(new Date(timeString)).toLocaleTimeString()}}</span>
      </div>
      <div class="col-3">
        <div class="badge bg-secondary" v-if="type">
          {{type}}
        </div>
      </div>
      <div class="col">
        {{service}}
      </div>
      <div class="col-1">
        <button class="btn text-secondary" title="See payload" :disabled="!data || !data.data || Object.entries(data.data).length === 0" @click="showPayload = !showPayload">
          <LoadIcon icon-name="envelope" />
        </button>
      </div>
    </div>
    <div class="row" v-if="showPayload">
      <JsonEditor :content="data.data" readonly/>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/icons/LoadIcon.vue";
import JsonEditor from "@/basic/editor/JsonEditor.vue";

export default {
  name: "MessageItem",
  components: {JsonEditor, LoadIcon},
  props: {
    timeString: {
      type: String,
      required: false,
      default: null
    },
    incoming: {
      type: Boolean,
      required: true
    },
    service: {
      type: String,
      required: true
    },
    data: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      showPayload: false
    }
  },
  computed: {
    type() {
      if(this.data) {
        if(this.data.type){
          return this.data.type
        } else {
          return this.data.command ? this.data.command : "request"
        }
      }
      return null;
    }
  }
}
</script>

<style scoped>

</style>