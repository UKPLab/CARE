<template>
  <BasicButton
    class="btn btn-outline-secondary"
    :disabled="isTesting"
    :text="isTesting ? $t('ai.models.testing') : $t('ai.models.sendTestPrompt')"
    @click="sendTestPrompt"
  />
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Sends a test prompt to a (possibly unsaved) model configuration and shows
 * the model's answer, or the error, as a toast.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "AIModelTestButton",
  components: { BasicButton },
  props: {
    /** Form values of the model being edited (id, aiCredentialId, model, additionalParameters). */
    modelForm: {
      type: Object,
      required: true,
    },
    /** Validates the surrounding form; the test only runs when it returns true. */
    validate: {
      type: Function,
      required: true,
    },
  },
  data() {
    return {
      isTesting: false,
    };
  },
  methods: {
    async sendTestPrompt() {
      if (!this.validate()) return;

      this.isTesting = true;
      try {
        const result = await this.$ai.testModel({
          aiModelId: this.modelForm.id || null,
          credentialId: this.modelForm.aiCredentialId,
          model: this.modelForm.model.trim(),
          additionalParameters: this.modelForm.additionalParameters || {},
        });
        const outputText = result?.outputText ? String(result.outputText) : "";
        this.eventBus.emit("toast", {
          title: this.$t("ai.common.success"),
          message: outputText ? this.$t("ai.messages.modelTestOutput", { output: outputText }) : this.$t("ai.messages.modelTestSuccess"),
          variant: "success",
        });
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t("ai.common.error"),
          message: resolveApiMessage(error, "ai.errors.modelTestFailed"),
          variant: "danger",
        });
      } finally {
        this.isTesting = false;
      }
    },
  },
};
</script>
