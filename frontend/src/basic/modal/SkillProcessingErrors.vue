<template>
        <!-- Errors Display -->
        <div v-if="errors.length" class="mt-3">
          <h6 class="text-danger">{{ $t('nlp.preprocessing.processStepper.errors.title') }}</h6>
          <div
            v-for="(error, index) in errors"
            :key="index"
            class="alert alert-danger py-2 mb-2"
            role="alert"
          >
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <strong>{{ $t('nlp.preprocessing.processStepper.errors.errorLabel') }}</strong>
                {{ resolveApiMessage(error) }}
              </div>
              <small class="text-muted ms-2">
                {{ formatTimestamp(error.timestamp) }}
              </small>
            </div>
            <small v-if="error.submissionId" class="text-muted">
              {{ $t('nlp.preprocessing.processStepper.errors.submissionId') }}: {{ error.submissionId }}
            </small>
            <small v-else-if="error.documentId" class="text-muted">
              {{ $t('nlp.preprocessing.processStepper.errors.documentId') }}: {{ error.documentId }}
            </small>
          </div>
        </div>

</template>
<script>
import {resolveApiMessage, formatLocalizedTime} from '@/assets/utils';
export default {
  name:'SkillProcessingErrors', props:{errors:{type:Array,default:()=>[]}},
  methods:{resolveApiMessage, formatTimestamp:formatLocalizedTime},
};
</script>
