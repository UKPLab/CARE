<template>
  <div>
    <div v-if="wait">
      <BasicLoading/>
    </div>
    
    <div class="mb-3">
      <h6>{{ $t('dashboard.projects.export.confirmSelection') }}</h6>
      
      <div v-if="hasDeclinedSharingSelected" class="alert alert-danger mt-3">
        <i18n-t
          keypath="dashboard.projects.export.declinedSharingWarning"
          tag="span"
        >
          <template #emphasis>
            <strong>{{ $t('dashboard.projects.export.declinedSharingEmphasis') }}</strong>
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
          <template #count>
            <strong>{{ submissionSelection.length }}</strong>
          </template>
        </i18n-t>
      </div>

      <div class="card card-body bg-body-tertiary" style="max-height: 150px; overflow-y: auto;">
        <ul class="mb-0 pl-3">
          <li v-for="row in submissionSelection" :key="row.userId">
            {{ row.studentName || row.userName }} ({{ $t('dashboard.projects.export.fileCount', { count: row.fileCount }) }})
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
 * submissions intended for download, as well as some
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
    submissionSelection: {
      type: Array,
      required: true
    }
  },
  computed: {
    hasDeclinedSharingSelected() {
      return this.submissionSelection.some(row => row.acceptDataSharing === false);
    }
  }
}
</script>