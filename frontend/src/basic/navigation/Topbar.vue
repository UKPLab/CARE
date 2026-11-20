<template>
  <div
    id="wrapper"
    ref="topbar"
    class="nav-container"
  >
    <nav class="navbar fixed-top navbar-expand-lg bg-body-tertiary border-bottom">
      <div class="container-fluid">
        <button
          id="backButton"
          class="btn"
          :title="$t('navigation.topbar.goBack')"
          @click="goBack()"
        >
          <LoadIcon
            :size="16"
            name="arrow-left"
          />
        </button>
        <a
          class="navbar-brand"
          @click="toHome()"
        >
          <LogoSvg
            :style="{cursor: 'pointer'}"
            :height="30"
          />
        </a>

        <div id="topbarCustomPlaceholder"/>
        <div id="topbarCenterPlaceholder"/>
        <ul
          id="topBarNavItems"
          class="navbar-nav ms-auto mt-2 mt-lg-0"
        />
        <ul class="navbar-nav">
          <li
            v-if="showRecordingIcon"
            class="nav-item me-3 d-flex align-items-center"
          >
            <span
              class="recording-icon d-flex align-items-center gap-2"
              :class="{ 'cursor-pointer': isAdmin }"
              :title="recordingTooltip"
              @click="onRecordingIconClick"
            >
              <LoadIcon
                name="record-circle"
                :size="18"
              />
              <span v-if="recordingElapsed" class="recording-timer">{{ recordingElapsed }}</span>
            </span>
          </li>
          <li v-if="!isProjectButtonHidden && isInDashboard" class="nav-item me-3">
            <div
              style="
                position: relative;
                display: flex;
                align-items: center;
                height: 100%;
              "
            >
              <div
                class="project-box"
                :title="$t('navigation.topbar.projectTitle', { name: currentProjectName })"
                @click.stop="toggleProjectDropdown"
              >
                <span class="project-text">{{ $t('navigation.topbar.projectTitle', { name: currentProjectName }) }}</span>
              </div>
              <div
                v-if="showProjectDropdown"
                class="dropdown-menu show"
                style="position:absolute; min-width:180px; z-index:1000; right:0; top:100%; margin-top:8px;"
              >
                <a
                  v-for="project in allProjects"
                  :key="project.id"
                  class="dropdown-item"
                  @click.prevent="selectProject(project.id)"
                >
                  {{ project.name }}
                </a>
              </div>
            </div>
          </li>
          <ProfileMenu />
        </ul>
      </div>
    </nav>
  </div>
</template>

<script>
import ProfileMenu from './ProfileMenu.vue';
/**
 *  Topbar shown everywhere throughout the app
 *
 * This component provides both a topbar that is visible at any point in the app
 * after logging in. It includes standard utilities and navigation elements
 * appropriate for the context.
 *
 * @author: Carly Gettinger, Dennis Zyska, Nils Dycke, Linyin Huang
 */

import LoadIcon from "@/basic/Icon.vue";
import { returnToDashboard } from "@/assets/utils";
import LogoSvg from "@/basic/icon/LogoSvg.vue";

