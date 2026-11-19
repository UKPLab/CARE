<template>
  <Loading v-if="sidebarElements > 0 || sidebarGroups > 0" />

  <div
    v-else
    id="wrapper"
    class="nav-container"
  >
    <div
      id="sidebar-wrapper"
      :class="{ collapsed: isCollapsed }"
    >
      <SidebarGroupList
        :groups="defaultGroupedElements"
        :group-states="groupStates"
        :is-collapsed="isCollapsed"
        :active-group="activeSubgroup"
        :hovered-group="hoveredGroup"
        :active-element-id="activeElementId"
        :favorite-ids="favoriteIds"
        :favorite-disabled="isSavingFavorites"
        @toggle="toggleGroup"
        @hover="handleGroupMouseEnter"
        @leave="handleGroupMouseLeave"
        @toggle-favorite="toggleFavorite"
      >
        <div
          v-if="favoriteElements.length"
          class="sidebar-pinned-list"
        >
          <SidebarNavItem
            v-for="element in favoriteElements"
            :key="`pinned-${element.id}`"
            :element="element"
            variant="default"
            :is-active="String(element.id) === String(activeElementId)"
            :is-favorite="true"
            :favorite-disabled="isSavingFavorites"
            @toggle-favorite="toggleFavorite"
          />
        </div>
      </SidebarGroupList>

      <SidebarPreview
        v-if="hoveredSubgroup && !groupStates[hoveredGroup]"
        ref="sidebarPreview"
        :subgroup="hoveredSubgroup"
        :is-collapsed="isCollapsed"
        :preview-style="previewStyle"
        :active-element-id="activeElementId"
        :favorite-ids="favoriteIds"
        :favorite-disabled="isSavingFavorites"
        @mouseenter="handlePreviewMouseEnter"
        @mouseleave="handlePreviewMouseLeave($event, hoveredGroup)"
        @toggle-favorite="toggleFavorite"
        @navigate="resetPreview"
      />

      <SidebarFooter
        :is-collapsed="isCollapsed"
        :show-version="isAdmin"
        @toggle="toggleSidebar()"
      />
    </div>
  </div>
</template>

<script>
import Loading from "@/basic/Loading.vue";
import SidebarGroupList from "./SidebarGroupList.vue";
import SidebarNavItem from "./SidebarNavItem.vue";
import SidebarPreview from "./SidebarPreview.vue";
import SidebarFooter from "./SidebarFooter.vue";
import { resolveApiMessage } from "@/assets/utils";

const FAVORITES_SAVE_TIMEOUT_MS = 10000;
const SIDEBAR_FAVORITES_SETTING = "dashboard.navigation.favorites";

function parseFavoriteIds(value) {
  if (value === undefined || value === null || value === "") return [];
  let ids;
  try { ids = JSON.parse(value); } catch (e) {
    console.error("Could not parse saved sidebar favorites.", e);
    return [];
  }
  if (!Array.isArray(ids)) {
    console.error("Saved sidebar favorites must be a JSON array.");
    return [];
  }
  return [...new Set(ids.filter(id => (typeof id === "string" && id.trim()) || (typeof id === "number" && Number.isFinite(id))).map(String))];
}

function toggleFavoriteId(favoriteIds, id) {
  if (id === undefined || id === null || id === "") return favoriteIds;
  const nid = String(id);
  return favoriteIds.includes(nid) ? favoriteIds.filter(f => f !== nid) : [...favoriteIds, nid];
}

function getFavoriteElements(elements, favoriteIds) {
  const ids = new Set(favoriteIds);
  return elements.filter(el => ids.has(String(el.id)));
}

function getFlyoutStyle(anchorRect, previewRect, viewport, margin = 8) {
  const safeMargin = Math.min(margin, viewport.width / 2, viewport.height / 2);
  const maxWidth = Math.max(0, viewport.width - safeMargin * 2);
  const maxHeight = Math.max(0, viewport.height - safeMargin * 2);
  const width = Math.min(previewRect.width, maxWidth);
  const height = Math.min(previewRect.height, maxHeight);
  const maxLeft = Math.max(safeMargin, viewport.width - safeMargin - width);
  const maxTop = Math.max(safeMargin, viewport.height - safeMargin - height);
  const left = Math.max(safeMargin, Math.min(anchorRect.right, maxLeft));
  const top = Math.max(safeMargin, Math.min(anchorRect.top - margin, maxTop));
  return { left: `${left}px`, top: `${top}px`, maxWidth: `${maxWidth}px`, maxHeight: `${maxHeight}px` };
}

