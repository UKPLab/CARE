/**
 * Hover-preview coordination for Sidebar.vue, spread-composed into its own
 * data()/computed/methods (see the data-factory + collision-check contract this
 * issue's plan established for spread-composition modules). Decides which group's
 * floating preview is showing and where, from mouse events and DOM geometry.
 * Reads `this.groupStates` (owned by Sidebar.vue) read-only to skip previewing an
 * already-open group; has no dependency on routing.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */

// Fresh data factory so preview state is never shared across component instances
export function sidebarHoverPreviewData() {
  return {
    hoveredGroup: null,
    previewStyle: {},
    isHoveringPreview: false,
  };
}

export const sidebarHoverPreviewComputed = {
  // Resolves the currently-hovered group's full data for the single shared <SidebarPreview>
  hoveredSubgroup() {
    return this.defaultGroupedElements.find(group => group.key === this.hoveredGroup) || null;
  },
};

export const sidebarHoverPreviewMethods = {
  resetPreview() {
    this.hoveredGroup = null;
    this.previewStyle = {};
    this.isHoveringPreview = false;
  },

  // Checks whether the mouse moved into a related element of the same subgroup
  // Used to prevent flickering when moving the cursor from subgroup header
  // to preview and back
  _isRelatedTargetInGroup(event, groupName, selector) {
    return event.relatedTarget?.closest(selector)?.dataset.groupKey === groupName;
  },

  handleGroupMouseEnter(event, groupName) {
    if (this.groupStates[groupName]) {
      this.resetPreview();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    this.previewStyle = {
      top: `${rect.top - 8}px`,
      left: `${rect.right}px`,
    };
    this.hoveredGroup = groupName;
  },

  handleGroupMouseLeave(event, groupName) {
    if (this._isRelatedTargetInGroup(event, groupName, '.submenu-preview')) return;
    this.resetPreview();
  },

  handlePreviewMouseEnter() {
    this.isHoveringPreview = true;
  },

  handlePreviewMouseLeave(event, groupName) {
    this.isHoveringPreview = false;

    if (this._isRelatedTargetInGroup(event, groupName, '.sidebar-subgroup-heading')) return;

    this.resetPreview();
  },
};
