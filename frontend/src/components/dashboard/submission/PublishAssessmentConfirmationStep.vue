<template>
  <div class="mb-3">
    <label
      for="linkCollection"
      class="form-label"
    ><b>{{ $t("submission.publishAssessment.hashCollection") }}</b></label>
    <select
      id="linkCollection"
      :value="linkCollection"
      class="form-select"
      @change="$emit('update:linkCollection', $event.target.value)"
    >
      <option value="studies">{{ $t("submission.publishAssessment.hashCollectionStudies") }}</option>
      <option value="sessions">{{ $t("submission.publishAssessment.hashCollectionSessions") }}</option>
    </select>
  </div>
  <div class="mb-3">
    <p><b>{{ $t("submission.publishAssessment.hashes") }}</b></p>
    <ul v-if="linkCollection === 'studies'">
      <li
        v-for="study in formattedStudies"
        :key="study.study.id"
      >
        <b>{{ study.study.name }} ({{ study.study.ownerFirstName }} {{ study.study.ownerLastName }})</b>
        <ul>
          <li
            v-for="session in study.sessions"
            :key="session.sessionId"
          >
            {{ session.firstName }} {{ session.lastName }} (<a
              :href="session.link"
              target="_blank"
            >{{ session.hash }}</a>)
          </li>
        </ul>
      </li>
    </ul>
    <ul v-else-if="linkCollection === 'sessions'">
      <li
        v-for="(sessions, odx) in formattedSessions"
        :key="odx"
      >
        <b>{{ sessions[0].firstName }} {{ sessions[0].lastName }}</b>
        <ul>
          <li
            v-for="s in sessions"
            :key="s.sessionId"
          >
            {{ s.studyName }} (<a
              :href="s.link"
              target="_blank"
            >{{ s.hash }}</a>)
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script>
/**
 * Confirmation step (step 4) of the assessment publishing wizard.
 *
 * Displays study/session hash links for the selected sessions.
 * The parent owns linkCollection and passes it via v-model so
 * the user's selection persists when navigating between steps.
 *
 * @author CARE Team
 */
export default {
  name: "PublishAssessmentConfirmationStep",
  props: {
    selectedSessions: {
      type: Array,
      required: true,
    },
    linkCollection: {
      type: String,
      required: true,
    },
  },
  emits: ["update:linkCollection"],
  computed: {
    formattedStudies() {
      // Group selected sessions by study
      const studyMap = {};
      this.selectedSessions.forEach((session) => {
        const studyId = session.studyId;
        if (!studyMap[studyId]) {
          studyMap[studyId] = {
            study: {
              id: studyId,
              name: session.studyName,
              ownerFirstName: session.ownerFirstName || "-",
              ownerLastName: session.ownerLastName || "-",
            },
            sessions: [],
          };
        }
        studyMap[studyId].sessions.push(session);
      });
      return Object.values(studyMap);
    },
    formattedSessions() {
      // Group selected sessions by reviewer (userId)
      const userMap = {};
      this.selectedSessions.forEach((session) => {
        const key = session.userId;
        if (!userMap[key]) {
          userMap[key] = [];
        }
        userMap[key].push(session);
      });
      return userMap;
    },
  },
};
</script>
