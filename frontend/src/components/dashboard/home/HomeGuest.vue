<template>
  <div class="home mb-3">
    <section class="card home-guest-note mb-3">
      <span class="home-guest-note-icon">
        <LoadIcon icon-name="person-badge" :size="20" />
      </span>
      <div class="home-guest-note-text">
        <span class="home-guest-badge">
          <span class="home-guest-badge-dot" />
          {{ $t('dashboard.home.guest.badge') }}
        </span>
        <h2>{{ $t('dashboard.home.guest.title') }}</h2>
        <p>
          {{ $t('dashboard.home.guest.intro') }}
          {{ canRegister ? $t('dashboard.home.guest.register') : $t('dashboard.home.guest.askAdmin') }}
        </p>
      </div>
      <BasicButton
        v-if="canRegister"
        class="btn-sm btn-primary home-guest-note-action"
        :text="$t('dashboard.home.guest.createAccount')"
        @click="toRegister"
      />
    </section>

    <div class="row g-3">
      <div :class="canSeeStudies ? 'col-lg-6' : 'col-12'">
        <section class="card home-panel">
          <header class="home-panel-head">
            <h2>{{ $t('dashboard.home.guest.startHere') }}</h2>
          </header>
          <router-link
            v-for="item in guestStartItems"
            :key="item.key"
            class="home-session home-resume"
            :to="item.to"
          >
            <span
              class="home-kind-icon"
              :class="'home-kind-icon--' + item.kind"
            >
              <LoadIcon :icon-name="item.icon" :size="15" />
            </span>
            <span class="home-session-main">
              <b>{{ item.title }}</b>
              <small>{{ item.detail }}</small>
            </span>
            <span
              v-if="item.featured"
              class="home-due home-due--feature"
            >
              {{ $t('dashboard.home.guest.example') }}
            </span>
            <LoadIcon
              v-else
              class="home-chevron"
              icon-name="chevron-right"
              :size="13"
            />
          </router-link>
        </section>
      </div>
      <div v-if="canSeeStudies" class="col-lg-6">
        <section class="card home-panel">
          <header class="home-panel-head">
            <h2>{{ $t('dashboard.home.openStudies') }}</h2>
            <router-link
              class="home-panel-link"
              to="/dashboard/studies"
            >
              {{ $t('dashboard.home.viewAll') }}
            </router-link>
          </header>
          <p v-if="guestStudyItems.length === 0" class="home-empty">
            {{ $t('dashboard.home.guest.noStudies') }}
          </p>
          <router-link
            v-for="item in guestStudyItems"
            :key="item.key"
            class="home-session"
            :to="item.to"
          >
            <span class="home-kind-icon home-kind-icon--session">
              <LoadIcon icon-name="clipboard2-pulse" :size="15" />
            </span>
            <span class="home-session-main">
              <b>{{ item.title }}</b>
              <small>{{ item.detail }}</small>
            </span>
            <span
              class="home-due"
              :class="'home-due--' + item.due.tone"
              :title="item.due.title"
            >
              {{ item.due.label }}
            </span>
          </router-link>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";
import getServerURL from "@/assets/serverUrl";
import { formatLocalizedDateTime } from "@/assets/utils";
import { homeShared } from "./homeShared";

// Seeded for the guest account in 20220706143939-basic-documents.js.
const SHOWCASE_DOCUMENT_HASH = "8852a746-360e-4c31-add2-4d1c75bfb96d";
const SHOWCASE_DOCUMENT_NAME = "Showcase Document";

/**
 * Start page shown to the shared guest account.
 */
