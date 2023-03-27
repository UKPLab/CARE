<template>
  <BasicCoordinator
    ref="coordinator"
    table="tag_set"
    title="Tag Sets Editor"
    @submit="publish"
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
  computed: {
    tag_set() {
      if (this.tagSetId !== 0) {
        return {...this.$store.getters['tag/getTagSet'](this.tagSetId)};
      }
      return {};
    },
  },
  methods: {
    open(tagSetId) {
      this.$refs.coordinator.open(tagSetId);
    },
    publish(data) {
      this.sockets.subscribe("studyPublished", (data) => {
        this.sockets.unsubscribe('studyPublished');
        if (data.success) {
          this.hash = data.studyHash;

          this.$refs.coordinator.showSuccess();

          this.eventBus.emit('toast', {
            title: "Study published",
            message: "Successfully started study!",
            variant: "success"
          });
        } else {
          this.$refs.coordinator.close();

          this.eventBus.emit('toast', {title: "Study not published", message: data.message, variant: "danger"});
        }
      });
      this.$socket.emit("studyPublish", data);
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