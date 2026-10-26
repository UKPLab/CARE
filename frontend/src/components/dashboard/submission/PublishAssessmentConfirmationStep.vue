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
      :disabled="allMatching"
      @change="$emit('update:linkCollection', $event.target.value)"
    >
      <option value="studies">{{ $t("submission.publishAssessment.hashCollectionStudies") }}</option>
      <option value="sessions">{{ $t("submission.publishAssessment.hashCollectionSessions") }}</option>
    </select>
  </div>
  <div class="mb-3">
    <p><b>{{ $t("submission.publishAssessment.hashes") }}</b></p>
    <!-- Select-all is the query, not a row list: 10k+ hashes cannot be rendered -->
    <p
      v-if="allMatching"
      class="text-muted"
    >
      {{ $t("submission.publishAssessment.allMatchingSelected", { count: selectedCount }) }}
    </p>
    <ul v-else-if="linkCollection === 'studies'">
      <li
        v-for="study in formattedStudies"
        :key="study.study.id"
      >
        <b>{{ study.study.name }} ({{ study.study.ownerFirstName }} {{ study.study.ownerLastName }})</b>
        <ul>
          <li
            v-for="session in study.sessions"
            :key="session.id"
          >
            {{ session.firstName }} {{ session.lastName }} (<a
              :href="sessionReviewLink(session.hash)"
              target="_blank"
            >{{ session.hash }}</a>)
          </li>
        </ul>
      </li>
    </ul>
    <ul v-else-if="linkCollection === 'sessions'">
      <li
        v-for="reviewer in formattedSessions"
        :key="reviewer.userId"
      >
        <b>{{ reviewer.firstName }} {{ reviewer.lastName }}</b>
        <ul>
          <li
            v-for="s in reviewer.sessions"
            :key="s.id"
          >
            {{ s.studyName }} (<a
              :href="sessionReviewLink(s.hash)"
              target="_blank"
            >{{ s.hash }}</a>)
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script>
import { sessionReviewLink } from "./helpers/publishAssessmentTables.js";

/**
 * Confirmation step (step 4) of the assessment publishing wizard.
 *
 * Displays study/session hash links for the ticked sessions (study_session rows
 * from the session BackendTable). When the whole session query is selected
 * ("all matching"), only the count is shown: the rows are resolved server-side
 * on submit. The parent owns linkCollection and passes it via v-model so the
 * user's selection persists when navigating between steps.
 *
 * @author CARE Team
 */
export default {
  name: "PublishAssessmentConfirmationStep",
  props: {
    /** Ticked study_session rows (empty in "all matching" mode). */
    selectedSessions: {
      type: Array,
      required: true,
    },
    linkCollection: {
      type: String,
      required: true,
    },
    /** Every row of the session query is selected, minus the unticked ones. */
    allMatching: {
      type: Boolean,
      default: false,
    },
    /** Number of selected sessions, also in "all matching" mode. */
    selectedCount: {
      type: Number,
      default: 0,
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
              name: session.studyName || this.$t("common.unknown"),
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
        if (!userMap[session.userId]) {
          userMap[session.userId] = {
            userId: session.userId,
            firstName: session.firstName || this.$t("common.unknown"),
            lastName: session.lastName || "",
            sessions: [],
          };
        }
        userMap[session.userId].sessions.push(session);
      });
      return Object.values(userMap);
    },
  },
  methods: {
    sessionReviewLink,
  },
};
</script>
