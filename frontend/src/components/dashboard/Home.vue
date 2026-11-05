<template>
  <div class="home mb-3">
    <div class="row g-3 mb-3">
      <div class="col-sm-6 col-xl-3 home-tile-wrap">
        <router-link class="card home-tile" to="/dashboard/documents">
          <span>{{ $t('sidebar.nav.documents') }}</span>
          <b>{{ documents.length }}</b>
          <span>{{ $t('dashboard.home.addedThisWeek', { count: documentsAddedThisWeek }) }}</span>
          <HomeActivityGraph :series="documentActivity" />
        </router-link>
      </div>
      <div class="col-sm-6 col-xl-3 home-tile-wrap">
        <router-link class="card home-tile" to="/dashboard/my_sessions">
          <span>{{ $t('sidebar.nav.my_sessions') }}</span>
          <b>{{ openSessions.length }}</b>
          <span>{{ oldestSessionLabel }}</span>
          <HomeActivityGraph :series="sessionActivity" />
        </router-link>
      </div>
      <div v-if="canSeeStudies" class="col-sm-6 col-xl-3 home-tile-wrap">
        <router-link class="card home-tile" to="/dashboard/studies">
          <span>{{ $t('dashboard.home.openStudies') }}</span>
          <b>{{ openStudies.length }}</b>
          <span>{{ $t('dashboard.home.closingSoon', { count: studiesClosingSoon }) }}</span>
          <HomeActivityGraph :series="studyActivity" />
        </router-link>
      </div>
      <div v-if="canSeeSubmissions" class="col-sm-6 col-xl-3 home-tile-wrap">
        <HomeSubmissionsTile />
      </div>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-lg-6">
        <section class="card home-panel">
          <header class="home-panel-head">
            <h2>{{ $t('dashboard.home.continue') }}</h2>
          </header>
          <p v-if="continueItems.length === 0" class="home-empty">
            {{ $t('dashboard.home.nothingToResume') }}
          </p>
          <BasicButton
            v-for="item in continueItems"
            :key="item.key"
            class="home-resume"
            @click="$router.push(item.to)"
          >
            <b>{{ item.title }}</b>
            <small>{{ item.detail }}</small>
          </BasicButton>
        </section>
      </div>
      <div class="col-lg-6">
        <section class="card home-panel">
          <header class="home-panel-head">
            <h2>{{ $t('dashboard.home.yourSessions') }}</h2>
          </header>
          <p v-if="sessionItems.length === 0" class="home-empty">
            {{ $t('dashboard.home.noOpenSessions') }}
          </p>
          <router-link
            v-for="item in sessionItems"
            :key="item.key"
            class="home-session"
            :to="item.to"
          >
            <b>{{ item.title }}</b>
            <small>{{ item.detail }}</small>
          </router-link>
        </section>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12">
        <section class="card home-panel">
          <header class="home-panel-head">
            <h2>{{ $t('dashboard.home.recentDocuments') }}</h2>
            <router-link
              class="home-panel-link"
              to="/dashboard/documents"
            >
              {{ $t('dashboard.home.viewAll') }}
            </router-link>
          </header>
          <p
            v-if="recentDocuments.length === 0"
            class="home-empty"
          >
            {{ $t('dashboard.home.noDocuments') }}
          </p>
          <table
            v-else
            class="home-docs"
          >
            <thead>
              <tr>
                <th>{{ $t('common.title') }}</th>
                <th>{{ $t('common.updatedAt') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="doc in recentDocuments"
                :key="doc.id"
              >
                <td>
                  <router-link :to="'/document/' + doc.hash">{{ doc.name }}</router-link>
                </td>
                <td>{{ formatLocalizedDateTime(doc.updatedAt || doc.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import HomeSubmissionsTile from "@/components/dashboard/HomeSubmissionsTile.vue";
import HomeActivityGraph from "@/components/dashboard/HomeActivityGraph.vue";
import BasicButton from "@/basic/Button.vue";
import { formatLocalizedDateTime, getTimeDiffString, isOwnListedDocument } from "@/assets/utils";

const HOME_DOCUMENT_LIMIT = 8;

/**
 * Dashboard home. Counts, resume links, and a short recent-documents
 * list come from tables the dashboard already loads.
 *
 * @author Mohammad Sherif
 */
export default {
  name: "DashboardHome",
  components: { HomeSubmissionsTile, HomeActivityGraph, BasicButton },
  subscribeTable: ["document", "study", "study_session"],
  computed: {
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"](
        (doc) => isOwnListedDocument(doc, this.userId, this.projectId)
      );
    },
    documentsAddedThisWeek() {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return this.documents.filter((doc) => new Date(doc.createdAt).getTime() >= weekAgo).length;
    },
    projectStudies() {
      return this.$store.getters["table/study/getFiltered"](
        (study) => study.projectId === this.projectId && study.template !== true
      );
    },
    openStudies() {
      const now = Date.now();
      return this.projectStudies.filter((study) => {
        if (study.closed != null) return false;
        if (!study.end) return true;
        const end = new Date(study.end).getTime();
        return Number.isNaN(end) || end >= now || study.multipleSubmit;
      });
    },
    studiesClosingSoon() {
      const now = Date.now();
      const limit = now + 7 * 24 * 60 * 60 * 1000;
      return this.openStudies.filter((study) => {
        if (!study.end) return false;
        const end = new Date(study.end).getTime();
        return !Number.isNaN(end) && end >= now && end <= limit;
      }).length;
    },
    openSessions() {
      return this.$store.getters["table/study_session/getByUser"](this.userId)
        .filter((session) => session.end == null)
        .sort((a, b) => new Date(b.start || b.updatedAt || 0) - new Date(a.start || a.updatedAt || 0));
    },
    oldestSessionLabel() {
      if (this.openSessions.length === 0) {
        return this.$t("dashboard.home.noOpenSessions");
      }
      const oldest = [...this.openSessions].sort(
        (a, b) => new Date(a.start || a.createdAt || 0) - new Date(b.start || b.createdAt || 0)
      )[0];
      const when = getTimeDiffString(Date.now(), new Date(oldest.start || oldest.createdAt));
      return this.$t("dashboard.home.oldestStarted", { when });
    },
    // Activity graphs (HomeActivityGraph): one date per event, counted
    // per week. The first series is the filled line, the second the
    // violet "closed" line.
    documentActivity() {
      return [{
        key: "added",
        label: this.$t("dashboard.home.activityDocuments"),
        dates: this.documents.map((doc) => doc.createdAt),
      }];
    },
    sessionActivity() {
      // All of the user's sessions, not only the open ones counted on the tile.
      const sessions = this.$store.getters["table/study_session/getByUser"](this.userId);
      return [
        {
          key: "started",
          label: this.$t("dashboard.home.activitySessions"),
          dates: sessions.map((session) => session.start || session.createdAt),
        },
        {
          key: "finished",
          label: this.$t("dashboard.home.activitySessionsFinished"),
          dates: sessions.map((session) => session.end),
        },
      ];
    },
    studyActivity() {
      const now = Date.now();
      return [
        {
          key: "created",
          label: this.$t("dashboard.home.activityStudies"),
          dates: this.projectStudies.map((study) => study.createdAt),
        },
        {
          key: "closed",
          label: this.$t("dashboard.home.activityStudiesClosed"),
          // Closed by hand, or ended by its deadline. Same rule as
          // openStudies: a multipleSubmit study stays open after its end.
          dates: this.projectStudies.map((study) => {
            if (study.closed) return study.closed;
            if (!study.end || study.multipleSubmit) return null;
            const end = new Date(study.end).getTime();
            return end <= now ? study.end : null;
          }),
        },
      ];
    },
    canSeeStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view");
    },
    canSeeSubmissions() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.submissions.view");
    },
    sessionItems() {
      return this.openSessions.slice(0, 6).map((session) => this.sessionLink(session));
    },
    continueItems() {
      const sessions = this.openSessions.slice(0, 3).map((session) => this.sessionLink(session));
      const documents = this.recentDocuments.slice(0, 2).map((doc) => ({
        key: `doc-${doc.id}`,
        title: doc.name,
        detail: formatLocalizedDateTime(doc.updatedAt || doc.createdAt),
        to: `/document/${doc.hash}`,
      }));
      return [...sessions, ...documents];
    },
    recentDocuments() {
      return [...this.documents]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, HOME_DOCUMENT_LIMIT);
    },
  },
  methods: {
    formatLocalizedDateTime,
    sessionLink(session) {
      const study = this.$store.getters["table/study/get"](session.studyId);
      const when = getTimeDiffString(Date.now(), new Date(session.start || session.createdAt));
      return {
        key: `session-${session.id}`,
        title: study?.name || this.$t("sidebar.nav.my_sessions"),
        detail: this.$t("dashboard.home.started", { when }),
        to: `/session/${session.hash}`,
      };
    },
  },
};
</script>

