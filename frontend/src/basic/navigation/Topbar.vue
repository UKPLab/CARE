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
          <RecordingIndicator />
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
          <li
            v-if="problemReportEnabled"
            class="nav-item me-2 d-flex align-items-center"
          >
            <BasicButton
              id="problemReportButton"
              class="btn problem-report-button"
              icon="bug"
              text=""
              :title="$t('problemReport.button')"
              :aria-label="$t('problemReport.button')"
              aria-haspopup="dialog"
              @click="$refs.problemReportModal.open()"
            >
              <LoadIcon
                :size="18"
                icon-name="bug"
              />
            </BasicButton>
          </li>
          <ProfileMenu />
        </ul>
      </div>
    </nav>
  </div>
  <ProblemReportModal
    v-if="problemReportEnabled"
    ref="problemReportModal"
  />
</template>

<script>
import ProfileMenu from './ProfileMenu.vue';
import RecordingIndicator from './RecordingIndicator.vue';
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
import BasicButton from "@/basic/Button.vue";
import ProblemReportModal from "@/components/problem_report/ProblemReportModal.vue";
import { readReportSettings } from "@/assets/problemReport.js";

export default {
  name: "TopBar",
  components: {LoadIcon, LogoSvg, ProfileMenu, RecordingIndicator, BasicButton, ProblemReportModal},
  data() {
    return {
      showProjectDropdown: false,
    }
  },
  subscribeTable: [{
    table: 'project',
  }],
  computed: {
    // Hidden when report settings are missing or the feature is disabled.
    problemReportEnabled() {
      return readReportSettings(this.$store.getters["settings/getValue"]).enabled;
    },
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
  },
  mounted() {
    this.$refs.topbar.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    this.$refs.topbar.removeEventListener('click', this.handleClickOutside);
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
  },
}
</script>

<style>

/* Quiet circular icon button, sized to match the avatar next to it. The id
   selector outranks Bootstrap's .btn radius, border and padding. */
#problemReportButton {
  width: 35px;
  height: 35px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  color: var(--bs-secondary-color);
  background: transparent;
  transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
}

#problemReportButton:hover,
#problemReportButton:active {
  color: var(--bs-emphasis-color);
  background: var(--bs-secondary-bg);
}

#problemReportButton:focus-visible {
  outline: 2px solid var(--care-primary);
  outline-offset: 2px;
  box-shadow: none;
}

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


</style>
