<template>
  <div>
    <div v-if="wait">
      <BasicLoading/>
    </div>
    
    <div class="mb-3">
      <h6>{{ $t('dashboard.projects.export.confirmSelection') }}</h6>

      <div v-if="hasDeclinedSharingSelected" class="alert alert-danger mt-3">
        <i18n-t
          :keypath="declinedSharingWarningKey"
          tag="span"
        >
          <template #emphasis>
            <strong>{{ $t(declinedSharingEmphasisKey) }}</strong>
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
    // Which consent flag and wording the "declined sharing" warning uses, per export type.
    // Adding another consent-flavored export type only needs a new entry here.
    declinedSharingConfig() {
      const configsByExportType = {
        userBehaviour: {
          field: 'acceptStatsSharing',
          warningKey: 'dashboard.projects.export.declinedStatsSharingWarning',
          emphasisKey: 'dashboard.projects.export.declinedStatsSharingEmphasis',
        },
      };
      return configsByExportType[this.exportType] || {
        field: 'acceptDataSharing',
        warningKey: 'dashboard.projects.export.declinedSharingWarning',
        emphasisKey: 'dashboard.projects.export.declinedSharingEmphasis',
      };
    },
    hasDeclinedSharingSelected() {
      const field = this.declinedSharingConfig.field;
      return this.userSelection.some(row => row[field] === false);
    },
    declinedSharingWarningKey() {
      return this.declinedSharingConfig.warningKey;
    },
    declinedSharingEmphasisKey() {
      return this.declinedSharingConfig.emphasisKey;
    },
    exportTypeLabel() {
      const labels = this.$tm('dashboard.projects.export.typeLabel');
      return labels[this.exportType] || labels.documents;
    },
    userSelectionDisplay() {
      const unitKeyByExportType = {
        submissions: 'submissions',
        studies: 'studies',
      };
      const unitKey = unitKeyByExportType[this.exportType] || 'documents';
      return this.userSelection.map(row => ({
        userId: row.userId,
        name: row.fullName || row.userName,
        suffix: ['grades', 'userBehaviour'].includes(this.exportType)
          ? null
          : this.$t(`dashboard.projects.export.unitCount.${unitKey}`, { count: row.count }),
      }));
    },
  }
}
</script>