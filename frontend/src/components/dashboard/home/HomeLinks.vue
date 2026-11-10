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
        <LoadIcon
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
          icon: "book",
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

.home-footer-copy {
  font-size: .75rem;
}
</style>
