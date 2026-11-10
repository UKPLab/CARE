<template>
  <footer class="app-footer">
    <nav
      class="app-footer-icons"
      :aria-label="$t('dashboard.home.links.title')"
    >
      <a
        v-for="link in links"
        :key="link.key"
        class="app-footer-icon"
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
          class="app-footer-docs"
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
      class="app-footer-copy"
    >
      {{ copyright }}
    </div>
  </footer>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Quiet page footer: project links as plain icons and the copyright line
 * (setting app.config.copyright). Used under the dashboard Home panels and
 * at the bottom of the signed-out pages (AuthLayout).
 */
export default {
  name: "AppFooter",
  components: { LoadIcon },
  computed: {
    /** Unique mask ids for the docs icon, in case the footer is on the page twice. */
    docsIds() {
      const uid = this.$.uid;
      return {page: `app-footer-docs-page-${uid}`, label: `app-footer-docs-label-${uid}`};
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
          // Drawn inline in the template (page with "DOCS"), see .app-footer-docs
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
.app-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 0 4px;
  color: var(--bs-secondary-color);
}

.app-footer-icons {
  display: flex;
  gap: 8px;
}

/* Plain muted icons, no frame; only the colour changes on hover. */
.app-footer-icon {
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

.app-footer-icon:hover,
.app-footer-icon:focus-visible {
  color: var(--care-primary);
  opacity: 1;
}

[data-bs-theme="dark"] .app-footer-icon:hover,
[data-bs-theme="dark"] .app-footer-icon:focus-visible {
  color: var(--care-accent);
}

/* Keep the label crisp and unselectable at icon size */
.app-footer-docs {
  overflow: visible;
  user-select: none;
}

.app-footer-copy {
  font-size: .75rem;
}
</style>
