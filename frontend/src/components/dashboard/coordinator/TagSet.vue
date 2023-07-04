<template>
  <BasicCoordinator
    ref="coordinator"
    table="tag_set"
    title="Tag Set"
  />
</template>

<script>
import BasicCoordinator from "@/basic/Coordinator.vue";

/**
 * TagSetModal - modal component for adding and editing tags sets
 *
 * @author Dennis Zyska
 */
export default {
  name: "CoordinatorTagSet",
  components: {BasicCoordinator},
  data() {
    return {
      tagSetId: 0,
    }
  },
  methods: {
    open(tagSetId, defaultValues = {}) {
      this.$refs.coordinator.open(tagSetId, defaultValues);
    },
    copy(tagSetId, defaultValues = {}) {
      this.$refs.coordinator.open(tagSetId, defaultValues, true);
    },
    close() {
      this.$refs.coordinator.close();
    },
    async copyURL() {
      try {
        await navigator.clipboard.writeText(this.link);
        this.eventBus.emit('toast', {
          title: "Link copied",
          message: "Document link copied to clipboard!",
          variant: "success"
        });
      } catch ($e) {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Could not copy document link to clipboard!",
          variant: "danger"
        });
      }
    }
  }
}
</script>

<style scoped>

</style>