<template>
  <template v-if="setting">
    <label
      class="col-md-4 col-form-label text-md-right"
      :for="'set-' + setting.key"
      @click="(setting.type === 'boolean' || setting.type === 'bool') && $event.preventDefault()"
    >
      {{ setting.displayName || setting.key }}
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
      <FormHelp v-if="setting.description" :help="setting.description" class="ms-1" />
    </div>
  </template>
</template>

<script>
import EditorModal from "@/basic/editor/Modal.vue";
import FormHelp from "@/basic/form/Help.vue";

/**
 * SettingItem - Renders a single setting row (label + input).
 * Uses displayName and description from DB.
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
