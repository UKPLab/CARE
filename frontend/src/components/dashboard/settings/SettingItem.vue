<template>
  <template v-if="setting">
    <label
      class="col-md-4 col-form-label text-md-right"
      :for="'set-' + setting.key"
      @click="(setting.type === 'boolean' || setting.type === 'bool') && $event.preventDefault()"
    >
      <div class="d-inline-flex align-items-center gap-1 flex-wrap justify-content-md-end">
        <span>{{ setting.displayName || setting.key }}</span>
        <span
          v-if="setting.description"
          class="text-muted flex-shrink-0"
          aria-hidden="true"
        >
          <LoadIcon icon-name="info-circle" :size="14" />
        </span>
      </div>
      <div
        v-if="setting.description"
        class="small text-muted mt-1 fw-normal text-break"
        v-html="setting.description"
      />
    </label>
    <div class="col-md-6 d-flex align-items-start">
      <template v-if="setting.type === 'edits'">
        <EditorModal
          :model-value="setting.value"
          :title="'Edit ' + setting.key"
          @update:model-value="$emit('update:value', $event)"
        />
      </template>
      <template v-else-if="setting.type === 'boolean' || setting.type === 'bool'">
        <div class="form-check form-switch">
          <input
            :id="'set-' + setting.key"
            :checked="setting.value === 'true'"
            class="form-check-input"
            type="checkbox"
            @change="$emit('update:value', $event.target.checked ? 'true' : 'false')"
          />
        </div>
      </template>
      <input
        v-else
        :id="'set-' + setting.key"
        :value="setting.value"
        class="form-control"
        type="text"
        @input="$emit('update:value', $event.target.value)"
      />
    </div>
  </template>
</template>

<script>
import EditorModal from "@/basic/editor/Modal.vue";
import LoadIcon from "@/basic/Icon.vue";

/**
 * SettingItem - Renders a single setting row (label + input).
 * Uses displayName and description from DB; description is shown under the label (wizard-style) with a gray (i) hint next to the title.
 */
export default {
  name: "SettingItem",
  components: { EditorModal, LoadIcon },
  props: {
    setting: {
      type: Object,
      default: null,
    },
  },
};
</script>
