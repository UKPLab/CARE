<template>
        <div
            v-if="showDocs || showFeedback || showProject"
            class="text-center"
        >
          <span v-if="showDocs"><a
              :href="linkDocs"
              target="_blank"
          >{{ $t('navigation.documentation') }}</a></span>
          <span
              v-if="showFeedback && showDocs"
              class="mx-1"
          >&#x2022;</span>
          <span v-if="showFeedback"><a
              :href="linkFeedback"
              target="_blank"
          >{{ $t('navigation.feedback') }}</a></span>
          <span
              v-if="showProject && (showDocs || showFeedback)"
              class="mx-1"
          >&#x2022;</span>
          <span v-if="showProject"><a
              :href="linkProject"
              target="_blank"
          >{{ $t('navigation.projectPage') }}</a></span>
        </div>
        <div class="text-center text-secondary">
          {{ copyright }}
        </div>
        <div v-if="showVersion" class="text-center text-secondary">
          {{ $t('common.appVersion') }}: {{ version }}
        </div>
</template>
<script>
export default {
  name: 'AuthLinksFooter',
  data() { return {version: APP_VERSION, showVersion: process.env.NODE_ENV !== 'production'}; },
  computed: {
    copyright() {
      return window.config['app.config.copyright'];
    },
    linkDocs() {
      return window.config['app.landing.linkDocs'];
    },
    showDocs() {
      return window.config['app.landing.showDocs'] === 'true' && this.linkDocs !== '';
    },
    linkFeedback() {
      return window.config['app.landing.linkFeedback'];
    },
    showFeedback() {
      return window.config['app.landing.showFeedback'] === 'true' && this.linkFeedback !== '';
    },
    linkProject() {
      return window.config['app.landing.linkProject'];
    },
    showProject() {
      return window.config['app.landing.showProject'] === 'true' && this.linkProject !== '';
    }
  },
};
</script>
