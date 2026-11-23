<script>
import { h } from 'vue';
import DOMPurify from 'dompurify';

/** Render the rich-text example preview through one sanitization boundary. */
export default {
  name: 'TemplatePreviewHtml',
  props: {
    html: { type: String, default: '' },
  },
  render() {
    return h('div', { innerHTML: DOMPurify.sanitize(this.html) });
  },
};
</script>
