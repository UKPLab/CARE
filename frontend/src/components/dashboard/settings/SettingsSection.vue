<template>
  <FormCollapsible
    :title="translateMaybeKey(title)"
    :collapsed="collapsed"
  >
    <template v-for="(subsection, idx) in subsections" :key="subsection.title || idx">
      <h6 v-if="subsection.title" class="step-group-heading mt-3">
        {{ translateMaybeKey(subsection.title) }}
      </h6>
      <div
        v-for="key in subsection.keys"
        :key="key"
        class="row my-2"
      >
        <SettingItem
          :setting="getSetting(key)"
          @update:value="(v) => setSettingValue(key, v)"
        />
      </div>
    </template>
    <slot name="footer" />
  </FormCollapsible>
</template>

<script>
import FormCollapsible from "@/basic/form/Collapsible.vue";
import SettingItem from "@/components/dashboard/settings/SettingItem.vue";
import { translateMaybeKey } from "@/assets/utils";

/**
 * SettingsSection - Renders a collapsible settings section with subsections.
 *
 * @param {string} title - Section heading (e.g. "General", "Mail")
 * @param {Array<{title: string, keys: string[]}>} subsections - Subsections with keys
 * @param {Array} settings - Flat array of setting objects
 */
export default {
  name: "SettingsSection",
  components: { FormCollapsible, SettingItem },
  props: {
    title: { type: String, required: true },
    subsections: { type: Array, required: true },
    settings: { type: Array, default: () => [] },
    collapsed: { type: Boolean, default: true },
  },
  methods: {
    translateMaybeKey,
    getSetting(key) {
      return this.settings.find((s) => s.key === key) || null;
    },
    setSettingValue(key, value) {
      const s = this.settings.find((x) => x.key === key);
      if (s) s.value = value;
    },
  },
};
</script>