export default {
  name: "HomeGuest",
  components: { LoadIcon, BasicButton },
  mixins: [homeShared],
  props: {
    /** The viewer may open the studies dashboard. */
    canSeeStudies: {
      type: Boolean,
      required: true,
    },
    /** Studies still open in the current project. */
    openStudies: {
      type: Array,
      required: true,
    },
    /** Current time, so deadline chips stay current. */
    now: {
      type: Number,
      required: true,
    },
  },
  computed: {
    canRegister() {
      return window.config?.["app.register.enabled"] === "true";
    },
    // The seeded showcase (fixed hash), or a document with the same name if an
    // installation re-uploaded it. Only rows the guest may read reach the store.
    showcaseDocument() {
      const visible = this.$store.getters["table/document/getFiltered"](
        (doc) => !doc.deleted && doc.parentDocumentId == null
      );
      return visible.find((doc) => doc.hash === SHOWCASE_DOCUMENT_HASH)
        || visible.find((doc) => doc.name === SHOWCASE_DOCUMENT_NAME)
        || null;
    },
    guestStartItems() {
      const items = [];
      if (this.showcaseDocument) {
        const kind = this.documentKind(this.showcaseDocument);
        items.push({
          key: "showcase",
          title: this.showcaseDocument.name,
          detail: this.$t("dashboard.home.guest.showcaseDetail"),
          to: `/document/${this.showcaseDocument.hash}`,
          kind: "session",
          icon: kind.icon,
          featured: true,
        });
      }
      items.push({
        key: "documents",
        title: this.$t("sidebar.nav.documents"),
        detail: this.$t("dashboard.home.guest.documentsDetail"),
        to: "/dashboard/documents",
        kind: "text",
        icon: "file-earmark-text",
      });
      if (this.canSeeStudies) {
        items.push({
          key: "studies",
          title: this.$t("dashboard.home.openStudies"),
          detail: this.$t("dashboard.home.guest.studiesDetail"),
          to: "/dashboard/studies",
          kind: "session",
          icon: "clipboard2-pulse",
        });
      }
      return items;
    },
    // Open studies the guest account takes part in, soonest deadline first.
    guestStudyItems() {
      return this.openStudies
        .map((study) => {
          const end = study.end ? new Date(study.end).getTime() : NaN;
          const deadline = Number.isNaN(end) ? null : { at: end, kind: "study" };
          return {
            key: `study-${study.id}`,
            title: study.name,
            detail: study.end
              ? this.$t("dashboard.home.endsOn", { date: formatLocalizedDateTime(study.end) })
              : this.$t("dashboard.home.guest.studyDetail"),
            to: `/study/${study.hash}`,
            due: this.dueBadge(deadline),
            deadlineAt: deadline ? deadline.at : Infinity,
          };
        })
        .sort((a, b) => a.deadlineAt - b.deadlineAt)
        .slice(0, 6);
    },
  },
  methods: {
    // Register is a logged-out page, so sign the guest out first (as Topbar does).
    async toRegister() {
      await axios.get(getServerURL() + "/auth/logout", { withCredentials: true });
      await this.$router.push({ name: "register" });
    },
  },
};
</script>


<style scoped>
.home .row > [class*="col"] {
  min-width: 0;
}

/* Guest welcome: a soft primary wash fading to the card colour, no alert colours. */
.home-guest-note {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1rem;
  padding: 18px 20px;
  background:
    linear-gradient(110deg,
      color-mix(in srgb, var(--care-primary) 9%, transparent) 0%,
      color-mix(in srgb, var(--care-primary) 3%, transparent) 45%,
      transparent 75%),
    var(--bs-body-bg);
}

.home-guest-note-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--care-radius-lg);
  color: var(--care-primary);
  background: color-mix(in srgb, var(--care-primary) 12%, var(--bs-body-bg));
}

.home-guest-note-text {
  flex: 1 1 auto;
  min-width: 0;
}

/* Small "Guest access" pill above the title. */
.home-guest-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 1px 8px 1px 7px;
  border-radius: var(--care-radius-pill);
  font-size: .7rem;
  font-weight: 650;
  letter-spacing: .02em;
  text-transform: uppercase;
  color: var(--care-primary);
  background: color-mix(in srgb, var(--care-primary) 10%, transparent);
}

.home-guest-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.home-guest-note h2 {
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: -.01em;
  color: var(--bs-emphasis-color);
}

.home-guest-note p {
  max-width: 62ch;
  margin: 0;
  font-size: .875rem;
  line-height: 1.45;
  color: var(--bs-secondary-color);
}

.home-guest-note-action {
  flex: 0 0 auto;
}

@media (max-width: 575.98px) {
  .home-guest-note {
    flex-wrap: wrap;
  }
}
</style>
