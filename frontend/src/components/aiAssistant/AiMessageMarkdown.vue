<template>
  <!-- eslint-disable-next-line vue/no-v-html -- content is sanitized by DOMPurify below -->
  <div class="ai-markdown" v-html="renderedHtml" />
</template>

<script>
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

// Shared parser. `html: false` blocks raw HTML in the markdown; DOMPurify then
// sanitizes the rendered output, which is the actual XSS trust boundary
// (OWASP XSS Prevention Cheat Sheet). Both layers are intentional.
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

// Open links safely in a new tab without exposing the opener.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Renders assistant markdown as sanitized HTML.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiMessageMarkdown",
  props: {
    text: {
      type: String,
      required: false,
      default: "",
    },
  },
  computed: {
    /**
     * Markdown rendered to HTML and sanitized before it reaches the DOM.
     *
     * @returns {string} Safe HTML string.
     */
    renderedHtml() {
      return DOMPurify.sanitize(markdown.render(this.text || ""));
    },
  },
};
</script>

<style scoped>
.ai-markdown {
  line-height: 1.5;
  word-break: break-word;
}

/* v-html content is not scoped, so reach it with :deep. */
.ai-markdown :deep(> :first-child) {
  margin-top: 0;
}

.ai-markdown :deep(p),
.ai-markdown :deep(ul),
.ai-markdown :deep(ol),
.ai-markdown :deep(pre),
.ai-markdown :deep(blockquote),
.ai-markdown :deep(table) {
  margin: 0 0 0.5rem;
}

.ai-markdown :deep(> :last-child) {
  margin-bottom: 0;
}

.ai-markdown :deep(ul),
.ai-markdown :deep(ol) {
  padding-left: 1.25rem;
}

.ai-markdown :deep(li) {
  margin-bottom: 0.15rem;
}

.ai-markdown :deep(h1),
.ai-markdown :deep(h2),
.ai-markdown :deep(h3),
.ai-markdown :deep(h4) {
  margin: 0.5rem 0 0.35rem;
  font-weight: 600;
}

.ai-markdown :deep(h1) {
  font-size: 1.25rem;
}

.ai-markdown :deep(h2) {
  font-size: 1.15rem;
}

.ai-markdown :deep(h3) {
  font-size: 1.05rem;
}

.ai-markdown :deep(h4) {
  font-size: 1rem;
}

.ai-markdown :deep(a) {
  color: var(--bs-link-color);
}

.ai-markdown :deep(code) {
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
  background: var(--bs-secondary-bg);
  font-size: 0.85em;
}

.ai-markdown :deep(pre) {
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  background: var(--bs-secondary-bg);
  overflow-x: auto;
}

.ai-markdown :deep(pre code) {
  padding: 0;
  background: transparent;
}

.ai-markdown :deep(blockquote) {
  padding-left: 0.75rem;
  border-left: 3px solid var(--bs-border-color);
  color: var(--bs-secondary-color);
}

.ai-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.ai-markdown :deep(th),
.ai-markdown :deep(td) {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--bs-border-color);
}
</style>
