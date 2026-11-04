<template>
  <!-- The study description from the start pop-up, view-only, reopened from a button in the top bar -->
  <StudyModal
      ref="modal"
      info-only
      :study-id="studyId"
      :study-closed="studyClosed"
      :study-session-id="studySessionId"
  />
  <Teleport to="#topBarNavItems">
    <li v-if="showButton" class="nav-item">
      <TopBarButton
          class="btn rounded-circle"
          :title="$t('components.studyRoute.instructions')"
          :props="{ key: 'studyInstructions.open' }"
          @click="$refs.modal.open()"
      >
        <LoadIcon icon-name="info-circle" :size="18"/>
      </TopBarButton>
    </li>
  </Teleport>
</template>

<script>
/**
 * Top-bar button that shows the study description again during a started study session, used by Study.vue
 *
 * @author Ilyas Mohammed
 */
import StudyModal from "@/components/study/StudyModal.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "StudyInstructions",
  components: {StudyModal, TopBarButton, LoadIcon},
  props: {
    studyId: {
      type: Number,
      required: true,
    },
    studyClosed: {
      type: Boolean,
      required: true,
    },
    studySessionId: {
      type: Number,
      required: false,
      default: 0,
    },
    // Whether the study has a description to show
    showButton: {
      type: Boolean,
      default: false,
    },
  },
}
</script>