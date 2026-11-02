<template>
  <div class="settings-group">
    <h2 class="settings-group-title">{{ translateMaybeKey(title) }}</h2>
    <section
      v-for="(subsection, idx) in subsections"
      :key="subsection.title || idx"
      class="settings-subsection"
    >
      <h3 v-if="subsection.title" class="settings-subsection-title">
        {{ translateMaybeKey(subsection.title) }}
      </h3>
      <div class="settings-rows">
        <div
          v-for="key in subsection.keys"
          :key="key"
          class="row settings-row"
        >
          <SettingItem
            :setting="getSetting(key)"
            @update:value="(v) => setSettingValue(key, v)"
          />
        </div>
      </div>
    </section>
    <slot name="footer" />
  </div>
</template>

<script>
import SettingItem from "@/components/dashboard/settings/SettingItem.vue";
import { translateMaybeKey } from "@/assets/utils";

/**
 * SettingsSection - One settings group, shown beside the group list.
 *
 * @param {string} title - Section heading (e.g. "General", "Mail")
 * @param {Array<{title: string, keys: string[]}>} subsections - Subsections with keys
 * @param {Array} settings - Flat array of setting objects
 */
export default {
  name: "SettingsSection",
  components: { SettingItem },
  props: {
    title: { type: String, required: true },
    subsections: { type: Array, required: true },
    settings: { type: Array, default: () => [] },
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

<style scoped>
.settings-group-title {
  margin: 0 0 16px;
  font-size: 1.15rem;
  font-weight: 600;
}

.settings-subsection + .settings-subsection {
  margin-top: 28px;
}

.settings-subsection-title {
  margin: 0 0 8px;
  font-size: .75rem;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
}

.settings-rows {
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: var(--bs-border-radius-lg);
  background: var(--bs-body-bg);
}

.settings-row {
  align-items: center;
  margin: 0;
  padding: 14px 16px;
  border-bottom: 1px solid var(--bs-border-color-translucent);
}

.settings-row:last-child {
  border-bottom: 0;
}

.settings-row :deep(.col-form-label) {
  text-align: start !important;
}
</style>
