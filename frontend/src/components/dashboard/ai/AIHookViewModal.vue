<template>
  <BasicModal ref="aiHookViewModal" name="aiHookViewModal" size="lg">
    <template #title>
      AI Hook
    </template>
    <template #body>
      <div v-if="hook">
        <dl class="row mb-0">
          <dt class="col-sm-4">Name</dt>
          <dd class="col-sm-8">{{ hook.name || "-" }}</dd>

          <dt class="col-sm-4">Description</dt>
          <dd class="col-sm-8">{{ hook.description || "-" }}</dd>

          <dt class="col-sm-4">Prompt Template</dt>
          <dd class="col-sm-8">{{ hook.templateName || "-" }}</dd>

          <dt class="col-sm-4">Models</dt>
          <dd class="col-sm-8">
            <ol v-if="hook.models?.length" class="mb-0 ps-3">
              <li v-for="model in hook.models" :key="`${model.priority}-${model.aiModelId}`">
                {{ model.name }}
              </li>
            </ol>
            <span v-else>-</span>
          </dd>

          <dt class="col-sm-4">Output Type</dt>
          <dd class="col-sm-8">{{ hook.outputLabel || "-" }}</dd>

          <dt class="col-sm-4">Status</dt>
          <dd class="col-sm-8">{{ hook.statusLabel || "-" }}</dd>

          <dt class="col-sm-4">Created</dt>
          <dd class="col-sm-8">{{ formatDate(hook.createdAt) }}</dd>

          <dt class="col-sm-4">Updated</dt>
          <dd class="col-sm-8">{{ formatDate(hook.updatedAt) }}</dd>
        </dl>
      </div>
    </template>
    <template #footer>
      <BasicButton
        title="Close"
        class="btn btn-secondary"
        @click="$refs.aiHookViewModal.close()"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "AIHookViewModal",
  components: { BasicModal, BasicButton },
  data() {
    return {
      hook: null,
    };
  },
  methods: {
    open(hook) {
      this.hook = hook;
      this.$refs.aiHookViewModal.open();
    },
    formatDate(value) {
      if (!value) return "-";
      return new Date(value).toLocaleString();
    },
  },
};
</script>
