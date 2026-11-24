<template>
  <div v-if="problemReportEnabled">
    <BasicButton
      id="problemReportButton"
      class="btn problem-report-button"
      icon="bug"
      text=""
      :title="$t('problemReport.button')"
      :aria-label="$t('problemReport.button')"
      aria-haspopup="dialog"
      @click="$refs.problemReportModal.open()"
    >
      <LoadIcon
        :size="22"
        icon-name="bug"
      />
    </BasicButton>
    <ProblemReportModal ref="problemReportModal" />
  </div>
</template>

<script>
/**
 * Floating bottom-right button that opens the problem report form on every signed-in page.
 *
 * Hidden when report settings are missing or the feature is disabled.
 *
 * @author Akash Gundapuneni
 */
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";
import ProblemReportModal from "@/components/problem_report/ProblemReportModal.vue";
import { readReportSettings } from "@/assets/problemReport.js";

export default {
  name: "ProblemReportLauncher",
  components: {LoadIcon, BasicButton, ProblemReportModal},
  computed: {
    problemReportEnabled() {
      return readReportSettings(this.$store.getters["settings/getValue"]).enabled;
    },
  },
}
</script>

<style>
/* Floats above page content but below Bootstrap modals (z-index 1050+).
   The id selector outranks Bootstrap's .btn radius, border and padding. */
#problemReportButton {
  position: fixed;
  right: 0;
  bottom: 0;
  transform: translate(50%, 50%);
  z-index: 1040;
  width: 52px;
  height: 52px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  color: var(--care-on-primary);
  background: var(--care-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out, filter 0.15s ease-in-out;
}

#problemReportButton:hover,
#problemReportButton:focus-visible {
  color: var(--care-on-primary);
  background: var(--care-primary);
  filter: brightness(0.92);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  transform: translate(-8px, -8px);
}

#problemReportButton:active {
  filter: brightness(0.85);
}

#problemReportButton:focus-visible {
  outline: 2px solid var(--care-primary);
  outline-offset: 3px;
}

@media (hover: none) {
  #problemReportButton {
    transform: translate(-8px, -8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  #problemReportButton {
    transition: none;
  }
}

@media print {
  #problemReportButton {
    display: none;
  }
}
</style>
