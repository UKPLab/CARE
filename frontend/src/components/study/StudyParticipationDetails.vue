<template>
      <span>
        <div
            v-if="foreignUnstartedSession"
            class="text-xxl-center text-danger fs-5">
          {{ $t('studies.foreignUnstartedSession') }}
          <br>
          {{ $t('studies.cannotResumeSession') }}
        </div>
        <div
            v-else-if="!started"
            class="text-xxl-center text-secondary fs-5">
          {{ $t('studies.notStartedYet') }} <br>
          {{ $t('studies.messages.studyStartDate', { date: formatLocalizedDateTime(study.start) }) }}</div>
        <div
            v-else-if="studyClosed"
            class="text-xxl-center text-danger fs-5">
          {{ $t('studies.messages.studyFinished', { date: studyEnd }) }}</div>
        <div
            v-else-if="!sessionsAvailable && studySessionId === 0"
            class="text-xxl-center text-danger fs-5">
          {{ $t('studies.noMoreSessions') }}
        </div>
        <span v-else>
          <Editor
              v-if="study.description"
              :model-value="study.description"
              :read-only="true"
              class="ql-snow ql-container border"
          />
          <div v-else>
            {{ $t('studies.clickToStart') }}
          </div>
          <div v-if="study.timeLimit > 0 || study.collab">
            <hr>
          </div>
          <div
              v-if="study.timeLimit > 0"
              class="mt-1"
          >
            {{ $t('studies.messages.timeLimitNote', { minutes: study.timeLimit }) }}
          </div>
          <div
              v-if="study.collab"
              class="mt-1"
          >
            <i18n-t keypath="studies.collaborativeNote" tag="span">
              <template #collaborative>
                <b>{{ $t('studies.collaborativeEmphasis') }}</b>
              </template>
            </i18n-t>
          </div>
          <div
              v-if="studySessionId === 0 && study.limitSessionsPerUser > 0"
              class="mt-1"
          >
            <i18n-t keypath="studies.messages.sessionsLeft" tag="span">
              <template #sessions>
                <b>{{ $t('studies.messages.sessionsLeftEmphasis', { count: study.limitSessionsPerUser - totalNumberOfOpenedSessions }) }}</b>
              </template>
            </i18n-t>
          </div>
        </span>
      </span>
</template>

<script>
import Editor from "@/basic/editor/Editor.vue";
import {formatLocalizedDateTime} from "@/assets/utils";

export default {
  name: "StudyParticipationDetails",
  components: {Editor},
  props: {
    study: {type: Object, required: true},
    studyClosed: {type: Boolean, required: true},
    started: {type: Boolean, required: true},
    sessionsAvailable: {type: Boolean, required: true},
    foreignUnstartedSession: {type: Boolean, required: true},
    studySessionId: {type: Number, default: 0},
    totalNumberOfOpenedSessions: {type: Number, default: 0},
  },
  computed: {
studyEnd() {
      if (this.study) {
        if (this.study.closed) {
          return formatLocalizedDateTime(this.study.closed)
        }
        if (this.study.end) {
          return formatLocalizedDateTime(this.study.end)
        }
      }
      return "";
    }
  },
  methods: {formatLocalizedDateTime},
};
</script>
