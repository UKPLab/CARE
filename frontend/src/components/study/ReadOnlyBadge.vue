<template>
  <!-- "Read-only" with a lock in the middle of the top bar -->
  <Teleport to="#topbarCenterPlaceholder">
    <div v-show="show" :title="$t('common.readOnly')">
      <span :style="{ color: 'var(--bs-danger-text-emphasis)', fontWeight: 'bold' }">
        {{ $t('common.readOnly') }}
      </span>
      <LoadIcon :size="22" :color="'var(--bs-danger-text-emphasis)'" icon-name="lock-fill"/>
    </div>
  </Teleport>
</template>

<script>
/**
 * Read-only label in the top bar of a study, used by Study.vue
 *
 * @author Ilyas Mohammed
 */
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "ReadOnlyBadge",
  components: {LoadIcon},
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
}
</script>