<style scoped>
.home .row > [class*="col"] {
  min-width: 0;
}

.home-panel {
  min-width: 0;
  height: 100%;
  padding: 14px 16px;
  overflow: hidden;
  background: var(--bs-body-bg);
}

/* A hairline under the heading separates it from the list below. */
.home-panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .75rem;
  margin: 0 -16px 10px;
  padding: 0 16px 10px;
  border-bottom: 1px solid var(--bs-border-color-translucent);
}

.home-panel h2 {
  margin: 0;
  font-size: .95rem;
  font-weight: 650;
  letter-spacing: -.01em;
  color: var(--bs-emphasis-color);
}

.home-panel-link {
  flex: 0 0 auto;
  font-size: .85rem;
  font-weight: 600;
  text-decoration: none;
}

.home-docs {
  width: 100%;
  margin: 0;
}

.home-docs th,
.home-docs td {
  padding: .45rem 0;
  border-bottom: 1px solid var(--bs-border-color-translucent);
  font-size: .9rem;
  vertical-align: top;
}

.home-docs th {
  padding-top: 0;
  color: var(--bs-secondary-color);
  font-size: .75rem;
  font-weight: 650;
  letter-spacing: .02em;
  text-transform: uppercase;
}

.home-docs th:not(:first-child),
.home-docs td:not(:first-child) {
  padding-left: 1rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
  width: 1%;
}

.home-docs tr:last-child td {
  border-bottom: 0;
  padding-bottom: 0;
}

.home-docs a {
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}

.home-docs a:hover {
  color: var(--care-primary);
}

.home-resume.btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  max-width: 100%;
  height: auto;
  margin: 0;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  color: inherit;
  background: transparent;
  text-align: left;
  white-space: normal;
  --bs-btn-hover-bg: var(--bs-secondary-bg);
  --bs-btn-hover-color: inherit;
}

.home-resume.btn:hover:not(:disabled) {
  background: var(--bs-secondary-bg);
  box-shadow: none;
}

.home-resume b,
.home-session b {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-resume small,
.home-session small,
.home-empty {
  color: var(--bs-secondary-color);
}

.home-empty {
  margin: 0;
  font-size: .9rem;
}

.home-session {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin: 0 -8px;
  padding: 8px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.home-session:hover {
  background: var(--bs-secondary-bg);
}
</style>
