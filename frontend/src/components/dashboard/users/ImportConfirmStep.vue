<template>
  <div class="confirm-container">
    <BasicIcon
      icon-name="person-fill-up"
      size="64"
    />
    <p>
      Are you sure you want to bulk create <strong>{{ newCount }}</strong> users <br />
      and overwrite <strong>{{ duplicateCount }}</strong> users?
    </p>
    <p
      v-if="duplicateCount > 0"
      class="alert alert-warning role-replacement-warning"
      role="alert"
    >
      The existing CARE roles of these users will be replaced by the basic User role and the mapped roles selected in the previous step.
    </p>
  </div>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";

/**
 * Summarize the pending bulk import before it is executed.
 */
export default {
  name: "ImportConfirmStep",
  components: { BasicIcon },
  props: {
    newCount: {
      type: Number,
      required: true,
    },
    duplicateCount: {
      type: Number,
      required: true,
    },
  },
};
</script>

<style scoped>
.confirm-container {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  text-align: center;
}

.role-replacement-warning {
  max-width: 600px;
  margin-bottom: 0;
}
</style>
