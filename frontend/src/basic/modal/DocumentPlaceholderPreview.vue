<template>
    <!-- Short Preview -->
    <div v-if="shortPreview" class="short-preview mb-4">
      <h6 class="section-title">{{ $t('modals.placeholders.documentPreview') }}</h6>
      <PreviewContent :html="shortPreview" />
    </div>

    <!-- Placeholder Legend -->
    <div v-if="placeholders.length" class="legend mb-4">
      <h6 class="section-title">{{ $t('modals.placeholders.placeholderLegend') }}</h6>
      <div class="legend-items">
        <span
          v-for="(placeholder, index) in placeholders"
          :key="index"
          class="legend-item"
          :style="{ color: placeholderColors[index] }"
        >
          {{ placeholder.text }} ({{ placeholder.type }})
        </span>
      </div>
    </div>

</template>
<script>
import {resolveApiMessage} from '@/assets/utils';
import Quill from 'quill';
import {h} from 'vue';
import DOMPurify from 'dompurify';
const PreviewContent={props:{html:{type:String,default:''}},render(){return h('div',{class:'preview-content',innerHTML:DOMPurify.sanitize(this.html)});}};
export default {
  name:'DocumentPlaceholderPreview', components:{PreviewContent},
  props:{documentId:{type:Number,default:null},studyStepId:{type:Number,required:true},studySessionId:{type:Number,default:null}},
  emits:['loaded'],
  data(){return {placeholders:[],placeholderColors:[],shortPreview:'',isInitialized:false,placeholderType:{text:'text',chart:'chart',comparison:'comparison'}};},
  mounted(){if(this.documentId&&!this.isInitialized)this.fetchDocument();},
  methods:{
    fetchDocument() {
      if (!this.documentId || !this.studyStepId) return;

      const requestData = {
        documentId: this.documentId,
        studyStepId: this.studyStepId,
        studySessionId: this.studySessionId || null,
      };

      this.$socket.emit("documentGet", requestData, (response) => {
        if (response.success) {
          const { deltas } = response.data || {};
          if (deltas?.ops) {
            let quill = new Quill(document.createElement("div"));
            quill.setContents(deltas.ops);
            const docText = quill.getText();

            // Extract placeholders and generate colors
            this.placeholders = this.extractPlaceholders(docText);
            this.generatePlaceholderColors();
            this.generateShortPreview(docText);

            // Initialize placeholder form data
            this.$emit('loaded',{placeholders:this.placeholders,colors:this.placeholderColors});
            this.isInitialized = true;
          } else {
            console.error("Invalid document content:", response);
            this.eventBus?.emit("toast", {
              title: this.$t('modals.placeholders.documentError'),
              message: this.$t('modals.placeholders.invalidDocumentContent'),
              variant: "danger",
            });
          }
        } else {
          console.error("Failed to fetch document content:", response);
          this.eventBus.emit("toast", {
            title: this.$t('modals.placeholders.documentError'),
            message: resolveApiMessage(response) || this.$t('modals.placeholders.failedToFetchDocument'),
            variant: "danger",
          });
        }
      });
    },
    extractPlaceholders(text) {
      const textRegex = /~text~/g;
      const chartRegex = /~chart~/g;
      const comparisonRegex = /~comparison~/g;

      let match;
      const extracted = [];
      let textCounter = 1;
      let chartCounter = 1;
      let comparisonCounter = 1;

      // Extract text placeholders
      while ((match = textRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: textCounter++,
          type: this.placeholderType.text,
        });
      }

      // Extract chart placeholders
      while ((match = chartRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: chartCounter++,
          type: this.placeholderType.chart,
        });
      }

      // Extract comparison placeholders
      while ((match = comparisonRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: comparisonCounter++,
          type: this.placeholderType.comparison,
        });
      }

      // Sort by type and then by number
      return extracted.sort((a, b) => {
        if (a.type === b.type) {
          return a.number - b.number;
        }
        // Order: text -> chart -> comparison
        const typeOrder = { text: 0, chart: 1, comparison: 2 };
        return typeOrder[a.type] - typeOrder[b.type];
      });
    },
    generatePlaceholderColors() {
      const colors = ["#ff5733", "#33c3ff", "#ff33f6", "#33ff57", "#ffc133", "#a833ff", "#ff338f"];
      this.placeholderColors = this.placeholders.map((_, index) => colors[index % colors.length]);
    },
    generateShortPreview(text) {
      this.shortPreview = text.replace(/~nlp~/g, (match, num) => {
        const colorIndex = this.placeholders.findIndex((p) => p.number == num);
        const color = this.placeholderColors[colorIndex] || "#000";
        return `<span style="color: ${color}; font-weight: bold;">#${num}</span>`;
      });
    }
 },
};
</script>
<style scoped>
.section-title {
  color: var(--bs-body-color, #495057);
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color, #dee2e6);
}

.short-preview {
  background: var(--bs-tertiary-bg, #f8f9fa);
  border: 1px solid var(--bs-border-color, #ddd);
  border-radius: 0.5rem;
  padding: 1rem;
}

.preview-content {
  font-size: 14px;
  line-height: 1.5;
}

.legend {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.legend-items {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.legend-item {
  font-weight: bold;
  font-size: 12px;
  padding: 0.25rem 0.5rem;
  background-color: color-mix(in srgb, var(--bs-body-bg) 80%, transparent);
  border-radius: 0.25rem;
  border: 1px solid var(--bs-border-color-translucent);
}
</style>
