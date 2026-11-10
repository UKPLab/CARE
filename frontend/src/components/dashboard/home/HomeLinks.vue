<template>
  <footer class="home-footer">
    <nav
      class="home-footer-icons"
      :aria-label="$t('dashboard.home.links.title')"
    >
      <a
        v-for="link in links"
        :key="link.key"
        class="home-footer-icon"
        :href="link.href"
        :title="link.title"
        :aria-label="link.title"
        target="_blank"
        rel="noopener noreferrer"
      >
        <!-- Own drawing (no third-party license): a page with a folded corner and a solid
             "DOCS" label across it, like file-type icons. The letters are cut out of the label
             (mask), so they show the footer background in light and dark theme. -->
        <svg
          v-if="link.key === 'docs'"
          class="home-footer-docs"
          width="28"
          height="28"
          viewBox="0 0 28 28"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <!-- Page outline is hidden behind the label, otherwise it would show through the letters -->
            <mask :id="docsIds.page" maskUnits="userSpaceOnUse" x="0" y="0" width="28" height="28">
              <rect width="28" height="28" fill="#fff" />
              <rect x="1.5" y="10.5" width="23" height="11" rx="2.5" fill="#000" />
            </mask>
            <mask :id="docsIds.label" maskUnits="userSpaceOnUse" x="0" y="0" width="28" height="28">
              <rect x="2" y="11" width="22" height="10" rx="2" fill="#fff" />
              <text
                x="13"
                y="19.1"
                text-anchor="middle"
                textLength="17.5"
                lengthAdjust="spacingAndGlyphs"
                font-size="8.6"
                font-weight="800"
                font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
                fill="#000"
              >DOCS</text>
            </mask>
          </defs>
          <g
            :mask="`url(#${docsIds.page})`"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          >
            <path d="M19 2h-9a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M19 2v3.5A1.5 1.5 0 0 0 20.5 7H24" />
          </g>
          <rect
            x="2"
            y="11"
            width="22"
            height="10"
            rx="2"
            fill="currentColor"
            :mask="`url(#${docsIds.label})`"
          />
        </svg>
        <LoadIcon
          v-else
          :icon-name="link.icon"
          :size="22"
        />
      </a>
    </nav>
    <div
      v-if="copyright"
      class="home-footer-copy"
    >
      {{ copyright }}
    </div>
  </footer>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Quiet footer under the Home panels: project links as plain icons and the
 * copyright line from the login page (setting app.config.copyright).
 */
export default {
  name: "HomeLinks",
  components: { LoadIcon },
  computed: {
    /** Unique mask ids for the docs icon, in case the footer is on the page twice. */
    docsIds() {
      const uid = this.$.uid;
      return {page: `home-docs-page-${uid}`, label: `home-docs-label-${uid}`};
    },
    copyright() {
      return window.config?.["app.config.copyright"] || "";
    },
    links() {
      return [
        { key: "discord", title: "Discord", href: "https://discord.gg/pdXKucA46T", icon: "discord" },
        { key: "github", title: "GitHub", href: "https://github.com/UKPLab/CARE", icon: "github" },
        {
          key: "docs",
          title: this.$t("dashboard.home.links.docs"),
          href: "https://txaitd.ukp.informatik.tu-darmstadt.de/docs/",
          // Drawn inline in the template (page with "DOCS"), see .home-footer-docs
          icon: null,
        },
        {
          key: "website",
          title: this.$t("dashboard.home.links.website"),
          href: "https://care.ukp.informatik.tu-darmstadt.de/",
          icon: "globe2",
        },
      ];
    },
  },
};
</script>

<style scoped>
.home-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 0 4px;
  color: var(--bs-secondary-color);
}

.home-footer-icons {
  display: flex;
  gap: 8px;
}

/* Plain muted icons, no frame; only the colour changes on hover. */
.home-footer-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: inherit;
  opacity: .7;
  transition: color .12s ease, opacity .12s ease;
}

.home-footer-icon:hover,
.home-footer-icon:focus-visible {
  color: var(--care-primary);
  opacity: 1;
}

[data-bs-theme="dark"] .home-footer-icon:hover,
[data-bs-theme="dark"] .home-footer-icon:focus-visible {
  color: var(--care-accent);
}

/* Keep the label crisp and unselectable at icon size */
.home-footer-docs {
  overflow: visible;
  user-select: none;
}

.home-footer-copy {
  font-size: .75rem;
}
</style>
