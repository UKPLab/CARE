<template>
  <template v-if="setting">
    <label
      class="col-md-4 col-form-label text-md-right"
      :for="'set-' + setting.key"
      @click="(setting.type === 'boolean' || setting.type === 'bool') && $event.preventDefault()"
    >
      <div class="d-inline-flex align-items-center gap-1 flex-wrap justify-content-md-end">
        <span>{{ setting.displayName || setting.key }}</span>
        <FormHelp
          v-if="setting.description"
          :help="setting.description"
          icon-name="info-circle"
          button-class="text-muted flex-shrink-0"
        />
      </div>
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
import FormHelp from "@/basic/form/Help.vue";

/**
 * SettingItem - Renders a single setting row (label + input).
 * Uses displayName and description from DB; description is shown under the label (wizard-style) with a gray (i) hint next to the title.
 */
export default {
  name: "SettingItem",
  components: { EditorModal, FormHelp },
  props: {
    setting: {
      type: Object,
      default: null,
    },
  },
};
</script>
