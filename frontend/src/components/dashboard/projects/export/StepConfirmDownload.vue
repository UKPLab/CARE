<template>
  <div>
    <div v-if="wait">
      <BasicLoading/>
    </div>
    
    <div class="mb-3">
      <h6>Confirm Selection:</h6>

      <div v-if="hasDeclinedSharingSelected" class="alert alert-danger mt-3">
        You have selected one or more students who <strong>didn't accept data sharing</strong>.
      </div>

      <div v-if="generateAliases" class="alert alert-danger mt-3">
        The downloaded ZIP archive will include a CSV file that maps the generated aliases back to the real student names.
      </div>

      <div class="alert alert-danger mt-3">
        We strongly recommend conducting a thorough review of this export before sharing it, to ensure no sensitive or unintended information is distributed.
      </div>
      
      <div class="alert alert-info">
        <strong>Summary:</strong><br />
        You are about to download 
        <span v-if="exportType === 'submissions'">submissions</span>
        <span v-else-if="exportType === 'studies'">studies</span>
        <span v-else>documents</span>
        for <strong>{{ userSelection.length }}</strong> users(s).
      </div>

      <div class="card card-body bg-light" style="max-height: 150px; overflow-y: auto;">
        <ul class="mb-0 pl-3">
          <li v-for="row in userSelection" :key="row.userId">
            {{ row.studentName || row.userName }} ({{ row.count }} {{ exportType === 'submissions' ? 'submission(s)' : exportType === 'studies' ? 'studies' : 'document(s)' }})
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
    hasDeclinedSharingSelected() {
      return this.userSelection.some(row => row.acceptDataSharing === 'No');
    }
  }
}
</script>