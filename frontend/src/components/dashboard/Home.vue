<template>
  <div class="mb-3">
    <div class="row g-3 mb-3">
      <div class="col-sm-6 col-xl-3">
        <router-link class="card home-tile" to="/dashboard/documents">
          <span>{{ $t('sidebar.nav.documents') }}</span>
          <b>{{ documents.length }}</b>
          <span>{{ $t('dashboard.home.addedThisWeek', { count: documentsAddedThisWeek }) }}</span>
        </router-link>
      </div>
      <div v-if="canSeeStudies" class="col-sm-6 col-xl-3">
        <router-link class="card home-tile" to="/dashboard/studies">
          <span>{{ $t('dashboard.home.openStudies') }}</span>
          <b>{{ openStudies.length }}</b>
          <span>{{ $t('dashboard.home.closingSoon', { count: studiesClosingSoon }) }}</span>
        </router-link>
      </div>
      <div class="col-sm-6 col-xl-3">
        <router-link class="card home-tile" to="/dashboard/my_sessions">
          <span>{{ $t('sidebar.nav.my_sessions') }}</span>
          <b>{{ openSessions.length }}</b>
          <span>{{ oldestSessionLabel }}</span>
        </router-link>
      </div>
      <div v-if="canSeeSubmissions" class="col-sm-6 col-xl-3">
        <HomeSubmissionsTile />
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-6">
        <section class="card home-panel">
          <h2>{{ $t('dashboard.home.continue') }}</h2>
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
      <div v-if="canSeeStudies" class="col-lg-6">
        <section class="card home-panel">
          <h2>{{ $t('dashboard.home.studiesInProgress') }}</h2>
          <p v-if="studiesInProgress.length === 0" class="home-empty">
            {{ $t('dashboard.home.noStudies') }}
          </p>
          <div
            v-for="study in studiesInProgress"
            :key="study.id"
            class="home-study"
          >
            <b>{{ study.name }}</b>
            <small>
              {{ $t('dashboard.home.sessionCount', { done: study.done, total: study.total }) }}
              <template v-if="study.closes"> · {{ $t('dashboard.home.closes', { date: study.closes }) }}</template>
            </small>
            <div class="home-bar"><i :style="{ width: study.percent }" /></div>
          </div>
        </section>
      </div>
    </div>
  </div>
  <Documents />
</template>

<script>
import Documents from "@/components/dashboard/Documents.vue";
import HomeSubmissionsTile from "@/components/dashboard/HomeSubmissionsTile.vue";
import BasicButton from "@/basic/Button.vue";
import { formatLocalizedDateTime, getTimeDiffString, isOwnListedDocument } from "@/assets/utils";

/**
 * Dashboard home. Counts and the resume list come from tables the
 * dashboard already loads. The documents list below is the existing page.
 *
 * @author Mohammad Sherif
 */
export default {
  name: "DashboardHome",
  components: { Documents, HomeSubmissionsTile, BasicButton },
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
    canSeeStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view");
    },
    canSeeSubmissions() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.submissions.view");
    },
    continueItems() {
      const sessions = this.openSessions.slice(0, 3).map((session) => {
        const study = this.$store.getters["table/study/get"](session.studyId);
        const when = getTimeDiffString(Date.now(), new Date(session.start || session.createdAt));
        return {
          key: `session-${session.id}`,
          title: study?.name || this.$t("sidebar.nav.my_sessions"),
          detail: this.$t("dashboard.home.started", { when }),
          to: `/session/${session.hash}`,
        };
      });
      const documents = [...this.documents]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 2)
        .map((doc) => ({
          key: `doc-${doc.id}`,
          title: doc.name,
          detail: formatLocalizedDateTime(doc.updatedAt || doc.createdAt),
          to: `/document/${doc.hash}`,
        }));
      return [...sessions, ...documents];
    },
    studiesInProgress() {
      return this.openStudies
        .map((study) => {
          const sessions = this.$store.getters["table/study_session/getFiltered"](
            (session) => session.studyId === study.id
          );
          const total = sessions.length;
          const done = sessions.filter((session) => session.end != null).length;
          const percent = total === 0 ? "0%" : `${Math.round((done / total) * 100)}%`;
          return {
            id: study.id,
            name: study.name,
            done,
            total,
            percent,
            closes: study.end ? formatLocalizedDateTime(study.end, { dateStyle: "medium" }) : "",
            end: study.end ? new Date(study.end).getTime() : Infinity,
          };
        })
        .sort((a, b) => a.end - b.end)
        .slice(0, 4);
    },
  },
};
</script>

<style scoped>
.home-panel {
  height: 100%;
  padding: 14px 16px;
}

.home-panel h2 {
  margin: 0 0 12px;
  font-size: .95rem;
  font-weight: 650;
}

.home-resume.btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  white-space: normal;
  height: auto;
  margin: 0 -8px;
  width: calc(100% + 16px);
  padding: 8px;
  border: 0;
  border-radius: 8px;
  color: inherit;
  background: transparent;
  --bs-btn-hover-bg: var(--bs-secondary-bg);
  --bs-btn-hover-color: inherit;
}

.home-resume.btn:hover:not(:disabled) {
  background: var(--bs-secondary-bg);
  box-shadow: none;
}

.home-resume small,
.home-study small,
.home-empty {
  color: var(--bs-secondary-color);
}

.home-empty {
  margin: 0;
  font-size: .9rem;
}

.home-study {
  padding: 8px 0;
  border-top: 1px solid var(--bs-border-color);
}

.home-study:first-of-type {
  border-top: 0;
}

.home-bar {
  height: 6px;
  margin-top: 6px;
  border-radius: 99px;
  background: var(--bs-tertiary-bg);
  overflow: hidden;
}

.home-bar i {
  display: block;
  height: 100%;
  background: var(--care-primary, var(--bs-primary));
}
</style>
