<template>
  <div>
    <div v-if="wait">
      <BasicLoading/>
    </div>
    
    <div class="mb-3">
      <h6>{{ $t('dashboard.projects.export.confirmSelection') }}</h6>

      <div v-if="hasDeclinedSharingSelected" class="alert alert-danger mt-3">
        <i18n-t
          :keypath="exportTypeConfig.warningKey"
          tag="span"
        >
          <template #emphasis>
            <strong>{{ $t(exportTypeConfig.emphasisKey) }}</strong>
          </template>
        </i18n-t>
      </div>

      <div v-if="generateAliases" class="alert alert-danger mt-3">
        {{ $t('dashboard.projects.export.aliasMappingWarning') }}
      </div>

      <div class="alert alert-danger mt-3">
        {{ $t('dashboard.projects.export.reviewWarning') }}
      </div>
      
      <div class="alert alert-info">
        <strong>{{ $t('dashboard.projects.export.summary') }}</strong><br />
        <i18n-t keypath="dashboard.projects.export.downloadSummary" tag="span">
          <template #type>
            <span>{{ exportTypeLabel }}</span>
          </template>
          <template #count>
            <strong>{{ userSelection.length }}</strong>
          </template>
        </i18n-t>
      </div>

      <div class="card card-body bg-body-tertiary" style="max-height: 150px; overflow-y: auto;">
        <ul class="mb-0 pl-3">
          <li v-for="row in userSelectionDisplay" :key="row.userId">
            {{ row.name }}<span v-if="row.suffix"> ({{ row.suffix }})</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import BasicLoading from "@/basic/Loading.vue";

/**
 * StepConfirmDownload
 *
 * The final confirmation step within the ExportModal. 
 * This component provides a summary of the selected 
 * data intended for download, as well as some
 * warnings for the user, if they selected generate aliases
 * or students who didn't accept data sharing.
 *
 * @author Mélissa Loew
 */
export default {
  name: "StepConfirmDownload",
  components: { BasicLoading },
  props: {
    wait: {
      type: Boolean,
      default: false
    },
    generateAliases: {
      type: Boolean,
      default: false
    },
    userSelection: {
      type: Array,
      required: true
    },
    exportType: {
      type: String,
      default: 'submissions'
    }
  },
  computed: {
    // Everything that varies by export type in this component: which consent flag and
    // wording the "declined sharing" warning uses, and which per-user unit label (or none)
    // to show in the selection list. Adding another export type only needs a new override
    // entry (or none, if the default fits).
    exportTypeConfig() {
      const defaultConfig = {
        consentField: 'acceptDataSharing',
        warningKey: 'dashboard.projects.export.declinedSharingWarning',
        emphasisKey: 'dashboard.projects.export.declinedSharingEmphasis',
        unitKey: 'documents',
      };
      const overridesByExportType = {
        submissions: { unitKey: 'submissions' },
        grades: { unitKey: null },
        studies: { unitKey: 'studies' },
        userBehaviour: {
          consentField: 'acceptStatsSharing',
          warningKey: 'dashboard.projects.export.declinedStatsSharingWarning',
          emphasisKey: 'dashboard.projects.export.declinedStatsSharingEmphasis',
          unitKey: null,
        },
      };
      return { ...defaultConfig, ...(overridesByExportType[this.exportType] || {}) };
    },
    hasDeclinedSharingSelected() {
      const field = this.exportTypeConfig.consentField;
      return this.userSelection.some(row => row[field] === false);
    },
    exportTypeLabel() {
      const labels = this.$tm('dashboard.projects.export.typeLabel');
      return labels[this.exportType] || labels.documents;
    },
    userSelectionDisplay() {
      const unitKey = this.exportTypeConfig.unitKey;
      return this.userSelection.map(row => ({
        userId: row.userId,
        name: row.fullName || row.userName,
        suffix: unitKey ? this.$t(`dashboard.projects.export.unitCount.${unitKey}`, { count: row.count }) : null,
      }));
    },
  }
}
</script>