export default {
  subscribeTable: ['nav_group', 'nav_element'],
  name: "SidebarNavigation",
  components: { Loading, SidebarGroupList, SidebarNavItem, SidebarPreview, SidebarFooter },

  props: {
    activeElement: {
      type: Object,
      default: null,
    },
  },

  data() {
    return {
      isCollapsed: false,
      groupStates: {},
      favoriteIdsOverride: null,
      isSavingFavorites: false,
      favoriteSaveTimer: null,
      favoriteSaveSequence: 0,
      favoriteSettingsUncertain: false,
      favoriteSettingsReconcileSequence: null,
      favoriteSocketDisconnectHandler: null,
      favoriteSocketConnectHandler: null,
      favoriteSettingsHandler: null,
      hoveredGroup: null,
      pinnedPreviewGroup: null,
      previewStyle: {},
      isHoveringPreview: false,
      previewAnchor: null,
      previewResizeObserver: null,
    };
  },

  computed: {
    sidebarElements() {
      const groups = this.$store.getters['table/nav_element/getAll']
        .filter(el => (!el.admin || this.isAdmin) && this.$store.getters["auth/checkRight"](`frontend.dashboard.${el.path}.view`))
        .reduce((acc, cur) => {
          if (!cur.groupId) {
            console.error(`For navigation element ${cur.name} the group id ${cur.group} doesn't exists!`);
            return acc;
          }
          (acc[cur.groupId] = acc[cur.groupId] || []).push(cur);
          return acc;
        }, []);

      return groups.map(e => e.sort((a, b) => a.order - b.order));
    },

    sidebarGroups() {
      return this.$store.getters['table/nav_group/getAll']
        .filter(group => !group.admin || this.isAdmin)
        .sort((a, b) => a.order - b.order);
    },

    isAdmin() { return this.$store.getters['auth/isAdmin']; },
    settings() { return this.$store.getters["settings/getSettings"] || {}; },

    favoriteIds() {
      return this.favoriteIdsOverride || this.parseFavoriteIds(this.settings[SIDEBAR_FAVORITES_SETTING]);
    },

    favoriteElements() {
      const available = this.defaultGroupedElements.flatMap(g => g.elements);
      return this.getFavoriteElements(available, this.favoriteIds);
    },

    activeElementId() { return this.activeElement?.id ?? null; },

    defaultGroupedElements() {
      return this.sidebarGroups
        .filter(g => g.name !== 'Default' && g.name !== 'Admin')
        .map(g => ({ key: g.name, name: g.name, icon: g.icon, elements: (this.sidebarElements[g.id] || []) }))
        .filter(g => g.elements.length > 0);
    },

    activeSubgroup() {
      if (!this.activeElement) return null;
      return this.defaultGroupedElements.find(g =>
        Array.isArray(g.elements) && g.elements.some(item => String(item.id) === String(this.activeElement.id))
      )?.key || null;
    },

    hoveredSubgroup() {
      return this.defaultGroupedElements.find(g => g.key === this.hoveredGroup) || null;
    },
  },

  watch: {
    activeSubgroup(newGroup) {
      newGroup ? this.setOnlyExpandedGroup(newGroup) : this.closeAllGroups();
    },
    defaultGroupedElements(newGroups) {
      (newGroups || []).forEach(g => { if (!(g.key in this.groupStates)) this.groupStates[g.key] = false; });
      this.$nextTick(() => this.syncSidebarWithRoute());
      if (this.hoveredGroup) {
        if (!newGroups.some(g => g.key === this.hoveredGroup)) this.resetPreview();
        else this.$nextTick(() => this.updatePreviewPosition());
      }
    },
    $route() {
      this.resetPreview();
      this.$nextTick(() => requestAnimationFrame(() => this.syncSidebarWithRoute()));
    },
  },

  mounted() {
    document.body.classList.add('sidebar-exists');
    this.eventBus.on("dashboardHome", this.syncSidebarWithRoute);
    window.addEventListener("resize", this.updatePreviewPosition);
    window.addEventListener("scroll", this.updatePreviewPosition, true);
    document.addEventListener("click", this.handlePinnedPreviewOutsideClick);
    this.initFavoriteSocket();
    this.initGroupStates();
    this.syncSidebarWithRoute();
  },

  beforeUnmount() {
    this.eventBus.off("dashboardHome", this.syncSidebarWithRoute);
    window.removeEventListener("resize", this.updatePreviewPosition);
    window.removeEventListener("scroll", this.updatePreviewPosition, true);
    document.removeEventListener("click", this.handlePinnedPreviewOutsideClick);
    this.cleanupFavoriteSocket();
    this.previewResizeObserver?.disconnect();
    document.body.classList.remove('sidebar-exists');
  },

  methods: {
    resolveApiMessage,
    parseFavoriteIds,
    toggleFavoriteId,
    getFavoriteElements,
    getFlyoutStyle,

    _setGroupState(name, isOpen) {
      if (name in this.groupStates) this.groupStates[name] = isOpen;
    },

    closeAllGroups() {
      this.resetPreview();
      Object.keys(this.groupStates).forEach(name => this._setGroupState(name, false));
    },

    setOnlyExpandedGroup(groupName) {
      if (!groupName) return;
      this.resetPreview();
      Object.keys(this.groupStates).forEach(name => {
        this._setGroupState(name, name === groupName && !this.isCollapsed);
      });
    },

    toggleGroup(anchor, groupName) {
      if (this.isCollapsed) {
        if (this.pinnedPreviewGroup === groupName) { this.resetPreview(); return; }
        this.pinnedPreviewGroup = groupName;
        this.handleGroupMouseEnter({ currentTarget: anchor }, groupName);
        return;
      }
      const isOpening = !this.groupStates[groupName];
      this.resetPreview();
      this._setGroupState(groupName, isOpening);
    },

    toggleSidebar() {
      this.isCollapsed = !this.isCollapsed;
      document.body.classList.toggle('sb-sidenav-toggled', this.isCollapsed);
      this.resetPreview();
      this.isCollapsed ? this.closeAllGroups() : this.syncSidebarWithRoute();
    },

    syncSidebarWithRoute() {
      this.activeSubgroup ? this.setOnlyExpandedGroup(this.activeSubgroup) : this.closeAllGroups();
    },

    initGroupStates() {
      (this.defaultGroupedElements || []).forEach(g => {
        if (!(g.key in this.groupStates)) this.groupStates[g.key] = false;
      });
    },

    resetPreview() {
      this.hoveredGroup = null;
      this.pinnedPreviewGroup = null;
      this.previewStyle = {};
      this.isHoveringPreview = false;
      this.previewAnchor = null;
      this.previewResizeObserver?.disconnect();
      this.previewResizeObserver = null;
    },

    handlePinnedPreviewOutsideClick(event) {
      if (!this.pinnedPreviewGroup) return;
      const target = event.target;
      if (target?.closest?.('.sidebar-subgroup-heading') || this.$refs.sidebarPreview?.$el?.contains(target)) return;
      this.resetPreview();
    },

    _isRelatedTargetInGroup(event, groupName, selector) {
      const rel = event.relatedTarget;
      return typeof rel?.closest === 'function' && rel.closest(selector)?.dataset?.groupKey === groupName;
    },

    handleGroupMouseEnter(event, groupName) {
      groupName = groupName || event?.currentTarget?.dataset?.groupKey;
      if (this.pinnedPreviewGroup && this.pinnedPreviewGroup !== groupName) return;
      if (this.groupStates[groupName] && !this.isCollapsed) { this.resetPreview(); return; }
      const anchor = event?.currentTarget;
      if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
        this.hoveredGroup = groupName;
        return;
      }
      const rect = anchor.getBoundingClientRect();
      this.previewAnchor = anchor;
      this.previewStyle = {
        top: `${rect.top - 8}px`,
        left: `${rect.right}px`,
        maxWidth: `${Math.max(0, window.innerWidth - 16)}px`,
        maxHeight: `${Math.max(0, window.innerHeight - 16)}px`,
      };
      this.hoveredGroup = groupName;
      this.$nextTick(() => { this.observePreviewPosition(); this.updatePreviewPosition(); });
    },

    observePreviewPosition() {
      const preview = this.$refs.sidebarPreview?.$el;
      if (!this.previewAnchor?.isConnected || !preview || typeof ResizeObserver === 'undefined') return;
      if (!this.previewResizeObserver) {
        this.previewResizeObserver = new ResizeObserver(() => this.updatePreviewPosition());
      }
      this.previewResizeObserver.disconnect();
      this.previewResizeObserver.observe(this.previewAnchor);
      this.previewResizeObserver.observe(preview);
    },

    updatePreviewPosition() {
      const preview = this.$refs.sidebarPreview?.$el;
      if (!this.hoveredGroup || !this.previewAnchor?.isConnected || !preview) return;
      this.previewStyle = this.getFlyoutStyle(
        this.previewAnchor.getBoundingClientRect(),
        preview.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight }
      );
    },

    handleGroupMouseLeave(event, groupName) {
      groupName = groupName || event.currentTarget?.dataset?.groupKey;
      if (this.pinnedPreviewGroup || this._isRelatedTargetInGroup(event, groupName, '.submenu-preview')) return;
      this.resetPreview();
    },

    handlePreviewMouseEnter() { this.isHoveringPreview = true; },

    handlePreviewMouseLeave(event, groupName) {
      this.isHoveringPreview = false;
      if (this.pinnedPreviewGroup || this._isRelatedTargetInGroup(event, groupName, '.sidebar-subgroup-heading')) return;
      this.resetPreview();
    },

    toggleFavorite(element) {
      if (this.isSavingFavorites || !element || element.id === undefined || element.id === null) return;
      const availableIds = new Set(this.defaultGroupedElements.flatMap(g => g.elements.map(i => String(i.id))));
      if (!availableIds.has(String(element.id))) return;
      const nextIds = this.toggleFavoriteId(this.favoriteIds, element.id);
      this.favoriteIdsOverride = nextIds;
      this.isSavingFavorites = true;
      this.favoriteSettingsReconcileSequence = null;
      const saveSeq = ++this.favoriteSaveSequence;
      this.favoriteSaveTimer = setTimeout(() => this.handleFavoriteSaveTimeout(saveSeq), FAVORITES_SAVE_TIMEOUT_MS);
      this.$socket.emit('appSettingSet', { key: SIDEBAR_FAVORITES_SETTING, value: JSON.stringify(nextIds) }, res => {
        if (saveSeq !== this.favoriteSaveSequence) return;
        this.clearFavoriteSaveTimer();
        this.isSavingFavorites = false;
        if (this.favoriteSettingsUncertain) this.requestFavoriteSettingsReconciliation();
        else this.favoriteIdsOverride = null;
        if (!res?.success) {
          const resolve = this.resolveApiMessage || ((r, k) => r?.message || k);
          this.eventBus.emit('toast', {
            title: this.$t('sidebar.favorites.saveFailedTitle'),
            message: resolve(res, 'sidebar.favorites.saveFailedMessage'),
            variant: 'danger',
          });
        }
      });
    },

    initFavoriteSocket() {
      this.favoriteSocketDisconnectHandler = this.handleFavoriteSocketDisconnect.bind(this);
      this.favoriteSocketConnectHandler = this.handleFavoriteSocketConnect.bind(this);
      this.favoriteSettingsHandler = this.handleFavoriteSettings.bind(this);
      this.$socket.on('disconnect', this.favoriteSocketDisconnectHandler);
      this.$socket.on('connect', this.favoriteSocketConnectHandler);
      this.$socket.on('appSettings', this.favoriteSettingsHandler);
    },

    cleanupFavoriteSocket() {
      this.$socket.off('disconnect', this.favoriteSocketDisconnectHandler);
      this.$socket.off('connect', this.favoriteSocketConnectHandler);
      this.$socket.off('appSettings', this.favoriteSettingsHandler);
      this.clearFavoriteSaveTimer();
      this.favoriteSaveSequence += 1;
    },

    clearFavoriteSaveTimer() {
      if (this.favoriteSaveTimer !== null) {
        clearTimeout(this.favoriteSaveTimer);
        this.favoriteSaveTimer = null;
      }
    },

    handleFavoriteSaveTimeout(saveSeq) {
      if (saveSeq !== this.favoriteSaveSequence || !this.isSavingFavorites) return;
      this.clearFavoriteSaveTimer();
      this.isSavingFavorites = false;
      this.favoriteSaveSequence += 1;
      this.favoriteSettingsUncertain = true;
      this.requestFavoriteSettingsReconciliation();
    },

    handleFavoriteSocketDisconnect() {
      this.favoriteSettingsReconcileSequence = null;
      if (this.isSavingFavorites) {
        this.clearFavoriteSaveTimer();
        this.isSavingFavorites = false;
        this.favoriteSaveSequence += 1;
        this.favoriteSettingsUncertain = true;
      }
    },

    handleFavoriteSocketConnect() { this.requestFavoriteSettingsReconciliation(); },

    requestFavoriteSettingsReconciliation() {
      if (!this.favoriteSettingsUncertain || !this.$socket?.connected || this.favoriteSettingsReconcileSequence === this.favoriteSaveSequence) return;
      this.favoriteSettingsReconcileSequence = this.favoriteSaveSequence;
      this.$socket.emit('appInit');
    },

    handleFavoriteSettings(settings) {
      const reconcileSeq = this.favoriteSettingsReconcileSequence;
      if (reconcileSeq === null || reconcileSeq !== this.favoriteSaveSequence || this.isSavingFavorites || !this.favoriteSettingsUncertain) return;
      this.favoriteSettingsReconcileSequence = null;
      this.favoriteSettingsUncertain = false;
      const serverSetting = settings?.[SIDEBAR_FAVORITES_SETTING];
      this.$store.commit('settings/set', { key: SIDEBAR_FAVORITES_SETTING, value: serverSetting });
      this.favoriteIdsOverride = this.parseFavoriteIds(serverSetting);
      this.$nextTick(() => {
        if (reconcileSeq === this.favoriteSaveSequence && !this.isSavingFavorites) this.favoriteIdsOverride = null;
      });
    },
  },
};
</script>

<style src="./sidebar.css"></style>
