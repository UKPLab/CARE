<template>
  <BasicTable
      :columns="sessionTableColumns"
      :data="rows"
      :options="sessionTableOptions"
      :buttons="buttons"
      max-table-height="60vh"
      @action="$emit('action', $event)"
  />
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import {formatLocalizedDateTime} from "@/assets/utils";

/** Study session badges and permitted row actions share the same study state. */
export default {
  name: "StudySessionPicker",
  components: {BasicTable},
  props: {
    sessions: {type: Array, required: true},
    study: {type: Object, required: true},
    studyClosed: {type: Boolean, required: true},
  },
  emits: ['action'],
  data() { return {sessionTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true
      }}; },
  computed: {
sessionTableColumns() {
      return [
        {name: this.$t('studies.columns.started'), key: "startParsed"},
        {
          name: this.$t('studies.columns.finished'),
          key: "finished",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: this.$t('studies.columns.resumable'),
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        }
      ];
    },
buttons() {
      return [
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            }
          },
          filter: [
            {key: "showResumeButton", value: true},
          ],
          title: this.$t('studies.resumeSession'),
          action: "resumeStudySession",
        },
        {
          icon: "box-arrow-in-right",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            }
          },
          filter: [
            {key: "showStartButton", value: true}
          ],
          title: this.$t('studies.startSession'),
          action: "startStudySession",
          stats: {
            studySessionId: "id",
          }
        },
        {
          icon: "x-octagon",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            }
          },
          filter: [
            {key: "finished", value: false}
          ],
          title: this.$t('studies.finishSession'),
          action: "finishSession",
          stats: {
            studySessionId: "id",
          }
        }
      ]
    },
    rows() { return this.sessions.map(s => {
              let session = {...s}
              session.resumable = this.study.resumable;
              session.startParsed = session.start ? formatLocalizedDateTime(session.start) : this.$t('studies.sessionNotStarted');
              session.finished = session.end !== null
              session.showResumeButton = session.resumable && session.start && !this.studyClosed;
              session.showStartButton = !session.start && !this.studyClosed;

              return session;
            }); },
  },
};
</script>