export default {
  name: "TopBar",
  components: {LoadIcon, LogoSvg, ProfileMenu},
  data() {
    return {
      showProjectDropdown: false,
      now: Date.now(),
      tickHandle: null,
    }
  },
  subscribeTable: [{
    table: 'project',
  }, {
    table: 'recording',
  }],
  computed: {
    allProjects() {
      return this.$store.getters["table/project/getAll"] || [];
    },
    isProjectButtonHidden() {
      return this.$store.getters["settings/getValue"]("topBar.projects.hideProjectButton") === "true"
    },
    isInDashboard() {
      return this.$route.path.startsWith('/dashboard');
    },
    // Dashboard route the logo and the back button lead to when there is no history entry to return to.
    homeRoute() {
      return this.$route.path.startsWith('/template/') ? '/dashboard/templates' : '/dashboard';
    },
    currentProject() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    currentProjectName() {
      const project = this.$store.getters["table/project/get"](this.currentProject);
      if (!project) {
        return "";
      }
      return project.name;
    },

    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    activeRecording() {
      // This tab's active recording. There can be several concurrent
      // recordings (one per recorded socket), so match on THIS tab's socket
      // rather than picking the first active one.
      const recordings = this.$store.getters["table/recording/getAll"] || [];
      if (!this.$socket?.id) return null;
      return recordings.find(r =>
        r.status === "recording" &&
        (r.participantSocketIds || []).includes(this.$socket.id)
      ) || null;
    },
    isParticipant() {
      return this.activeRecording !== null;
    },
    showRecordingIcon() {
      // Session-based: only the sessions actually being recorded show the
      // icon, regardless of role. A tab that isn't a participant — even an
      // admin's — is not being captured, so it shouldn't display the icon.
      return this.isParticipant;
    },
    recordingElapsed() {
      const rec = this.activeRecording;
      if (!rec || !rec.startTime) return null;
      const ms = this.now - new Date(rec.startTime).getTime();
      if (ms < 0) return "00:00:00";
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    },
    recordingTooltip() {
      if (this.isAdmin) {
        return "Recording in progress — open Socket Profiler to stop";
      }
      return "You're being recorded for testing purposes";
    },

  },
  mounted() {
    this.$refs.topbar.addEventListener('click', this.handleClickOutside);
    // Tick once a second so the recording-elapsed display next to the
    // recording icon stays current. Cheap because it just updates a number.
    // Only tick while this tab is actually being recorded — the topbar is on
    // every page, so an unconditional 1Hz update would run for every user for
    // the whole session to power a timer that is usually not rendered.
    this.$watch(
      () => this.isParticipant,
      (recording) => {
        if (recording && !this.tickHandle) {
          this.tickHandle = setInterval(() => {
            this.now = Date.now();
          }, 1000);
        } else if (!recording && this.tickHandle) {
          clearInterval(this.tickHandle);
          this.tickHandle = null;
        }
      },
      { immediate: true }
    );
  },
  beforeUnmount() {
    this.$refs.topbar.removeEventListener('click', this.handleClickOutside);
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  },
  methods: {
    selectProject(projectId) {
      this.$socket.emit("appSettingSet", { key: "projects.default", value: projectId });
      this.showProjectDropdown = false;
    },

    handleClickOutside(event) {
        if (!this.$el.contains(event.target)) {
          this.showProjectDropdown = false;
        }
    },
    toggleProjectDropdown() {
      this.showProjectDropdown = !this.showProjectDropdown;
    },
    removeSidebarFlag() {
      document.body.classList.remove('sidebar-exists');
    },

    async goBack() {
      await returnToDashboard(this.$router, this.homeRoute);
    },
    async toHome() {
      await this.$router.push(this.homeRoute);
    },
    onRecordingIconClick() {
      // Admins jump to the Socket Profiler dashboard. Non-admin participants
      // can't go there (the page is admin-gated), so the click is a no-op for them.
      if (this.isAdmin) {
        this.$router.push('/dashboard/socket_profiler');
      }
    },

  },
}
</script>

<style>

body.sidebar-exists #backButton {
  display: none;
}

#topbarCenterPlaceholder {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.project-box {
  display: flex;
  align-items: center;
  padding: 2px 10px;
  background: var(--bs-tertiary-bg, #f5f5f5);
  border: 1px solid darkblue;
  color: darkblue;
  border-radius: 4px;
  vertical-align: middle;
  max-width: 180px;
  cursor: pointer;
}

.project-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.project-box:hover {
  background-color: darkblue;
  color: white;
}

[data-bs-theme="dark"] .project-box {
  background: var(--care-accent);
  border-color: var(--care-accent);
  color: var(--care-on-accent);
}

[data-bs-theme="dark"] .project-box:hover {
  background: var(--care-accent-hover);
}

.recording-icon {
  display: inline-flex;
  align-items: center;
  color: #dc3545;
  animation: recording-pulse 1.6s ease-in-out infinite;
}

.recording-timer {
  font-variant-numeric: tabular-nums;
  font-size: 0.875rem;
  font-weight: 600;
}

.recording-icon.cursor-pointer {
  cursor: pointer;
}

@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

</style>
